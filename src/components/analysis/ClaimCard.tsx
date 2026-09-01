'use client';

import { useState } from 'react';
import { BookOpen, Pencil, Check, X, RotateCcw, Trash2, StickyNote } from 'lucide-react';
import type { ClaimVerdict, ClaimUserVerdict } from '@/types/database';
import { VerdictBadge, VERDICT_LABELS } from './VerdictBadge';

export interface ClaimSource {
  id: string;
  document_id: string;
  page_number: number;
  quote: string;
  stance: 'supports' | 'refutes' | 'context';
  documents: { title: string } | null;
}

export interface Claim {
  id: string;
  claim_text: string;
  page_number: number | null;
  verdict: ClaimVerdict;
  explanation: string | null;
  confidence: number | null;
  user_verdict: ClaimUserVerdict | null;
  user_note: string | null;
  sources: ClaimSource[];
}

const STANCE_LABEL: Record<ClaimSource['stance'], string> = {
  supports: 'respalda',
  refutes: 'contradice',
  context: 'contexto',
};

const STANCE_STYLE: Record<ClaimSource['stance'], string> = {
  supports: 'border-emerald-300 dark:border-emerald-500/30',
  refutes: 'border-red-300 dark:border-red-500/30',
  context: 'border-stone-200 dark:border-stone-700',
};

export function ClaimCard({
  claim,
  onUpdate,
  onReverify,
  onDelete,
  onOpenSource,
}: {
  claim: Claim;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onReverify: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenSource: (documentId: string, title: string, page: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(claim.claim_text);
  const [noteOpen, setNoteOpen] = useState(Boolean(claim.user_note));
  const [note, setNote] = useState(claim.user_note ?? '');

  const effectiveVerdict = claim.user_verdict ?? claim.verdict;

  async function saveText() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== claim.claim_text) {
      await onUpdate(claim.id, { claim_text: trimmed });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-orange-400 bg-white p-2 text-sm text-stone-900 outline-none dark:bg-stone-800 dark:text-stone-50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveText}
                  className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700"
                >
                  <Check size={13} /> Guardar y re-verificar
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setDraft(claim.claim_text); }}
                  className="flex items-center gap-1 rounded-lg border border-stone-300 px-3 py-1 text-xs text-stone-600 dark:border-stone-700 dark:text-stone-400"
                >
                  <X size={13} /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-900 dark:text-stone-50">{claim.claim_text}</p>
          )}
          {claim.page_number && !editing && (
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              Página {claim.page_number} del informe
            </p>
          )}
        </div>
        <VerdictBadge verdict={effectiveVerdict} overridden={Boolean(claim.user_verdict)} />
      </div>

      {claim.explanation && !editing && (
        <p className="text-sm text-stone-600 dark:text-stone-400">{claim.explanation}</p>
      )}

      {claim.sources.length > 0 && (
        <div className="flex flex-col gap-2">
          {claim.sources.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSource(s.document_id, s.documents?.title ?? 'Documento', s.page_number)}
              className={`rounded-lg border-l-2 bg-stone-50 p-2 text-left text-xs hover:bg-stone-100 dark:bg-stone-800/50 dark:hover:bg-stone-800 ${STANCE_STYLE[s.stance]}`}
            >
              <span className="inline-flex items-center gap-1 font-medium text-stone-600 dark:text-stone-300">
                <BookOpen size={11} />
                {s.documents?.title ?? 'Documento'} — pág. {s.page_number}
                <span className="text-stone-400">· {STANCE_LABEL[s.stance]}</span>
              </span>
              <p className="mt-1 italic text-stone-500 dark:text-stone-400">“{s.quote}”</p>
            </button>
          ))}
        </div>
      )}

      {noteOpen && (
        <div className="flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (claim.user_note ?? '') && onUpdate(claim.id, { user_note: note || null })}
            rows={2}
            placeholder="Tu nota sobre esta afirmación…"
            className="w-full rounded-lg border border-stone-300 bg-white p-2 text-sm text-stone-900 outline-none focus:border-orange-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-50"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-2 dark:border-stone-800">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <Pencil size={12} /> Editar
          </button>
        )}
        <button
          type="button"
          onClick={() => setNoteOpen((o) => !o)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <StickyNote size={12} /> {claim.user_note ? 'Nota' : 'Añadir nota'}
        </button>
        <button
          type="button"
          onClick={() => onReverify(claim.id)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
        >
          <RotateCcw size={12} /> Re-verificar
        </button>

        <select
          value={claim.user_verdict ?? ''}
          onChange={(e) => onUpdate(claim.id, { user_verdict: e.target.value || null })}
          className="ml-auto rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
          title="Imponer tu propio veredicto"
        >
          <option value="">Veredicto automático</option>
          {(['supported', 'partial', 'refuted', 'not_found'] as const).map((v) => (
            <option key={v} value={v}>{VERDICT_LABELS[v]} (manual)</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onDelete(claim.id)}
          className="rounded-md p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
          aria-label="Eliminar afirmación"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
