import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
    ClerkProvider,
    SignedIn,
    SignedOut,
} from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import Navbar from "@/components/Navbar";
import { baseMetadata } from "@/lib/metadata";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = baseMetadata;

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider>
            <html lang="en" className="dark">
                <body
                    className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-slate-100 min-h-screen`}
                >
                    {/* Ambient background glow */}
                    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl" />
                        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl" />
                        <div className="absolute top-3/4 left-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                    </div>

                    <SignedIn>
                        <Navbar />
                        <main className="pt-20 sm:pt-24 px-3 sm:px-4 md:px-6 pb-6 sm:pb-8 max-w-7xl mx-auto relative">
                            {children}
                        </main>
                    </SignedIn>
                    <SignedOut>
                        {children}
                    </SignedOut>
                    <Toaster />
                </body>
            </html>
        </ClerkProvider>
    );
}
