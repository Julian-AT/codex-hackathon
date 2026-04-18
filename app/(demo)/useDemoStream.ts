// app/(demo)/useDemoStream.ts
// Shared stream-to-state hook for the demo page.
//
// Routes the two stream sources used in Phase 2:
//   - /api/pipeline  -> useChat({onData}) routes:
//       data-agent-status      (transient)  -> agents map  (per worker id)
//       data-task-notification (persistent) -> notifications map; status promoted onto agents
//   - /api/train     -> raw fetch + SSE reader -> train[] (TrainPoint[])
//
// API surface notes (AI SDK v6.0.168 + @ai-sdk/react 3.0.170):
//   - useChat is exported from '@ai-sdk/react' (v6 moved hooks out of the 'ai' root).
//   - useChat takes `transport`, not a top-level `api` field. We construct
//     `new DefaultChatTransport({api: '/api/pipeline'})` to point the hook at our route.
//   - sendMessage({ text }) sends a single user message and opens the stream.

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { TrainPoint } from '@/lib/streams/trainParser';
import type { EvalRunResult } from '@/lib/eval/types';

export function formatPipelineStatus(status: string): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'streaming':
      return 'Streaming';
    case 'submitted':
      return 'Submitted';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

export type AgentStatus = {
  role: string;
  status: 'running' | 'ok' | 'err' | 'timeout';
  step?: string;
  lastLine?: string;
};
export type TaskNotification = {
  taskId: string;
  status: 'ok' | 'err' | 'timeout';
  summary: string;
  result?: string;
  usage?: unknown;
};

// Stream part shape contracts (mirrors lib/coordinator/taskNotification.ts).
//   data-agent-status      -> { type, id, data: AgentStatus, transient: true }
//   data-task-notification -> { type, id, data: TaskNotification, transient: false }
//   data-train             -> { type, data: TrainPoint, transient: true }

export function useDemoStream() {
  const [agents, setAgents] = useState<Record<string, AgentStatus>>({});
  const [notifications, setNotifications] = useState<
    Record<string, TaskNotification>
  >({});
  const [train, setTrain] = useState<TrainPoint[]>([]);
  const [evalResult, setEvalResult] = useState<EvalRunResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalPending, setEvalPending] = useState(false);
  const [adapterPending, setAdapterPending] = useState(false);
  const [adapterLog, setAdapterLog] = useState<string[]>([]);
  const [adapterError, setAdapterError] = useState<string | null>(null);

  const { sendMessage, status: pipelineStatus } = useChat({
    transport: new DefaultChatTransport({ api: '/api/pipeline' }),
    // onData fires for every typed data part on the stream — route by type.
    onData: (part: { type: string; id?: string; data?: unknown }) => {
      if (part.type === 'data-agent-status' && part.id) {
        setAgents((p) => ({ ...p, [part.id!]: part.data as AgentStatus }));
      } else if (part.type === 'data-task-notification' && part.id) {
        const n = part.data as TaskNotification;
        const id = part.id;
        setNotifications((p) => ({ ...p, [id]: n }));
        // Promote terminal status onto agents map so the card flips green/red.
        setAgents((p) => ({
          ...p,
          [id]: { ...(p[id] ?? { role: 'unknown' }), status: n.status },
        }));
      }
    },
  });

  const clearTrain = useCallback(() => {
    setTrain([]);
  }, []);

  const startTrain = useCallback(async (mode: 'sft' | 'grpo', iters: number) => {
    const res = await fetch('/api/train', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, iters }),
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const obj = JSON.parse(payload);
          if (obj?.type === 'data-train' && obj.data) {
            setTrain((p) => [...p, obj.data as TrainPoint]);
          }
        } catch {
          /* ignore malformed SSE frames */
        }
      }
    }
  }, []);

  const startEval = useCallback(async (limit = 4) => {
    setEvalPending(true);
    setEvalError(null);
    try {
      const res = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limit }),
      });
      const body = (await res.json()) as EvalRunResult & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `eval failed (${res.status})`);
      }
      setEvalResult(body);
    } catch (error) {
      setEvalError(error instanceof Error ? error.message : 'eval failed');
    } finally {
      setEvalPending(false);
    }
  }, []);

  const runAdapterAction = useCallback(
    async (action: 'fuse' | 'deploy' | 'fuse-and-deploy') => {
      setAdapterPending(true);
      setAdapterError(null);
      setAdapterLog([]);
      try {
        const res = await fetch('/api/adapter', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (!res.body) throw new Error('missing adapter stream body');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const obj = JSON.parse(payload);
              if (obj?.type === 'data-agent-status' && obj.data?.step) {
                setAdapterLog((prev) => [...prev.slice(-19), String(obj.data.step)]);
              }
              if (obj?.type === 'data-task-notification') {
                const summary = obj.data?.summary ? String(obj.data.summary) : 'adapter completed';
                setAdapterLog((prev) => [...prev.slice(-19), summary]);
                if (obj.data?.status === 'err') {
                  setAdapterError(summary);
                }
              }
            } catch {
              /* ignore malformed SSE */
            }
          }
        }
      } catch (error) {
        setAdapterError(
          error instanceof Error ? error.message : 'adapter action failed',
        );
      } finally {
        setAdapterPending(false);
      }
    },
    [],
  );

  const pipelineStatusDisplay = useMemo(
    () => formatPipelineStatus(pipelineStatus),
    [pipelineStatus],
  );

  return {
    agents,
    notifications,
    train,
    sendMessage,
    pipelineStatus,
    pipelineStatusDisplay,
    clearTrain,
    startTrain,
    evalResult,
    evalError,
    evalPending,
    startEval,
    adapterPending,
    adapterLog,
    adapterError,
    runAdapterAction,
  };
}
