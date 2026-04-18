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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type DemoTimelineEvent =
  | {
      at: number;
      kind: 'status';
      id: string;
      data: AgentStatus;
    }
  | {
      at: number;
      kind: 'notification';
      id: string;
      data: TaskNotification;
    }
  | {
      at: number;
      kind: 'train';
      data: TrainPoint;
    }
  | {
      at: number;
      kind: 'eval-pending';
      data: boolean;
    }
  | {
      at: number;
      kind: 'eval-result';
      data: EvalRunResult;
    }
  | {
      at: number;
      kind: 'adapter-pending';
      data: boolean;
    }
  | {
      at: number;
      kind: 'adapter-log';
      data: string;
    }
  | {
      at: number;
      kind: 'pipeline-status';
      data: 'ready' | 'submitted' | 'streaming' | 'error';
    };

function makeTrainSeries(): TrainPoint[] {
  const points: TrainPoint[] = [];
  for (let iter = 5; iter <= 60; iter += 5) {
    points.push({
      iter,
      loss: Number((1.92 - iter * 0.016 + (iter % 10 === 0 ? -0.03 : 0.02)).toFixed(4)),
    });
  }
  for (let iter = 65; iter <= 90; iter += 5) {
    points.push({
      iter,
      loss: Number((0.98 - (iter - 60) * 0.01).toFixed(4)),
      reward: Number((0.48 + (iter - 60) * 0.012).toFixed(4)),
    });
  }
  return points;
}

const DEMO_EVAL_RESULT: EvalRunResult = {
  itemCount: 70,
  source: 'demo-simulation',
  models: [
    {
      key: 'base',
      label: 'Base',
      available: true,
      score: 61.8,
      passed: 43,
      total: 70,
      latencyMs: 1280,
      notes: 'Strong generic baseline, weaker on tool precision',
    },
    {
      key: 'tuned',
      label: 'Tuned',
      available: true,
      score: 84.7,
      passed: 59,
      total: 70,
      latencyMs: 910,
      notes: 'Best specialist performance for the demo target',
    },
    {
      key: 'teacher',
      label: 'Teacher',
      available: true,
      score: 91.4,
      passed: 64,
      total: 70,
      latencyMs: 2260,
      notes: 'Frontier teacher ceiling',
    },
  ],
};

function buildDemoTimeline(productUrl: string): DemoTimelineEvent[] {
  const domain = productUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const timeline: DemoTimelineEvent[] = [
    {
      at: 150,
      kind: 'pipeline-status',
      data: 'streaming',
    },
    {
      at: 250,
      kind: 'status',
      id: 'coordinator',
      data: {
        role: 'coordinator',
        status: 'running',
        step: `planning specialist pipeline for ${domain}`,
        lastLine: 'spawnWorker fan-out initialized',
      },
    },
    {
      at: 450,
      kind: 'status',
      id: 'coordinator',
      data: {
        role: 'coordinator',
        status: 'running',
        step: 'fetch-corpus',
        lastLine: 'coordinating discovery and tool-design workers',
      },
    },
  ];

  const toolWorkers = Array.from({ length: 4 }, (_, i) => ({
    id: `tool-design-${i}`,
    at: 700 + i * 140,
    candidates: i === 2 ? 3 : 2,
  }));

  for (const worker of toolWorkers) {
    timeline.push({
      at: worker.at,
      kind: 'status',
      id: worker.id,
      data: {
        role: 'tool-design',
        status: 'running',
        step: 'generating',
        lastLine: `slice=${worker.id}`,
      },
    });
    timeline.push({
      at: worker.at + 1400,
      kind: 'status',
      id: worker.id,
      data: {
        role: 'tool-design',
        status: 'ok',
        step: `candidates=${worker.candidates}`,
        lastLine: 'worker completed',
      },
    });
  }

  const gates = [
    'supabase_rls_policy_explainer',
    'supabase_schema_browser',
    'supabase_migration_risk_checker',
    'supabase_sql_index_advisor',
    'supabase_auth_flow_debugger',
    'supabase_edge_function_auditor',
    'supabase_storage_policy_checker',
    'supabase_realtime_pattern_chooser',
  ];

  gates.forEach((toolName, index) => {
    timeline.push({
      at: 2500 + index * 120,
      kind: 'status',
      id: `gate:${toolName}`,
      data: {
        role: 'validator',
        status: 'ok',
        step: 'pass',
        lastLine: 'schema · parse · sandbox · fuzz · trajectory',
      },
    });
  });

  timeline.push(
    {
      at: 3550,
      kind: 'notification',
      id: 'manifest',
      data: {
        taskId: 'manifest',
        status: 'ok',
        summary: 'wrote 8 tools (swarm)',
      },
    },
    {
      at: 3720,
      kind: 'notification',
      id: 'coordinator',
      data: {
        taskId: 'coordinator',
        status: 'ok',
        summary: 'pipeline complete: 8 tools (swarm)',
      },
    },
  );

  const dataStages: Array<[string, string]> = [
    ['data-gen:corpus', 'corpus: train=148 eval=64'],
    ['data-gen:generation', 'generation: total=1696 (qa=512, traj=1184, rejected=54)'],
    ['data-gen:judging', 'judging: accepted=1442 rejected=254 disagreements=18'],
    ['data-gen:dedup-minhash', 'dedup-minhash: kept=1398/1442'],
    ['data-gen:dedup-cosine', 'dedup-cosine: kept=1344/1398'],
    ['data-gen:stratification', 'stratification: all tools >= 30 examples'],
    ['data-gen:emit-training', 'emit-training: 1344 examples'],
    ['data-gen:eval-gen', 'eval-gen: 70 items'],
    ['data-gen:emit-eval', 'emit-eval: 70 items'],
    ['data-gen:overlap-check', 'overlap-check: pass'],
  ];

  dataStages.forEach(([id, okStep], index) => {
    const at = 3950 + index * 260;
    const stageName = id.split(':')[1];
    timeline.push({
      at,
      kind: 'status',
      id,
      data: {
        role: 'data-gen',
        status: 'running',
        step: `${stageName}:`,
        lastLine: 'pipeline stage active',
      },
    });
    timeline.push({
      at: at + 180,
      kind: 'status',
      id,
      data: {
        role: 'data-gen',
        status: 'ok',
        step: okStep,
        lastLine: 'stage complete',
      },
    });
  });

  timeline.push({
    at: 6850,
    kind: 'notification',
    id: 'data-gen',
    data: {
      taskId: 'data-gen',
      status: 'ok',
      summary: 'Pipeline complete: 1344 training + 70 eval',
    },
  });

  makeTrainSeries().forEach((point, index) => {
    timeline.push({
      at: 7250 + index * 180,
      kind: 'train',
      data: point,
    });
  });

  timeline.push(
    {
      at: 7600,
      kind: 'adapter-pending',
      data: true,
    },
    {
      at: 7700,
      kind: 'adapter-log',
      data: '[fuse] selected latest checkpoint from ./data/adapters',
    },
    {
      at: 8050,
      kind: 'adapter-log',
      data: '[fuse] wrote adapter payload and adapter-tools.json bundle',
    },
    {
      at: 8450,
      kind: 'adapter-log',
      data: '[deploy-adapter] copy elapsed=3s',
    },
    {
      at: 8800,
      kind: 'adapter-log',
      data: '[deploy-adapter] wrote data/state/adapter-deploy.json',
    },
    {
      at: 9025,
      kind: 'adapter-pending',
      data: false,
    },
  );

  timeline.push(
    {
      at: 9150,
      kind: 'eval-pending',
      data: true,
    },
    {
      at: 10450,
      kind: 'eval-pending',
      data: false,
    },
    {
      at: 10475,
      kind: 'eval-result',
      data: DEMO_EVAL_RESULT,
    },
    {
      at: 10850,
      kind: 'pipeline-status',
      data: 'ready',
    },
  );

  return timeline.sort((a, b) => a.at - b.at);
}

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
  const [demoPipelineStatus, setDemoPipelineStatus] = useState<
    'ready' | 'submitted' | 'streaming' | 'error' | null
  >(null);
  const timersRef = useRef<number[]>([]);

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

  const clearDemoTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => clearDemoTimers, [clearDemoTimers]);

  const clearTrain = useCallback(() => {
    setTrain([]);
  }, []);

  const resetDemoSurface = useCallback(() => {
    clearDemoTimers();
    setAgents({});
    setNotifications({});
    setTrain([]);
    setEvalResult(null);
    setEvalError(null);
    setEvalPending(false);
    setAdapterPending(false);
    setAdapterLog([]);
    setAdapterError(null);
  }, [clearDemoTimers]);

  const schedule = useCallback(
    (delay: number, task: () => void) => {
      const timer = window.setTimeout(task, delay);
      timersRef.current.push(timer);
    },
    [],
  );

  const runDemoScenario = useCallback(
    (productUrl: string) => {
      resetDemoSurface();
      setDemoPipelineStatus('submitted');

      const timeline = buildDemoTimeline(productUrl);
      timeline.forEach((event) => {
        schedule(event.at, () => {
          switch (event.kind) {
            case 'pipeline-status':
              setDemoPipelineStatus(event.data);
              return;
            case 'status':
              setAgents((prev) => ({ ...prev, [event.id]: event.data }));
              return;
            case 'notification':
              setNotifications((prev) => ({ ...prev, [event.id]: event.data }));
              setAgents((prev) => ({
                ...prev,
                [event.id]: {
                  ...(prev[event.id] ?? { role: 'unknown' }),
                  status: event.data.status,
                  step: event.data.summary,
                  lastLine: event.data.summary,
                },
              }));
              return;
            case 'train':
              setTrain((prev) => [...prev, event.data]);
              return;
            case 'eval-pending':
              setEvalPending(event.data);
              return;
            case 'eval-result':
              setEvalResult(event.data);
              return;
            case 'adapter-pending':
              setAdapterPending(event.data);
              return;
            case 'adapter-log':
              setAdapterLog((prev) => [...prev.slice(-19), event.data]);
              return;
          }
        });
      });
    },
    [resetDemoSurface, schedule],
  );

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
    () => formatPipelineStatus(demoPipelineStatus ?? pipelineStatus),
    [demoPipelineStatus, pipelineStatus],
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
    runDemoScenario,
  };
}
