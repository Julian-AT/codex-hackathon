// app/(demo)/page.tsx
// Demo page for the Phase 2 orchestrator harness.
// - Mounts AgentGrid fed by useDemoStream's `agents` map.
// - Mounts LossChart fed by useDemoStream's `train` array.
// - Header buttons fire the pipeline smoke (`sendMessage`) and train smoke
//   (`startTrain('sft', 20)`) respectively.
//
// Route note: this file lives in the `(demo)` route group, which does NOT
// add a path segment — so this page IS `/`. The Phase 1 `app/page.tsx` was
// removed in this plan to avoid a duplicate-route build error.

'use client';

import dynamic from 'next/dynamic';
import { useDemoStream } from './useDemoStream';
import { AgentGrid } from './AgentGrid';

const LossChart = dynamic(
  () => import('./LossChart').then((m) => m.LossChart),
  { ssr: false, loading: () => <div style={{ height: 320 }} /> },
);

export default function DemoPage() {
  const {
    agents,
    notifications,
    train,
    sendMessage,
    pipelineStatus,
    startTrain,
  } = useDemoStream();
  const notificationCount = Object.keys(notifications).length;

  return (
    <main
      style={{
        padding: 24,
        background: '#050505',
        color: '#f5f5f5',
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20 }}>Orchestrator Harness</h1>
        <span style={{ opacity: 0.6, fontSize: 12 }}>
          pipeline: {pipelineStatus} · workers: {Object.keys(agents).length}/20
          · notifications: {notificationCount}
        </span>
        <button
          onClick={() =>
            sendMessage({
              text: 'Launch 2 discovery workers named w1 and w2 in parallel.',
            })
          }
          style={{
            padding: '6px 12px',
            background: '#1e293b',
            color: '#f5f5f5',
            border: '1px solid #334155',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Smoke: 2 workers
        </button>
        <button
          onClick={() => startTrain('sft', 20)}
          style={{
            padding: '6px 12px',
            background: '#1e293b',
            color: '#f5f5f5',
            border: '1px solid #334155',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Smoke: SFT 20 iter
        </button>
      </header>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, opacity: 0.7, margin: '0 0 8px' }}>
          Agents (5 × 4)
        </h2>
        <AgentGrid agents={agents} />
      </section>

      <section>
        <h2 style={{ fontSize: 14, opacity: 0.7, margin: '0 0 8px' }}>
          Training loss / reward
        </h2>
        <LossChart points={train} />
      </section>
    </main>
  );
}
