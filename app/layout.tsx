import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, JetBrains_Mono } from "next/font/google";
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

const spaceGrotesk = Space_Grotesk({
    variable: "--font-heading",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
    variable: "--font-mono",
    subsets: ["latin"],
    weight: ["400", "500", "700"],
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
                    className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased bg-black text-slate-100 min-h-screen`}
                >
                    {/* Ambient background — investigation theme */}
                    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
                        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-orange-500/[0.03] rounded-full blur-3xl" />
                        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-orange-500/[0.02] rounded-full blur-3xl" />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />
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
