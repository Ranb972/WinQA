// Extracts the runnable code block out of an LLM answer for the Code Duel.
//
// Line-based, CommonMark-shaped: a fence only counts when it is the whole line,
// so a stray ``` at the end of a prose line ("wrap your code in ```") can no
// longer be paired with the real opening fence. Pure module — no imports, no
// browser or node APIs — so it is safe to import from a 'use client' component.

export interface ExtractedBlock {
  code: string;
  /** Both values are whitelisted by /api/execute-code. */
  language: 'javascript' | 'typescript';
}

/** Opens a block: whole line is a fence, optionally carrying an info tag. */
const OPEN_FENCE = /^```[ \t]*([A-Za-z0-9+#.-]*)[ \t]*$/;
/** Closes a block: bare fence line only (a tagged fence inside a block is content). */
const CLOSE_FENCE = /^```[ \t]*$/;

const JS_TAGS = new Set(['javascript', 'js', 'jsx']);
const TS_TAGS = new Set(['typescript', 'ts', 'tsx']);

interface RawBlock {
  tag: string;
  lines: string[];
}

export function extractCodeBlock(content: string): ExtractedBlock | null {
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const rawLine of content.split('\n')) {
    // CRLF tolerance: the fence regexes are anchored at end of line.
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (current) {
      if (CLOSE_FENCE.test(line)) {
        blocks.push(current);
        current = null;
      } else {
        current.lines.push(line);
      }
      continue;
    }

    const open = OPEN_FENCE.exec(line);
    if (open) {
      current = { tag: open[1].toLowerCase(), lines: [] };
    }
  }

  // Truncated response (cut off at max tokens): keep the unterminated block.
  if (current) blocks.push(current);

  const candidates = blocks
    .map((block) => ({ tag: block.tag, code: block.lines.join('\n').trim() }))
    .filter((block) => block.code.length > 0);

  const js = candidates.find((block) => JS_TAGS.has(block.tag));
  if (js) return { code: js.code, language: 'javascript' };

  const ts = candidates.find((block) => TS_TAGS.has(block.tag));
  if (ts) return { code: ts.code, language: 'typescript' };

  // First untagged block — not the longest, which used to pick output samples
  // over the actual solution.
  const untagged = candidates.find((block) => block.tag === '');
  if (untagged) return { code: untagged.code, language: 'javascript' };

  // Only foreign-tagged blocks (python, sql…) — do not run those as JS.
  return null;
}
