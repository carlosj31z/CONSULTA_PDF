import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const patchSchema = z.object({
  claim_text: z.string().trim().min(10).max(2000).optional(),
  user_verdict: z.enum(['supported', 'refuted', 'partial', 'not_found']).nullable().optional(),
  user_note: z.string().max(4000).nullable().optional(),
});

/**
 * Edita una afirmación. Si cambia el texto, el veredicto automático deja de
 * ser válido: se marca como 'pending' para que se vuelva a contrastar.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };

  let needsReverify = false;
  if (parsed.data.claim_text !== undefined) {
    const { data: existing } = await supabase
      .from('analysis_claims')
      .select('claim_text')
      .eq('id', id)
      .maybeSingle();
    if (existing && existing.claim_text !== parsed.data.claim_text) {
      update.verdict = 'pending';
      update.explanation = null;
      update.confidence = null;
      needsReverify = true;
    }
  }

  const { data, error } = await supabase
    .from('analysis_claims')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Afirmación no encontrada' }, { status: 404 });

  if (needsReverify) {
    await supabase.from('analysis_claim_sources').delete().eq('claim_id', id);
    await supabase
      .from('analyses')
      .update({ status: 'verifying', progress: 95 })
      .eq('id', data.analysis_id);
  }

  return NextResponse.json({ claim: data, reverifying: needsReverify });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('analysis_claims').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
