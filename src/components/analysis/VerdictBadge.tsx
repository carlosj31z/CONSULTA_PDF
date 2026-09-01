import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import type { ClaimVerdict } from '@/types/database';

const STYLES: Record<ClaimVerdict, string> = {
  pending: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
  supported: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  refuted: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  not_found: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
};

export const VERDICT_LABELS: Record<ClaimVerdict, string> = {
  pending: 'Verificando…',
  supported: 'Respaldado',
  refuted: 'Refutado',
  partial: 'Parcial',
  not_found: 'Sin respaldo',
};

const ICONS: Record<ClaimVerdict, typeof CheckCircle2> = {
  pending: Loader2,
  supported: CheckCircle2,
  refuted: XCircle,
  partial: AlertTriangle,
  not_found: HelpCircle,
};

export function VerdictBadge({ verdict, overridden }: { verdict: ClaimVerdict; overridden?: boolean }) {
  const Icon = ICONS[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[verdict]}`}
      title={overridden ? 'Veredicto ajustado por ti' : undefined}
    >
      <Icon size={12} className={verdict === 'pending' ? 'animate-spin' : ''} />
      {VERDICT_LABELS[verdict]}
      {overridden && <span className="opacity-70">·  tuyo</span>}
    </span>
  );
}
