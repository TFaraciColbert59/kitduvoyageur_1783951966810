#!/usr/bin/env node
/**
 * LKDV — fabrique les deux paliers de chaque sac à partir d'un seul master.
 *
 * Entrée : les GLB Meshy retexturés (un par sac), tels que livrés.
 * Sorties :
 *   public/assets/bags/<modelId>.glb            palier « web », moins de 900 Ko, part au déploiement
 *   public/assets/bags/<modelId>.manifest.json  manifeste commun, qui déclare les deux paliers
 *   dist/bag-models-hd/<modelId>.hd.glb         palier « hd », à téléverser dans Supabase Storage
 *   public/assets/bags/bags.index.json          index mis à jour
 *
 * Pourquoi deux paliers : un master Meshy pèse 37 à 50 Mo pour un million de triangles. Un dépôt
 * Git et un déploiement Vercel ne portent pas 218 Mo de binaires, et surtout un réseau mobile ne
 * les transfère pas en moins d'une minute — indépendamment de la puissance du téléphone. Le palier
 * web est donc servi par défaut, et le master seulement à un appareil dont la capacité est prouvée
 * (`scene/bag/tier.ts`).
 *
 * La décimation ne coûte presque rien visuellement : la finesse vit dans la carte de normales de
 * l'atlas, pas dans le maillage. Mesuré sur le B45, de 1 109 421 à 34 683 triangles : écart moyen
 * de 1,36 sur 255 entre les deux rendus, médiane 0, différences concentrées sur les arêtes de
 * silhouette.
 *
 * Usage :
 *   node scripts/kit-studio/build-bag-tiers.mjs --src <dossier> [--table <json>] [--only B45]
 *
 *   --src    dossier contenant les masters, nommés <code>*.glb (ex. LKDV_B45_VISUEL.glb)
 *   --table  table des modèles (défaut scripts/kit-studio/bags.lkdv-one.json)
 *   --only   ne traiter qu'un code (ex. B45)
 *   --base   préfixe public du dépôt distant pour les URL du palier hd
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RACINE = process.cwd();
const SORTIE_WEB = join(RACINE, 'public', 'assets', 'bags');
const SORTIE_HD = join(RACINE, 'dist', 'bag-models-hd');
const INDEX = join(SORTIE_WEB, 'bags.index.json');
const BASE_DEFAUT = 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/bag-models';

function arg(nom, defaut = null) {
  const i = process.argv.indexOf(nom);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Compte les triangles déclarés par le glTF. Lit le seul en-tête JSON, donc fonctionne aussi sur un
 * fichier compressé en meshopt, dont les données binaires ne sont pas décodables telles quelles.
 */
function compterTriangles(fichier) {
  const buf = readFileSync(fichier);
  const longueur = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + longueur).toString('utf8'));
  let n = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if ((prim.mode ?? 4) !== 4) continue;
      const acc = json.accessors[prim.indices != null ? prim.indices : prim.attributes.POSITION];
      n += Math.floor(acc.count / 3);
    }
  }
  return n;
}

function trouverMaster(dossier, code) {
  const fichiers = readdirSync(dossier).filter((f) => f.toLowerCase().endsWith('.glb') && f.includes(code));
  if (fichiers.length === 0) throw new Error(`aucun master trouvé pour ${code} dans ${dossier}`);
  if (fichiers.length > 1) throw new Error(`plusieurs masters pour ${code} : ${fichiers.join(', ')}`);
  return join(dossier, fichiers[0]);
}

function importer(entree, modele, tier, sortie) {
  return run(process.execPath, [
    join(RACINE, 'tools', 'bag-generator', 'import-model.mjs'),
    '--in', entree,
    '--model-id', modele.modelId,
    '--label', modele.label,
    '--height', String(modele.heightM),
    '--capacity', String(modele.capacityL),
    '--tier', tier,
    '--out', sortie,
  ]);
}

function main() {
  const src = arg('--src');
  if (!src) throw new Error('--src est obligatoire : le dossier des masters Meshy');
  const dossierSrc = resolve(src);
  if (!existsSync(dossierSrc)) throw new Error(`dossier introuvable : ${dossierSrc}`);

  const table = JSON.parse(readFileSync(arg('--table', join('scripts', 'kit-studio', 'bags.lkdv-one.json')), 'utf8'));
  const seulement = arg('--only');
  const base = arg('--base', BASE_DEFAUT).replace(/\/+$/, '');
  // Dossier des cartes de zones produites par prepare-bag-atlas.mjs. Sans lui, les sacs restent
  // affichables mais leur personnalisation de couleur est annoncée indisponible (D-07).
  const dossierZones = arg('--zones');
  const modeles = table.models.filter((m) => !seulement || m.code === seulement);
  if (modeles.length === 0) throw new Error(`aucun modèle ne correspond à --only ${seulement}`);

  mkdirSync(SORTIE_WEB, { recursive: true });
  mkdirSync(SORTIE_HD, { recursive: true });
  const tmp = join(RACINE, 'dist', '.bag-tiers-tmp');
  mkdirSync(tmp, { recursive: true });

  const entrees = [];

  for (const modele of modeles) {
    const master = trouverMaster(dossierSrc, modele.code);
    console.log(`\n=== ${modele.code} → ${modele.modelId}`);
    console.log(`master      : ${master} (${Math.round(statSync(master).size / 1048576)} Mo)`);

    // 1. Mise aux conventions du Studio, sur le master. L'importateur conserve l'atlas et pose
    //    l'échelle, l'orientation et le centrage sur un nœud racine : aucune donnée n'est réécrite.
    //    C'est l'étape qui doit venir en premier — elle lit les accesseurs pour mesurer, et ne sait
    //    donc pas lire un fichier déjà compressé en meshopt.
    const sortieHdTmp = join(tmp, `${modele.modelId}-hd`);
    importer(master, modele, 'hd', sortieHdTmp);
    const manifestHd = JSON.parse(readFileSync(join(sortieHdTmp, `${modele.modelId}.manifest.json`), 'utf8'));
    const entreeHd = JSON.parse(readFileSync(join(sortieHdTmp, 'bags.index.entry.json'), 'utf8'));

    // 2. Palier web : décimation et compression du master déjà normalisé. `optimize` redescend la
    //    transformation du nœud racine sur les nœuds de maillage en TRS, que le chargeur lit : la
    //    mise à l'échelle survit sans qu'on la réapplique.
    const glbWeb = join(SORTIE_WEB, `${modele.modelId}.glb`);
    run(join(RACINE, 'node_modules', '.bin', 'gltf-transform'), [
      'optimize', join(sortieHdTmp, `${modele.modelId}.glb`), glbWeb,
      '--compress', 'meshopt',
      '--texture-compress', 'webp',
      '--texture-size', '1024',
      '--simplify-error', '0.001',
    ]);

    // 3. Le master à son tour, prêt à téléverser.
    const glbHd = join(SORTIE_HD, `${modele.modelId}.hd.glb`);
    copyFileSync(join(sortieHdTmp, `${modele.modelId}.glb`), glbHd);

    const manifestWeb = { ...manifestHd, budget: { ...manifestHd.budget, triangles: compterTriangles(glbWeb) } };
    const entreeWeb = { ...entreeHd, triangles: manifestWeb.budget.triangles, bytes: statSync(glbWeb).size };

    // 4. Un seul manifeste, qui déclare les deux paliers. Le palier web fait foi pour tout le
    //    reste : c'est lui qui est servi par défaut, donc ses chiffres sont ceux à respecter.
    // La carte de zones voyage à côté du GLB : c'est elle qui dit où est le tissu, donc ce que la
    // couleur choisie a le droit de teindre. Sans elle, teinter repeindrait boucles et écusson.
    let zonesMapUrl;
    if (dossierZones) {
      const src = join(resolve(dossierZones), `${modele.code}.zones.webp`);
      if (existsSync(src)) {
        const dest = join(SORTIE_WEB, `${modele.modelId}.zones.webp`);
        copyFileSync(src, dest);
        zonesMapUrl = `/assets/bags/${modele.modelId}.zones.webp`;
        console.log(`zones       : ${Math.round(statSync(dest).size / 1024)} Ko`);
      } else {
        console.log(`zones       : absente pour ${modele.code}, personnalisation indisponible`);
      }
    }

    const manifeste = {
      ...manifestWeb,
      tier: undefined,
      zonesMapUrl,
      assets: {
        web: {
          url: `/assets/bags/${modele.modelId}.glb`,
          bytes: statSync(glbWeb).size,
          triangles: manifestWeb.budget.triangles,
        },
        hd: {
          url: `${base}/${modele.modelId}.hd.glb`,
          bytes: statSync(glbHd).size,
          triangles: manifestHd.budget.triangles,
        },
      },
    };
    delete manifeste.tier;
    if (zonesMapUrl === undefined) delete manifeste.zonesMapUrl;
    // La personnalisation de couleur redevient possible dès qu'un masque existe : la teinte ne
    // touchera que la zone tissu. Sans masque, la liste reste vide et l'interface le dit.
    manifeste.capabilities = {
      ...manifeste.capabilities,
      customizableParts: zonesMapUrl ? ['body'] : [],
    };
    writeFileSync(join(SORTIE_WEB, `${modele.modelId}.manifest.json`), JSON.stringify(manifeste, null, 2));

    // `source` distingue les deux familles de l'index : les sacs du générateur maison, découpés en
    // pièces nommées et personnalisables, et les sacs importés, d'un seul tenant et texturés.
    const entree = { ...entreeWeb, source: 'imported', tiers: ['web', 'hd'] };
    delete entree.tier;
    entrees.push(entree);

    const ko = (n) => `${Math.round(n / 1024)} Ko`;
    console.log(`web         : ${manifeste.assets.web.triangles} tri, ${ko(manifeste.assets.web.bytes)}`);
    console.log(`hd          : ${manifeste.assets.hd.triangles} tri, ${Math.round(manifeste.assets.hd.bytes / 1048576)} Mo`);
    if (manifeste.assets.web.bytes > 900 * 1024) {
      throw new Error(`${modele.modelId} : le palier web dépasse 900 Ko, budget de l'index`);
    }
  }

  // 5. Index : on remplace les entrées des modèles traités, on garde les autres.
  const index = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : { schema: 1, models: [] };
  const traites = new Set(entrees.map((e) => e.modelId));
  index.models = [...index.models.filter((m) => !traites.has(m.modelId)), ...entrees];
  writeFileSync(INDEX, JSON.stringify(index, null, 2));
  console.log(`\nindex       : ${INDEX} (${index.models.length} modèles)`);

  rmSync(tmp, { recursive: true, force: true });
  console.log(`\nMasters à téléverser : ${SORTIE_HD}`);
  console.log('   node scripts/kit-studio/upload-bag-models.mjs');
}

try {
  main();
} catch (err) {
  console.error(`\nÉCHEC : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
