import { NextResponse } from 'next/server';
import { z } from 'zod';
import { answerPublicQuery } from '@/lib/rag/public-query';

export const dynamic = 'force-dynamic';

/**
 * API pública y sin autenticación (decisión ya tomada para toda la app:
 * "sin protección alguna"). Pensada para que OTRA página consulte la
 * biblioteca teniendo solo el link de https://consulta-pdf.vercel.app,
 * sin necesitar sesión ni backend propio. CORS abierto porque el
 * consumidor es JavaScript corriendo en el navegador de un sitio externo.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function withCors(body: unknown, init?: number) {
  return NextResponse.json(body, { status: init ?? 200, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const querySchema = z.object({
  question: z.string().trim().min(1, 'Falta la pregunta').max(2000),
  documentIds: z.array(z.string().uuid()).optional(),
});

async function handle(question: string | null, documentIdsRaw: string | null) {
  const documentIds = documentIdsRaw
    ? documentIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  const parsed = querySchema.safeParse({ question: question ?? '', documentIds });
  if (!parsed.success) {
    return withCors({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await answerPublicQuery(parsed.data);
    return withCors(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return withCors({ error: message }, 500);
  }
}

/**
 * GET /api/public/query?question=...&documentIds=uuid1,uuid2
 * "documentIds" es opcional: si se omite, se consulta toda la biblioteca.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return handle(url.searchParams.get('question') ?? url.searchParams.get('q'), url.searchParams.get('documentIds'));
}

/** POST /api/public/query { "question": "...", "documentIds": ["uuid", ...] } */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const documentIds = Array.isArray(body?.documentIds) ? body.documentIds.join(',') : null;
  return handle(body?.question ?? null, documentIds);
}
