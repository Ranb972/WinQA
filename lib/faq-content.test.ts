import { describe, it, expect } from 'vitest';
import { faqs, buildFaqJsonLd } from '@/lib/faq-content';
import { PER_USER_CEILING } from '@/lib/content-limits';

const answerTo = (question: string) => {
  const entry = faqs.find((f) => f.question === question);
  if (!entry) throw new Error(`FAQ not found: ${question}`);
  return entry.answer;
};

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/);

describe('faq content', () => {
  it('the API keys answer does not start with "Yes"', () => {
    expect(answerTo('Do I need my own API keys?')).not.toMatch(/^Yes/);
  });

  it('the keys answer says keys are optional', () => {
    expect(answerTo('Do I need my own API keys?')).toMatch(/optional/i);
  });

  it('no answer says code runs in the browser, except a sentence that also names HTML', () => {
    for (const { question, answer } of faqs) {
      for (const sentence of sentences(answer)) {
        if (/in (the|your) browser|browser sandbox/i.test(sentence)) {
          expect(sentence, `FAQ "${question}"`).toMatch(/HTML/);
        }
      }
    }
  });

  it('the code answers name the third-party runners', () => {
    expect(answerTo('How does the Code Testing Lab work?')).toMatch(/Judge0 and Piston/);
    expect(answerTo('What programming languages are supported?')).toMatch(/Judge0 and Piston/);
  });

  it('the free answer does not say "bring your own" and mentions the account', () => {
    const free = answerTo('Is WinQA free?');
    expect(free.toLowerCase()).not.toContain('bring your own');
    expect(free).toMatch(/free account/i);
  });

  it('no answer promises sign-up is not needed', () => {
    for (const { answer } of faqs) expect(answer).not.toMatch(/no sign-?up/i);
  });

  it('the security answer describes server-side encryption', () => {
    const answer = answerTo('Is my data private and secure?');
    expect(answer).toMatch(/encrypted|AES-256-GCM/);
    expect(answer).toMatch(/server/i);
  });

  it('no answer says keys are kept in this browser, except the legacy sentence', () => {
    for (const { question, answer } of faqs) {
      for (const sentence of sentences(answer)) {
        if (/(kept|stored|saved) in this browser/i.test(sentence)) {
          expect(sentence, `FAQ "${question}"`).toMatch(/before October 2026/);
        }
      }
    }
  });

  it('a limits entry follows the privacy entry and names the 500 ceiling, the battle roll-off and the size caps', () => {
    const at = faqs.findIndex((f) => f.question === 'Is there a limit on how much I can save?');
    expect(at, 'limits entry missing').toBeGreaterThan(-1);
    expect(faqs[at - 1].question).toBe('Is my data private and secure?');
    const answer = faqs[at].answer;
    expect(answer).toMatch(/\b500\b/);
    for (const kind of ['bug reports', 'prompts', 'test cases', 'insights', 'battles']) {
      expect(answer).toContain(kind);
    }
    const rollOff = sentences(answer).find((s) => /oldest/.test(s));
    expect(rollOff, 'no sentence says the oldest battle goes').toMatch(/battle/);
    expect(answer).toMatch(/size limits/);
    expect(answer).toMatch(/chat messages/);
    expect(answer).toMatch(/counter/);
  });

  it('every number in the limits entry matches lib/content-limits.ts', () => {
    expect(PER_USER_CEILING).toBe(500);
    const answer = answerTo('Is there a limit on how much I can save?');
    const numbers = (answer.match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, '')));
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n).toBe(PER_USER_CEILING);
  });

  it('the FAQPage JSON-LD has the same count and order as the array', () => {
    const ld = buildFaqJsonLd(faqs);
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(faqs.length);
    ld.mainEntity.forEach((q, i) => {
      expect(q.name).toBe(faqs[i].question);
      expect(q.acceptedAnswer.text).toBe(faqs[i].answer);
    });
  });
});
