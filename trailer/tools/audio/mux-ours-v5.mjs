#!/usr/bin/env node
// Ours v5 = l'image des ours v4 copiée sans réencodage (-c:v copy) + qa/mix-v5.wav encodé en AAC (sans -shortest).
//   livraison/LKDV-ours-v5.mp4        ← livraison/LKDV-ours-v4.mp4        + AAC 320 kb/s
//   livraison/LKDV-ours-v5-mobile.mp4 ← livraison/LKDV-ours-v4-mobile.mp4 + AAC 192 kb/s (doit rester sous 28 Mo)
// Contrôles : images comptées, durées image/son/conteneur, empreinte MD5 du flux image identique à la v4, EBU R128 du son.
// Usage : node tools/audio/mux-ours-v5.mjs
import { statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QA_DIR, QA_TMP, TRAILER, ffmpegVersion, loudness, run } from './lib.mjs';

const LIV = join(TRAILER, 'livraison'), MIX = join(QA_DIR, 'mix-v5.wav');
const jobs = [
  { src: join(LIV, 'LKDV-ours-v4.mp4'), out: join(LIV, 'LKDV-ours-v5.mp4'), kb: 320 },
  { src: join(LIV, 'LKDV-ours-v4-mobile.mp4'), out: join(LIV, 'LKDV-ours-v5-mobile.mp4'), kb: 192, maxBytes: 28e6 },
];
const vmd5 = (f) => run('ffmpeg', ['-v', 'error', '-i', f, '-map', '0:v:0', '-c', 'copy', '-f', 'md5', '-']).stdout.trim();
const report = { ffmpeg: ffmpegVersion(), films: [] };
let ok = true;
for (const j of jobs) {
  run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', j.src, '-i', MIX, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', `${j.kb}k`, '-aac_pns', '0', '-ar', '48000', '-movflags', '+faststart', j.out]);
  const pr = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,nb_read_frames,duration,bit_rate:format=duration', '-of', 'json', j.out]).stdout);
  const v = pr.streams.find((s) => s.codec_type === 'video'), a = pr.streams.find((s) => s.codec_type === 'audio');
  const l = loudness(j.out);
  const size = statSync(j.out).size;
  const same = vmd5(j.src) === vmd5(j.out);
  const r = { out: j.out, images: Number(v.nb_read_frames), dureeImage: Number(v.duration), dureeSon: Number(a.duration), conteneur: Number(pr.format.duration),
    sonKbps: Math.round(Number(a.bit_rate) / 1000), octets: size, imageIdentiqueV4: same, ...l };
  report.films.push(r);
  const good = r.images === 1440 && Math.abs(r.dureeImage - 60) < 0.0005 && Math.abs(r.dureeSon - 60) < 0.0005 && same &&
    Math.abs(l.integrated + 14) <= 0.3 && l.truePeak <= -1 && (!j.maxBytes || size < j.maxBytes);
  ok &&= good;
  console.log(`${good ? '✓' : '✗'} ${j.out}\n  ${r.images} images · image ${r.dureeImage} s · son ${r.dureeSon} s (aac ${r.sonKbps} kb/s) · conteneur ${r.conteneur} s · ${(size / 1e6).toFixed(2)} Mo · image identique à la v4 : ${same}\n  ebur128 : ${l.integrated} LUFS · LRA ${l.lra} LU · crête vraie ${l.truePeak} dBTP`);
}
writeFileSync(join(QA_TMP, 'ours-v5.json'), JSON.stringify(report, null, 2));
if (!ok) process.exit(1);
