import { GoogleGenAI } from '@google/genai';
import { aiConfig } from './config';

let clients: GoogleGenAI[] | null = null;
/** Índice de la última key que funcionó -- las siguientes llamadas empiezan ahí. */
let preferredIndex = 0;

function getClients(): GoogleGenAI[] {
  if (!clients) {
    clients = aiConfig.apiKeys().map((apiKey) => new GoogleGenAI({ apiKey }));
  }
  return clients;
}

function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('"code":429') ||
    message.includes('rateLimitExceeded')
  );
}

/**
 * Ejecuta una llamada a Gemini con rotación automática entre las API keys
 * configuradas: si la key en uso agota su cuota (429/RESOURCE_EXHAUSTED),
 * reintenta con la siguiente antes de fallar. Recuerda cuál funcionó por
 * última vez para no volver a probar keys ya agotadas en cada llamada.
 * Errores que no son de cuota se propagan de inmediato, sin rotar.
 */
export async function withGemini<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const all = getClients();
  let lastError: unknown;

  for (let i = 0; i < all.length; i++) {
    const index = (preferredIndex + i) % all.length;
    try {
      const result = await fn(all[index]);
      preferredIndex = index;
      return result;
    } catch (err) {
      lastError = err;
      if (!isQuotaError(err) || i === all.length - 1) throw err;
      // key agotada y quedan más por probar: sigue al siguiente índice.
    }
  }

  throw lastError;
}

export { aiConfig };
