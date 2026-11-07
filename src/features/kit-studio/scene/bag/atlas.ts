/**
 * src/features/kit-studio/scene/bag/atlas.ts
 * Système de personnalisation par atlas texturé — Avenant du 7 novembre après-midi (§ 4).
 *
 * Pour les modèles LKDV ONE importés (source: "imported", texturedSource: true) :
 * - Carte de zones à 3 canaux (R = tissu, V = sangles/textile technique, B = rigide : boucles, fermetures, écusson)
 * - Albédo délié de la lumière
 * - Teinte du token uniquement sur la zone rouge (multiplication de luminance)
 * - Lueur textile (MeshPhysicalMaterial, sheenColorMap) uniquement sur les zones R+V (éteint sur B)
 * - Trame tissée physique greffée par-dessus l'atlas, pondérée par la zone textile
 * - Zone bleue rigide : rugosité plus basse pour faire ressortir les reflets spéculaires
 * - Absence gracieuse des cartes : si la carte de zones est absente, l'atlas reste tel quel,
 *   aucune teinte n'est appliquée, aucun sheen n'est allumé, et la personnalisation est annoncée indisponible.
 */

import * as THREE from 'three';
import type { BagAssetProvider, LoadedBagAsset } from './loader';
import { resolveTokenToThreeColor } from './materials';
import type { ConfigSet } from '../../domain/catalog';

export interface AtlasPixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array;
}

export interface ProcessAtlasOptions {
  /** Texture ou buffer d'albédo de base (atlas d'origine). */
  readonly baseAlbedo: AtlasPixelBuffer;
  /** Carte de zones 3 canaux (R=tissu, V=sangles, B=rigide). Si absente : atlas tel quel. */
  readonly zonesMap?: AtlasPixelBuffer | null;
  /** Albédo délié de la lumière (optionnel ; si absent, retombe sur baseAlbedo). */
  readonly unlitAlbedo?: AtlasPixelBuffer | null;
  /** Couleur du token résolue (composantes 0..1 pour r, g, b). */
  readonly tokenColor?: { r: number; g: number; b: number } | null;
  /** Rugosité de base pour le tissu (défaut : 0.82). */
  readonly fabricRoughness?: number;
  /** Rugosité pour la zone rigide B (défaut : 0.25). */
  readonly rigidRoughness?: number;
  /** Activer la trame tissée physique (défaut : true). */
  readonly weaveEnabled?: boolean;
}

export interface ProcessAtlasResult {
  /** Buffer d'albédo résultant (teinté zone rouge, trame physique pondérée). */
  readonly albedo: AtlasPixelBuffer;
  /** Buffer de sheen (actif R+V, 0 sur B). Null si pas de carte de zones. */
  readonly sheenMap: AtlasPixelBuffer | null;
  /** Buffer de rugosité (B plus bas, R/V tissu). Null si pas de carte de zones. */
  readonly roughnessMap: AtlasPixelBuffer | null;
  /** Vrai si la personnalisation a pu être appliquée grâce à la présence de la carte de zones. */
  readonly customized: boolean;
}

/** Calcule la luminance relative Rec. 709 d'un triplet RGB (0..255). */
export function calculateLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Crée un nouveau buffer RGBA vierge. */
export function createPixelBuffer(
  width: number,
  height: number,
  fill?: readonly [number, number, number, number],
): AtlasPixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) {
    const [r, g, b, a] = fill;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return { width, height, data };
}

/**
 * Traite les buffers de l'atlas selon les spécifications de l'avenant § 4.
 * Fonction pure et entièrement déterministe, testable sans contexte WebGL.
 */
export function processAtlasBuffers(options: ProcessAtlasOptions): ProcessAtlasResult {
  const { baseAlbedo, zonesMap, unlitAlbedo, tokenColor } = options;

  // Garde-fou absolu : si la carte de zones est absente, l'atlas reste STRICTEMENT tel quel.
  // Pas de teinte, pas de sheen, pas de modification des boucles.
  if (!zonesMap) {
    return {
      albedo: baseAlbedo,
      sheenMap: null,
      roughnessMap: null,
      customized: false,
    };
  }

  const { width, height } = baseAlbedo;
  const unlitSource = unlitAlbedo ?? baseAlbedo;

  const outAlbedoData = new Uint8ClampedArray(width * height * 4);
  const outSheenData = new Uint8ClampedArray(width * height * 4);
  const outRoughnessData = new Uint8ClampedArray(width * height * 4);

  const fabricRoughness = options.fabricRoughness ?? 0.82;
  const rigidRoughness = options.rigidRoughness ?? 0.25;
  const weaveEnabled = options.weaveEnabled ?? true;

  const totalPixels = width * height;

  for (let p = 0; p < totalPixels; p++) {
    const i = p * 4;

    // Coordonnées 2D du texel
    const x = p % width;
    const y = Math.floor(p / width);

    // Canaux de la carte de zones : R = tissu, V = sangles, B = rigide
    const zR = zonesMap.data[i] ?? 0;
    const zV = zonesMap.data[i + 1] ?? 0;
    const zB = zonesMap.data[i + 2] ?? 0;

    const wR = zR / 255;
    const wV = zV / 255;
    const wB = zB / 255;

    // Texel d'albédo délié source (ou base)
    const uR = unlitSource.data[i] ?? 0;
    const uG = unlitSource.data[i + 1] ?? 0;
    const uB = unlitSource.data[i + 2] ?? 0;
    const uA = unlitSource.data[i + 3] ?? 255;

    // 1. Teinte du token : uniquement sur la zone rouge (R), multiplication de luminance
    let cR = uR;
    let cG = uG;
    let cB = uB;

    if (tokenColor && wR > 0) {
      const lum = calculateLuminance(uR, uG, uB);
      const tintedR = tokenColor.r * lum;
      const tintedG = tokenColor.g * lum;
      const tintedB = tokenColor.b * lum;

      cR = (1 - wR) * uR + wR * tintedR;
      cG = (1 - wR) * uG + wR * tintedG;
      cB = (1 - wR) * uB + wR * tintedB;
    }

    // 2. Trame tissée répétée à l'échelle physique : greffée par-dessus l'atlas, pondérée par la zone textile (R+V)
    if (weaveEnabled) {
      const wTextile = Math.min(1.0, wR + wV);
      if (wTextile > 0) {
        // Modulation d'armure textile subtile (pas physique régulier)
        const weaveMod = 1.0 + 0.07 * Math.sin(x * 0.45) * Math.cos(y * 0.45);
        const factor = (1 - wTextile) + wTextile * weaveMod;
        cR = Math.min(255, Math.max(0, cR * factor));
        cG = Math.min(255, Math.max(0, cG * factor));
        cB = Math.min(255, Math.max(0, cB * factor));
      }
    }

    outAlbedoData[i] = Math.round(cR);
    outAlbedoData[i + 1] = Math.round(cG);
    outAlbedoData[i + 2] = Math.round(cB);
    outAlbedoData[i + 3] = uA;

    // 3. Lueur textile (sheen) : uniquement zones R + V ; strictly 0 sur la zone rigide B
    const textilePresence = Math.min(1.0, wR + wV);
    const sheenIntensity = Math.max(0, textilePresence * (1 - wB));
    const sheenByte = Math.round(sheenIntensity * 255);

    outSheenData[i] = sheenByte;
    outSheenData[i + 1] = sheenByte;
    outSheenData[i + 2] = sheenByte;
    outSheenData[i + 3] = 255;

    // 4. Rugosité : la zone bleue B reçoit une rugosité plus basse
    const roughness = (1 - wB) * fabricRoughness + wB * rigidRoughness;
    const roughnessByte = Math.round(Math.min(1, Math.max(0, roughness)) * 255);

    outRoughnessData[i] = roughnessByte;
    outRoughnessData[i + 1] = roughnessByte;
    outRoughnessData[i + 2] = roughnessByte;
    outRoughnessData[i + 3] = 255;
  }

  return {
    albedo: { width, height, data: outAlbedoData },
    sheenMap: { width, height, data: outSheenData },
    roughnessMap: { width, height, data: outRoughnessData },
    customized: true,
  };
}

/** Crée une THREE.DataTexture à partir d'un AtlasPixelBuffer. */
export function createDataTexture(buffer: AtlasPixelBuffer, isColor = false): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    buffer.data,
    buffer.width,
    buffer.height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Charge la carte de zones pour un modèle donné si le fournisseur le propose ou via asset. */
export async function loadZonesMap(
  modelId: string,
  provider?: BagAssetProvider,
): Promise<AtlasPixelBuffer | null> {
  if (provider?.fetchZonesMap) {
    try {
      return await provider.fetchZonesMap(modelId);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Applique la personnalisation issue de l'avenant § 4 aux matériaux d'un sac importé texturé.
 * Met à jour le matériau physique (MeshPhysicalMaterial) en place sans recharger la scène.
 */
export function applyAtlasAppearance(
  loaded: LoadedBagAsset,
  config: ConfigSet,
  zonesMap: AtlasPixelBuffer | null,
  unlitAlbedo?: AtlasPixelBuffer | null,
): boolean {
  if (!loaded.manifest.texturedSource) {
    return false;
  }

  // Résolution de la couleur du token (ex: config.body.col)
  const tokenSpec = config.body?.col;
  const threeColor = tokenSpec ? resolveTokenToThreeColor(tokenSpec) : null;
  const tokenRgb = threeColor ? { r: threeColor.r, g: threeColor.g, b: threeColor.b } : null;

  // Récupérer le matériau racine ou les matériaux des parties
  let applied = false;
  loaded.root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (let mat of materials) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;

      // Si le matériau a une carte de base (l'atlas)
      const baseMap = mat.map;
      if (!zonesMap) {
        // Garde-fou : carte absente => pas de sheen, pas de teinte
        if (mat instanceof THREE.MeshPhysicalMaterial) {
          mat.sheen = 0;
          mat.sheenColorMap = null;
        }
        mat.needsUpdate = true;
        continue;
      }

      // Si le matériau n'est pas encore un MeshPhysicalMaterial, on peut lui configurer ses propriétés physiques
      const physMat = mat as THREE.MeshPhysicalMaterial;

      // Si nous avons une image utilisable dans baseMap pour en extraire un buffer
      const img = baseMap?.image as { width?: number; height?: number; data?: unknown } | undefined;
      const hasValidData =
        img &&
        typeof img.width === 'number' &&
        typeof img.height === 'number' &&
        (img.data instanceof Uint8Array || img.data instanceof Uint8ClampedArray);

      const baseBuffer: AtlasPixelBuffer = hasValidData
        ? { width: img.width!, height: img.height!, data: img.data as Uint8Array | Uint8ClampedArray }
        : createPixelBuffer(zonesMap.width, zonesMap.height, [180, 180, 180, 255]);

      const result = processAtlasBuffers({
        baseAlbedo: baseBuffer,
        zonesMap,
        unlitAlbedo,
        tokenColor: tokenRgb,
      });

      if (result.customized && result.sheenMap && result.roughnessMap) {
        const albedoTex = createDataTexture(result.albedo, true);
        const sheenTex = createDataTexture(result.sheenMap, false);
        const roughTex = createDataTexture(result.roughnessMap, false);

        physMat.map = albedoTex;
        physMat.sheen = 1.0;
        physMat.sheenColor = new THREE.Color(1, 1, 1);
        physMat.sheenColorMap = sheenTex;
        physMat.sheenRoughness = 0.5;
        physMat.roughnessMap = roughTex;
        physMat.needsUpdate = true;
        applied = true;
      }
    }
  });

  return applied;
}
