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
  Github,
  Swords,
  ChevronDown,
  Search,
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
// DASHBOARD (signed-in) — data + components (unchanged)
// ============================================================

const featureSections = [
  {
    id: 'chat-lab',
    title: 'CHAT LAB · COMPARE MODE',
    icon: FlaskConical,
    href: '/chat-lab',
    borderColor: 'border-purple-500/30',
    hoverGlow: 'hover:shadow-purple-500/20',
    gradient: 'from-purple-500 to-violet-600',
    iconBg: 'bg-purple-500/20',
    dotColor: 'bg-purple-500',
    images: ['/images/dashboard/chat-lab.png', '/images/dashboard/chat-lab-2.png'],
    bullets: [
      { emoji: '🔥', text: 'Pit AI giants against each other - who wins?' },
      { emoji: '👑', text: 'Crown the champion for any task' },
      { emoji: '⚔️', text: 'Switch warriors mid-battle with one click' },
      { emoji: '⏱️', text: "See who's fastest to the answer" },
      { emoji: '🔓', text: 'Unleash premium models with your own keys' },
    ],
    statsTemplate: () => 'Compare AI models side-by-side',
  },
  {
    id: 'code-testing',
    title: 'CODE TESTING LAB',
    icon: Code,
    href: '/code-testing',
    borderColor: 'border-emerald-500/30',
    hoverGlow: 'hover:shadow-emerald-500/20',
    gradient: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-500/20',
    dotColor: 'bg-emerald-500',
    images: ['/images/dashboard/code-testing.png', '/images/dashboard/code-testing-2.png'],
    bullets: [
      { emoji: '⚡', text: 'Run code instantly in your browser' },
      { emoji: '🔧', text: 'Let AI find and fix your bugs' },
      { emoji: '💡', text: 'Discover why your code works or fails' },
      { emoji: '🐍', text: 'Command JavaScript, Python & TypeScript' },
      { emoji: '🎮', text: 'Watch your creations come alive' },
    ],
    statsTemplate: () => 'Run code instantly in your browser',
  },
  {
    id: 'battle',
    title: 'AI BATTLE',
    icon: Swords,
    href: '/battle',
    borderColor: 'border-orange-500/30',
    hoverGlow: 'hover:shadow-orange-500/20',
    gradient: 'from-orange-500 to-amber-600',
    iconBg: 'bg-orange-500/20',
    dotColor: 'bg-orange-500',
    images: ['/images/dashboard/battle.png', '/images/dashboard/battle-2.png'],
    bullets: [
      { emoji: '⚔️', text: 'Two AIs, one challenge - only one survives' },
      { emoji: '🎯', text: '9 unique battle types from code duels to emoji wars' },
      { emoji: '🎭', text: 'Blindfold mode - guess who wrote what before the reveal' },
      { emoji: '👑', text: 'Battle Royale - 4 models enter, 1 champion remains' },
      { emoji: '📊', text: 'Live leaderboard tracks every victory' },
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
    borderColor: 'border-cyan-500/30',
    hoverGlow: 'hover:shadow-cyan-500/20',
    gradient: 'from-cyan-500 to-blue-500',
    iconBg: 'bg-cyan-500/20',
    dotColor: 'bg-cyan-500',
    images: ['/images/dashboard/test-cases.png', '/images/dashboard/test-cases-2.png'],
    bullets: [
      { emoji: '🎭', text: 'Interrogate AI - will it crack under pressure?' },
      { emoji: '🕵️', text: 'Catch lies and hallucinations red-handed' },
      { emoji: '🛡️', text: 'Test defenses against prompt injection attacks' },
      { emoji: '⚔️', text: 'Craft your own trial scenarios' },
      { emoji: '🔄', text: 'Put every model through the same trial' },
    ],
    statsTemplate: (stats: { testCases: number }) => `${stats.testCases} test cases available`,
  },
  {
    id: 'bugs',
    title: 'BUG LOG',
    icon: Bug,
    href: '/bugs',
    borderColor: 'border-rose-500/30',
    hoverGlow: 'hover:shadow-rose-500/20',
    gradient: 'from-rose-500 to-pink-600',
    iconBg: 'bg-rose-500/20',
    dotColor: 'bg-rose-500',
    images: ['/images/dashboard/bug-log.png', '/images/dashboard/bug-log-2.png'],
    bullets: [
      { emoji: '🎯', text: 'Capture AI failures with a single click' },
      { emoji: '🏷️', text: 'Tag the crime: Hallucination, Logic, Formatting, Refusal' },
      { emoji: '📊', text: 'Track threat level and case status' },
      { emoji: '🔗', text: 'Link every bug to the prompt that spawned it' },
      { emoji: '📚', text: 'Build your knowledge base of AI failures' },
    ],
    statsTemplate: (stats: { bugs: number; resolvedBugs: number }) =>
      `${stats.bugs} bugs documented | ${stats.resolvedBugs} resolved`,
  },
  {
    id: 'prompts',
    title: 'PROMPT LIBRARY',
    icon: Library,
    href: '/prompts',
    borderColor: 'border-amber-500/30',
    hoverGlow: 'hover:shadow-amber-500/20',
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-500/20',
    dotColor: 'bg-amber-500',
    images: ['/images/dashboard/prompt-library.png', '/images/dashboard/prompt-library-2.png'],
    bullets: [
      { emoji: '⚗️', text: 'Transform weak prompts into effective ones' },
      { emoji: '📜', text: 'Master techniques like Chain of Thought' },
      { emoji: '⭐', text: 'Collect high-quality prompt examples' },
      { emoji: '🏷️', text: 'Filter your collection by category' },
      { emoji: '📋', text: 'Copy-paste ready prompts' },
    ],
    statsTemplate: (stats: { prompts: number }) => `${stats.prompts} prompt examples`,
  },
  {
    id: 'insights',
    title: 'INSIGHTS',
    icon: Lightbulb,
    href: '/insights',
    borderColor: 'border-yellow-500/30',
    hoverGlow: 'hover:shadow-yellow-500/20',
    gradient: 'from-yellow-500 to-amber-500',
    iconBg: 'bg-yellow-500/20',
    dotColor: 'bg-yellow-500',
    images: ['/images/dashboard/insights.png', '/images/dashboard/insights-2.png'],
    bullets: [
      { emoji: '🔭', text: 'Chart undiscovered patterns in AI behavior' },
      { emoji: '🗺️', text: 'Map which models excel in which domains' },
      { emoji: '🧠', text: 'Build your knowledge base' },
      { emoji: '🔍', text: 'Search the archives for insights' },
      { emoji: '📤', text: 'Share discoveries (coming soon)' },
    ],
    statsTemplate: (stats: { insights: number }) => `${stats.insights} insights documented`,
  },
];

const comingSoonFeatures = [
  { emoji: '📈', text: 'Analytics Dashboard - Visualize your testing patterns' },
  { emoji: '🤝', text: 'Team Features - Collaborate on prompt engineering' },
  { emoji: '🌐', text: 'Public Prompt Sharing - Learn from the community' },
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
    <div className="relative h-[200px] md:h-[220px] rounded-xl overflow-hidden group border border-slate-700/50">
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
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent pointer-events-none rounded-xl" />
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
      <section
        className={`glass-card-premium rounded-2xl p-6 md:p-8 border-l-4 ${feature.borderColor} ${feature.hoverGlow} hover:shadow-lg transition-all duration-300`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
              {feature.title}
            </h2>
          </div>
          <Link href={feature.href}>
            <motion.button
              className="btn-primary inline-flex items-center gap-2 text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Try Now <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <RotatingImagePreview images={feature.images} priority={isFirst} />
          <ul className="space-y-3">
            {feature.bullets.map((bullet, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-start gap-3"
              >
                <span className="text-lg flex-shrink-0">{bullet.emoji}</span>
                <span className="text-slate-300 text-sm md:text-base">{bullet.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t border-slate-700/50">
          {isLoading ? (
            <div className="h-5 w-48 bg-slate-800/50 rounded animate-pulse"></div>
          ) : (
            <p className="text-sm text-slate-400">
              <span className="font-medium text-slate-300">{feature.statsTemplate(stats)}</span>
            </p>
          )}
        </div>
      </section>
    </MotionWrapper>
  );
}

// Coming Soon Section Component (Dashboard)
function ComingSoonSection() {
  return (
    <MotionWrapper delay={0.7}>
      <section className="glass-card-premium rounded-2xl p-6 md:p-8 border-l-4 border-transparent bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-pink-500 to-blue-500" />
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center animate-pulse">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
              COMING SOON
            </h2>
            <p className="text-slate-400 text-sm">Exciting features in development</p>
          </div>
        </div>
        <ul className="space-y-3">
          {comingSoonFeatures.map((item, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center gap-3"
            >
              <span className="text-lg">{item.emoji}</span>
              <span className="text-slate-400">{item.text}</span>
            </motion.li>
          ))}
        </ul>
      </section>
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
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="text-white">Welcome back!</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Ready to break some AI today? Explore our testing toolkit below.
          </p>
        </header>
      </MotionWrapper>

      {error && (
        <MotionWrapper>
          <div className="bg-rose-950/20 border border-rose-900/30 rounded-lg p-4">
            <p className="text-rose-400 text-sm">Unable to load stats: {error}</p>
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

      <ComingSoonSection />
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
