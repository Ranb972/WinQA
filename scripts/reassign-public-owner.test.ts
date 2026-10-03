import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import {
  MODELS,
  SYSTEM_USER_ID,
  applyLeftDocumentsOutsideSystem,
  outsideSystemFilter,
  parseMode,
  publicFilter,
  reassignUpdate,
} from './reassign-public-owner';

describe('parseMode', () => {
  it('accepts exactly --dry-run', () => {
    expect(parseMode(['--dry-run'])).toBe('dry-run');
  });

  it('accepts exactly --apply', () => {
    expect(parseMode(['--apply'])).toBe('apply');
  });

  it('refuses no flag', () => {
    expect(parseMode([])).toBeNull();
  });

  it('refuses both flags, in either order', () => {
    expect(parseMode(['--dry-run', '--apply'])).toBeNull();
    expect(parseMode(['--apply', '--dry-run'])).toBeNull();
  });

  it('refuses a repeated flag and an unknown or misspelt argument', () => {
    expect(parseMode(['--apply', '--apply'])).toBeNull();
    expect(parseMode(['--aply'])).toBeNull();
    expect(parseMode(['apply'])).toBeNull();
    expect(parseMode(['--apply', '--force'])).toBeNull();
  });
});

describe('query builders', () => {
  it('the system owner is the one lib/autoSeed.ts seeds under', () => {
    expect(SYSTEM_USER_ID).toBe('system');
    const autoSeedSource = readFileSync(resolve(__dirname, '../lib/autoSeed.ts'), 'utf-8');
    expect(autoSeedSource).toContain(`const SYSTEM_USER_ID = '${SYSTEM_USER_ID}';`);
  });

  it('counts every public document', () => {
    expect(publicFilter()).toEqual({ is_public: true });
  });

  it('targets only public documents not owned by system', () => {
    expect(outsideSystemFilter()).toEqual({ is_public: true, user_id: { $ne: 'system' } });
  });

  it('changes only the owner, to system', () => {
    expect(reassignUpdate()).toEqual({ $set: { user_id: 'system' } });
  });

  it('runs over exactly the four library collections, named by the models', () => {
    expect(MODELS.map((m) => m.collection.collectionName).sort()).toEqual([
      'bugreports',
      'insights',
      'promptlibraries',
      'testcases',
    ]);
  });
});

describe('applyLeftDocumentsOutsideSystem', () => {
  it('fails an --apply that leaves any public document outside system', () => {
    expect(applyLeftDocumentsOutsideSystem('apply', [0, 0, 1, 0])).toBe(true);
  });

  it('passes an --apply that leaves none', () => {
    expect(applyLeftDocumentsOutsideSystem('apply', [0, 0, 0, 0])).toBe(false);
  });

  it('never fails a dry run, whatever it counted', () => {
    expect(applyLeftDocumentsOutsideSystem('dry-run', [5, 12, 7, 6])).toBe(false);
  });
});
