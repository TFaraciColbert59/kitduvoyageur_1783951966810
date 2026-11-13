// Médias : photos réelles (Unsplash) pour le public, upload Storage pour les
// buckets privés (sorties, stories, documents). Cache par hash d'URL.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { db } from './client.mjs';
import { config } from './env.mjs';
import { withRetry } from './client.mjs';

const PHOTO_BASE = 'https://images.unsplash.com/photo-';

export function unsplash(photoId, width = 1400) {
  return `${PHOTO_BASE}${photoId}?auto=format&fit=crop&w=${width}&q=80`;
}

export function avatarUrl(n) {
  return `https://i.pravatar.cc/400?img=${n}`;
}

function cachePath(url) {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 24);
  return path.join(config.cacheDir, 'media', `${hash}.jpg`);
}

export async function downloadImage(url) {
  const file = cachePath(url);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    return fs.readFileSync(file);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buffer = await withRetry(`download ${url.slice(0, 60)}`, async () => {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`type ${type}`);
    return Buffer.from(await res.arrayBuffer());
  });
  fs.writeFileSync(file, buffer);
  return buffer;
}

export async function uploadImage({ bucket, storagePath, url }) {
  const buffer = await downloadImage(url);
  const { error } = await withRetry(`upload ${bucket}/${storagePath}`, () =>
    db.storage.from(bucket).upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '31536000',
    })
  );
  if (error) throw new Error(`upload ${bucket}/${storagePath}: ${error.message}`);
  return storagePath;
}

export async function uploadPdf({ bucket, storagePath, buffer }) {
  const { error } = await withRetry(`upload ${bucket}/${storagePath}`, () =>
    db.storage.from(bucket).upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
      cacheControl: '31536000',
    })
  );
  if (error) throw new Error(`upload ${bucket}/${storagePath}: ${error.message}`);
  return storagePath;
}

export function publicUrl(bucket, storagePath) {
  return db.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
}

export async function signedUrl(bucket, storagePath, expiresIn = 31_536_000) {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
  if (error) throw new Error(`signedUrl ${bucket}/${storagePath}: ${error.message}`);
  return data.signedUrl;
}

/** Petit PDF d'itinéraire, réel et lisible, pour les documents de voyage. */
export function itineraryPdf({ title, destination, days, notes }) {
  const lines = [
    `LKDV — Dossier de voyage`,
    ``,
    `Titre : ${title}`,
    `Destination : ${destination}`,
    `Duree : ${days} jours`,
    ``,
    ...notes.map((n, i) => `${i + 1}. ${n}`),
    ``,
    `Document de demonstration — Le Kit du Voyageur.`,
  ];
  const escaped = lines.map((l) => l.replace(/[()\\]/g, (m) => `\\${m}`));
  const content = [
    'BT',
    '/F1 14 Tf',
    '60 800 Td',
    ...escaped.flatMap((line) => [`(${line}) Tj`, '0 -20 Td']),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
