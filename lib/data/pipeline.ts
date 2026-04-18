/**
 * Full Phase 4 pipeline orchestrator.
 * Stages: corpus -> split -> QA + Traj (parallel) -> judge -> MinHash dedup ->
 * cosine dedup -> stratify -> emit training.jsonl -> eval-gen -> emit eval.jsonl -> overlap check.
 *
 * Consumes all Wave 1+2 outputs and produces the two JSONL files Phase 5 reads.
 *
 * Plan 04-05, Task 2.
 */

import * as Sentry from '@sentry/nextjs';
import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DynamicToolSpec } from '../discovery/types.js';
import type { TrainingExample, DataGenMeta } from './types.js';
import { fetchCorpus } from '../discovery/corpus.js';
import { splitDocs } from './split.js';
import { generateQABatch } from './qa-worker.js';
import { generateTrajBatch } from './traj-worker.js';
import { judgeJury } from './judge.js';
import { dedupeByMinHash, dedupeByEmbedding } from './dedupe.js';
import { checkStratification } from './stratify.js';
import { generateEvalSet } from './eval-gen.js';
import {
  emitTrainingJsonl,
  emitEvalJsonl,
  verifyNoOverlap,
} from './emit-jsonl.js';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface PipelineEvent {
  stage: string;
  status: 'start' | 'ok' | 'err';
  detail?: string;
}

export interface PipelineOptions {
  onEvent?: (ev: PipelineEvent) => void;
  qaCounts?: number;
  trajCounts?: {
    singleTurn?: number;
    multiTurn?: number;
    parallelDep?: number;
    refusal?: number;
  };
  concurrency?: number;
}

export interface PipelineResult {
  generated: number;
  judged: { accepted: number; rejected: number; disagreements: number };
  deduped: { afterMinHash: number; afterCosine: number };
  stratification: { pass: boolean; deficit: Record<string, number> };
  training: { count: number; path: string };
  eval: { count: number; path: string };
  overlapCheck: { pass: boolean; overlap: string[] };
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                           */
/* ------------------------------------------------------------------ */

export async function runDataGenPipeline(
  opts: PipelineOptions = {},
): Promise<PipelineResult> {
  const { onEvent, concurrency = 15 } = opts;
  const emit = (
    stage: string,
    status: PipelineEvent['status'],
    detail?: string,
  ) => onEvent?.({ stage, status, detail });

  // 1. Load corpus + split
  emit('corpus', 'start');
  const corpus = await fetchCorpus();
  const { trainChunks, evalChunks } = splitDocs(corpus, { persist: true });
  emit(
    'corpus',
    'ok',
    `train=${trainChunks.length} eval=${evalChunks.length}`,
  );

  // 2. Load tools
  const manifest = JSON.parse(
    readFileSync(path.resolve('data/adapter-tools.json'), 'utf8'),
  );
  const tools: DynamicToolSpec[] = manifest.tools;
  const toolNames = tools.map((t) => t.function.name);

  // 3. Fan out QA + Traj workers in PARALLEL
  emit('generation', 'start');
  const [qaResult, trajResult] = await Promise.all([
    Sentry.startSpan(
      { op: 'ai.agent', name: 'data-gen-qa-batch' },
      () =>
        generateQABatch({
          trainChunks,
          tools,
          count: opts.qaCounts ?? 500,
          concurrency,
          onProgress: (done, total) =>
            emit('qa-gen', 'start', `${done}/${total}`),
        }),
    ),
    Sentry.startSpan(
      { op: 'ai.agent', name: 'data-gen-traj-batch' },
      () =>
        generateTrajBatch({
          trainChunks,
          tools,
          counts: opts.trajCounts,
          concurrency,
          onProgress: (done, total, type) =>
            emit(`traj-gen-${type}`, 'start', `${done}/${total}`),
        }),
    ),
  ]);
  const allExamples = [...qaResult.examples, ...trajResult.examples];
  const allMeta = [...qaResult.meta, ...trajResult.meta];
  emit(
    'generation',
    'ok',
    `total=${allExamples.length} (qa=${qaResult.examples.length}, traj=${trajResult.examples.length}, rejected=${qaResult.rejected + trajResult.rejected})`,
  );

  // 4. Judge-jury filter (DAT-04 + DAT-05)
  emit('judging', 'start');
  const juryResult = await Sentry.startSpan(
    { op: 'ai.agent', name: 'judge-jury' },
    () => judgeJury(allExamples, { concurrency }),
  );
  emit(
    'judging',
    'ok',
    `accepted=${juryResult.accepted.length} rejected=${juryResult.rejected.length} disagreements=${juryResult.disagreements.length}`,
  );

  // 5. MinHash dedup (DAT-06 -- threshold 0.7)
  emit('dedup-minhash', 'start');
  const textForDedup = juryResult.accepted.map((ex, i) => ({
    id: String(i),
    text: ex.messages.map((m) => m.content).join(' '),
  }));
  const minHashKeepIds = dedupeByMinHash(textForDedup, 0.7);
  const afterMinHash = juryResult.accepted.filter((_, i) =>
    minHashKeepIds.includes(String(i)),
  );
  emit(
    'dedup-minhash',
    'ok',
    `kept=${afterMinHash.length}/${juryResult.accepted.length}`,
  );

  // 6. Cosine dedup (DAT-06 -- threshold 0.92)
  emit('dedup-cosine', 'start');
  const textsToEmbed = afterMinHash.map((ex, i) => ({
    id: String(i),
    text: ex.messages
      .map((m) => m.content)
      .join(' ')
      .slice(0, 8000), // truncate for embedding
  }));
  // Batch embeddings (max 2048 per call)
  const batchSize = 2048;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < textsToEmbed.length; i += batchSize) {
    const batch = textsToEmbed.slice(i, i + batchSize);
    const { embeddings } = await embedMany({
      model: openai.embedding('text-embedding-3-small'),
      values: batch.map((t) => t.text),
    });
    allEmbeddings.push(...embeddings);
  }
  const embeddingItems = textsToEmbed.map((t, i) => ({
    id: t.id,
    embedding: allEmbeddings[i],
  }));
  const cosineKeepIds = dedupeByEmbedding(embeddingItems, 0.92);
  const afterCosine = afterMinHash.filter((_, i) =>
    cosineKeepIds.includes(String(i)),
  );
  emit(
    'dedup-cosine',
    'ok',
    `kept=${afterCosine.length}/${afterMinHash.length}`,
  );

  // 7. Stratification check (DAT-07 -- >=30 per tool)
  emit('stratification', 'start');
  const stratResult = checkStratification(afterCosine, toolNames, 30);
  emit(
    'stratification',
    stratResult.pass ? 'ok' : 'err',
    stratResult.pass
      ? 'all tools >= 30 examples'
      : `deficit: ${JSON.stringify(stratResult.deficit)}`,
  );

  // 8. Emit training.jsonl (DAT-08 kill-point)
  emit('emit-training', 'start');
  await emitTrainingJsonl(afterCosine);
  emit('emit-training', 'ok', `${afterCosine.length} examples`);

  // 9. Generate eval set (DAT-10)
  emit('eval-gen', 'start');
  const evalItems = await Sentry.startSpan(
    { op: 'ai.agent', name: 'eval-gen' },
    () => generateEvalSet({ evalChunks, tools, concurrency }),
  );
  emit('eval-gen', 'ok', `${evalItems.length} items`);

  // 10. Emit eval.jsonl
  emit('emit-eval', 'start');
  await emitEvalJsonl(evalItems);
  emit('emit-eval', 'ok', `${evalItems.length} items`);

  // 11. Hash-verified no-overlap (DAT-09)
  emit('overlap-check', 'start');
  // Build sourceChunks for surviving examples by tracking through dedup
  const survivingMeta: DataGenMeta[] = [];
  const minHashKeepSet = new Set(minHashKeepIds);
  const cosineKeepSet = new Set(cosineKeepIds);
  // allMeta[i] corresponds to allExamples[i]; accepted examples are a subset
  // We need to track meta for the examples that survived judging, then MinHash, then cosine
  let acceptedIdx = 0;
  for (let i = 0; i < allExamples.length; i++) {
    // Check if this example was accepted by the jury
    if (
      acceptedIdx < juryResult.accepted.length &&
      juryResult.accepted[acceptedIdx] === allExamples[i]
    ) {
      // Check if it survived MinHash
      if (minHashKeepSet.has(String(acceptedIdx))) {
        // Find its position in afterMinHash
        const minHashPos = minHashKeepIds.indexOf(String(acceptedIdx));
        if (minHashPos >= 0 && cosineKeepSet.has(String(minHashPos))) {
          survivingMeta.push(allMeta[i]);
        }
      }
      acceptedIdx++;
    }
  }
  const trainingSourceChunks = survivingMeta.map((m) => m.sourceChunks);
  const evalChunkIds = evalChunks.map((c) => c.id);
  const overlapResult = await verifyNoOverlap(
    trainingSourceChunks,
    evalChunkIds,
  );
  if (!overlapResult.pass) {
    emit(
      'overlap-check',
      'err',
      `OVERLAP DETECTED: ${overlapResult.overlap.join(', ')}`,
    );
  } else {
    emit('overlap-check', 'ok', 'no overlap');
  }

  return {
    generated: allExamples.length,
    judged: {
      accepted: juryResult.accepted.length,
      rejected: juryResult.rejected.length,
      disagreements: juryResult.disagreements.length,
    },
    deduped: {
      afterMinHash: afterMinHash.length,
      afterCosine: afterCosine.length,
    },
    stratification: { pass: stratResult.pass, deficit: stratResult.deficit },
    training: { count: afterCosine.length, path: 'data/training.jsonl' },
    eval: { count: evalItems.length, path: 'data/eval.jsonl' },
    overlapCheck: overlapResult,
  };
}
