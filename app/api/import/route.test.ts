import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import BugReport from '@/models/BugReport';
import PromptLibrary from '@/models/PromptLibrary';
import TestCase from '@/models/TestCase';
import Insight from '@/models/Insight';

// No database: auth and dbConnect are mocked, and the model statics are spied
// on below. Creating a Mongoose model opens no connection.
const { authMock, dbConnectMock } = vi.hoisted(() => ({
  authMock: vi.fn(async (): Promise<{ userId: string | null }> => ({ userId: null })),
  dbConnectMock: vi.fn(async (): Promise<unknown> => undefined),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }));
vi.mock('@/lib/mongodb', () => ({ default: dbConnectMock }));

import { POST } from './route';

const USER = 'user_2abcDEF123';
const PRIVATE_ONLY = { user_id: USER, is_public: { $ne: true } };

const MODELS = { bugs: BugReport, prompts: PromptLibrary, testCases: TestCase, insights: Insight };
type Collection = keyof typeof MODELS;
const COLLECTIONS = Object.keys(MODELS) as Collection[];

// Every write is appended here, so a test can read the order across models.
const calls: string[] = [];
type Spy = ReturnType<typeof vi.fn>;
const deleteSpies = {} as Record<Collection, Spy>;
const insertSpies = {} as Record<Collection, Spy>;

beforeEach(() => {
  calls.length = 0;
  authMock.mockReset();
  authMock.mockResolvedValue({ userId: USER });
  dbConnectMock.mockReset();
  dbConnectMock.mockResolvedValue(undefined);
  for (const name of COLLECTIONS) {
    deleteSpies[name] = vi.spyOn(MODELS[name], 'deleteMany').mockImplementation((() => {
      calls.push(`${name}.deleteMany`);
      return Promise.resolve({ deletedCount: 1 });
    }) as never) as unknown as Spy;
    insertSpies[name] = vi.spyOn(MODELS[name], 'insertMany').mockImplementation(((docs: unknown[]) => {
      calls.push(`${name}.insertMany`);
      return Promise.resolve(docs);
    }) as never) as unknown as Spy;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function validFile() {
  return {
    exportDate: '2026-10-01T00:00:00.000Z',
    version: '1.0',
    data: {
      bugs: [
        {
          id: '65f0c0ffee0000000000000a',
          prompt_context: 'context',
          model_response: 'response',
          model_used: 'model',
          issue_type: 'Logic',
          severity: 'Low',
          status: 'Open',
          user_notes: 'notes',
          is_public: false,
          created_at: '2026-09-01T10:00:00.000Z',
        },
      ],
      prompts: [
        {
          title: 'title',
          bad_prompt_example: 'bad',
          good_prompt_example: 'good',
          explanation: 'why',
          tags: ['one'],
          created_at: '2026-09-02T10:00:00.000Z',
        },
      ],
      testCases: [{ title: 'title', initial_prompt: 'prompt', category: 'cat', difficulty: 'easy' }],
      insights: [{ title: 'title', content: 'content', tags: [] }],
    },
  };
}

function post(body: unknown): NextRequest {
  return new Request('http://localhost/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/import: the is_public guard (D2)', () => {
  it('replace deletes only private rows: each filter is { user_id, is_public: { $ne: true } }', async () => {
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(200);
    for (const name of COLLECTIONS) {
      expect(deleteSpies[name]).toHaveBeenCalledTimes(1);
      expect(deleteSpies[name].mock.calls[0][0]).toEqual(PRIVATE_ONLY);
    }
  });

  it('an element claiming is_public: true and user_id: system is inserted private and owned by the caller', async () => {
    const file = validFile();
    for (const name of COLLECTIONS) {
      Object.assign(file.data[name][0], { is_public: true, user_id: 'system' });
    }
    const res = await POST(post({ data: file, mode: 'merge' }));
    expect(res.status).toBe(200);
    for (const name of COLLECTIONS) {
      expect(insertSpies[name]).toHaveBeenCalledTimes(1);
      const [doc] = insertSpies[name].mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(doc.is_public).toBe(false);
      expect(doc.user_id).toBe(USER);
    }
  });

  it.each(['system', 'user_'])('refuses the caller id %j with 400 and opens no DB connection', async (id) => {
    authMock.mockResolvedValue({ userId: id });
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(400);
    expect(dbConnectMock).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('answers 401 without a signed-in user and opens no DB connection', async () => {
    authMock.mockResolvedValue({ userId: null });
    const res = await POST(post({ data: validFile(), mode: 'replace' }));
    expect(res.status).toBe(401);
    expect(dbConnectMock).not.toHaveBeenCalled();
  });
});
