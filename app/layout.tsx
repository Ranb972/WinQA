import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
    ClerkProvider,
    SignedIn,
    SignedOut,
} from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
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
                    className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100 min-h-screen`}
                >
                    {/* Ambient background glow */}
                    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-slate-500/[0.08] rounded-full blur-3xl" />
                        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl" />
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
                    <Analytics />
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify({
                                '@context': 'https://schema.org',
                                '@type': 'WebApplication',
                                name: 'WinQA',
                                url: 'https://winqa.ai',
                                description:
                                    'AI Testing Playground - Compare AI models, test prompts, track hallucinations, and build your prompt engineering knowledge base.',
                                applicationCategory: 'DeveloperApplication',
                                operatingSystem: 'Web',
                                offers: {
                                    '@type': 'Offer',
                                    price: '0',
                                    priceCurrency: 'USD',
                                },
                                featureList: [
                                    'Compare AI models side-by-side',
                                    'AI Battle Arena with 9 challenge types',
                                    'Code execution lab (JavaScript, Python, TypeScript)',
                                    'Bug and hallucination tracking',
                                    'Prompt engineering library',
                                    'Test case management',
                                ],
                            }),
                        }}
                    />
                </body>
            </html>
        </ClerkProvider>
    );
}
