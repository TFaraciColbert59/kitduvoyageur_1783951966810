#!/usr/bin/env node
/**
 * LKDV — téléverse les masters 3D des sacs dans Supabase Storage.
 *
 * Les masters (palier « hd ») ne vivent pas dans le dépôt : quarante mégaoctets par sac, et Git
 * comme Vercel n'ont rien à faire de ça. Ils vont dans le bucket `bag-models`, public en lecture,
 * et le Studio ne les sert qu'aux appareils dont la capacité est prouvée.
 *
 * Fabriquer les fichiers d'abord :
 *   node scripts/kit-studio/build-bag-tiers.mjs --src <dossier des masters Meshy>
 *
 * Puis, avec la clé de service dans l'environnement et nulle part ailleurs — jamais dans un
 * fichier, jamais dans l'historique du shell :
 *   read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
 *   node scripts/kit-studio/upload-bag-models.mjs
 *
 * Options :
 *   --dir <dossier>   source des .hd.glb (défaut dist/bag-models-hd)
 *   --bucket <nom>    bucket de destination (défaut bag-models)
 *   --dry-run         liste ce qui serait envoyé, sans rien envoyer
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const URL_PROJET = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function arg(nom, defaut = null) {
  const i = process.argv.indexOf(nom);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1]
    : defaut;
}
const blanc = process.argv.includes('--dry-run');
const dossier = resolve(arg('--dir', join('dist', 'bag-models-hd')));
const bucket = arg('--bucket', 'bag-models');

function mo(n) { return `${(n / 1048576).toFixed(1)} Mo`; }

async function main() {
  if (!existsSync(dossier)) {
    throw new Error(`dossier introuvable : ${dossier}\nLancez d'abord build-bag-tiers.mjs.`);
  }
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.glb')).sort();
  if (fichiers.length === 0) throw new Error(`aucun .glb dans ${dossier}`);

  const total = fichiers.reduce((n, f) => n + statSync(join(dossier, f)).size, 0);
  console.log(`source  : ${dossier}`);
  console.log(`bucket  : ${bucket} sur ${URL_PROJET}`);
  console.log(`à envoyer : ${fichiers.length} fichiers, ${mo(total)}\n`);

  if (blanc) {
    for (const f of fichiers) console.log(`  (à blanc) ${f} — ${mo(statSync(join(dossier, f)).size)}`);
    console.log('\nRien envoyé : --dry-run.');
    return;
  }
  if (!CLE) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY absent de l’environnement.\n' +
      'La clé ne doit jamais être écrite dans un fichier ni passée en argument. Faites :\n' +
      '  read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  let envoyes = 0;
  for (const nom of fichiers) {
    const chemin = join(dossier, nom);
    const octets = readFileSync(chemin);
    const empreinte = createHash('sha256').update(octets).digest('hex').slice(0, 16);
    const cible = `${URL_PROJET}/storage/v1/object/${bucket}/${basename(nom)}`;

    process.stdout.write(`  ${nom.padEnd(28)} ${mo(octets.length).padStart(9)} … `);
    const res = await fetch(cible, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${CLE}`,
        'content-type': 'model/gltf-binary',
        // Le master d'un sac est remplacé quand on le régénère : on écrase sciemment.
        'x-upsert': 'true',
        'cache-control': 'public, max-age=31536000, immutable',
      },
      body: octets,
    });
    if (!res.ok) {
      console.log('échec');
      throw new Error(`${nom} : HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
    }
    console.log(`ok (sha256 ${empreinte})`);
    envoyes += 1;
  }

  console.log(`\n${envoyes} fichier(s) en place.`);
  console.log(`Adresse publique : ${URL_PROJET}/storage/v1/object/public/${bucket}/<nom>`);
  console.log('Vérifiez une adresse au hasard dans un navigateur avant de déployer.');
}

main().catch((err) => {
  console.error(`\nÉCHEC : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
