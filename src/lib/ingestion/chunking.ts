import { createHash } from 'node:crypto';
import type { ChunkContentType } from '@/types/database';

export interface PageForChunking {
  pageNumber: number;
  text: string;
  /** Tipo de contenido detectado por visión, si la página se procesó así. */
  contentTypeHint?: ChunkContentType;
}

export interface ChunkDraft {
  pageStart: number;
  pageEnd: number;
  chapter: string | null;
  section: string | null;
  contentType: ChunkContentType;
  position: number;
  content: string;
  contentHash: string;
  tokenCount: number;
}

const CHAPTER_RE = /^(cap[ií]tulo|chapter|parte|part)\s+([0-9]+|[ivxlcdm]+)\b.*/i;
const SECTION_RE = /^(secci[oó]n|section)\s+([0-9]+(\.[0-9]+)*)\b.*/i;

const TARGET_TOKENS = 600;
const MAX_TOKENS = 900;

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return false;
  if (CHAPTER_RE.test(trimmed) || SECTION_RE.test(trimmed)) return true;
  const letters = trimmed.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return false;
  return letters === letters.toUpperCase();
}

interface Block {
  pageNumber: number;
  contentTypeHint?: ChunkContentType;
  kind: 'heading' | 'paragraph';
  text: string;
  chapter: string | null;
  section: string | null;
}

function splitIntoBlocks(pages: PageForChunking[]): Block[] {
  const blocks: Block[] = [];
  let currentChapter: string | null = null;
  let currentSection: string | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = (pageNumber: number, contentTypeHint?: ChunkContentType) => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
    paragraphBuffer = [];
    if (!text) return;
    blocks.push({
      pageNumber,
      contentTypeHint,
      kind: 'paragraph',
      text,
      chapter: currentChapter,
      section: currentSection,
    });
  };

  for (const page of pages) {
    const lines = page.text.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph(page.pageNumber, page.contentTypeHint);
        continue;
      }
      if (looksLikeHeading(line)) {
        flushParagraph(page.pageNumber, page.contentTypeHint);
        if (CHAPTER_RE.test(line)) {
          currentChapter = line;
          currentSection = null;
        } else if (SECTION_RE.test(line)) {
          currentSection = line;
        } else {
          currentSection = line;
        }
        blocks.push({
          pageNumber: page.pageNumber,
          contentTypeHint: page.contentTypeHint,
          kind: 'heading',
          text: line,
          chapter: currentChapter,
          section: currentSection,
        });
        continue;
      }
      paragraphBuffer.push(line);
    }
    flushParagraph(page.pageNumber, page.contentTypeHint);
  }

  return blocks;
}

function resolveContentType(blocks: Block[]): ChunkContentType {
  const hints = new Set(blocks.map((b) => b.contentTypeHint).filter(Boolean));
  if (hints.size === 0) return 'text';
  if (hints.size === 1) return [...hints][0] as ChunkContentType;
  return 'mixed';
}

/**
 * Agrupa bloques (párrafos/encabezados) en chunks semánticos: nunca corta
 * un párrafo a la mitad, y siempre abre un chunk nuevo al cambiar de
 * capítulo/sección, aunque el chunk anterior no haya llegado al tamaño
 * objetivo.
 */
export function chunkPages(pages: PageForChunking[]): ChunkDraft[] {
  const blocks = splitIntoBlocks(pages).filter((b) => b.kind === 'paragraph' || b.text.length > 0);
  const chunks: ChunkDraft[] = [];

  let current: Block[] = [];
  let currentTokens = 0;
  let position = 0;

  const flush = () => {
    if (current.length === 0) return;
    const content = current.map((b) => b.text).join('\n\n');
    const pageNumbers = current.map((b) => b.pageNumber);
    chunks.push({
      pageStart: Math.min(...pageNumbers),
      pageEnd: Math.max(...pageNumbers),
      chapter: current[current.length - 1].chapter,
      section: current[current.length - 1].section,
      contentType: resolveContentType(current),
      position: position++,
      content,
      contentHash: createHash('sha256').update(content).digest('hex'),
      tokenCount: estimateTokens(content),
    });
    current = [];
    currentTokens = 0;
  };

  let lastChapter: string | null = null;
  let lastSection: string | null = null;

  for (const block of blocks) {
    const boundaryChanged =
      current.length > 0 && (block.chapter !== lastChapter || block.section !== lastSection);
    const blockTokens = estimateTokens(block.text);

    if (boundaryChanged || (currentTokens + blockTokens > MAX_TOKENS && current.length > 0)) {
      flush();
    }

    current.push(block);
    currentTokens += blockTokens;
    lastChapter = block.chapter;
    lastSection = block.section;

    if (currentTokens >= TARGET_TOKENS) {
      flush();
      lastChapter = null;
      lastSection = null;
    }
  }
  flush();

  return chunks;
}
