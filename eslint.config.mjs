import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// eslint-config-next 16 ships native flat configs, so FlatCompat is gone (H10).
// eslint-plugin-react-hooks 7 adds the React Compiler rules below to
// `recommended`. They are parked at 'off' here and switched on one rule per
// commit (H11 for the rules that already pass, H12 for the rest), so this
// commit changes no lint result. Keep the list in sync with the plugin's
// recommended preset when it is bumped.
const PARKED_REACT_COMPILER_RULES = {
  'react-hooks/config': 'off',
  'react-hooks/error-boundaries': 'off',
  'react-hooks/gating': 'off',
  'react-hooks/globals': 'off',
  'react-hooks/immutability': 'off',
  'react-hooks/incompatible-library': 'off',
  'react-hooks/preserve-manual-memoization': 'off',
  'react-hooks/purity': 'off',
  'react-hooks/refs': 'off',
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/set-state-in-render': 'off',
  'react-hooks/static-components': 'off',
  'react-hooks/unsupported-syntax': 'off',
  'react-hooks/use-memo': 'off',
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
