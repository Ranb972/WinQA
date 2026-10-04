import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { SYSTEM_USER_ID } from '@/lib/systemUser';
import { SYSTEM_OWNER_ID } from '@/lib/server/purge-user';
import { SYSTEM_USER_ID as SCRIPT_SYSTEM_USER_ID } from '../scripts/reassign-public-owner';

const root = resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('SYSTEM_USER_ID', () => {
  it('is "system"', () => {
    expect(SYSTEM_USER_ID).toBe('system');
  });

  it('is the value purge-user and the reassign script re-export', () => {
    expect(SYSTEM_OWNER_ID).toBe(SYSTEM_USER_ID);
    expect(SCRIPT_SYSTEM_USER_ID).toBe(SYSTEM_USER_ID);
  });

  it('is defined once: no other source file spells the literal as an owner id', () => {
    const offenders = ['lib', 'app', 'scripts']
      .flatMap((d) => sourceFiles(join(root, d)))
      .filter((f) => relative(root, f).split(sep).join('/') !== 'lib/systemUser.ts')
      .filter((f) => /(?<![=!])= 'system'|user_id: 'system'/.test(readFileSync(f, 'utf-8')))
      .map((f) => relative(root, f).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });
});
