import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const createSchema = z.object({
  claimText: z.string().trim().min(10).max(2000),
  pageNumber: z.number().int().positive().nullable().optional(),
});

/** Añade una afirmación propia del analista, que se verificará como el resto. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { count } = await supabase
    .from('analysis_claims')
    .select('id', { count: 'exact', head: true })
    .eq('analysis_id', id);

  const { data, error } = await supabase
    .from('analysis_claims')
    .insert({
      analysis_id: id,
      claim_text: parsed.data.claimText,
      page_number: parsed.data.pageNumber ?? null,
      position: count ?? 0,
      verdict: 'pending',
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Queda pendiente -> el análisis vuelve a "verifying" para que el
  // siguiente tick la contraste contra la biblioteca.
  await supabase.from('analyses').update({ status: 'verifying', progress: 95 }).eq('id', id);

  return NextResponse.json({ claim: data });
}
