#!/usr/bin/env node
/**
 * LKDV — fabrique les deux paliers des 15 modules 3D maillés (Lot I-D final) et génère les
 * manifestes des 20 modules (15 maillés `.glb` + 5 procéduraux construits par code).
 *
 * Entrée : `LKDV-ONE-LOT-I-D-FINAL.zip` (ou le dossier `web/` extrait contenant `LKDV_M*_TEX.glb`).
 * Sorties :
 *   public/assets/modules/<moduleId>.glb            palier « web » (< 400 Ko en 512², < 700 Ko en 1024²)
 *   public/assets/modules/<moduleId>.manifest.json  manifeste (orientation, platine, réserves, paliers)
 *   dist/module-models-hd/<moduleId>.hd.glb         palier « hd » (source livrée)
 *   public/assets/modules/modules.index.json        index complet des 20 modules 3D (15 GLB + 5 code)
 *
 * Usage :
 *   node scripts/kit-studio/build-module-tiers.mjs --src <zip-ou-dossier> [--table <json>] [--only M04]
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
const BUDGET_MAX_512_OCTETS = 400 * 1024;
const BUDGET_MAX_1024_OCTETS = 700 * 1024;

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

function lireJsonGlb(fichier) {
  const buf = readFileSync(fichier);
  const longueurJson = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + longueurJson).toString('utf8'));
}

function compterTriangles(fichier) {
  const json = lireJsonGlb(fichier);
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

function inspecterMasterGlb(fichierMaster) {
  const json = lireJsonGlb(fichierMaster);
  const posAcc = json.accessors?.[0];
  if (!posAcc || !Array.isArray(posAcc.min) || !Array.isArray(posAcc.max)) {
    throw new Error(`accesseur POSITION min/max introuvable dans ${fichierMaster}`);
  }

  const sceneIdx = json.scene ?? 0;
  const rootNodeIdx = json.scenes?.[sceneIdx]?.nodes?.[0] ?? 1;
  const rootNode = json.nodes?.[rootNodeIdx];
  const m = rootNode?.matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  const sx = Math.abs(m[0]);
  const sy = Math.abs(m[5]);
  const sz = Math.abs(m[10]);

  const w = arrondir4((posAcc.max[0] - posAcc.min[0]) * sx);
  const h = arrondir4((posAcc.max[1] - posAcc.min[1]) * sy);
  const d = arrondir4((posAcc.max[2] - posAcc.min[2]) * sz);
  const rootYawDegInGlb = m[0] < 0 && m[10] < 0 ? 180 : 0;

  return {
    boundingBoxM: { w, h, d },
    bakedScaleFactor: arrondir4(sy),
    rootYawDegInGlb,
  };
}

function listerGlbRecursif(dossier) {
  const out = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, entree.name);
    if (entree.isDirectory()) {
      out.push(...listerGlbRecursif(p));
    } else if (entree.isFile() && entree.name.toLowerCase().endsWith('.glb')) {
      out.push(p);
    }
  }
  return out;
}

function trouverMaster(dossier, code) {
  const tous = listerGlbRecursif(dossier).filter((f) => f.includes(`_${code}_`));
  if (tous.length === 0) throw new Error(`aucun master trouvé pour ${code} dans ${dossier}`);
  if (tous.length > 1) throw new Error(`plusieurs masters pour ${code} : ${tous.join(', ')}`);
  return tous[0];
}

function construirePlatineStandard(boundingBoxM) {
  return {
    position: [0, arrondir4(boundingBoxM.h * 0.5), arrondir4(-boundingBoxM.d * 0.5)],
    normal: [0, 0, -1],
  };
}

function main() {
  const src = arg('--src');
  if (!src) throw new Error('--src est obligatoire : le ZIP LKDV-ONE-LOT-I-D-FINAL.zip ou le dossier des GLB');
  const cheminSrc = resolve(src);
  if (!existsSync(cheminSrc)) throw new Error(`source introuvable : ${cheminSrc}`);

  const tablePath = arg('--table', join('scripts', 'kit-studio', 'modules.lkdv-one.json'));
  const table = JSON.parse(readFileSync(tablePath, 'utf8'));
  const seulement = arg('--only');
  const base = arg('--base', BASE_DEFAUT).replace(/\/+$/, '');

  const modulesGlb = table.modules.filter((m) => !seulement || m.code === seulement);
  if (modulesGlb.length === 0) throw new Error(`aucun module ne correspond à --only ${seulement}`);

  mkdirSync(SORTIE_WEB, { recursive: true });
  mkdirSync(SORTIE_HD, { recursive: true });
  const tmp = join(RACINE, 'dist', '.module-tiers-tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });

  let dossierRecherche = cheminSrc;
  if (statSync(cheminSrc).isFile() && cheminSrc.toLowerCase().endsWith('.zip')) {
    const dossierUnzip = join(tmp, 'unzipped');
    mkdirSync(dossierUnzip, { recursive: true });
    run('unzip', ['-q', cheminSrc, '*/web/LKDV_M*_TEX.glb', '-d', dossierUnzip]);
    dossierRecherche = dossierUnzip;
  }

  const entreesIndex = [];

  for (const mod of modulesGlb) {
    const master = trouverMaster(dossierRecherche, mod.code);
    const octetsMaster = statSync(master).size;
    console.log(`\n=== ${mod.code} → ${mod.moduleId} (${mod.label})`);
    console.log(`source      : ${master} (${(octetsMaster / 1024).toFixed(1)} Ko)`);

    const { boundingBoxM, bakedScaleFactor, rootYawDegInGlb } = inspecterMasterGlb(master);
    const trianglesHd = compterTriangles(master);

    const glbWeb = join(SORTIE_WEB, `${mod.moduleId}.glb`);
    run(join(RACINE, 'node_modules', '.bin', 'gltf-transform'), [
      'optimize',
      master,
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

    const glbHd = join(SORTIE_HD, `${mod.moduleId}.hd.glb`);
    copyFileSync(master, glbHd);

    const trianglesWeb = compterTriangles(glbWeb);
    const octetsWeb = statSync(glbWeb).size;
    const octetsHd = statSync(glbHd).size;
    const plafondWeb =
      mod.textureSize === 1024 ? BUDGET_MAX_1024_OCTETS : BUDGET_MAX_512_OCTETS;

    if (trianglesWeb !== trianglesHd) {
      throw new Error(
        `${mod.moduleId} : la géométrie a été modifiée (${trianglesHd} → ${trianglesWeb} triangles)`,
      );
    }
    if (octetsWeb >= plafondWeb) {
      throw new Error(
        `${mod.moduleId} : le palier web pèse ${Math.round(octetsWeb / 1024)} Ko (>= ${Math.round(plafondWeb / 1024)} Ko autorisés)`,
      );
    }

    const manifeste = {
      schema: 1,
      moduleId: mod.moduleId,
      code: mod.code,
      label: mod.label,
      units: 'meters',
      origin: 'glb',
      fitRule: mod.fitRule ?? 'face',
      glbUrl: `/assets/modules/${mod.moduleId}.glb`,
      texturedSource: true,
      boundingBoxM,
      cotesReferenceMm: mod.cotesReferenceMm,
      orientation: {
        up: 'Y',
        front: '+Z',
        back: '-Z',
        bakedInGlbRoot: true,
        rootYawDegInGlb,
        bakedScaleFactor,
        loadRotationDeg: [0, 0, 0],
        loadScale: 1,
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
          textureSize: mod.textureSize,
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
      fitRule: mod.fitRule ?? 'face',
      glbUrl: manifeste.glbUrl,
      triangles: trianglesWeb,
      bytes: octetsWeb,
      textureSize: mod.textureSize,
      rootYawDegInGlb,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
      boundingBoxM,
      platine: manifeste.platine,
      reserve: manifeste.reserve,
      tiers: ['web', 'hd'],
      valid: true,
    });

    console.log(
      `web         : ${trianglesWeb} tri, ${(octetsWeb / 1024).toFixed(1)} Ko (tex ${mod.textureSize}², cuit Y=${rootYawDegInGlb}° scale=${bakedScaleFactor}, charge scale=1 rot=0)`,
    );
  }

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
      fitRule: mod.fitRule ?? 'porteur',
      boundingBoxM,
      cotesReferenceMm: mod.cotesReferenceMm,
      referenceState: mod.referenceState,
      orientation: {
        up: 'Y',
        front: '+Z',
        back: '-Z',
        bakedInGlbRoot: true,
        rootYawDegInGlb: 0,
        loadRotationDeg: [0, 0, 0],
        loadScale: 1,
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
      fitRule: mod.fitRule ?? 'porteur',
      glbUrl: null,
      triangles: null,
      bytes: 0,
      textureSize: null,
      rootYawDegInGlb: 0,
      loadRotationDeg: [0, 0, 0],
      loadScale: 1,
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

  const index = existsSync(INDEX)
    ? JSON.parse(readFileSync(INDEX, 'utf8'))
    : { schema: 1, rigidPanelConvention: table.rigidPanelConvention, modules: [] };
  const traites = new Set(entreesIndex.map((e) => e.modelId ?? e.moduleId));
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
