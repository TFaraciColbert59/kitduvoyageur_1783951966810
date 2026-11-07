// Coordonnées de texture en mètres, pour que la trame d'un tissu ait la même échelle physique sur
// toutes les pièces — un tissage qui paraît cinq fois plus gros sur un corps que sur une bretelle se
// voit immédiatement.
//
// Les primitives de three (BoxGeometry, CylinderGeometry, SphereGeometry…) sortent avec des UV
// normalisées 0..1 par face : la tuile s'étire alors à la taille de la pièce. On les remplace par une
// projection en boîte exprimée dans les unités du modèle, qui sont des mètres.
//
// Même algorithme que `METERS_UV` de `tools/bag-generator/generate-bag.mjs` et que `boxProjectUvs`
// de `tools/bag-generator/import-model.mjs` : les trois chemins — sacs construits par code, sacs
// générés, modèles importés — partagent ainsi une seule convention. Voir
// `kit-studio-bundle/spec/moteur-3d-matieres.md` § 2.
import { BufferAttribute } from 'three';
import type { BufferGeometry } from 'three';

/**
 * Projette chaque sommet sur le plan perpendiculaire à l'axe dominant de sa normale, en mètres.
 *
 * Travaille par sommet et non par triangle, pour rester continu sur une surface courbe et correct
 * sur une géométrie indexée. Les coutures de projection, là où l'axe dominant change, sont
 * invisibles sur une armure régulière.
 *
 * **Idempotent** : une géométrie partagée par le `ResourceTracker` traverse cette fonction à chaque
 * reconstruction de pièce, et une seconde projection la remettrait à l'échelle une fois de trop.
 *
 * Sans attribut de position ou de normale, la géométrie est rendue inchangée.
 */
export function uvMeters<T extends BufferGeometry>(geometry: T): T {
  if (geometry.userData.uvMeters === true) return geometry;

  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  if (!pos || !nrm) return geometry;

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = pos.getX(i); v = pos.getZ(i);        // dessus / dessous
    } else if (ax >= az) {
      u = pos.getZ(i); v = pos.getY(i);        // flancs
    } else {
      u = pos.getX(i); v = pos.getY(i);        // face / dos
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }

  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
  geometry.userData.uvMeters = true;
  return geometry;
}
