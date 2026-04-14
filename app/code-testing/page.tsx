'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import {
  Play,
  Code,
  Bot,
  Loader2,
  Sparkles,
  Terminal,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  X,
  History,
  Target,
  Hash,
  Clock,
  CheckCircle,
  XCircle,
  Cpu,
  Search,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import InteractivePreview from '@/components/InteractivePreview';
import DevEnvironmentRequired from '@/components/DevEnvironmentRequired';
import { MotionWrapper } from '@/components/ui/motion-wrapper';
import {
  SupportedLanguage,
  CodeExecutionResult,
  LANGUAGE_DISPLAY_NAMES,
  isInteractiveHTML,
  requiresDevEnvironment,
  wrapJSInHTML,
} from '@/lib/code-execution';
import { LLMProvider, ChatResponse } from '@/lib/llm';
import { getApiKeys, ApiKeys } from '@/lib/api-keys';
import { getEnabledCustomProviders, CustomProvider } from '@/lib/custom-providers';
import { getModelPreferences } from '@/lib/model-preferences';

type DebugMode = 'summary' | 'detailed';

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript' },
];

const MODEL_OPTIONS: { value: LLMProvider | string; label: string; description: string }[] = [
  { value: 'groq', label: 'Groq - Llama 3.3 70B', description: 'Fast inference (Recommended)' },
  { value: 'gemini', label: 'Gemini 2.0 Flash', description: 'Google AI' },
  { value: 'cohere', label: 'Cohere Command A', description: 'Latest Cohere model' },
  { value: 'openrouter', label: 'OpenRouter - DeepSeek R1', description: 'Free tier' },
];

interface HistoryItem {
  code: string;
  prompt: string;
  timestamp: number;
}

// Corner accent helper — 8 small orange lines at all 4 corners
function CornerAccents({ color = 'bg-orange-500/60' }: { color?: string }) {
  return (
    <>
      <div className="absolute top-0 left-0 pointer-events-none">
        <div className={`absolute top-0 left-0 w-3 h-px ${color}`} />
        <div className={`absolute top-0 left-0 w-px h-3 ${color}`} />
      </div>
      <div className="absolute top-0 right-0 pointer-events-none">
        <div className={`absolute top-0 right-0 w-3 h-px ${color}`} />
        <div className={`absolute top-0 right-0 w-px h-3 ${color}`} />
      </div>
      <div className="absolute bottom-0 left-0 pointer-events-none">
        <div className={`absolute bottom-0 left-0 w-3 h-px ${color}`} />
        <div className={`absolute bottom-0 left-0 w-px h-3 ${color}`} />
      </div>
      <div className="absolute bottom-0 right-0 pointer-events-none">
        <div className={`absolute bottom-0 right-0 w-3 h-px ${color}`} />
        <div className={`absolute bottom-0 right-0 w-px h-3 ${color}`} />
      </div>
    </>
  );
}

export default function CodeTestingPage() {
  const { user } = useUser();
  const [mode, setMode] = useState<'write' | 'ask'>('write');
  const [language, setLanguage] = useState<SupportedLanguage>('javascript');
  const [code, setCode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<LLMProvider | string>('groq');
  const [isRunning, setIsRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<CodeExecutionResult | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [codeHistory, setCodeHistory] = useState<HistoryItem[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showDebugSelector, setShowDebugSelector] = useState(false);
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugResult, setDebugResult] = useState<string | null>(null);
  const [showSuccessSelector, setShowSuccessSelector] = useState(false);
  const [isAnalyzingSuccess, setIsAnalyzingSuccess] = useState(false);
  const [successAnalysisResult, setSuccessAnalysisResult] = useState<string | null>(null);
  const [cachedApiKeys, setCachedApiKeys] = useState<ApiKeys>({});
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [debugSelectedModel, setDebugSelectedModel] = useState<string>('groq');
  const [debugMode, setDebugMode] = useState<DebugMode>('summary');

  useEffect(() => {
    async function loadData() {
      const keys = await getApiKeys(user?.id);
      setCachedApiKeys(keys);
      const providers = await getEnabledCustomProviders(user?.id);
      setCustomProviders(providers);
    }
    loadData();
  }, [user?.id]);

  const runCode = async (codeToRun: string) => {
    setIsRunning(true);
    setResult(null);
    setShowDebugSelector(false);
    setDebugResult(null);
    setShowSuccessSelector(false);
    setSuccessAnalysisResult(null);

    if (isInteractiveHTML(codeToRun) && !requiresDevEnvironment(codeToRun)) {
      setResult({ success: true, output: '' });
      setIsRunning(false);
      return;
    }

    try {
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code: codeToRun }),
      });
      const data = await response.json() as CodeExecutionResult;
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute code',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const generateCode = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setPendingCode(null);
    setResult(null);
    setShowDebugSelector(false);
    setDebugResult(null);
    setShowSuccessSelector(false);
    setSuccessAnalysisResult(null);

    try {
      const modelPreferences = getModelPreferences();
      const customApiKeys = cachedApiKeys;

      let customProvider: CustomProvider | undefined;
      if (selectedModel.startsWith('custom:')) {
        const providerId = selectedModel.replace('custom:', '');
        customProvider = customProviders.find((p) => p.id === providerId);
      }

      const systemPrompt = `You are a code generation assistant. Generate ${LANGUAGE_DISPLAY_NAMES[language]} code based on the user's request.
IMPORTANT: Only output the code itself, no explanations, no markdown code blocks, no backticks. Just pure ${LANGUAGE_DISPLAY_NAMES[language]} code that can be executed directly.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          models: selectedModel,
          modelPreferences,
          customApiKeys,
          ...(customProvider && { customProvider }),
        }),
      });

      const data = await response.json() as ChatResponse;
      if (data.error) throw new Error(data.error);

      let cleanCode = data.content.trim();
      const codeBlockMatch = cleanCode.match(/```(?:javascript|python|typescript|js|py|ts)?\n?([\s\S]*?)```/);
      if (codeBlockMatch) cleanCode = codeBlockMatch[1].trim();

      setPendingCode(cleanCode);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate code',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseCode = () => {
    if (pendingCode) {
      setCode(pendingCode);
      addToHistory(pendingCode, prompt);
      setPendingCode(null);
    }
  };

  const handleAddToCurrent = () => {
    if (pendingCode) {
      const combined = code ? `${code}\n\n${pendingCode}` : pendingCode;
      setCode(combined);
      addToHistory(pendingCode, prompt);
      setPendingCode(null);
    }
  };

  const handleDiscard = () => { setPendingCode(null); };

  const addToHistory = (codeSnippet: string, promptText: string) => {
    setCodeHistory(prev => [
      { code: codeSnippet, prompt: promptText, timestamp: Date.now() },
      ...prev
    ].slice(0, 5));
  };

  const handleUseFromHistory = (item: HistoryItem) => { setCode(item.code); };

  const getRelativeTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  const handleDebugRequest = async (model: LLMProvider | string, dMode: DebugMode) => {
    if (!result?.error || !code) return;

    setShowDebugSelector(false);
    setIsDebugging(true);
    setDebugResult(null);

    try {
      const modelPreferences = getModelPreferences();
      const customApiKeys = cachedApiKeys;

      let customProvider: CustomProvider | undefined;
      if (model.startsWith('custom:')) {
        const providerId = model.replace('custom:', '');
        customProvider = customProviders.find((p) => p.id === providerId);
      }

      const summaryPrompt = `I have the following ${LANGUAGE_DISPLAY_NAMES[language]} code that produced an error:

\`\`\`${language}
${code}
\`\`\`

Error:
${result.error}

Analyze briefly in 3-5 bullet points:
- What's wrong
- Why it happened
- How to fix it

Be concise.`;

      const detailedPrompt = `I have the following ${LANGUAGE_DISPLAY_NAMES[language]} code that produced an error:

\`\`\`${language}
${code}
\`\`\`

Error:
${result.error}

Please analyze the error and explain:
1. What caused the error
2. How to fix it
3. Provide the corrected code`;

      const debugPrompt = dMode === 'summary' ? summaryPrompt : detailedPrompt;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: debugPrompt }],
          models: model,
          modelPreferences,
          customApiKeys,
          ...(customProvider && { customProvider }),
        }),
      });

      const data = await response.json() as ChatResponse;
      if (data.error) throw new Error(data.error);
      setDebugResult(data.content);
    } catch (error) {
      setDebugResult(`Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDebugging(false);
    }
  };

  const handleSuccessAnalysisRequest = async (model: LLMProvider | string, dMode: DebugMode) => {
    if (!result?.success || !code) return;

    setShowSuccessSelector(false);
    setIsAnalyzingSuccess(true);
    setSuccessAnalysisResult(null);

    try {
      const modelPreferences = getModelPreferences();
      const customApiKeys = cachedApiKeys;

      let customProvider: CustomProvider | undefined;
      if (model.startsWith('custom:')) {
        const providerId = model.replace('custom:', '');
        customProvider = customProviders.find((p) => p.id === providerId);
      }

      const summaryPrompt = `Analyze this working ${LANGUAGE_DISPLAY_NAMES[language]} code briefly in 3-5 bullet points:
- What's good about this code
- What the user can learn from it
- Any small improvements (optional)

Be concise and encouraging.

Code:
\`\`\`${language}
${code}
\`\`\`
${result.output ? `\nOutput:\n${result.output}` : ''}`;

      const detailedPrompt = `Please analyze this working ${LANGUAGE_DISPLAY_NAMES[language]} code and explain:
1. What's good about this code (2-3 key points)
2. What programming concepts or patterns the user can learn from it
3. Optional: Small improvements that could make it even better

Code:
\`\`\`${language}
${code}
\`\`\`
${result.output ? `\nOutput:\n${result.output}` : ''}`;

      const analysisPrompt = dMode === 'summary' ? summaryPrompt : detailedPrompt;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: analysisPrompt }],
          models: model,
          modelPreferences,
          customApiKeys,
          ...(customProvider && { customProvider }),
        }),
      });

      const data = await response.json() as ChatResponse;
      if (data.error) throw new Error(data.error);
      setSuccessAnalysisResult(data.content);
    } catch (error) {
      setSuccessAnalysisResult(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzingSuccess(false);
    }
  };

  const handleRunClick = () => {
    if (code.trim()) runCode(code);
  };

  const getPlaceholder = () => {
    switch (language) {
      case 'javascript':
        return '// Write your JavaScript code here\nconsole.log("Hello, World!");';
      case 'python':
        return '# Write your Python code here\nprint("Hello, World!")';
      case 'typescript':
        return '// Write your TypeScript code here\nconst message: string = "Hello, World!";\nconsole.log(message);';
      default:
        return '// Write your code here';
    }
  };

  const enabledCustomProviders = customProviders.filter((p) => p.enabled);
  const lineCount = code ? code.split('\n').length : 0;

  // Result helpers
  const hasOutput = result?.output && result.output.trim().length > 0;
  const hasError = result?.error && result.error.trim().length > 0;
  const showInteractivePreview = code && isInteractiveHTML(code) && !requiresDevEnvironment(code);
  const showDevEnvironmentWarning = code && requiresDevEnvironment(code);
  const previewCode = showInteractivePreview && code
    ? (code.includes('<html') || code.includes('<body') ? code : wrapJSInHTML(code))
    : null;
  const isWrapped = Boolean(showInteractivePreview && code && !code.includes('<html') && !code.includes('<body'));

  // Inline analysis selector renderer
  const renderAnalysisSelector = (type: 'debug' | 'success') => {
    const isSuccess = type === 'success';
    const onClose = () => isSuccess ? setShowSuccessSelector(false) : setShowDebugSelector(false);
    const handleAnalyze = () => {
      if (isSuccess) {
        handleSuccessAnalysisRequest(debugSelectedModel, debugMode);
      } else {
        handleDebugRequest(debugSelectedModel, debugMode);
      }
    };

    return (
      <div className="relative mt-4 bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
        <CornerAccents />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <Target className="w-4 h-4 text-emerald-500" />
            ) : (
              <Search className="w-4 h-4 text-orange-500" />
            )}
            <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${isSuccess ? 'text-emerald-500' : 'text-orange-500'}`}>
              {isSuccess ? 'What worked? Analysis' : 'AI Debug Analysis'}
            </span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-3">
          {isSuccess ? 'Select a model to analyze what worked:' : 'Select a model to analyze the error:'}
        </p>

        <Select value={debugSelectedModel} onValueChange={setDebugSelectedModel}>
          <SelectTrigger className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 hover:border-white/[0.12] transition-colors text-left mb-3">
            <SelectValue placeholder="Choose model" />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg">
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-zinc-300 focus:bg-white/[0.04]">
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-white">{opt.label}</span>
                  <span className="font-mono text-[10px] text-orange-500">{opt.description}</span>
                </div>
              </SelectItem>
            ))}
            {enabledCustomProviders.length > 0 && (
              <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 border-t border-white/[0.06] mt-1">
                Custom Providers
              </div>
            )}
            {enabledCustomProviders.map((provider) => (
              <SelectItem key={provider.id} value={`custom:${provider.id}`} className="text-zinc-300 focus:bg-white/[0.04]">
                <div className="flex flex-col">
                  <span className="font-mono text-sm text-white">{provider.name}</span>
                  <span className="font-mono text-[10px] text-orange-500">{provider.modelId}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mb-4">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2">Output format:</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDebugMode('summary')}
              className={debugMode === 'summary'
                ? 'px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded font-mono text-[11px] tracking-[0.1em] uppercase text-orange-400 transition-colors'
                : 'px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded font-mono text-[11px] tracking-[0.1em] uppercase text-white/50 hover:border-white/[0.12] transition-colors'}
            >
              Summary
            </button>
            <button
              onClick={() => setDebugMode('detailed')}
              className={debugMode === 'detailed'
                ? 'px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded font-mono text-[11px] tracking-[0.1em] uppercase text-orange-400 transition-colors'
                : 'px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded font-mono text-[11px] tracking-[0.1em] uppercase text-white/50 hover:border-white/[0.12] transition-colors'}
            >
              Detailed
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            className="flex-1 flex items-center justify-center gap-2 bg-transparent border border-orange-500 rounded text-orange-500 font-mono text-[11px] tracking-[0.15em] uppercase hover:bg-orange-500/10 py-2.5 transition-colors"
          >
            {isSuccess ? 'Analyze Code' : 'Analyze Error'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-white/40 hover:text-white/60 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Code className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="font-heading font-semibold text-2xl uppercase tracking-wide text-white">
                Code Testing Lab
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Forensic code analysis with AI assistance
              </p>
            </div>
          </div>

          {/* Language Selector */}
          <Select value={language} onValueChange={(v) => setLanguage(v as SupportedLanguage)}>
            <SelectTrigger className="w-full sm:w-auto flex items-center gap-2.5 px-4 py-3 sm:py-2 min-h-[44px] sm:min-h-0 bg-white/[0.02] border border-white/[0.06] rounded-lg font-mono text-sm text-white/80 hover:border-white/[0.12] transition-colors">
              <Hash className="w-3 h-3 text-orange-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg">
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-400 focus:bg-white/[0.04]"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </MotionWrapper>

      {/* Main Panel */}
      <MotionWrapper delay={0.1}>
        <div className="relative bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden">
          <CornerAccents />

          {/* Mode Tabs */}
          <div className="flex border-b border-white/[0.06]">
            <button
              onClick={() => setMode('write')}
              className={`flex items-center gap-2 px-5 py-3.5 sm:py-3 min-h-[44px] sm:min-h-0 font-mono text-[11px] tracking-[0.15em] uppercase -mb-px transition-colors ${
                mode === 'write'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'text-white/40 hover:text-white/60 border-b-2 border-transparent'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Write Code
            </button>
            <button
              onClick={() => setMode('ask')}
              className={`flex items-center gap-2 px-5 py-3.5 sm:py-3 min-h-[44px] sm:min-h-0 font-mono text-[11px] tracking-[0.15em] uppercase -mb-px transition-colors ${
                mode === 'ask'
                  ? 'text-white border-b-2 border-orange-500'
                  : 'text-white/40 hover:text-white/60 border-b-2 border-transparent'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Ask AI
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Write Code Tab */}
            {mode === 'write' && (
              <div className="space-y-4">
                <div>
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-orange-500 mb-2 block">Code Editor</span>
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={getPlaceholder()}
                    className="w-full min-h-[200px] bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 font-mono text-sm text-white/90 leading-relaxed resize-y outline-none focus:border-orange-500/50 transition-colors placeholder:text-white/30"
                    style={{ caretColor: '#f97316' }}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setCode('');
                      setResult(null);
                      setDebugResult(null);
                      setSuccessAnalysisResult(null);
                    }}
                    disabled={!code.trim()}
                    className="px-3 py-3 sm:py-2 min-h-[44px] sm:min-h-0 font-mono text-[11px] tracking-[0.15em] uppercase text-white/40 hover:text-white/60 transition-colors disabled:opacity-30"
                  >
                    <span className="flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4" />
                      Clear
                    </span>
                  </button>
                  <button
                    onClick={handleRunClick}
                    disabled={!code.trim() || isRunning}
                    className="flex items-center gap-2 px-5 py-3 sm:py-2 min-h-[44px] sm:min-h-0 bg-transparent border border-orange-500 rounded text-orange-500 font-mono text-[11px] tracking-[0.15em] uppercase hover:bg-orange-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRunning ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
                    ) : (
                      <><Play className="w-4 h-4" /> Run Code</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Ask AI Tab */}
            {mode === 'ask' && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2 block">Prompt</span>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={`Describe what ${LANGUAGE_DISPLAY_NAMES[language]} code you want...\n\nExample: "Write a function that reverses a string"`}
                      className="w-full min-h-[100px] bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 font-mono text-sm text-white leading-relaxed resize-none outline-none focus:border-orange-500/50 transition-colors placeholder:text-white/30"
                      style={{ caretColor: '#f97316' }}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                    <div>
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2 block">Model</span>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-full sm:w-[250px] bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 hover:border-white/[0.12] transition-colors text-left">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg">
                          {MODEL_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} className="text-zinc-400 focus:bg-white/[0.04]">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm text-white">{opt.label}</span>
                                <span className="font-mono text-[10px] text-orange-500">{opt.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                          {enabledCustomProviders.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 border-t border-white/[0.06] mt-1">
                                Custom Providers
                              </div>
                              {enabledCustomProviders.map((provider) => (
                                <SelectItem key={provider.id} value={`custom:${provider.id}`} className="text-zinc-400 focus:bg-white/[0.04]">
                                  <div className="flex flex-col">
                                    <span className="font-mono text-sm text-white">{provider.name}</span>
                                    <span className="font-mono text-[10px] text-orange-500">{provider.modelId}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <button
                      onClick={generateCode}
                      disabled={!prompt.trim() || isGenerating}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-transparent border border-orange-500 rounded text-orange-500 font-mono text-[11px] tracking-[0.15em] uppercase hover:bg-orange-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="w-4 h-4" /> Generate Code</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Pending Code Preview */}
                {pendingCode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative mt-4 bg-white/[0.015] border border-white/[0.06] rounded-lg p-6"
                  >
                    <CornerAccents />
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-orange-500" />
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-orange-500">Generated Code Preview</span>
                    </div>
                    <pre className="font-mono text-sm bg-white/[0.02] border border-white/[0.04] rounded p-4 overflow-x-auto text-white/70 mb-4 max-h-[300px] overflow-y-auto">
                      {pendingCode}
                    </pre>
                    <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                      <button
                        onClick={handleUseCode}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-transparent border border-orange-500 rounded text-orange-500 hover:bg-orange-500/10 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors"
                      >
                        <Check className="w-4 h-4" /> Use This Code
                      </button>
                      <button
                        onClick={handleAddToCurrent}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded text-white/50 hover:border-white/[0.12] font-mono text-[11px] tracking-[0.15em] uppercase transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add to Current
                      </button>
                      <button
                        onClick={handleDiscard}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-white/40 hover:text-white/60 font-mono text-[11px] tracking-[0.15em] uppercase transition-colors"
                      >
                        <X className="w-4 h-4" /> Discard
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Code Editor (visible when code is set in Ask AI mode) */}
                {code && !pendingCode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 mt-4"
                  >
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-orange-500 mb-2 block">Code Editor</span>
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full min-h-[200px] bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 font-mono text-sm text-white/90 leading-relaxed resize-y outline-none focus:border-orange-500/50 transition-colors"
                      style={{ caretColor: '#f97316' }}
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setCode('');
                          setResult(null);
                          setDebugResult(null);
                          setSuccessAnalysisResult(null);
                        }}
                        className="px-3 py-3 sm:py-2 min-h-[44px] sm:min-h-0 font-mono text-[11px] tracking-[0.15em] uppercase text-white/40 hover:text-white/60 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Trash2 className="w-4 h-4" /> Clear
                        </span>
                      </button>
                      <button
                        onClick={handleRunClick}
                        disabled={!code.trim() || isRunning}
                        className="flex items-center gap-2 px-5 py-3 sm:py-2 min-h-[44px] sm:min-h-0 bg-transparent border border-orange-500 rounded text-orange-500 font-mono text-[11px] tracking-[0.15em] uppercase hover:bg-orange-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRunning ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
                        ) : (
                          <><Play className="w-4 h-4" /> Run Code</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Recent Generations History */}
                {codeHistory.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-0">
                    <button
                      onClick={() => setHistoryExpanded(!historyExpanded)}
                      className="w-full flex items-center justify-between px-5 py-3 border-t border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-white/30" />
                        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-white/40">
                          Recent Generations ({codeHistory.length})
                        </span>
                      </div>
                      {historyExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/30" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/30" />
                      )}
                    </button>

                    {historyExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1 max-h-[200px] overflow-y-auto px-5 pb-3"
                      >
                        {codeHistory.map((item) => (
                          <div key={item.timestamp} className="flex items-center justify-between p-2 bg-white/[0.02] border border-white/[0.06] rounded">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-zinc-400 truncate">&quot;{item.prompt}&quot;</p>
                              <p className="font-mono text-[10px] text-white/25">{getRelativeTime(item.timestamp)}</p>
                            </div>
                            <button
                              onClick={() => handleUseFromHistory(item)}
                              className="font-mono text-[11px] tracking-[0.15em] uppercase text-white/40 hover:text-white/60 ml-2 shrink-0 px-2 py-1 transition-colors"
                            >
                              Use
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>
      </MotionWrapper>

      {/* Output Section */}
      {(result || isRunning) && (
        <MotionWrapper delay={0.2}>
          <div className="relative mt-6 bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden">
            <CornerAccents />

            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/[0.06]">
              <Terminal className="w-4 h-4 text-white/40" />
              <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-white/40">Output / Results</span>
            </div>

            <div className="p-5">
              {isRunning ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-white/40">Executing code...</span>
                </div>
              ) : result && (
                <>
                  {/* Inline Result Display */}
                  <div className={`relative p-4 rounded-lg ${
                    result.success
                      ? 'bg-emerald-500/[0.03] border border-emerald-500/20'
                      : 'bg-red-500/[0.03] border border-red-500/20'
                  }`}>
                    <CornerAccents color={result.success ? 'bg-emerald-500' : 'bg-red-500'} />

                    {/* Status header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] uppercase ${
                        result.success ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {result.success ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        {result.success ? 'Execution Success' : 'Execution Failed'}
                      </span>

                      <div className="flex items-center gap-2">
                        {result.engine && (
                          <span className="flex items-center gap-1 font-mono text-[10px] text-white/30">
                            <Cpu className="h-3 w-3" />
                            {result.engine}
                          </span>
                        )}
                        {result.executionTime !== undefined && (
                          <span className="font-mono text-[10px] text-white/30">
                            {result.executionTime.toFixed(1)}ms
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Output */}
                    {hasOutput && (
                      <div className="mb-3">
                        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2">Output</div>
                        <pre className="font-mono text-sm text-emerald-400 bg-emerald-500/[0.05] border border-emerald-500/10 rounded px-4 py-3 whitespace-pre-wrap overflow-x-auto">
                          {result.output}
                        </pre>
                      </div>
                    )}

                    {/* Error */}
                    {hasError && (
                      <div>
                        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2">Error</div>
                        <pre className="font-mono text-xs text-red-400 bg-red-500/[0.03] border border-red-500/10 rounded px-4 py-3 whitespace-pre-wrap overflow-x-auto">
                          {result.error}
                        </pre>
                      </div>
                    )}

                    {/* No output */}
                    {result.success && !hasOutput && !showInteractivePreview && (
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40">
                        Code executed successfully with no output.
                      </div>
                    )}

                    {/* Interactive Preview */}
                    {result.success && showInteractivePreview && previewCode && (
                      <InteractivePreview code={previewCode} originalCode={code} isWrapped={isWrapped} />
                    )}

                    {/* Dev Environment Warning */}
                    {showDevEnvironmentWarning && code && (
                      <DevEnvironmentRequired code={code} />
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {result.success && (
                        <button
                          onClick={() => setShowSuccessSelector(true)}
                          className="flex items-center gap-2 bg-transparent border border-emerald-500/30 rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          What Worked?
                        </button>
                      )}
                      {!result.success && (
                        <button
                          onClick={() => setShowDebugSelector(true)}
                          className="flex items-center gap-2 bg-transparent border border-orange-500/30 rounded-full px-4 py-2 font-mono text-[11px] tracking-[0.1em] uppercase text-orange-500 hover:bg-orange-500/10 transition-colors"
                        >
                          <Sparkles className="w-4 h-4" />
                          AI Debug
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Debug Selector */}
                  {showDebugSelector && !result.success && renderAnalysisSelector('debug')}

                  {/* Debug Loading */}
                  {isDebugging && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative mt-4 bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
                      <CornerAccents />
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-orange-500">AI is analyzing the error...</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Debug Result */}
                  {debugResult && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative mt-4 bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
                      <CornerAccents />
                      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/[0.06]">
                        <Bot className="w-4 h-4 text-orange-500" />
                        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-orange-500">Forensic Analysis</span>
                      </div>
                      <div className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap font-mono">
                        {debugResult}
                      </div>
                    </motion.div>
                  )}

                  {/* Success Analysis Selector */}
                  {showSuccessSelector && result.success && renderAnalysisSelector('success')}

                  {/* Success Analysis Loading */}
                  {isAnalyzingSuccess && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative mt-4 bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
                      <CornerAccents />
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                        <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-emerald-500">AI is analyzing what worked...</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Success Analysis Result */}
                  {successAnalysisResult && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative mt-4 bg-white/[0.015] border border-white/[0.06] rounded-lg p-6">
                      <CornerAccents />
                      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-white/[0.06]">
                        <Target className="w-4 h-4 text-emerald-500" />
                        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-emerald-500">What Worked? Analysis</span>
                      </div>
                      <div className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap font-mono">
                        {successAnalysisResult}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </div>
        </MotionWrapper>
      )}

      {/* Empty State */}
      {!result && !isRunning && !pendingCode && !code && (
        <MotionWrapper delay={0.2}>
          <div className="relative mt-6 bg-white/[0.015] border border-white/[0.06] rounded-lg overflow-hidden">
            <CornerAccents />

            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/[0.06]">
              <Terminal className="w-4 h-4 text-white/40" />
              <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-white/40">Output / Results</span>
            </div>

            <div className="flex items-center justify-center py-16">
              <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-white/25">
                {mode === 'write' ? 'Write some code to get started' : 'Ask AI to generate code'}
              </span>
            </div>
          </div>
        </MotionWrapper>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between mt-6 px-4 py-2 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/40">Lab Active</span>
        </div>
        <span className="font-mono text-[10px] text-white/30">
          {LANGUAGE_DISPLAY_NAMES[language]} {lineCount > 0 ? `\u2022 ${lineCount} lines` : ''}
        </span>
      </div>
    </div>
  );
}
