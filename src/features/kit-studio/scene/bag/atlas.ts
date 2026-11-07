/**
 * src/features/kit-studio/scene/bag/atlas.ts
 * Apparence des sacs importés texturés — avenant du 7 novembre, § 4.
 *
 * Un sac LKDV ONE (`texturedSource: true`) porte toute son apparence dans un atlas : le tissu
 * olive, les sangles, les boucles noires, les fermetures et l'écusson y cohabitent dans une seule
 * image et un seul matériau. Pour traiter chaque famille différemment, il faut savoir où elle est :
 * c'est le rôle de la **carte de zones**, trois canaux dans les UV de l'atlas — rouge pour le
 * tissu, vert pour les sangles et le textile technique, bleu pour les pièces rigides.
 *
 * Ce que cette carte permet, et que rien ne permettait sans elle :
 * - teinter la seule zone tissu, en multipliant la luminance de l'albédo plutôt qu'en la
 *   remplaçant, pour que les plis et les coutures survivent à un changement de couleur ;
 * - allumer la lueur textile (`sheen`) sur le tissu et les sangles, et la laisser éteinte sur les
 *   boucles — sans masque, allumer le sheen fait virer les boucles noires au vert pâle ;
 * - greffer une trame tissée à l'échelle physique sur les seules zones textiles ;
 * - baisser la rugosité des pièces rigides, pour qu'elles accrochent un reflet net.
 *
 * TOUT SE PASSE DANS LE SHADER, et c'est un choix, pas une commodité. La version précédente
 * recomposait trois textures de 2048×2048 sur le processeur à chaque changement de couleur : douze
 * millions d'opérations et cinquante mégaoctets d'allocation sur le fil principal, soit un gel à
 * chaque clic dans un configurateur dont le propos est justement d'essayer des coloris. Ici, un
 * changement de couleur écrit une valeur dans un paramètre et ne coûte rien.
 *
 * La trame est une tuile répétée, échantillonnée dans un second jeu d'UV **exprimé en mètres**
 * (`uv1`, projection en boîte). C'est la seule façon d'obtenir un tissage à pas constant : l'atlas
 * d'un modèle importé n'a ni échelle ni orientation homogènes, donc une trame peinte dans ses
 * coordonnées se déformerait d'une région à l'autre. Elle ne peut pas non plus venir de l'atlas
 * lui-même : 1024 pixels sur un sac de 66 cm font 0,9 pixel par millimètre, pour un fil de 0,4 mm.
 *
 * Sans carte de zones, rien ne s'allume : l'atlas reste strictement tel quel et la personnalisation
 * de couleur est annoncée indisponible. Teinter l'atlas entier repeindrait les boucles et
 * l'écusson, et c'est précisément le défaut qu'on corrige.
 */

import * as THREE from 'three';
import type { LoadedBagAsset } from './loader';
import { resolveTokenToThreeColor } from './materials';
import type { ConfigSet } from '../../domain/catalog';

/** Côté d'une tuile de trame, en mètres. Même convention que `scene/bag/fabricMaps.ts`. */
export const WEAVE_TILE_M = 0.1;

/** Rugosité par famille. Le tissu mate, le rigide accroche un reflet. */
export const FABRIC_ROUGHNESS = 0.82;
export const RIGID_ROUGHNESS = 0.25;

/** Couleur de la lueur textile : une olive claire, jamais blanche, qui reste crédible sur du tissu. */
export const SHEEN_COLOR = 0xbfd79a;

export interface AtlasMaps {
  /** Carte de zones dans les UV de l'atlas. Son absence éteint toute la personnalisation. */
  readonly zones: THREE.Texture | null;
  /** Tuile de trame tissée, répétée à l'échelle physique. Facultative. */
  readonly weaveNormal?: THREE.Texture | null;
}

/**
 * Réglages passés au shader. Fonction pure : c'est ici que se décide ce qui s'allume, et les tests
 * portent dessus. Le shader applique ces valeurs, il n'en invente aucune.
 */
export interface AtlasUniforms {
  /** Couleur de teinte du tissu, ou `null` quand le token n'en impose aucune. */
  readonly tint: { r: number; g: number; b: number } | null;
  readonly fabricRoughness: number;
  readonly rigidRoughness: number;
  readonly weaveStrength: number;
  /** Faux quand la carte de zones manque : le matériau doit alors rester intact. */
  readonly enabled: boolean;
}

/**
 * Déduit les réglages de la configuration du studio et de la présence des cartes.
 *
 * Deux garde-fous tiennent dans cette fonction, et c'est pour ça qu'elle est séparée du rendu :
 * sans carte de zones rien ne s'allume, et sans tuile de trame la force de trame est nulle.
 */
export function atlasUniformsFor(config: ConfigSet, maps: AtlasMaps): AtlasUniforms {
  if (!maps.zones) {
    return {
      tint: null,
      fabricRoughness: FABRIC_ROUGHNESS,
      rigidRoughness: RIGID_ROUGHNESS,
      weaveStrength: 0,
      enabled: false,
    };
  }
  const spec = config.body?.col;
  const color = spec ? resolveTokenToThreeColor(spec) : null;
  return {
    tint: color ? { r: color.r, g: color.g, b: color.b } : null,
    fabricRoughness: FABRIC_ROUGHNESS,
    rigidRoughness: RIGID_ROUGHNESS,
    weaveStrength: maps.weaveNormal ? 1 : 0,
    enabled: true,
  };
}

/** Luminance relative Rec. 709, en composantes 0..1. C'est la formule qu'applique aussi le shader. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Pose un second jeu d'UV exprimé en mètres, par projection en boîte selon la normale dominante.
 *
 * Idempotent : une géométrie partagée entre plusieurs pièces passe ici à chaque reconstruction, et
 * la projeter deux fois multiplierait l'échelle.
 */
export function applyMeterUvs(geometry: THREE.BufferGeometry, tileM = WEAVE_TILE_M): void {
  if (geometry.userData.uvMetersWeave === true) return;
  const pos = geometry.getAttribute('position');
  const nrm = geometry.getAttribute('normal');
  if (!pos || !nrm) return;
  const scale = 1 / tileM;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i));
    const ay = Math.abs(nrm.getY(i));
    const az = Math.abs(nrm.getZ(i));
    let u: number;
    let v: number;
    if (ay >= ax && ay >= az) {
      u = pos.getX(i); v = pos.getZ(i);
    } else if (ax >= az) {
      u = pos.getZ(i); v = pos.getY(i);
    } else {
      u = pos.getX(i); v = pos.getY(i);
    }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
  geometry.userData.uvMetersWeave = true;
}

interface GreffeUniforms {
  zonesMap: { value: THREE.Texture | null };
  weaveMap: { value: THREE.Texture | null };
  tintColor: { value: THREE.Color };
  tintAmount: { value: number };
  weaveStrength: { value: number };
  fabricRough: { value: number };
  rigidRough: { value: number };
}

/** Les paramètres vivants d'un matériau déjà greffé, pour les mettre à jour sans tout refaire. */
interface GreffeState {
  uniforms: GreffeUniforms;
}

const GREFFE = Symbol.for('lkdv.atlas.greffe');

type MateriauGreffe = THREE.MeshPhysicalMaterial & { [GREFFE]?: GreffeState };

/**
 * Greffe la lecture de la carte de zones sur un matériau, une fois pour toutes.
 *
 * Le shader standard de three ne sait pas traiter un matériau par régions ; on l'étend aux endroits
 * prévus pour ça. Chaque insertion est commentée parce qu'elle dépend du nom d'un bloc de three, et
 * qu'une montée de version peut les renommer.
 */
function greffer(mat: MateriauGreffe): GreffeState {
  const existant = mat[GREFFE];
  if (existant) return existant;

  const uniforms: GreffeUniforms = {
    zonesMap: { value: null },
    weaveMap: { value: null },
    tintColor: { value: new THREE.Color(1, 1, 1) },
    tintAmount: { value: 0 },
    weaveStrength: { value: 0 },
    fabricRough: { value: FABRIC_ROUGHNESS },
    rigidRough: { value: RIGID_ROUGHNESS },
  };

  // Clé de cache constante : distingue le programme greffé du MeshPhysicalMaterial natif de
  // three, sans jamais dépendre de la couleur ni d'un uniforme (changer de coloris ne recompile pas).
  mat.customProgramCacheKey = () => 'lkdv-atlas-zones-v1';

  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);

    sh.vertexShader = 'attribute vec2 uv1;\nvarying vec2 vTrameUv;\n' + sh.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\n  vTrameUv = uv1;'
    );

    sh.fragmentShader = sh.fragmentShader
      // Les uniformes et lkdvZones() doivent suivre <uv_pars_fragment>, où vMapUv est déclaré.
      .replace('#include <uv_pars_fragment>', `#include <uv_pars_fragment>
uniform sampler2D zonesMap;
uniform sampler2D weaveMap;
uniform vec3 tintColor;
uniform float tintAmount;
uniform float weaveStrength;
uniform float fabricRough;
uniform float rigidRough;
varying vec2 vTrameUv;
#ifdef USE_MAP
vec3 lkdvZones() { return texture2D(zonesMap, vMapUv).rgb; }
#else
vec3 lkdvZones() { return vec3(0.0); }
#endif`)
      // Teinte : la couleur du token multiplie la LUMINANCE de l'albédo, elle ne la remplace pas.
      // C'est ce qui fait survivre les plis, les coutures et l'usure à un changement de coloris.
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float zTissu = lkdvZones().r;
    if (tintAmount > 0.0 && zTissu > 0.0) {
      float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(diffuseColor.rgb, tintColor * lum, zTissu * tintAmount);
    }
  }`)
      // Rugosité : le rigide est plus poli que le tissu, donc il accroche un reflet net.
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  {
    vec3 z = lkdvZones();
    float cible = mix(fabricRough, rigidRough, z.b);
    roughnessFactor = mix(roughnessFactor, roughnessFactor * cible / max(fabricRough, 1e-4), max(z.r + z.g, z.b));
  }`)
      // Trame : une tuile en mètres, mélangée aux normales de l'atlas, sur les seules zones
      // textiles. Mélange « whiteout » : on additionne les pentes et on renormalise.
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 z = lkdvZones();
    float textile = min(1.0, z.r + z.g);
    if (weaveStrength > 0.0 && textile > 0.0) {
      vec3 d = texture2D(weaveMap, vTrameUv).xyz * 2.0 - 1.0;
      float k = weaveStrength * textile;
      normal = normalize(vec3(normal.xy + d.xy * k, normal.z));
    }
  }`)
      // Lueur textile : le tissu et les sangles l'ont, les boucles ne l'ont pas. Sans cette
      // modulation, allumer le sheen fait virer les boucles noires au vert pâle.
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_SHEEN
  {
    vec3 z = lkdvZones();
    material.sheenColor *= min(1.0, z.r + z.g) * (1.0 - z.b);
  }
#endif`);
  };

  const state: GreffeState = { uniforms };
  mat[GREFFE] = state;
  mat.needsUpdate = true;
  return state;
}

/** Convertit un matériau standard en matériau physique et active la lueur textile (sheen). */
function versPhysique(mat: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  let phys: THREE.MeshPhysicalMaterial;
  if ((mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    phys = mat as THREE.MeshPhysicalMaterial;
  } else {
    phys = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(phys, mat);
    phys.defines = { STANDARD: '', PHYSICAL: '' };
    phys.name = mat.name;
  }
  phys.sheen = 1;
  phys.sheenRoughness = 0.7;
  phys.sheenColor.setHex(SHEEN_COLOR);
  return phys;
}

/**
 * Applique l'apparence du studio à un sac importé texturé.
 *
 * Rend `true` quand la personnalisation a réellement pu s'appliquer. Un `false` n'est pas une
 * erreur : c'est l'état honnête d'un sac dont la carte de zones n'existe pas encore, et l'interface
 * doit alors annoncer la personnalisation indisponible plutôt que d'afficher une couleur fausse.
 */
export function applyAtlasAppearance(
  loaded: LoadedBagAsset,
  config: ConfigSet,
  maps: AtlasMaps,
): boolean {
  if (!loaded.manifest.texturedSource) return false;

  const reglages = atlasUniformsFor(config, maps);
  if (!reglages.enabled) return false;

  let applique = false;
  loaded.root.traverse((noeud) => {
    const mesh = noeud as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const materiaux = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materiaux.forEach((brut, index) => {
      const std = brut as THREE.MeshStandardMaterial;
      // Seul le matériau qui porte l'atlas est concerné. L'écusson et son support ont leurs
      // propres UV, hors de la carte de zones : les toucher les colorerait au hasard.
      if (
        !std.map ||
        mesh.name === 'LKDV_LOGO' ||
        mesh.name === 'LKDV_ECUSSON_SUPPORT' ||
        std.name === 'LKDV_MARQUAGE_PIERRE' ||
        std.name === 'LKDV_Ecusson_Tisse'
      ) {
        return;
      }

      const phys = versPhysique(std);
      if (phys !== std) {
        if (Array.isArray(mesh.material)) mesh.material[index] = phys;
        else mesh.material = phys;
      }

      if (maps.weaveNormal) applyMeterUvs(mesh.geometry);

      const { uniforms } = greffer(phys as MateriauGreffe);
      uniforms.zonesMap.value = maps.zones;
      uniforms.weaveMap.value = maps.weaveNormal ?? null;
      uniforms.weaveStrength.value = reglages.weaveStrength;
      uniforms.fabricRough.value = reglages.fabricRoughness;
      uniforms.rigidRough.value = reglages.rigidRoughness;
      if (reglages.tint) {
        uniforms.tintColor.value.setRGB(reglages.tint.r, reglages.tint.g, reglages.tint.b);
        uniforms.tintAmount.value = 1;
      } else {
        uniforms.tintAmount.value = 0;
      }
      applique = true;
    });
  });

  return applique;
}
