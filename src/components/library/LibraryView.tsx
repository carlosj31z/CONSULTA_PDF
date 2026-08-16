'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocumentRow } from '@/types/database';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { sha256Hex } from '@/lib/utils/format';
import { DOCUMENTS_BUCKET, MAX_UPLOAD_SIZE_BYTES } from '@/lib/documents/constants';
import { DocumentCard } from './DocumentCard';

type UploadState = { fileName: string; stage: string } | null;

const TICK_INTERVAL_MS = 2500;

export function LibraryView({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [upload, setUpload] = useState<UploadState>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tickingRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/documents');
    const body = await res.json();
    if (res.ok) setDocuments(body.documents);
  }, []);

  const hasActiveWork = documents.some((d) => d.status === 'pending' || d.status === 'processing');

  // Mientras haya documentos pendientes/procesando, va avanzando el
  // pipeline con ticks periódicos y refresca el estado. Se detiene solo
  // cuando ningún documento necesita trabajo.
  useEffect(() => {
    if (!hasActiveWork) return;
    let cancelled = false;

    const runTick = async () => {
      if (tickingRef.current || cancelled) return;
      tickingRef.current = true;
      try {
        await fetch('/api/worker/tick', { method: 'POST' });
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
  }, [hasActiveWork, refresh]);

  async function handleFileSelected(file: File) {
    setError(null);

    if (file.type !== 'application/pdf') {
      setError('Solo se admiten archivos PDF por ahora.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(`El archivo supera el límite de ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB.`);
      return;
    }

    // Si falla algo DESPUÉS de crear el registro del documento, hay que
    // borrarlo -- si no, queda un documento "pending" huérfano sin
    // archivo real y sin job, atascado para siempre.
    let createdDocumentId: string | undefined;

    try {
      setUpload({ fileName: file.name, stage: 'Calculando huella del archivo…' });
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
        }),
      });
      const initBody = await initRes.json();
      if (!initRes.ok) throw new Error(initBody.error ?? 'No se pudo iniciar la subida');

      if (initBody.duplicate) {
        setUpload(null);
        setError(`"${file.name}" ya está en tu biblioteca — no se ha vuelto a subir.`);
        await refresh();
        return;
      }

      createdDocumentId = initBody.documentId;

      setUpload({ fileName: file.name, stage: 'Subiendo a Storage…' });
      const supabase = getSupabaseBrowser();
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .uploadToSignedUrl(initBody.path, initBody.token, file);
      if (uploadError) throw uploadError;

      setUpload({ fileName: file.name, stage: 'Confirmando…' });
      const completeRes = await fetch(`/api/documents/${initBody.documentId}/complete`, { method: 'POST' });
      if (!completeRes.ok) {
        const body = await completeRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'No se pudo confirmar la subida ni encolar el procesamiento');
      }

      setUpload(null);
      await refresh();
    } catch (err) {
      setUpload(null);
      setError(err instanceof Error ? err.message : 'Error subiendo el archivo');
      if (createdDocumentId) {
        await fetch(`/api/documents/${createdDocumentId}`, { method: 'DELETE' }).catch(() => {});
        await refresh();
      }
    }
  }

  async function handleDelete(id: string) {
    const previous = documents;
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setDocuments(previous);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'No se pudo eliminar el documento');
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Biblioteca</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {documents.length} documento{documents.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload !== null}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Subir PDF
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = '';
          }}
        />
      </div>

      {upload && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <span className="font-medium">{upload.fileName}</span> — {upload.stage}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {documents.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-24 text-center dark:border-zinc-700">
          <p className="text-zinc-500 dark:text-zinc-400">Tu biblioteca está vacía.</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            Sube un PDF para empezar a construir tu base de conocimiento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
