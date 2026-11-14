#!/usr/bin/env node
// Ours (premier montage de travail) à 24 i/s d'après une liste de montage (montage/edl-*.json).
//
//   node tools/montage/build-ours.mjs montage/edl-ours-v1.json [--sans-rendu-film] [--sans-reperes]
//
// Lancé depuis trailer/ (ou ailleurs : les chemins sont relatifs à trailer/). ffmpeg et ffprobe sont pris dans le
// PATH. Aucun étalonnage, aucune incrustation : les plans sont coupés à l'image près (décodage puis réencodage).
//
// Coupes : l'image de coupe du temps n est beats[n].frame de la grille (champ temps_musique de la liste).
// Un plan dure frame(debut + temps) − frame(debut) images ; un plan sans « temps » va jusqu'à images_total.
//
// Sources, résolues à chaque lancement (une relance prend d'elle-même les fichiers arrivés entre-temps) :
//   - COSMOS : ouverture-lab/renders/ouverture-v3.mp4 s'il existe et fait exactement la durée du plan ;
//     sinon ouverture-v2.mp4 étirée (mélange d'images) à la durée du plan, marquée provisoire.
//   - plans vidéo : <dossier_videos>/<source> ; si absent et qu'un « provisoire » est donné, celui-ci.
//   - plans « code » (P52, P53, P54) : rendu à 24 i/s des anciennes compositions du film (54,517–60,000 s
//     de l'ancien minutage, qa/tmp/ours/codas-film-24.mp4, rendu ici s'il manque, sauf --sans-rendu-film),
//     recalé à la durée de chaque plan ; à défaut, provisoires (voir codaProvisoire()).
// Vitesse ≠ 1 : on prend ceil(durée × vitesse) images sources à partir de « entree » et on les ramène à « durée »
// images par le filtre framerate (mélange linéaire des deux images voisines quand la position tombe entre deux).
// Si la source est trop courte, l'entrée recule du minimum nécessaire (jamais jusqu'à l'image 0) : signalé.
//
// Sorties : livraison/LKDV-ours-<v>.mp4 (propre) et livraison/LKDV-ours-<v>-reperes.mp4 (repères incrustés),
// manifeste qa/tmp/ours/manifeste.json (lu par tools/montage/controle-ours.py). Intermédiaires : qa/tmp/ours/.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, readdirSync, symlinkSync, lstatSync } from "node:fs";
import { basename, dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TRAILER = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rel = (p) => relative(TRAILER, p);
const args = process.argv.slice(2);
const edlArg = args.find((a) => !a.startsWith("--"));
if (!edlArg) {
  console.error("usage : node tools/montage/build-ours.mjs montage/edl-ours-v1.json [--sans-rendu-film] [--sans-reperes]");
  process.exit(2);
}
const EDL_PATH = resolve(process.cwd(), edlArg);
const edl = JSON.parse(readFileSync(EDL_PATH, "utf8"));
const grid = JSON.parse(readFileSync(resolve(TRAILER, edl.temps_musique), "utf8"));
const FPS = edl.ips;
const TOTAL = edl.images_total;
const VERSION = (basename(EDL_PATH).match(/ours-(v\d+)/) || [, "v1"])[1];
const TMP = resolve(TRAILER, "qa/tmp/ours");
const SEG = join(TMP, "segments");
const OUT_DIR = resolve(TRAILER, "livraison");
const OUT = join(OUT_DIR, `LKDV-ours-${VERSION}.mp4`);
const OUT_REP = join(OUT_DIR, `LKDV-ours-${VERSION}-reperes.mp4`);
const MUSIC = resolve(TRAILER, edl.musique);
const VIDEOS = resolve(TRAILER, edl.dossier_videos);
const OUV_DIR = resolve(TRAILER, "ouverture-lab/renders");
const CODAS = join(TMP, "codas-film-24.mp4");
const FOOTAGE = resolve(TRAILER, "assets/footage");
const LOGO = resolve(TRAILER, "../public/assets/logo-mark.svg");
const INK = "0x0B1F17";
const CREAM = "#FAF8F5";
// Ancien minutage du film à 60 i/s : P52 3271–3376, P53 3376–3480, P54 3480–3600.
const OLD = { start: 3271 / 60, P52: [3271, 3376], P53: [3376, 3480], P54: [3480, 3600] };

mkdirSync(SEG, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${argv.join(" ")}\n${(r.stderr || "").slice(-3000)}`);
  }
  return r.stdout;
}
const ffmpeg = (a) => run("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...a]);
function countFrames(p) {
  const o = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets,width,height,r_frame_rate", "-of", "json", p]);
  const s = JSON.parse(o).streams[0];
  return { frames: Number(s.nb_read_packets), width: s.width, height: s.height, rate: s.r_frame_rate };
}

// ---- grille ----
const beatFrame = (n) => {
  const b = grid.beats[n];
  if (!b) throw new Error(`temps ${n} absent de ${edl.temps_musique}`);
  return b.frame;
};

// ---- plans ----
const plans = edl.plans.map((p, i) => {
  const start = beatFrame(p.debut);
  const end = p.temps == null ? TOTAL : beatFrame(p.debut + p.temps);
  return { ...p, idx: i, start, end, n: end - start, remarques: [], provisoire: false };
});
for (let i = 0; i < plans.length; i++) {
  const nextStart = i + 1 < plans.length ? plans[i + 1].start : TOTAL;
  if (plans[i].end !== nextStart) throw new Error(`${plans[i].plan} finit à ${plans[i].end}, le suivant commence à ${nextStart}`);
}
if (plans[0].start !== 0 || plans.at(-1).end !== TOTAL) throw new Error("la liste ne couvre pas 0–" + TOTAL);

// Filtre de reprise de cadence : n images de sortie à partir de positions k × v (k = 0 … n−1) dans la source.
function retimeFilter(v) {
  if (v === 1) return "setpts=N/(24*TB)";
  // Entrée posée à 24·v i/s, sortie à 24 i/s : framerate mélange les deux images voisines (poids linéaire).
  return `setpts=N/(${(24 * v).toFixed(6)}*TB),framerate=fps=24:interp_start=0:interp_end=255:scene=100`;
}

// Extrait [a, a+count) d'une vidéo, optionnellement inversé, et ramène à n images. Écrit un segment FFV1.
function cutVideo(src, a, count, n, out, { reverse = false, speed = null } = {}) {
  const v = speed ?? (count === n ? 1 : (count - 1) / (n - 1));
  const chain = [`select='between(n\\,${a}\\,${a + count - 1})'`, "setpts=N/(24*TB)"];
  if (reverse) chain.push("reverse", "setpts=N/(24*TB)");
  if (v !== 1) chain.push(retimeFilter(v));
  chain.push("scale=1920:1080:flags=lanczos", "setsar=1", "format=yuv420p", "settb=1/24", "setpts=N");
  ffmpeg(["-i", src, "-an", "-vf", chain.join(","), "-frames:v", String(n), "-fps_mode", "passthrough", "-c:v", "ffv1", "-level", "3", out]);
  return v;
}

// ---- COSMOS : ouverture ----
function buildCosmos(p, out) {
  const v3 = join(OUV_DIR, "ouverture-v3.mp4");
  const v2 = join(OUV_DIR, "ouverture-v2.mp4");
  if (existsSync(v3)) {
    const m = countFrames(v3);
    if (m.frames === p.n) {
      cutVideo(v3, 0, p.n, p.n, out);
      p.sourceUsed = rel(v3);
      p.framesUsed = [0, p.n - 1];
      p.vitesseReelle = 1;
      return;
    }
    p.remarques.push(`ouverture-v3.mp4 présente mais ${m.frames} images (≠ ${p.n}) : ignorée`);
  }
  const m = countFrames(v2);
  const v = cutVideo(v2, 0, m.frames, p.n, out);
  p.sourceUsed = rel(v2);
  p.framesUsed = [0, m.frames - 1];
  p.vitesseReelle = v;
  p.provisoire = true;
  p.remarques.push(`provisoire : ouverture v2 (${m.frames} images) étirée à ${p.n} images, mélange d'images`);
}

// ---- plans vidéo ----
function buildVideo(p, out) {
  let src = join(VIDEOS, p.source);
  let entree = p.entree;
  let vitesse = p.vitesse ?? 1;
  if (!existsSync(src)) {
    const prov = edl.plans[p.idx].provisoire;
    if (!prov) throw new Error(`${p.plan} : ${rel(src)} absent et aucun provisoire`);
    p.remarques.push(`provisoire : ${p.source} absent, ${prov.source} à l'image ${prov.entree}`);
    p.provisoire = true;
    src = join(VIDEOS, prov.source);
    entree = prov.entree;
    vitesse = prov.vitesse ?? 1;
  }
  const m = countFrames(src);
  p.sourceFrames = m.frames;
  p.sourceSize = `${m.width}×${m.height}`;
  if (m.rate !== "24/1") p.remarques.push(`source à ${m.rate} i/s`);
  if (m.width !== 1920 || m.height !== 1080) p.remarques.push(`source ${m.width}×${m.height}, mise à 1920×1080`);
  // Positions k × vitesse (k = 0 … n−1) : images entree … entree + ceil((n−1) × vitesse).
  const count = vitesse === 1 ? p.n : Math.ceil((p.n - 1) * vitesse - 1e-9) + 1;
  if (entree + count > m.frames) {
    const e2 = m.frames - count;
    if (e2 < 1) throw new Error(`${p.plan} : ${basename(src)} trop courte (${m.frames} images) pour ${count} images sans partir de 0`);
    p.remarques.push(`source trop courte (${m.frames} images) : entrée reculée de ${entree} à ${e2}`);
    p.entreeReculee = { de: entree, a: e2 };
    entree = e2;
  }
  const v = cutVideo(src, entree, count, p.n, out, { speed: vitesse === 1 ? null : vitesse });
  p.sourceUsed = rel(src);
  p.framesUsed = [entree, entree + count - 1];
  p.vitesseReelle = v;
  if (vitesse !== 1) p.remarques.push(`accéléré ×${vitesse} (${count} images sources → ${p.n}, filtre framerate : mélange linéaire des deux images voisines)`);
}

// ---- plans « code » ----
function stageFilm() {
  const stage = join(TMP, "film-stage");
  const film = resolve(TRAILER, "film");
  rmSync(join(stage, "compositions"), { recursive: true, force: true });
  rmSync(join(stage, "lib"), { recursive: true, force: true });
  mkdirSync(join(stage, "assets/footage"), { recursive: true });
  mkdirSync(join(stage, "assets/audio"), { recursive: true });
  cpSync(join(film, "compositions"), join(stage, "compositions"), { recursive: true });
  cpSync(join(film, "lib"), join(stage, "lib"), { recursive: true });
  for (const f of ["hyperframes.json", "meta.json", "package.json", "index.html", "shots.json", "crops.json"]) {
    if (existsSync(join(film, f))) cpSync(join(film, f), join(stage, f));
  }
  const link = (target, path) => {
    try { lstatSync(path); rmSync(path, { recursive: true, force: true }); } catch {}
    symlinkSync(target, path);
  };
  for (const e of readdirSync(join(film, "assets"))) {
    if (["footage", "audio", ".DS_Store"].includes(e)) continue;
    link(join(film, "assets", e), join(stage, "assets", e));
  }
  for (const f of readdirSync(FOOTAGE)) link(join(FOOTAGE, f), join(stage, "assets/footage", f));
  // Le film lit assets/audio/mix-v1.wav : silence de 60 s dans la copie (le son de l'ours vient de la musique v4).
  ffmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "60", "-c:a", "pcm_s16le", join(stage, "assets/audio/mix-v1.wav")]);
  return stage;
}
function renderCodas() {
  if (existsSync(CODAS)) return true;
  if (args.includes("--sans-rendu-film")) return false;
  const stage = stageFilm();
  console.log("rendu des anciennes compositions P52–P54 à 24 i/s (draft)…");
  const r = spawnSync("npx", ["hyperframes", "render", ".", "--start", String(OLD.start), "--end", "60", "--fps", "24", "--quality", "draft", "--workers", "2", "-o", CODAS], { cwd: stage, encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0 || !existsSync(CODAS)) {
    console.error("rendu du film en échec :\n" + ((r.stdout || "") + (r.stderr || "")).slice(-2000));
    return false;
  }
  return true;
}
function codaFromFilm(p, out) {
  // Images du rendu à 24 i/s : image k ↔ instant OLD.start + k/24 de l'ancien film.
  // Le rendu commence à l'image entière 24 i/s qui précède OLD.start (54,500 s) : image k ↔ 54,5 + k/24 s ;
  // une image appartient au plan dont l'intervalle [a60, b60) à 60 i/s contient son instant.
  const [a60, b60] = OLD[p.plan];
  const k0 = Math.floor(OLD.start * 24 + 1e-9);
  const a = Math.ceil((a60 / 60) * 24 - 1e-9) - k0;
  const total = countFrames(CODAS).frames;
  const b = Math.min(Math.ceil((b60 / 60) * 24 - 1e-9) - k0, total);
  const count = b - a;
  const v = cutVideo(CODAS, a, count, p.n, out);
  p.sourceUsed = rel(CODAS) + ` (film/compositions/${p.plan.toLowerCase()}.html)`;
  p.framesUsed = [a, b - 1];
  p.vitesseReelle = v;
  p.remarques.push(`ancienne composition (${b60 - a60} images à 60 i/s, ${count} à 24 i/s) recalée à ${p.n} images, ×${v.toFixed(3)}`);
}
function codaProvisoire(p, out) {
  p.provisoire = true;
  if (p.plan === "P52") {
    // Descente de l'ouverture (après l'arrivée de la Terre) lue à l'envers.
    const cos = plans[0];
    const src = resolve(TRAILER, cos.sourceUsed);
    const m = countFrames(src);
    // Début de la descente (Terre → nuages → ville → fenêtre) : image 80 en v2, 44 en v3 (lue de la fin vers cette image).
    const a = basename(src) === "ouverture-v2.mp4" ? 80 : 44;
    const count = m.frames - a;
    const v = cutVideo(src, a, count, p.n, out, { reverse: true });
    p.sourceUsed = rel(src);
    p.framesUsed = [m.frames - 1, a];
    p.vitesseReelle = v;
    p.remarques.push(`provisoire : descente de l'ouverture (images ${a}–${m.frames - 1}) lue à l'envers, ×${v.toFixed(3)}`);
  } else if (p.plan === "P53") {
    const img = join(FOOTAGE, "img39.png");
    const n = p.n;
    ffmpeg(["-loop", "1", "-framerate", "24", "-i", img, "-vf",
      `scale=3840:2160:flags=lanczos,zoompan=z='1+0.06*on/${n - 1}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=24,setsar=1,format=yuv420p`,
      "-frames:v", String(n), "-c:v", "ffv1", "-level", "3", out]);
    p.sourceUsed = rel(img);
    p.framesUsed = null;
    p.vitesseReelle = 1;
    p.remarques.push("provisoire : img39 fixe avec poussée lente (×1,00 → ×1,06)");
  } else if (p.plan === "P54") {
    const png = join(TMP, "logo-provisoire.png");
    const svg = readFileSync(LOGO, "utf8").replaceAll("currentColor", CREAM);
    writeFileSync(join(TMP, "logo-provisoire.svg"), svg);
    run("node", ["-e", `require('sharp')(${JSON.stringify(join(TMP, "logo-provisoire.svg"))},{density:2400}).resize(360,360).png().toFile(${JSON.stringify(png)}).catch(e=>{console.error(e);process.exit(1)})`], { cwd: TRAILER });
    ffmpeg(["-f", "lavfi", "-i", `color=c=${INK}:s=1920x1080:r=24`, "-i", png, "-filter_complex",
      "[0][1]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p", "-frames:v", String(p.n), "-c:v", "ffv1", "-level", "3", out]);
    p.sourceUsed = rel(LOGO);
    p.framesUsed = null;
    p.vitesseReelle = 1;
    p.remarques.push("provisoire : logo crème centré sur encre verte #0B1F17, sans texte");
  }
}

// ---- assemblage ----
const segs = [];
const filmOk = plans.some((p) => p.source === "code") ? renderCodas() : false;
for (const p of plans) {
  const out = join(SEG, `${String(p.idx).padStart(2, "0")}-${p.plan}.mkv`);
  // --reutiliser-segments : garde un segment déjà fait pour ce plan (même durée) ; ne pas l'utiliser si une source a changé.
  if (args.includes("--reutiliser-segments") && existsSync(out) && existsSync(join(TMP, "manifeste.json"))) {
    const old = JSON.parse(readFileSync(join(TMP, "manifeste.json"), "utf8")).plans.find((q) => q.plan === p.plan && q.n === p.n);
    if (old && countFrames(out).frames === p.n) {
      Object.assign(p, { sourceUsed: old.source, framesUsed: old.images_sources, vitesseReelle: old.vitesse_reelle, provisoire: old.provisoire, remarques: old.remarques, sourceFrames: old.source_images, entreeReculee: old.entree_reculee });
      segs.push(out);
      console.log(`${p.plan.padEnd(7)} segment réutilisé`);
      continue;
    }
  }
  if (p.source === "ouverture") buildCosmos(p, out);
  else if (p.source === "code") (filmOk ? codaFromFilm : codaProvisoire)(p, out);
  else buildVideo(p, out);
  const got = countFrames(out).frames;
  if (got !== p.n) throw new Error(`${p.plan} : ${got} images au lieu de ${p.n}`);
  segs.push(out);
  console.log(`${p.plan.padEnd(7)} ${String(p.start).padStart(4)}–${String(p.end - 1).padStart(4)}  ${String(p.n).padStart(3)} im  ${p.sourceUsed}${p.remarques.length ? "  · " + p.remarques.join(" ; ") : ""}`);
}

const list = join(TMP, "concat.txt");
writeFileSync(list, segs.map((s) => `file '${s}'`).join("\n") + "\n");
const enc = ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", "24",
  "-c:a", "aac", "-b:a", "320k", "-aac_pns", "0", "-ar", "48000", "-movflags", "+faststart"];
// Deux passes : l'image d'abord (exactement TOTAL images), puis le son ajouté par copie de l'image. Un -frames:v dans
// la même passe que le son arrête aussi la piste son (11 ms manquaient à 60,000 s).
const videoOnly = join(TMP, `ours-${VERSION}-image.mp4`);
ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-map", "0:v:0", "-frames:v", String(TOTAL), ...enc.slice(0, enc.indexOf("-c:a")), videoOnly]);
ffmpeg(["-i", videoOnly, "-i", MUSIC, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", ...enc.slice(enc.indexOf("-c:a")), OUT]);
console.log("→ " + rel(OUT));

// ---- version à repères ----
const sectionAt = (f) => grid.sections.find((s) => f >= s.frames[0] && f < s.frames[1])?.id ?? "";
if (!args.includes("--sans-reperes")) {
  const fonts = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Helvetica.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"];
  const font = process.env.OURS_FONT || fonts.find((f) => existsSync(f));
  if (!font) throw new Error("aucune police pour drawtext (OURS_FONT=…)");
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "’");
  const base = `fontfile='${font}':fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6`;
  const f = [];
  f.push(`drawtext=${base}:x=24:y=h-40:text='image %{eif\\:n\\:d}'`);
  for (const p of plans) {
    f.push(`drawtext=${base}:x=24:y=h-76:enable='between(n,${p.start},${p.end - 1})':text='${esc(`${p.plan}${p.provisoire ? " (provisoire)" : ""} · ${p.section}`)}'`);
  }
  for (let i = 0; i < grid.beats.length; i++) {
    const b = grid.beats[i];
    const e = i + 1 < grid.beats.length ? grid.beats[i + 1].frame - 1 : TOTAL - 1;
    f.push(`drawtext=${base}:x=180:y=h-40:enable='between(n,${b.frame},${e})':text='${esc(`temps ${i} · mesure ${b.filmBar}.${b.filmBeat}`)}'`);
  }
  const script = join(TMP, "reperes.filter");
  writeFileSync(script, `[0:v]${f.join(",\n")}[v]`);
  ffmpeg(["-i", OUT, "-filter_complex_script", script, "-map", "[v]", "-map", "0:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "24", "-c:a", "copy", "-movflags", "+faststart", OUT_REP]);
  console.log("→ " + rel(OUT_REP));
}

// ---- manifeste ----
writeFileSync(join(TMP, "manifeste.json"), JSON.stringify({
  edl: rel(EDL_PATH), version: VERSION, ips: FPS, images_total: TOTAL, sortie: rel(OUT), reperes: rel(OUT_REP),
  musique: rel(MUSIC), rendu_film: filmOk,
  plans: plans.map((p) => ({ plan: p.plan, section: p.section, debut: p.debut, temps: p.temps, start: p.start, end: p.end, n: p.n,
    source: p.sourceUsed, images_sources: p.framesUsed, vitesse_liste: p.vitesse ?? 1, vitesse_reelle: p.vitesseReelle,
    provisoire: p.provisoire, entree_reculee: p.entreeReculee ?? null, source_images: p.sourceFrames ?? null, remarques: p.remarques })),
}, null, 1));
console.log("→ " + rel(join(TMP, "manifeste.json")));
