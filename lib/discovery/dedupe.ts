import type { DynamicToolSpec } from './types.js';

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[_-]/g, '');
}

export function dedupeByNormalizedName(specs: DynamicToolSpec[]): DynamicToolSpec[] {
  const seen = new Set<string>();
  const out: DynamicToolSpec[] = [];
  for (const s of specs) {
    const key = normalizeName(s.function.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
