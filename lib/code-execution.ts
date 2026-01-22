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

/**
 * Detect if code contains HTML structure that should render in iframe
 */
export function isInteractiveHTML(code: string): boolean {
  const htmlPatterns = [
    /<html[\s>]/i,
    /<body[\s>]/i,
    /<div[\s>]/i,
    /<canvas[\s>]/i,
    /<button[\s>]/i,
    /<form[\s>]/i,
    /<input[\s>]/i,
    /<table[\s>]/i,
    /<ul[\s>]/i,
    /<svg[\s>]/i,
    /<style[\s>]/i,
    /document\.getElementById/i,
    /document\.querySelector/i,
    /document\.createElement/i,
    /\.innerHTML\s*=/i,
    /\.appendChild/i,
  ];
  return htmlPatterns.some(pattern => pattern.test(code));
}

/**
 * Detect if code requires a full dev environment (can't run in iframe)
 */
export function requiresDevEnvironment(code: string): boolean {
  const devPatterns = [
    /import\s+.*from\s+['"]react/i,
    /import\s+.*from\s+['"]vue/i,
    /import\s+.*from\s+['"]@angular/i,
    /import\s+.*from\s+['"]svelte/i,
    /require\s*\(\s*['"][^'"]+['"]\s*\)/,
    /import\s+.*from\s+['"]next/i,
    /process\.env/i,
    /fs\.(read|write)/i,
    /__dirname|__filename/i,
  ];
  return devPatterns.some(pattern => pattern.test(code));
}

/**
 * Wrap JS code in minimal HTML for iframe preview
 * Does NOT create any elements - lets the code create what it needs
 */
export function wrapJSInHTML(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: system-ui, sans-serif;
      margin: 0;
      padding: 20px;
      background: #1e293b;
      color: #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    canvas {
      border: 1px solid #334155;
      background: #0f172a;
    }
    button {
      margin: 10px 5px;
      padding: 8px 16px;
      background: #334155;
      color: #e2e8f0;
      border: 1px solid #475569;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: #475569;
    }
    .alert-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .alert-box {
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 8px;
      padding: 20px 30px;
      text-align: center;
      max-width: 300px;
    }
    .alert-message {
      color: #e2e8f0;
      margin-bottom: 15px;
      font-size: 16px;
    }
    .alert-button {
      background: #10b981;
      color: white;
      border: none;
      padding: 8px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .alert-button:hover {
      background: #059669;
    }
  </style>
</head>
<body>
  <script>
    // Override alert to show styled in-page message instead of browser popup
    window.alert = function(message) {
      const overlay = document.createElement('div');
      overlay.className = 'alert-overlay';
      overlay.innerHTML = \`
        <div class="alert-box">
          <div class="alert-message">\${message}</div>
          <button class="alert-button" onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
      \`;
      document.body.appendChild(overlay);
    };

    ${code}
  </script>
</body>
</html>`;
}
