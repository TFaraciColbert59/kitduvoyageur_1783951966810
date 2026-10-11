'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import type { UserDiscovery } from '@/features/progression/server/discoveries';

/**
 * T20 — Couche personnelle de la carte : identifiants territoriaux seulement.
 *
 * Contrats de confidentialité :
 *   • aucune coordonnée, aucune géométrie, aucune densification : l'API
 *     renvoie des codes canoniques et des dates, jamais des positions ;
 *   • une visite ponctuelle marque l'entité comme découverte — jamais
 *     « région entièrement parcourue » ;
 *   • charge bornée (100 entités) et lecture au montage uniquement ;
 *   • la couche disparaît (null) à vide ou en erreur : elle ne bloque jamais
 *     la carte ni la navigation.
 */
const MAX_ENTITIES = 100;

interface LayerPayload {
  success?: boolean;
  discoveries?: UserDiscovery[];
}

export default function DiscoveryMapLayer() {
  const { t } = useTranslation();
  const [discoveries, setDiscoveries] = useState<UserDiscovery[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch('/api/progression/discoveries', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as LayerPayload;
        if (!alive || payload?.success !== true || !Array.isArray(payload.discoveries)) return;
        // Ne garder que les champs publics de la couche — jamais d'extras.
        const safe = payload.discoveries
          .filter(
            (row) =>
              row &&
              typeof row.entityCode === 'string' &&
              (row.entityType === 'country' || row.entityType === 'region' || row.entityType === 'massif')
          )
          .map((row) => ({
            entityType: row.entityType,
            entityCode: row.entityCode,
            provenance: row.provenance,
            firstSeenAt: row.firstSeenAt,
          }));
        setDiscoveries(safe.slice(0, MAX_ENTITIES));
      } catch {
        /* silencieux : la carte n'affiche simplement pas la couche */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!discoveries || discoveries.length === 0) return null;

  const countries = discoveries.filter((row) => row.entityType === 'country').length;
  const regions = discoveries.filter((row) => row.entityType === 'region').length;

  return (
    <div
      aria-label={t('progression.mapDiscoveriesLayer')}
      className="pointer-events-none absolute left-3.5 top-14 z-[var(--z-fab)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-3 py-1 text-[11px] font-semibold text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)]"
    >
      {countries > 0 ? `${countries} · ${t('progression.passportCountries')}` : ''}
      {countries > 0 && regions > 0 ? ' — ' : ''}
      {regions > 0 ? `${regions} · ${t('progression.passportRegions')}` : ''}
    </div>
  );
}
