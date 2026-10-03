import { describe, it, expect } from 'vitest';
import { faqs, buildFaqJsonLd } from '@/lib/faq-content';

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
