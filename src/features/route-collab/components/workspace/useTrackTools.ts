'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { RouteSport } from '@/features/adventure-prep/routeProfiles';
import { activePoints } from '../../engine';
import { sectionNeedsRouting } from '../../engineTrack';
import { searchAddress, type AddressSearch } from '../../pointEdit';
import {
  activeProfileId,
  patchRoutingOptions,
  profileOperation,
  type RouteProfileId,
  type SurfaceChoiceId,
} from '../../routingProfiles';
import { buildRoutingVariants, variantTarget, type VariantScope } from '../../routeClient';
import { buildValidatedGpx, planTrackImport } from '../../trackIo';
import { buildVersionTimeline, revertOperation, type VersionEntry } from '../../versionTimeline';
import type { RouteRevisionSnapshot, RouteShapeMode } from '../../types';
import { useRouteWorkspace } from './WorkspaceContext';

/** Au-delà, le recalcul n'est pas lancé tout seul : la personne le déclenche (un appel routeur par tronçon). */
export const AUTO_RECALC_MAX = 6;

const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * Les gestes de tracé (5.1 à 5.10) au-dessus des opérations du moteur : chacun passe par `runOperation`
 * (droits, versions d'entités, annulation, file hors ligne) ; aucun ne modifie l'atelier directement.
 */
export function useTrackTools() {
  const api = useRouteWorkspace();
  const {
    workspace,
    runOperation,
    getWorkspace,
    handleRealRouteSection,
    setStatusMessage,
    setFitTrigger,
    currentUserId,
    canEditGeo,
    canPublish,
    routingBusy,
  } = api;
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);

  const pending = useMemo(() => workspace.sections.filter(sectionNeedsRouting), [workspace.sections]);

  /** Recalcule les tronçons qui attendent un calcul (un seul après une suppression de point). */
  const recalcPending = useCallback(
    async (limit: number = Number.POSITIVE_INFINITY, silent = true) => {
      const ids = getWorkspace()
        .sections.filter(sectionNeedsRouting)
        .map((s) => s.id)
        .slice(0, limit);
      for (const id of ids) await handleRealRouteSection(id, silent);
      return ids.length;
    },
    [getWorkspace, handleRealRouteSection]
  );

  /** Après un geste qui a invalidé des tronçons : recalcul automatique si c'est court, sinon proposé. */
  const settle = useCallback(
    async (message?: string) => {
      const n = getWorkspace().sections.filter(sectionNeedsRouting).length;
      if (n === 0) {
        if (message) setStatusMessage(message);
        return;
      }
      if (n <= AUTO_RECALC_MAX) {
        const done = await recalcPending(AUTO_RECALC_MAX);
        if (message) setStatusMessage(`${message} ${done} tronçon${done > 1 ? 's' : ''} recalculé${done > 1 ? 's' : ''}.`);
      } else {
        setStatusMessage(`${message ?? 'Tracé modifié.'} ${n} tronçons attendent un calcul : lancez « Recalculer ».`);
      }
    },
    [getWorkspace, recalcPending, setStatusMessage]
  );

  const guard = useCallback(
    async (label: string, job: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(label);
      try {
        await job();
      } finally {
        busyRef.current = false;
        setBusy(null);
      }
    },
    []
  );

  /* ---------- 5.1 profil ---------- */
  const profileId = activeProfileId(workspace.sport, workspace.routingOptions);

  const chooseProfile = useCallback(
    (id: RouteProfileId) =>
      guard('profil', async () => {
        const ok = await runOperation(profileOperation(id, getWorkspace().routingOptions), {}, { gesture: `profile-${stamp()}` });
        if (ok) await settle('Profil modifié.');
      }),
    [getWorkspace, guard, runOperation, settle]
  );

  const patchOptions = useCallback(
    (patch: Partial<{ surface: SurfaceChoiceId; avoidSteps: boolean; avoidFerries: boolean; ebike: boolean }>) =>
      guard('options', async () => {
        const ws = getWorkspace();
        const sport: RouteSport = ws.sport;
        const ok = await runOperation(
          { type: 'set_sport_profile', sport, routingOptions: patchRoutingOptions(sport, ws.routingOptions, patch) },
          {},
          { gesture: `options-${stamp()}` }
        );
        if (ok) await settle('Réglages de routage modifiés.');
      }),
    [getWorkspace, guard, runOperation, settle]
  );

  /* ---------- 5.2 forme ---------- */
  const setShape = useCallback(
    (shapeMode: RouteShapeMode) =>
      guard('forme', async () => {
        const gesture = `shape-${stamp()}`;
        const ok = await runOperation({ type: 'set_shape_mode', shapeMode }, {}, { gesture });
        if (ok) {
          setFitTrigger((n: number) => n + 1);
          await settle('Forme modifiée.');
        }
      }),
    [guard, runOperation, setFitTrigger, settle]
  );

  const reverse = useCallback(
    () =>
      guard('sens', async () => {
        const ok = await runOperation({ type: 'reverse_route' }, {}, { gesture: `reverse-${stamp()}` });
        if (ok) await settle('Sens inversé : jours, nuits et horaires suivent.');
      }),
    [guard, runOperation, settle]
  );

  /* ---------- 5.3 / 5.6 points ---------- */
  const deletePoint = useCallback(
    (pointId: string) =>
      guard('point', async () => {
        const pt = getWorkspace().points.find((p) => p.id === pointId);
        const ok = await runOperation({ type: 'delete_point', pointId }, pt ? { [pointId]: pt.entityVersion } : {}, { gesture: `del-${stamp()}` });
        if (ok) await settle('Point supprimé : le tracé est recousu.');
      }),
    [getWorkspace, guard, runOperation, settle]
  );

  const renamePoint = useCallback(
    async (pointId: string, name: string, note?: string | null) => {
      const pt = getWorkspace().points.find((p) => p.id === pointId);
      if (!pt) return false;
      return runOperation({ type: 'update_point', pointId, name, ...(note !== undefined ? { note } : {}) }, { [pointId]: pt.entityVersion });
    },
    [getWorkspace, runOperation]
  );

  const movePointTo = useCallback(
    (pointId: string, lat: number, lon: number, label: string) =>
      guard('point', async () => {
        const pt = getWorkspace().points.find((p) => p.id === pointId);
        if (!pt) return;
        const ok = await runOperation({ type: 'move_point', pointId, lat, lon, eleM: null }, { [pointId]: pt.entityVersion }, { gesture: `move-${stamp()}` });
        if (ok) await settle(`Point déplacé ${label}.`);
      }),
    [getWorkspace, guard, runOperation, settle]
  );

  const [addressState, setAddressState] = useState<AddressSearch | 'loading' | null>(null);
  const findAddress = useCallback(async (query: string) => {
    setAddressState('loading');
    const res = await searchAddress(query);
    setAddressState(res);
    return res;
  }, []);

  /* ---------- 5.4 / 5.5 / 5.7 tronçons ---------- */
  const backToCalculation = useCallback(
    (sectionId: string) =>
      guard('tronçon', async () => {
        const sec = getWorkspace().sections.find((s) => s.id === sectionId);
        if (!sec) return;
        const ok = await runOperation({ type: 'set_section_mode', sectionId, mode: 'routed' }, { [sectionId]: sec.entityVersion });
        if (ok) await handleRealRouteSection(sectionId, false);
      }),
    [getWorkspace, guard, handleRealRouteSection, runOperation]
  );

  const makeManual = useCallback(
    async (sectionId: string) => {
      const sec = getWorkspace().sections.find((s) => s.id === sectionId);
      if (!sec) return false;
      return runOperation({ type: 'set_section_mode', sectionId, mode: 'manual' }, { [sectionId]: sec.entityVersion });
    },
    [getWorkspace, runOperation]
  );

  const splitSection = useCallback(
    (sectionId: string, lat: number, lon: number, name: string | null) =>
      guard('tronçon', async () => {
        const sec = getWorkspace().sections.find((s) => s.id === sectionId);
        if (!sec) return;
        const ok = await runOperation({ type: 'split_section', sectionId, pointId: `pt-cut-${stamp()}`, lat, lon, name }, { [sectionId]: sec.entityVersion });
        if (ok) setStatusMessage('Tronçon coupé : chaque moitié garde sa géométrie.');
      }),
    [getWorkspace, guard, runOperation, setStatusMessage]
  );

  const mergeSections = useCallback(
    (sectionId: string, withSectionId: string) =>
      guard('tronçon', async () => {
        const ws = getWorkspace();
        const a = ws.sections.find((s) => s.id === sectionId);
        const b = ws.sections.find((s) => s.id === withSectionId);
        if (!a || !b) return;
        const ok = await runOperation({ type: 'merge_sections', sectionId, withSectionId }, { [a.id]: a.entityVersion, [b.id]: b.entityVersion });
        if (ok) setStatusMessage('Tronçons fusionnés : le tracé est gardé tel quel, rien n’est recalculé.');
      }),
    [getWorkspace, guard, runOperation, setStatusMessage]
  );

  /* ---------- 5.9 fichiers ---------- */
  const importFile = useCallback(
    (file: File | null | undefined) =>
      guard('import', async () => {
        if (!file) return;
        let text = '';
        // FIT (binaire) est refusé avant la lecture : le message dit quoi exporter à la place.
        if (!/\.fit$/i.test(file.name)) {
          try {
            text = await file.text();
          } catch {
            setStatusMessage('Impossible de lire ce fichier.');
            return;
          }
        }
        const plan = planTrackImport(getWorkspace(), { name: file.name, size: file.size, text }, new Date().toISOString());
        if (!plan.ok) {
          setStatusMessage(plan.error);
          return;
        }
        const ok = await runOperation(plan.operation, {}, { gesture: `import-${stamp()}` });
        if (ok) {
          setFitTrigger((n: number) => n + 1);
          setStatusMessage(plan.message);
        }
      }),
    [getWorkspace, guard, runOperation, setFitTrigger, setStatusMessage]
  );

  const exportGpx = useCallback(
    (stageId?: string) => {
      const out = buildValidatedGpx(getWorkspace(), stageId);
      if (!out.ok) {
        setStatusMessage(out.reason);
        return false;
      }
      if (typeof window === 'undefined') return false;
      const blob = new Blob([out.xml], { type: 'application/gpx+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(out.scope === 'stage' ? 'Export GPX 1.1 de l’étape validé et téléchargé.' : 'Export GPX 1.1 complet validé et téléchargé.');
      return true;
    },
    [getWorkspace, setStatusMessage]
  );

  /* ---------- 5.8 variantes ---------- */
  const [variantNotes, setVariantNotes] = useState<string[]>([]);
  const createVariants = useCallback(
    (scope: VariantScope, id: string | null) =>
      guard('variantes', async () => {
        const ws = getWorkspace();
        const target = variantTarget(ws, scope, id);
        if ('error' in target) {
          setVariantNotes([target.error]);
          return;
        }
        setStatusMessage('Calcul des variantes par le routeur…');
        const out = await buildRoutingVariants({ workspace: ws, target, createdBy: currentUserId, nowIso: new Date().toISOString(), idSeed: stamp() });
        setVariantNotes(out.notes);
        let added = 0;
        for (const v of out.variants) {
          if (await runOperation({ type: 'add_variant', variant: v }, {}, { gesture: `variants-${v.id}` })) added += 1;
        }
        setStatusMessage(added > 0 ? `${added} variante${added > 1 ? 's' : ''} calculée${added > 1 ? 's' : ''} : comparez, puis appliquez.` : 'Aucune variante différente du tracé actuel.');
      }),
    [currentUserId, getWorkspace, guard, runOperation, setStatusMessage]
  );

  const applyVariant = useCallback(
    (variantId: string) =>
      guard('variantes', async () => {
        const ok = await runOperation({ type: 'apply_variant', variantId }, {}, { gesture: `apply-${stamp()}` });
        if (ok) setStatusMessage('Variante appliquée : le tracé a changé, sa surface est redevenue inconnue.');
      }),
    [guard, runOperation, setStatusMessage]
  );

  /* ---------- 5.10 versions ---------- */
  const versions: VersionEntry[] = useMemo(() => buildVersionTimeline(workspace, canPublish), [workspace, canPublish]);

  const revertTo = useCallback(
    (revision: RouteRevisionSnapshot) =>
      guard('versions', async () => {
        const ok = await runOperation(revertOperation(revision), {}, { gesture: `revert-${stamp()}` });
        if (ok) {
          setFitTrigger((n: number) => n + 1);
          setStatusMessage(`Retour à la version ${revision.revisionNo} : nouveau brouillon, l’historique reste entier.`);
        }
      }),
    [guard, runOperation, setFitTrigger, setStatusMessage]
  );

  return {
    busy: busy ?? (routingBusy ? 'calcul' : null),
    canEditGeo,
    canPublish,
    pending,
    pointCount: activePoints(workspace).length,
    recalcPending,
    profileId,
    chooseProfile,
    patchOptions,
    setShape,
    reverse,
    deletePoint,
    renamePoint,
    movePointTo,
    addressState,
    setAddressState,
    findAddress,
    backToCalculation,
    makeManual,
    splitSection,
    mergeSections,
    importFile,
    exportGpx,
    variantNotes,
    createVariants,
    applyVariant,
    versions,
    revertTo,
  };
}

export type TrackTools = ReturnType<typeof useTrackTools>;
