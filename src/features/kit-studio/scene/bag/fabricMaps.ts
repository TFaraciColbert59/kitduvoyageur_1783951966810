/**
 * src/features/kit-studio/scene/bag/fabricMaps.ts
 * Cartes de tissu des presets de matière, pour les sacs chargés depuis un GLB (lot D).
 *
 * INVARIANTS :
 * - Les cartes de détail sont NEUTRES : la couleur vient toujours du token, jamais de l'image.
 *   `materials.ts` continue donc de décider la teinte, et ce module ne décide que la trame.
 * - Les UV des sacs sortent du générateur en MÈTRES (`glb-writer.mjs` écrit TEXCOORD_0 tel quel),
 *   et chaque image couvre 100 mm de tissu réel : la répétition est donc exactement 10, pas un
 *   réglage à l'œil. Un modèle importé passe par `import-model.mjs`, qui normalise ses UV dans la
 *   même unité.
 * - Les images se chargent après coup. Tant qu'elles ne sont pas là — et pour toujours si elles
 *   n'arrivent jamais (hors ligne, asset absent) — la pièce garde son aspect uni actuel. Aucun
 *   état d'erreur n'est exposé : une matière sans trame reste une matière juste.
 */

import * as THREE from 'three';

/** Côté de tissu réel couvert par une image, en mètres. */
export const FABRIC_TILE_M = 0.1;

/** Répétition des cartes sur des UV exprimées en mètres. */
export const FABRIC_REPEAT = 1 / FABRIC_TILE_M;

const MATERIALS_URL = '/assets/materials';

/**
 * Relevé de tissu utilisé par chaque preset de `BAG_MATERIAL_PRESETS`.
 * `ballistic-nylon` partage la trame du Cordura : ce sont deux armures toile de nylon lourdes, que
 * seule la densité sépare — et la densité est déjà portée par la rugosité du preset. Mieux vaut la
 * bonne armure partagée qu'une trame inventée.
 */
const FABRIC_BY_PRESET: Readonly<Record<string, string>> = {
  'cordura-matte': 'cordura',
  'ballistic-nylon': 'cordura',
  'ripstop-ultralight': 'ripstop',
  'waxed-canvas': 'waxed',
  'recycled-pet': 'brushed-pet',
};

export interface FabricMaps {
  /** Carte de détail neutre, à multiplier par la couleur du token. */
  readonly albedo: THREE.Texture;
  /** Carte de relief en espace tangent OpenGL. */
  readonly normal: THREE.Texture;
}

export interface FabricMapBank {
  /** Cartes du preset, ou `null` si ce preset n'a pas de relevé. */
  forPreset(presetId: string | undefined): FabricMaps | null;
  /** Libère toutes les textures créées par la banque. */
  dispose(): void;
}

/**
 * Pose une image sur une texture déjà créée, sans la remplacer : rien ne casse si elle n'arrive
 * jamais, et rien n'est tenté hors navigateur (tests, rendu serveur).
 */
function loadImageInto(texture: THREE.Texture, url: string): void {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') return;
  const img = new window.Image();
  img.decoding = 'async';
  img.onload = () => {
    texture.image = img;
    texture.needsUpdate = true;
  };
  img.onerror = () => {
    /* La pièce garde son aspect uni. */
  };
  img.src = url;
}

function blankTexture(srgb: boolean, maxAnisotropy: number): THREE.Texture {
  const t = new THREE.Texture();
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(FABRIC_REPEAT, FABRIC_REPEAT);
  // Une carte de relief porte des vecteurs, pas des couleurs : pas de conversion sRGB.
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  return t;
}

export function createFabricMapBank(maxAnisotropy: number): FabricMapBank {
  const byFabric = new Map<string, FabricMaps>();

  const forFabric = (fabric: string): FabricMaps => {
    const hit = byFabric.get(fabric);
    if (hit) return hit;
    const albedo = blankTexture(true, maxAnisotropy);
    const normal = blankTexture(false, maxAnisotropy);
    loadImageInto(albedo, `${MATERIALS_URL}/${fabric}-albedo.png`);
    loadImageInto(normal, `${MATERIALS_URL}/${fabric}-normal.png`);
    const maps: FabricMaps = { albedo, normal };
    byFabric.set(fabric, maps);
    return maps;
  };

  return {
    forPreset(presetId) {
      if (!presetId) return null;
      const fabric = FABRIC_BY_PRESET[presetId];
      return fabric ? forFabric(fabric) : null;
    },
    dispose() {
      for (const { albedo, normal } of byFabric.values()) {
        albedo.dispose();
        normal.dispose();
      }
      byFabric.clear();
    },
  };
}

/** Presets qui disposent d'un relevé de tissu. Exporté pour les tests et l'inventaire. */
export const PRESETS_WITH_FABRIC_MAPS: readonly string[] = Object.keys(FABRIC_BY_PRESET);
