import Groq from 'groq-sdk';

let client: Groq | null = null;

export const groqConfig = {
  model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  isConfigured: () => Boolean(process.env.GROQ_API_KEY),
};

/**
 * Cliente Groq: respaldo de ÚLTIMO recurso, solo para generar texto
 * (la respuesta del chat sobre contexto ya recuperado). Groq no ofrece
 * modelos de embeddings ni comprensión nativa de PDF -- no reemplaza a
 * Gemini para ingesta (OCR/embeddings), solo cubre la generación de
 * respuestas cuando todas las API keys de Gemini están agotadas.
 */
export function getGroqClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Falta la variable de entorno GROQ_API_KEY');
    client = new Groq({ apiKey });
  }
  return client;
}
