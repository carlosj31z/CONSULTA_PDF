'use client';

import { useRef, useState } from 'react';

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

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);

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
        body: JSON.stringify({ question, conversationId: conversationIdRef.current }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Error al consultar');

      conversationIdRef.current = body.conversationId;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">Pregunta lo que quieras sobre tu biblioteca.</p>
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
                        <div key={si} className="text-xs text-zinc-500 dark:text-zinc-400">
                          <span aria-hidden>📖</span> {s.documentTitle} — página {s.pageStart}
                          {s.pageEnd !== s.pageStart ? `-${s.pageEnd}` : ''}
                          <p className="mt-0.5 italic text-zinc-400 dark:text-zinc-500">“{s.quote}”</p>
                        </div>
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
            placeholder="Pregunta sobre tu biblioteca…"
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
  );
}
