import type { ClientOptions } from 'groq-sdk';

// Test-only seam for the Groq wire contract (lib/llm/groq.contract.test.ts, Batch H
// H13). The chat adapter (lib/llm/groq.ts) and the key test (app/api/test-key/route.ts)
// hand this fetch to `new Groq({ apiKey, fetch })` when one is set, so the contract
// test records the exact request the SDK sends and scripts the response. Production
// never sets it: unset, both build the client exactly as before (the SDK's own fetch,
// no other option changed). A separate module because a route file may export only
// route fields, and because the key test keeps groq-sdk on a dynamic import (this
// file imports a type only).

export type GroqFetch = NonNullable<ClientOptions['fetch']>;

let fetchForTests: GroqFetch | undefined;

/** Tests only. Pass undefined to restore the SDK default. */
export function setGroqFetchForTests(fetchImpl: GroqFetch | undefined): void {
  fetchForTests = fetchImpl;
}

/** The fetch a test installed, or undefined (always, in production). */
export function groqFetchForTests(): GroqFetch | undefined {
  return fetchForTests;
}
