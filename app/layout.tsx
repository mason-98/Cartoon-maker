import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/ui/use-toast";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/ui/headers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cartoon Maker",
  description: "Generate custom Cartoons using AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Header />
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
