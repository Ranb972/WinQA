// Code execution types and utilities for the Code Testing Lab feature

export type SupportedLanguage = 'javascript' | 'python' | 'typescript';

export interface CodeExecutionRequest {
  language: SupportedLanguage;
  code: string;
  stdin?: string;
}

export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  engine?: 'piston' | 'judge0';
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['javascript', 'python', 'typescript'];

export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  javascript: 'JavaScript',
  python: 'Python',
  typescript: 'TypeScript',
};

export const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  js: 'javascript',
  javascript: 'javascript',
  py: 'python',
  python: 'python',
  ts: 'typescript',
  typescript: 'typescript',
};

// Piston API language configurations
export const PISTON_LANGUAGES: Record<SupportedLanguage, { language: string; version: string }> = {
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  python: { language: 'python', version: '3.10.0' },
};

// Judge0 language IDs (CE version)
export const JUDGE0_LANGUAGE_IDS: Record<SupportedLanguage, number> = {
  javascript: 63, // Node.js
  typescript: 74, // TypeScript
  python: 71, // Python 3
};

/**
 * Check if a language is supported for execution
 */
export function isSupportedLanguage(lang: string): boolean {
  const normalized = lang.toLowerCase();
  return normalized in LANGUAGE_ALIASES;
}

/**
 * Normalize a language string to a SupportedLanguage
 */
export function normalizeLanguage(lang: string): SupportedLanguage | null {
  const normalized = lang.toLowerCase();
  return LANGUAGE_ALIASES[normalized] || null;
}

/**
 * Get display name for a language
 */
export function getLanguageDisplayName(lang: string): string {
  const normalized = normalizeLanguage(lang);
  return normalized ? LANGUAGE_DISPLAY_NAMES[normalized] : lang;
}
