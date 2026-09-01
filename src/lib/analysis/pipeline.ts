import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { extractClaimsFromPages } from './extract-claims';
import { verifyClaim } from './verify-claim';
import type { AnalysisRow } from '@/types/database';

const PAGES_PER_EXTRACTION_BATCH = 6;
const CLAIMS_PER_VERIFY_BATCH = 3;
const MAX_RETRIES = 60;

export type AnalysisTickResult =
  | { processed: false }
  | { processed: true; analysisId: string; stage: string; done: boolean; error?: string };

/**
 * Avanza un lote de trabajo de UN análisis pendiente y devuelve. Mismo
 * patrón que la ingesta: llamadas cortas y reanudables, para que una
 * cuota agotada o un corte no obliguen a empezar de cero.
 */
export async function processNextAnalysisBatch(): Promise<AnalysisTickResult> {
  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from('analyses')
    .select('*')
    .in('status', ['pending', 'extracting_claims', 'verifying'])
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);

  const analysis = rows?.[0] as AnalysisRow | undefined;
  if (!analysis) return { processed: false };

  try {
    const done = await runStage(analysis);
    return { processed: true, analysisId: analysis.id, stage: analysis.status, done };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryCount = analysis.retry_count + 1;
    if (retryCount >= MAX_RETRIES) {
      await supabase
        .from('analyses')
        .update({ status: 'error', error_message: message, retry_count: retryCount })
        .eq('id', analysis.id);
    } else {
      await supabase
        .from('analyses')
        .update({ retry_count: retryCount, error_message: message })
        .eq('id', analysis.id);
    }
    return { processed: true, analysisId: analysis.id, stage: analysis.status, done: false, error: message };
  }
}

async function runStage(analysis: AnalysisRow): Promise<boolean> {
  switch (analysis.status) {
    case 'pending':
      return startAnalysis(analysis);
    case 'extracting_claims':
      return extractBatch(analysis);
    case 'verifying':
      return verifyBatch(analysis);
    default:
      throw new Error(`Etapa de análisis desconocida: ${analysis.status}`);
  }
}

async function startAnalysis(analysis: AnalysisRow): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // El texto del documento del analista lo produce el pipeline de ingesta
  // normal (extracción + OCR). Si aún no terminó, este tick no hace nada
  // y se reintenta más adelante.
  const { data: document, error } = await supabase
    .from('documents')
    .select('status, page_count')
    .eq('id', analysis.document_id)
    .single();
  if (error || !document) throw new Error(error?.message ?? 'Documento no encontrado');

  if (document.status === 'error') {
    throw new Error('El documento del analista falló al procesarse; no se puede analizar.');
  }
  if (document.status !== 'ready') {
    // Todavía se está extrayendo el texto: no es un error, solo hay que esperar.
    return false;
  }

  await supabase
    .from('analyses')
    .update({ status: 'extracting_claims', last_page_processed: 0, progress: 5, error_message: null })
    .eq('id', analysis.id);
  return false;
}

async function extractBatch(analysis: AnalysisRow): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: document } = await supabase
    .from('documents')
    .select('page_count')
    .eq('id', analysis.document_id)
    .single();
  const pageCount: number = document?.page_count ?? 0;

  const from = analysis.last_page_processed + 1;
  const to = Math.min(analysis.last_page_processed + PAGES_PER_EXTRACTION_BATCH, pageCount);

  const { data: pages, error } = await supabase
    .from('document_pages')
    .select('page_number, raw_text')
    .eq('document_id', analysis.document_id)
    .gte('page_number', from)
    .lte('page_number', to)
    .order('page_number', { ascending: true });
  if (error) throw new Error(error.message);

  const claims = await extractClaimsFromPages(
    (pages ?? []).map((p) => ({ pageNumber: p.page_number, text: p.raw_text ?? '' })),
  );

  if (claims.length > 0) {
    const { count } = await supabase
      .from('analysis_claims')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_id', analysis.id);
    const offset = count ?? 0;

    const { error: insertError } = await supabase.from('analysis_claims').insert(
      claims.map((c, i) => ({
        analysis_id: analysis.id,
        claim_text: c.claimText,
        page_number: c.pageNumber,
        position: offset + i,
      })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  const finished = to >= pageCount;
  await supabase
    .from('analyses')
    .update({
      last_page_processed: to,
      status: finished ? 'verifying' : 'extracting_claims',
      progress: pageCount > 0 ? Math.round((to / pageCount) * 40) + 5 : 45,
      retry_count: 0,
      error_message: null,
    })
    .eq('id', analysis.id);

  return false;
}

async function verifyBatch(analysis: AnalysisRow): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: pending, error } = await supabase
    .from('analysis_claims')
    .select('id, claim_text')
    .eq('analysis_id', analysis.id)
    .eq('verdict', 'pending')
    .order('position', { ascending: true })
    .limit(CLAIMS_PER_VERIFY_BATCH);
  if (error) throw new Error(error.message);

  if (!pending || pending.length === 0) {
    await supabase
      .from('analyses')
      .update({ status: 'ready', progress: 100, retry_count: 0, error_message: null })
      .eq('id', analysis.id);
    return true;
  }

  const titles = await loadLibraryTitles();

  for (const claim of pending) {
    const verification = await verifyClaim(claim.claim_text, titles);

    await supabase
      .from('analysis_claims')
      .update({
        verdict: verification.verdict,
        explanation: verification.explanation,
        confidence: verification.confidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claim.id);

    // Se reemplazan las fuentes anteriores: al re-verificar una afirmación
    // no deben quedar mezcladas con las del intento previo.
    await supabase.from('analysis_claim_sources').delete().eq('claim_id', claim.id);

    if (verification.sources.length > 0) {
      await supabase.from('analysis_claim_sources').insert(
        verification.sources.map((s) => ({
          claim_id: claim.id,
          analysis_id: analysis.id,
          document_id: s.documentId,
          chunk_id: s.chunkId,
          page_number: s.pageNumber,
          quote: s.quote,
          stance: s.stance,
        })),
      );
    }
  }

  const { count: total } = await supabase
    .from('analysis_claims')
    .select('id', { count: 'exact', head: true })
    .eq('analysis_id', analysis.id);
  const { count: stillPending } = await supabase
    .from('analysis_claims')
    .select('id', { count: 'exact', head: true })
    .eq('analysis_id', analysis.id)
    .eq('verdict', 'pending');

  const done = (stillPending ?? 0) === 0;
  const verified = (total ?? 0) - (stillPending ?? 0);
  await supabase
    .from('analyses')
    .update({
      status: done ? 'ready' : 'verifying',
      progress: done ? 100 : 45 + Math.round((verified / Math.max(total ?? 1, 1)) * 55),
      retry_count: 0,
      error_message: null,
    })
    .eq('id', analysis.id);

  return done;
}

/** Títulos de los documentos de biblioteca, para citar la fuente por nombre. */
export async function loadLibraryTitles(): Promise<Map<string, string>> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('documents').select('id, title').eq('kind', 'library');
  return new Map((data ?? []).map((d) => [d.id, d.title]));
}
