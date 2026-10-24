// Prépare les images de la maquette du Compas (docs/compas/maquette-img/) depuis les photos du dépôt.
// Usage : node scripts/compas/_maquette-images.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'public/assets/images';
const OUT = 'docs/compas/maquette-img';
fs.mkdirSync(OUT, { recursive: true });

const square = 360; // produits : carré, fond lin conservé
const wide = [720, 440]; // photos d'hébergement et de journée
const jobs = [
  ['product-backpack.jpg', 'p-sac.webp', square],
  ['product-backpack-2.jpg', 'p-sac2.webp', square],
  ['product-bottle.jpg', 'p-gourde.webp', square],
  ['product-headlamp.jpg', 'p-frontale.webp', square],
  ['product-jacket.jpg', 'p-veste.webp', square],
  ['product-sleeping.jpg', 'p-duvet.webp', square],
  ['product-tent.jpg', 'p-tente.webp', square],
  ['hero-misty.jpg', 'h-gite-royans.webp', wide],
  ['community-morning.jpg', 'h-coulmes.webp', wide],
  ['club-alpin.jpg', 'h-camping.webp', wide],
  ['workshop.jpg', 'h-gite-correncon.webp', wide],
  ['journal-refuge.jpg', 'h-refuge.webp', wide],
  ['adventure-bivouac.jpg', 'h-bivouac.webp', wide],
  ['forest-1.jpg', 'd-1.webp', wide],
  ['urban-vintage.jpg', 'd-2.webp', wide],
  ['detail-hero.jpg', 'd-3.webp', wide],
  ['lake-1.jpg', 's-calme.webp', [240, 240]],
  ['mountain-1.jpg', 's-gr20.webp', [240, 240]]
];
for (const [src, out, size] of jobs) {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  await sharp(path.join(SRC, src)).resize(w, h, { fit: 'cover', position: 'centre' }).webp({ quality: 68 }).toFile(path.join(OUT, out));
}
const total = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${jobs.length} images, ${Math.round(total / 1024)} Ko`);
