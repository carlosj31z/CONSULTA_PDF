import { NextResponse } from 'next/server';
import { processNextAnalysisBatch } from '@/lib/analysis/pipeline';

/** Avanza un lote del análisis pendiente. Se llama repetidamente desde la UI. */
export async function POST() {
  try {
    const result = await processNextAnalysisBatch();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
