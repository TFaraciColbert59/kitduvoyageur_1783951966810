#!/usr/bin/env node
/**
 * LKDV — fabrique les deux paliers des 12 modules 3D maillés (Lot I-C) à partir des masters Meshy
 * et génère les manifestes des 17 modules (12 maillés `.glb` + 5 procéduraux construits par code).
 *
 * Entrée : les 12 GLB de `LKDV-ONE-3D-MODULES-v1` (`LKDV_M*_TEX.glb`).
 * Sorties :
 *   public/assets/modules/<moduleId>.glb            palier « web », strictement < 400 Ko
 *   public/assets/modules/<moduleId>.manifest.json  manifeste (orientation, platine, réserves, paliers)
 *   dist/module-models-hd/<moduleId>.hd.glb         palier « hd » (master normalisé)
 *   public/assets/modules/modules.index.json        index complet des modules 3D (12 GLB + 5 code)
 *
 * Contraintes de l'avenant :
 *   1. Ne jamais servir les masters tels quels (~74 Mo pour les 12, dont 90 % de textures 2048²).
 *      Compresser en meshopt + WebP avec taille de texture calculée par module : 512² par défaut,
 *      1024² pour M05, M17 et M20. Budget strict : < 400 Ko par module au palier web.
 *   2. La géométrie est bonne (8 568 à 11 733 triangles) : `--simplify false`, aucun triangle retiré.
 *   3. Orientation : Y haut, façade +Z, dos −Z, avec rotation Y de 180° pour M04, M05 et M16
 *      portée dans les manifestes (`orientation.yawDeg`), pas en dur dans le chargeur.
 *   4. Deux origines (`glb` et `procedural`) cohabitant sur les mêmes ancres et la même platine,
 *      avec l'épaisseur 3,5 mm des panneaux rigides portée comme convention de projet.
 *   5. Réserves fournisseur (M04, M05, M07, M15, M16) portées dans les manifestes sans bricolage shader.
 *
 * Usage :
 *   node scripts/kit-studio/build-module-tiers.mjs --src <dossier> [--table <json>] [--only M04]
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const RACINE = process.cwd();
const SORTIE_WEB = join(RACINE, 'public', 'assets', 'modules');
const SORTIE_HD = join(RACINE, 'dist', 'module-models-hd');
const INDEX = join(SORTIE_WEB, 'modules.index.json');
const BASE_DEFAUT = 'https://icxyvwzfjbflcbqukpfz.supabase.co/storage/v1/object/public/module-models';
const BUDGET_MAX_WEB_OCTETS = 400 * 1024;

function arg(nom, defaut = null) {
  const i = process.argv.indexOf(nom);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function arrondir4(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Lit l'en-tête JSON et le chunk binaire d'un fichier GLB.
 */
function lireGlb(fichier) {
  const buf = readFileSync(fichier);
  const longueurJson = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + longueurJson).toString('utf8'));
  const offsetBin = 20 + longueurJson;
  const binChunk = offsetBin < buf.length ? buf.subarray(offsetBin) : Buffer.alloc(0);
  return { buf, json, binChunk };
}

/**
 * Réécrit un fichier GLB avec un en-tête JSON modifié (aligné sur 4 octets avec des espaces 0x20)
 * et le même chunk binaire.
 */
function ecrireGlbAvecJson(fichierSortie, json, binChunk) {
  const jsonBrut = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (jsonBrut.length % 4)) % 4;
  const jsonPadded = pad > 0 ? Buffer.concat([jsonBrut, Buffer.alloc(pad, 0x20)]) : jsonBrut;
  const longueurTotale = 12 + 8 + jsonPadded.length + binChunk.length;
  const entete = Buffer.alloc(20);
  entete.writeUInt32LE(0x46546c67, 0); // 'glTF'
  entete.writeUInt32LE(2, 4); // version 2
  entete.writeUInt32LE(longueurTotale, 8);
  entete.writeUInt32LE(jsonPadded.length, 12);
  entete.writeUInt32LE(0x4e4f534a, 16); // 'JSON'
  writeFileSync(fichierSortie, Buffer.concat([entete, jsonPadded, binChunk]));
}

/**
 * Compte les triangles déclarés par le glTF à partir de son seul en-tête JSON.
 */
function compterTriangles(fichier) {
  const { json } = lireGlb(fichier);
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

/**
 * Normalise le master GLB :
 * 1. Mesure la boîte englobante en mètres (avec la matrice du nœud racine).
 * 2. Si le nœud racine (`*_Y_HAUT_FACE_PLUS_Z_METRES`) porte déjà une rotation Y de 180° cuite
 *    dans sa matrice (`m[0] < 0 && m[10] < 0`, cas de M04, M05 et M16), on retire cette rotation
 *    du GLB pour que l'orientation soit portée exclusivement par le manifeste (`orientation.yawDeg`)
 *    et appliquée par `moduleLoader.ts` au chargement (sans double rotation).
 */
function normaliserMasterGlb(fichierMaster, fichierSortie) {
  const { json, binChunk } = lireGlb(fichierMaster);
  const posAcc = json.accessors?.[0];
  if (!posAcc || !Array.isArray(posAcc.min) || !Array.isArray(posAcc.max)) {
    throw new Error(`accesseur POSITION min/max introuvable dans ${fichierMaster}`);
  }

  // Nœud porteur de la mise à l'échelle en mètres (nœud racine de la scène)
  const sceneIdx = json.scene ?? 0;
  const rootNodeIdx = json.scenes?.[sceneIdx]?.nodes?.[0] ?? 1;
  const rootNode = json.nodes?.[rootNodeIdx];
  const m = rootNode?.matrix ? [...rootNode.matrix] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const sx = Math.abs(m[0]);
  const sy = Math.abs(m[5]);
  const sz = Math.abs(m[10]);

  const w = arrondir4((posAcc.max[0] - posAcc.min[0]) * sx);
  const h = arrondir4((posAcc.max[1] - posAcc.min[1]) * sy);
  const d = arrondir4((posAcc.max[2] - posAcc.min[2]) * sz);

  // Dé-cuire la rotation Y de 180° du nœud racine si elle y a été écrite (`m[0] < 0 && m[10] < 0`),
  // afin que `orientation.yawDeg = 180` dans le manifeste soit la seule source de rotation.
  if (rootNode?.matrix && m[0] < 0 && m[10] < 0) {
    m[0] = -m[0];
    m[2] = -m[2];
    m[8] = -m[8];
    m[10] = -m[10];
    m[12] = -m[12];
    m[14] = -m[14];
    rootNode.matrix = m;
  }

  ecrireGlbAvecJson(fichierSortie, json, binChunk);
  return { boundingBoxM: { w, h, d } };
}

function trouverMaster(dossier, code) {
  const fichiers = readdirSync(dossier).filter(
    (f) => f.toLowerCase().endsWith('.glb') && f.includes(`_${code}_`),
  );
  if (fichiers.length === 0) throw new Error(`aucun master trouvé pour ${code} dans ${dossier}`);
  if (fichiers.length > 1) throw new Error(`plusieurs masters pour ${code} : ${fichiers.join(', ')}`);
  return join(dossier, fichiers[0]);
}

function construirePlatineStandard(boundingBoxM) {
  return {
    position: [0, arrondir4(boundingBoxM.h * 0.5), arrondir4(-boundingBoxM.d * 0.5)],
    normal: [0, 0, -1],
  };
}

function main() {
  const src = arg('--src');
  if (!src) throw new Error('--src est obligatoire : le dossier des masters LKDV_M*_TEX.glb');
  const dossierSrc = resolve(src);
  if (!existsSync(dossierSrc)) throw new Error(`dossier introuvable : ${dossierSrc}`);

  const tablePath = arg('--table', join('scripts', 'kit-studio', 'modules.lkdv-one.json'));
  const table = JSON.parse(readFileSync(tablePath, 'utf8'));
  const seulement = arg('--only');
  const base = arg('--base', BASE_DEFAUT).replace(/\/+$/, '');

  const modulesGlb = table.modules.filter((m) => !seulement || m.code === seulement);
  if (modulesGlb.length === 0) throw new Error(`aucun module ne correspond à --only ${seulement}`);

  mkdirSync(SORTIE_WEB, { recursive: true });
  mkdirSync(SORTIE_HD, { recursive: true });
  const tmp = join(RACINE, 'dist', '.module-tiers-tmp');
  mkdirSync(tmp, { recursive: true });

  const entreesIndex = [];

  for (const mod of modulesGlb) {
    const master = trouverMaster(dossierSrc, mod.code);
    const octetsMaster = statSync(master).size;
    console.log(`\n=== ${mod.code} → ${mod.moduleId} (${mod.label})`);
    console.log(`master      : ${master} (${(octetsMaster / 1048576).toFixed(2)} Mo)`);

    // 1. Normalisation du master (mesure de la boîte englobante en mètres et retrait de la rotation
    //    cuite éventuelle pour que le manifeste porte seul l'orientation).
    const glbHdTmp = join(tmp, `${mod.moduleId}.hd.glb`);
    const { boundingBoxM } = normaliserMasterGlb(master, glbHdTmp);
    const trianglesHd = compterTriangles(glbHdTmp);

    // 2. Palier web : compression meshopt + WebP à la taille de texture cible (512² par défaut,
    //    1024² pour M05, M17 et M20), SANS décimation géométrique (`--simplify false`).
    const glbWeb = join(SORTIE_WEB, `${mod.moduleId}.glb`);
    run(join(RACINE, 'node_modules', '.bin', 'gltf-transform'), [
      'optimize',
      glbHdTmp,
      glbWeb,
      '--compress',
      'meshopt',
      '--texture-compress',
      'webp',
      '--texture-size',
      String(mod.textureSize),
      '--simplify',
      'false',
    ]);

    // 3. Copie du master normalisé dans dist/module-models-hd/
    const glbHd = join(SORTIE_HD, `${mod.moduleId}.hd.glb`);
    copyFileSync(glbHdTmp, glbHd);

    const trianglesWeb = compterTriangles(glbWeb);
    const octetsWeb = statSync(glbWeb).size;
    const octetsHd = statSync(glbHd).size;

    if (trianglesWeb !== trianglesHd) {
      throw new Error(
        `${mod.moduleId} : la géométrie a été modifiée (${trianglesHd} → ${trianglesWeb} triangles)`,
      );
    }
    if (octetsWeb >= BUDGET_MAX_WEB_OCTETS) {
      throw new Error(
        `${mod.moduleId} : le palier web pèse ${Math.round(octetsWeb / 1024)} Ko (>= 400 Ko autorisés)`,
      );
    }

    const manifeste = {
      schema: 1,
      moduleId: mod.moduleId,
      code: mod.code,
      label: mod.label,
      units: 'meters',
      origin: 'glb',
      glbUrl: `/assets/modules/${mod.moduleId}.glb`,
      texturedSource: true,
      boundingBoxM,
      cotesReferenceMm: mod.cotesReferenceMm,
      orientation: {
        up: 'Y',
        front: '+Z',
        back: '-Z',
        yawDeg: mod.yawDeg,
      },
      platine: construirePlatineStandard(boundingBoxM),
      textureSize: mod.textureSize,
      reserve: mod.reserve ?? null,
      rigidPanelConvention: table.rigidPanelConvention,
      assets: {
        web: {
          url: `/assets/modules/${mod.moduleId}.glb`,
          bytes: octetsWeb,
          triangles: trianglesWeb,
          textureSize: mod.textureSize,
        },
        hd: {
          url: `${base}/${mod.moduleId}.hd.glb`,
          bytes: octetsHd,
          triangles: trianglesHd,
          textureSize: 2048,
        },
      },
    };

    writeFileSync(
      join(SORTIE_WEB, `${mod.moduleId}.manifest.json`),
      JSON.stringify(manifeste, null, 2),
    );

    entreesIndex.push({
      moduleId: mod.moduleId,
      code: mod.code,
      label: mod.label,
      origin: 'glb',
      glbUrl: manifeste.glbUrl,
      triangles: trianglesWeb,
      bytes: octetsWeb,
      textureSize: mod.textureSize,
      yawDeg: mod.yawDeg,
      boundingBoxM,
      platine: manifeste.platine,
      reserve: manifeste.reserve,
      tiers: ['web', 'hd'],
      valid: true,
    });

    console.log(
      `web         : ${trianglesWeb} tri, ${(octetsWeb / 1024).toFixed(1)} Ko (tex ${mod.textureSize}², yaw ${mod.yawDeg}°)`,
    );
    console.log(`hd          : ${trianglesHd} tri, ${(octetsHd / 1048576).toFixed(2)} Mo`);
  }

  // 4. Manifestes et entrées d'index des 5 modules procéduraux construits par code
  //    (M09, M10, M11, M12, M14) lorsqu'on ne filtre pas par `--only` (ou si `--only` les cible).
  const modulesProceduraux = (table.proceduralModules ?? []).filter(
    (m) => !seulement || m.code === seulement,
  );
  for (const mod of modulesProceduraux) {
    const boundingBoxM = {
      w: arrondir4(mod.cotesReferenceMm.w / 1000),
      h: arrondir4(mod.cotesReferenceMm.h / 1000),
      d: arrondir4(mod.cotesReferenceMm.d / 1000),
    };
    const manifeste = {
      schema: 1,
      moduleId: mod.moduleId,
      code: mod.code,
      label: mod.label,
      units: 'meters',
      origin: 'procedural',
      boundingBoxM,
      cotesReferenceMm: mod.cotesReferenceMm,
      referenceState: mod.referenceState,
      orientation: {
        up: 'Y',
        front: '+Z',
        back: '-Z',
        yawDeg: mod.yawDeg ?? 0,
      },
      platine: construirePlatineStandard(boundingBoxM),
      reserve: mod.reserve ?? null,
      rigidPanelConvention: table.rigidPanelConvention,
    };

    writeFileSync(
      join(SORTIE_WEB, `${mod.moduleId}.manifest.json`),
      JSON.stringify(manifeste, null, 2),
    );

    entreesIndex.push({
      moduleId: mod.moduleId,
      code: mod.code,
      label: mod.label,
      origin: 'procedural',
      glbUrl: null,
      triangles: null,
      bytes: 0,
      textureSize: null,
      yawDeg: mod.yawDeg ?? 0,
      boundingBoxM,
      platine: manifeste.platine,
      reserve: manifeste.reserve,
      rigidPanelConvention: table.rigidPanelConvention,
      tiers: [],
      valid: true,
    });
    console.log(
      `\n=== ${mod.code} → ${mod.moduleId} (${mod.label}) [procédural : ${boundingBoxM.w}×${boundingBoxM.h}×${boundingBoxM.d} m]`,
    );
  }

  // 5. Mise à jour de modules.index.json
  const index = existsSync(INDEX)
    ? JSON.parse(readFileSync(INDEX, 'utf8'))
    : { schema: 1, rigidPanelConvention: table.rigidPanelConvention, modules: [] };
  const traites = new Set(entreesIndex.map((e) => e.moduleId));
  index.rigidPanelConvention = table.rigidPanelConvention;
  index.modules = [...(index.modules ?? []).filter((m) => !traites.has(m.moduleId)), ...entreesIndex];
  writeFileSync(INDEX, JSON.stringify(index, null, 2));
  console.log(`\nindex       : ${INDEX} (${index.modules.length} modules)`);

  rmSync(tmp, { recursive: true, force: true });
}

try {
  main();
} catch (err) {
  console.error(`\nÉCHEC : ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
