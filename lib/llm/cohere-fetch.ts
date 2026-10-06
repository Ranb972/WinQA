// Test-only seam for the Cohere wire contract (lib/llm/cohere.contract.test.ts, Batch H
// H15). The chat adapter (lib/llm/cohere.ts) and the key test (app/api/test-key/route.ts)
// hand this fetch to `new CohereClient({ token, fetch })` when one is set, so the
// contract test records the exact request the SDK sends and scripts the response.
// Production never sets it: unset, both build the client exactly as before (the SDK's
// own fetch, no other option changed). A separate module because a route file may
// export only route fields, and because the key test keeps cohere-ai on a dynamic
// import (this file imports nothing from it).

/** The `fetch` option of CohereClient (`typeof fetch` in cohere-ai 7.x and 8.x). */
export type CohereFetch = typeof fetch;

let fetchForTests: CohereFetch | undefined;

/** Tests only. Pass undefined to restore the SDK default. */
export function setCohereFetchForTests(fetchImpl: CohereFetch | undefined): void {
  fetchForTests = fetchImpl;
}

/** The fetch a test installed, or undefined (always, in production). */
export function cohereFetchForTests(): CohereFetch | undefined {
  return fetchForTests;
}
