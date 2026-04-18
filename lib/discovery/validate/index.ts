import { validateSchema } from './schema.js';
import { validateParse } from './parse.js';
import { validateFuzz } from './fuzz.js';
import { validateTrajectories } from './trajectory.js';
import { runInSandbox } from './sandbox.js';
import type { DynamicToolSpec, ValidationResult } from '../types.js';

export async function validateTool(spec: DynamicToolSpec): Promise<ValidationResult> {
  // Gate 1: Schema well-formedness
  const schemaRes = validateSchema(spec.function.parameters);
  if (!schemaRes.pass) return schemaRes;

  // Gate 2: Parse + AST deny-list
  const parseRes = validateParse(spec.meta.jsBody);
  if (!parseRes.pass) return parseRes;

  // Gate 3: Sandbox smoke — invoke with empty args to verify no timeout/crash/OOM
  const sandboxSmoke = await runInSandbox(spec.meta.jsBody, {}, 2000);
  if (
    !sandboxSmoke.ok &&
    /timeout|timed out|exit|memory|resource|killed|terminated/i.test(sandboxSmoke.error ?? '')
  ) {
    return { pass: false, failedGate: 'sandbox', reason: sandboxSmoke.error };
  }
  // Non-fatal errors from an empty-args smoke are OK — many tools throw on empty args
  // (fuzz gate tolerates up to 0 throws with real schema-conforming inputs).

  // Gate 4: Fuzz — 10 schema-conforming inputs, 0 throws, >=8 serializable
  const fuzzRes = await validateFuzz(spec.meta.jsBody, spec.function.parameters);
  if (!fuzzRes.pass) return fuzzRes;

  // Gate 5: Trajectory — replay each stated trajectory, deep-equal compare
  const trajRes = await validateTrajectories(spec.meta.jsBody, spec.meta.trajectories);
  if (!trajRes.pass) return trajRes;

  return { pass: true };
}
