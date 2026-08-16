'use client';

import Link from 'next/link';
import { FileText, X, Star, MessageSquare } from 'lucide-react';
import type { DocumentRow } from '@/types/database';
import { formatBytes, formatDate } from '@/lib/utils/format';
import { StatusBadge } from './StatusBadge';

export function DocumentCard({
  document,
  onDelete,
  onToggleFavorite,
}: {
  document: DocumentRow;
  onDelete: (id: string) => void;
  onToggleFavorite?: (id: string, next: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
            <FileText size={18} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-stone-900 dark:text-stone-50">
              {document.title}
            </p>
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
