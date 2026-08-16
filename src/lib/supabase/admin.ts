import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

let client: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Cliente Supabase con service role. Server-only: acceso total a la base
 * de datos y al Storage privado. No hay RLS multiusuario en este proyecto
 * (uso personal, sin autenticación) por lo que TODO el acceso a datos debe
 * pasar por rutas de servidor que usan este cliente — nunca exponer la
 * service role key al navegador.
 */
export function getSupabaseAdmin() {
  if (!client) {
    client = createClient<Database>(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );
  }
  return client;
}
