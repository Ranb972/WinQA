import { describe, it, expect } from 'vitest';
import { extractCodeBlock } from '@/lib/code-extraction';

const lines = (...rows: string[]) => rows.join('\n');

describe('extractCodeBlock', () => {
  it('returns a javascript-tagged block', () => {
    const content = lines('Here is the solution:', '```javascript', 'console.log(1);', '```');
    expect(extractCodeBlock(content)).toEqual({
      code: 'console.log(1);',
      language: 'javascript',
    });
  });

  it('tags TypeScript blocks as typescript, case-insensitively', () => {
    const content = lines('```TypeScript', 'const a: number = 1;', '```');
    expect(extractCodeBlock(content)).toEqual({
      code: 'const a: number = 1;',
      language: 'typescript',
    });
  });

  it('prefers a tagged javascript block over an earlier untagged one', () => {
    const content = lines('```', 'not the answer', '```', '```js', 'answer();', '```');
    expect(extractCodeBlock(content)).toEqual({ code: 'answer();', language: 'javascript' });
  });

  it('returns the FIRST untagged block, not the longest', () => {
    const content = lines(
      '```',
      'const a = 1;',
      '```',
      'Example output:',
      '```',
      'a much longer sample output block',
      'that used to win on length alone',
      '```'
    );
    expect(extractCodeBlock(content)?.code).toBe('const a = 1;');
  });

  it('keeps an unterminated final block (truncated response)', () => {
    const content = lines('```javascript', 'console.log("hi");');
    expect(extractCodeBlock(content)).toEqual({
      code: 'console.log("hi");',
      language: 'javascript',
    });
  });

  it('ignores a stray fence at the end of a prose line (mispairing)', () => {
    const content = lines('Wrap your code in ```', '', '```javascript', 'console.log(1);', '```');
    expect(extractCodeBlock(content)).toEqual({
      code: 'console.log(1);',
      language: 'javascript',
    });
  });

  it('skips blocks that are empty after trimming', () => {
    const content = lines('```', '   ', '```', '```', 'real();', '```');
    expect(extractCodeBlock(content)?.code).toBe('real();');
  });

  it('handles CRLF line endings', () => {
    expect(extractCodeBlock('```javascript\r\nconsole.log(1);\r\n```\r\n')).toEqual({
      code: 'console.log(1);',
      language: 'javascript',
    });
  });

  it('returns null when only foreign-tagged blocks are present', () => {
    expect(extractCodeBlock(lines('```python', 'print(1)', '```'))).toBeNull();
  });

  it('returns null when there is no fenced block', () => {
    expect(extractCodeBlock('Just prose, no fences here.')).toBeNull();
  });
});
