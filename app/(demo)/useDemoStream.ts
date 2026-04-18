'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  buildDemoTimeline,
  formatPipelineStatus,
  type DemoPipelineStatus,
  type DemoTimelineEvent,
} from '@/app/(demo)/demoTimeline';
import {
  isAgentStatusPart,
  isTaskNotificationPart,
  type AgentStatus,
  type TaskNotification,
} from '@/lib/coordinator/taskNotification';
import type { EvalRunResult } from '@/lib/eval/types';
import { readJsonSseStream } from '@/lib/streams/sse';
import { isTrainStreamPart, type TrainPoint } from '@/lib/streams/trainParser';

const MAX_LOG_LINES = 20;

function pushLogEntry(entries: string[], line: string) {
  return [...entries.slice(-(MAX_LOG_LINES - 1)), line];
}

function notificationToAgent(
  previous: AgentStatus | undefined,
  notification: TaskNotification,
): AgentStatus {
  return {
    ...(previous ?? { role: 'unknown' }),
    status: notification.status,
    step: notification.summary,
    lastLine: notification.summary,
  };
}

function applyTimelineEvent(
  event: DemoTimelineEvent,
  handlers: {
    setAgents: React.Dispatch<React.SetStateAction<Record<string, AgentStatus>>>;
    setNotifications: React.Dispatch<
      React.SetStateAction<Record<string, TaskNotification>>
    >;
    setTrain: React.Dispatch<React.SetStateAction<TrainPoint[]>>;
    setEvalPending: React.Dispatch<React.SetStateAction<boolean>>;
    setEvalResult: React.Dispatch<React.SetStateAction<EvalRunResult | null>>;
    setAdapterPending: React.Dispatch<React.SetStateAction<boolean>>;
    setAdapterLog: React.Dispatch<React.SetStateAction<string[]>>;
    setPipelineStatus: React.Dispatch<
      React.SetStateAction<DemoPipelineStatus | null>
    >;
  },
) {
  switch (event.kind) {
    case 'pipeline-status':
      handlers.setPipelineStatus(event.data);
      return;
    case 'status':
      handlers.setAgents((previous) => ({ ...previous, [event.id]: event.data }));
      return;
    case 'notification':
      handlers.setNotifications((previous) => ({
        ...previous,
        [event.id]: event.data,
      }));
      handlers.setAgents((previous) => ({
        ...previous,
        [event.id]: notificationToAgent(previous[event.id], event.data),
      }));
      return;
    case 'train':
      handlers.setTrain((previous) => [...previous, event.data]);
      return;
    case 'eval-pending':
      handlers.setEvalPending(event.data);
      return;
    case 'eval-result':
      handlers.setEvalResult(event.data);
      return;
    case 'adapter-pending':
      handlers.setAdapterPending(event.data);
      return;
    case 'adapter-log':
      handlers.setAdapterLog((previous) => pushLogEntry(previous, event.data));
      return;
  }
}

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
  const [demoPipelineStatus, setDemoPipelineStatus] =
    useState<DemoPipelineStatus | null>(null);
  const timersRef = useRef<number[]>([]);

  const { sendMessage, status: pipelineStatus } = useChat({
    transport: new DefaultChatTransport({ api: '/api/pipeline' }),
    onData: (part) => {
      if (isAgentStatusPart(part)) {
        setAgents((previous) => ({ ...previous, [part.id]: part.data }));
        return;
      }

      if (isTaskNotificationPart(part)) {
        setNotifications((previous) => ({ ...previous, [part.id]: part.data }));
        setAgents((previous) => ({
          ...previous,
          [part.id]: notificationToAgent(previous[part.id], part.data),
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

  const schedule = useCallback((delay: number, task: () => void) => {
    const timer = window.setTimeout(task, delay);
    timersRef.current.push(timer);
  }, []);

  const runDemoScenario = useCallback(
    (productUrl: string) => {
      resetDemoSurface();
      setDemoPipelineStatus('submitted');

      const handlers = {
        setAgents,
        setNotifications,
        setTrain,
        setEvalPending,
        setEvalResult,
        setAdapterPending,
        setAdapterLog,
        setPipelineStatus: setDemoPipelineStatus,
      };

      for (const event of buildDemoTimeline(productUrl)) {
        schedule(event.at, () => applyTimelineEvent(event, handlers));
      }
    },
    [resetDemoSurface, schedule],
  );

  const startTrain = useCallback(async (mode: 'sft' | 'grpo', iters: number) => {
    const response = await fetch('/api/train', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, iters }),
    });

    if (!response.body) return;

    await readJsonSseStream(response.body, (payload) => {
      if (!isTrainStreamPart(payload)) return;
      setTrain((previous) => [...previous, payload.data]);
    });
  }, []);

  const startEval = useCallback(async (limit = 4) => {
    setEvalPending(true);
    setEvalError(null);

    try {
      const response = await fetch('/api/eval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limit }),
      });
      const body = (await response.json()) as EvalRunResult & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? `eval failed (${response.status})`);
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
        const response = await fetch('/api/adapter', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
        });

        if (!response.body) {
          throw new Error('missing adapter stream body');
        }

        await readJsonSseStream(response.body, (payload) => {
          if (isAgentStatusPart(payload) && payload.data.step) {
            setAdapterLog((previous) =>
              pushLogEntry(previous, String(payload.data.step)),
            );
            return;
          }

          if (!isTaskNotificationPart(payload)) return;

          const summary = payload.data.summary || 'adapter completed';
          setAdapterLog((previous) => pushLogEntry(previous, summary));

          if (payload.data.status === 'err') {
            setAdapterError(summary);
          }
        });
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
