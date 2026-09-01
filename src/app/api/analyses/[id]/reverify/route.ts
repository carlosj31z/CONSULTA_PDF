import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Re-contrasta TODO el análisis contra la biblioteca actual, conservando
 * las afirmaciones (y las notas/veredictos del analista). Pensado para
 * cuando se agregan documentos nuevos a la biblioteca.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: claims, error } = await supabase
    .from('analysis_claims')
    .select('id')
    .eq('analysis_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if ((claims ?? []).length === 0) {
    return NextResponse.json({ error: 'El análisis no tiene afirmaciones que verificar' }, { status: 400 });
  }

  await supabase
    .from('analysis_claims')
    .update({ verdict: 'pending', explanation: null, confidence: null })
    .eq('analysis_id', id);

  // Se borra por analysis_id, no por una lista de claim_id: con cientos
  // de afirmaciones esa lista superaría el límite de longitud de la URL.
  await supabase.from('analysis_claim_sources').delete().eq('analysis_id', id);

  await supabase
    .from('analyses')
    .update({ status: 'verifying', progress: 45, error_message: null, retry_count: 0 })
    .eq('id', id);

  return NextResponse.json({ success: true, claims: (claims ?? []).length });
}
