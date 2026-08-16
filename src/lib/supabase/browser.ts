import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

let client: SupabaseClient | null = null;

/**
 * Cliente Supabase para el navegador (clave anon, pública por diseño).
 * Solo se usa para subir archivos directamente a Storage mediante URLs
 * firmadas generadas por el servidor — nunca para leer/escribir la base
 * de datos directamente desde el cliente.
 */
export function getSupabaseBrowser() {
  if (!client) {
    client = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      { auth: { persistSession: false } },
    );
  }
  return client;
}
