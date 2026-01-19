'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
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
function ValuePropCard({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="glass-card p-4 rounded-xl flex items-center gap-3 card-hover">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
        <Icon className="h-5 w-5 text-purple-400" />
      </div>
      <span className="text-sm text-slate-300">{text}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  gradient
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  gradient: string;
}) {
  return (
    <div className="glass-card p-5 rounded-xl text-center card-hover">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto mb-3`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

function ExampleCard({ title, prompt, category }: { title: string; prompt: string; category: string }) {
  return (
    <div className="glass-card p-4 rounded-xl relative overflow-hidden group">
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
    </div>
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
    <div className="animate-fade-in">
      {/* Welcome Section */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          <span className="gradient-text-primary">Welcome back!</span>
        </h1>
        <p className="text-slate-400 text-lg">
          Ready to break some AI today?
        </p>
      </header>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={TestTube2}
          value={isLoading ? 0 : stats.testCases}
          label="Tests Created"
          gradient="from-blue-500 to-cyan-400"
        />
        <StatCard
          icon={Bug}
          value={isLoading ? 0 : stats.bugs}
          label="Bugs Logged"
          gradient="from-rose-500 to-pink-600"
        />
        <StatCard
          icon={Library}
          value={isLoading ? 0 : stats.prompts}
          label="Prompts Saved"
          gradient="from-emerald-400 to-teal-500"
        />
        <StatCard
          icon={Lightbulb}
          value={isLoading ? 0 : stats.insights}
          label="Insights"
          gradient="from-amber-400 to-orange-500"
        />
      </section>

      {/* Quick Actions */}
      <section className="flex flex-wrap gap-3 mb-10">
        <Link
          href="/chat-lab"
          className="btn-primary inline-flex items-center gap-2"
        >
          <Zap className="h-4 w-4" />
          New Test
        </Link>
        <Link
          href="/chat-lab?mode=compare"
          className="btn-secondary inline-flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Compare Models
        </Link>
      </section>

      {/* Feature Cards */}
      <section>
        <h2 className="text-xl font-semibold text-slate-200 mb-4">Quick Access</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link
                key={feature.href}
                href={feature.href}
                className="group glass-card rounded-2xl p-5 card-hover card-glow"
              >
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
            );
          })}
        </div>
      </section>
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
        <span className="text-2xl font-bold gradient-text-primary">
          WinQA
        </span>
        <div className="flex items-center gap-4">
          <SignInButton mode="modal">
            <button className="text-slate-300 hover:text-white transition-colors px-4 py-2">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="btn-primary">
              Get Started
            </button>
          </SignUpButton>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative container mx-auto px-4 py-12 md:py-20">
        {/* Hero Section */}
        <section className="text-center mb-20 animate-fade-in">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
            <Sparkles className="h-4 w-4 text-pink-400" />
            <span className="text-sm text-slate-300">AI Testing Made Simple</span>
          </div>

          {/* Main Headline with glow effect */}
          <div className="relative mb-6">
            <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 scale-150" />
            <h1 className="relative text-5xl md:text-7xl lg:text-8xl font-bold">
              <span className="gradient-text-primary">Master AI Testing</span>
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-xl md:text-2xl text-slate-300 mb-4">
            The playground where QA professionals learn to break AI
          </p>
          <p className="text-slate-400 max-w-2xl mx-auto mb-10">
            Test prompts across multiple models, track hallucinations and failures,
            and build your prompt engineering knowledge base.
          </p>

          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-10">
            {valueProps.map((prop, index) => (
              <ValuePropCard key={index} icon={prop.icon} text={prop.text} />
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <SignUpButton mode="modal">
              <button className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2 w-full sm:w-auto justify-center">
                Start Testing <ArrowRight className="h-5 w-5" />
              </button>
            </SignUpButton>
            <a
              href="#examples"
              className="btn-secondary text-lg px-8 py-4 inline-flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              See Examples
            </a>
          </div>
        </section>

        {/* Example Tests Section */}
        <section id="examples" className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Real Test Scenarios
            </h2>
            <p className="text-slate-400">
              Based on documented AI failures and research
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {exampleTests.map((test, index) => (
              <ExampleCard key={index} {...test} />
            ))}
          </div>
          <div className="text-center mt-6">
            <SignUpButton mode="modal">
              <button className="text-purple-400 hover:text-purple-300 text-sm font-medium inline-flex items-center gap-1 transition-colors">
                Sign up to run these tests <ArrowRight className="h-4 w-4" />
              </button>
            </SignUpButton>
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Everything You Need
            </h2>
            <p className="text-slate-400">
              A complete toolkit for AI quality assurance
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.href}
                  className="group glass-card rounded-2xl p-6 card-hover card-glow"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-slate-500">
          <p>Built for QA professionals exploring AI testing</p>
        </footer>
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
