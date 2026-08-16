'use client';

import { useEffect, useState } from 'react';

interface PdfViewerModalProps {
  documentId: string;
  documentTitle: string;
  page: number;
  onClose: () => void;
}

/**
 * Visor PDF integrado: usa el visor nativo del navegador (iframe +
 * fragmento #page=N), sin librerías adicionales. No resalta el texto
 * exacto de la cita -- eso requeriría un visor propio con pdf.js -- pero
 * salta directamente a la página correcta, que es el requisito principal.
 */
export function PdfViewerModal({ documentId, documentTitle, page, onClose }: PdfViewerModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${documentId}/view-url`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) setError(body.error);
        else setUrl(body.url);
      })
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {documentTitle} — página {page}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 bg-zinc-100 dark:bg-zinc-950">
          {error && <p className="p-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {url && (
            <iframe
              key={url}
              src={`${url}#page=${page}`}
              title={`${documentTitle} — página ${page}`}
              className="h-full w-full"
            />
          )}
        </div>
      </div>
    </div>
  );
}
