/**
 * src/features/kit-studio/scene/bag/loader.ts
 * Binary glTF 2.0 (.glb) + manifest loader for procedural LKDV bags (Lot L4-2 / C-13).
 *
 * Parses glTF 2.0 binary directly into Three.js scene objects with:
 * - Isolated `THREE.MeshStandardMaterial` per mesh (guarantees D-04 part isolation)
 * - Named `parts: Map<BagPartId, THREE.Mesh>`
 * - Named `anchors: Map<string, BagAnchorSpec>`
 * - Hinge extraction (`hinges: Map<BagPartId, BagHingeSpec>`), strictly gated by `manifest.capabilities.openable`
 * - Graceful degradation (`status: 'degraded'`) on missing/corrupt GLB or manifest without throwing
 */

import * as THREE from 'three';
import type { BagCapabilities, BagPartId, Vec3Tuple } from '../../domain/bagModel';
import {
  DEGRADED_BAG_CAPABILITIES,
  type BagAnchorSpec,
  type BagHingeSpec,
  type BagManifest,
  type BagTier,
} from './parts';
import { chooseBagTier, readDeviceProfile, resolveBagAssetUrl, type DeviceProfile } from './tier';

const GLTF_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK_TYPE = 0x4e4f534a; // "JSON"
const BIN_CHUNK_TYPE = 0x004e4942; // "BIN\0"

const COMPONENT_FLOAT = 5126;
const COMPONENT_UINT = 5125;
const COMPONENT_USHORT = 5123;

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

import type { AtlasPixelBuffer } from './atlas';

export interface LoadedBagAsset {
  status: 'ready';
  modelId: string;
  manifest: BagManifest;
  capabilities: BagCapabilities;
  root: THREE.Group;
  parts: Map<BagPartId, THREE.Mesh>;
  anchors: Map<string, BagAnchorSpec>;
  hinges: Map<BagPartId, BagHingeSpec>;
  dispose: () => void;
}

export interface DegradedBagAsset {
  status: 'degraded';
  modelId: string;
  reason: string;
  manifest: BagManifest | null;
  capabilities: BagCapabilities;
  root: null;
  parts: Map<BagPartId, THREE.Mesh>;
  anchors: Map<string, BagAnchorSpec>;
  hinges: Map<BagPartId, BagHingeSpec>;
  dispose: () => void;
}

export type BagLoadResult = LoadedBagAsset | DegradedBagAsset;

export interface BagAssetProvider {
  fetchManifest: (modelId: string) => Promise<BagManifest>;
  /**
   * `url` est l'adresse résolue par le manifeste pour le palier retenu. Elle est absente pour un
   * modèle du générateur maison, qui n'a qu'un fichier à côté de son manifeste : le fournisseur
   * retombe alors sur le chemin historique. Un fournisseur de test peut l'ignorer.
   */
  fetchGlb: (modelId: string, url?: string) => Promise<ArrayBuffer>;
  /** Carte de zones à 3 canaux pour les modèles texturés (Avenant § 4). */
  fetchZonesMap?: (modelId: string) => Promise<AtlasPixelBuffer | null>;
  /** Albédo délié de la lumière pour les modèles texturés (Avenant § 4). */
  fetchUnlitAlbedo?: (modelId: string) => Promise<AtlasPixelBuffer | null>;
}

const defaultBrowserProvider: BagAssetProvider = {
  async fetchManifest(modelId: string): Promise<BagManifest> {
    const res = await fetch(`/assets/bags/${encodeURIComponent(modelId)}.manifest.json`);
    if (!res.ok) {
      throw new Error(`Manifeste introuvable pour ${modelId} (HTTP ${res.status})`);
    }
    return res.json();
  },
  async fetchGlb(modelId: string, url?: string): Promise<ArrayBuffer> {
    const cible = url ?? `/assets/bags/${encodeURIComponent(modelId)}.glb`;
    const res = await fetch(cible);
    if (!res.ok) {
      throw new Error(`Modèle 3D introuvable pour ${modelId} (HTTP ${res.status})`);
    }
    return res.arrayBuffer();
  },
};

/**
 * Charge le manifeste d'un sac depuis /assets/bags/.
 * Retourne `null` si le manifeste est introuvable : l'appelant doit alors
 * l'afficher comme indisponible, jamais inventer de capacités.
 */
export async function fetchBagManifest(
  modelId: string,
  provider: BagAssetProvider = defaultBrowserProvider
): Promise<BagManifest | null> {
  try {
    return await provider.fetchManifest(modelId);
  } catch {
    return null;
  }
}

interface GltfJson {
  asset?: { version?: string };
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{
    name?: string;
    mesh?: number;
    children?: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    /** glTF autorise une matrice 4×4 colonne-majeur à la place du triplet TRS, jamais les deux. */
    matrix?: number[];
    extras?: Record<string, any>;
  }>;
  meshes?: Array<{
    name?: string;
    primitives: Array<{
      attributes: Record<string, number>;
      indices?: number;
      material?: number;
      mode?: number;
    }>;
  }>;
  materials?: Array<{
    name?: string;
    pbrMetallicRoughness?: {
      baseColorFactor?: [number, number, number, number];
      metallicFactor?: number;
      roughnessFactor?: number;
      baseColorTexture?: { index: number };
      metallicRoughnessTexture?: { index: number };
    };
    normalTexture?: { index: number; scale?: number };
    occlusionTexture?: { index: number };
    doubleSided?: boolean;
  }>;
  textures?: Array<{
    source?: number;
    /** EXT_texture_webp range la source ici au lieu de `source`. */
    extensions?: { EXT_texture_webp?: { source: number } };
  }>;
  images?: Array<{ bufferView?: number; mimeType?: string; uri?: string }>;
  accessors?: Array<{
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
    /** KHR_mesh_quantization : l'entier porte une valeur réelle ramenée dans [-1, 1] ou [0, 1]. */
    normalized?: boolean;
  }>;
  bufferViews?: Array<{
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
    extensions?: {
      EXT_meshopt_compression?: {
        buffer: number;
        byteOffset?: number;
        byteLength: number;
        byteStride: number;
        count: number;
        mode: 'ATTRIBUTES' | 'TRIANGLES' | 'INDICES';
        filter?: 'NONE' | 'OCTAHEDRAL' | 'QUATERNION' | 'EXPONENTIAL';
      };
    };
  }>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
}

/**
 * Déplie les vues compressées en meshopt.
 *
 * Le palier « web » des sacs importés est compressé : c'est ce qui fait tenir un maillage texturé
 * de 35 000 triangles dans 600 Ko au lieu de 2 Mo. Le décodeur pèse 32 Ko et décode à plus d'un
 * gigaoctet par seconde ; il n'est chargé que lorsqu'un fichier en a besoin, donc les sacs du
 * générateur maison ne le paient jamais.
 *
 * Les vues décodées sont recopiées dans un binaire neuf, et les décalages réécrits en conséquence :
 * tout ce qui lit les accesseurs ensuite ignore que le fichier était compressé.
 */
async function decodeMeshopt(
  json: GltfJson,
  bin: Uint8Array
): Promise<{ json: GltfJson; bin: Uint8Array }> {
  const vues = json.bufferViews ?? [];
  if (!vues.some((v) => v.extensions?.EXT_meshopt_compression)) return { json, bin };

  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  await MeshoptDecoder.ready;

  // Taille de chaque vue une fois dépliée, puis un seul binaire qui les contient toutes.
  const tailles = vues.map((v) => {
    const c = v.extensions?.EXT_meshopt_compression;
    return c ? c.count * c.byteStride : v.byteLength;
  });
  const alignee = (n: number) => (n % 4 ? n + (4 - (n % 4)) : n);
  const decalages: number[] = [];
  let total = 0;
  for (const t of tailles) {
    decalages.push(total);
    total += alignee(t);
  }

  const sortie = new Uint8Array(total);
  vues.forEach((v, i) => {
    const c = v.extensions?.EXT_meshopt_compression;
    const cible = sortie.subarray(decalages[i], decalages[i] + tailles[i]);
    if (c) {
      const source = bin.subarray(
        (c.byteOffset ?? 0),
        (c.byteOffset ?? 0) + c.byteLength
      );
      MeshoptDecoder.decodeGltfBuffer(cible, c.count, c.byteStride, source, c.mode, c.filter ?? 'NONE');
    } else {
      cible.set(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
    }
  });

  const jsonDeplie: GltfJson = {
    ...json,
    bufferViews: vues.map((v, i) => {
      const { extensions, ...reste } = v;
      void extensions;
      return { ...reste, byteOffset: decalages[i], byteLength: tailles[i] };
    }),
    extensionsUsed: json.extensionsUsed?.filter((e) => e !== 'EXT_meshopt_compression'),
    extensionsRequired: json.extensionsRequired?.filter((e) => e !== 'EXT_meshopt_compression'),
  };
  return { json: jsonDeplie, bin: sortie };
}

export function parseGlbBuffer(buffer: ArrayBuffer): { json: GltfJson; bin: Uint8Array } {
  if (buffer.byteLength < 20) {
    throw new Error('Fichier GLB tronqué (< 20 octets)');
  }
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== GLTF_MAGIC) {
    throw new Error('En-tête magic glTF invalide');
  }
  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Version glTF non supportée : ${version}`);
  }
  const declaredLen = view.getUint32(8, true);
  if (declaredLen > buffer.byteLength) {
    throw new Error(`Longueur GLB incohérente (${declaredLen} > ${buffer.byteLength})`);
  }

  const jsonChunkLen = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== JSON_CHUNK_TYPE) {
    throw new Error('Chunk JSON glTF manquant');
  }

  const jsonBytes = new Uint8Array(buffer, 20, jsonChunkLen);
  const jsonText = new TextDecoder('utf-8').decode(jsonBytes);
  const json = JSON.parse(jsonText) as GltfJson;

  let bin = new Uint8Array(0);
  const binHeaderOffset = 20 + jsonChunkLen;
  if (buffer.byteLength >= binHeaderOffset + 8) {
    const binChunkLen = view.getUint32(binHeaderOffset, true);
    const binChunkType = view.getUint32(binHeaderOffset + 4, true);
    if (binChunkType !== BIN_CHUNK_TYPE) {
      throw new Error('Chunk BIN glTF invalide');
    }
    bin = new Uint8Array(buffer, binHeaderOffset + 8, binChunkLen);
  }

  return { json, bin };
}

const COMPONENT_BYTE = 5120;
const COMPONENT_UBYTE = 5121;
const COMPONENT_SHORT = 5122;
/** Diviseurs de déquantification de la spécification glTF, par componentType. */
const QUANT_DIVISEUR: Record<number, number> = {
  [COMPONENT_BYTE]: 127,
  [COMPONENT_UBYTE]: 255,
  [COMPONENT_SHORT]: 32767,
  [COMPONENT_USHORT]: 65535,
};

/** Taille d'un composant, en octets, par componentType glTF. */
const TAILLE_COMPOSANT: Record<number, number> = {
  [COMPONENT_BYTE]: 1,
  [COMPONENT_UBYTE]: 1,
  [COMPONENT_SHORT]: 2,
  [COMPONENT_USHORT]: 2,
  [COMPONENT_UINT]: 4,
  [COMPONENT_FLOAT]: 4,
};

function readAccessorArray(
  json: GltfJson,
  bin: Uint8Array,
  accessorIndex: number
): { array: Float32Array | Uint16Array | Uint32Array; itemSize: number } {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Accesseur glTF ${accessorIndex} introuvable`);
  const view = json.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`BufferView glTF ${accessor.bufferView} introuvable`);

  const itemSize = TYPE_COMPONENTS[accessor.type] ?? 1;
  const octetsComposant = TAILLE_COMPOSANT[accessor.componentType];
  if (octetsComposant === undefined) {
    throw new Error(`ComponentType glTF non supporté : ${accessor.componentType}`);
  }
  const octetsElement = octetsComposant * itemSize;
  const debut = bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  // Le pas d'entrelacement. Un fichier du générateur maison n'en a pas : les données y sont
  // serrées. Un fichier compressé en meshopt en a presque toujours un, parce que chaque élément y
  // est aligné sur quatre octets — une position en trois entiers courts occupe six octets dans un
  // pas de huit. Le lire comme s'il était serré mélange le maillage sans lever la moindre erreur.
  const pas = view.byteStride && view.byteStride > 0 ? view.byteStride : octetsElement;
  const serre = pas === octetsElement;

  const vue = new DataView(bin.buffer);
  const lireComposant = (octet: number): number => {
    switch (accessor.componentType) {
      case COMPONENT_BYTE: return vue.getInt8(octet);
      case COMPONENT_UBYTE: return vue.getUint8(octet);
      case COMPONENT_SHORT: return vue.getInt16(octet, true);
      case COMPONENT_USHORT: return vue.getUint16(octet, true);
      case COMPONENT_UINT: return vue.getUint32(octet, true);
      default: return vue.getFloat32(octet, true);
    }
  };

  // KHR_mesh_quantization : positions, normales et UV arrivent en entiers normalisés, et c'est ce
  // qui fait tenir un maillage texturé de 35 000 triangles dans 600 Ko. On les ramène en flottants
  // selon les règles de la spécification glTF ; l'échelle réelle est restituée par la
  // transformation du nœud, que le chargeur lit déjà.
  if (accessor.normalized === true) {
    const diviseur = QUANT_DIVISEUR[accessor.componentType];
    if (diviseur === undefined) {
      throw new Error(`ComponentType normalisé non supporté : ${accessor.componentType}`);
    }
    const signe = accessor.componentType === COMPONENT_BYTE || accessor.componentType === COMPONENT_SHORT;
    const sortie = new Float32Array(accessor.count * itemSize);
    for (let i = 0; i < accessor.count; i++) {
      for (let c = 0; c < itemSize; c++) {
        const v = lireComposant(debut + i * pas + c * octetsComposant) / diviseur;
        sortie[i * itemSize + c] = signe ? Math.max(v, -1) : v;
      }
    }
    return { array: sortie, itemSize };
  }

  // Chemin serré : une seule copie, comme avant. C'est celui des cinq sacs du générateur maison.
  if (serre) {
    const longueur = accessor.count * octetsElement;
    const aligne = bin.buffer.slice(debut, debut + longueur);
    if (accessor.componentType === COMPONENT_FLOAT) return { array: new Float32Array(aligne), itemSize };
    if (accessor.componentType === COMPONENT_USHORT) return { array: new Uint16Array(aligne), itemSize };
    if (accessor.componentType === COMPONENT_UINT) return { array: new Uint32Array(aligne), itemSize };
    throw new Error(`ComponentType glTF non supporté : ${accessor.componentType}`);
  }

  // Chemin entrelacé : élément par élément, au pas déclaré.
  if (accessor.componentType === COMPONENT_FLOAT
    || accessor.componentType === COMPONENT_USHORT
    || accessor.componentType === COMPONENT_UINT) {
    const sortie = accessor.componentType === COMPONENT_FLOAT
      ? new Float32Array(accessor.count * itemSize)
      : accessor.componentType === COMPONENT_USHORT
        ? new Uint16Array(accessor.count * itemSize)
        : new Uint32Array(accessor.count * itemSize);
    for (let i = 0; i < accessor.count; i++) {
      for (let c = 0; c < itemSize; c++) {
        sortie[i * itemSize + c] = lireComposant(debut + i * pas + c * octetsComposant);
      }
    }
    return { array: sortie, itemSize };
  }
  throw new Error(`ComponentType glTF non supporté : ${accessor.componentType}`);
}

type GltfPrimitive = NonNullable<GltfJson['meshes']>[number]['primitives'][number];

/**
 * Géométrie d'un mesh glTF, toutes primitives confondues.
 *
 * Le générateur maison n'émet qu'une primitive par mesh, et ce cas suit exactement le chemin
 * d'origine : aucune copie, aucun changement pour les 5 sacs existants. Un modèle produit ailleurs
 * (Meshy) découpe en revanche souvent un objet unique en plusieurs primitives, une par matériau du
 * fichier — et n'en lire que la première faisait disparaître le reste du sac en silence.
 *
 * On les fusionne au lieu d'en faire des sous-maillages : la pièce reste UNE pièce portant UN
 * matériau isolé (D-04), et la matière vient de notre banque de trames, pas du fichier.
 */
function buildPrimitiveGeometry(
  json: GltfJson,
  bin: Uint8Array,
  prims: readonly GltfPrimitive[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const usable = prims.filter((p) => p.attributes.POSITION !== undefined);
  if (usable.length === 0) return geometry;

  if (usable.length === 1) {
    const prim = usable[0];
    const pos = readAccessorArray(json, bin, prim.attributes.POSITION);
    geometry.setAttribute('position', new THREE.BufferAttribute(pos.array, pos.itemSize));
    if (prim.attributes.NORMAL !== undefined) {
      const norm = readAccessorArray(json, bin, prim.attributes.NORMAL);
      geometry.setAttribute('normal', new THREE.BufferAttribute(norm.array, norm.itemSize));
    } else {
      geometry.computeVertexNormals();
    }
    // Sans TEXCOORD_0, aucune matière ne peut se poser : les anciens GLB n'en avaient pas,
    // un modèle produit hors du générateur en a toujours.
    if (prim.attributes.TEXCOORD_0 !== undefined) {
      const uv = readAccessorArray(json, bin, prim.attributes.TEXCOORD_0);
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv.array, uv.itemSize));
    }
    if (prim.indices !== undefined) {
      const idx = readAccessorArray(json, bin, prim.indices);
      geometry.setIndex(new THREE.BufferAttribute(idx.array, 1));
    }
    return geometry;
  }

  // Première passe : compter, pour allouer d'un coup plutôt que de faire croître des tableaux.
  const read = usable.map((prim) => {
    const pos = readAccessorArray(json, bin, prim.attributes.POSITION);
    const vertexCount = pos.array.length / pos.itemSize;
    return {
      pos,
      vertexCount,
      normal:
        prim.attributes.NORMAL !== undefined
          ? readAccessorArray(json, bin, prim.attributes.NORMAL)
          : null,
      uv:
        prim.attributes.TEXCOORD_0 !== undefined
          ? readAccessorArray(json, bin, prim.attributes.TEXCOORD_0)
          : null,
      index: prim.indices !== undefined ? readAccessorArray(json, bin, prim.indices) : null,
    };
  });

  const totalVertices = read.reduce((n, r) => n + r.vertexCount, 0);
  const totalIndices = read.reduce((n, r) => n + (r.index ? r.index.array.length : r.vertexCount), 0);
  const hasNormals = read.every((r) => r.normal !== null);
  const hasUvs = read.some((r) => r.uv !== null);

  const positions = new Float32Array(totalVertices * 3);
  const normals = hasNormals ? new Float32Array(totalVertices * 3) : null;
  // Une primitive sans UV reçoit des zéros : elle perd sa trame, pas sa géométrie.
  const uvs = hasUvs ? new Float32Array(totalVertices * 2) : null;
  const indices =
    totalVertices > 65535 ? new Uint32Array(totalIndices) : new Uint16Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;
  for (const r of read) {
    positions.set(r.pos.array as ArrayLike<number>, vOffset * 3);
    if (normals && r.normal) normals.set(r.normal.array as ArrayLike<number>, vOffset * 3);
    if (uvs && r.uv) uvs.set(r.uv.array as ArrayLike<number>, vOffset * 2);

    if (r.index) {
      for (let i = 0; i < r.index.array.length; i++) {
        indices[iOffset + i] = r.index.array[i] + vOffset;
      }
      iOffset += r.index.array.length;
    } else {
      // Primitive non indexée : on fabrique sa suite d'indices.
      for (let i = 0; i < r.vertexCount; i++) indices[iOffset + i] = vOffset + i;
      iOffset += r.vertexCount;
    }
    vOffset += r.vertexCount;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  }
  if (uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (!normals) geometry.computeVertexNormals();
  return geometry;
}

/**
 * Construit les textures portées par le fichier lui-même.
 *
 * Un sac importé tient toute son apparence dans son atlas : les boucles noires, les fermetures, les
 * coutures et l'écusson n'existent nulle part ailleurs. Sans cette étape, le Studio affichait un
 * aplat de couleur — c'est exactement le défaut qu'on corrige.
 *
 * Décodage par `createImageBitmap`, absent hors navigateur (jsdom, rendu serveur). Dans ce cas la
 * fonction rend une table vide et les matériaux gardent leurs facteurs : le sac s'affiche en uni
 * plutôt que de faire échouer le chargement.
 */
async function chargerTextures(json: GltfJson, bin: Uint8Array): Promise<Map<number, THREE.Texture>> {
  const table = new Map<number, THREE.Texture>();
  const textures = json.textures ?? [];
  if (textures.length === 0) return table;
  if (typeof createImageBitmap !== 'function' || typeof Blob === 'undefined') return table;

  await Promise.all(textures.map(async (tex, index) => {
    const source = tex.extensions?.EXT_texture_webp?.source ?? tex.source;
    const image = source != null ? json.images?.[source] : undefined;
    if (!image || image.bufferView == null) return;
    const vue = json.bufferViews?.[image.bufferView];
    if (!vue) return;
    try {
      const octets = bin.subarray(vue.byteOffset ?? 0, (vue.byteOffset ?? 0) + vue.byteLength);
      const bitmap = await createImageBitmap(
        new Blob([octets as unknown as BlobPart], { type: image.mimeType ?? 'image/png' })
      );
      const texture = new THREE.Texture(bitmap as unknown as HTMLImageElement);
      // glTF range ses UV avec l'origine en haut à gauche : pas de retournement, comme GLTFLoader.
      texture.flipY = false;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.needsUpdate = true;
      table.set(index, texture);
    } catch {
      // Un format que le navigateur ne décode pas : le matériau garde son facteur de couleur.
    }
  }));
  return table;
}

function createIsolatedMaterial(
  json: GltfJson,
  matIdx: number | undefined,
  textures: Map<number, THREE.Texture> = new Map()
): THREE.MeshPhysicalMaterial {
  const def = matIdx !== undefined ? json.materials?.[matIdx] : undefined;
  const pbr = def?.pbrMetallicRoughness;
  const base = pbr?.baseColorFactor ?? [0.24, 0.35, 0.29, 1];
  const color = new THREE.Color().setRGB(base[0], base[1], base[2]);

  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: pbr?.roughnessFactor ?? 0.85,
    metalness: pbr?.metallicFactor ?? 0.0,
    side: def?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  material.name = def?.name ?? 'bag-material';

  // Les cartes du fichier, quand il en porte. L'espace colorimétrique compte : seule la couleur de
  // base est en sRGB ; une normale ou une rugosité lue en sRGB donnerait un relief et un brillant
  // faux, sans message d'erreur.
  const couleur = pbr?.baseColorTexture?.index;
  if (couleur != null) {
    const t = textures.get(couleur);
    if (t) {
      t.colorSpace = THREE.SRGBColorSpace;
      material.map = t;
      // Le facteur multiplie la carte : laissé à sa valeur, il assombrirait l'atlas.
      if (!pbr?.baseColorFactor) material.color.setRGB(1, 1, 1);
    }
  }
  const normale = def?.normalTexture?.index;
  if (normale != null) {
    const t = textures.get(normale);
    if (t) {
      t.colorSpace = THREE.NoColorSpace;
      material.normalMap = t;
      const echelle = def?.normalTexture?.scale;
      if (typeof echelle === 'number') material.normalScale.set(echelle, echelle);
    }
  }
  const metalRug = pbr?.metallicRoughnessTexture?.index;
  if (metalRug != null) {
    const t = textures.get(metalRug);
    if (t) {
      // glTF regroupe les deux dans une seule image : vert = rugosité, bleu = métal.
      t.colorSpace = THREE.NoColorSpace;
      material.roughnessMap = t;
      material.metalnessMap = t;
      if (pbr?.roughnessFactor === undefined) material.roughness = 1;
      if (pbr?.metallicFactor === undefined) material.metalness = 1;
    }
  }
  return material;
}

export interface LoadBagOptions {
  /** Signaux de l'appareil. Lus dans le navigateur si rien n'est fourni. */
  device?: DeviceProfile;
  /** Préférence explicite de la personne ; l'économie de données la dépasse quand même. */
  preferredTier?: BagTier | null;
}

export async function loadBagAsset(
  modelId: string | null | undefined,
  provider: BagAssetProvider = defaultBrowserProvider,
  options: LoadBagOptions = {}
): Promise<BagLoadResult> {
  const safeId = modelId?.trim() || '';
  if (!safeId) {
    return {
      status: 'degraded',
      modelId: '',
      reason: 'Aucun modèle 3D sélectionné (mode Liste actif)',
      manifest: null,
      capabilities: DEGRADED_BAG_CAPABILITIES,
      root: null,
      parts: new Map(),
      anchors: new Map(),
      hinges: new Map(),
      dispose: () => {},
    };
  }

  let manifest: BagManifest | null = null;
  try {
    // Le manifeste vient d'abord : c'est lui qui dit quels paliers existent et où ils sont. Un
    // aller-retour de plus sur un fichier de deux kilo-octets, contre le risque de télécharger
    // quarante mégaoctets à un appareil qui ne peut pas les porter.
    const loadedManifest = await provider.fetchManifest(safeId);
    manifest = loadedManifest;
    const profile = options.device ?? readDeviceProfile();
    const decision = chooseBagTier(loadedManifest, {
      ...profile,
      override: options.preferredTier ?? profile.override ?? null,
    });
    const assetUrl = resolveBagAssetUrl(loadedManifest, decision.tier) ?? undefined;
    const glbBuffer = await provider.fetchGlb(safeId, assetUrl);

    const brut = parseGlbBuffer(glbBuffer);
    const { json, bin } = await decodeMeshopt(brut.json, brut.bin);
    const textures = await chargerTextures(json, bin);
    const root = new THREE.Group();
    root.name = `bag-scene:${safeId}`;

    const parts = new Map<BagPartId, THREE.Mesh>();
    const anchors = new Map<string, BagAnchorSpec>();
    const hinges = new Map<BagPartId, BagHingeSpec>();
    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    const buildNode = (nodeIdx: number): THREE.Object3D => {
      const n = json.nodes?.[nodeIdx];
      if (!n) return new THREE.Object3D();

      let obj: THREE.Object3D;

      if (n.mesh !== undefined && json.meshes?.[n.mesh]) {
        const meshDef = json.meshes[n.mesh];
        const geometry = buildPrimitiveGeometry(json, bin, meshDef.primitives);

        // Chaque pièce reçoit SON propre matériau cloné pour garantir l'isolation D-04
        const material = createIsolatedMaterial(json, meshDef.primitives[0]?.material, textures);
        geometriesToDispose.push(geometry);
        materialsToDispose.push(material);

        const partName = meshDef.name || n.name || `part-${nodeIdx}`;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = partName;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        parts.set(partName, mesh);
        obj = mesh;
      } else {
        obj = new THREE.Object3D();
        obj.name = n.name ?? '';
      }

      // Un nœud glTF porte soit un triplet TRS, soit une matrice — jamais les deux. Le générateur
      // maison n'écrit que du TRS, mais un fichier venu d'ailleurs (Meshy, et l'importateur qui pose
      // sa mise à l'échelle sur un nœud racine) utilise la matrice. L'ignorer laissait le modèle à
      // son échelle d'origine, sans la moindre erreur.
      if (Array.isArray(n.matrix) && n.matrix.length === 16) {
        obj.matrixAutoUpdate = false;
        obj.matrix.fromArray(n.matrix);
        obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
        obj.matrixAutoUpdate = true;
      } else {
        if (n.translation) obj.position.set(n.translation[0], n.translation[1], n.translation[2]);
        if (n.rotation) obj.quaternion.set(n.rotation[0], n.rotation[1], n.rotation[2], n.rotation[3]);
        if (n.scale) obj.scale.set(n.scale[0], n.scale[1], n.scale[2]);
      }

      if (n.extras) {
        obj.userData = { ...n.extras };
        if (n.extras.hidden === true) {
          obj.visible = false;
        }
        // C-13: On n'expose une charnière QUE si le manifeste déclare `openable: true`
        if (n.extras.hinge && loadedManifest.capabilities.openable) {
          const h = n.extras.hinge;
          const partName = obj.name;
          hinges.set(partName, {
            axis: (h.axis ?? [1, 0, 0]) as Vec3Tuple,
            pivot: (h.pivot ?? [0, 0, 0]) as Vec3Tuple,
            maxAngleRad: typeof h.maxAngleRad === 'number' ? h.maxAngleRad : 1.5,
          });
        }
      }

      if (obj.name.startsWith('anchor:')) {
        const anchorId = obj.name.slice('anchor:'.length);
        const normal = (n.extras?.normal ?? [0, 0, 1]) as Vec3Tuple;
        anchors.set(anchorId, {
          id: anchorId,
          position: [obj.position.x, obj.position.y, obj.position.z],
          normal,
        });
      }

      if (n.children) {
        for (const childIdx of n.children) {
          obj.add(buildNode(childIdx));
        }
      }

      return obj;
    };

    const sceneIndex = json.scene ?? 0;
    const rootNodes = json.scenes?.[sceneIndex]?.nodes ?? [];
    for (const rootIdx of rootNodes) {
      root.add(buildNode(rootIdx));
    }

    // Double verrou d'honnêteté C-13 : si openable === true mais aucune charnière réelle dans le GLB,
    // on force openable = false dans les capacités exposées.
    const honestOpenable = Boolean(loadedManifest.capabilities.openable && hinges.size > 0);
    const capabilities: BagCapabilities = {
      ...loadedManifest.capabilities,
      openable: honestOpenable,
      hasInterior: honestOpenable && Boolean(loadedManifest.capabilities.hasInterior && parts.has('interior')),
    };

    const dispose = () => {
      for (const g of geometriesToDispose) {
        g.dispose();
      }
      for (const m of materialsToDispose) {
        m.dispose();
      }
      // Les textures de l'atlas sont partagées entre plusieurs matériaux : les libérer ici, une
      // fois chacune, plutôt qu'avec le premier matériau qui tombe. Un atlas 1024² oublié, c'est
      // quatre mégaoctets de mémoire vidéo retenus à chaque changement de sac.
      for (const t of textures.values()) {
        t.dispose();
      }
      root.clear();
    };

    return {
      status: 'ready',
      modelId: safeId,
      manifest: loadedManifest,
      capabilities,
      root,
      parts,
      anchors,
      hinges,
      dispose,
    };
  } catch (err: any) {
    return {
      status: 'degraded',
      modelId: safeId,
      reason: err?.message || `Impossible de charger le modèle 3D ${safeId}`,
      manifest,
      capabilities: DEGRADED_BAG_CAPABILITIES,
      root: null,
      parts: new Map(),
      anchors: new Map(),
      hinges: new Map(),
      dispose: () => {},
    };
  }
}
