'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  TestTube2,
  Bug,
  Library,
  Lightbulb,
  ArrowRight,
  FlaskConical,
  Code,
  Rocket,
  Swords,
  Search,
  Zap,
  Trophy,
  Repeat,
  Timer,
  KeyRound,
  Play,
  Wrench,
  BrainCircuit,
  Terminal,
  Gamepad2,
  Target,
  EyeOff,
  Shield,
  RefreshCw,
  Tag,
  BarChart3,
  Link2,
  BookOpen,
  ScrollText,
  Star,
  Filter,
  ClipboardCopy,
  Compass,
  Map,
  SearchCode,
  Share2,
  TrendingUp,
  Users,
  Lock,
} from 'lucide-react';
import { MotionWrapper } from '@/components/ui/motion-wrapper';

// Glitch landing page components
import { IntroSequence } from '@/components/glitch/intro-sequence';
import { HeroSection } from '@/components/glitch/hero-section';
import { BattleModes } from '@/components/glitch/battle-modes';
import { ToolsSection } from '@/components/glitch/tools-section';
import { CTASection } from '@/components/glitch/cta-section';
import { Footer } from '@/components/glitch/footer';
import { FilmGrain } from '@/components/glitch/film-grain';

// ============================================================
// DASHBOARD (signed-in) — investigation theme
// ============================================================

const featureSections = [
  {
    id: 'chat-lab',
    title: 'CHAT LAB · COMPARE MODE',
    icon: FlaskConical,
    href: '/chat-lab',
    images: ['/images/dashboard/chat-lab.png', '/images/dashboard/chat-lab-2.png'],
    bullets: [
      { icon: Swords, text: 'Pit AI giants against each other - who wins?' },
      { icon: Trophy, text: 'Crown the champion for any task' },
      { icon: Repeat, text: 'Switch models mid-conversation with one click' },
      { icon: Timer, text: "See who's fastest to the answer" },
      { icon: KeyRound, text: 'Unleash premium models with your own keys' },
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
      { icon: Zap, text: 'Run code instantly in your browser' },
      { icon: Wrench, text: 'Let AI find and fix your bugs' },
      { icon: BrainCircuit, text: 'Discover why your code works or fails' },
      { icon: Terminal, text: 'Command JavaScript, Python & TypeScript' },
      { icon: Gamepad2, text: 'Watch your creations come alive' },
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
      { icon: Swords, text: 'Two AIs, one challenge - only one survives' },
      { icon: Target, text: '9 unique battle types from code duels to emoji wars' },
      { icon: EyeOff, text: 'Blindfold mode - guess who wrote what before the reveal' },
      { icon: Trophy, text: 'Battle Royale - 4 models enter, 1 champion remains' },
      { icon: BarChart3, text: 'Live leaderboard tracks every victory' },
    ],
    statsTemplate: (stats: { battles: number }) =>
      stats.battles > 0
        ? `${stats.battles} battles fought | 9 battle challenges`
        : '9 battle challenges',
  },
  {
    id: 'test-cases',
    title: 'TEST CASES',
    icon: TestTube2,
    href: '/test-cases',
    images: ['/images/dashboard/test-cases.png', '/images/dashboard/test-cases-2.png'],
    bullets: [
      { icon: Search, text: 'Interrogate AI - will it crack under pressure?' },
      { icon: Target, text: 'Catch lies and hallucinations red-handed' },
      { icon: Shield, text: 'Test defenses against prompt injection attacks' },
      { icon: Swords, text: 'Craft your own trial scenarios' },
      { icon: RefreshCw, text: 'Put every model through the same trial' },
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
      { icon: Target, text: 'Capture AI failures with a single click' },
      { icon: Tag, text: 'Tag the crime: Hallucination, Logic, Formatting, Refusal' },
      { icon: BarChart3, text: 'Track threat level and case status' },
      { icon: Link2, text: 'Link every bug to the prompt that spawned it' },
      { icon: BookOpen, text: 'Build your knowledge base of AI failures' },
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
      { icon: ScrollText, text: 'Transform weak prompts into effective ones' },
      { icon: BrainCircuit, text: 'Master techniques like Chain of Thought' },
      { icon: Star, text: 'Collect high-quality prompt examples' },
      { icon: Filter, text: 'Filter your collection by category' },
      { icon: ClipboardCopy, text: 'Copy-paste ready prompts' },
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
      { icon: Compass, text: 'Chart undiscovered patterns in AI behavior' },
      { icon: Map, text: 'Map which models excel in which domains' },
      { icon: BrainCircuit, text: 'Build your knowledge base' },
      { icon: SearchCode, text: 'Search the archives for insights' },
      { icon: Share2, text: 'Share discoveries (coming soon)' },
    ],
    statsTemplate: (stats: { insights: number }) => `${stats.insights} insights documented`,
  },
];

// Rotating Image Preview Component (Dashboard)
function RotatingImagePreview({ images, priority = false }: { images: string[]; priority?: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  return (
    <div className="relative h-[200px] md:h-[220px] rounded-lg overflow-hidden group border border-white/[0.06]">
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
}

// Feature Showcase Section Component (Dashboard)
function FeatureShowcaseSection({
  feature,
  stats,
  isLoading = false,
  index,
  isFirst = false,
}: {
  feature: typeof featureSections[0];
  stats: { testCases: number; bugs: number; prompts: number; insights: number; resolvedBugs: number; battles: number };
  isLoading?: boolean;
  index: number;
  isFirst?: boolean;
}) {
  const Icon = feature.icon;

  return (
    <MotionWrapper delay={index * 0.1}>
      <section className="relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden hover:border-orange-500/30 transition-all duration-300 group">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-orange-500/40 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-orange-500/40 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-orange-500/40 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-orange-500/40 rounded-br-lg" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 md:p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Icon className="h-5 w-5 text-orange-500" />
            </div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-white font-heading">
              {feature.title}
            </h2>
          </div>
          <Link href={feature.href}>
            <motion.button
              className="bg-orange-500 hover:bg-orange-400 text-black font-medium px-4 py-2 rounded text-sm transition-colors inline-flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Try Now <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-2 gap-6 p-4 md:p-6">
          <RotatingImagePreview images={feature.images} priority={isFirst} />
          <ul className="space-y-3">
            {feature.bullets.map((bullet, idx) => {
              const BulletIcon = bullet.icon;
              return (
                <motion.li
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 text-sm text-zinc-400"
                >
                  <BulletIcon className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                  <span>{bullet.text}</span>
                </motion.li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 pb-4 md:pb-6">
          <div className="pt-3 border-t border-white/[0.04]">
            {isLoading ? (
              <div className="h-4 w-48 bg-white/[0.04] rounded animate-pulse"></div>
            ) : (
              <p className="text-xs text-zinc-600 font-mono">
                {feature.statsTemplate(stats)}
              </p>
            )}
          </div>
        </div>
      </section>
    </MotionWrapper>
  );
}

// Under Development Section (Dashboard)
function UnderDevelopmentSection() {
  const upcoming = [
    {
      icon: TrendingUp,
      title: 'Analytics Dashboard',
      description: 'Deep analysis of model performance, win rates, hallucination patterns, and testing trends. Your data, visualized.',
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Shared workspaces, team investigations, collaborative bug tracking, and shared prompt libraries. Test AI together.',
    },
  ];

  return (
    <MotionWrapper delay={0.7}>
      {/* Section label */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <span className="w-12 h-px bg-orange-500/50" />
        <span className="text-orange-500 font-mono text-xs tracking-[0.2em] uppercase">
          Under Development
        </span>
        <span className="w-12 h-px bg-orange-500/50" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {upcoming.map((item) => {
          const ItemIcon = item.icon;
          return (
            <div
              key={item.title}
              className="relative p-6 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] opacity-80"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/5 border border-orange-500/10 flex items-center justify-center shrink-0">
                  <ItemIcon className="w-5 h-5 text-orange-500/60" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-white font-heading">{item.title}</h3>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border border-orange-500/20 bg-orange-500/5 text-orange-500/70">
                      <Lock className="w-2.5 h-2.5" />
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </MotionWrapper>
  );
}

// Dashboard component for signed-in users
function Dashboard() {
  const [stats, setStats] = useState({ testCases: 0, bugs: 0, prompts: 0, insights: 0, resolvedBugs: 0, battles: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        if (typeof data.testCases === 'number' && typeof data.bugs === 'number') {
          setStats(data);
          setError(null);
        } else {
          throw new Error('Invalid stats data structure received');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <MotionWrapper>
        <header className="mb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-mono uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            AI Investigation Unit
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white font-heading">
            Welcome back!
          </h1>
          <p className="text-zinc-500 text-base mt-2">
            Ready to break some AI today? Explore your testing toolkit below.
          </p>
        </header>
      </MotionWrapper>

      {error && (
        <MotionWrapper>
          <div className="bg-orange-950/20 border border-orange-900/30 rounded-lg p-4">
            <p className="text-orange-400 text-sm">Unable to load stats: {error}</p>
          </div>
        </MotionWrapper>
      )}

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

      <UnderDevelopmentSection />
    </div>
  );
}

// ============================================================
// LANDING PAGE (signed-out) — v0 glitch theme
// ============================================================

function LandingPage() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      {/* Intro sequence */}
      <AnimatePresence>
        {showIntro && (
          <IntroSequence onComplete={() => setShowIntro(false)} />
        )}
      </AnimatePresence>

      {/* Main landing content — fades in after intro */}
      {!showIntro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <HeroSection />
          <BattleModes />
          <ToolsSection />
          <CTASection />
          <Footer />
        </motion.div>
      )}

      {/* Film grain overlay */}
      <FilmGrain />
    </div>
  );
}

// ============================================================
// MAIN EXPORT
// ============================================================

export default function Home() {
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <Dashboard />
      </SignedIn>
    </>
  );
}
