'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical,
  Code,
  Swords,
  TestTube2,
  Bug,
  Library,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';

// ============================================
// DESIGN SYSTEM TOKENS (from WinQA Design System)
// ============================================
// Colors:
// - Background: #000000 (pure black)
// - Card: rgba(255,255,255,0.02)
// - Border: rgba(255,255,255,0.08)
// - Primary (Orange): #f97316
// - Text: #ffffff, #71717a (muted)
// Typography:
// - Headings: Space Grotesk
// - Body: Inter
// - Mono: JetBrains Mono
// ============================================

// Feature sections data
const featureSections = [
  {
    id: 'chat-lab',
    title: 'CHAT LAB · COMPARE MODE',
    icon: FlaskConical,
    href: '/chat-lab',
    images: ['/images/dashboard/chat-lab.png', '/images/dashboard/chat-lab-2.png'],
    bullets: [
      { icon: '🔥', text: 'Pit AI giants against each other - who wins?' },
      { icon: '👑', text: 'Crown the champion for any task' },
      { icon: '⚔️', text: 'Switch warriors mid-battle with one click' },
      { icon: '⏱️', text: "See who's fastest to the answer" },
      { icon: '🔓', text: 'Unleash premium models with your own keys' },
    ],
    statsTemplate: () => 'Compare AI models side-by-side',
  },
  {
    id: 'code-testing',
    title: 'CODE TESTING LAB',
    icon: Code,
    href: '/code-testing',
    images: ['/images/dashboard/code-testing.png', '/images/dashboard/code-testing-2.png'],
    bullets: [
      { icon: '⚡', text: 'Run code instantly in your browser' },
      { icon: '🔧', text: 'Let AI find and fix your bugs' },
      { icon: '💡', text: 'Discover why your code works or fails' },
      { icon: '🐍', text: 'Command JavaScript, Python & TypeScript' },
    ],
    statsTemplate: () => 'Run code instantly in your browser',
  },
  {
    id: 'battle',
    title: 'AI BATTLE',
    icon: Swords,
    href: '/battle',
    images: ['/images/dashboard/battle.png', '/images/dashboard/battle-2.png'],
    bullets: [
      { icon: '⚔️', text: 'Two AIs, one challenge - only one survives' },
      { icon: '🎯', text: '9 unique battle types from code duels to emoji wars' },
      { icon: '🎭', text: 'Blindfold mode - guess who wrote what before the reveal' },
      { icon: '👑', text: 'Battle Royale - 4 models enter, 1 champion remains' },
      { icon: '📊', text: 'Live leaderboard tracks every victory' },
    ],
    statsTemplate: (stats: { battles: number }) =>
      stats.battles > 0 ? `${stats.battles} battles fought` : '9 battle challenges',
  },
  {
    id: 'test-cases',
    title: 'TEST CASES',
    icon: TestTube2,
    href: '/test-cases',
    images: ['/images/dashboard/test-cases.png', '/images/dashboard/test-cases-2.png'],
    bullets: [
      { icon: '🎭', text: 'Interrogate AI - will it crack under pressure?' },
      { icon: '🕵️', text: 'Catch lies and hallucinations red-handed' },
      { icon: '🛡️', text: 'Test defenses against prompt injection attacks' },
    ],
    statsTemplate: (stats: { testCases: number }) => `${stats.testCases} test cases available`,
  },
  {
    id: 'bugs',
    title: 'BUG LOG',
    icon: Bug,
    href: '/bugs',
    images: ['/images/dashboard/bug-log.png', '/images/dashboard/bug-log-2.png'],
    bullets: [
      { icon: '📊', text: 'Track threat level and case status' },
      { icon: '🔗', text: 'Link every bug to the prompt that spawned it' },
      { icon: '📚', text: 'Build your knowledge base of AI failures' },
    ],
    statsTemplate: (stats: { bugs: number; resolvedBugs: number }) =>
      `${stats.bugs} bugs documented | ${stats.resolvedBugs} resolved`,
  },
  {
    id: 'prompts',
    title: 'PROMPT LIBRARY',
    icon: Library,
    href: '/prompts',
    images: ['/images/dashboard/prompt-library.png', '/images/dashboard/prompt-library-2.png'],
    bullets: [
      { icon: '⚗️', text: 'Transform weak prompts into effective ones' },
      { icon: '📜', text: 'Master techniques like Chain of Thought' },
    ],
    statsTemplate: (stats: { prompts: number }) => `${stats.prompts} prompt examples`,
  },
  {
    id: 'insights',
    title: 'INSIGHTS',
    icon: Lightbulb,
    href: '/insights',
    images: ['/images/dashboard/insights.png', '/images/dashboard/insights-2.png'],
    bullets: [
      { icon: '🔭', text: 'Chart AI behavior patterns' },
      { icon: '📤', text: 'Share discoveries (coming soon)' },
    ],
    statsTemplate: (stats: { insights: number }) => `${stats.insights} insights documented`,
  },
];

// ============================================
// FILM GRAIN COMPONENT
// ============================================
function FilmGrain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      style={{
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
      }}
    />
  );
}

// ============================================
// BACKGROUND EFFECTS COMPONENT
// ============================================
function BackgroundEffects() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Subtle vertical gradient bands */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #000000 0%, #080808 25%, #000000 50%, #0a0a0a 75%, #000000 100%)',
        }}
      />

      {/* Faint grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />

      {/* Ambient orange orb - top right */}
      <div
        className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(circle, rgba(249,115,22,0.8) 0%, transparent 70%)',
        }}
      />

      {/* Ambient orange orb - bottom left */}
      <div
        className="absolute -bottom-48 -left-48 w-[800px] h-[800px] rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, rgba(249,115,22,0.6) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

// ============================================
// INVESTIGATION LABEL COMPONENT
// ============================================
function InvestigationLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="w-8 h-px bg-orange-500" />
      <span className="text-orange-500 text-sm font-mono tracking-[0.15em] uppercase">
        {children}
      </span>
    </div>
  );
}

// ============================================
// CARD WITH CORNER ACCENTS
// ============================================
function InvestigationCard({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      className={`relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden transition-all duration-300 hover:border-orange-500/30 hover:shadow-[0_0_30px_rgba(249,115,22,0.05)] ${className}`}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-orange-500/30 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-orange-500/30 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-orange-500/30 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-orange-500/30 rounded-br-lg" />

      {children}
    </motion.div>
  );
}

// ============================================
// PRIMARY BUTTON (ORANGE)
// ============================================
function PrimaryButton({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href}>
      <motion.button
        className="group inline-flex items-center gap-3 px-6 py-3 bg-orange-500 text-black font-semibold rounded-lg hover:bg-orange-400 transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {children}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </motion.button>
    </Link>
  );
}

// ============================================
// ROTATING IMAGE PREVIEW
// ============================================
function RotatingImagePreview({
  images,
  priority = false,
}: {
  images: string[];
  priority?: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="relative h-[200px] md:h-[220px] rounded-lg overflow-hidden border border-white/[0.06] group">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <Image
            src={images[currentIndex]}
            alt="Feature preview"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={priority && currentIndex === 0}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </motion.div>
      </AnimatePresence>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
}

// ============================================
// FEATURE SHOWCASE SECTION
// ============================================
function FeatureShowcaseSection({
  feature,
  stats,
  isLoading = false,
  index,
  isFirst = false,
}: {
  feature: (typeof featureSections)[0];
  stats: {
    testCases: number;
    bugs: number;
    prompts: number;
    insights: number;
    resolvedBugs: number;
    battles: number;
  };
  isLoading?: boolean;
  index: number;
  isFirst?: boolean;
}) {
  const Icon = feature.icon;

  return (
    <InvestigationCard delay={index * 0.1}>
      {/* Card header bar */}
      <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Icon className="h-5 w-5 text-orange-500" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight font-heading">
            {feature.title}
          </h2>
        </div>
        <PrimaryButton href={feature.href}>Try Now</PrimaryButton>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Image Preview */}
          <RotatingImagePreview images={feature.images} priority={isFirst} />

          {/* Bullet Points */}
          <ul className="space-y-3">
            {feature.bullets.map((bullet, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.08 }}
                className="flex items-start gap-3 px-4 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-orange-500/20 transition-colors"
              >
                <span className="text-base flex-shrink-0">{bullet.icon}</span>
                <span className="text-white/70 text-sm leading-relaxed">{bullet.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Stats Row */}
        <div className="pt-4 border-t border-white/[0.06]">
          {isLoading ? (
            <div className="h-5 w-48 bg-white/[0.05] rounded animate-pulse" />
          ) : (
            <p className="font-mono text-white/40 text-xs tracking-wider uppercase">
              {feature.statsTemplate(stats)}
            </p>
          )}
        </div>
      </div>
    </InvestigationCard>
  );
}

// ============================================
// MAIN INVESTIGATION DASHBOARD COMPONENT
// ============================================
export default function InvestigationDashboard() {
  const [stats, setStats] = useState({
    testCases: 0,
    bugs: 0,
    prompts: 0,
    insights: 0,
    resolvedBugs: 0,
    battles: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }

        if (typeof data.testCases === 'number' && typeof data.bugs === 'number') {
          setStats(data);
          setError(null);
        } else {
          throw new Error('Invalid stats data structure received');
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch stats';
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Background effects */}
      <BackgroundEffects />
      <FilmGrain />

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Section */}
        <motion.header
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-12"
        >
          <InvestigationLabel>AI Investigation Unit</InvestigationLabel>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] leading-[0.95] font-heading">
            <span className="text-white">Welcome back!</span>
          </h1>

          <p className="mt-4 text-lg sm:text-xl text-white/50 leading-relaxed max-w-2xl">
            Ready to break some AI today? Explore our testing toolkit below.
          </p>
        </motion.header>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 bg-red-950/20 border border-red-500/20 rounded-lg p-4"
          >
            <p className="text-red-400 text-sm">Unable to load stats: {error}</p>
          </motion.div>
        )}

        {/* Feature Showcase Sections */}
        <div className="space-y-8">
          {featureSections.map((feature, index) => (
            <FeatureShowcaseSection
              key={feature.id}
              feature={feature}
              stats={stats}
              isLoading={isLoading}
              index={index}
              isFirst={index === 0}
            />
          ))}
        </div>

        {/* Quick Actions Footer */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 pt-8 border-t border-white/[0.06]"
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className="w-12 h-px bg-orange-500/50" />
            <span className="text-orange-500 font-mono text-xs tracking-[0.2em] uppercase">
              Quick Actions
            </span>
            <span className="w-12 h-px bg-orange-500/50" />
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: 'Start Chat', href: '/chat-lab' },
              { label: 'Run Code', href: '/code-testing' },
              { label: 'Battle Arena', href: '/battle' },
              { label: 'View Test Cases', href: '/test-cases' },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <motion.button
                  className="px-6 py-3 bg-white/5 border border-white/10 text-white/70 rounded-lg hover:bg-white/10 hover:text-white hover:border-orange-500/30 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {action.label}
                </motion.button>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Footer tagline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-white/30 text-sm font-mono tracking-wider">
            Built for the curious. Designed for the relentless.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
