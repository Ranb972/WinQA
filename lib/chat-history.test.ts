import { describe, it, expect } from 'vitest';
import { COMPARE_ISOLATION_TEXT, historyForModel, type StoredChatMessage } from './chat-history';
import { CHAT_MAX_MESSAGES, trimChatHistory } from './content-limits';

type Stored = StoredChatMessage & { role: 'user' | 'assistant' | 'system'; id?: string };

const user = (content: string): Stored => ({ role: 'user', content });
const reply = (model: string | undefined, content: string, extra: Partial<Stored> = {}): Stored => ({
  role: 'assistant',
  content,
  ...(model === undefined ? {} : { model }),
  ...extra,
});

const CUSTOM = 'custom:65f0a1b2c3d4e5f6a7b8c9d0';

/** Two Compare turns with cohere, gemini and one custom provider, as Chat Lab stores them. */
const conversation: Stored[] = [
  user('u1'),
  reply('cohere', 'cohere 1'),
  reply('gemini', 'gemini 1'),
  reply(CUSTOM, 'custom 1'),
  user('u2'),
  reply('cohere', 'cohere 2'),
  reply('gemini', 'gemini 2'),
  reply(CUSTOM, 'custom 2'),
  user('u3'),
];

describe('historyForModel (D15): in Compare each model is sent the user turns and only its own replies', () => {
  it('keeps every user message and the replies of the model asked for, in order', () => {
    expect(historyForModel(conversation, 'cohere')).toEqual([
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'cohere 1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'cohere 2' },
      { role: 'user', content: 'u3' },
    ]);
    expect(historyForModel(conversation, 'gemini').map((x) => x.content)).toEqual([
      'u1',
      'gemini 1',
      'u2',
      'gemini 2',
      'u3',
    ]);
  });

  it("never carries another model's reply, for built-in and custom providers alike", () => {
    for (const key of ['cohere', 'gemini', CUSTOM]) {
      const sent = historyForModel(conversation, key);
      const replies = sent.filter((x) => x.role === 'assistant').map((x) => x.content);
      const own = conversation.filter((x) => x.role === 'assistant' && x.model === key).map((x) => x.content);
      expect(replies, key).toEqual(own);
      expect(replies, key).toHaveLength(2);
    }
  });

  it('a custom provider is matched on its own id, not on another custom id', () => {
    const other = 'custom:75f0a1b2c3d4e5f6a7b8c9d1';
    const list = [user('u1'), reply(CUSTOM, 'mine'), reply(other, 'theirs'), user('u2')];
    expect(historyForModel(list, CUSTOM).map((x) => x.content)).toEqual(['u1', 'mine', 'u2']);
    expect(historyForModel(list, other).map((x) => x.content)).toEqual(['u1', 'theirs', 'u2']);
  });

  it('a model that was not selected earlier gets the user turns and no replies', () => {
    expect(historyForModel(conversation, 'groq')).toEqual([
      { role: 'user', content: 'u1' },
      { role: 'user', content: 'u2' },
      { role: 'user', content: 'u3' },
    ]);
  });

  it('error bubbles are never sent, for the model that failed or in single mode', () => {
    const list = [
      user('u1'),
      reply('cohere', 'Messages are too long for one request.', { isError: true }),
      reply('gemini', 'gemini 1'),
      user('u2'),
      reply('cohere', 'Error: Request timed out after 45s', { isError: true }),
      reply('gemini', 'gemini 2'),
      user('u3'),
    ];
    expect(historyForModel(list, 'cohere').map((x) => x.content)).toEqual(['u1', 'u2', 'u3']);
    expect(historyForModel(list, 'gemini').map((x) => x.content)).toEqual(['u1', 'gemini 1', 'u2', 'gemini 2', 'u3']);
    expect(historyForModel(list, null).map((x) => x.content)).toEqual(['u1', 'gemini 1', 'u2', 'gemini 2', 'u3']);
  });

  it('a card still loading is never sent', () => {
    const list = [user('u1'), reply('cohere', '', { isLoading: true }), user('u2')];
    expect(historyForModel(list, 'cohere').map((x) => x.content)).toEqual(['u1', 'u2']);
    expect(historyForModel(list, null).map((x) => x.content)).toEqual(['u1', 'u2']);
  });

  it('a reply with no stored model is left out in Compare and kept in single mode', () => {
    const list = [user('u1'), reply(undefined, 'unattributed'), user('u2')];
    expect(historyForModel(list, 'cohere').map((x) => x.content)).toEqual(['u1', 'u2']);
    expect(historyForModel(list, null).map((x) => x.content)).toEqual(['u1', 'unattributed', 'u2']);
  });

  it('single mode (null) keeps every reply whoever produced it, as before', () => {
    const single = [user('u1'), reply('cohere', 'a1'), user('u2'), reply('groq', 'a2 via fallback'), user('u3')];
    expect(historyForModel(single, null)).toEqual(single.map((x) => ({ role: x.role, content: x.content })));
  });

  it('system messages are kept for every model', () => {
    const list = [{ role: 'system', content: 'be terse' } as Stored, ...conversation];
    expect(historyForModel(list, 'gemini')[0]).toEqual({ role: 'system', content: 'be terse' });
  });

  it('sends only role and content, and does not change the list it is given', () => {
    const list = conversation.map((x, i) => ({ ...x, id: `m${i}` }));
    const copy = list.map((x) => ({ ...x }));
    const sent = historyForModel(list, 'cohere');
    for (const x of sent) expect(Object.keys(x).sort()).toEqual(['content', 'role']);
    expect(list).toEqual(copy);
  });

  it('per-model turns are two messages: the 100-message cap first trims at turn 51 and keeps 49 earlier turns, for any number of models', () => {
    for (const models of [1, 2, 4, 5]) {
      const keys = Array.from({ length: models }, (_, k) => `m${k}`);
      const at = (turn: number): Stored[] => {
        const out: Stored[] = [];
        for (let t = 1; t < turn; t++) {
          out.push(user(`u${t}`));
          for (const key of keys) out.push(reply(key, `${key} r${t}`));
        }
        out.push(user(`u${turn}`));
        return out;
      };
      const t50 = trimChatHistory(historyForModel(at(50), 'm0'));
      expect(t50.dropped, `${models} models`).toBe(0);
      expect(t50.messages).toHaveLength(99);
      const t51 = trimChatHistory(historyForModel(at(51), 'm0'));
      expect(t51.dropped, `${models} models`).toBe(2);
      expect(t51.messages).toHaveLength(99);
      expect(t51.messages[0]).toEqual({ role: 'user', content: 'u2' });
      expect(t51.messages.at(-1)).toEqual({ role: 'user', content: 'u51' });
      expect(t51.messages.length).toBeLessThanOrEqual(CHAT_MAX_MESSAGES);
    }
  });

  it('the Chat Lab line says it in one short sentence', () => {
    expect(COMPARE_ISOLATION_TEXT).toBe('Each model sees your messages and only its own replies.');
  });
});
