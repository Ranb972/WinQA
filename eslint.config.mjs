import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// eslint-config-next 16 ships native flat configs, so FlatCompat is gone (H10).
// eslint-plugin-react-hooks 7 adds the React Compiler rules to `recommended`.
// H11 switched on the eleven that already pass on this codebase (config,
// error-boundaries, gating, globals, immutability, incompatible-library,
// preserve-manual-memoization, set-state-in-render, static-components,
// unsupported-syntax, use-memo: 0 hits each on 2026-10-06). The three below
// still fire and stay parked until H12 fixes them one rule per commit:
//   purity               2 hits  app/(app)/battle/components/BlindfoldReveal.tsx
//   refs                 4 hits  app/(app)/code-testing/page.tsx, components/ChatInterface.tsx
//   set-state-in-effect 20 hits  data-fetching effects across the library and battle pages
const PARKED_REACT_COMPILER_RULES = {
  'react-hooks/purity': 'off',
  'react-hooks/refs': 'off',
  'react-hooks/set-state-in-effect': 'off',
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // This repo:
    '.playwright-mcp/**',
    '.agent/**',
    '.agents/**',
    '.claude/**',
    '.gemini/**',
    'mobile-audit/**',
  ]),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // eslint-config-next 16 lowers this to warn; the repo keeps it at error.
      '@typescript-eslint/no-unused-expressions': 'error',
      ...PARKED_REACT_COMPILER_RULES,
    },
  },
]);

export default eslintConfig;
