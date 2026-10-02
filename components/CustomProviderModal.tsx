'use client';

import { useState, useEffect, useId, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, EyeOff, Loader2, FlaskConical, Check, X } from 'lucide-react';
import {
  CustomProvider,
  CustomProviderTestResult,
  testCustomProviderConnection,
  testFingerprint,
  friendlyTestFailure,
  formatTestPassed,
  canSaveProvider,
} from '@/lib/custom-providers';
import {
  COMMON_CUSTOM_PROVIDERS,
  getSuggestedModels,
  getHeaderType,
  normalizeBaseUrl,
} from '@/lib/llm/models';

// Sentinel value of the model <Select> that reveals the free-text input.
const CUSTOM_MODEL = '__custom__';

// One look for every text field in the dialog (44 px touch height, visible focus ring).
const FIELD_CLASS =
  'h-11 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-violet-500';
const LABEL_CLASS = 'text-sm font-medium text-slate-300 mb-1.5 block';

interface CustomProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: CustomProvider | null; // null = add mode, provider = edit mode
  onSave: (provider: Omit<CustomProvider, 'id'> & { id?: string }) => void;
}

type TestStatus = 'idle' | 'testing' | 'valid' | 'invalid';

// What the status line under Test connection says after a failed test.
type TestFailure = { reason: string; statusText: string | null; detail: string | null };

export default function CustomProviderModal({
  open,
  onOpenChange,
  provider,
  onSave,
}: CustomProviderModalProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  // The id typed into "Enter custom model" when the <Select> is on the sentinel.
  const [customModelId, setCustomModelId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<TestFailure | null>(null);
  // Last passing test and the fingerprint (URL, key, model, header) it ran on.
  const [passed, setPassed] = useState<{
    fingerprint: string;
    result: CustomProviderTestResult;
  } | null>(null);
  // Bumped by every test, every tested-field edit and every open; a response
  // from an older request is ignored.
  const requestSeq = useRef(0);
  const [suggestedModels, setSuggestedModels] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Real label/field pairs: ids are generated per modal instance.
  const uid = useId();
  const nameId = `${uid}-name`;
  const baseUrlId = `${uid}-base-url`;
  const baseUrlHelpId = `${uid}-base-url-help`;
  const apiKeyId = `${uid}-api-key`;
  const modelFieldId = `${uid}-model`;
  const customModelFieldId = `${uid}-custom-model`;
  const quickFillLabelId = `${uid}-quick-fill`;
  const saveHelpId = `${uid}-save-help`;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset form when modal opens/closes or provider changes
  useEffect(() => {
    if (open) {
      if (provider) {
        // Edit mode. A saved id that is not one of the base URL's suggestions is a
        // custom one: show it in the free-text input instead of an empty <Select>.
        setName(provider.name);
        setBaseUrl(provider.baseUrl);
        setApiKey(provider.apiKey);
        const suggestions = getSuggestedModels(provider.baseUrl);
        if (suggestions.length > 0 && !suggestions.includes(provider.modelId)) {
          setModelId(CUSTOM_MODEL);
          setCustomModelId(provider.modelId);
        } else {
          setModelId(provider.modelId);
          setCustomModelId('');
        }
      } else {
        // Add mode
        setName('');
        setBaseUrl('');
        setApiKey('');
        setModelId('');
        setCustomModelId('');
      }
      setShowApiKey(false);
      setTestStatus('idle');
      setTestError(null);
      setPassed(null);
      requestSeq.current += 1;
    }
  }, [open, provider]);

  // Update suggested models when base URL changes
  useEffect(() => {
    if (baseUrl) {
      const models = getSuggestedModels(baseUrl);
      setSuggestedModels(models);
    } else {
      setSuggestedModels([]);
    }
  }, [baseUrl]);

  // A tested field changed: the button and status line go back to idle and any
  // in-flight test result is dropped. `passed` is kept; it only counts while its
  // fingerprint equals the current one.
  const resetTest = () => {
    requestSeq.current += 1;
    setTestStatus('idle');
    setTestError(null);
  };

  const handleQuickFill = (providerName: string) => {
    const suggestion = COMMON_CUSTOM_PROVIDERS.find((p) => p.name === providerName);
    if (suggestion) {
      resetTest();
      setName(suggestion.name);
      setBaseUrl(suggestion.baseUrl);
      setModelId(suggestion.models[0] || '');
    }
  };

  // The id that will be tested and saved: the typed one when the <Select> is on the
  // sentinel, otherwise the selected or typed id.
  const effectiveModelId = modelId === CUSTOM_MODEL ? customModelId.trim() : modelId;

  // Save gate. The name is not part of the fingerprint, so a name-only edit of a
  // stored provider may save without a new test.
  const currentFingerprint = testFingerprint({
    baseUrl,
    apiKey,
    modelId: effectiveModelId,
    headerType: getHeaderType(baseUrl),
  });
  const testPassed = passed !== null && passed.fingerprint === currentFingerprint;
  const nameOnlyChange = !!provider && testFingerprint(provider) === currentFingerprint;
  const isValid = !!(name && baseUrl && apiKey && effectiveModelId);
  const canSave = canSaveProvider({ isValid, testPassed, nameOnlyChange });

  const handleTest = async () => {
    requestSeq.current += 1;
    const seq = requestSeq.current;
    const fp = currentFingerprint;

    if (!baseUrl || !apiKey || !effectiveModelId) {
      setTestError({ reason: 'Please fill in all required fields', statusText: null, detail: null });
      setTestStatus('invalid');
      return;
    }

    setTestStatus('testing');
    setTestError(null);
    setPassed(null);

    const testProvider: CustomProvider = {
      id: 'test',
      name: name || 'Test',
      baseUrl,
      apiKey,
      modelId: effectiveModelId,
      enabled: true,
      headerType: getHeaderType(baseUrl),
    };

    const result = await testCustomProviderConnection(testProvider);

    // A newer test, an edit of a tested field, or a reopen happened meanwhile.
    if (seq !== requestSeq.current) {
      return;
    }

    if (result.valid) {
      setPassed({ fingerprint: fp, result });
      setTestStatus('valid');
    } else {
      setTestStatus('invalid');
      // The key goes in so `detail` is redacted again before it is shown.
      setTestError(friendlyTestFailure(result, apiKey));
    }
  };

  const handleSave = () => {
    if (!name || !baseUrl || !apiKey || !effectiveModelId || !canSave) {
      return;
    }

    onSave({
      ...(provider?.id && { id: provider.id }),
      name,
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKey,
      modelId: effectiveModelId,
      enabled: provider?.enabled ?? true,
      headerType: getHeaderType(baseUrl),
    });

    onOpenChange(false);
  };

  const isEditMode = !!provider;
  const showSaveHelp = isValid && !canSave;

  // The button keeps its four labels; after an edit that returns to the tested
  // values it shows Connected again, matching the status line.
  const buttonStatus: TestStatus =
    testStatus === 'idle' && testPassed ? 'valid' : testStatus;

  // A live id for the current base URL, shown as the placeholder of every model-id input.
  const modelPlaceholder = `e.g. ${suggestedModels[0] ?? 'gpt-5.6-terra'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {isEditMode ? 'Edit Custom Provider' : 'Add Custom Provider'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEditMode
              ? 'Update the provider configuration.'
              : 'Add an OpenAI-compatible API provider.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Fill Suggestions */}
          {!isEditMode && (
            <div role="group" aria-labelledby={quickFillLabelId}>
              <p id={quickFillLabelId} className="text-xs text-slate-400 mb-2">
                Quick fill from common providers
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
                {COMMON_CUSTOM_PROVIDERS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleQuickFill(p.name)}
                    title={p.name}
                    className="min-h-11 w-full px-2 text-sm text-center truncate bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provider Name */}
          <div>
            <label htmlFor={nameId} className={LABEL_CLASS}>
              Provider Name
            </label>
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., OpenAI, Anthropic"
              className={FIELD_CLASS}
            />
          </div>

          {/* Base URL */}
          <div>
            <label htmlFor={baseUrlId} className={LABEL_CLASS}>
              API Base URL
            </label>
            <Input
              id={baseUrlId}
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                resetTest();
              }}
              placeholder="e.g., https://api.openai.com/v1"
              inputMode="url"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={baseUrlHelpId}
              className={FIELD_CLASS}
            />
            <p id={baseUrlHelpId} className="text-xs text-slate-400 mt-1">
              The base URL for the API (without /chat/completions)
            </p>
          </div>

          {/* API Key */}
          <div>
            <label htmlFor={apiKeyId} className={LABEL_CLASS}>
              API Key
            </label>
            <div className="relative">
              <Input
                id={apiKeyId}
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  resetTest();
                }}
                placeholder="Enter your API key"
                autoCapitalize="none"
                spellCheck={false}
                className={`pr-11 ${FIELD_CLASS}`}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label="Show key"
                title={showApiKey ? 'Hide key' : 'Show key'}
                aria-pressed={showApiKey}
                className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Model ID */}
          <div>
            <label htmlFor={modelFieldId} className={LABEL_CLASS}>
              Model ID
            </label>
            {mounted && suggestedModels.length > 0 ? (
              <Select
                value={modelId}
                onValueChange={(value) => {
                  setModelId(value);
                  resetTest();
                }}
              >
                <SelectTrigger
                  id={modelFieldId}
                  className="h-11 bg-slate-950 border-slate-700 focus:ring-2 focus:ring-violet-500"
                >
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {suggestedModels.map((model) => (
                    <SelectItem
                      key={model}
                      value={model}
                      className="py-3 sm:py-1.5 text-slate-300 focus:bg-slate-800"
                    >
                      {model}
                    </SelectItem>
                  ))}
                  <SelectItem
                    value={CUSTOM_MODEL}
                    className="py-3 sm:py-1.5 text-slate-400 focus:bg-slate-800"
                  >
                    Enter custom model…
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={modelFieldId}
                value={modelId}
                onChange={(e) => {
                  setModelId(e.target.value);
                  resetTest();
                }}
                placeholder={modelPlaceholder}
                autoCapitalize="none"
                spellCheck={false}
                className={FIELD_CLASS}
              />
            )}
            {modelId === CUSTOM_MODEL && (
              <>
                <label htmlFor={customModelFieldId} className="sr-only">
                  Custom model ID
                </label>
                <Input
                  id={customModelFieldId}
                  value={customModelId}
                  onChange={(e) => {
                    setCustomModelId(e.target.value);
                    resetTest();
                  }}
                  placeholder={modelPlaceholder}
                  autoCapitalize="none"
                  spellCheck={false}
                  className={`mt-2 ${FIELD_CLASS}`}
                  autoFocus
                />
              </>
            )}
          </div>

          {/* Test Connection: the status line keeps its height so text never shifts the layout */}
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={testStatus === 'testing' || !isValid}
              className={`h-11 w-full sm:w-auto transition-colors ${
                buttonStatus === 'valid'
                  ? 'border-emerald-500/50 text-emerald-400'
                  : buttonStatus === 'invalid'
                  ? 'border-rose-500/50 text-rose-400'
                  : 'border-slate-600'
              }`}
            >
              {buttonStatus === 'testing' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Testing…
                </>
              ) : buttonStatus === 'valid' ? (
                <>
                  <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                  Connected
                </>
              ) : buttonStatus === 'invalid' ? (
                <>
                  <X className="h-4 w-4 mr-2" aria-hidden="true" />
                  Failed
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4 mr-2" aria-hidden="true" />
                  Test connection
                </>
              )}
            </Button>
            <p
              role="status"
              aria-live="polite"
              className={`mt-2 min-h-[1.5rem] text-xs break-words ${
                testStatus === 'testing'
                  ? 'text-slate-400'
                  : testPassed
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}
            >
              {testStatus === 'testing' ? (
                'Testing connection…'
              ) : testPassed && passed ? (
                formatTestPassed(passed.result)
              ) : testStatus === 'invalid' && testError ? (
                <>
                  {testError.reason}
                  {testError.statusText ? ` · ${testError.statusText}` : ''}
                  {testError.detail && (
                    <span className="block mt-0.5 text-slate-500">{testError.detail}</span>
                  )}
                </>
              ) : null}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full sm:w-auto text-slate-400 hover:text-slate-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            aria-describedby={showSaveHelp ? saveHelpId : undefined}
            className="h-11 w-full sm:w-auto bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
          >
            {isEditMode ? 'Save changes' : 'Add provider'}
          </Button>
        </DialogFooter>
        {showSaveHelp && (
          <p id={saveHelpId} className="-mt-2 text-xs text-slate-400 sm:text-right">
            Test the connection before saving.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
