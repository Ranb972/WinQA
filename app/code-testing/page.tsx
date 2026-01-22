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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <div>
      {/* Header */}
      <MotionWrapper>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Code className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="gradient-text-primary">Code Testing Lab</span>
              </h1>
              <p className="text-slate-400 mt-1">
                Test and debug code with AI assistance
              </p>
            </div>
          </div>

          {/* Language Selector */}
          <Select value={language} onValueChange={(v) => setLanguage(v as SupportedLanguage)}>
            <SelectTrigger className="w-[150px] bg-slate-900/50 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700">
              {LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-slate-300 focus:bg-slate-800"
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
        <div className="glass-card rounded-xl p-6">
          {/* Mode Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'write' | 'ask')}>
            <TabsList className="bg-slate-900/50 border border-slate-700 mb-6">
              <TabsTrigger
                value="write"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-teal-600 data-[state=active]:text-white"
              >
                <Terminal className="h-4 w-4 mr-2" />
                Write Code
              </TabsTrigger>
              <TabsTrigger
                value="ask"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Ask AI
              </TabsTrigger>
            </TabsList>

            {/* Write Code Tab */}
            <TabsContent value="write" className="space-y-4">
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={getPlaceholder()}
                className="font-mono bg-slate-900/50 border-slate-700 text-slate-100 min-h-[300px] resize-y"
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCode('');
                    setResult(null);
                    setDebugResult(null);
                    setSuccessAnalysisResult(null);
                  }}
                  disabled={!code.trim()}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleRunClick}
                    disabled={!code.trim() || isRunning}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Code
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </TabsContent>

            {/* Ask AI Tab */}
            <TabsContent value="ask" className="space-y-4">
              <div className="space-y-4">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe what ${LANGUAGE_DISPLAY_NAMES[language]} code you want...\n\nExample: "Write a function that reverses a string"`}
                  className="bg-slate-900/50 border-slate-700 text-slate-100 min-h-[100px] resize-y"
                />

                <div className="flex items-center gap-4">
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-[250px] bg-slate-900/50 border-slate-700">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {MODEL_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value}
                          className="text-slate-300 focus:bg-slate-800"
                        >
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-slate-500">{opt.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                      {enabledCustomProviders.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs text-slate-500 border-t border-slate-700 mt-1">
                            Custom Providers
                          </div>
                          {enabledCustomProviders.map((provider) => (
                            <SelectItem
                              key={provider.id}
                              value={`custom:${provider.id}`}
                              className="text-slate-300 focus:bg-slate-800"
                            >
                              <div className="flex flex-col">
                                <span>{provider.name}</span>
                                <span className="text-xs text-slate-500">{provider.modelId}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={generateCode}
                      disabled={!prompt.trim() || isGenerating}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Bot className="h-4 w-4 mr-2" />
                          Generate Code
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>

              {/* Pending Code Preview */}
              {pendingCode && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 rounded-lg bg-purple-900/10 border border-purple-500/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400">Generated Code Preview</span>
                  </div>
                  <pre className="font-mono text-sm bg-slate-900/50 border border-slate-700 rounded-lg p-4 overflow-x-auto text-slate-100 mb-4 max-h-[300px] overflow-y-auto">
                    {pendingCode}
                  </pre>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={handleUseCode}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Use This Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddToCurrent}
                      className="border-slate-600 text-slate-300 hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Current
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDiscard}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Discard
                    </Button>
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-400">Code Editor:</span>
                  </div>
                  <Textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono bg-slate-900/50 border-slate-700 text-slate-100 min-h-[200px] resize-y"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setCode('');
                        setResult(null);
                        setDebugResult(null);
                        setSuccessAnalysisResult(null);
                      }}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleRunClick}
                        disabled={!code.trim() || isRunning}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Run Code
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Recent Generations History */}
              {codeHistory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4"
                >
                  <button
                    onClick={() => setHistoryExpanded(!historyExpanded)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors w-full"
                  >
                    <History className="h-4 w-4" />
                    <span>Recent Generations ({codeHistory.length})</span>
                    {historyExpanded ? (
                      <ChevronUp className="h-4 w-4 ml-auto" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-auto" />
                    )}
                  </button>

                  {historyExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 space-y-2 max-h-[200px] overflow-y-auto"
                    >
                      {codeHistory.map((item, index) => (
                        <div
                          key={item.timestamp}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/30 border border-slate-800 text-sm"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300 truncate">&quot;{item.prompt}&quot;</p>
                            <p className="text-xs text-slate-500">{getRelativeTime(item.timestamp)}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUseFromHistory(item)}
                            className="text-slate-400 hover:text-emerald-400 ml-2 shrink-0"
                          >
                            Use
                          </Button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </MotionWrapper>

      {/* Output Section */}
      {(result || isRunning) && (
        <MotionWrapper delay={0.2}>
          <div className="glass-card rounded-xl p-6 mt-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-400" />
              Output
            </h3>

            {isRunning ? (
              <div className="flex items-center gap-3 text-slate-400 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                <span>Executing code...</span>
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
                    className="mt-4 p-4 rounded-lg bg-purple-900/20 border border-purple-500/30"
                  >
                    <div className="flex items-center gap-3 text-purple-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>AI is analyzing the error...</span>
                    </div>
                  </motion.div>
                )}

                {/* Debug Result */}
                {debugResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-lg bg-purple-900/20 border border-purple-500/30"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="h-5 w-5 text-purple-400" />
                      <span className="text-sm font-medium text-purple-400">AI Debug Analysis</span>
                    </div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
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
                    className="mt-4 p-4 rounded-lg bg-emerald-900/20 border border-emerald-500/30"
                  >
                    <div className="flex items-center gap-3 text-emerald-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>AI is analyzing what worked...</span>
                    </div>
                  </motion.div>
                )}

                {/* Success Analysis Result */}
                {successAnalysisResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-lg bg-emerald-900/20 border border-emerald-500/30"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-5 w-5 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-400">What Worked? Analysis</span>
                    </div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                      {successAnalysisResult}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </MotionWrapper>
      )}

      {/* Empty State */}
      {!result && !isRunning && !pendingCode && !code && (
        <MotionWrapper delay={0.2}>
          <div className="text-center py-12 mt-6">
            <div className="text-6xl mb-4">
              {mode === 'write' ? '💻' : '✨'}
            </div>
            <h3 className="text-lg font-medium text-slate-200 mb-2">
              {mode === 'write' ? 'Write some code to get started' : 'Ask AI to generate code'}
            </h3>
            <p className="text-slate-400">
              {mode === 'write'
                ? `Paste or write ${LANGUAGE_DISPLAY_NAMES[language]} code above and click Run`
                : `Describe what code you need and let AI generate it for you`}
            </p>
          </div>
        </MotionWrapper>
      )}
    </div>
  );
}
