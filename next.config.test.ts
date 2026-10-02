import { describe, it, expect } from 'vitest';
import nextConfig from './next.config';

async function catchAllHeaders() {
  const rules = await nextConfig.headers!();
  const catchAll = rules.find((r) => r.source === '/(.*)');
  expect(catchAll).toBeDefined();
  return catchAll!.headers;
}

async function cspDirectives(): Promise<string[]> {
  const csp = (await catchAllHeaders()).find((h) => h.key === 'Content-Security-Policy');
  expect(csp).toBeDefined();
  return csp!.value.split(';').map((d) => d.trim());
}

describe('next.config security headers', () => {
  it('pins base-uri to the app origin', async () => {
    expect(await cspDirectives()).toContain("base-uri 'self'");
  });

  it('tightens object-src from the inherited self to none', async () => {
    expect(await cspDirectives()).toContain("object-src 'none'");
  });

  it('forbids framing the app, matching X-Frame-Options DENY', async () => {
    expect(await cspDirectives()).toContain("frame-ancestors 'none'");
    const xfo = (await catchAllHeaders()).find((h) => h.key === 'X-Frame-Options');
    expect(xfo?.value).toBe('DENY');
  });

  it('limits form posts to the app origin only', async () => {
    const d = await cspDirectives();
    expect(d).toContain("form-action 'self'");
    const forms = d.filter((x) => x.startsWith('form-action'));
    expect(forms).toHaveLength(1);
    expect(forms[0]).not.toMatch(/clerk|accounts\./);
  });

  it('keeps the existing directives', async () => {
    const d = await cspDirectives();
    for (const name of ['default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'worker-src']) {
      expect(d.some((x) => x.startsWith(`${name} `))).toBe(true);
    }
  });

  it('does not advertise X-Powered-By', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
