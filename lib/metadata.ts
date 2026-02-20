import type { Metadata } from 'next';

const siteConfig = {
  name: 'WinQA',
  url: 'https://winqa.ai',
  description: 'Compare AI models, test prompts, track bugs, and master prompt engineering. The ultimate playground for QA professionals.',
  keywords: ['AI testing', 'prompt engineering', 'LLM comparison', 'QA tools', 'AI playground', 'test automation'],
};

export const baseMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'WinQA - AI Testing Playground',
    template: '%s | WinQA',
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: 'WinQA Team' }],
  creator: 'WinQA',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: 'WinQA - AI Testing Playground',
    description: siteConfig.description,
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'WinQA - AI Testing Playground',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WinQA - AI Testing Playground',
    description: siteConfig.description,
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: 'WinQA - AI Testing Playground',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: '/',
  },
};

export const pageMetadata = {
  chatLab: {
    title: 'Chat Lab - Compare AI Models',
    description: 'Test and compare responses from multiple AI models side by side. Experiment with prompts and analyze LLM behavior.',
  },
  codeTesting: {
    title: 'Code Testing Lab - Run & Debug Code',
    description: 'Execute and debug code snippets with AI assistance. Test your code in an interactive browser environment.',
  },
  testCases: {
    title: 'Test Cases - AI Testing Scenarios',
    description: 'Create and manage test scenarios for AI systems. Organize your prompt testing workflow efficiently.',
  },
  bugs: {
    title: 'Bug Log - Track AI Failures',
    description: 'Track hallucinations, formatting issues, and other AI failures. Document and analyze LLM edge cases.',
  },
  prompts: {
    title: 'Prompt Library - Best Practices',
    description: 'Access a curated collection of effective prompts. Learn prompt engineering best practices and techniques.',
  },
  insights: {
    title: 'Insights - AI Discoveries',
    description: 'Discover patterns and insights from your AI testing. Track trends and document your learnings.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure your WinQA preferences and API keys for AI model providers.',
  },
  battle: {
    title: 'AI Battle Arena',
    description: 'Pit AI models against each other in head-to-head challenges. Code duels, blindfold tests, battle royale - 9 unique challenge types with live code execution.',
  },
};
