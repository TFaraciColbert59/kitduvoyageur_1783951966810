'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bike, Footprints, RefreshCw } from 'lucide-react';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import type { GearDefaultCandidate } from '@/features/gear/domain/types';
import styles from './GearAssociationSheet.module.css';

interface CatalogPayload {
  sport: string | null;
  items: GearDefaultCandidate[];
  existingGearIds: string[];
  defaultsAvailable: boolean;
}

export interface GearAssociationSheetProps {
  outingId: string;
  onClose: () => void;
  /** Appelé après un rattachement réussi, pour rafraîchir la sortie. */
  onAttached?: () => void;
}

function weightLabel(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return null;
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace('.', ',')} kg` : `${Math.round(value)} g`;
}

const GROUPS = [
  { kind: 'bike', label: 'Vélos', Icon: Bike },
  { kind: 'shoe', label: 'Chaussures', Icon: Footprints },
] as const;

/**
 * Sous-drawer d'association d'un vélo ou de chaussures à une sortie.
 *
 * Le catalogue vient du serveur (objets réels du propriétaire). Un objet déjà
 * lié reste visible mais inactif : on ne crée pas de doublon. La fermeture
 * rend le contexte au drawer « Sortie » sans changer d'onglet.
 */
export function GearAssociationSheet({ outingId, onClose, onAttached }: GearAssociationSheetProps) {
  const [payload, setPayload] = useState<CatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/compte/sorties/${outingId}/gear/associate`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error('catalog');
      setPayload((await response.json()) as CatalogPayload);
    } catch {
      setError('Impossible de lire le matériel de cette sortie.');
    } finally {
      setLoading(false);
    }
  }, [outingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const attach = useCallback(
    async (gearItemId: string) => {
      setBusyId(gearItemId);
      setError(null);
      try {
        const response = await fetch(`/api/compte/sorties/${outingId}/gear/associate`, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ gearItemId }),
        });
        if (!response.ok) throw new Error('attach');
        onAttached?.();
        onClose();
      } catch {
        setError('Le matériel n’a pas pu être associé. Réessaie.');
      } finally {
        setBusyId(null);
      }
    },
    [onAttached, onClose, outingId]
  );

  const existing = new Set(payload?.existingGearIds ?? []);
  const matching = payload?.items ?? [];
  const hasAny = matching.some((entry) => GROUPS.some((group) => group.kind === entry.item.kind));

  return (
    <OverlaySheet
      title="Matériel de la sortie"
      subtitle="Associer un vélo ou des chaussures"
      onClose={onClose}
      nested
    >
      <p className={styles.intro}>
        Les objets viennent de ton inventaire. Le matériel déjà associé reste visible, sans doublon.
      </p>

      {loading ? <p className={styles.status}>Chargement du matériel…</p> : null}
      {!loading && error ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" className={styles.badge} onClick={() => void load()}>
            <RefreshCw size={12} aria-hidden="true" /> Réessayer
          </button>
        </div>
      ) : null}

      {!loading && !error && !hasAny ? (
        <div className={styles.empty}>
          <b>Aucun vélo ni chaussure dans ton inventaire</b>
          <p>
            Ajoute d’abord un objet dans ton inventaire, puis reviens l’associer à cette sortie.
          </p>
        </div>
      ) : null}

      {!loading && !error && hasAny
        ? GROUPS.map((group) => {
            const entries = matching.filter((entry) => entry.item.kind === group.kind);
            if (entries.length === 0) return null;
            const Icon = group.Icon;
            return (
              <section className={styles.group} key={group.kind} aria-label={group.label}>
                <h3 className={styles.groupTitle}>
                  <span>{group.label}</span>
                  <Icon size={13} aria-hidden="true" />
                </h3>
                <ul className={styles.list}>
                  {entries.map((entry) => {
                    const attached = existing.has(entry.item.id);
                    const meta = [
                      weightLabel(entry.item.weightG),
                      entry.item.condition,
                      attached ? 'Déjà associé' : entry.isDefault ? 'Proposé pour ce sport' : null,
                    ].filter(Boolean);
                    return (
                      <li key={entry.item.id}>
                        <button
                          type="button"
                          className={styles.row}
                          disabled={attached || busyId !== null}
                          onClick={() => void attach(entry.item.id)}
                          aria-label={`${entry.item.name}${attached ? ', déjà associé' : ', associer à la sortie'}`}
                        >
                          <span className={styles.thumb} aria-hidden="true">
                            {entry.item.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={entry.item.photoUrl} alt="" loading="lazy" decoding="async" />
                            ) : (
                              entry.item.name.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className={styles.main}>
                            <span className={styles.name}>{entry.item.name}</span>
                            <span className={styles.meta}>{meta.join(' · ') || 'Objet d’inventaire'}</span>
                          </span>
                          <span className={styles.badge} data-tone={attached ? 'muted' : undefined}>
                            {busyId === entry.item.id ? 'Association…' : attached ? 'Associé' : 'Associer'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        : null}

      {!loading && !error && payload?.defaultsAvailable === false ? (
        <p className={styles.status}>
          Les défauts par sport ne sont pas encore activés ; tous les objets du bon type restent
          proposés.
        </p>
      ) : null}
    </OverlaySheet>
  );
}

export default GearAssociationSheet;
