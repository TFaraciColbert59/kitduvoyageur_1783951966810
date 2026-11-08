// Constructeurs des vignettes 3D (T12/T14) : la scène et la fiche ne les enregistraient pas, les cartes
// affichaient donc toujours le repli SVG. Enregistrés à la première vignette demandée (voir ui/Thumb.tsx).
import { Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { itemMesh } from './itemMesh';
import { registerBuilder } from './thumbnails';
import type { BagThumbSpec, ItemThumbSpec, ModuleThumbSpec, ThumbResources } from './thumbnails';
import {
  MODULE_THUMB_ACCENT,
  MODULE_THUMB_NET,
  MODULE_THUMB_OLIVE,
  MODULE_THUMB_TRIM,
} from '../domain/palette.scene';
import { AVAILABLE_3D_MODULE_MANIFESTS, buildPlatineMesh, buildProceduralModuleMesh } from './bag/moduleLoader';

/** Objet du catalogue : même maillage que la scène, couleur déjà résolue par la palette. */
function itemBuilder(spec: ItemThumbSpec, res: ThumbResources): Object3D {
  return itemMesh(
    {
      id: spec.id,
      sh: spec.shape,
      gl: spec.glyph,
      L: spec.liters,
      // `hex` porte déjà la teinte résolue (palette.ts) : pas de relecture du catalogue.
      hex: spec.color,
      planned: spec.planned,
    },
    res.tracker,
    res.fabric('ripstop'),
  );
}

/** Sac miniature : corps proportionnel au modèle réel, couvercle/roll-top, poche frontale, poches latérales, bretelles et ceinture. */
function bagBuilder(spec: BagThumbSpec, res: ThumbResources): Object3D {
  const g = new Group();
  const fabric = res.fabric('ripstop');

  // Dimensions dérivées du litrage ou du modèle réel
  const bagId = spec.bagId ?? '';
  let bw = 1.0;
  let bh = 1.40;
  let bd = 0.58;
  let isExpedition = false;

  if (bagId.includes('15')) {
    bw = 0.88; bh = 1.15; bd = 0.50;
  } else if (bagId.includes('25') || bagId === 'b28') {
    bw = 0.94; bh = 1.26; bd = 0.54;
  } else if (bagId.includes('45') || bagId === 'b42') {
    bw = 1.00; bh = 1.42; bd = 0.58;
  } else if (bagId.includes('60')) {
    bw = 1.06; bh = 1.58; bd = 0.62;
    isExpedition = true;
  } else if (bagId.includes('80')) {
    bw = 1.12; bh = 1.74; bd = 0.68;
    isExpedition = true;
  }

  const bodyMat = res.material(spec.body, 0.80, fabric);
  const pocketMat = res.material(spec.pocket, 0.82, fabric);
  const trimMat = res.material(spec.trim, 0.70);
  const accentMat = res.material(MODULE_THUMB_ACCENT, 0.60);

  // Corps principal profilé (base légèrement arrondie)
  const bodyGeom = res.roundedBox(bw, bh, bd, Math.min(0.18, bw * 0.18));
  const body = new Mesh(bodyGeom, bodyMat);
  body.position.set(0, bh * 0.5 - 0.7, 0);
  g.add(body);

  // Couvercle supérieur / Roll-top LKDV ONE
  const lidH = bh * 0.26;
  const lidGeom = res.roundedBox(bw * 1.04, lidH, bd * 1.06, 0.12);
  const lid = new Mesh(lidGeom, bodyMat);
  lid.position.set(0, bh - 0.7 + lidH * 0.25, 0.02);
  lid.rotation.x = 0.08;
  g.add(lid);

  // Poche frontale zippée avec rabat
  const pw = bw * 0.74;
  const ph = bh * 0.44;
  const pd = bd * 0.26;
  const pocketGeom = res.roundedBox(pw, ph, pd, 0.07);
  const pocket = new Mesh(pocketGeom, pocketMat);
  pocket.position.set(0, bh * 0.4 - 0.7, bd * 0.5 + pd * 0.35);
  g.add(pocket);

  // Zip et tirette frontale
  const zip = new Mesh(res.roundedBox(pw * 0.82, 0.04, 0.04, 0.015), accentMat);
  zip.position.set(0, bh * 0.58 - 0.7, bd * 0.5 + pd * 0.5 + 0.01);
  g.add(zip);

  // Poches latérales stretch (porte-gourde / accessoires)
  const sideW = bd * 0.38;
  const sideH = bh * 0.30;
  const sideD = bd * 0.48;
  for (const sideX of [-bw * 0.5 - sideW * 0.15, bw * 0.5 + sideW * 0.15]) {
    const sideP = new Mesh(res.roundedBox(sideW, sideH, sideD, 0.05), pocketMat);
    sideP.position.set(sideX, bh * 0.32 - 0.7, 0);
    g.add(sideP);
  }

  // Bretelles ergonomiques au dos
  const strapGeom = res.roundedBox(bw * 0.11, bh * 0.78, 0.07, 0.035);
  const s1 = new Mesh(strapGeom, trimMat);
  s1.position.set(-bw * 0.26, bh * 0.45 - 0.7, -bd * 0.52);
  const s2 = new Mesh(strapGeom, trimMat);
  s2.position.set(bw * 0.26, bh * 0.45 - 0.7, -bd * 0.52);
  g.add(s1, s2);

  // Sangle de poitrine
  const sternum = new Mesh(res.roundedBox(bw * 0.54, 0.035, 0.03, 0.01), trimMat);
  sternum.position.set(0, bh * 0.55 - 0.7, -bd * 0.56);
  g.add(sternum);

  // Ceinture lombaire enveloppante pour les sacs de trek et expédition (60L / 80L)
  if (isExpedition) {
    const beltW = bw * 1.25;
    const beltH = bh * 0.18;
    const beltD = bd * 0.9;
    const belt = new Mesh(res.roundedBox(beltW, beltH, beltD, 0.08), trimMat);
    belt.position.set(0, bh * 0.12 - 0.7, -bd * 0.15);
    g.add(belt);
  }

  g.scale.setScalar(spec.scale);
  g.traverse((o) => {
    if (o instanceof Mesh) o.castShadow = true;
  });
  return g;
}

/** Module miniature LKDV ONE : maillage procédural ou géométrie spécifique avec platine. */
function moduleBuilder(spec: ModuleThumbSpec, res: ThumbResources): Object3D {
  const normId = spec.moduleId.replace(/^mod:/, '').toLowerCase();
  const manifest = AVAILABLE_3D_MODULE_MANIFESTS.find(
    (m) =>
      m.moduleId === spec.moduleId ||
      m.moduleId === normId ||
      m.moduleId === `lkdv-${normId}` ||
      m.code?.toLowerCase() === normId,
  );

  if (manifest?.origin === 'procedural') {
    return buildProceduralModuleMesh(manifest);
  }

  const g = new Group();
  const fabric = res.fabric('ripstop');
  const w = manifest?.boundingBoxM.w ?? 0.2;
  const h = manifest?.boundingBoxM.h ?? 0.25;
  const d = manifest?.boundingBoxM.d ?? 0.1;
  const radius = Math.min(0.04, Math.min(w, h, d) * 0.25);

  const olive = res.material(MODULE_THUMB_OLIVE, 0.82, fabric);
  const trim = res.material(MODULE_THUMB_TRIM, 0.65);
  const accent = res.material(MODULE_THUMB_ACCENT, 0.55);

  // Platine arrière LKDV standard 80 x 54 mm
  const platine = buildPlatineMesh(manifest?.platine);
  platine.position.set(0, 0, -d / 2 - 0.002);
  g.add(platine);

  const code = (manifest?.code ?? spec.code ?? '').toUpperCase();

  if (code === 'M01') {
    // M01 Porte-gourde / flasque : étui semi-rigide cylindrique avec collerette et cordon
    const flaskRadius = Math.min(w, d) * 0.45;
    const body = new Mesh(res.roundedBox(flaskRadius * 2, h * 0.85, flaskRadius * 2, flaskRadius * 0.5), olive);
    body.position.set(0, -h * 0.05, 0);
    g.add(body);
    const collar = new Mesh(res.roundedBox(flaskRadius * 2.1, h * 0.15, flaskRadius * 2.1, flaskRadius * 0.3), trim);
    collar.position.set(0, h * 0.4, 0);
    g.add(collar);
    const cord = new Mesh(res.roundedBox(flaskRadius * 0.6, 0.02, flaskRadius * 0.6, 0.01), accent);
    cord.position.set(0, h * 0.48, 0);
    g.add(cord);
  } else if (code === 'M03' || code === 'M07') {
    // Poche filet / stretch
    const body = new Mesh(res.roundedBox(w, h, d, radius), olive);
    g.add(body);
    const net = new Mesh(
      res.roundedBox(w * 0.88, h * 0.65, 0.015, radius * 0.5),
      res.material(MODULE_THUMB_NET, 0.95),
    );
    net.position.set(0, -h * 0.1, d / 2 + 0.008);
    g.add(net);
  } else if (code === 'M10' || code === 'M11') {
    // Porte-matelas / sac de couchage : berceau avec sangles
    const rail = new Mesh(res.roundedBox(w, 0.05, 0.01, 0.003), olive);
    rail.position.set(0, 0, -d * 0.45);
    g.add(rail);
    for (const sx of [-w * 0.3, w * 0.3]) {
      const ring = new Mesh(res.roundedBox(0.028, h * 0.85, d * 0.85, 0.01), trim);
      ring.position.set(sx, 0, 0);
      g.add(ring);
    }
  } else if (code === 'M12') {
    // Porte-casque : nappe filet concave
    const frame = new Mesh(res.roundedBox(w, h, 0.01, 0.004), olive);
    frame.position.set(0, 0, -d * 0.45);
    g.add(frame);
    const net = new Mesh(
      res.roundedBox(w * 0.9, h * 0.9, d * 0.6, 0.02),
      res.material(MODULE_THUMB_NET, 0.9),
    );
    net.position.set(0, 0, 0);
    g.add(net);
  } else if (code === 'M13') {
    // Porte-bâtons (sangles / boucles)
    const body = new Mesh(res.roundedBox(w, h, d, radius), olive);
    g.add(body);
    for (const x of [-w * 0.25, w * 0.25]) {
      const strap = new Mesh(res.roundedBox(0.02, h * 0.85, 0.015, 0.005), trim);
      strap.position.set(x, 0, d / 2 + 0.005);
      g.add(strap);
    }
  } else {
    // Poche zippée standard
    const body = new Mesh(res.roundedBox(w, h, d, radius), olive);
    g.add(body);
    const zip = new Mesh(res.roundedBox(w * 0.75, 0.012, 0.015, 0.004), accent);
    zip.position.set(0, h * 0.25, d / 2 + 0.008);
    g.add(zip);
  }

  g.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

let registered = false;

/** Idempotent : plusieurs cartes demandent leur vignette au même moment. */
export function registerThumbBuilders(): void {
  if (registered) return;
  registered = true;
  registerBuilder('i', itemBuilder);
  registerBuilder('b', bagBuilder);
  registerBuilder('m', moduleBuilder);
}
