'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion';
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
// LANDING PAGE (signed-out) — cinematic redesign
// ============================================================

// CSS keyframes for background effects (injected once)
const landingStyles = `
  @keyframes grain {
    0%, 100% { transform: translate(0, 0); }
    10% { transform: translate(-5%, -10%); }
    30% { transform: translate(3%, -15%); }
    50% { transform: translate(-8%, 5%); }
    70% { transform: translate(8%, -5%); }
    90% { transform: translate(-3%, 10%); }
  }
  @keyframes orb-drift-1 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.06; }
    25% { transform: translate(40px, -30px) scale(1.05); opacity: 0.07; }
    50% { transform: translate(-20px, 20px) scale(0.95); opacity: 0.05; }
    75% { transform: translate(30px, 40px) scale(1.02); opacity: 0.06; }
  }
  @keyframes orb-drift-2 {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.04; }
    33% { transform: translate(-30px, 20px) scale(1.08); opacity: 0.05; }
    66% { transform: translate(20px, -40px) scale(0.96); opacity: 0.03; }
  }
  @keyframes orb-drift-3 {
    0%, 100% { transform: translate(0, 0); opacity: 0.03; }
    50% { transform: translate(0, -50px); opacity: 0.04; }
  }
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes glow-pulse {
    0%, 100% { text-shadow: 0 0 40px rgba(16,185,129,0.3), 0 0 80px rgba(16,185,129,0.1); }
    50% { text-shadow: 0 0 60px rgba(16,185,129,0.5), 0 0 120px rgba(16,185,129,0.2); }
  }
  .landing-grain::after {
    content: '';
    position: fixed;
    inset: -50%;
    width: 200%;
    height: 200%;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
    background-size: 128px 128px;
    opacity: 0.035;
    pointer-events: none;
    z-index: 40;
    animation: grain 8s steps(10) infinite;
  }
  .animate-gradient-text {
    background-size: 200% auto;
    animation: gradient-shift 4s ease infinite;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .dot-grid {
    background-image: radial-gradient(circle, rgba(148,163,184,0.08) 1px, transparent 1px);
    background-size: 40px 40px;
  }
`;

// Animated counter hook
function useCountUp(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [isInView, target, duration]);

  return { count, ref };
}

// Stat counter component
function AnimatedStat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { count, ref } = useCountUp(value);
  return (
    <div className="text-center">
      <span
        ref={ref}
        className="text-5xl md:text-7xl font-black text-white tabular-nums block"
        style={{ textShadow: '0 0 20px rgba(16,185,129,0.15)' }}
      >
        {count}{suffix}
      </span>
      <p className="text-sm text-slate-500 mt-2 uppercase tracking-widest">{label}</p>
    </div>
  );
}

// Typewriter component for intro
function Typewriter({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const indexRef = useRef(0);

  useEffect(() => {
    const chars = text.split('');
    function typeNext() {
      if (indexRef.current >= chars.length) {
        onComplete?.();
        return;
      }
      const char = chars[indexRef.current];
      indexRef.current++;
      setDisplayed(text.slice(0, indexRef.current));
      // Pause after periods
      const delay = char === '.' ? 300 : 50;
      setTimeout(typeNext, delay);
    }
    const startDelay = setTimeout(typeNext, 200);
    return () => clearTimeout(startDelay);
  }, [text, onComplete]);

  useEffect(() => {
    const interval = setInterval(() => setShowCursor(v => !v), 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-xl md:text-2xl text-slate-300 font-light">
      {displayed}
      <span className="text-emerald-400" style={{ opacity: showCursor ? 1 : 0 }}>|</span>
    </span>
  );
}

// Feature card with parallax
function FeatureRow({ feature, index }: { feature: typeof landingFeatures[0]; index: number }) {
  const isReversed = index % 2 === 1;
  const rowRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: rowRef,
    offset: ['start end', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <motion.div
      ref={rowRef}
      className={`flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 md:gap-12 items-center`}
      initial={{ opacity: 0, x: isReversed ? 60 : -60 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Screenshot with parallax + hover glow */}
      <motion.div
        className="md:w-[55%] flex-shrink-0 rounded-xl overflow-hidden border border-slate-800/50 bg-slate-900/30 transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]"
        style={{ y: imageY }}
      >
        <Image
          src={feature.image}
          alt={`${feature.title} screenshot`}
          width={720}
          height={450}
          className="w-full h-auto"
          priority={index === 0}
        />
      </motion.div>

      {/* Text */}
      <div className="flex-1">
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
          {feature.title}
        </h3>
        <p className="text-slate-400 leading-relaxed">
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

// Feature card data
const landingFeatures = [
  {
    title: 'Chat Lab',
    description: 'Chat with any AI model one-on-one, or compare multiple models side-by-side on the same prompt. See how Gemini, Cohere, Groq, and OpenRouter models differ in real time.',
    image: '/images/screenshots/chat-lab.jpg',
  },
  {
    title: 'AI Battle Arena',
    description: '9 unique challenge types from code duels to creative writing. Blindfold mode lets you vote before revealing which model wrote what. Track wins on the live leaderboard.',
    image: '/images/screenshots/battle.jpg',
  },
  {
    title: 'Code Testing Lab',
    description: 'Write and run JavaScript, Python, or TypeScript instantly. Get AI-powered debugging analysis that explains what went wrong and suggests fixes.',
    image: '/images/screenshots/code-testing.jpg',
  },
  {
    title: 'Bug Log',
    description: 'Document every AI failure with structured tags: hallucination, logic error, formatting issue, or refusal. Track severity, status, and link bugs to the prompts that caused them.',
    image: '/images/screenshots/bug-log.jpg',
  },
];

// How it works steps
const steps = [
  {
    number: '01',
    title: 'Pick your models',
    description: 'Choose from 4 AI providers with dozens of models. Bring your own API keys for premium access.',
    icon: Search,
  },
  {
    number: '02',
    title: 'Run tests & battles',
    description: 'Send the same prompt to multiple models. Compare responses, run code, and vote on winners.',
    icon: FlaskConical,
  },
  {
    number: '03',
    title: 'Document findings',
    description: 'Log bugs, save prompts, write insights. Build a structured knowledge base of AI behavior.',
    icon: Bug,
  },
];

function LandingPage() {
  const [introComplete, setIntroComplete] = useState(false);
  const [phase, setPhase] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Intro sequence: 4-phase state machine
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 800);    // line drawn → logo
    const t2 = setTimeout(() => setPhase(2), 1800);   // typewriter starts
    const t3 = setTimeout(() => setPhase(3), 3400);   // fade out
    const t4 = setTimeout(() => setIntroComplete(true), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  const skipIntro = useCallback(() => {
    setPhase(3);
    setTimeout(() => setIntroComplete(true), 200);
  }, []);

  // Mouse spotlight (desktop only)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    requestAnimationFrame(() => {
      setMousePos({ x: e.clientX, y: e.clientY });
    });
  }, []);

  const ctaBtnClass = "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-lg px-8 py-4 inline-flex items-center gap-2 transition-all duration-300 shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_50px_rgba(16,185,129,0.5)] hover:scale-105";

  return (
    <div
      className="relative min-h-screen bg-slate-950 text-white overflow-x-hidden landing-grain"
      onMouseMove={handleMouseMove}
    >
      {/* Inject CSS keyframes */}
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />

      {/* ── Cinematic Intro Sequence ── */}
      <AnimatePresence>
        {!introComplete && (
          <motion.div
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center cursor-pointer"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={skipIntro}
            onWheel={skipIntro}
          >
            {/* Phase 0: Horizontal line */}
            <motion.div
              className="h-px bg-white mb-8"
              initial={{ width: 0, opacity: 0 }}
              animate={phase >= 0 ? { width: 200, opacity: 1 } : {}}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
              style={phase >= 1 ? { opacity: 0, transition: 'opacity 0.3s' } : {}}
            />

            {/* Phase 1: Logo with glow */}
            <motion.h1
              className="text-6xl md:text-8xl font-black tracking-tight"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={phase >= 1 ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
              style={phase >= 1 ? { animation: 'glow-pulse 2s ease-in-out' } : {}}
            >
              WinQA
            </motion.h1>

            {/* Phase 2: Typewriter */}
            <div className="mt-6 h-10 flex items-center">
              {phase >= 2 && phase < 3 && (
                <Typewriter text="Compare. Break. Learn." />
              )}
            </div>

            {/* Skip hint */}
            <motion.p
              className="absolute bottom-8 text-sm text-slate-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 1 ? 0.6 : 0 }}
              transition={{ delay: 0.5 }}
            >
              Click or scroll to skip
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Background Layers ── */}
      {/* Ambient orbs (CSS animations, not Framer Motion) */}
      <div
        className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
          animation: 'orb-drift-1 20s ease-in-out infinite',
        }}
      />
      <div
        className="fixed bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)',
          animation: 'orb-drift-2 15s ease-in-out infinite',
        }}
      />
      <div
        className="fixed top-[40%] left-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(20,184,166,0.03) 0%, transparent 70%)',
          animation: 'orb-drift-3 25s ease-in-out infinite',
        }}
      />

      {/* Dot grid */}
      <div className="fixed inset-0 dot-grid pointer-events-none z-0" />

      {/* Mouse spotlight (desktop only) */}
      <div
        className="hidden md:block fixed w-[600px] h-[600px] rounded-full pointer-events-none z-10"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)',
          transform: `translate(${mousePos.x - 300}px, ${mousePos.y - 300}px)`,
          transition: 'transform 0.15s ease-out',
        }}
      />

      {/* ── Header ── */}
      <header className="relative z-20 flex justify-between items-center p-6 max-w-7xl mx-auto">
        <motion.span
          className="text-2xl font-bold text-white tracking-tight"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: introComplete ? 0 : 4.0 }}
        >
          WinQA
        </motion.span>
        <motion.div
          className="flex items-center gap-2 sm:gap-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: introComplete ? 0 : 4.0 }}
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
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-sm sm:text-base px-4 py-2 sm:px-5 sm:py-2.5 transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
          </SignUpButton>
        </motion.div>
      </header>

      {/* ── Main Content ── */}
      <main className="relative z-20">

        {/* ── Hero Section ── */}
        <section className="max-w-5xl mx-auto px-4 pt-16 md:pt-24 pb-20 text-center">
          <motion.h2
            className="text-6xl md:text-8xl font-black tracking-tight leading-none mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: introComplete ? 0 : 4.0 }}
          >
            The AI Testing{' '}
            <span
              className="animate-gradient-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400"
            >
              Platform
            </span>
          </motion.h2>

          <motion.p
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: introComplete ? 0.1 : 4.2 }}
          >
            Compare AI models side-by-side, track hallucinations and failures,
            and build your prompt engineering knowledge base.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: introComplete ? 0.2 : 4.4 }}
          >
            <SignUpButton mode="modal">
              <motion.button
                className={ctaBtnClass}
                whileTap={{ scale: 0.97 }}
              >
                Start Testing For Free <ArrowRight className="h-5 w-5" />
              </motion.button>
            </SignUpButton>
            <p className="text-sm text-slate-500">No credit card required</p>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            className="mt-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ delay: introComplete ? 0.5 : 5.0, duration: 3, repeat: Infinity }}
          >
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="h-6 w-6 text-slate-500 mx-auto" />
            </motion.div>
          </motion.div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="border-y border-slate-800/50 py-14 mb-20">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center items-center gap-y-8">
            <AnimatedStat value={4} label="AI Providers" />
            <div className="hidden md:block w-px h-16 bg-slate-800 mx-8" />
            <AnimatedStat value={9} label="Battle Challenges" />
            <div className="hidden md:block w-px h-16 bg-slate-800 mx-8" />
            <AnimatedStat value={22} suffix="+" label="Documented Bugs" />
            <div className="hidden md:block w-px h-16 bg-slate-800 mx-8" />
            <AnimatedStat value={20} label="Test Cases" />
          </div>
        </section>

        {/* ── Features Section ── */}
        <section className="max-w-6xl mx-auto px-4 mb-24">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-3">
              Everything you need to{' '}
              <span className="text-emerald-400">test AI</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Four tools designed to help you understand how AI models really behave.
            </p>
          </motion.div>

          <div className="space-y-20">
            {landingFeatures.map((feature, index) => (
              <FeatureRow key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="max-w-5xl mx-auto px-4 mb-24">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              How it works
            </h2>
            <p className="text-slate-400 text-lg">Three steps to better AI understanding.</p>
          </motion.div>

          <div className="relative grid md:grid-cols-3 gap-8 md:gap-12">
            {/* Gradient connector line (desktop) */}
            <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-px bg-gradient-to-r from-emerald-500/50 via-emerald-500/20 to-transparent" />

            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  className="text-center relative"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                  <motion.div
                    className="w-20 h-20 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center mx-auto mb-4 relative z-10"
                    initial={{ scale: 0.5, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: index * 0.15 }}
                  >
                    <Icon className="h-8 w-8 text-emerald-400" />
                  </motion.div>
                  <span className="text-xs font-mono text-emerald-400 tracking-widest">{step.number}</span>
                  <h3 className="text-xl font-bold text-white mt-1 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="max-w-3xl mx-auto px-4 mb-20 relative">
          {/* Glow behind card */}
          <div className="absolute -inset-10 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
          <motion.div
            className="relative rounded-2xl border border-emerald-500/20 bg-slate-900/40 backdrop-blur-sm p-8 md:p-12 text-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to test some AI?
            </h2>
            <p className="text-slate-400 mb-8 max-w-lg mx-auto">
              Free to use. No credit card required. Start comparing models in minutes.
            </p>
            <SignUpButton mode="modal">
              <motion.button
                className={ctaBtnClass}
                whileTap={{ scale: 0.97 }}
              >
                Get Started For Free <ArrowRight className="h-5 w-5" />
              </motion.button>
            </SignUpButton>
          </motion.div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-slate-800 py-8 max-w-5xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <span className="font-semibold text-white">WinQA</span>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/Ranb972/WinQA"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </a>
              <span className="text-slate-700">|</span>
              <span>Built by Ran</span>
              <span className="text-slate-700">|</span>
              <span>2026</span>
            </div>
          </div>
        </footer>
      </main>
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
