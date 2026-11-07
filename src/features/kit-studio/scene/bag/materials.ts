/**
 * src/features/kit-studio/scene/bag/materials.ts
 * Token-derived PBR materials & per-part in-place customization (Lot L4-2 / D-04 / D-05 / L2-2).
 *
 * CRITICAL INVARIANTS:
 * - ZERO literal hex colors in this file. All swatches reference `--hub-bag-*` / `--lkv-*` CSS tokens
 *   with `rgb(...)` numeric fallbacks for SSR/headless tests.
 * - Each mesh owns an isolated `THREE.MeshStandardMaterial` instance so customizing one part
 *   NEVER mutates any sibling mesh (`D-04`) and NEVER reloads the scene (`D-05`).
 */

import * as THREE from 'three';
import type { PartConfig, PartId } from '../../state/types';
import type { FabricMapBank } from './fabricMaps';

export interface BagMaterialPreset {
  id: string;
  label: string;
  description: string;
  roughness: number;
  metalness: number;
}

export interface BagColorSwatch {
  id: string;
  label: string;
  token: string;
  fallbackRgb: [number, number, number]; // 0..255
}

export const BAG_MATERIAL_PRESETS: readonly BagMaterialPreset[] = [
  {
    id: 'cordura-matte',
    label: 'Cordura 500D mat',
    description: 'Tissage dense résistant à l’abrasion',
    roughness: 0.84,
    metalness: 0.02,
  },
  {
    id: 'ripstop-ultralight',
    label: 'Ripstop Dyneema léger',
    description: 'Trame technique satinée déperlante',
    roughness: 0.56,
    metalness: 0.06,
  },
  {
    id: 'waxed-canvas',
    label: 'Toile cirée bivouac',
    description: 'Coton enduit patiné haute tenue',
    roughness: 0.72,
    metalness: 0.01,
  },
  {
    id: 'ballistic-nylon',
    label: 'Nylon balistique 1000D',
    description: 'Renfort expédition haute densité',
    roughness: 0.68,
    metalness: 0.08,
  },
  {
    id: 'recycled-pet',
    label: 'Polyester recyclé brossé',
    description: 'Finition mate douce sans reflet',
    roughness: 0.91,
    metalness: 0.0,
  },
] as const;

export const BAG_COLOR_SWATCHES: readonly BagColorSwatch[] = [
  {
    id: 'forest',
    label: 'Forêt profonde',
    token: 'var(--hub-bag-forest)',
    fallbackRgb: [23, 64, 44],
  },
  {
    id: 'pine',
    label: 'Pin alpin',
    token: 'var(--hub-bag-pine)',
    fallbackRgb: [34, 97, 72],
  },
  {
    id: 'moss',
    label: 'Mousse de sous-bois',
    token: 'var(--hub-bag-moss)',
    fallbackRgb: [91, 127, 85],
  },
  {
    id: 'ochre',
    label: 'Ocre minéral',
    token: 'var(--hub-bag-ochre)',
    fallbackRgb: [200, 154, 59],
  },
  {
    id: 'terracotta',
    label: 'Argile cuite',
    token: 'var(--hub-bag-terracotta)',
    fallbackRgb: [168, 68, 58],
  },
  {
    id: 'sand',
    label: 'Sable clair',
    token: 'var(--hub-bag-sand)',
    fallbackRgb: [237, 241, 234],
  },
  {
    id: 'slate',
    label: 'Ardoise',
    token: 'var(--hub-bag-slate)',
    fallbackRgb: [86, 102, 93],
  },
  {
    id: 'ink',
    label: 'Encre sombre',
    token: 'var(--hub-bag-ink)',
    fallbackRgb: [23, 43, 36],
  },
] as const;

const FINISH_OVERRIDES: Record<
  NonNullable<PartConfig['finish']>,
  { roughness: number; metalness: number }
> = {
  matte: { roughness: 0.88, metalness: 0.01 },
  rough: { roughness: 0.95, metalness: 0.0 },
  gloss: { roughness: 0.34, metalness: 0.08 },
  metallic: { roughness: 0.38, metalness: 0.45 },
};

/**
 * Résout une référence `var(--...)` ou un identifiant de nuance vers un `THREE.Color`
 * sans aucune chaîne hexadécimale en dur dans le code.
 */
export function resolveTokenToThreeColor(colorSpec: string | undefined): THREE.Color | null {
  if (!colorSpec) return null;

  const swatch =
    BAG_COLOR_SWATCHES.find((s) => s.id === colorSpec || s.token === colorSpec) ?? null;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const varMatch = (swatch?.token ?? colorSpec).match(/^var\((--[a-zA-Z0-9_-]+)\)$/);
    if (varMatch) {
      const computed = getComputedStyle(document.documentElement)
        .getPropertyValue(varMatch[1])
        .trim();
      if (computed) {
        try {
          return new THREE.Color(computed);
        } catch {
          // repli ci-dessous
        }
      }
    }
  }

  if (swatch) {
    const [r, g, b] = swatch.fallbackRgb;
    return new THREE.Color(`rgb(${r}, ${g}, ${b})`);
  }

  if (colorSpec.startsWith('rgb(')) {
    try {
      return new THREE.Color(colorSpec);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * D-04 & D-05: Applique la personnalisation en place sur UNIQUEMENT la pièce `partId`.
 * Retourne `true` si la pièce a été trouvée et modifiée, `false` sinon.
 */
export function applyPartCustomization(
  partsMap: ReadonlyMap<PartId, THREE.Mesh>,
  partId: PartId,
  config: PartConfig | undefined,
  fabricMaps?: FabricMapBank | null
): boolean {
  const mesh = partsMap.get(partId);
  if (!mesh || !config) return false;

  const mat = mesh.material;
  if (!(mat instanceof THREE.MeshStandardMaterial)) return false;

  if (config.material) {
    const preset = BAG_MATERIAL_PRESETS.find((p) => p.id === config.material);
    if (preset) {
      mat.roughness = preset.roughness;
      mat.metalness = preset.metalness;
      mat.userData = { ...mat.userData, materialPresetId: preset.id };

      // La trame du tissu, quand on en a un relevé et que la pièce porte des UV. La couleur reste
      // celle du token : la carte est neutre et se multiplie par `mat.color`.
      if (fabricMaps && mesh.geometry.getAttribute('uv')) {
        const maps = fabricMaps.forPreset(preset.id);
        mat.map = maps ? maps.albedo : null;
        mat.normalMap = maps ? maps.normal : null;
      }
    }
  }

  if (config.finish && FINISH_OVERRIDES[config.finish]) {
    mat.roughness = FINISH_OVERRIDES[config.finish].roughness;
    mat.metalness = FINISH_OVERRIDES[config.finish].metalness;
    mat.userData = { ...mat.userData, finish: config.finish };
  }

  if (config.color) {
    const resolved = resolveTokenToThreeColor(config.color);
    if (resolved) {
      mat.color.copy(resolved);
      mat.userData = { ...mat.userData, colorToken: config.color };
    }
  }

  mat.needsUpdate = true;
  return true;
}

export function applyAllCustomizations(
  partsMap: ReadonlyMap<PartId, THREE.Mesh>,
  partsConfig: Record<PartId, PartConfig>,
  fabricMaps?: FabricMapBank | null
): number {
  let count = 0;
  for (const [partId, cfg] of Object.entries(partsConfig)) {
    if (applyPartCustomization(partsMap, partId, cfg, fabricMaps)) {
      count += 1;
    }
  }
  return count;
}
