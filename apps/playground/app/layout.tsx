import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Denovo Canvas Playground",
  description: "Next.js playground for Denovo Canvas."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html className={cn("dark font-sans", geist.variable)} lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
