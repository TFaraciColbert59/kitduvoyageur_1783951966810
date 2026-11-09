// Constructeurs des vignettes 3D (T12/T14) : la scène et la fiche ne les enregistraient pas, les cartes
// affichaient donc toujours le repli SVG. Enregistrés à la première vignette demandée (voir ui/Thumb.tsx).
import { Box3, Color, Group, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { maillageCorps, maillageModule, zonesDuCorps } from './thumbAssets';
import { registerBuilder } from './thumbnails';
import type { BagThumbSpec, ItemThumbSpec, ModuleThumbSpec, ThumbResources } from './thumbnails';
import { AVAILABLE_3D_MODULE_MANIFESTS } from './bag/moduleLoader';
import { GLB_MODEL_BY_BAG } from './bag/modelLayer';
import { applyAtlasTintToCopy } from './bag/atlas';

/**
 * Copie un maillage réel pour une vignette, remis à l'échelle et posé comme l'était la silhouette
 * de repli qu'il remplace. Les matériaux restent partagés avec l'actif en cache : on n'y touche
 * jamais en place. Pour teinter, l'appelant clone ceux qu'il change et les confie au tracker
 * (voir `bagBuilder`) ; ceux qu'il ne change pas gardent l'apparence d'origine.
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

/**
 * Vignette d'un objet du catalogue : le maillage réel publié, et rien d'autre.
 *
 * Aucun `.glb` d'objet n'est publié (itemAssets.ts) : le groupe est vide, et les cartes d'objets ne
 * demandent d'ailleurs plus de vignette 3D, elles affichent leur pictogramme 2D plat. Le jour où un
 * maillage existe, c'est ici qu'on le copie, comme `bagBuilder` et `moduleBuilder`.
 */
export function itemBuilder(_spec: ItemThumbSpec): Object3D {
  return new Group();
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
 *
 * Le coloris de la carte teinte le tissu comme la scène (`applyAtlasTintToCopy` : même shader,
 * même luminance conservée, plis et coutures intacts). La teinte se pose sur des CLONES des
 * matériaux : ceux du master restent ceux du cache, et chaque clone est confié au tracker pour
 * être libéré avec la vignette. Seul le corps colore l'atlas, comme à la scène : la poche et le
 * liseré n'y ont pas de zone propre. Sans carte de zones, le master garde sa texture d'origine.
 */
function bagBuilder(spec: BagThumbSpec, res: ThumbResources): Object3D {
  const bagId = spec.bagId ?? '';
  let hauteurCadre = 1.4;
  if (bagId.includes('15')) hauteurCadre = 1.15;
  else if (bagId.includes('25') || bagId === 'b28') hauteurCadre = 1.26;
  else if (bagId.includes('45') || bagId === 'b42') hauteurCadre = 1.42;
  else if (bagId.includes('60')) hauteurCadre = 1.58;
  else if (bagId.includes('80')) hauteurCadre = 1.74;

  const modeleId = GLB_MODEL_BY_BAG[bagId] ?? null;
  const master = maillageCorps(modeleId);
  if (!master) return new Group();

  const vignette = copiePourVignette(master, hauteurCadre, -0.7);
  const zones = zonesDuCorps(modeleId);
  if (zones) {
    applyAtlasTintToCopy(vignette, new Color(spec.body), { zones, weaveNormal: null }, {
      adopter: (materiau) => {
        res.tracker.material(materiau);
      },
    });
  }
  return vignette;
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
