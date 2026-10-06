import { describe, it, expect } from 'vitest';
import proxy, { config } from './proxy';

// H9: the request filter moved from the deprecated middleware.ts to proxy.ts. The matcher
// strings are the ones Batch S and C relied on and must not drift during the rename.
describe('proxy.ts (H9)', () => {
  it('default-exports the Clerk request handler', () => {
    expect(typeof proxy).toBe('function');
  });

  it('keeps the two matcher entries verbatim', () => {
    expect(config.matcher).toEqual([
      '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      '/(api|trpc)(.*)',
    ]);
    expect(config.matcher[0]).toContain('_next');
    expect(config.matcher[1]).toBe('/(api|trpc)(.*)');
  });
});
