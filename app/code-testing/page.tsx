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
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CodeExecutionResultDisplay from '@/components/CodeExecutionResult';
import DebugModelSelector, { DebugMode } from '@/components/DebugModelSelector';
import { MotionWrapper } from '@/components/ui/motion-wrapper';
import {
  SupportedLanguage,
  CodeExecutionResult,
  LANGUAGE_DISPLAY_NAMES,
  isInteractiveHTML,
  requiresDevEnvironment,
} from '@/lib/code-execution';
import { LLMProvider, ChatResponse } from '@/lib/llm';
import { getApiKeys, ApiKeys } from '@/lib/api-keys';
import { getEnabledCustomProviders, CustomProvider } from '@/lib/custom-providers';
import { getModelPreferences } from '@/lib/model-preferences';

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

  // Load API keys and custom providers
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

    // Check if code is interactive HTML - skip API call and render in iframe
    if (isInteractiveHTML(codeToRun) && !requiresDevEnvironment(codeToRun)) {
      setResult({
        success: true,
        output: '',
      });
      setIsRunning(false);
      return;
    }

    try {
      const response = await fetch('/api/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          code: codeToRun,
        }),
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

      // Find custom provider if selected
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

      if (data.error) {
        throw new Error(data.error);
      }

      // Clean up the generated code (remove any markdown formatting if present)
      let cleanCode = data.content.trim();
      // Remove markdown code blocks if the model included them
      const codeBlockMatch = cleanCode.match(/```(?:javascript|python|typescript|js|py|ts)?\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleanCode = codeBlockMatch[1].trim();
      }

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

  // Code history action handlers
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

  const handleDiscard = () => {
    setPendingCode(null);
  };

  const addToHistory = (codeSnippet: string, promptText: string) => {
    setCodeHistory(prev => [
      { code: codeSnippet, prompt: promptText, timestamp: Date.now() },
      ...prev
    ].slice(0, 5)); // Keep max 5 items
  };

  const handleUseFromHistory = (item: HistoryItem) => {
    setCode(item.code);
  };

  // Helper for relative time
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

  const handleDebugRequest = async (model: LLMProvider | string, mode: DebugMode) => {
    if (!result?.error || !code) return;

    setShowDebugSelector(false);
    setIsDebugging(true);
    setDebugResult(null);

    try {
      const modelPreferences = getModelPreferences();
      const customApiKeys = cachedApiKeys;

      // Find custom provider if selected
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

      const debugPrompt = mode === 'summary' ? summaryPrompt : detailedPrompt;

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

      if (data.error) {
        throw new Error(data.error);
      }

      setDebugResult(data.content);
    } catch (error) {
      setDebugResult(`Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDebugging(false);
    }
  };

  const handleSuccessAnalysisRequest = async (model: LLMProvider | string, mode: DebugMode) => {
    if (!result?.success || !code) return;

    setShowSuccessSelector(false);
    setIsAnalyzingSuccess(true);
    setSuccessAnalysisResult(null);

    try {
      const modelPreferences = getModelPreferences();
      const customApiKeys = cachedApiKeys;

      // Find custom provider if selected
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

      const analysisPrompt = mode === 'summary' ? summaryPrompt : detailedPrompt;

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

      if (data.error) {
        throw new Error(data.error);
      }

      setSuccessAnalysisResult(data.content);
    } catch (error) {
      setSuccessAnalysisResult(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzingSuccess(false);
    }
  };

  const handleRunClick = () => {
    if (code.trim()) {
      runCode(code);
    }
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

  return (
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-500 flex items-center justify-center">
              <Code className="text-black w-6 h-6" />
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
            <SelectTrigger className="w-full sm:w-auto flex items-center gap-2.5 px-4 py-2 border border-white/[0.08] bg-white/[0.02] hover:border-orange-500/30 transition-colors">
              <Hash className="w-3 h-3 text-orange-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
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

      {/* Main Content */}
      <MotionWrapper delay={0.1}>
        <div className="border border-white/[0.06] bg-white/[0.015]">
          {/* Mode Tabs */}
          <div className="flex items-center border-b border-white/[0.06]">
            <button
              onClick={() => setMode('write')}
              className={`flex items-center gap-2 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] -mb-px ${
                mode === 'write'
                  ? 'text-white bg-orange-500/[0.05] border-b-2 border-orange-500'
                  : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
              }`}
            >
              <Terminal className="w-[11px] h-[11px]" />
              Write Code
            </button>
            <button
              onClick={() => setMode('ask')}
              className={`flex items-center gap-2 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] -mb-px ${
                mode === 'ask'
                  ? 'text-white bg-orange-500/[0.05] border-b-2 border-orange-500'
                  : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent'
              }`}
            >
              <Sparkles className="w-[11px] h-[11px]" />
              Ask AI
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Write Code Tab */}
            {mode === 'write' && (
              <div className="space-y-4">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="w-full min-h-[200px] pl-12 pr-4 py-3 bg-[#050505] border border-white/[0.06] font-mono text-[13px] text-zinc-300 leading-relaxed resize-y outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 placeholder:font-mono placeholder:text-xs"
                  style={{ caretColor: '#f97316' }}
                />

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setCode('');
                      setResult(null);
                      setDebugResult(null);
                      setSuccessAnalysisResult(null);
                    }}
                    disabled={!code.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 hover:text-white border border-transparent hover:border-white/[0.08] transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-[11px] h-[11px]" />
                    Clear
                  </button>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <button
                      onClick={handleRunClick}
                      disabled={!code.trim() || isRunning}
                      className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="w-[13px] h-[13px] animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="w-[13px] h-[13px]" />
                          Run Code
                        </>
                      )}
                    </button>
                  </motion.div>
                </div>
              </div>
            )}

            {/* Ask AI Tab */}
            {mode === 'ask' && (
              <div className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">Prompt</span>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={`Describe what ${LANGUAGE_DISPLAY_NAMES[language]} code you want...\n\nExample: "Write a function that reverses a string"`}
                      className="w-full px-4 py-3 bg-black border border-white/[0.06] font-mono text-xs text-zinc-300 leading-relaxed resize-none outline-none focus:border-orange-500/30 transition-colors placeholder:text-white/20 min-h-[100px]"
                      style={{ caretColor: '#f97316' }}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-1.5 block">Model</span>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="w-full sm:w-[250px] flex items-center justify-between px-3 py-2.5 border border-white/[0.08] bg-white/[0.02] hover:border-orange-500/25 transition-colors text-left">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a0a] border-white/[0.08]">
                          {MODEL_OPTIONS.map((opt) => (
                            <SelectItem
                              key={opt.value}
                              value={opt.value}
                              className="text-zinc-400 focus:bg-white/[0.04]"
                            >
                              <div className="flex flex-col">
                                <span className="font-mono text-xs text-white">{opt.label}</span>
                                <span className="font-mono text-[10px] text-orange-500/60">{opt.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                          {enabledCustomProviders.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-white/30 border-t border-white/[0.06] mt-1">
                                Custom Providers
                              </div>
                              {enabledCustomProviders.map((provider) => (
                                <SelectItem
                                  key={provider.id}
                                  value={`custom:${provider.id}`}
                                  className="text-zinc-400 focus:bg-white/[0.04]"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-mono text-xs text-white">{provider.name}</span>
                                    <span className="font-mono text-[10px] text-orange-500/60">{provider.modelId}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full sm:w-auto sm:self-end">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <button
                          onClick={generateCode}
                          disabled={!prompt.trim() || isGenerating}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-[13px] h-[13px] animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Bot className="w-[13px] h-[13px]" />
                              Generate Code
                            </>
                          )}
                        </button>
                      </motion.div>
                    </div>
                  </div>
                </div>

                {/* Pending Code Preview */}
                {pendingCode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 border border-orange-500/20 bg-orange-500/[0.04]"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-[11px] h-[11px] text-orange-500" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orange-400">Generated Code Preview</span>
                    </div>
                    <pre className="font-mono text-sm bg-[#050505] border border-white/[0.06] p-4 overflow-x-auto text-zinc-300 mb-4 max-h-[300px] overflow-y-auto">
                      {pendingCode}
                    </pre>
                    <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                      <button
                        onClick={handleUseCode}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-[10px] uppercase tracking-[0.12em] font-semibold transition-colors"
                      >
                        <Check className="w-[11px] h-[11px]" />
                        Use This Code
                      </button>
                      <button
                        onClick={handleAddToCurrent}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-white/[0.08] text-zinc-400 hover:text-white hover:border-orange-500/30 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                      >
                        <Plus className="w-[11px] h-[11px]" />
                        Add to Current
                      </button>
                      <button
                        onClick={handleDiscard}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-zinc-500 hover:text-white font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                      >
                        <X className="w-[11px] h-[11px]" />
                        Discard
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
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orange-500 mb-2 block">Code Editor:</span>
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full min-h-[200px] pl-12 pr-4 py-3 bg-[#050505] border border-white/[0.06] font-mono text-[13px] text-zinc-300 leading-relaxed resize-y outline-none focus:border-orange-500/30 transition-colors"
                      style={{ caretColor: '#f97316' }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setCode('');
                          setResult(null);
                          setDebugResult(null);
                          setSuccessAnalysisResult(null);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 hover:text-white border border-transparent hover:border-white/[0.08] transition-colors"
                      >
                        <Trash2 className="w-[11px] h-[11px]" />
                        Clear
                      </button>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <button
                          onClick={handleRunClick}
                          disabled={!code.trim() || isRunning}
                          className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-mono text-xs uppercase tracking-[0.12em] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRunning ? (
                            <>
                              <Loader2 className="w-[13px] h-[13px] animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="w-[13px] h-[13px]" />
                              Run Code
                            </>
                          )}
                        </button>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Recent Generations History */}
                {codeHistory.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-0"
                  >
                    <button
                      onClick={() => setHistoryExpanded(!historyExpanded)}
                      className="w-full flex items-center justify-between px-5 py-3 border-t border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-[11px] h-[11px] text-white/30" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                          Recent Generations ({codeHistory.length})
                        </span>
                      </div>
                      {historyExpanded ? (
                        <ChevronUp className="w-[11px] h-[11px] text-white/30" />
                      ) : (
                        <ChevronDown className="w-[11px] h-[11px] text-white/30" />
                      )}
                    </button>

                    {historyExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1 max-h-[200px] overflow-y-auto px-5 pb-3"
                      >
                        {codeHistory.map((item, index) => (
                          <div
                            key={item.timestamp}
                            className="flex items-center justify-between p-2 bg-white/[0.02] border border-white/[0.06]"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-zinc-400 truncate">&quot;{item.prompt}&quot;</p>
                              <p className="font-mono text-[10px] text-white/25">{getRelativeTime(item.timestamp)}</p>
                            </div>
                            <button
                              onClick={() => handleUseFromHistory(item)}
                              className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 hover:text-orange-500 ml-2 shrink-0 px-2 py-1 transition-colors"
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
          <div className="mt-6 border border-white/[0.06] bg-white/[0.015] relative">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-orange-500" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-orange-500" />

            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/[0.06]">
              <Terminal className="w-[13px] h-[13px] text-orange-500" />
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-white/50">Output / Results</span>
            </div>

            <div className="p-5">
              {isRunning ? (
                <div className="flex items-center gap-3 py-4">
                  <Loader2 className="w-[13px] h-[13px] animate-spin text-orange-500" />
                  <span className="font-mono text-xs uppercase tracking-[0.12em] text-white/40">Executing code...</span>
                </div>
              ) : result && (
                <>
                  <CodeExecutionResultDisplay
                    result={result}
                    code={code}
                    onDebugClick={() => setShowDebugSelector(true)}
                    onSuccessAnalysisClick={() => setShowSuccessSelector(true)}
                  />

                  {/* Debug Selector */}
                  {showDebugSelector && !result.success && (
                    <DebugModelSelector
                      onSelect={handleDebugRequest}
                      onClose={() => setShowDebugSelector(false)}
                      customProviders={customProviders}
                      analysisType="debug"
                    />
                  )}

                  {/* Debug Loading */}
                  {isDebugging && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 p-4 border border-orange-500/15 bg-orange-500/[0.04]"
                    >
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-[13px] h-[13px] animate-spin text-orange-500" />
                        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-400">AI is analyzing the error...</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Debug Result */}
                  {debugResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 border border-orange-500/15 bg-orange-500/[0.04]"
                    >
                      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-orange-500/10">
                        <Bot className="w-[11px] h-[11px] text-orange-400" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-orange-400">Forensic Analysis</span>
                      </div>
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
                        {debugResult}
                      </div>
                    </motion.div>
                  )}

                  {/* Success Analysis Selector */}
                  {showSuccessSelector && result.success && (
                    <DebugModelSelector
                      onSelect={handleSuccessAnalysisRequest}
                      onClose={() => setShowSuccessSelector(false)}
                      customProviders={customProviders}
                      analysisType="success"
                    />
                  )}

                  {/* Success Analysis Loading */}
                  {isAnalyzingSuccess && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 p-4 border border-green-900/30 bg-green-950/30"
                    >
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-[13px] h-[13px] animate-spin text-green-400" />
                        <span className="font-mono text-xs uppercase tracking-[0.12em] text-green-400">AI is analyzing what worked...</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Success Analysis Result */}
                  {successAnalysisResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 border border-green-900/30 bg-green-950/30"
                    >
                      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-green-900/20">
                        <Target className="w-[11px] h-[11px] text-green-400" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-green-400">What Worked? Analysis</span>
                      </div>
                      <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">
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
          <div className="mt-6 border border-white/[0.06] bg-white/[0.015] relative">
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-orange-500" />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-orange-500" />

            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-white/[0.06]">
              <Terminal className="w-[13px] h-[13px] text-orange-500" />
              <span className="font-mono text-xs uppercase tracking-[0.16em] text-white/50">Output / Results</span>
            </div>

            <div className="flex items-center justify-center py-16">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-white/25">
                {mode === 'write' ? 'Write some code to get started' : 'Ask AI to generate code'}
              </span>
            </div>
          </div>
        </MotionWrapper>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">Lab Active</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/25">
          {LANGUAGE_DISPLAY_NAMES[language]} {lineCount > 0 ? `\u2022 ${lineCount} lines` : ''}
        </span>
      </div>
    </div>
  );
}
