import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkNodeModules, declaredEntries } from './check-node-modules.mjs';

// H1: the entry-point check that would have caught the 2026-10-06 breakage
// (two @aws-sdk packages without their dist-cjs folders). Fixtures are tiny
// node_modules trees under os.tmpdir(); nothing touches the real one.

let project: string;

function pkg(dir: string, manifest: Record<string, unknown>, files: string[] = []) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  for (const file of files) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), '// entry\n');
  }
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'winqa-check-nm-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('checkNodeModules', () => {
  it('reports a package whose main file is missing, by package path and entry (the @aws-sdk shape)', () => {
    const nm = join(project, 'node_modules');
    pkg(join(nm, '@aws-sdk', 'credential-provider-cognito-identity'), {
      name: '@aws-sdk/credential-provider-cognito-identity',
      version: '3.972.3',
      main: './dist-cjs/index.js',
    });
    const result = checkNodeModules(project);
    expect(result.packages).toBe(1);
    expect(result.problems).toEqual(['@aws-sdk/credential-provider-cognito-identity: ./dist-cjs/index.js']);
  });

  it('walks scoped packages and nested node_modules, and passes when every entry exists', () => {
    const nm = join(project, 'node_modules');
    pkg(join(nm, 'plain'), { name: 'plain', version: '1.0.0', main: 'index.js' }, ['index.js']);
    pkg(join(nm, '@scope', 'inner'), { name: '@scope/inner', version: '2.0.0', main: 'lib/main.js' }, ['lib/main.js']);
    pkg(
      join(nm, 'plain', 'node_modules', 'nested'),
      { name: 'nested', version: '3.0.0', main: './dist/index.js' },
      ['dist/index.js'],
    );
    pkg(
      join(nm, 'plain', 'node_modules', 'nested-broken'),
      { name: 'nested-broken', version: '3.0.1', main: './dist/index.js' },
    );
    const result = checkNodeModules(project);
    expect(result.packages).toBe(4);
    expect(result.problems).toEqual(['plain/node_modules/nested-broken: ./dist/index.js']);
  });

  it('ignores a stale main when exports exist (the @humanfs shape)', () => {
    const nm = join(project, 'node_modules');
    pkg(
      join(nm, '@humanfs', 'core'),
      {
        name: '@humanfs/core',
        version: '0.19.1',
        main: 'dist/index.js',
        exports: { import: { types: './dist/index.d.ts', default: './src/index.js' } },
      },
      ['src/index.js'],
    );
    expect(checkNodeModules(project).problems).toEqual([]);
  });

  it('follows only the ., import, require, node and default conditions (custom conditions are ignored)', () => {
    const nm = join(project, 'node_modules');
    pkg(
      join(nm, '@standard-schema', 'spec'),
      {
        name: '@standard-schema/spec',
        version: '1.1.0',
        exports: {
          '.': { 'standard-schema-spec': './src/index.ts', import: './dist/index.js', require: './dist/index.cjs' },
        },
      },
      ['dist/index.js', 'dist/index.cjs'],
    );
    expect(checkNodeModules(project).problems).toEqual([]);
    expect(declaredEntries({ exports: { '.': { 'custom-only': './src/index.ts' } } })).toEqual([]);
  });

  it('resolves a main without an extension to .js or index.js', () => {
    const nm = join(project, 'node_modules');
    pkg(join(nm, 'bare-js'), { name: 'bare-js', version: '1.0.0', main: 'lib/entry' }, ['lib/entry.js']);
    pkg(join(nm, 'bare-dir'), { name: 'bare-dir', version: '1.0.0', main: 'lib' }, ['lib/index.js']);
    pkg(join(nm, 'bare-missing'), { name: 'bare-missing', version: '1.0.0', main: 'lib/entry' });
    const result = checkNodeModules(project);
    expect(result.packages).toBe(3);
    expect(result.problems).toEqual(['bare-missing: lib/entry']);
  });

  it('skips folders without a usable package.json and reports a missing node_modules as zero packages', () => {
    const nm = join(project, 'node_modules');
    mkdirSync(join(nm, 'not-a-package'), { recursive: true });
    writeFileSync(join(nm, 'not-a-package', 'package.json'), '{ not json');
    expect(checkNodeModules(project)).toEqual({ packages: 0, problems: [] });
    expect(checkNodeModules(join(project, 'nowhere'))).toEqual({ packages: 0, problems: [] });
  });
});

describe('declaredEntries', () => {
  it('reads main only when there are no exports, and a string or array exports as given', () => {
    expect(declaredEntries({ main: './dist-cjs/index.js' })).toEqual(['./dist-cjs/index.js']);
    expect(declaredEntries({ main: 'x.js', exports: './y.js' })).toEqual(['./y.js']);
    expect(declaredEntries({ exports: ['./a.js', './b.js'] })).toEqual(['./a.js', './b.js']);
    expect(declaredEntries({ exports: { './sub': './sub.js' } })).toEqual([]);
    expect(declaredEntries({ exports: './glob/*.js' })).toEqual([]);
    expect(declaredEntries({})).toEqual([]);
  });
});
