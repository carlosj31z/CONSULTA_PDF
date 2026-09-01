import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { AnalysisDetailView } from '@/components/analysis/AnalysisDetailView';
import type { Claim } from '@/components/analysis/ClaimCard';

export const dynamic = 'force-dynamic';

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: analysis, error } = await supabase
    .from('analyses')
    .select('*, documents(id, title, page_count, status)')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-red-600 dark:text-red-400">No se pudo conectar con Supabase: {error.message}</p>
      </div>
    );
  }
  if (!analysis) notFound();

  const { data: claims } = await supabase
    .from('analysis_claims')
    .select('*')
    .eq('analysis_id', id)
    .order('position', { ascending: true });

  const { data: sources } = await supabase
    .from('analysis_claim_sources')
    .select('*, documents(title)')
    .eq('analysis_id', id);

  const byClaim = new Map<string, unknown[]>();
  for (const s of sources ?? []) {
    const list = byClaim.get(s.claim_id) ?? [];
    list.push(s);
    byClaim.set(s.claim_id, list);
  }

  const claimsWithSources = (claims ?? []).map(
    (c) => ({ ...c, sources: byClaim.get(c.id) ?? [] }) as unknown as Claim,
  );

  return (
    <AnalysisDetailView
      initialAnalysis={analysis as never}
      initialClaims={claimsWithSources}
    />
  );
}
