/**
 * Chat Lab history per model (D15). Client-safe: no imports.
 *
 * In Compare mode each model is sent the user's messages and only the replies it
 * produced itself, never another model's: one request per model, each with its
 * own list. Every list is then trimmed to the chat caps (trimChatHistory, D13),
 * so a turn is two messages in every list whatever the number of models.
 */

/** The line Chat Lab shows under the Compare picker. */
export const COMPARE_ISOLATION_TEXT = 'Each model sees your messages and only its own replies.';

/** A message as Chat Lab keeps it on screen. */
export interface StoredChatMessage {
  role: string;
  content: string;
  /**
   * Who produced a reply: a built-in provider key ('cohere', 'gemini', ...) or
   * 'custom:<provider id>' for a custom provider. Compare cards store the key
   * they asked; single mode stores the provider that answered (data.model).
   */
  model?: string;
  /** The bubble holds an error text (data.error, a failed request), not a reply. */
  isError?: boolean;
  /** A Compare card still waiting for its reply. */
  isLoading?: boolean;
}

/**
 * The history one model is sent, as { role, content }, in conversation order:
 *
 * - every user and system message;
 * - with a model key (Compare): only the assistant messages whose stored model
 *   is that key. A reply with no stored model is left out, since nothing says
 *   which model wrote it;
 * - with null (single mode): every assistant message, whoever produced it, as
 *   before D15 (single mode can switch models mid-chat and keeps one thread);
 * - never an error bubble or a card still loading, in either mode.
 */
export function historyForModel<T extends StoredChatMessage>(
  messages: readonly T[],
  modelKey: string | null
): Pick<T, 'role' | 'content'>[] {
  const out: Pick<T, 'role' | 'content'>[] = [];
  for (const message of messages) {
    if (message.role === 'assistant') {
      if (message.isError || message.isLoading) continue;
      if (modelKey !== null && message.model !== modelKey) continue;
    }
    out.push({ role: message.role, content: message.content });
  }
  return out;
}
