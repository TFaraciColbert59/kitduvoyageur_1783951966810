#!/usr/bin/env node
/**
 * LKDV — Générateur paramétrique de sac (ADR-003).
 *
 * Produit un .glb dont CHAQUE pièce est un maillage nommé, plus les ancres
 * (slots, points d'accroche, emplacements d'insigne) sous forme d'Object3D
 * vides et nommés. Aucun asset externe, aucune licence tierce : la géométrie
 * est engendrée par ce fichier.
 *
 * Usage :
 *   node generate-bag.mjs --model trekker-55 --out ./out
 *   node generate-bag.mjs --all --out ./out
 *
 * Sorties par modèle :
 *   <out>/<modelId>.glb            géométrie, pièces nommées, ancres
 *   <out>/<modelId>.manifest.json  capacités, pièces, slots, budgets mesurés
 *
 * Unités : mètres. Origine : centre du sol du sac (y = 0 au fond).
 * Axe +Y vers le haut, +Z vers l'avant (face à l'utilisateur).
 */

import * as THREE from 'three';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeGLB } from './glb-writer.mjs';

// ─────────────────────────────────────────────────────────────────────────
// 1. Catalogue des modèles. Tout est paramètre : ajouter un sac = ajouter
//    une entrée, jamais un fichier binaire.
// ─────────────────────────────────────────────────────────────────────────

const MODELS = {
  'daypack-22': {
    label: 'Sac à dos journée 22 L',
    capacityL: 22,
    size: { w: 0.28, h: 0.46, d: 0.18 },
    openable: true, hasInterior: true,
    frontPocket: true, sidePockets: true, hipBelt: false,
    compressionStraps: 1, lidKind: 'zip',
  },
  'trekker-55': {
    label: 'Sac de trek 55 L',
    capacityL: 55,
    size: { w: 0.33, h: 0.68, d: 0.26 },
    openable: true, hasInterior: true,
    frontPocket: true, sidePockets: true, hipBelt: true,
    compressionStraps: 2, lidKind: 'flap',
  },
  'expedition-75': {
    label: 'Sac d\'expédition 75 L',
    capacityL: 75,
    size: { w: 0.36, h: 0.78, d: 0.30 },
    openable: true, hasInterior: true,
    frontPocket: true, sidePockets: true, hipBelt: true,
    compressionStraps: 3, lidKind: 'flap',
  },
  'ultralight-40': {
    label: 'Sac ultraléger 40 L',
    capacityL: 40,
    size: { w: 0.30, h: 0.60, d: 0.22 },
    openable: true, hasInterior: true,
    frontPocket: true, sidePockets: false, hipBelt: true,
    compressionStraps: 2, lidKind: 'rolltop',
  },
  'duffel-60': {
    // Exemple volontaire de sac NON ouvrable : prouve que la chaîne gère
    // honnêtement `openable: false` (KIT_STUDIO_SPEC §6).
    label: 'Sac de voyage 60 L',
    capacityL: 60,
    size: { w: 0.62, h: 0.30, d: 0.30 },
    openable: false, hasInterior: false,
    frontPocket: false, sidePockets: true, hipBelt: false,
    compressionStraps: 2, lidKind: 'none',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// 2. Outils de géométrie
// ─────────────────────────────────────────────────────────────────────────

/** Boîte aux arêtes adoucies — un sac n'a pas d'angles vifs. */
/**
 * Projette un triangle ou un quadrilatère sur le plan perpendiculaire à l'axe dominant de sa
 * normale, en MÈTRES. Les coordonnées de texture sont donc à l'échelle réelle de la pièce.
 */
function projectMeters(vertices, indices) {
  const p = indices.map((i) => [vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]]);
  const [a, b, c] = p;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const ax = Math.abs(uy * vz - uz * vy);
  const ay = Math.abs(uz * vx - ux * vz);
  const az = Math.abs(ux * vy - uy * vx);
  let pick;
  if (az >= ax && az >= ay) pick = (q) => [q[0], q[1]];      // face avant / arrière → XY
  else if (ax >= ay) pick = (q) => [q[2], q[1]];             // flanc gauche / droit → ZY
  else pick = (q) => [q[0], q[2]];                           // dessus / dessous → XZ
  return p.map((q) => {
    const [u, v] = pick(q);
    return new THREE.Vector2(u, v);
  });
}

/**
 * Générateur d'UV en mètres pour les extrusions.
 *
 * Le générateur par défaut de three n'est en unités du monde que sur les faces avant et arrière :
 * ses murs latéraux — c'est-à-dire ici les FLANCS des sacs, pas de fines arêtes — sortent en
 * coordonnées normalisées 0..1. La trame de tissu s'y retrouvait donc à une échelle qui ne dépendait
 * pas de la taille de la pièce : dix répétitions sur le flanc d'un sac comme sur celui d'une sangle.
 * Celui-ci projette tout en mètres, et `scene/bag/fabricMaps.ts` peut répéter à 10 partout.
 */
const METERS_UV = {
  generateTopUV(geometry, vertices, indexA, indexB, indexC) {
    return projectMeters(vertices, [indexA, indexB, indexC]);
  },
  generateSideWallUV(geometry, vertices, indexA, indexB, indexC, indexD) {
    return projectMeters(vertices, [indexA, indexB, indexC, indexD]);
  },
};

function roundedBox(w, h, d, r = 0.03, seg = 3) {
  const shape = new THREE.Shape();
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: d - r * 2, bevelEnabled: true,
    bevelThickness: r, bevelSize: r, bevelSegments: seg, curveSegments: seg * 2,
    UVGenerator: METERS_UV,
  });
  g.translate(0, 0, -(d - r * 2) / 2);
  g.computeVertexNormals();
  return g;
}

/** Sangle : un ruban suivant une courbe, pour les bretelles et ceintures. */
function strap(points, width = 0.05, thickness = 0.012) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const shape = new THREE.Shape();
  const hw = width / 2, ht = thickness / 2;
  shape.moveTo(-hw, -ht); shape.lineTo(hw, -ht);
  shape.lineTo(hw, ht); shape.lineTo(-hw, ht); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    extrudePath: curve, steps: 28, bevelEnabled: false,
    UVGenerator: METERS_UV,
  });
  g.computeVertexNormals();
  return g;
}

/** Matériau nommé : la personnalisation remplacera ses paramètres à l'exécution. */
function mat(name, color, roughness = 0.82, metalness = 0.0) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  m.name = name;
  return m;
}

/** Ancre : un repère vide et nommé. Le Studio y accroche objets et insignes. */
function anchor(name, position, normal = [0, 0, 1]) {
  const o = new THREE.Object3D();
  o.name = `anchor:${name}`;
  o.position.set(...position);
  o.userData = { kind: 'anchor', normal };
  return o;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Construction d'un sac
// ─────────────────────────────────────────────────────────────────────────

function buildBag(modelId) {
  const cfg = MODELS[modelId];
  if (!cfg) throw new Error(`Modèle inconnu : ${modelId}`);

  const { w, h, d } = cfg.size;
  const root = new THREE.Group();
  root.name = `bag:${modelId}`;

  const parts = [];
  const slots = [];
  const badgeAnchors = [];

  const add = (geo, material, name, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    root.add(mesh);
    parts.push({ id: name, triangles: geo.index
      ? geo.index.count / 3
      : geo.attributes.position.count / 3 });
    return mesh;
  };

  // — Corps principal
  const bodyMat = mat('m_body', 0x3f5a4a);
  add(roundedBox(w, h, d, 0.035), bodyMat, 'body', [0, h / 2, 0]);
  badgeAnchors.push('badge-body-front');
  root.add(anchor('badge-body-front', [0, h * 0.55, d / 2 + 0.002], [0, 0, 1]));

  // — Intérieur (volume creux, utilisé pour poser les objets)
  if (cfg.hasInterior) {
    const inMat = mat('m_interior', 0x2a3a31, 0.95);
    const iw = w - 0.05, ih = h - 0.08, id = d - 0.05;
    const interior = add(roundedBox(iw, ih, id, 0.02), inMat, 'interior', [0, h / 2, 0]);
    interior.visible = false;          // révélé seulement quand le sac s'ouvre
    interior.userData.hidden = true;

    slots.push(
      { id: 'interior-bottom', kind: 'interior', capacityL: cfg.capacityL * 0.45,
        maxItems: null, anchor: [0, h * 0.22, 0], normal: [0, 1, 0] },
      { id: 'interior-top', kind: 'interior', capacityL: cfg.capacityL * 0.35,
        maxItems: null, anchor: [0, h * 0.62, 0], normal: [0, 1, 0] },
    );
    root.add(anchor('interior-bottom', [0, h * 0.22, 0], [0, 1, 0]));
    root.add(anchor('interior-top', [0, h * 0.62, 0], [0, 1, 0]));
  }

  // — Rabat / fermeture
  if (cfg.lidKind === 'flap') {
    const lidMat = mat('m_lid', 0x354d40);
    const lid = add(roundedBox(w * 1.02, d * 0.9, d * 0.62, 0.03),
      lidMat, 'lid', [0, h + 0.012, 0], [Math.PI / 2, 0, 0]);
    // Le pivot du rabat est à l'ARRIÈRE : c'est lui qui rend l'ouverture crédible.
    lid.userData.hinge = { axis: [1, 0, 0], pivot: [0, h, -d / 2], maxAngleRad: 1.9 };
    badgeAnchors.push('badge-lid');
    root.add(anchor('badge-lid', [0, h + 0.03, 0.02], [0, 1, 0]));

    const buckleMat = mat('m_hardware', 0x1d1f1e, 0.45, 0.25);
    add(roundedBox(0.05, 0.03, 0.012, 0.004), buckleMat, 'lid-buckle',
      [0, h * 0.94, d / 2 + 0.012]);
    slots.push({ id: 'lid-pocket', kind: 'pocket', capacityL: cfg.capacityL * 0.05,
      maxItems: 4, anchor: [0, h + 0.01, 0], normal: [0, 1, 0] });
  } else if (cfg.lidKind === 'rolltop') {
    const lidMat = mat('m_lid', 0x354d40);
    const lid = add(roundedBox(w, 0.08, d * 0.8, 0.025), lidMat, 'lid', [0, h + 0.03, 0]);
    lid.userData.hinge = { axis: [1, 0, 0], pivot: [0, h, -d / 2], maxAngleRad: 1.2 };
    badgeAnchors.push('badge-lid');
    root.add(anchor('badge-lid', [0, h + 0.05, 0.01], [0, 1, 0]));
  } else if (cfg.lidKind === 'zip') {
    // Un sac à zip s'ouvre bel et bien : c'est le panneau supérieur entier
    // qui bascule, la glissière n'est que la quincaillerie. Sans charnière,
    // `openable: true` serait un mensonge (voir validate()).
    const lidMat = mat('m_lid', 0x354d40);
    const lid = add(roundedBox(w, d * 0.86, 0.045, 0.02),
      lidMat, 'lid', [0, h + 0.004, 0], [Math.PI / 2, 0, 0]);
    lid.userData.hinge = { axis: [1, 0, 0], pivot: [0, h, -d / 2], maxAngleRad: 1.5 };
    badgeAnchors.push('badge-lid');
    root.add(anchor('badge-lid', [0, h + 0.03, 0], [0, 1, 0]));

    const zipMat = mat('m_hardware', 0x1d1f1e, 0.45, 0.25);
    add(roundedBox(w * 0.9, 0.012, 0.012, 0.004), zipMat, 'lid-zip',
      [0, h - 0.015, d / 2 - 0.01]);
  }
  // lidKind === 'none' : pas de rabat du tout (duffel) → openable: false

  // — Poche frontale
  if (cfg.frontPocket) {
    const pMat = mat('m_front_pocket', 0x44604f);
    add(roundedBox(w * 0.78, h * 0.3, 0.07, 0.025), pMat, 'front-pocket',
      [0, h * 0.3, d / 2 + 0.012]);
    slots.push({ id: 'front-pocket', kind: 'pocket', capacityL: cfg.capacityL * 0.06,
      maxItems: 6, anchor: [0, h * 0.3, d / 2 + 0.05], normal: [0, 0, 1] });
    badgeAnchors.push('badge-front-pocket');
    root.add(anchor('badge-front-pocket', [0, h * 0.3, d / 2 + 0.05], [0, 0, 1]));
  }

  // — Poches latérales
  if (cfg.sidePockets) {
    const sMat = mat('m_side_pocket', 0x4a6855, 0.9);
    for (const [side, sx] of [['l', -1], ['r', 1]]) {
      add(roundedBox(0.06, h * 0.26, d * 0.72, 0.02), sMat, `side-pocket-${side}`,
        [sx * (w / 2 + 0.018), h * 0.26, 0]);
      slots.push({ id: `side-pocket-${side}`, kind: 'pocket',
        capacityL: cfg.capacityL * 0.04, maxItems: 2,
        anchor: [sx * (w / 2 + 0.05), h * 0.26, 0], normal: [sx, 0, 0] });
    }
  }

  // — Bretelles
  const strapMat = mat('m_straps', 0x2f453a, 0.88);
  for (const [side, sx] of [['l', -1], ['r', 1]]) {
    const pts = [
      [sx * w * 0.22, h * 0.95, -d / 2 + 0.01],
      [sx * w * 0.30, h * 0.72, -d / 2 - 0.085],
      [sx * w * 0.30, h * 0.44, -d / 2 - 0.095],
      [sx * w * 0.22, h * 0.18, -d / 2 - 0.02],
    ];
    add(strap(pts, 0.055, 0.016), strapMat, `shoulder-strap-${side}`);
  }
  parts.push({ id: 'shoulder-straps', group: ['shoulder-strap-l', 'shoulder-strap-r'] });

  // — Ceinture ventrale
  if (cfg.hipBelt) {
    const beltMat = mat('m_hip_belt', 0x2f453a, 0.88);
    const pts = [
      [-w * 0.78, h * 0.16, -d * 0.1],
      [-w * 0.42, h * 0.15, -d / 2 - 0.03],
      [w * 0.42, h * 0.15, -d / 2 - 0.03],
      [w * 0.78, h * 0.16, -d * 0.1],
    ];
    add(strap(pts, 0.075, 0.018), beltMat, 'hip-belt');
  }

  // — Sangles de compression
  if (cfg.compressionStraps > 0) {
    const cMat = mat('m_compression', 0x26382f, 0.9);
    for (let i = 0; i < cfg.compressionStraps; i++) {
      const y = h * (0.26 + (i + 1) * (0.5 / (cfg.compressionStraps + 1)));
      for (const [side, sx] of [['l', -1], ['r', 1]]) {
        const pts = [
          [sx * (w / 2 - 0.01), y, -d / 2 + 0.02],
          [sx * (w / 2 + 0.03), y, 0],
          [sx * (w / 2 - 0.01), y, d / 2 - 0.02],
        ];
        add(strap(pts, 0.022, 0.008), cMat, `compression-strap-${side}-${i + 1}`);
      }
    }
  }

  // — Points d'accroche extérieurs
  const attach = [
    ['attach-top', [0, h + 0.02, -d * 0.1], [0, 1, 0]],
    ['attach-bottom', [0, 0.02, 0], [0, -1, 0]],
    ['attach-side-l', [-(w / 2 + 0.03), h * 0.5, 0], [-1, 0, 0]],
    ['attach-side-r', [w / 2 + 0.03, h * 0.5, 0], [1, 0, 0]],
  ];
  for (const [id, pos, normal] of attach) {
    root.add(anchor(id, pos, normal));
    slots.push({ id, kind: 'attachment', capacityL: null, maxItems: 2,
      anchor: pos, normal });
  }

  // — Repères de caméra : les cibles canoniques de la machine d'états.
  root.add(anchor('cam-overview', [0, h * 0.5, 0], [0, 0, 1]));
  root.add(anchor('cam-opening', [0, h * 1.05, 0], [0, 1, 0]));

  return { root, cfg, parts, slots, badgeAnchors };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Export + manifeste
// ─────────────────────────────────────────────────────────────────────────

function countTriangles(root) {
  let n = 0;
  root.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      n += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    }
  });
  return Math.round(n);
}

async function exportModel(modelId, outDir) {
  const { root, cfg, parts, slots, badgeAnchors } = buildBag(modelId);
  const triangles = countTriangles(root);

  const buf = writeGLB(root, { generator: 'LKDV generate-bag.mjs' });
  const glbPath = join(outDir, `${modelId}.glb`);
  writeFileSync(glbPath, buf);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  let hasHinge = false;
  root.traverse((o) => { if (o.userData?.hinge) hasHinge = true; });

  const manifest = {
    schema: 1,
    modelId,
    label: cfg.label,
    generator: 'generate-bag.mjs',
    generatedBy: 'procedural',
    license: 'LKDV — généré par code, aucun asset tiers',
    units: 'meters',
    origin: 'centre du sol du sac (y=0 au fond)',
    capabilities: {
      rotatable: true,
      openable: cfg.openable,
      hasInterior: cfg.hasInterior,
      customizableParts: parts.filter((p) => !p.group).map((p) => p.id),
      badgeAnchors,
      attachmentPoints: slots.filter((s) => s.kind === 'attachment').map((s) => s.id),
    },
    hasHinge,
    declaredCapacityL: cfg.capacityL,
    boundingBoxM: { w: +size.x.toFixed(4), h: +size.y.toFixed(4), d: +size.z.toFixed(4) },
    slots,
    budget: { triangles, fileBytes: buf.length },
  };
  writeFileSync(join(outDir, `${modelId}.manifest.json`), JSON.stringify(manifest, null, 2));
  return manifest;
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Validation — un asset non validé n'est pas livrable
// ─────────────────────────────────────────────────────────────────────────

const LIMITS = { triangles: 40000, fileBytes: 900 * 1024 };

function validate(m) {
  const errors = [];
  if (m.budget.triangles > LIMITS.triangles)
    errors.push(`triangles ${m.budget.triangles} > ${LIMITS.triangles}`);
  if (m.budget.fileBytes > LIMITS.fileBytes)
    errors.push(`poids ${m.budget.fileBytes} o > ${LIMITS.fileBytes} o`);
  if (m.capabilities.openable && !m.capabilities.hasInterior)
    errors.push('openable sans hasInterior : ouverture sur du vide');
  // Règle d'honnêteté (KIT_STUDIO_SPEC §6) : un sac déclaré ouvrable DOIT
  // porter une charnière dans sa géométrie. Sans elle, l'interface promettrait
  // une ouverture qu'elle ne sait pas représenter.
  if (m.capabilities.openable && !m.hasHinge)
    errors.push('openable: true sans charnière dans la géométrie');
  if (!m.capabilities.openable && m.hasHinge)
    errors.push('charnière présente mais openable: false — incohérent');
  if (!m.capabilities.openable && m.slots.some((s) => s.kind === 'interior'))
    errors.push('slots intérieurs sur un sac non ouvrable : inatteignables');
  if (m.capabilities.customizableParts.length === 0)
    errors.push('aucune pièce personnalisable');
  const ids = m.slots.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push('identifiants de slot en double');
  for (const s of m.slots) {
    if (s.kind !== 'attachment' && (s.capacityL == null || s.capacityL <= 0))
      errors.push(`slot ${s.id} : capacité absente ou nulle`);
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const outDir = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : './out';
  const all = argv.includes('--all');
  const one = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : null;
  const ids = all ? Object.keys(MODELS) : one ? [one] : Object.keys(MODELS);

  mkdirSync(outDir, { recursive: true });

  let failed = 0;
  const index = [];
  for (const id of ids) {
    const m = await exportModel(id, outDir);
    const errors = validate(m);
    index.push({
      modelId: id, label: m.label,
      triangles: m.budget.triangles, bytes: m.budget.fileBytes,
      openable: m.capabilities.openable,
      parts: m.capabilities.customizableParts.length,
      slots: m.slots.length,
      valid: errors.length === 0,
    });
    const tag = errors.length ? 'ÉCHEC ' : 'OK    ';
    console.log(
      `${tag} ${id.padEnd(16)} ${String(m.budget.triangles).padStart(6)} tri  ` +
      `${String(Math.round(m.budget.fileBytes / 1024)).padStart(4)} Ko  ` +
      `${String(m.capabilities.customizableParts.length).padStart(2)} pièces  ` +
      `${String(m.slots.length).padStart(2)} slots  ` +
      `${m.capabilities.openable ? 'ouvrable' : 'non ouvrable'}`
    );
    for (const e of errors) { console.log(`        → ${e}`); failed++; }
  }

  writeFileSync(join(outDir, 'bags.index.json'), JSON.stringify({ schema: 1, models: index }, null, 2));
  console.log(`\n${ids.length} modèle(s), ${failed} erreur(s) de validation.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
