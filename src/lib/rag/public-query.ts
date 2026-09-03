import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hybridSearch } from './retrieval';
import { generateAnswer } from './answer';

export interface PublicQuerySource {
  documentId: string;
  documentTitle: string;
  pageStart: number;
  pageEnd: number;
  quote: string;
}

export interface PublicQueryResult {
  answer: string;
  foundInDocuments: boolean;
  confidence: number;
  sources: PublicQuerySource[];
}

const NOT_FOUND_ANSWER =
  'No encuentro información suficiente sobre esto en los documentos disponibles.';

/**
 * Misma respuesta que el chat interno (RAG con citas verificadas), pero
 * SIN crear conversación ni guardar mensajes: pensada para que otra
 * página consulte la biblioteca con solo el link público, sin ensuciar
 * el historial de conversaciones de la app.
 */
export async function answerPublicQuery(params: {
  question: string;
  documentIds?: string[];
}): Promise<PublicQueryResult> {
  const { question, documentIds } = params;
  const supabase = getSupabaseAdmin();

  const chunks = await hybridSearch(question, { documentIds });

  if (chunks.length === 0) {
    return { answer: NOT_FOUND_ANSWER, foundInDocuments: false, confidence: 0, sources: [] };
  }

  const documentIdsInChunks = [...new Set(chunks.map((c) => c.documentId))];
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title')
    .in('id', documentIdsInChunks);
  const documentTitles = new Map((documents ?? []).map((d) => [d.id, d.title]));

  const result = await generateAnswer({
    question,
    chunks,
    documentTitles,
    conversationHistory: [],
  });

  return {
    answer: result.answer,
    foundInDocuments: result.foundInDocuments,
    confidence: result.confidence,
    sources: result.sources.map((s) => ({
      documentId: s.documentId,
      documentTitle: documentTitles.get(s.documentId) ?? 'Documento',
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
      quote: s.quote,
    })),
  };
}
