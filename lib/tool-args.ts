/**
 * Tool call `arguments` normalization for generateObject + OpenAI structured outputs.
 *
 * OpenAI rejects Zod `z.record(z.string(), z.any())` (JSON Schema `additionalProperties`
 * without a `type`). Schemas use `z.string()` holding serialized JSON instead; this
 * helper accepts both JSON strings and plain objects (tests / mocks).
 */

export function normalizeToolArguments(
  raw: string | Record<string, unknown>,
): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw) as unknown;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
    } catch {
      /* invalid JSON */
    }
    return {};
  }
  return raw;
}

/** Serialize simulated tool return value for `role: tool` message content. */
export function toolResultToMessageContent(raw: string | unknown): string {
  if (typeof raw === 'string') return raw;
  return JSON.stringify(raw);
}

/** Parse trajectory tool result (JSON string or already-parsed). */
export function parseTrajectoryResult(raw: string | unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}
