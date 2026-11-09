// Maillages réels des objets du kit : registre des `.glb` publiés.
//
// Règle produit (Tony, 09/11/2026, non négociable) : « On utilise uniquement les modèles 3D réalistes ».
// Le Studio n'affiche aucun objet dessiné par code : ni silhouette, ni doublure, ni « fantôme » filaire
// pour une fonction manquante, ni vignette procédurale. Un objet n'existe donc en 3D (scène, arc, pièces
// séparées, vignette) que s'il a un `.glb` publié ici ; sinon il n'a ni mesh, ni entrée, ni tir de rayon,
// et l'interface l'affiche en 2D (pictogramme plat, fiche, bilan).
//
// Au 09/11/2026 aucun objet n'a de maillage publié : le registre est vide. Pour en publier un, déposer
// `public/assets/items/<id>.glb` puis ajouter `<id>: '/assets/items/<id>.glb'` ci-dessous.
//
// Point d'extension : tant qu'aucun chargeur d'objet n'est branché sur `scene/objects.ts` (`addItem`),
// une entrée du registre ne suffit pas à faire apparaître l'objet. Le chargeur devra réutiliser celui des
// sacs et des modules (`scene/bag/loader.ts`, `scene/thumbAssets.ts`) plutôt qu'en écrire un autre.

/** Identifiant d'objet du catalogue → URL publique de son `.glb`. Vide aujourd'hui, volontairement. */
export const ITEM_GLB_BY_ID: Readonly<Record<string, string>> = {};

/** L'objet a-t-il un maillage réel publié ? Sinon : rien en 3D, pictogramme 2D seulement. */
export function hasItemModel(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ITEM_GLB_BY_ID, id);
}
