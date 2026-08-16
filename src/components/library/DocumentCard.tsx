'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FileText, X, Star, MessageSquare, Pencil, Check } from 'lucide-react';
import type { DocumentRow } from '@/types/database';
import { formatBytes, formatDate } from '@/lib/utils/format';
import { StatusBadge } from './StatusBadge';

/**
 * Bucket "covers" público -- se accede por URL directa, sin firmar. Si la
 * carátula no existe (documento aún no procesado, o falló al generarla),
 * la imagen simplemente da 404 y el <img onError> cae al ícono genérico.
 */
function coverUrlFor(documentId: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/covers/${documentId}/cover.png`;
}

export function DocumentCard({
  document,
  onDelete,
  onToggleFavorite,
  onRename,
}: {
  document: DocumentRow;
  onDelete: (id: string) => void;
  onToggleFavorite?: (id: string, next: boolean) => void;
  onRename?: (id: string, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(document.title);
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = coverUrlFor(document.id);
  const showCover = coverUrl && !coverFailed;

  function startEditing() {
    setDraftTitle(document.title);
    setEditing(true);
  }

  function submitRename() {
    const trimmed = draftTitle.trim();
    setEditing(false);
    if (onRename && trimmed && trimmed !== document.title) {
      onRename(document.id, trimmed);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {showCover ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen dinámica de Storage, no un asset local
            <img
              src={coverUrl}
              alt=""
              onError={() => setCoverFailed(true)}
              className="h-14 w-11 shrink-0 rounded-md border border-stone-200 object-cover dark:border-stone-800"
            />
          ) : (
            <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
              <FileText size={18} strokeWidth={2} />
            </div>
          )}
          <div className="min-w-0">
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRename();
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="min-w-0 flex-1 rounded-md border border-orange-400 bg-white px-1.5 py-0.5 text-sm text-stone-900 outline-none dark:bg-stone-800 dark:text-stone-50"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md p-1 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                  aria-label="Guardar nombre"
                >
                  <Check size={14} />
                </button>
              </form>
            ) : (
              <div className="group/title flex items-center gap-1">
                <p className="truncate font-medium text-stone-900 dark:text-stone-50">
                  {document.title}
                </p>
                {onRename && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="shrink-0 rounded-md p-1 text-stone-300 opacity-0 hover:bg-stone-100 hover:text-stone-600 group-hover/title:opacity-100 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                    aria-label={`Renombrar ${document.title}`}
                    title="Renombrar"
                  >
                    <Pencil size={12} />
                  </button>
                )}
              </div>
            )}
            {document.author && (
              <p className="truncate text-sm text-stone-500 dark:text-stone-400">
                {document.author}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(document.id, !document.is_favorite)}
              className={`rounded-md p-1.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 ${
                document.is_favorite ? 'text-amber-500' : 'text-stone-400 hover:text-amber-500'
              }`}
              aria-label={document.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              title={document.is_favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              <Star size={16} fill={document.is_favorite ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(document.id)}
            className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            aria-label={`Eliminar ${document.title}`}
            title="Eliminar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={document.status} />
        {document.status === 'error' && document.processing_error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {document.processing_error}
          </span>
        )}
      </div>

      {document.status === 'processing' && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${document.processing_progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
        <span>{document.page_count ? `${document.page_count} páginas` : '— páginas'}</span>
        <span>{formatBytes(document.file_size_bytes)}</span>
        <span>{formatDate(document.created_at)}</span>
      </div>

      {document.status === 'ready' && (
        <Link
          href={`/chat?documentId=${document.id}&title=${encodeURIComponent(document.title)}`}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <MessageSquare size={15} />
          Preguntar sobre este documento
        </Link>
      )}
    </div>
  );
}
