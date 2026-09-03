import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Lista pública de solo lectura de la biblioteca (título, páginas, autor),
 * para que un consumidor externo sepa qué documentos puede filtrar en
 * /api/public/query sin exponer nada del contenido en sí.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, author, page_count, status')
    .eq('kind', 'library')
    .eq('status', 'ready')
    .order('title', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
  return NextResponse.json({ documents: data }, { headers: CORS_HEADERS });
}
