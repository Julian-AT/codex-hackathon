import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { EvalItem, ToolCall } from '@/lib/data/types';
import type { EvalRunResult, EvalSummary } from './types';

type ModelResponse = {
  text: string;
  toolCalls?: ToolCall[];
};

type EndpointConfig = {
  url?: string;
  label: string;
};

const EVAL_JSONL = path.resolve('data/eval.jsonl');

async function loadEvalItems(limit?: number): Promise<EvalItem[]> {
  const content = await readFile(EVAL_JSONL, 'utf8');
  const rows = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EvalItem);
  return typeof limit === 'number' && limit > 0 ? rows.slice(0, limit) : rows;
}

function normalizeText(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s@().:/-]/g, '');
}

function tryParseArgs(serialized: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    return serialized;
  }
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${key}:${canonicalize(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function scoreItem(item: EvalItem, response: ModelResponse): boolean {
  if (item.expectedToolCalls?.length) {
    const actual = response.toolCalls ?? [];
    if (actual.length !== item.expectedToolCalls.length) return false;
    return item.expectedToolCalls.every((expected, index) => {
      const got = actual[index];
      if (!got) return false;
      return (
        expected.function.name === got.function.name &&
        canonicalize(tryParseArgs(expected.function.arguments)) ===
          canonicalize(tryParseArgs(got.function.arguments))
      );
    });
  }

  const expected = normalizeText(item.expected);
  const got = normalizeText(response.text);
  return Boolean(expected) && Boolean(got) && (got === expected || got.includes(expected));
}

async function queryEndpoint(
  endpoint: string,
  prompt: string,
): Promise<ModelResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    throw new Error(`endpoint ${endpoint} -> ${res.status}`);
  }
  const body = (await res.json()) as Partial<ModelResponse>;
  return {
    text: typeof body.text === 'string' ? body.text : '',
    toolCalls: body.toolCalls,
  };
}

async function queryTeacher(prompt: string): Promise<ModelResponse> {
  const modelId = process.env.EVAL_TEACHER_MODEL || 'claude-opus-4-5';
  const { text } = await generateText({
    model: anthropic(modelId),
    prompt,
    temperature: 0,
  });
  return { text };
}

async function evaluateEndpointModel(
  items: EvalItem[],
  config: EndpointConfig,
): Promise<EvalSummary> {
  if (!config.url) {
    return {
      key: config.label === 'Base' ? 'base' : 'tuned',
      label: config.label,
      available: false,
      score: null,
      passed: 0,
      total: items.length,
      latencyMs: null,
      notes: 'Missing endpoint URL',
    };
  }

  let passed = 0;
  let totalLatency = 0;
  for (const item of items) {
    const started = performance.now();
    const result = await queryEndpoint(config.url, item.prompt);
    totalLatency += performance.now() - started;
    if (scoreItem(item, result)) passed += 1;
  }

  return {
    key: config.label === 'Base' ? 'base' : 'tuned',
    label: config.label,
    available: true,
    score: items.length ? (passed / items.length) * 100 : 0,
    passed,
    total: items.length,
    latencyMs: items.length ? Math.round(totalLatency / items.length) : null,
  };
}

async function evaluateTeacher(items: EvalItem[]): Promise<EvalSummary> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      key: 'teacher',
      label: 'Teacher',
      available: false,
      score: null,
      passed: 0,
      total: items.length,
      latencyMs: null,
      notes: 'Missing ANTHROPIC_API_KEY',
    };
  }

  let passed = 0;
  let totalLatency = 0;
  for (const item of items) {
    const started = performance.now();
    const result = await queryTeacher(item.prompt);
    totalLatency += performance.now() - started;
    if (scoreItem(item, result)) passed += 1;
  }

  return {
    key: 'teacher',
    label: 'Teacher',
    available: true,
    score: items.length ? (passed / items.length) * 100 : 0,
    passed,
    total: items.length,
    latencyMs: items.length ? Math.round(totalLatency / items.length) : null,
  };
}

export async function runEval(limit?: number): Promise<EvalRunResult> {
  const items = await loadEvalItems(limit);
  const [base, tuned, teacher] = await Promise.all([
    evaluateEndpointModel(items, {
      url: process.env.EVAL_BASE_URL,
      label: 'Base',
    }),
    evaluateEndpointModel(items, {
      url: process.env.EVAL_TUNED_URL,
      label: 'Tuned',
    }),
    evaluateTeacher(items),
  ]);

  return {
    itemCount: items.length,
    source: EVAL_JSONL,
    models: [base, tuned, teacher],
  };
}
