/**
 * Training data types for Phase 4 (Data + Eval Gen).
 * These mirror the OpenAI chat-completion fine-tuning format
 * used by mlx-lm SFT and GRPO.
 */

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON-encoded
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface TrainingExample {
  messages: ChatMessage[];
  tools: ToolDefinition[];
}
