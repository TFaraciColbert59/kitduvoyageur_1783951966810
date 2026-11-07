#!/usr/bin/env node
/**
 * LKDV — prépare un master de sac avant la fabrication des paliers.
 *
 * Deux opérations, toutes deux issues du lot G :
 *
 * 1. **Remplace la texture de couleur de base par l'albédo délié.** L'atlas Meshy porte de la
 *    lumière peinte, héritée des images de référence qui étaient déjà éclairées : des plis et des
 *    ombres cuits dans la couleur, qu'aucun éclairage du moteur ne peut défaire, et qui donnent au
 *    tissu son aspect de plastique froissé. Le délié la remplace, il ne s'y ajoute pas : le fichier
 *    ne grossit pas.
 *
 * 2. **Écrit la carte de zones à côté**, en WebP. Trois canaux : rouge le tissu, vert les sangles et
 *    le textile technique, bleu la quincaillerie. C'est elle qui permet de teinter le seul tissu, de
 *    n'allumer la lueur textile que sur le textile, et de donner aux boucles leur propre rugosité.
 *    Sans elle, teinter repeindrait l'écusson et les boucles.
 *
 * Usage :
 *   node scripts/kit-studio/prepare-bag-atlas.mjs --masters <dossier> --maps <dossier> --out <dossier>
 *     [--zones-size 1024] [--albedo-quality 90] [--only B45]
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function arg(nom, defaut = null) {
  const i = process.argv.indexOf(nom);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : defaut;
}

function lireGlb(chemin) {
  const b = readFileSync(chemin);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${chemin} n'est pas un GLB`);
  const total = b.readUInt32LE(8);
  let o = 12; let json = null; let bin = null;
  while (o < total) {
    const len = b.readUInt32LE(o); const type = b.readUInt32LE(o + 4); const s = o + 8;
    if (type === CHUNK_JSON) json = JSON.parse(b.subarray(s, s + len).toString('utf8'));
    else if (type === CHUNK_BIN) bin = b.subarray(s, s + len);
    o = s + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error(`${chemin} : chunk JSON introuvable`);
  return { json, bin: bin ?? Buffer.alloc(0) };
}

function ecrireGlb(json, bin) {
  const pad = (buf, filler) => {
    const r = buf.length % 4;
    return r === 0 ? buf : Buffer.concat([buf, Buffer.alloc(4 - r, filler)]);
  };
  const j = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const bn = bin.length ? pad(Buffer.from(bin), 0x00) : null;
  const total = 12 + 8 + j.length + (bn ? 8 + bn.length : 0);
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;
  out.writeUInt32LE(j.length, o); o += 4;
  out.writeUInt32LE(CHUNK_JSON, o); o += 4;
  j.copy(out, o); o += j.length;
  if (bn) {
    out.writeUInt32LE(bn.length, o); o += 4;
    out.writeUInt32LE(CHUNK_BIN, o); o += 4;
    bn.copy(out, o);
  }
  return out;
}

/** Index de l'image servant de couleur de base au matériau principal. */
function imageCouleurDeBase(json) {
  for (const mat of json.materials ?? []) {
    const idx = mat.pbrMetallicRoughness?.baseColorTexture?.index;
    if (idx == null) continue;
    const tex = json.textures?.[idx];
    const src = tex?.extensions?.EXT_texture_webp?.source ?? tex?.source;
    if (src != null) return src;
  }
  return null;
}

/**
 * Remplace les octets d'une image du GLB. Les vues de tampon sont reconstruites dans un binaire
 * neuf : la nouvelle image n'a aucune raison de faire exactement la taille de l'ancienne.
 */
function remplacerImage(json, bin, indexImage, octets, mimeType) {
  const vues = json.bufferViews ?? [];
  const vueCible = json.images[indexImage].bufferView;
  const tailles = vues.map((v, i) => (i === vueCible ? octets.length : v.byteLength));
  const aligne = (n) => (n % 4 ? n + (4 - (n % 4)) : n);
  const decalages = [];
  let total = 0;
  for (const t of tailles) { decalages.push(total); total += aligne(t); }

  const sortie = Buffer.alloc(total);
  vues.forEach((v, i) => {
    if (i === vueCible) octets.copy(sortie, decalages[i]);
    else bin.copy(sortie, decalages[i], v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  });

  const neuf = {
    ...json,
    bufferViews: vues.map((v, i) => {
      const { byteStride, ...reste } = v;
      // Une vue d'image ne porte jamais de pas d'entrelacement, et en laisser un serait invalide.
      const base = i === vueCible ? reste : v;
      return { ...base, byteOffset: decalages[i], byteLength: tailles[i] };
    }),
    images: json.images.map((im, i) => (i === indexImage ? { ...im, mimeType } : im)),
    buffers: [{ byteLength: total }],
  };
  return { json: neuf, bin: sortie };
}

function trouver(dossier, motif) {
  const f = readdirSync(dossier).filter((n) => motif.test(n));
  if (f.length === 0) return null;
  if (f.length > 1) throw new Error(`plusieurs fichiers pour ${motif} dans ${dossier} : ${f.join(', ')}`);
  return join(dossier, f[0]);
}

async function main() {
  const masters = resolve(arg('--masters') ?? (() => { throw new Error('--masters est obligatoire'); })());
  const maps = resolve(arg('--maps') ?? (() => { throw new Error('--maps est obligatoire'); })());
  const out = resolve(arg('--out', join('dist', 'bag-masters-prepares')));
  const tailleZones = Number(arg('--zones-size', 1024));
  const qualite = Number(arg('--albedo-quality', 90));
  const seulement = arg('--only');

  for (const d of [masters, maps]) if (!existsSync(d)) throw new Error(`dossier introuvable : ${d}`);
  mkdirSync(out, { recursive: true });
  mkdirSync(join(out, 'zones'), { recursive: true });

  const codes = [...new Set(readdirSync(masters)
    .map((n) => n.match(/B\d{2}/)?.[0])
    .filter(Boolean))].filter((c) => !seulement || c === seulement).sort();
  if (codes.length === 0) throw new Error(`aucun master reconnu dans ${masters}`);

  for (const code of codes) {
    const master = trouver(masters, new RegExp(`${code}.*\\.glb$`, 'i'));
    const delit = trouver(maps, new RegExp(`^LKDV_${code}_ALBEDO_DELIT_V2\\.png$`, 'i'))
      ?? trouver(maps, new RegExp(`^LKDV_${code}_ALBEDO_DELIT\\.png$`, 'i'));
    // Ancré : « LKDV_B45_ZONES.png » et non « LKDV_B45_PLANCHE_ZONES.png », qui est une vue de contrôle.
    const zones = trouver(maps, new RegExp(`^LKDV_${code}_ZONES\\.png$`, 'i'));
    if (!master) throw new Error(`${code} : master introuvable`);
    if (!delit) throw new Error(`${code} : albédo délié introuvable`);
    if (!zones) throw new Error(`${code} : carte de zones introuvable`);

    const { json, bin } = lireGlb(master);
    const idx = imageCouleurDeBase(json);
    if (idx == null) throw new Error(`${code} : aucune texture de couleur de base dans le GLB`);

    const ancienne = json.bufferViews[json.images[idx].bufferView].byteLength;
    const meta = await sharp(delit).metadata();
    const octets = await sharp(delit).webp({ quality: qualite }).toBuffer();
    const prep = remplacerImage(json, bin, idx, octets, 'image/webp');
    const chemin = join(out, `${code}.glb`);
    writeFileSync(chemin, ecrireGlb(prep.json, prep.bin));

    // La carte de zones est un masque : le WebP sans perte évite que la compression fasse déborder
    // une zone sur sa voisine, ce qui se verrait comme une boucle teintée.
    //
    // Avant d'encoder, on recale les aplats. Le masque sort du traitement avec du bruit de
    // quantification au centre des grandes zones — des 253 et des 2 là où il n'y a rien à nuancer —
    // qui ne change rien au rendu mais coûte cher en entropie. On colle les extrêmes et on quantifie
    // le reste par pas de 16 : le fichier passe de 470 à 169 Ko sans perdre un pixel de résolution,
    // et les vraies transitions de bord sont conservées.
    const cheminZones = join(out, 'zones', `${code}.zones.webp`);
    const brut = await sharp(zones).resize(tailleZones, tailleZones, { fit: 'fill' })
      .raw().toBuffer({ resolveWithObject: true });
    const px = brut.data;
    for (let i = 0; i < px.length; i++) {
      const v = px[i];
      px[i] = v <= 10 ? 0 : v >= 245 ? 255 : Math.round(v / 16) * 16;
    }
    await sharp(px, { raw: { width: brut.info.width, height: brut.info.height, channels: brut.info.channels } })
      .webp({ lossless: true }).toFile(cheminZones);

    const ko = (n) => `${Math.round(n / 1024)} Ko`;
    console.log(`${code} : albédo ${meta.width}×${meta.height}, ${ko(ancienne)} → ${ko(octets.length)}`
      + ` | zones ${tailleZones}² ${ko(statSync(cheminZones).size)}`
      + ` | master ${Math.round(statSync(chemin).size / 1048576)} Mo`);
  }
  console.log(`\nMasters préparés : ${out}`);
  console.log(`Cartes de zones  : ${join(out, 'zones')}`);
}

main().catch((err) => {
  console.error(`\nÉCHEC : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
