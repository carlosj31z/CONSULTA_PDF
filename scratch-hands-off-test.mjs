import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { createHash } from 'node:crypto';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const p = doc.addPage([400, 300]);
p.drawText(
  'CAPITULO 1: LOS VOLCANES\n\nUn volcan es una abertura en la corteza terrestre por donde sale material ' +
    'fundido llamado magma. Cuando el magma llega a la superficie se llama lava.',
  { x: 30, y: 220, size: 11, font, color: rgb(0, 0, 0), lineHeight: 15, maxWidth: 340 },
);
const bytes = await doc.save();
const fileHash = createHash('sha256').update(bytes).digest('hex');

const { data: document } = await supabase
  .from('documents')
  .insert({ title: 'Prueba GitHub Actions sin manos', file_hash: fileHash, storage_path: '', mime_type: 'application/pdf', file_size_bytes: bytes.byteLength, status: 'pending' })
  .select('*').single();
const path = `${document.id}/original.pdf`;
await supabase.storage.from('documents').upload(path, Buffer.from(bytes), { contentType: 'application/pdf' });
await supabase.from('documents').update({ storage_path: path }).eq('id', document.id);
await supabase.from('processing_jobs').insert({ document_id: document.id, status: 'queued' });

console.log('DOCUMENT_ID=' + document.id);
console.log('Subido y encolado. NO se va a tocar manualmente -- que lo procese solo el GitHub Action.');
