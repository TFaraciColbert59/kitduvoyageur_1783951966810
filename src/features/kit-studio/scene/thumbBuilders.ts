// Constructeurs des vignettes 3D (T12/T14) : la scène et la fiche ne les enregistraient pas, les cartes
// affichaient donc toujours le repli SVG. Enregistrés à la première vignette demandée (voir ui/Thumb.tsx).
import { Group, Mesh } from 'three';
import type { Object3D } from 'three';
import { itemMesh } from './itemMesh';
import { registerBuilder } from './thumbnails';
import type { BagThumbSpec, ItemThumbSpec, ThumbResources } from './thumbnails';

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

let registered = false;

/** Idempotent : plusieurs cartes demandent leur vignette au même moment. */
export function registerThumbBuilders(): void {
  if (registered) return;
  registered = true;
  registerBuilder('i', itemBuilder);
  registerBuilder('b', bagBuilder);
}
