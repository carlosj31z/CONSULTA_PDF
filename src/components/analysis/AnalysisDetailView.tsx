'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RotateCcw, FileText } from 'lucide-react';
import { PdfViewerModal } from '@/components/viewer/PdfViewerModal';
import { ClaimCard, type Claim } from './ClaimCard';
import { VERDICT_LABELS } from './VerdictBadge';
import type { AnalysisStatus, ClaimVerdict } from '@/types/database';

const TICK_INTERVAL_MS = 3000;

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  pending: 'En cola…',
  extracting_claims: 'Extrayendo afirmaciones del informe…',
  verifying: 'Contrastando contra la biblioteca…',
  ready: 'Análisis completo',
  error: 'Error',
};

interface AnalysisHeader {
  id: string;
  status: AnalysisStatus;
  progress: number;
  error_message: string | null;
  documents: { id: string; title: string; page_count: number | null; status: string } | null;
}

type ViewerState = { documentId: string; documentTitle: string; page: number } | null;

export function AnalysisDetailView({
  initialAnalysis,
  initialClaims,
}: {
  initialAnalysis: AnalysisHeader;
  initialClaims: Claim[];
}) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [claims, setClaims] = useState(initialClaims);
  const [viewer, setViewer] = useState<ViewerState>(null);
  const [error, setError] = useState<string | null>(null);
  const [newClaim, setNewClaim] = useState('');
  const [adding, setAdding] = useState(false);
  const tickingRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/analyses/${initialAnalysis.id}`);
    if (!res.ok) return;
    const body = await res.json();
    setAnalysis(body.analysis);
    setClaims(body.claims);
  }, [initialAnalysis.id]);

  const working = analysis.status !== 'ready' && analysis.status !== 'error';

  // Mientras el análisis no esté terminado, va avanzando el trabajo por
  // lotes y refrescando -- sin depender de que el usuario recargue.
  useEffect(() => {
    if (!working) return;
    let cancelled = false;

    const runTick = async () => {
      if (tickingRef.current || cancelled) return;
      tickingRef.current = true;
      try {
        await fetch('/api/analyses/tick', { method: 'POST' });
        if (!cancelled) await refresh();
      } catch {
        // se reintenta en el siguiente intervalo
      } finally {
        tickingRef.current = false;
      }
    };

    runTick();
    const interval = setInterval(runTick, TICK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [working, refresh]);

  async function handleUpdate(id: string, patch: Record<string, unknown>) {
    setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } as Claim : c)));
    const res = await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setError('No se pudo guardar el cambio');
    await refresh();
  }

  async function handleReverify(id: string) {
    const res = await fetch(`/api/claims/${id}/reverify`, { method: 'POST' });
    if (!res.ok) setError('No se pudo re-verificar la afirmación');
    await refresh();
  }

  async function handleDelete(id: string) {
    setClaims((prev) => prev.filter((c) => c.id !== id));
    const res = await fetch(`/api/claims/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError('No se pudo eliminar la afirmación');
      await refresh();
    }
  }

  async function handleReverifyAll() {
    const res = await fetch(`/api/analyses/${analysis.id}/reverify`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'No se pudo re-verificar el análisis');
      return;
    }
    await refresh();
  }

  async function handleAddClaim(e: React.FormEvent) {
    e.preventDefault();
    const text = newClaim.trim();
    if (text.length < 10) return;
    setAdding(true);
    const res = await fetch(`/api/analyses/${analysis.id}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimText: text }),
    });
    setAdding(false);
    if (!res.ok) {
      setError('No se pudo añadir la afirmación');
      return;
    }
    setNewClaim('');
    await refresh();
  }

  const counts = claims.reduce<Record<string, number>>((acc, c) => {
    const v = c.user_verdict ?? c.verdict;
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.push('/analysis')}
          className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
          aria-label="Volver a análisis"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-stone-900 dark:text-stone-50">
            {analysis.documents?.title ?? 'Informe'}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {STATUS_LABEL[analysis.status]}
            {claims.length > 0 && ` · ${claims.length} afirmaciones`}
          </p>
        </div>
        {analysis.documents && (
          <button
            type="button"
            onClick={() =>
              setViewer({
                documentId: analysis.documents!.id,
                documentTitle: analysis.documents!.title,
                page: 1,
              })
            }
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          >
            <FileText size={15} /> Ver informe
          </button>
        )}
      </div>

      {working && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${analysis.progress}%` }}
          />
        </div>
      )}

      {analysis.status === 'error' && analysis.error_message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {analysis.error_message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {claims.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(['supported', 'partial', 'refuted', 'not_found'] as ClaimVerdict[]).map((v) =>
            counts[v] ? (
              <span key={v} className="text-xs text-stone-500 dark:text-stone-400">
                <strong className="text-stone-800 dark:text-stone-200">{counts[v]}</strong>{' '}
                {VERDICT_LABELS[v].toLowerCase()}
              </span>
            ) : null,
          )}
          <button
            type="button"
            onClick={handleReverifyAll}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
            title="Vuelve a contrastar todo contra la biblioteca actual (útil si agregaste documentos nuevos)"
          >
            <RotateCcw size={13} /> Re-verificar todo
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {claims.map((claim) => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            onUpdate={handleUpdate}
            onReverify={handleReverify}
            onDelete={handleDelete}
            onOpenSource={(documentId, documentTitle, page) =>
              setViewer({ documentId, documentTitle, page })
            }
          />
        ))}
        {claims.length === 0 && !working && (
          <div className="rounded-xl border border-dashed border-stone-300 py-12 text-center dark:border-stone-700">
            <p className="text-stone-500 dark:text-stone-400">
              No se extrajo ninguna afirmación verificable de este informe.
            </p>
            <p className="text-sm text-stone-400 dark:text-stone-500">
              Puedes añadir afirmaciones a mano abajo.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleAddClaim} className="flex gap-2">
        <input
          type="text"
          value={newClaim}
          onChange={(e) => setNewClaim(e.target.value)}
          placeholder="Añadir una afirmación para contrastar…"
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
        />
        <button
          type="submit"
          disabled={adding || newClaim.trim().length < 10}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <Plus size={15} /> Añadir
        </button>
      </form>

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
