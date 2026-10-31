/**
 * src/features/kit-studio/scene/bag/loader.ts
 * Binary glTF 2.0 (.glb) + manifest loader for procedural LKDV bags (Lot L4-2 / C-13).
 *
 * Parses glTF 2.0 binary directly into Three.js scene objects with:
 * - Isolated `THREE.MeshStandardMaterial` per mesh (guarantees D-04 part isolation)
 * - Named `parts: Map<PartId, THREE.Mesh>`
 * - Named `anchors: Map<string, BagAnchorSpec>`
 * - Hinge extraction (`hinges: Map<PartId, BagHingeSpec>`), strictly gated by `manifest.capabilities.openable`
 * - Graceful degradation (`status: 'degraded'`) on missing/corrupt GLB or manifest without throwing
 */

import * as THREE from 'three';
import type { BagCapabilities, PartId } from '../../state/types';
import type { Vec3Tuple } from '../camera/intents';
import {
  DEGRADED_BAG_CAPABILITIES,
  type BagAnchorSpec,
  type BagHingeSpec,
  type BagManifest,
} from './parts';

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

export interface LoadedBagScene {
  status: 'ready';
  modelId: string;
  manifest: BagManifest;
  capabilities: BagCapabilities;
  root: THREE.Group;
  parts: Map<PartId, THREE.Mesh>;
  anchors: Map<string, BagAnchorSpec>;
  hinges: Map<PartId, BagHingeSpec>;
  dispose: () => void;
}

export interface DegradedBagScene {
  status: 'degraded';
  modelId: string;
  reason: string;
  manifest: BagManifest | null;
  capabilities: BagCapabilities;
  root: null;
  parts: Map<PartId, THREE.Mesh>;
  anchors: Map<string, BagAnchorSpec>;
  hinges: Map<PartId, BagHingeSpec>;
  dispose: () => void;
}

export type BagLoadResult = LoadedBagScene | DegradedBagScene;

export interface BagAssetProvider {
  fetchManifest: (modelId: string) => Promise<BagManifest>;
  fetchGlb: (modelId: string) => Promise<ArrayBuffer>;
}

const defaultBrowserProvider: BagAssetProvider = {
  async fetchManifest(modelId: string): Promise<BagManifest> {
    const res = await fetch(`/assets/bags/${encodeURIComponent(modelId)}.manifest.json`);
    if (!res.ok) {
      throw new Error(`Manifeste introuvable pour ${modelId} (HTTP ${res.status})`);
    }
    return res.json();
  },
  async fetchGlb(modelId: string): Promise<ArrayBuffer> {
    const res = await fetch(`/assets/bags/${encodeURIComponent(modelId)}.glb`);
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
    };
    doubleSided?: boolean;
  }>;
  accessors?: Array<{
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
  }>;
  bufferViews?: Array<{
    buffer: number;
    byteOffset?: number;
    byteLength: number;
  }>;
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
  const totalValues = accessor.count * itemSize;
  const startByte = bin.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  // Copy into aligned typed array so arbitrary byte offsets never throw RangeError
  if (accessor.componentType === COMPONENT_FLOAT) {
    const byteLen = totalValues * 4;
    const aligned = bin.buffer.slice(startByte, startByte + byteLen);
    return { array: new Float32Array(aligned), itemSize };
  }
  if (accessor.componentType === COMPONENT_USHORT) {
    const byteLen = totalValues * 2;
    const aligned = bin.buffer.slice(startByte, startByte + byteLen);
    return { array: new Uint16Array(aligned), itemSize };
  }
  if (accessor.componentType === COMPONENT_UINT) {
    const byteLen = totalValues * 4;
    const aligned = bin.buffer.slice(startByte, startByte + byteLen);
    return { array: new Uint32Array(aligned), itemSize };
  }
  throw new Error(`ComponentType glTF non supporté : ${accessor.componentType}`);
}

function createIsolatedMaterial(json: GltfJson, matIdx: number | undefined): THREE.MeshStandardMaterial {
  const def = matIdx !== undefined ? json.materials?.[matIdx] : undefined;
  const pbr = def?.pbrMetallicRoughness;
  const base = pbr?.baseColorFactor ?? [0.24, 0.35, 0.29, 1];
  const color = new THREE.Color().setRGB(base[0], base[1], base[2]);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: pbr?.roughnessFactor ?? 0.85,
    metalness: pbr?.metallicFactor ?? 0.0,
    side: def?.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  material.name = def?.name ?? 'bag-material';
  return material;
}

export async function loadBagAsset(
  modelId: string | null | undefined,
  provider: BagAssetProvider = defaultBrowserProvider
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
    const [loadedManifest, glbBuffer] = await Promise.all([
      provider.fetchManifest(safeId),
      provider.fetchGlb(safeId),
    ]);
    manifest = loadedManifest;

    const { json, bin } = parseGlbBuffer(glbBuffer);
    const root = new THREE.Group();
    root.name = `bag-scene:${safeId}`;

    const parts = new Map<PartId, THREE.Mesh>();
    const anchors = new Map<string, BagAnchorSpec>();
    const hinges = new Map<PartId, BagHingeSpec>();
    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    const buildNode = (nodeIdx: number): THREE.Object3D => {
      const n = json.nodes?.[nodeIdx];
      if (!n) return new THREE.Object3D();

      let obj: THREE.Object3D;

      if (n.mesh !== undefined && json.meshes?.[n.mesh]) {
        const meshDef = json.meshes[n.mesh];
        const prim = meshDef.primitives[0];
        const geometry = new THREE.BufferGeometry();

        if (prim.attributes.POSITION !== undefined) {
          const pos = readAccessorArray(json, bin, prim.attributes.POSITION);
          geometry.setAttribute('position', new THREE.BufferAttribute(pos.array, pos.itemSize));
        }
        if (prim.attributes.NORMAL !== undefined) {
          const norm = readAccessorArray(json, bin, prim.attributes.NORMAL);
          geometry.setAttribute('normal', new THREE.BufferAttribute(norm.array, norm.itemSize));
        } else {
          geometry.computeVertexNormals();
        }
        if (prim.indices !== undefined) {
          const idx = readAccessorArray(json, bin, prim.indices);
          geometry.setIndex(new THREE.BufferAttribute(idx.array, 1));
        }

        // Chaque pièce reçoit SON propre matériau cloné pour garantir l'isolation D-04
        const material = createIsolatedMaterial(json, prim.material);
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

      if (n.translation) obj.position.set(n.translation[0], n.translation[1], n.translation[2]);
      if (n.rotation) obj.quaternion.set(n.rotation[0], n.rotation[1], n.rotation[2], n.rotation[3]);
      if (n.scale) obj.scale.set(n.scale[0], n.scale[1], n.scale[2]);

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
