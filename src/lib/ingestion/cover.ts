import { createCanvas } from '@napi-rs/canvas';
import { openPdf } from './pdf-reader';

const TARGET_WIDTH = 400;

/**
 * Renderiza la primera página del PDF como una miniatura PNG. Nunca
 * lanza -- si algo falla (PDF corrupto, página sin contenido renderizable,
 * etc.), devuelve null y el documento simplemente se muestra con el
 * ícono genérico en vez de carátula.
 */
export async function renderCoverImage(pdfBytes: Uint8Array): Promise<Buffer | null> {
  try {
    const pdf = await openPdf(pdfBytes);
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = TARGET_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
    const context = canvas.getContext('2d');

    // @napi-rs/canvas es compatible en tiempo de ejecución con la API de
    // canvas del DOM que pdfjs espera, pero no comparte los mismos tipos
    // de TypeScript.
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    page.cleanup();
    return canvas.toBuffer('image/png');
  } catch {
    return null;
  }
}
