// Constructeurs des vignettes 3D (T12/T14) : la scène et la fiche ne les enregistraient pas, les cartes
// affichaient donc toujours le repli SVG. Enregistrés à la première vignette demandée (voir ui/Thumb.tsx).
import { Box3, Group, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { itemMesh } from './itemMesh';
import { maillageCorps, maillageModule } from './thumbAssets';
import { registerBuilder } from './thumbnails';
import type { BagThumbSpec, ItemThumbSpec, ModuleThumbSpec, ThumbResources } from './thumbnails';
import { AVAILABLE_3D_MODULE_MANIFESTS } from './bag/moduleLoader';
import { GLB_MODEL_BY_BAG } from './bag/modelLayer';

/**
 * Copie un maillage réel pour une vignette, remis à l'échelle et posé comme l'était la silhouette
 * de repli qu'il remplace. Les matériaux restent partagés avec l'actif en cache : le moteur ne
 * libère que ceux qu'il a lui-même créés, rien n'est donc disposé sous les pieds de la scène.
 *
 * `hauteurVoulue` à `null` garde l'échelle réelle du maillage (modules, déjà modélisés aux cotes
 * du manifeste) ; `baseY` à `null` centre l'objet sur l'origine au lieu de le poser.
 */
function copiePourVignette(
  racine: Object3D,
  hauteurVoulue: number | null,
  baseY: number | null,
): Object3D {
  const copie = racine.clone(true);
  copie.position.set(0, 0, 0);
  copie.rotation.set(0, 0, 0);
  copie.scale.set(1, 1, 1);
  copie.updateMatrixWorld(true);

  const boite = new Box3().setFromObject(copie);
  if (boite.isEmpty()) return copie;

  if (hauteurVoulue !== null) {
    const hauteur = boite.max.y - boite.min.y;
    if (hauteur > 1e-6) {
      const k = hauteurVoulue / hauteur;
      copie.scale.setScalar(k);
      boite.min.multiplyScalar(k);
      boite.max.multiplyScalar(k);
    }
  }

  const centre = boite.getCenter(new Vector3());
  copie.position.set(
    -centre.x,
    baseY === null ? -centre.y : baseY - boite.min.y,
    -centre.z,
  );

  const enveloppe = new Group();
  enveloppe.add(copie);
  enveloppe.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = true;
  });
  return enveloppe;
}

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

/**
 * Vignette d'un corps : le maillage publié, et rien d'autre.
 *
 * Règle produit : le Studio n'affiche que des maillages réels. Tant que le master n'est pas
 * chargé, la carte reste vide — la silhouette dessinée à la main qu'on servait ici donnait à voir
 * un sac qui n'existe pas, et c'est elle qui s'affichait à l'ouverture du Studio.
 *
 * La hauteur de cadrage reste dérivée du litrage : elle ne décrit pas le sac, elle place
 * simplement tous les corps à la même échelle d'une carte à l'autre.
 */
function bagBuilder(spec: BagThumbSpec): Object3D {
  const bagId = spec.bagId ?? '';
  let hauteurCadre = 1.4;
  if (bagId.includes('15')) hauteurCadre = 1.15;
  else if (bagId.includes('25') || bagId === 'b28') hauteurCadre = 1.26;
  else if (bagId.includes('45') || bagId === 'b42') hauteurCadre = 1.42;
  else if (bagId.includes('60')) hauteurCadre = 1.58;
  else if (bagId.includes('80')) hauteurCadre = 1.74;

  const master = maillageCorps(GLB_MODEL_BY_BAG[bagId] ?? null);
  return master ? copiePourVignette(master, hauteurCadre, -0.7) : new Group();
}

/** Vignette d'un module : le maillage publié, et rien d'autre (même règle que les corps). */
function moduleBuilder(spec: ModuleThumbSpec): Object3D {
  const normId = spec.moduleId.replace(/^mod:/, '').toLowerCase();
  const manifest = AVAILABLE_3D_MODULE_MANIFESTS.find(
    (m) =>
      m.moduleId === spec.moduleId ||
      m.moduleId === normId ||
      m.moduleId === `lkdv-${normId}` ||
      m.code?.toLowerCase() === normId,
  );

  // Même règle que pour les corps : pas de maillage publié, pas de dessin. Les modules dont le
  // `.glb` n'existe pas encore restent sans visuel, et l'interface le dit.
  if (!manifest || manifest.origin === 'procedural') return new Group();
  const master = maillageModule(manifest.moduleId);
  return master ? copiePourVignette(master, null, null) : new Group();
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
