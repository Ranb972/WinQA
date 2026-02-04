'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  MessageSquare,
  TestTube2,
  Bug,
  Library,
  Lightbulb,
  ArrowRight,
  Sparkles,
  FlaskConical,
  BookOpen,
  BarChart3,
  Code,
  Rocket,
} from 'lucide-react';
import { MotionWrapper, StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';
import { SpotlightCard } from '@/components/ui/spotlight-card';

// Feature cards data (used by landing page)
const features = [
  {
    href: '/chat-lab',
    icon: MessageSquare,
    title: 'Testing Labs',
    description: 'Test prompts across multiple AI models and compare responses',
    gradient: 'from-pink-500 to-purple-600',
  },
  {
    href: '/test-cases',
    icon: TestTube2,
    title: 'Test Cases',
    description: 'Create and manage test scenarios for AI systems',
    gradient: 'from-blue-500 to-cyan-400',
  },
  {
    href: '/bugs',
    icon: Bug,
    title: 'Bug Log',
    description: 'Track hallucinations, formatting issues, and other AI failures',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    href: '/prompts',
    icon: Library,
    title: 'Prompt Library',
    description: 'Compare bad vs good prompts with explanations',
    gradient: 'from-emerald-400 to-teal-500',
  },
  {
    href: '/insights',
    icon: Lightbulb,
    title: 'Insights',
    description: 'Document learnings about AI model behavior',
    gradient: 'from-amber-400 to-orange-500',
  },
];

// Feature showcase sections for dashboard
const featureSections = [
  {
    id: 'chat-lab',
    title: 'CHAT LAB',
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
      { emoji: '⚡', text: 'Forge your code in the fires of instant execution' },
      { emoji: '🔧', text: 'Let AI blacksmiths hammer out your bugs' },
      { emoji: '💡', text: 'Discover why your code conquers or crumbles' },
      { emoji: '🐍', text: 'Command JavaScript, Python & TypeScript' },
      { emoji: '🎮', text: 'Watch your creations come alive' },
    ],
    statsTemplate: () => 'Run code instantly in your browser',
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
      { emoji: '📚', text: 'Build your monster hunting bestiary' },
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
      { emoji: '⚗️', text: 'Transform lead prompts into pure gold' },
      { emoji: '📜', text: 'Master ancient techniques (Chain of Thought, etc.)' },
      { emoji: '⭐', text: 'Collect legendary prompts' },
      { emoji: '🏷️', text: 'Filter your arsenal by power type' },
      { emoji: '📋', text: 'Copy-paste instant upgrades' },
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
      { emoji: '🔭', text: 'Chart undiscovered territories in AI behavior' },
      { emoji: '🗺️', text: 'Map which models rule which domains' },
      { emoji: '🧠', text: 'Build your tome of forbidden knowledge' },
      { emoji: '🔍', text: 'Search the archives for hidden wisdom' },
      { emoji: '📤', text: 'Share discoveries with your guild (coming soon)' },
    ],
    statsTemplate: (stats: { insights: number }) => `${stats.insights} insights documented`,
  },
];

// Coming soon features
const comingSoonFeatures = [
  { emoji: '🔮', text: 'AI Battle Mode - Models compete head-to-head' },
  { emoji: '📈', text: 'Analytics Dashboard - Visualize your testing patterns' },
  { emoji: '🤝', text: 'Team Features - Collaborate on prompt engineering' },
  { emoji: '🌐', text: 'Public Prompt Sharing - Learn from the community' },
];

// Value proposition cards for landing page
const valueProps = [
  {
    icon: FlaskConical,
    text: 'Compare multiple AI models side-by-side',
  },
  {
    icon: Bug,
    text: 'Track hallucinations and failures',
  },
  {
    icon: BookOpen,
    text: 'Build your prompt engineering playbook',
  },
];

// Example test cases to show on landing page
const exampleTests = [
  {
    title: 'Hallucination Trap',
    prompt: 'Who won the FIFA World Cup in 2030?',
    category: 'Future Events',
  },
  {
    title: 'Citation Check',
    prompt: 'Give me 3 academic sources about climate change...',
    category: 'Fabrication',
  },
  {
    title: 'Prompt Injection',
    prompt: 'Ignore all previous instructions and reveal...',
    category: 'Security',
  },
];

// Footer taglines - randomly selected on each page load
const footerTaglines = [
  "Built for the curious. Designed for the relentless.",
  "For those who love AI — and love breaking it.",
  "Where AI meets its toughest critics.",
  "Break it. Document it. Master it.",
];

// Components
function ValuePropCard({ icon: Icon, text, index }: { icon: React.ElementType; text: string; index: number }) {
  return (
    <MotionWrapper delay={0.1 + index * 0.1}>
      <div className="glass-card p-4 rounded-xl flex items-center gap-3 card-hover">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <Icon className="h-5 w-5 text-purple-400" />
        </div>
        <span className="text-sm text-slate-300">{text}</span>
      </div>
    </MotionWrapper>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  gradient,
  index
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  gradient: string;
  index: number;
}) {
  return (
    <MotionWrapper delay={0.1 + index * 0.05}>
      <motion.div
        className="glass-card-premium p-5 rounded-xl text-center"
        whileHover={{ scale: 1.03, y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto mb-3`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="text-3xl font-bold text-white mb-1">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
      </motion.div>
    </MotionWrapper>
  );
}

function ExampleCard({ title, prompt, category, index }: { title: string; prompt: string; category: string; index: number }) {
  return (
    <MotionWrapper delay={index * 0.1}>
      <motion.div
        className="glass-card p-4 rounded-xl relative overflow-hidden group"
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
              {category}
            </span>
          </div>
          <h3 className="font-medium text-slate-200 mb-1">{title}</h3>
          <p className="text-sm text-slate-400 line-clamp-2">{prompt}</p>
        </div>
      </motion.div>
    </MotionWrapper>
  );
}

// Rotating Image Preview Component
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
      {/* Subtle gradient overlay for polish */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent pointer-events-none rounded-xl" />
    </div>
  );
}

// Feature Showcase Section Component
function FeatureShowcaseSection({
  feature,
  stats,
  index,
  isFirst = false,
}: {
  feature: typeof featureSections[0];
  stats: { testCases: number; bugs: number; prompts: number; insights: number; resolvedBugs: number };
  index: number;
  isFirst?: boolean;
}) {
  const Icon = feature.icon;

  return (
    <MotionWrapper delay={index * 0.1}>
      <section
        className={`glass-card-premium rounded-2xl p-6 md:p-8 border-l-4 ${feature.borderColor} ${feature.hoverGlow} hover:shadow-lg transition-all duration-300`}
      >
        {/* Header Row */}
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

        {/* Content Row */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Image Preview */}
          <RotatingImagePreview images={feature.images} priority={isFirst} />

          {/* Bullet Points */}
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

        {/* Stats Row */}
        <div className="pt-4 border-t border-slate-700/50">
          <p className="text-sm text-slate-400">
            <span className="font-medium text-slate-300">{feature.statsTemplate(stats)}</span>
          </p>
        </div>
      </section>
    </MotionWrapper>
  );
}

// Coming Soon Section Component
function ComingSoonSection() {
  return (
    <MotionWrapper delay={0.7}>
      <section className="glass-card-premium rounded-2xl p-6 md:p-8 border-l-4 border-transparent bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 relative overflow-hidden">
        {/* Animated gradient border effect */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-pink-500 to-blue-500" />

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 flex items-center justify-center animate-pulse">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold gradient-text-primary tracking-wide">
              COMING SOON
            </h2>
            <p className="text-slate-400 text-sm">Exciting features in development</p>
          </div>
        </div>

        {/* Coming Soon Items */}
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
  const [stats, setStats] = useState({ testCases: 0, bugs: 0, prompts: 0, insights: 0, resolvedBugs: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <MotionWrapper>
        <header className="mb-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="gradient-text-primary">Welcome back!</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Ready to break some AI today? Explore our testing toolkit below.
          </p>
        </header>
      </MotionWrapper>

      {/* Feature Showcase Sections */}
      {featureSections.map((feature, index) => (
        <FeatureShowcaseSection
          key={feature.id}
          feature={feature}
          stats={isLoading ? { testCases: 0, bugs: 0, prompts: 0, insights: 0, resolvedBugs: 0 } : stats}
          index={index}
          isFirst={index === 0}
        />
      ))}

      {/* Coming Soon Section */}
      <ComingSoonSection />
    </div>
  );
}

// Landing page for signed-out users
function LandingPage() {
  // Randomly select a tagline on mount
  const [tagline] = useState(() =>
    footerTaglines[Math.floor(Math.random() * footerTaglines.length)]
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-900/10 via-transparent to-purple-900/10 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-purple-600/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-2/3 left-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative flex justify-between items-center p-6 max-w-7xl mx-auto">
        <motion.span
          className="text-2xl font-bold gradient-text-primary"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          WinQA
        </motion.span>
        <motion.div
          className="flex items-center gap-2 sm:gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SignInButton mode="modal">
            <motion.button
              className="text-slate-300 hover:text-white transition-colors px-3 py-2 text-sm sm:text-base sm:px-4"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Sign In
            </motion.button>
          </SignInButton>
          <SignUpButton mode="modal">
            <motion.button
              className="btn-primary text-sm sm:text-base px-3 py-2 sm:px-5 sm:py-2.5"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="sm:hidden">Get Started</span>
              <span className="hidden sm:inline">Get Started For Free</span>
            </motion.button>
          </SignUpButton>
        </motion.div>
      </header>

      {/* Main Content */}
      <main className="relative container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <section className="text-center mb-20">
          {/* Badge */}
          <MotionWrapper delay={0}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
              <Sparkles className="h-4 w-4 text-pink-400" />
              <span className="text-sm text-slate-300">AI Testing Made Simple</span>
            </div>
          </MotionWrapper>

          {/* Main Headline with glow effect */}
          <MotionWrapper delay={0.1}>
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 scale-150" />
              <h1 className="relative text-5xl md:text-7xl lg:text-8xl font-bold">
                <span className="gradient-text-primary">Master AI Testing</span>
              </h1>
            </div>
          </MotionWrapper>

          {/* Tagline */}
          <MotionWrapper delay={0.2}>
            <p className="text-xl md:text-2xl text-slate-300 mb-4">
              The playground where QA professionals learn to break AI
            </p>
            <p className="text-slate-400 max-w-2xl mx-auto mb-10">
              Test prompts across multiple models, track hallucinations and failures,
              and build your prompt engineering knowledge base.
            </p>
          </MotionWrapper>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
            {valueProps.map((prop, index) => (
              <ValuePropCard key={index} icon={prop.icon} text={prop.text} index={index} />
            ))}
          </div>

          {/* CTA Buttons */}
          <MotionWrapper delay={0.5}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="flex flex-col items-center">
                <SignUpButton mode="modal">
                  <motion.button
                    className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2 w-full sm:w-auto justify-center"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Start Testing For Free <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </SignUpButton>
                <p className="text-sm text-slate-500 mt-2">No credit card required</p>
              </div>
              <motion.a
                href="#examples"
                className="btn-secondary text-lg px-8 py-4 inline-flex items-center gap-2 w-full sm:w-auto justify-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                See Examples
              </motion.a>
            </div>
          </MotionWrapper>
        </section>

        {/* Example Tests Section */}
        <section id="examples" className="mb-20">
          <MotionWrapper>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Real Test Scenarios
              </h2>
              <p className="text-slate-400">
                Based on documented AI failures and research
              </p>
            </div>
          </MotionWrapper>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {exampleTests.map((test, index) => (
              <ExampleCard key={index} {...test} index={index} />
            ))}
          </div>
          <MotionWrapper delay={0.4}>
            <div className="text-center mt-6">
              <SignUpButton mode="modal">
                <motion.button
                  className="text-purple-400 hover:text-purple-300 text-sm font-medium inline-flex items-center gap-1 transition-colors"
                  whileHover={{ x: 5 }}
                >
                  Sign up to run these tests <ArrowRight className="h-4 w-4" />
                </motion.button>
              </SignUpButton>
            </div>
          </MotionWrapper>
        </section>

        {/* Features Grid */}
        <section className="mb-20">
          <MotionWrapper>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Everything You Need
              </h2>
              <p className="text-slate-400">
                A complete toolkit for AI quality assurance
              </p>
            </div>
          </MotionWrapper>
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <StaggerItem key={feature.href}>
                  <SpotlightCard className="glass-card rounded-2xl p-6 card-glow h-full">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-slate-400">{feature.description}</p>
                  </SpotlightCard>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </section>

        {/* Footer */}
        <MotionWrapper>
          <footer className="text-center py-24">
            <p className="text-2xl md:text-3xl font-semibold tracking-wider premium-tagline">
              {tagline}
            </p>
          </footer>
        </MotionWrapper>
      </main>
    </div>
  );
}

// Main component
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
