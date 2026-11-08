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

/** Sac miniature : corps, couvercle, poche frontale et deux bretelles (maquette ctile, l.1673). */
function bagBuilder(spec: BagThumbSpec, res: ThumbResources): Object3D {
  const g = new Group();
  const fabric = res.fabric('ripstop');
  const body = new Mesh(res.roundedBox(1, 1.32, 0.58, 0.16), res.material(spec.body, 0.78, fabric));
  const lid = new Mesh(res.roundedBox(1.04, 0.4, 0.64, 0.14), res.material(spec.body, 0.78, fabric));
  lid.position.set(0, 0.92, 0.01);
  lid.rotation.x = 0.1;
  const pocket = new Mesh(res.roundedBox(0.7, 0.58, 0.16, 0.08), res.material(spec.pocket, 0.8, fabric));
  pocket.position.set(0, -0.02, 0.33);
  const strap = res.roundedBox(0.1, 1.05, 0.07, 0.035);
  const strapMat = res.material(spec.trim, 0.72);
  const s1 = new Mesh(strap, strapMat);
  s1.position.set(-0.26, 0.12, -0.32);
  const s2 = new Mesh(strap, strapMat);
  s2.position.set(0.26, 0.12, -0.32);
  const zip = new Mesh(res.roundedBox(0.86, 0.05, 0.05, 0.02), res.material(spec.trim, 0.6));
  zip.position.set(0, 0.72, 0.26);
  g.add(body, lid, pocket, s1, s2, zip);
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

  const body = new Mesh(res.roundedBox(w, h, d, radius), olive);
  body.castShadow = true;
  g.add(body);

  // Platine arrière LKDV
  const platine = buildPlatineMesh(manifest?.platine);
  platine.position.set(0, 0, -d / 2 - 0.002);
  g.add(platine);

  // Détails produit selon le type de poche / module
  const code = manifest?.code ?? spec.code ?? '';
  if (code === 'M03' || code === 'M07') {
    // Poche filet / stretch
    const net = new Mesh(
      res.roundedBox(w * 0.88, h * 0.65, 0.015, radius * 0.5),
      res.material(MODULE_THUMB_NET, 0.95),
    );
    net.position.set(0, -h * 0.1, d / 2 + 0.008);
    g.add(net);
  } else if (code === 'M13') {
    // Porte-bâtons (sangles / boucles)
    for (const x of [-w * 0.25, w * 0.25]) {
      const strap = new Mesh(res.roundedBox(0.02, h * 0.85, 0.015, 0.005), trim);
      strap.position.set(x, 0, d / 2 + 0.005);
      g.add(strap);
    }
  } else {
    // Zip frontal / supérieur
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
