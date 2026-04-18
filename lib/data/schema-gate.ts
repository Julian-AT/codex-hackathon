import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv, { type ValidateFunction } from 'ajv';

const MANIFEST_PATH = path.resolve('data/adapter-tools.json');

let _validators: Map<string, ValidateFunction> | null = null;

export function loadToolSchemas(): Map<string, ValidateFunction> {
  if (_validators) return _validators;
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  _validators = new Map();
  for (const tool of raw.tools) {
    const name = tool.function.name;
    const schema = tool.function.parameters;
    _validators.set(name, ajv.compile(schema));
  }
  return _validators;
}

export function validateToolCall(
  toolName: string,
  args: Record<string, unknown>,
): { valid: boolean; errors?: string[] } {
  const validators = loadToolSchemas();
  const validate = validators.get(toolName);
  if (!validate) return { valid: false, errors: [`unknown tool: ${toolName}`] };
  const ok = validate(args);
  if (ok) return { valid: true };
  return {
    valid: false,
    errors: (validate.errors ?? []).map(
      (e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`,
    ),
  };
}

/** Reset cached validators -- for testing only. */
export function _resetCache(): void {
  _validators = null;
}
