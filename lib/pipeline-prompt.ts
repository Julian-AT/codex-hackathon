/** User-facing prompt sent to `/api/pipeline` for coordinator runs. */

export function buildPipelinePrompt(productUrl: string): string {
  const u = productUrl.trim() || 'https://supabase.com';
  return [
    `Run the specialist pipeline for product URL: ${u}.`,
    'Coordinate discovery workers, tool-design workers, and data-generation workers as appropriate.',
    'Respect parallel read-only work and serialize training-related stages per orchestration rules.',
  ].join(' ');
}
