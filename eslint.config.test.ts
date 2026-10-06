import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';

// H10: eslint-config-next 16 flat config without FlatCompat, with the React
// Compiler rules of eslint-plugin-react-hooks 7 parked at off until H11/H12.
const eslint = new ESLint({ cwd: process.cwd() });

describe('eslint.config.mjs (H10)', () => {
  it('knows the react-hooks 7 compiler rules and keeps them parked', async () => {
    const config = await eslint.calculateConfigForFile('app/page.tsx');
    const rules = config.rules as Record<string, unknown[]>;
    expect(rules['react-hooks/set-state-in-effect']).toBeDefined();
    expect(rules['react-hooks/set-state-in-effect'][0]).toBe(0);
    expect(rules['react-hooks/purity'][0]).toBe(0);
    expect(rules['react-hooks/rules-of-hooks'][0]).toBe(2);
    expect(rules['react-hooks/exhaustive-deps'][0]).toBe(1);
    expect(rules['@typescript-eslint/no-unused-vars'][0]).toBe(2);
    expect(rules['@typescript-eslint/no-unused-vars'][1]).toMatchObject({ argsIgnorePattern: '^_' });
    expect(rules['@typescript-eslint/no-unused-expressions'][0]).toBe(2);
    expect(rules['@next/next/no-location-assign-relative-destination'][0]).toBe(1);
  });

  it('loads the Next plugin natively (no FlatCompat) and still ignores the tool folders', async () => {
    const config = await eslint.calculateConfigForFile('app/page.tsx');
    expect(Object.keys(config.plugins ?? {})).toEqual(expect.arrayContaining(['@next/next', 'react-hooks']));
    expect(config.rules['@next/next/no-html-link-for-pages']).toBeDefined();
    expect(await eslint.isPathIgnored('.playwright-mcp/x.ts')).toBe(true);
    expect(await eslint.isPathIgnored('.next/server/x.js')).toBe(true);
    expect(await eslint.isPathIgnored('mobile-audit/x.ts')).toBe(true);
    expect(await eslint.isPathIgnored('lib/content-limits.ts')).toBe(false);
  });
});
