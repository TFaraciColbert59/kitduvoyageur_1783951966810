/**
 * Écriture directe d'un GLB (glTF 2.0 binaire) depuis un graphe three.js.
 *
 * Pourquoi ne pas utiliser GLTFExporter : il est écrit pour le navigateur et
 * ne se termine pas sous Node (promesse non résolue dans `writeAsync`,
 * vérifié le 2026-10-31 avec three 0.180). Ce writer couvre exactement ce
 * dont le générateur a besoin — maillages nommés, matériaux PBR, nœuds vides
 * nommés pour les ancres — et rien de plus. Aucune texture, aucune animation,
 * aucun squelette : les matières sont des paramètres, pas des bitmaps.
 *
 * Sortie conforme glTF 2.0 : en-tête 12 o, chunk JSON, chunk BIN, chacun
 * aligné sur 4 octets.
 */

const CT = { FLOAT: 5126, UINT: 5125, USHORT: 5123 };
const TARGET = { ARRAY_BUFFER: 34962, ELEMENT_ARRAY_BUFFER: 34963 };

function pad4(n) { return (4 - (n % 4)) % 4; }

export function writeGLB(root, { generator = 'lkdv-glb-writer' } = {}) {
  const json = {
    asset: { version: '2.0', generator },
    scene: 0, scenes: [{ nodes: [] }],
    nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [],
  };

  const chunks = [];      // morceaux du buffer binaire
  let offset = 0;

  const pushView = (typedArray, target) => {
    const bytes = Buffer.from(
      typedArray.buffer, typedArray.byteOffset, typedArray.byteLength
    );
    const padding = pad4(offset);
    if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
    const view = { buffer: 0, byteOffset: offset, byteLength: bytes.length };
    if (target) view.target = target;
    json.bufferViews.push(view);
    chunks.push(bytes);
    offset += bytes.length;
    return json.bufferViews.length - 1;
  };

  const pushAccessor = (typedArray, componentType, type, count, target, minMax) => {
    const viewIndex = pushView(typedArray, target);
    const accessor = { bufferView: viewIndex, componentType, count, type };
    if (minMax) { accessor.min = minMax.min; accessor.max = minMax.max; }
    json.accessors.push(accessor);
    return json.accessors.length - 1;
  };

  // — Matériaux, dédupliqués par nom
  const materialIndex = new Map();
  const getMaterial = (m) => {
    const name = m?.name || 'default';
    if (materialIndex.has(name)) return materialIndex.get(name);
    const c = m?.color ?? { r: 0.8, g: 0.8, b: 0.8 };
    json.materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [c.r, c.g, c.b, 1],
        metallicFactor: m?.metalness ?? 0,
        roughnessFactor: m?.roughness ?? 0.9,
      },
      doubleSided: false,
    });
    const index = json.materials.length - 1;
    materialIndex.set(name, index);
    return index;
  };

  // — Parcours du graphe
  const walk = (object3d) => {
    const node = { name: object3d.name || undefined };

    const p = object3d.position, q = object3d.quaternion, s = object3d.scale;
    if (p.x || p.y || p.z) node.translation = [p.x, p.y, p.z];
    if (q.x || q.y || q.z || q.w !== 1) node.rotation = [q.x, q.y, q.z, q.w];
    if (s.x !== 1 || s.y !== 1 || s.z !== 1) node.scale = [s.x, s.y, s.z];

    // userData conservé en `extras` : c'est là que vivent les charnières et
    // les normales d'ancre, que le Studio relit au chargement.
    if (object3d.userData && Object.keys(object3d.userData).length) {
      node.extras = { ...object3d.userData };
    }

    if (object3d.isMesh && object3d.geometry) {
      const g = object3d.geometry;
      const attributes = {};

      const pos = g.attributes.position;
      const posArray = pos.array instanceof Float32Array
        ? pos.array : new Float32Array(pos.array);
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < posArray.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = posArray[i + k];
          if (v < min[k]) min[k] = v;
          if (v > max[k]) max[k] = v;
        }
      }
      attributes.POSITION = pushAccessor(
        posArray, CT.FLOAT, 'VEC3', pos.count, TARGET.ARRAY_BUFFER, { min, max }
      );

      if (g.attributes.normal) {
        const n = g.attributes.normal;
        const nArray = n.array instanceof Float32Array
          ? n.array : new Float32Array(n.array);
        attributes.NORMAL = pushAccessor(
          nArray, CT.FLOAT, 'VEC3', n.count, TARGET.ARRAY_BUFFER
        );
      }

      // Coordonnées de texture : les géométries three en produisent, et sans elles aucune
      // matière ne peut se poser sur le sac. Elles étaient calculées puis jetées à l'export.
      if (g.attributes.uv) {
        const uv = g.attributes.uv;
        const uvArray = uv.array instanceof Float32Array
          ? uv.array : new Float32Array(uv.array);
        attributes.TEXCOORD_0 = pushAccessor(
          uvArray, CT.FLOAT, 'VEC2', uv.count, TARGET.ARRAY_BUFFER
        );
      }

      const primitive = { attributes, material: getMaterial(object3d.material), mode: 4 };

      if (g.index) {
        const count = g.index.count;
        // UNSIGNED_SHORT quand on peut : moitié moins d'octets.
        const useShort = pos.count < 65536;
        const idx = useShort
          ? new Uint16Array(g.index.array)
          : new Uint32Array(g.index.array);
        primitive.indices = pushAccessor(
          idx, useShort ? CT.USHORT : CT.UINT, 'SCALAR', count,
          TARGET.ELEMENT_ARRAY_BUFFER
        );
      }

      json.meshes.push({ name: object3d.name || undefined, primitives: [primitive] });
      node.mesh = json.meshes.length - 1;
    }

    const children = [];
    for (const child of object3d.children) children.push(walk(child));
    if (children.length) node.children = children;

    json.nodes.push(node);
    return json.nodes.length - 1;
  };

  json.scenes[0].nodes.push(walk(root));

  // — Assemblage binaire
  const bin = Buffer.concat(chunks);
  const binPadded = Buffer.concat([bin, Buffer.alloc(pad4(bin.length))]);
  json.buffers.push({ byteLength: bin.length });

  const jsonText = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadded = Buffer.concat([
    jsonText, Buffer.alloc(pad4(jsonText.length), 0x20),   // espaces
  ]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);                                  // "glTF"
  header.writeUInt32LE(2, 4);                                           // version
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);                              // "JSON"

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binPadded.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);                               // "BIN"

  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
}

/** Relecture minimale : vérifie qu'un GLB produit est bien formé. */
export function readGLBHeader(buf) {
  if (buf.length < 20) throw new Error('GLB trop court');
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('magic glTF absent');
  const version = buf.readUInt32LE(4);
  const total = buf.readUInt32LE(8);
  if (total !== buf.length) throw new Error(`longueur annoncée ${total} ≠ réelle ${buf.length}`);
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('chunk JSON absent');
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  let binLen = 0;
  if (buf.length > 20 + jsonLen) {
    binLen = buf.readUInt32LE(20 + jsonLen);
    if (buf.readUInt32LE(24 + jsonLen) !== 0x004e4942) throw new Error('chunk BIN absent');
  }
  return { version, json, jsonLen, binLen };
}
