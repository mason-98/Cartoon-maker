"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Heart, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Cartoon {
  id: number;
  image_url: string;
  prompt: string;
  likes_count: number;
  isLiked?: boolean;
  isLoading?: boolean;
  creator_user_id?: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [_loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [cartoons, setCartoons] = useState<Cartoon[]>([]);
  const { toast } = useToast();
  const { userId } = useAuth();

  // Create user profile if needed
  useEffect(() => {
    const createUserProfile = async () => {
      try {
        if (userId) {
          const response = await fetch('/api/auth/user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });

          if (!response.ok) {
            console.error('Failed to create/get user profile');
          }
        }
      } catch (error) {
        console.error('Error creating user profile:', error);
      }
    };

    createUserProfile();
  }, [userId]);

  // Load liked cartoons from localStorage on mount
  useEffect(() => {
    try {
      const savedCartoons = localStorage.getItem('likedCartoons');
      if (savedCartoons) {
        const parsed = JSON.parse(savedCartoons);
        if (Array.isArray(parsed)) {
          // Validate each item in the array
          const validCartoons = parsed.filter(cartoon => 
            cartoon && 
            typeof cartoon === 'object' && 
            typeof cartoon.image_url === 'string' &&
            typeof cartoon.prompt === 'string' &&
            typeof cartoon.id === 'number' && // Ensure ID exists and is a number
            !isNaN(cartoon.id) && // Ensure ID is not NaN
            cartoon.id > 0 // Ensure ID is positive
          );
          setCartoons(validCartoons);
        }
      }
    } catch (error) {
      console.error('Error loading saved cartoons:', error);
      localStorage.removeItem('likedCartoons');
    }
  }, []);

  // Helper function to safely store data in localStorage
  const safeLocalStorageSave = useCallback((key: string, data: Cartoon[]) => {
    try {
      // First try to clear any invalid entries
      const cleanupStorage = () => {
        try {
          const existingData = localStorage.getItem(key);
          if (existingData) {
            const parsed = JSON.parse(existingData);
            if (Array.isArray(parsed)) {
              // Remove any invalid entries
              const cleaned = parsed.filter(item => 
                item && 
                typeof item === 'object' && 
                typeof item.image_url === 'string' &&
                typeof item.prompt === 'string' &&
                typeof item.id === 'number' && // Ensure ID exists and is a number
                !isNaN(item.id) && // Ensure ID is not NaN
                item.id > 0 // Ensure ID is positive
              );
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          }
        } catch (_e) {
          // If cleanup fails, clear the storage
          localStorage.removeItem(key);
        }
      };

      const serialized = JSON.stringify(data);
      try {
        // Try to save normally first
        localStorage.setItem(key, serialized);
        return false; // Success, no trimming needed
      } catch (_storageError) {
        // If initial save fails, try cleanup and retry
        cleanupStorage();
        try {
          localStorage.setItem(key, serialized);
          return false;
        } catch (_retryError) {
          // If still fails, trim to last 10 items
          const trimmedData = data.slice(0, 10);
          const trimmedSerialized = JSON.stringify(trimmedData);
          localStorage.setItem(key, trimmedSerialized);
          setCartoons(trimmedData);
          return true; // Indicate data was trimmed
        }
      }
    } catch (error) {
      console.error('Error in safeLocalStorageSave:', error);
      return null; // Indicate error
    }
  }, []);

  // Save cartoons to localStorage whenever they change
  useEffect(() => {
    const wasTrimmed = safeLocalStorageSave('likedCartoons', cartoons);
    if (wasTrimmed === true) {
      toast({
        title: "Storage limit reached",
        description: "Only keeping the 20 most recent cartoons"
      });
    } else if (wasTrimmed === null) {
      toast({
        title: "Storage error",
        description: "Failed to save some cartoons. Try clearing old ones.",
        variant: "destructive"
      });
    }
  }, [cartoons, safeLocalStorageSave, toast]);

  // Fetch cartoons and like status
  const fetchCartoons = useCallback(async () => {
    try {
      const { data: cartoons, error } = await supabase
        .from('cartoons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching cartoons:", error);
        return;
      }

      let processedCartoons = cartoons.map(cartoon => ({
        id: Number(cartoon.cartoon_id),
        image_url: cartoon.image_url,
        prompt: cartoon.prompt,
        likes_count: Number(cartoon.likes_count || 0),
        creator_user_id: cartoon.creator_user_id,
        isLiked: false
      }));

      if (userId) {
        // Fetch user's likes
        const { data: likes } = await supabase
          .from('likes')
          .select('cartoon_id, status')
          .eq('liked_by', userId)
          .eq('status', 1);

        if (likes) {
          const likedCartoonIds = new Set(likes.map(like => like.cartoon_id));
          processedCartoons = processedCartoons.map(cartoon => ({
            ...cartoon,
            isLiked: likedCartoonIds.has(cartoon.id)
          }));
        }
      }

      console.log("Processed cartoons:", processedCartoons);
      setCartoons(processedCartoons);
    } catch (error) {
      console.error("Error in fetchCartoons:", error);
    }
  }, [userId]);

  // Fetch cartoons on mount and when userId changes
  useEffect(() => {
    fetchCartoons();
  }, [fetchCartoons]);

  const handleLike = async (imageURL: String, currentLikeStatus: boolean) => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to like cartoons",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Attempting to like cartoon:", { imageURL, currentLikeStatus });
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageURL,
          status: currentLikeStatus ? 0 : 1  // Toggle status: 0 for unlike, 1 for like
        }),
      });

      const data = await response.json();
      console.log("Like response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to update like status");
      }

      // Update local state
      setCartoons(prev => prev.map(cartoon => 
        cartoon.image_url === imageURL
          ? { 
              ...cartoon, 
              likes_count: data.likes_count,
              isLiked: !currentLikeStatus
            }
          : cartoon
      ));

      toast({
        title: "Success",
        description: `Cartoon ${currentLikeStatus ? 'unliked' : 'liked'} successfully!`
      });

    } catch (error: unknown) {
      console.error("Like operation failed:", error);
      let errorMessage = "";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: "Error",
        description: errorMessage || "Failed to update like status",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (imageURL: String) => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to delete cartoons",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("Attempting to delete cartoon:", { imageURL });
      const response = await fetch("/api/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageURL
        }),
      });

      const data = await response.json();
      console.log("Delete response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete cartoon");
      }

      // Update local state
      setCartoons(prev => prev.filter(cartoon => 
        cartoon.image_url !== imageURL
      ));

      toast({
        title: "Success",
        description: `Cartoon deleted successfully!`
      });

    } catch (error: any) {
      console.error("Delete operation failed:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete cartoon",
        variant: "destructive",
      });
    }
  };

  const generateCartoon = async () => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate cartoons",
        variant: "destructive",
      });
      return;
    }

    if (!prompt) {
      toast({
        title: "Error",
        description: "Please enter a prompt first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    const tempId = Date.now();

    // Add loading placeholder
    setCartoons(prevCartoons => [
      {
        id: tempId,
        image_url: "",
        prompt: prompt,
        likes_count: 0,
        isLiked: false,
        isLoading: true,
        creator_user_id: userId
      },
      ...prevCartoons
    ]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate cartoon");
      }

      // Replace loading placeholder with actual cartoon
      if (data.cartoonData) {
        setCartoons(prevCartoons => prevCartoons.map(cartoon => 
          cartoon.id === tempId
            ? {
                id: Number(data.cartoonData.cartoon_id),
                image_url: data.cartoonData.image_url,
                prompt: data.cartoonData.prompt,
                likes_count: 0,
                isLiked: false,
                creator_user_id: userId
              }
            : cartoon
        ));
      }

      setPrompt("");
      
      toast({
        title: "Success",
        description: "Cartoon generated successfully!"
      });
    } catch (error: any) {
      console.error("Generation error:", error);
      // Remove loading placeholder on error
      setCartoons(prevCartoons => prevCartoons.filter(cartoon => cartoon.id !== tempId));
      toast({
        title: "Error",
        description: error.message || "Failed to generate cartoon",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isGenerating) {
      generateCartoon();
    }
  };

  // Handle image load complete
  const handleImageLoad = (cartoonId: number) => {
    setLoadingImages(prev => {
      const next = new Set(prev);
      next.delete(cartoonId);
      return next;
    });
  };

  // Handle start of image loading
  const handleImageLoadStart = (cartoonId: number) => {
    setLoadingImages(prev => new Set(prev).add(cartoonId));
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8 flex items-center justify-center gap-2">
        <span role="img" aria-label="cartoon">🎨</span> 
        Cartoon Creator
      </h1>

      <div className="max-w-xl mx-auto mb-12">
        {userId ? (
          <div className="flex gap-2">
            <Input
              placeholder="Enter a prompt to generate a cartoon character"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1"
            />
            <Button
              onClick={generateCartoon}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <SignInButton mode="modal">
              <Button variant="default">Sign in to Generate Cartoons</Button>
            </SignInButton>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cartoons.map((cartoon) => (
          <Card key={cartoon.id} className="relative group p-4">
            <div className="aspect-square relative mb-2">
              {cartoon.isLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg p-4">
                  <div className="text-center space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">Generating image for:</p>
                      <p className="text-sm text-gray-600 break-words">{cartoon.prompt}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={cartoon.image_url}
                    alt={`Generated cartoon for ${cartoon.prompt}`}
                    className="w-full h-full object-contain transition-opacity duration-300"
                    onLoadStart={() => handleImageLoadStart(cartoon.id)}
                    onLoad={() => handleImageLoad(cartoon.id)}
                    onError={() => handleImageLoad(cartoon.id)}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:text-white hover:bg-white/20"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = cartoon.image_url;
                        const sanitizedName = cartoon.prompt
                          .replace(/[^a-z0-9]/gi, '_')
                          .toLowerCase();
                        link.download = `${sanitizedName}.png`;
                        link.click();
                      }}
                    >
                      <Download className="h-6 w-6" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`text-white hover:text-white hover:bg-white/20 ${
                        cartoon.isLiked ? 'text-red-500 hover:text-red-500' : ''
                      }`}
                      onClick={() => {
                        // console.log("Like button clicked for cartoon:", cartoon);
                        if (!cartoon.image_url) {
                          toast({
                            title: "Error",
                            description: "Invalid cartoon ID",
                            variant: "destructive",
                          });
                          return;
                        }
                        handleLike(cartoon.image_url, cartoon.isLiked || false);
                      }}
                    >
                      <Heart className={`h-6 w-6 ${cartoon.isLiked ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:text-white hover:bg-white/20"
                      onClick={() => {
                        // console.log("Delete button clicked for cartoon:", cartoon);
                        if (!cartoon.image_url) {
                          toast({
                            title: "Error",
                            description: "Invalid cartoon ID",
                            variant: "destructive",
                          });
                          return;
                        }
                        handleDelete(cartoon.image_url);
                      }}
                    >
                      <Trash2 className="h-6 w-6" />
                    </Button>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-sm flex items-center gap-1">
                    <Heart className="h-4 w-4" />
                    <span>{cartoon.likes_count}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-center text-sm font-medium truncate">
              {cartoon.prompt}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}
