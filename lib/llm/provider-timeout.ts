// The one provider deadline, in a module with no imports so that every caller can
// share it without pulling a provider SDK: the fallback engine (lib/llm/fallback.ts,
// which re-exports it), the custom-provider chat adapter (lib/llm/custom.ts) and the
// connection test (app/api/test-custom-provider/route.ts). The test and the chat must
// use the same value: Settings saves a provider only after a passing test, so a test
// shorter than the chat would refuse a provider the chat can use.

/**
 * Cap per attempt when the caller sets none. 20s, down from 30s (Batch E3): the
 * 2026-09-08 smoke showed a head that hung for the whole 30s Compare budget while
 * its sibling would have answered; a slow head now hands over instead.
 */
export const DEFAULT_PROVIDER_TIMEOUT_MS = 20000;
