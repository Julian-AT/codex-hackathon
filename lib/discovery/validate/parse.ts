import * as acorn from 'acorn';
import type { ValidationResult } from '../types';

export const BANNED_IDENTIFIERS = new Set([
  'fetch', 'require', 'import', 'process', 'globalThis', 'eval', 'Function', 'crypto', 'performance',
]);

// member-access deny pairs: [object, property]
const BANNED_MEMBER: ReadonlyArray<readonly [string, string]> = [
  ['Math', 'random'],
  ['Date', 'now'],
  ['constructor', 'constructor'],
] as const;

export function validateParse(jsBody: string): ValidationResult {
  let ast: acorn.Node;
  try {
    ast = acorn.parse(jsBody, { ecmaVersion: 2022, sourceType: 'script' });
  } catch (err) {
    return {
      pass: false,
      failedGate: 'parse',
      reason: `acorn: ${(err as Error).message}`.slice(0, 400),
    };
  }

  // Walk AST looking for banned identifiers and member accesses
  let banned: string | null = null;

  const visit = (node: any) => {
    if (!node || typeof node !== 'object' || banned) return;
    if (node.type === 'Identifier' && BANNED_IDENTIFIERS.has(node.name)) {
      banned = `banned identifier: ${node.name}`;
      return;
    }
    if (node.type === 'MemberExpression') {
      const obj = node.object?.name ?? node.object?.property?.name;
      const prop = node.property?.name;
      for (const [o, p] of BANNED_MEMBER) {
        if (obj === o && prop === p) {
          banned = `banned access: ${o}.${p}`;
          return;
        }
      }
    }
    for (const k of Object.keys(node)) {
      const v = (node as any)[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object' && 'type' in v) visit(v);
    }
  };

  visit(ast as any);

  if (banned) return { pass: false, failedGate: 'parse', reason: banned };
  return { pass: true };
}
