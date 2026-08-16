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
    // Sin tier "pro" estable disponible para esta API key a agosto 2026
    // (gemini-2.5-pro descontinuado para keys nuevas, Gemini 3 pro sigue
    // en preview) -- se usa flash también aquí hasta que haya uno.
    pro: process.env.GEMINI_MODEL_PRO ?? 'gemini-3.6-flash',
    embedding: process.env.GEMINI_MODEL_EMBEDDING ?? 'gemini-embedding-001',
  },
  embeddingDimensions: 1536,
} as const;
