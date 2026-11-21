// Étalonnage de l'ours (à partir de la v4) : chaîne de filtres ffmpeg pour un segment déjà coupé et mis à 1920×1080.
//
// Utilisé par tools/montage/build-ours.mjs (et par les outils de réglage) :
//   import { filtreEtalonnage, etalonnageActif } from "./etalonnage.mjs";
//   node tools/montage/etalonnage.mjs montage/edl-ours-v4.json P50 [bt601|bt709]   → affiche le filter_complex
//
// Champs de la liste de montage (tous facultatifs ; sans eux, rien ne change) :
//   edl.etalonnage = {
//     lut: "montage/luts/lkdv-v4.cube",   // look commun (relatif à trailer/), appliqué après la correction du plan
//     adoucissement: 0.2,                  // flou partiel de la luminance (unsharp négatif 5×5), 0 = aucun
//     grain: { force: 1, taille: 0.6 },    // grain de luminance, posé en dernier (mode overlay : moins dans les noirs
//                                          // et les blancs), force ≈ écart type en niveaux 8 bits dans les tons moyens
//   }
//   plan.etalonnage = {                    // correction du plan, appliquée AVANT le look commun, dans cet ordre :
//     gain: [r, g, b],                     //   gains par canal (balance), 1 = neutre
//     temperature: 0,                      //   > 0 plus chaud, < 0 plus froid (≈ ±5 % sur R et B par unité)
//     teinte: 0,                           //   > 0 vers le magenta, < 0 vers le vert
//     exposition: 0,                       //   en diaphs (gain 2^(ev/2,2) sur les valeurs codées)
//     gamma: 1,                            //   > 1 éclaircit les tons moyens
//     noir: 0,                             //   relève (> 0) ou écrase (< 0) le noir, en fraction de la pleine échelle
//     blanc: 1,                            //   niveau de sortie du blanc (< 1 retient les hautes lumières)
//     saturation: 1,                       //   matrice à luminance constante (Rec.709)
//     ombres: [r, g, b], milieux: [r, g, b], hautes: [r, g, b],   // colorbalance, −1…1, luminosité conservée
//     filtres: "…",                        //   chaîne ffmpeg libre (RGB 16 bits), après ce qui précède
//     look: 1,                             // part du look commun (0–1) ; < 1 = mélange avec l'image corrigée
//     adoucissement: null,                 // remplace l'adoucissement global pour ce plan
//     grain: 1,                            // multiplie la force du grain global pour ce plan
//   }
// Chaîne : entrée YUV (matrice de la source : bt601 pour les vidéos Flow, bt709 pour le code) → RGB 16 bits →
// correction du plan → look commun → YUV 4:4:4 16 bits Rec.709 → adoucissement → grain → yuv420p Rec.709.

import { resolve } from "node:path";

const r4 = (x) => Number(x).toFixed(4);
const KR = 0.2126, KG = 0.7152, KB = 0.0722;

export function etalonnageActif(edl) {
  return Boolean(edl.etalonnage) || edl.plans.some((p) => p.etalonnage);
}

function gains(e) {
  let [r, g, b] = e.gain ?? [1, 1, 1];
  const t = e.temperature ?? 0, ti = e.teinte ?? 0;
  r *= 1 + 0.05 * t; b *= 1 - 0.05 * t; g *= 1 - 0.04 * ti;
  // gains renormalisés à luminance constante (la balance ne change pas l'exposition)
  const y = KR * r + KG * g + KB * b;
  const ev = 2 ** ((e.exposition ?? 0) / 2.2);
  return [r / y * ev, g / y * ev, b / y * ev];
}

// Correction du plan en RGB 16 bits (sans conversion de format).
export function correctionPlan(e, trailer) {
  if (!e) return [];
  const f = [];
  const [gr, gg, gb] = gains(e);
  const gam = e.gamma ?? 1, n = e.noir ?? 0, w = e.blanc ?? 1;
  if (gr !== 1 || gg !== 1 || gb !== 1 || gam !== 1 || n !== 0 || w !== 1) {
    // y = noir + (blanc − noir) × (gain × x)^(1/gamma), borné à 0–1
    const ch = (g) => `clip(maxval*(${r4(n)}+${r4(w - n)}*pow(min(${r4(g)}*val/maxval\\,1)\\,${r4(1 / gam)}))\\,0\\,maxval)`;
    f.push(`lutrgb=r='${ch(gr)}':g='${ch(gg)}':b='${ch(gb)}'`);
  }
  const s = e.saturation ?? 1;
  if (s !== 1) {
    const KRGB = [KR, KG, KB];
    const m = (a, i) => r4(i === a ? KRGB[a] * (1 - s) + s : KRGB[i] * (1 - s));
    f.push(`colorchannelmixer=rr=${m(0, 0)}:rg=${m(0, 1)}:rb=${m(0, 2)}:gr=${m(1, 0)}:gg=${m(1, 1)}:gb=${m(1, 2)}:br=${m(2, 0)}:bg=${m(2, 1)}:bb=${m(2, 2)}`);
  }
  const cb = [];
  for (const [k, p] of [["ombres", "s"], ["milieux", "m"], ["hautes", "h"]]) {
    if (!e[k]) continue;
    const [a, b, c] = e[k];
    if (a) cb.push(`r${p}=${r4(a)}`);
    if (b) cb.push(`g${p}=${r4(b)}`);
    if (c) cb.push(`b${p}=${r4(c)}`);
  }
  if (cb.length) f.push(`colorbalance=${cb.join(":")}:pl=1`);
  if (e.filtres) f.push(e.filtres);
  return f;
}

// filter_complex complet : [0:v] → [v]. matrice : "bt601" ou "bt709" (matrice YUV du segment d'entrée).
// surcouches (facultatif, v6) : { avant: "[1:v]", apres: "[2:v]" } étiquettes d'entrées RGBA (PNG avec transparence)
// posées AVANT le grain (après le look commun et l'adoucissement : elles prennent le grain du film) et APRÈS le grain
// (bandes du cadre, couleur exacte). Sans ce paramètre, la chaîne est identique à celle des listes v4.
function poser(entree, label, sortie) {
  // RGBA (sRGB plein, alpha non prémultiplié) → couleur en YUV 4:4:4 16 bits Rec.709 limité + masque = alpha sur les trois
  // plans, puis fusion maskedmerge en 16 bits : base + (surcouche − base) × alpha (overlay de ffmpeg 6.0 n'a pas de 4:4:4
  // plus de 8 bits). Horloges remises à 1/24 (sinon framesync double des images : pts 0,042 contre 0,0417).
  return [`${label}settb=1/24,setpts=N,format=rgba,split[${sortie}c][${sortie}x]`,
    `[${sortie}c]scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv444p16le[${sortie}o]`,
    `[${sortie}x]alphaextract,format=gray16le,mergeplanes=0x000000:yuv444p16le[${sortie}m]`,
    `[${entree}]settb=1/24,setpts=N,format=yuv444p16le[${sortie}b]`,
    `[${sortie}b][${sortie}o][${sortie}m]maskedmerge[${sortie}]`];
}

export function filtreEtalonnage(edl, plan, { matrice = "bt709", trailer = process.cwd(), seed = 1, largeur = 1920, hauteur = 1080, surcouches = null } = {}) {
  const G = edl.etalonnage ?? {};
  const e = plan.etalonnage ?? {};
  const parts = [];
  const head = [`scale=in_color_matrix=${matrice}:in_range=tv:flags=accurate_rnd+full_chroma_int`, "format=gbrp16le", ...correctionPlan(e, trailer)];
  const look = e.look ?? 1;
  const lut = G.lut ? `lut3d=file='${resolve(trailer, G.lut).replace(/'/g, "\\'")}':interp=tetrahedral` : null;
  if (lut && look >= 1) head.push(lut);
  if (lut && look > 0 && look < 1) {
    parts.push(`[0:v]${head.join(",")},split[a][b]`);
    parts.push(`[b]${lut}[l]`);
    parts.push(`[a][l]blend=all_mode=normal:all_opacity=${r4(look)}[c]`);
  } else {
    parts.push(`[0:v]${head.join(",")}[c]`);
  }
  const tail = [`scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int`, "format=yuv444p16le"];
  const soft = e.adoucissement ?? G.adoucissement ?? 0;
  if (soft > 0) {
    const sz = soft > 0.5 ? 7 : 5;
    tail.push(`unsharp=lx=${sz}:ly=${sz}:la=${r4(-soft)}:cx=5:cy=5:ca=${r4(-Math.min(soft, 0.5))}`);
  }
  const gr = G.grain ? (G.grain.force ?? 1) * (e.grain ?? 1) : 0;
  const av = surcouches?.avant, ap = surcouches?.apres;
  const setp = "setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709";
  if (gr > 0) {
    if (av) {
      parts.push(`[c]${tail.join(",")}[d0]`);
      parts.push(...poser("d0", av, "d"));
    } else parts.push(`[c]${tail.join(",")}[d]`);
    // Couche de grain : gris moyen + bruit gaussien temporel, légèrement flouté (grain plus fin qu'un pixel bruité),
    // fusionnée en overlay sur la luminance seule.
    const amp = Math.max(1, Math.round(gr * 6));
    const sig = G.grain.taille ?? 0.6;
    parts.push(`color=c=0x808080:s=${largeur}x${hauteur}:r=24,format=yuv444p,lutyuv=y=128:u=128:v=128,noise=c0s=${amp}:c0f=t:all_seed=${seed},format=yuv444p16le` +
      (sig > 0 ? `,gblur=sigma=${r4(sig)}:planes=1` : "") + `[g]`);
    parts.push(`[d][g]blend=c0_mode=overlay:c1_mode=normal:c1_opacity=1:c2_mode=normal:c2_opacity=1:shortest=1[e]`);
    if (ap) {
      parts.push(...poser("e", ap, "f"));
      parts.push(`[f]format=yuv420p,${setp}[v]`);
    } else parts.push(`[e]format=yuv420p,${setp}[v]`);
  } else if (av || ap) {
    parts.push(`[c]${tail.join(",")}[d0]`);
    let cur = "d0";
    if (av) { parts.push(...poser(cur, av, "d1")); cur = "d1"; }
    if (ap) { parts.push(...poser(cur, ap, "d2")); cur = "d2"; }
    parts.push(`[${cur}]format=yuv420p,${setp}[v]`);
  } else {
    tail.push("format=yuv420p", setp);
    parts.push(`[c]${tail.join(",")}[v]`);
  }
  return parts.join(";");
}

// matrice YUV d'un segment d'après la balise color_space de ffprobe
export function matriceDe(colorSpace) {
  return ["smpte170m", "bt470bg", "bt601"].includes(colorSpace) ? "bt601" : "bt709";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [edlPath, planName, mat] = process.argv.slice(2);
  const { readFileSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const trailer = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const edl = JSON.parse(readFileSync(resolve(process.cwd(), edlPath), "utf8"));
  const idx = edl.plans.findIndex((p) => p.plan === planName);
  if (idx < 0) { console.error(`plan ${planName} absent`); process.exit(2); }
  process.stdout.write(filtreEtalonnage(edl, edl.plans[idx], { matrice: mat || "bt709", trailer, seed: idx + 1 }));
}
