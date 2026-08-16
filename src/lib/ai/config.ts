function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

/**
 * Punto único de configuración de modelos Gemini. Cambiar de modelo
 * (o de proveedor en el futuro) no debe requerir tocar la lógica de negocio.
 */
export const aiConfig = {
  apiKey: () => requireEnv('GOOGLE_AI_API_KEY'),
  models: {
    flash: process.env.GEMINI_MODEL_FLASH ?? 'gemini-3.6-flash',
    pro: process.env.GEMINI_MODEL_PRO ?? 'gemini-3.1-pro',
    embedding: process.env.GEMINI_MODEL_EMBEDDING ?? 'gemini-embedding-001',
  },
  embeddingDimensions: 1536,
} as const;
