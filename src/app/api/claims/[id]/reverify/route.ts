import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Vuelve a contrastar una afirmación contra la biblioteca. Útil tras subir
 * documentos nuevos: la evidencia disponible cambió, el veredicto puede
 * cambiar también.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: claim, error } = await supabase
    .from('analysis_claims')
    .select('analysis_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!claim) return NextResponse.json({ error: 'Afirmación no encontrada' }, { status: 404 });

  await supabase
    .from('analysis_claims')
    .update({ verdict: 'pending', explanation: null, confidence: null })
    .eq('id', id);
  await supabase.from('analysis_claim_sources').delete().eq('claim_id', id);
  await supabase
    .from('analyses')
    .update({ status: 'verifying', progress: 95, error_message: null, retry_count: 0 })
    .eq('id', claim.analysis_id);

  return NextResponse.json({ success: true });
}
