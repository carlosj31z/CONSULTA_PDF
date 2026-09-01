import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { AnalysisListView, type AnalysisSummary } from '@/components/analysis/AnalysisListView';

export const dynamic = 'force-dynamic';

export default async function AnalysisPage() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('analyses')
    .select('*, documents(title, page_count)')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-red-600 dark:text-red-400">No se pudo conectar con Supabase: {error.message}</p>
      </div>
    );
  }

  const { data: claims } = await supabase.from('analysis_claims').select('analysis_id, verdict');
  const counts = new Map<string, Record<string, number>>();
  for (const c of claims ?? []) {
    const bucket = counts.get(c.analysis_id) ?? {};
    bucket[c.verdict] = (bucket[c.verdict] ?? 0) + 1;
    counts.set(c.analysis_id, bucket);
  }

  const analyses = (data ?? []).map(
    (a) => ({ ...a, verdict_counts: counts.get(a.id) ?? {} }) as unknown as AnalysisSummary,
  );

  return <AnalysisListView initialAnalyses={analyses} />;
}
