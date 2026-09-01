import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { COVERS_BUCKET, DOCUMENTS_BUCKET, coverPathFor } from '@/lib/documents/constants';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*, documents(id, title, page_count, status)')
    .eq('id', id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!analysis) return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 });

  const { data: claims, error: claimsError } = await supabase
    .from('analysis_claims')
    .select('*')
    .eq('analysis_id', id)
    .order('position', { ascending: true });
  if (claimsError) return NextResponse.json({ error: claimsError.message }, { status: 500 });

  // Se filtra por analysis_id directo, no por una lista de claim_id: un
  // análisis largo tendría cientos de afirmaciones y la URL reventaría
  // (mismo bug que ya se corrigió en document_embeddings).
  const { data: sources, error: sourcesError } = await supabase
    .from('analysis_claim_sources')
    .select('*, documents(title)')
    .eq('analysis_id', id);
  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 });

  const byClaim = new Map<string, unknown[]>();
  for (const s of sources ?? []) {
    const list = byClaim.get(s.claim_id) ?? [];
    list.push(s);
    byClaim.set(s.claim_id, list);
  }

  return NextResponse.json({
    analysis,
    claims: (claims ?? []).map((c) => ({ ...c, sources: byClaim.get(c.id) ?? [] })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: analysis } = await supabase
    .from('analyses')
    .select('document_id, documents(storage_path)')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('analyses').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // El documento del analista solo existe para este análisis: se borra
  // junto con él, incluyendo sus archivos en Storage (si no, quedarían
  // huérfanos ocupando espacio para siempre).
  if (analysis?.document_id) {
    const storagePath = (analysis.documents as unknown as { storage_path?: string } | null)?.storage_path;
    if (storagePath) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    }
    await supabase.storage.from(COVERS_BUCKET).remove([coverPathFor(analysis.document_id)]);
    await supabase.from('documents').delete().eq('id', analysis.document_id);
  }

  return NextResponse.json({ success: true });
}
