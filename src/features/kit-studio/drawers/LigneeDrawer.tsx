'use client';

/**
 * src/features/kit-studio/drawers/LigneeDrawer.tsx
 * Tiroir Lignée du Kit Studio — vue pure sur les champs existants de lignée et journal (Lot L6-4 / D-12..D-15).
 *
 * INVARIANTS STRICTS :
 * - D-12 : Aucune table nouvelle — consomme exclusivement `/api/kits/[id]/sheet` et les colonnes existantes de `materiel_kits`.
 * - D-13 : Aucune génération artificielle inventée — la profondeur de ramification n'est affichée que si `forkedFrom` est réel et `generation > 0`.
 * - D-14 : Vocabulaire public strict (`lignée`, `kit souche`, `éprouvé`, `part créateur`) — zéro référence à l'orientation privée.
 * - D-15 : Aucune coordonnée géographique exposée dans le carnet de lignée (`sanitizeLineageJournalEntries`).
 */

import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, GitBranch, Sprout } from 'lucide-react';
import {
  DrawerEmpty,
  DrawerError,
  DrawerShell,
  DrawerSkeleton,
  type DrawerTab,
} from '@/components/ui/drawer';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface SafeLineageJournalEntry {
  id: string;
  title: string;
  dateLabel: string | null;
  regionLabel: string | null; // nom de massif/région uniquement, JAMAIS de coordonnées GPS
  note: string | null;
}

export interface KitLineageSheetView {
  kitId: string;
  name: string;
  origin: 'personnel' | 'souche_editoriale' | 'issu_souche' | string;
  isSouche: boolean;
  forkedFromId: string | null;
  parentName: string | null;
  generationDepth: number | null; // null si non ramifié (D-13 : jamais de numéro factice)
  fieldProvenCount: number;
  creatorShareEligible: boolean;
  journal: SafeLineageJournalEntry[];
}

/**
 * D-15 / SEC-09 : Purifie les entrées de carnet de lignée pour exclure toute coordonnée GPS brute.
 */
export function sanitizeLineageJournalEntries(
  rawEntries: ReadonlyArray<Record<string, unknown>> | null | undefined
): SafeLineageJournalEntry[] {
  if (!Array.isArray(rawEntries)) return [];

  return rawEntries.map((entry, idx) => {
    // On ignore délibérément latitude, longitude, lat, lon, lng, coords, coordinates, gpx
    const rawRegion =
      typeof entry.region === 'string'
        ? entry.region
        : typeof entry.massif === 'string'
          ? entry.massif
          : typeof entry.place_label === 'string'
            ? entry.place_label
            : null;

    // Filtre anti-coordonnées numériques déguisées dans un libellé texte
    const looksLikeCoords =
      rawRegion !== null && /-?\d{1,2}\.\d{3,}\s*[,;/]\s*-?\d{1,3}\.\d{3,}/.test(rawRegion);

    return {
      id: typeof entry.id === 'string' ? entry.id : `journal-${idx}`,
      title:
        typeof entry.title === 'string' && entry.title.trim()
          ? entry.title.trim()
          : 'Sortie enregistrée',
      dateLabel:
        typeof entry.date === 'string'
          ? entry.date.slice(0, 10)
          : typeof entry.created_at === 'string'
            ? entry.created_at.slice(0, 10)
            : null,
      regionLabel: looksLikeCoords ? null : rawRegion,
      note: typeof entry.note === 'string' ? entry.note : null,
    };
  });
}

/**
 * D-12 & D-13 : Normalise la réponse de `/api/kits/[id]/sheet` sans jamais inventer de génération.
 */
export function normalizeKitLineageSheet(
  kitId: string,
  raw: Record<string, any> | null | undefined
): KitLineageSheetView {
  if (!raw) {
    return {
      kitId,
      name: 'Kit',
      origin: 'personnel',
      isSouche: false,
      forkedFromId: null,
      parentName: null,
      generationDepth: null,
      fieldProvenCount: 0,
      creatorShareEligible: false,
      journal: [],
    };
  }

  const forkedFromId =
    typeof raw.forkedFrom === 'string' && raw.forkedFrom
      ? raw.forkedFrom
      : typeof raw.forked_from === 'string' && raw.forked_from
        ? raw.forked_from
        : null;

  const rawGen =
    typeof raw.generation === 'number' && Number.isFinite(raw.generation)
      ? raw.generation
      : null;

  // D-13 : Profondeur de lignée retenue UNIQUEMENT si réellement ramifié depuis un parent
  const generationDepth =
    forkedFromId !== null && rawGen !== null && rawGen > 0 ? rawGen : null;

  const isSouche = Boolean(raw.isSouche ?? raw.is_souche ?? raw.origin === 'souche_editoriale');
  const fieldProvenCount =
    typeof raw.fieldProvenCount === 'number' && raw.fieldProvenCount >= 0
      ? raw.fieldProvenCount
      : typeof raw.field_proven_count === 'number' && raw.field_proven_count >= 0
        ? raw.field_proven_count
        : 0;

  return {
    kitId,
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Kit',
    origin: typeof raw.origin === 'string' ? raw.origin : isSouche ? 'souche_editoriale' : 'personnel',
    isSouche,
    forkedFromId,
    parentName:
      typeof raw.parentName === 'string'
        ? raw.parentName
        : typeof raw.parent_name === 'string'
          ? raw.parent_name
          : null,
    generationDepth,
    fieldProvenCount,
    creatorShareEligible: Boolean(raw.creatorShareEligible ?? isSouche),
    journal: sanitizeLineageJournalEntries(raw.journal),
  };
}

export interface LigneeDrawerProps {
  kitId: string;
  initialLineage?: Record<string, any> | null;
}

export function LigneeDrawer({ kitId, initialLineage }: LigneeDrawerProps) {
  const { haptic } = useHapticFeedback();
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [sheet, setSheet] = useState<KitLineageSheetView | null>(() =>
    initialLineage !== undefined ? normalizeKitLineageSheet(kitId, initialLineage) : null
  );
  const [loading, setLoading] = useState<boolean>(initialLineage === undefined);
  const [error, setError] = useState<string | null>(null);

  const loadLineage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/kits/${encodeURIComponent(kitId)}/sheet`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 404) {
        // Kit personnel neuf non encore publié comme fiche publique : état honnête sans erreur bloquante
        setSheet(normalizeKitLineageSheet(kitId, null));
        return;
      }
      if (!res.ok) {
        throw new Error(`Lecture lignée indisponible (${res.status})`);
      }
      const data = await res.json();
      setSheet(normalizeKitLineageSheet(kitId, data));
    } catch (err: any) {
      setError(err?.message || 'Impossible de charger la lignée de ce kit.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLineage !== undefined) {
      setSheet(normalizeKitLineageSheet(kitId, initialLineage));
      setLoading(false);
      return;
    }
    void loadLineage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitId, initialLineage]);

  const renderTreePane = () => {
    if (loading) return <DrawerSkeleton />;
    if (error) return <DrawerError onRetry={loadLineage} />;
    if (!sheet) return null;

    return (
      <div data-testid="studio-lignee-pane" className="space-y-4 pb-8 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
        {/* Statut de lignée & kit souche (D-14 : vocabulaire public exact) */}
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--hub-secondary)]">
              <Sprout className="w-4 h-4 text-[var(--hub-action)]" aria-hidden="true" />
              <span>{sheet.isSouche ? 'Kit souche' : 'Lignée du matériel'}</span>
            </span>

            {sheet.fieldProvenCount > 0 && (
              <span
                data-testid="lignee-proven-badge"
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--hub-primary-subtle)] text-[var(--hub-primary)] inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Éprouvé ({sheet.fieldProvenCount} sortie{sheet.fieldProvenCount > 1 ? 's' : ''})</span>
              </span>
            )}
          </div>

          <h4 className="text-base font-bold text-[var(--hub-primary)]">{sheet.name}</h4>

          {sheet.forkedFromId ? (
            <div
              data-testid="lignee-parent-branch"
              className="p-3 rounded-xl bg-[var(--hub-surface)] border border-[var(--hub-border-subtle)] text-xs space-y-1"
            >
              <div className="font-semibold text-[var(--hub-text-primary)]">
                Issu du kit souche : {sheet.parentName || sheet.forkedFromId}
              </div>
              {sheet.generationDepth !== null && (
                <div className="text-[var(--hub-text-secondary)]">
                  Ramification réelle de profondeur {sheet.generationDepth} dans la lignée.
                </div>
              )}
            </div>
          ) : (
            <p
              data-testid="lignee-root-honest"
              className="text-xs text-[var(--hub-text-secondary)]"
            >
              {sheet.isSouche
                ? 'Ce kit souche constitue une référence d’origine pouvant inspirer d’autres préparations.'
                : 'Kit personnel original — aucune ramification antérieure enregistrée.'}
            </p>
          )}

          {sheet.creatorShareEligible && (
            <div className="pt-2 border-t border-[var(--hub-border-subtle)] text-xs text-[var(--hub-text-secondary)]">
              Part créateur active sur les équipements affiliés issus de ce kit souche.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderJournalPane = () => {
    if (loading) return <DrawerSkeleton />;
    if (error) return <DrawerError onRetry={loadLineage} />;
    if (!sheet || sheet.journal.length === 0) {
      return (
        <div className="p-4 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)]">
          <DrawerEmpty
            title="Aucune sortie éprouvée au carnet"
            hint="Les sorties validées avec ce sac apparaîtront ici sans jamais exposer vos coordonnées GPS."
          />
        </div>
      );
    }

    return (
      <div data-testid="studio-lignee-journal" className="space-y-2.5 pb-8 flex-1 min-h-0 w-full overflow-y-auto overscroll-contain">
        {sheet.journal.map((entry) => (
          <div
            key={entry.id}
            data-testid={`lignee-journal-entry-${entry.id}`}
            className="p-3.5 rounded-2xl bg-[var(--hub-surface-card)] border border-[var(--hub-border)] space-y-1 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm text-[var(--hub-text-primary)]">{entry.title}</strong>
              {entry.dateLabel && (
                <span className="text-[var(--hub-text-muted)]">{entry.dateLabel}</span>
              )}
            </div>
            {entry.regionLabel && (
              <div className="font-medium text-[var(--hub-secondary)]">{entry.regionLabel}</div>
            )}
            {entry.note && <p className="text-[var(--hub-text-secondary)]">{entry.note}</p>}
          </div>
        ))}
      </div>
    );
  };

  const tabs: DrawerTab[] = [
    {
      id: 'lignee',
      label: 'Lignée',
      icon: <GitBranch className="w-4 h-4" aria-hidden="true" />,
      render: renderTreePane,
    },
    {
      id: 'carnet',
      label: 'Sorties éprouvées',
      icon: <BookOpen className="w-4 h-4" aria-hidden="true" />,
      render: renderJournalPane,
    },
  ];

  return (
    <DrawerShell
      tabs={tabs}
      activeIndex={tabIndex}
      onIndexChange={(idx) => {
        haptic('selection');
        setTabIndex(idx);
      }}
    />
  );
}
