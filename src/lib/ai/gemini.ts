import { GoogleGenAI } from '@google/genai';
import { aiConfig } from './config';

let client: GoogleGenAI | null = null;

/**
 * Cliente Gemini único para todo el backend. Server-only: nunca importar
 * este módulo desde un componente cliente (usa GOOGLE_AI_API_KEY, sin
 * prefijo NEXT_PUBLIC).
 */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: aiConfig.apiKey() });
  }
  return client;
}

export { aiConfig };
