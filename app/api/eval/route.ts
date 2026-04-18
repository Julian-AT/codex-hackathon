import { NextResponse } from 'next/server';
import { runEval } from '@/lib/eval/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number };
    const limit =
      typeof body.limit === 'number' && body.limit > 0 && body.limit <= 70
        ? body.limit
        : undefined;
    const result = await runEval(limit);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message.slice(0, 400) },
      { status: 500 },
    );
  }
}
