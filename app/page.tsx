"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Heart } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [emojis, setEmojis] = useState<Array<{ 
    image: string; 
    description: string; 
    isLiked?: boolean;
    likeCount: number;
  }>>([]);
  const { toast } = useToast();

  // Helper function to safely store data in localStorage
  const safeLocalStorageSave = useCallback((key: string, data: any) => {
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
                item.image && 
                item.image.startsWith('data:image/')
              );
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          }
        } catch (e) {
          // If cleanup fails, clear the storage
          localStorage.removeItem(key);
        }
      };

      const serialized = JSON.stringify(data);
      try {
        // Try to save normally first
        localStorage.setItem(key, serialized);
        return false; // Success, no trimming needed
      } catch (storageError) {
        // If initial save fails, try cleanup and retry
        cleanupStorage();
        try {
          localStorage.setItem(key, serialized);
          return false;
        } catch (retryError) {
          // If still fails, trim to last 10 items
          const trimmedData = data.slice(0, 10);
          const trimmedSerialized = JSON.stringify(trimmedData);
          localStorage.setItem(key, trimmedSerialized);
          setEmojis(trimmedData);
          return true; // Indicate data was trimmed
        }
      }
    } catch (error) {
      console.error('Error in safeLocalStorageSave:', error);
      return null; // Indicate error
    }
  }, []);

  // Load liked emojis from localStorage on mount
  useEffect(() => {
    try {
      const savedEmojis = localStorage.getItem('likedEmojis');
      if (savedEmojis) {
        const parsed = JSON.parse(savedEmojis);
        if (Array.isArray(parsed)) {
          // Validate each item in the array
          const validEmojis = parsed.filter(emoji => 
            emoji && 
            typeof emoji === 'object' && 
            typeof emoji.image === 'string' &&
            typeof emoji.description === 'string'
          );
          setEmojis(validEmojis);
        }
      }
    } catch (error) {
      console.error('Error loading saved cartoons:', error);
      localStorage.removeItem('likedEmojis');
    }
  }, []);

  // Save emojis to localStorage whenever they change
  useEffect(() => {
    const wasTrimmed = safeLocalStorageSave('likedEmojis', emojis);
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
  }, [emojis, safeLocalStorageSave, toast]);

  const handleLike = useCallback((index: number) => {
    setEmojis(prev => {
      const newEmojis = prev.map((emoji, i) => {
        if (i === index) {
          const newLikeCount = emoji.likeCount + (emoji.isLiked ? -1 : 1);
          return { 
            ...emoji, 
            isLiked: !emoji.isLiked,
            likeCount: newLikeCount >= 0 ? newLikeCount : 0
          };
        }
        return emoji;
      });
      
      const emoji = newEmojis[index];
      setTimeout(() => {
        toast({
          title: emoji.isLiked ? "Removed from favorites" : "Added to favorites",
          description: `Emoji ${emoji.isLiked ? "removed from" : "added to"} your favorites`
        });
      }, 0);
      
      return newEmojis;
    });
  }, [toast]);

  const generateEmoji = async () => {
    if (!prompt) {
      toast({
        title: "Error",
        description: "Please enter a prompt first",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      console.log("Sending request with prompt:", prompt);
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.cartoons?.[0]) {
        throw new Error("No cartoon was generated");
      }

      // Validate the image data before saving
      if (!data.cartoons[0].startsWith('data:image/')) {
        throw new Error("Invalid image data received");
      }

      const newCartoon = {
        image: data.cartoons[0],
        description: data.description,
        likeCount: 0
      };
      console.log("Adding new cartoon:", newCartoon);

      setEmojis(prev => {
        console.log("Previous emojis:", prev);
        const newEmojis = [newCartoon, ...prev];
        console.log("New emojis array:", newEmojis);
        // Return trimmed array if too large
        return newEmojis.length > 50 ? newEmojis.slice(0, 50) : newEmojis;
      });

      toast({
        title: "Success",
        description: "Cartoon generated successfully!"
      });
      
      setPrompt("");
    } catch (error: any) {
      console.error("Generation error:", error);
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
      generateEmoji();
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center mb-8 flex items-center justify-center gap-2">
        <span role="img" aria-label="cartoon">🎨</span> 
        Cartoon Creator
      </h1>

      <div className="max-w-xl mx-auto mb-12">
        <div className="flex gap-2">
          <Input
            placeholder="Enter a prompt to generate a cartoon character"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1"
          />
          <Button
            onClick={generateEmoji}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {emojis.map((emoji, index) => (
          <Card key={index} className="relative group p-4">
            <div className="aspect-square relative mb-2">
              <img
                src={emoji.image}
                alt={`Generated emoji for ${emoji.description}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center gap-4">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:text-white hover:bg-white/20"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = emoji.image;
                    // Use the description (prompt) as the filename, sanitize it for valid filename
                    const sanitizedName = emoji.description
                      .replace(/[^a-z0-9]/gi, '_') // Replace invalid chars with underscore
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
                    emoji.isLiked ? 'text-red-500 hover:text-red-500' : ''
                  }`}
                  onClick={() => handleLike(index)}
                >
                  <Heart className={`h-6 w-6 ${emoji.isLiked ? 'fill-current' : ''}`} />
                </Button>
              </div>
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-sm flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{emoji.likeCount}</span>
              </div>
            </div>
            <p className="text-center text-sm font-medium truncate">
              {emoji.description}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}
