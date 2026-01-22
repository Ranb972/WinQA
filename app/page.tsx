'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { motion } from 'framer-motion';
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
  Zap,
  BarChart3,
} from 'lucide-react';
import { MotionWrapper, StaggerContainer, StaggerItem } from '@/components/ui/motion-wrapper';
import { SpotlightCard } from '@/components/ui/spotlight-card';

// Feature cards data
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

// Dashboard component for signed-in users
function Dashboard() {
  const [stats, setStats] = useState({ testCases: 0, bugs: 0, prompts: 0, insights: 0 });
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
    <div>
      {/* Welcome Section */}
      <MotionWrapper>
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="gradient-text-primary">Welcome back!</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Ready to break some AI today?
          </p>
        </header>
      </MotionWrapper>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={TestTube2}
          value={isLoading ? 0 : stats.testCases}
          label="Tests Created"
          gradient="from-blue-500 to-cyan-400"
          index={0}
        />
        <StatCard
          icon={Bug}
          value={isLoading ? 0 : stats.bugs}
          label="Bugs Logged"
          gradient="from-rose-500 to-pink-600"
          index={1}
        />
        <StatCard
          icon={Library}
          value={isLoading ? 0 : stats.prompts}
          label="Prompts Saved"
          gradient="from-emerald-400 to-teal-500"
          index={2}
        />
        <StatCard
          icon={Lightbulb}
          value={isLoading ? 0 : stats.insights}
          label="Insights"
          gradient="from-amber-400 to-orange-500"
          index={3}
        />
      </section>

      {/* Quick Actions */}
      <MotionWrapper delay={0.3}>
        <section className="flex flex-wrap gap-3 mb-10">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/chat-lab"
              className="btn-primary inline-flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              New Test
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/chat-lab?mode=compare"
              className="btn-secondary inline-flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Compare Models
            </Link>
          </motion.div>
        </section>
      </MotionWrapper>

      {/* Feature Cards */}
      <MotionWrapper delay={0.4}>
        <section>
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Quick Access</h2>
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <StaggerItem key={feature.href}>
                  <SpotlightCard className="glass-card-premium rounded-2xl p-5 h-full">
                    <Link href={feature.href} className="block h-full">
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3 transition-transform group-hover:scale-110`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-100 mb-1 group-hover:text-white transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-slate-400 mb-3">{feature.description}</p>
                      <div className="flex items-center text-purple-400 text-sm font-medium">
                        Open <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  </SpotlightCard>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </section>
      </MotionWrapper>
    </div>
  );
}

// Landing page for signed-out users
function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
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
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SignInButton mode="modal">
            <motion.button
              className="text-slate-300 hover:text-white transition-colors px-4 py-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Sign In
            </motion.button>
          </SignInButton>
          <SignUpButton mode="modal">
            <motion.button
              className="btn-primary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
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
              <SignUpButton mode="modal">
                <motion.button
                  className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2 w-full sm:w-auto justify-center"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Start Testing <ArrowRight className="h-5 w-5" />
                </motion.button>
              </SignUpButton>
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
          <footer className="text-center text-slate-500">
            <p>Built for QA professionals exploring AI testing</p>
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
