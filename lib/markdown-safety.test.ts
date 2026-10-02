import { describe, it, expect, vi } from 'vitest';
import {
  hostOf,
  imageText,
  leaveSiteMessage,
  linkClickPlan,
  linkDecision,
  needsHostSuffix,
  openExternal,
  safeUrlTransform,
} from '@/lib/markdown-safety';
import { TRUSTED_HOSTS, isTrustedHost } from '@/lib/trusted-hosts';

describe('safeUrlTransform', () => {
  it('keeps http and https hrefs', () => {
    expect(safeUrlTransform('https://evil.example/login', 'href')).toBe('https://evil.example/login');
    expect(safeUrlTransform('http://example.com', 'href')).toBe('http://example.com/');
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'mailto:a@b.example',
    '/relative',
    'relative/path',
    '//evil.example/x',
    '#fragment',
    '',
  ])('blanks the href %j', (url) => {
    expect(safeUrlTransform(url, 'href')).toBe('');
  });

  it('blanks every src, even https', () => {
    expect(safeUrlTransform('https://evil.example/p?q=secret', 'src')).toBe('');
    expect(safeUrlTransform('https://github.com/a.png', 'src')).toBe('');
  });

  it('blanks other URL attributes', () => {
    expect(safeUrlTransform('https://evil.example/', 'cite')).toBe('');
  });
});

describe('hostOf', () => {
  it('returns the lower-case host of a web URL', () => {
    expect(hostOf('https://Evil.Example/p?q=1')).toBe('evil.example');
    expect(hostOf('https://github.com@evil.example/')).toBe('evil.example');
  });

  it('returns null for non-web and relative URLs', () => {
    expect(hostOf('javascript:alert(1)')).toBeNull();
    expect(hostOf('/relative')).toBeNull();
    expect(hostOf(undefined)).toBeNull();
  });
});

describe('linkDecision', () => {
  it.each([
    ['https://github.com/Ranb972/WinQA', 'github.com', true],
    ['https://www.github.com/', 'www.github.com', true],
    ['https://GITHUB.COM/x', 'github.com', true],
    ['https://github.com.evil.example/', 'github.com.evil.example', false],
    ['https://evil-github.com/', 'evil-github.com', false],
    ['https://gist.github.com/', 'gist.github.com', false],
    ['https://github.com@evil.example/', 'evil.example', false],
    ['https://evil.example/login', 'evil.example', false],
  ])('%s -> host %s, trusted %s', (url, host, trusted) => {
    expect(linkDecision(url)).toMatchObject({ kind: 'link', host, trusted });
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '/relative', 'file:///x'])(
    '%s is inert',
    (url) => {
      expect(linkDecision(url)).toEqual({ kind: 'inert' });
    },
  );
});

describe('isTrustedHost', () => {
  it('matches exact hosts and www. variants only, case-insensitively', () => {
    expect(isTrustedHost('github.com')).toBe(true);
    expect(isTrustedHost('www.github.com')).toBe(true);
    expect(isTrustedHost('GITHUB.COM')).toBe(true);
    expect(isTrustedHost('www.www.github.com')).toBe(false);
    expect(isTrustedHost('github.com.evil.example')).toBe(false);
    expect(isTrustedHost('notgithub.com')).toBe(false);
    expect(isTrustedHost('')).toBe(false);
  });

  it("includes the owner's list", () => {
    for (const host of [
      'docs.cohere.com',
      'cohere.com',
      'ai.google.dev',
      'aistudio.google.com',
      'console.groq.com',
      'groq.com',
      'docs.mistral.ai',
      'console.mistral.ai',
      'mistral.ai',
      'openrouter.ai',
      'github.com',
      'developer.mozilla.org',
      'en.wikipedia.org',
      'stackoverflow.com',
    ]) {
      expect(TRUSTED_HOSTS).toContain(host);
    }
  });
});

describe('link click plan (click or Enter)', () => {
  it('opens trusted hosts directly, confirms the rest, ignores inert links', () => {
    expect(linkClickPlan('https://github.com/x')).toBe('direct');
    expect(linkClickPlan('https://evil.example/login')).toBe('confirm');
    expect(linkClickPlan('javascript:alert(1)')).toBe('inert');
  });

  it('builds the confirm text from the host', () => {
    expect(leaveSiteMessage('evil.example')).toBe('You are leaving WinQA for evil.example');
  });

  it('Continue opens a new tab without opener or referrer', () => {
    const opener = vi.fn();
    expect(openExternal('https://evil.example/login', opener)).toBe(true);
    expect(opener).toHaveBeenCalledWith('https://evil.example/login', '_blank', 'noopener,noreferrer');
  });

  it('never opens a non-web URL', () => {
    const opener = vi.fn();
    expect(openExternal('javascript:alert(1)', opener)).toBe(false);
    expect(opener).not.toHaveBeenCalled();
  });
});

describe('imageText', () => {
  it('is the alt plus the host', () => {
    expect(imageText('x', 'https://evil.example/p?q=secret')).toBe('x (evil.example)');
  });

  it('falls back to "image" and drops non-web hosts', () => {
    expect(imageText('', 'https://evil.example/p')).toBe('image (evil.example)');
    expect(imageText('chart', 'data:image/png;base64,AAAA')).toBe('chart');
  });
});

describe('needsHostSuffix', () => {
  it('is skipped when the text already is the host or the URL', () => {
    expect(needsHostSuffix('evil.example', 'https://evil.example/', 'evil.example')).toBe(false);
    expect(needsHostSuffix('https://evil.example', 'https://evil.example/', 'evil.example')).toBe(false);
    expect(needsHostSuffix('evil.example/a', 'https://evil.example/a', 'evil.example')).toBe(false);
  });

  it('is shown when the text differs', () => {
    expect(needsHostSuffix('click', 'https://evil.example/login', 'evil.example')).toBe(true);
    expect(needsHostSuffix('https://github.com', 'https://evil.example/', 'evil.example')).toBe(true);
  });
});
