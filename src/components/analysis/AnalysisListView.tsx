'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Upload, ClipboardCheck, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { sha256Hex } from '@/lib/utils/format';
import { DOCUMENTS_BUCKET, MAX_UPLOAD_SIZE_BYTES } from '@/lib/documents/constants';
import { formatDate } from '@/lib/utils/format';
import { VERDICT_LABELS } from './VerdictBadge';
import type { AnalysisStatus } from '@/types/database';

const TICK_INTERVAL_MS = 3000;

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  pending: 'En cola…',
  extracting_claims: 'Extrayendo afirmaciones…',
  verifying: 'Contrastando…',
  ready: 'Completo',
  error: 'Error',
};

export interface AnalysisSummary {
  id: string;
  status: AnalysisStatus;
  progress: number;
  created_at: string;
  documents: { title: string; page_count: number | null } | null;
  verdict_counts: Record<string, number>;
}

export function AnalysisListView({ initialAnalyses }: { initialAnalyses: AnalysisSummary[] }) {
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [upload, setUpload] = useState<{ fileName: string; stage: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tickingRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/analyses');
    if (!res.ok) return;
    const body = await res.json();
    setAnalyses(body.analyses);
  }, []);

  const working = analyses.some((a) => a.status !== 'ready' && a.status !== 'error');

  useEffect(() => {
    if (!working) return;
    let cancelled = false;

    const runTick = async () => {
      if (tickingRef.current || cancelled) return;
      tickingRef.current = true;
      try {
        // Un informe recién subido primero necesita que se extraiga su
        // texto (pipeline de ingesta) y después el análisis en sí.
        await fetch('/api/worker/tick', { method: 'POST' });
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

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== 'application/pdf') {
      setError('Solo se admiten archivos PDF.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(`El archivo supera el límite de ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB.`);
      return;
    }

    let createdDocumentId: string | undefined;
    try {
      setUpload({ fileName: file.name, stage: 'Calculando huella…' });
      const fileHash = await sha256Hex(file);

      setUpload({ fileName: file.name, stage: 'Preparando subida…' });
      const initRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileHash,
          mimeType: file.type,
          sizeBytes: file.size,
          kind: 'analysis',
        }),
      });
      const initBody = await initRes.json();
      if (!initRes.ok) throw new Error(initBody.error ?? 'No se pudo iniciar la subida');
      if (initBody.duplicate) {
        throw new Error('Ese archivo ya está subido en esta aplicación.');
      }
      createdDocumentId = initBody.documentId;

      setUpload({ fileName: file.name, stage: 'Subiendo…' });
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .uploadToSignedUrl(initBody.path, initBody.token, file);
      if (upErr) throw upErr;

      setUpload({ fileName: file.name, stage: 'Encolando análisis…' });
      const completeRes = await fetch(`/api/documents/${initBody.documentId}/complete`, { method: 'POST' });
      if (!completeRes.ok) throw new Error('No se pudo encolar el procesamiento');

      const analysisRes = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: initBody.documentId }),
      });
      if (!analysisRes.ok) throw new Error('No se pudo crear el análisis');

      setUpload(null);
      await refresh();
    } catch (err) {
      setUpload(null);
      setError(err instanceof Error ? err.message : 'Error subiendo el informe');
      if (createdDocumentId) {
        await fetch(`/api/documents/${createdDocumentId}`, { method: 'DELETE' }).catch(() => {});
      }
    }
  }

  async function handleDelete(id: string) {
    const previous = analyses;
    setAnalyses((prev) => prev.filter((a) => a.id !== id));
    const res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setAnalyses(previous);
      setError('No se pudo eliminar el análisis');
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-50">Análisis</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Contrasta un informe contra tu biblioteca, afirmación por afirmación.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload !== null}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          <Upload size={15} />
          Subir informe
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {upload && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
          <span className="font-medium">{upload.fileName}</span> — {upload.stage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {analyses.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-20 text-center dark:border-stone-700">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white">
            <ClipboardCheck size={22} />
          </div>
          <p className="text-stone-500 dark:text-stone-400">Todavía no analizaste ningún informe.</p>
          <p className="max-w-md text-sm text-stone-400 dark:text-stone-500">
            Sube un PDF redactado por un analista: se extraen sus afirmaciones y cada una se
            respalda o refuta con tu biblioteca, citando documento y página.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {analyses.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
            >
              <Link href={`/analysis/${a.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-stone-900 dark:text-stone-50">
                  {a.documents?.title ?? 'Informe'}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {STATUS_LABEL[a.status]} · {formatDate(a.created_at)}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500 dark:text-stone-400">
                  {(['supported', 'partial', 'refuted', 'not_found'] as const).map((v) =>
                    a.verdict_counts[v] ? (
                      <span key={v}>
                        <strong className="text-stone-800 dark:text-stone-200">
                          {a.verdict_counts[v]}
                        </strong>{' '}
                        {VERDICT_LABELS[v].toLowerCase()}
                      </span>
                    ) : null,
                  )}
                </div>
              </Link>
              {a.status !== 'ready' && a.status !== 'error' && (
                <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                  <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${a.progress}%` }}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                className="shrink-0 rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                aria-label="Eliminar análisis"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
