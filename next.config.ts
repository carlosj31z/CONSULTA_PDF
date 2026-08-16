import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-reader.ts lee archivos de pdfjs-dist (standard_fonts/, cmaps/,
  // el worker) directamente del disco en tiempo de ejecución, no vía
  // import -- el file tracing de Vercel no los detecta solo y los deja
  // fuera del bundle de la función serverless si no se incluyen aquí.
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/pdfjs-dist/**"],
  },
};

export default nextConfig;
