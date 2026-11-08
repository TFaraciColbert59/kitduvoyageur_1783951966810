/**
 * src/features/kit-studio/scene/bag/modelLayer.ts
 * Couche « GLB ou procédural » de la scène survivante (P3).
 *
 * Le sac de la scène est construit par code (`bagBuilder.ts`) : c'est le défaut, et il le
 * reste tant qu'aucun maillage n'est déclaré pour le corps courant. Dès qu'un modèle GLB
 * est disponible (manifeste + `.glb` dans `public/assets/bags/`), il remplace le sac
 * procédural à l'écran — la scène, la caméra, la table et les objets ne changent pas.
 *
 * Règles :
 * - dégradation silencieuse : GLB/manifeste absent ou corrompu → le sac procédural reste,
 *   l'interface peut l'annoncer, rien ne casse (C-13) ;
 * - disposition propre : le GLB remplacé ou la scène détruite libère géométries et matériaux ;
 * - aucun contexte WebGL créé ici : les textures passent par le banc de la scène, qui meurt
 *   avec le renderer (ADR-002 : un seul contexte vivant).
 */

import * as THREE from 'three';
import type { BagCapabilities, BagModel, BagPartAppearance, Vec3Tuple } from '../../domain/bagModel';
import {
  bagModelFromManifest,
  bagPartAppearances,
  isBuiltinBagModel,
} from '../../domain/bagModel';
import type { ConfigSet } from '../../domain/catalog';
import { GROUND_Y } from '../layout';
import { applyAllCustomizations } from './materials';
import { loadBagAsset, type BagAssetProvider, type BagLoadResult, type LoadedBagAsset } from './loader';
import { applyAtlasAppearance, type AtlasMaps } from './atlas';
import { chargerTextureDonnee } from './loader';
import { resolveBagAttachmentAnchors } from '../../domain/bagAnchorsTable';
import {
  AVAILABLE_3D_MODULE_MANIFESTS,
  createModuleAttachmentController,
  type ModuleAttachmentController,
} from './moduleLoader';

/** Adresse de la tuile de trame, partagée par tous les sacs : une seule texture pour la gamme. */
const TRAME_URL = '/assets/materials/weave-normal.webp';
let trameEnCours: Promise<THREE.Texture | null> | null = null;

/** Charge la tuile de trame une seule fois ; les sacs suivants réutilisent la même texture. */
function tramePartagee(): Promise<THREE.Texture | null> {
  trameEnCours ??= chargerTextureDonnee(TRAME_URL).then((tex) => {
    if (tex) tex.anisotropy = 8;
    return tex;
  });
  return trameEnCours;
}
import type { TextureBank } from '../textures';

/** Source de rendu choisie pour le sac courant. */
export type BagRenderSource =
  | { readonly kind: 'glb'; readonly modelId: string }
  | { readonly kind: 'procedural' };

/**
 * Mapping « corps du studio » → modèle GLB.
 * - Correspondance 1:1 pour les cinq sacs de la gamme LKDV ONE.
 * - Rapprochement par capacité pour les deux corps d'origine en héritage (lecture des kits existants) :
 *   b42 → lkdv-one-45 (+3 L), b28 → lkdv-one-25 (-3 L).
 */
export const GLB_MODEL_BY_BAG: Readonly<Record<string, string>> = {
  'lkdv-one-15': 'lkdv-one-15',
  'lkdv-one-25': 'lkdv-one-25',
  'lkdv-one-45': 'lkdv-one-45',
  'lkdv-one-60': 'lkdv-one-60',
  'lkdv-one-80': 'lkdv-one-80',
  b42: 'lkdv-one-45',
  b28: 'lkdv-one-25',
};

/** Modèle GLB d'un corps du studio, ou `null` si le corps se construit par code. */
export function glbModelForBag(bagId: string | null | undefined): string | null {
  if (!bagId) return null;
  return GLB_MODEL_BY_BAG[bagId] ?? null;
}

/**
 * Choix de la source de rendu. `override` (test, lien profond, donnée serveur à venir)
 * gagne toujours ; sinon le mapping par corps décide ; sinon procédural.
 */
export function selectBagRenderSource(
  override: string | null | undefined,
  bagId: string | null | undefined,
): BagRenderSource {
  const wanted = override?.trim() || glbModelForBag(bagId);
  return wanted ? { kind: 'glb', modelId: wanted } : { kind: 'procedural' };
}

export type BagColorCustomization = 'available' | 'unavailable-no-mask' | 'unavailable-no-atlas' | 'procedural';

/** Ce que la scène et l'interface savent du sac affiché (honnête : rien d'inventé). */
export interface BagModelRuntimeInfo {
  readonly status: 'procedural' | 'loading' | 'glb' | 'degraded';
  readonly modelId: string | null;
  readonly label: string | null;
  /** Pièces nommées réellement présentes dans le maillage. */
  readonly parts: readonly string[];
  /** Points d'accroche réellement présents dans le maillage. */
  readonly anchors: readonly string[];
  /** Capacités déclarées par le manifeste, `null` si aucun maillage. */
  readonly capabilities: BagCapabilities | null;
  /** Capacité déclarée en litres (`null` = non déclarée). */
  readonly declaredCapacityL: number | null;
  /** Personnalisation de couleur : jamais appliquée à un atlas entier (spec §4.6). */
  readonly colorCustomization: BagColorCustomization;
  /** Vrai quand au moins un maillage 3D de module est livré en production (§ 4.3). */
  readonly modules3dAvailable?: boolean;
  /** Message utilisateur en cas de refus de pose sur un point d'accroche déjà occupé (§ 4.3). */
  readonly attachmentNotice?: string | null;
  /** Identifiants des modules 3D actuellement montés sur les ancres du sac. */
  readonly mountedModules?: readonly string[];
  /** Raison de la dégradation, si dégradée. */
  readonly reason: string | null;
}

export interface BagModelLayerDeps {
  readonly scene: THREE.Scene;
  /** Banque de textures de la scène (trames, reliefs, panoramas). */
  readonly textures: TextureBank;
  /** Groupe du sac procédural, masqué tant qu'un GLB le remplace. */
  readonly proceduralBag: THREE.Group;
  /** Échelle de composition visée pour le maillage (hauteur du sac procédural courant). */
  readonly targetHeightM: () => number;
  /** Appelé à chaque changement d'état du modèle (chargement terminé, dégradé…). */
  readonly onChange?: (info: BagModelRuntimeInfo) => void;
  /** Source des fichiers (tests, assets hors réseau) ; défaut : `fetch('/assets/bags/…')`. */
  readonly provider?: BagAssetProvider;
  readonly reducedMotion?: boolean;
}

export interface BagModelLayer {
  /** Charge (si besoin) le modèle demandé ; un GLB déjà chargé n'est pas rechargé. */
  load(modelId: string | null | undefined): Promise<BagModelRuntimeInfo>;
  /** Applique la configuration d'apparence du studio au maillage chargé. */
  setAppearance(config: ConfigSet): void;
  /** Contrôleur d'accroche des modules 3D sur les points d'ancrage du sac chargé. */
  attachments(): ModuleAttachmentController | null;
  /** Boîte englobante de l'ensemble actif (sac + modules attachés). */
  getBounds(out: THREE.Box3): THREE.Box3;
  info(): BagModelRuntimeInfo;
  dispose(): void;
}

const DEGRADED_INFO: BagModelRuntimeInfo = {
  status: 'procedural',
  modelId: null,
  label: null,
  parts: [],
  anchors: [],
  capabilities: null,
  declaredCapacityL: null,
  colorCustomization: 'procedural',
  modules3dAvailable: AVAILABLE_3D_MODULE_MANIFESTS.length > 0,
  reason: null,
};

/** Hauteur que le maillage doit occuper dans la composition (sac procédural courant). */
function compositionScale(manifestHeightM: number, targetHeightM: number): number {
  if (!(manifestHeightM > 0) || !(targetHeightM > 0)) return 1;
  return THREE.MathUtils.clamp(targetHeightM / manifestHeightM, 0.35, 4);
}

export function createBagModelLayer(deps: BagModelLayerDeps): BagModelLayer {
  const { scene, textures, proceduralBag } = deps;
  const holder = new THREE.Group();
  holder.name = 'bag-model-layer';
  holder.visible = false;
  scene.add(holder);

  let info: BagModelRuntimeInfo = DEGRADED_INFO;
  let loaded: LoadedBagAsset | null = null;
  let model: BagModel | null = null;
  let attachmentCtrl: ModuleAttachmentController | null = null;
  let appearance: ConfigSet | null = null;
  let atlasMaps: AtlasMaps = { zones: null, weaveNormal: null };
  let loadToken = 0;
  let disposed = false;

  const emit = (next: BagModelRuntimeInfo): BagModelRuntimeInfo => {
    info = next;
    deps.onChange?.(next);
    return next;
  };

  const clearLoaded = (): void => {
    if (attachmentCtrl) {
      attachmentCtrl.dispose();
      attachmentCtrl = null;
    }
    if (!loaded) return;
    holder.remove(loaded.root);
    loaded.dispose();
    loaded = null;
    model = null;
    atlasMaps = { zones: null, weaveNormal: null };
    holder.visible = false;
    proceduralBag.visible = true;
  };

  const applyAppearance = (): void => {
    if (!loaded || !appearance) return;
    applyAppearanceToLoaded(loaded, appearance, textures, atlasMaps);
  };

  const place = (result: LoadedBagAsset): void => {
    const manifest = result.manifest;
    const isImported = Boolean(manifest.texturedSource || manifest.generatedBy === 'imported');
    const scale = isImported ? 1 : compositionScale(manifest.boundingBoxM.h, deps.targetHeightM());
    result.root.scale.setScalar(scale);
    // Origine du manifeste : centre du sol du sac (y = 0 au fond) → posé sur la table.
    result.root.position.set(0, GROUND_Y, 0);
    result.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  };

  return {
    async load(modelId) {
      if (disposed) return info;
      const wanted = modelId?.trim() || null;
      const token = ++loadToken;

      // Retour au procédural : libère le maillage et réaffiche le sac construit par code.
      if (!wanted) {
        clearLoaded();
        return emit({ ...DEGRADED_INFO });
      }
      if (loaded && info.modelId === wanted) return info;

      clearLoaded();
      emit({ ...DEGRADED_INFO, status: 'loading', modelId: wanted, reason: null });

      const result: BagLoadResult = await loadBagAsset(wanted, deps.provider);
      if (disposed || token !== loadToken) {
        result.dispose();
        return info;
      }
      if (result.status !== 'ready') {
        return emit({
          ...DEGRADED_INFO,
          status: 'degraded',
          modelId: wanted,
          reason: result.reason,
        });
      }

      loaded = result;
      model = bagModelFromManifest(result.manifest);
      // Les cartes d'un sac texturé : la zone, qui dit où est le tissu, et la trame, partagée par
      // toute la gamme. Chacune peut manquer sans empêcher l'affichage — seule la personnalisation
      // s'éteint, et elle est alors annoncée indisponible plutôt que fausse.
      if (result.manifest.texturedSource) {
        const adresse = result.manifest.zonesMapUrl;
        const fetchZones = deps.provider
          ? deps.provider.fetchZonesMap
          : (_id: string, url?: string) => (url ? chargerTextureDonnee(url) : Promise.resolve(null));
        const zones = fetchZones
          ? await fetchZones(wanted, adresse).catch(() => null)
          : null;
        atlasMaps = { zones, weaveNormal: zones ? await tramePartagee() : null };
      } else {
        atlasMaps = { zones: null, weaveNormal: null };
      }

      place(result);
      holder.add(result.root);
      holder.visible = true;
      proceduralBag.visible = false;
      applyAppearance();

      // Règle §4.6 / Avenant §4 : l'atlas d'un maillage texturé garde sa matière ; la couleur n'est
      // personnalisable que si une carte de zones existe (D-07).
      let colorCustomization: BagColorCustomization = 'procedural';
      if (result.manifest.texturedSource) {
        colorCustomization = atlasMaps.zones ? 'available' : 'unavailable-no-mask';
      }

      const provisionalAnchors = resolveBagAttachmentAnchors(result.manifest);
      const allAnchorSpecs =
        result.anchors.size > 0
          ? [...result.anchors.values()].map((a) => ({
              id: a.id,
              position: a.position,
              normal: a.normal,
            }))
          : provisionalAnchors;
      const getMountedModuleIds = (): readonly string[] => {
        if (!attachmentCtrl) return [];
        return attachmentCtrl
          .listAnchors()
          .map((a) => attachmentCtrl!.getMountedModule(a.id)?.moduleId)
          .filter((id): id is string => Boolean(id));
      };

      attachmentCtrl = createModuleAttachmentController(result.root, allAnchorSpecs, {
        reducedMotion: deps.reducedMotion,
        onNoticeChange(notice) {
          emit({ ...info, attachmentNotice: notice, mountedModules: getMountedModuleIds() });
        },
        onAttachmentChange() {
          emit({
            ...info,
            attachmentNotice: attachmentCtrl?.getLastRejectionNotice() ?? null,
            mountedModules: getMountedModuleIds(),
          });
        },
      });
      const anchorIds =
        result.anchors.size > 0
          ? [...result.anchors.keys()]
          : provisionalAnchors.map((a) => a.id);

      return emit({
        status: 'glb',
        modelId: wanted,
        label: result.manifest.label,
        parts: [...result.parts.keys()],
        anchors: anchorIds,
        capabilities: result.capabilities,
        declaredCapacityL: model.declaredCapacityL,
        colorCustomization,
        modules3dAvailable: AVAILABLE_3D_MODULE_MANIFESTS.length > 0,
        reason: null,
      });
    },
    setAppearance(config) {
      appearance = config;
      applyAppearance();
    },
    attachments() {
      return attachmentCtrl;
    },
    getBounds(out: THREE.Box3) {
      if (loaded && holder.visible) {
        loaded.root.updateMatrixWorld(true);
        out.setFromObject(loaded.root);
        return out;
      }
      proceduralBag.updateMatrixWorld(true);
      out.setFromObject(proceduralBag);
      return out;
    },
    info() {
      return info;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loadToken += 1;
      clearLoaded();
      scene.remove(holder);
      info = DEGRADED_INFO;
    },
  };
}

/** Apparences GLB dérivées de la configuration d'apparence du studio. */
export function appearanceEntries(config: ConfigSet): Record<string, BagPartAppearance> {
  return { ...bagPartAppearances(config) };
}

/**
 * Applique la configuration du studio aux pièces réellement présentes dans le maillage :
 * couleur, matière (preset de trame) et finition. Exporté pour être testé sans scène.
 */
export function applyAppearanceToLoaded(
  loaded: LoadedBagAsset,
  config: ConfigSet,
  textures: TextureBank,
  customMaps?: AtlasMaps | null,
): void {
  if (loaded.manifest.texturedSource) {
    applyAtlasAppearance(loaded, config, customMaps ?? { zones: null, weaveNormal: null });
  } else {
    applyAllCustomizations(loaded.parts, appearanceEntries(config), textures);
  }
}

export { isBuiltinBagModel };
export type { Vec3Tuple };
