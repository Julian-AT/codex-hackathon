import { describe, it, expect } from 'vitest';
import { checkStratification, extractToolNames } from './stratify';
import type { TrainingExample, ChatMessage, ToolCall } from './types';

function makeExample(toolName: string): TrainingExample {
  const tc: ToolCall = {
    id: 'tc-1',
    type: 'function',
    function: { name: toolName, arguments: '{}' },
  };
  const msgs: ChatMessage[] = [
    { role: 'user', content: 'test' },
    { role: 'assistant', content: 'ok', tool_calls: [tc] },
  ];
  return { messages: msgs, tools: [] };
}

describe('extractToolNames', () => {
  it('returns unique tool names from messages', () => {
    const ex = makeExample('supabase_rls_policy_template');
    expect(extractToolNames(ex)).toEqual(['supabase_rls_policy_template']);
  });
});

describe('checkStratification', () => {
  it('passes when all tools have >=30 examples', () => {
    const tools = ['toolA', 'toolB'];
    const examples = [
      ...Array.from({ length: 35 }, () => makeExample('toolA')),
      ...Array.from({ length: 30 }, () => makeExample('toolB')),
    ];
    const r = checkStratification(examples, tools, 30);
    expect(r.pass).toBe(true);
    expect(r.deficit).toEqual({});
  });

  it('fails when a tool has <30 examples and reports deficit', () => {
    const tools = ['toolA', 'toolB'];
    const examples = [
      ...Array.from({ length: 35 }, () => makeExample('toolA')),
      ...Array.from({ length: 10 }, () => makeExample('toolB')),
    ];
    const r = checkStratification(examples, tools, 30);
    expect(r.pass).toBe(false);
    expect(r.deficit['toolB']).toBe(20);
  });
});
