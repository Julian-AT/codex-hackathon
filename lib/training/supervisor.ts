import type { TrainPoint } from '@/lib/streams/trainParser';
import { rollbackToLatestCheckpoint } from '@/lib/training/rollback';

export type SupervisorSignal =
	| { kind: 'continue' }
	| { kind: 'rollback'; reason: 'nan' | 'spike'; nextRollbackIndex: number }
	| { kind: 'abort'; reason: 'nan.unrecoverable' | 'spike.unrecoverable' }
	| { kind: 'grpo.collapsed'; reason: 'variance' | 'skipped' };

const NAN_THRESHOLD = 2;
const SPIKE_MULTIPLIER = 10;
const WARMUP_ITERS = 20;
const MAX_ROLLBACKS = 2;
const VARIANCE_WINDOW = 10;
const VARIANCE_FLOOR = 0.01;

export class TrainSupervisor {
	private nanCount = 0;
	private emaLoss: number | null = null;
	private rollbacks = 0;
	private rewards: number[] = [];

	ingest(pt: TrainPoint): SupervisorSignal {
		if (pt.reward !== undefined && Number.isFinite(pt.reward)) {
			this.rewards.push(pt.reward);
			if (this.rewards.length > VARIANCE_WINDOW) this.rewards.shift();
			if (this.rewards.length === VARIANCE_WINDOW) {
				const mean = this.rewards.reduce((sum, reward) => sum + reward, 0) / VARIANCE_WINDOW;
				const variance =
					this.rewards.reduce((sum, reward) => sum + (reward - mean) ** 2, 0) / VARIANCE_WINDOW;
				if (variance < VARIANCE_FLOOR) {
					return { kind: 'grpo.collapsed', reason: 'variance' };
				}
			}
		}

		if (pt.loss === undefined) {
			return { kind: 'continue' };
		}

		const bad = Number.isNaN(pt.loss) || !Number.isFinite(pt.loss);
		if (bad) {
			this.nanCount += 1;
			if (this.nanCount >= NAN_THRESHOLD) {
				return this.escalate('nan');
			}
			return { kind: 'continue' };
		}

		this.nanCount = 0;

		if (
			this.emaLoss !== null &&
			pt.iter > WARMUP_ITERS &&
			pt.loss > this.emaLoss * SPIKE_MULTIPLIER
		) {
			return this.escalate('spike');
		}

		this.emaLoss = this.emaLoss === null ? pt.loss : 0.9 * this.emaLoss + 0.1 * pt.loss;
		return { kind: 'continue' };
	}

	ingestRawLine(line: string): SupervisorSignal {
		if (line.startsWith('grpo.skipped')) {
			return { kind: 'grpo.collapsed', reason: 'skipped' };
		}
		return { kind: 'continue' };
	}

	async performRollback(adapterDir: string): Promise<number> {
		const iter = await rollbackToLatestCheckpoint(adapterDir);
		this.rollbacks += 1;
		this.nanCount = 0;
		this.emaLoss = null;
		this.rewards = [];
		return iter;
	}

	private escalate(reason: 'nan' | 'spike'): SupervisorSignal {
		if (this.rollbacks >= MAX_ROLLBACKS) {
			return {
				kind: 'abort',
				reason: reason === 'nan' ? 'nan.unrecoverable' : 'spike.unrecoverable',
			};
		}
		return {
			kind: 'rollback',
			reason,
			nextRollbackIndex: this.rollbacks + 1,
		};
	}
}
