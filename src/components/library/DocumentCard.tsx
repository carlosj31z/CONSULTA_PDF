'use client';

import type { DocumentRow } from '@/types/database';
import { formatBytes, formatDate } from '@/lib/utils/format';
import { StatusBadge } from './StatusBadge';

export function DocumentCard({
  document,
  onDelete,
}: {
  document: DocumentRow;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg dark:bg-zinc-800">
            📖
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
              {document.title}
            </p>
            {document.author && (
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {document.author}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(document.id)}
          className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
          aria-label={`Eliminar ${document.title}`}
          title="Eliminar"
        >
          ✕
        </button>
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
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${document.processing_progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{document.page_count ? `${document.page_count} páginas` : '— páginas'}</span>
        <span>{formatBytes(document.file_size_bytes)}</span>
        <span>{formatDate(document.created_at)}</span>
      </div>
    </div>
  );
}
