import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('analyses')
    .select('*, documents(title, page_count, status)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Conteo de veredictos por análisis, para el resumen de la lista.
  const { data: claims } = await supabase.from('analysis_claims').select('analysis_id, verdict');
  const counts = new Map<string, Record<string, number>>();
  for (const c of claims ?? []) {
    const bucket = counts.get(c.analysis_id) ?? {};
    bucket[c.verdict] = (bucket[c.verdict] ?? 0) + 1;
    counts.set(c.analysis_id, bucket);
  }

  return NextResponse.json({
    analyses: (data ?? []).map((a) => ({ ...a, verdict_counts: counts.get(a.id) ?? {} })),
  });
}

const createSchema = z.object({ documentId: z.string().uuid() });

/** Crea el análisis para un documento ya subido con kind='analysis'. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('analyses')
    .insert({ document_id: parsed.data.documentId })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ analysis: data });
}
