'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PdfViewerModal } from '@/components/viewer/PdfViewerModal';

interface ChatSource {
  documentId: string;
  documentTitle: string;
  pageStart: number;
  pageEnd: number;
  quote: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  foundInDocuments?: boolean;
  sources?: ChatSource[];
}

interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
  scope_type: string;
}

interface ViewerState {
  documentId: string;
  documentTitle: string;
  page: number;
}

export function ChatView() {
  const searchParams = useSearchParams();
  const scopeDocumentId = searchParams.get('documentId');
  const scopeDocumentTitle = searchParams.get('title');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    const body = await res.json();
    if (res.ok) setConversations(body.conversations);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await loadConversations();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [loadConversations]);

  async function loadConversation(id: string) {
    setError(null);
    const res = await fetch(`/api/conversations/${id}`);
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? 'No se pudo cargar la conversación');
      return;
    }
    setActiveConversationId(id);
    setMessages(
      body.messages.map((m: {
        role: 'user' | 'assistant';
        content: string;
        confidence: number | null;
        sources: { document_id: string; page_number: number; quote: string; documents: { title: string } | null }[];
      }) => ({
        role: m.role,
        content: m.content,
        confidence: m.confidence ?? undefined,
        sources: (m.sources ?? []).map((s) => ({
          documentId: s.document_id,
          documentTitle: s.documents?.title ?? 'Documento',
          pageStart: s.page_number,
          pageEnd: s.page_number,
          quote: s.quote,
        })),
      })),
    );
  }

  function startNewConversation() {
    setActiveConversationId(undefined);
    setMessages([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationId: activeConversationId,
          scopeType: scopeDocumentId ? 'document' : undefined,
          scopeIds: scopeDocumentId ? [scopeDocumentId] : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Error al consultar');

      const isNewConversation = !activeConversationId;
      setActiveConversationId(body.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: body.answer,
          confidence: body.confidence,
          foundInDocuments: body.foundInDocuments,
          sources: body.sources,
        },
      ]);
      if (isNewConversation) loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col gap-1 border-r border-zinc-200 p-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={startNewConversation}
          className="mb-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Nueva conversación
        </button>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => loadConversation(c.id)}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm ${
                c.id === activeConversationId
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/60'
              }`}
            >
              {c.title || 'Conversación'}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {scopeDocumentId && (
          <div className="border-b border-zinc-200 bg-blue-50 px-4 py-2 text-xs text-blue-800 dark:border-zinc-800 dark:bg-blue-500/10 dark:text-blue-300">
            Preguntando solo sobre: <strong>{scopeDocumentTitle ?? 'este documento'}</strong>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                {scopeDocumentId ? 'Pregunta sobre este documento.' : 'Pregunta lo que quieras sobre tu biblioteca.'}
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Las respuestas se basan únicamente en tus documentos, con fuentes citadas.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.role === 'user'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1.5 border-t border-zinc-300/50 pt-2 dark:border-zinc-700/50">
                        {m.sources.map((s, si) => (
                          <button
                            key={si}
                            type="button"
                            onClick={() =>
                              setViewer({ documentId: s.documentId, documentTitle: s.documentTitle, page: s.pageStart })
                            }
                            className="cursor-pointer rounded-md p-1 text-left text-xs text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-200"
                          >
                            <span aria-hidden>📖</span> {s.documentTitle} — página {s.pageStart}
                            {s.pageEnd !== s.pageStart ? `-${s.pageEnd}` : ''}
                            <p className="mt-0.5 italic text-zinc-400 dark:text-zinc-500">“{s.quote}”</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Pensando…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mx-auto flex max-w-2xl gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={scopeDocumentId ? 'Pregunta sobre este documento…' : 'Pregunta sobre tu biblioteca…'}
              disabled={loading}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Preguntar
            </button>
          </div>
        </form>
      </div>

      {viewer && (
        <PdfViewerModal
          documentId={viewer.documentId}
          documentTitle={viewer.documentTitle}
          page={viewer.page}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
