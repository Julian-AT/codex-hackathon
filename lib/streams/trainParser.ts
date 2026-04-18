// lib/streams/trainParser.ts
// Pure line-to-TrainPoint parser for mlx_lm.lora / mlx_lm_lora.train stdout.
// PRD §10.5: SFT emits "Iter N: Train loss X"; GRPO emits "Iter N: Reward X".
// A5 fallback (02-RESEARCH): bare "loss: X" with sentinel iter=-1.

export type TrainPoint = {
  iter: number;
  loss?: number;
  reward?: number;
  aborted?: string;
};

const TRAIN_LOSS_RE = /Iter\s+(\d+):\s+Train loss\s+([\d.]+)/;
const REWARD_RE =
  /^Iter\s+(\d+):\s+Val loss\s+([\d.]+),\s+Val total_rewards_mean\s+([\d.]+)/;
const LOSS_FALLBACK_RE = /loss[:\s]+([\d.]+)/i;

export function parseTrainLine(line: string): TrainPoint | null {
  if (!line) return null;
  const t = line.match(TRAIN_LOSS_RE);
  if (t) return { iter: Number(t[1]), loss: Number(t[2]) };
  const r = line.match(REWARD_RE);
  if (r) return { iter: Number(r[1]), reward: Number(r[3]) };
  const f = line.match(LOSS_FALLBACK_RE);
  if (f) return { iter: -1, loss: Number(f[1]) };
  return null;
}
