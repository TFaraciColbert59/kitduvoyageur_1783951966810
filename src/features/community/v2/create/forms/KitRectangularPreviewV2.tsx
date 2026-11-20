'use client';

import React, { useMemo } from 'react';
import { CloudSun } from 'lucide-react';
import type { KitFormValuesV2, KitItemV2 } from '../engine/createSchemasV2';
import {
  KIT_GOALS_V2,
  KIT_MODELS_V2,
  kitItemsWeightV2,
  kitProposedNameV2,
} from '../kit/kitTemplatesV2';
import {
  formatKitItemWeightV2,
  formatKitWeightV2,
  type KitUnitsV2,
} from '../kit/kitContextV2';

const SEASON_OPTIONS = [
  { value: 'printemps', label: 'Printemps' },
  { value: 'ete', label: 'Été' },
  { value: 'automne', label: 'Automne' },
  { value: 'hiver', label: 'Hiver' },
] as const;

export const KIT_CHART_COLORS = [
  '#155e75',
  '#0f766e',
  '#0369a1',
  '#b45309',
  '#475569',
  '#64748b',
];

export function formatKitSeasonsSummary(
  seasons: readonly string[] | undefined,
  fallbackSeason: string,
): string {
  const active = seasons && seasons.length > 0 ? seasons : [];
  if (active.length === 4) return '4 saisons';
  if (active.length > 0) {
    const labels = active
      .map((s) => SEASON_OPTIONS.find((opt) => opt.value === s)?.label)
      .filter((label) => label !== undefined);
    if (labels.length > 0) return labels.join(' · ');
  }
  return SEASON_OPTIONS.find((opt) => opt.value === fallbackSeason)?.label ?? 'Toute saison';
}

export const KitUnitsContext = React.createContext<KitUnitsV2>('metric');

export function useKitWeight() {
  const units = React.useContext(KitUnitsContext);
  return React.useMemo(
    () => ({
      units,
      kg: (weightG: number) => formatKitWeightV2(weightG, units),
      item: (weightG: number) => formatKitItemWeightV2(weightG, units),
    }),
    [units],
  );
}

/**
 * Aperçu rectangulaire léger du kit — extrait de `KitFormV2.tsx` afin que le fil
 * Communauté, la Messagerie, les Clubs et les Carnets n'embarquent pas `recharts`,
 * `react-hook-form`, `zod` ni les tiroirs du formulaire de création (~250 Ko gzip).
 */
export function KitRectangularPreviewV2({
  items,
  values,
  weather,
}: {
  items: readonly KitItemV2[];
  values: Pick<KitFormValuesV2, 'name' | 'model' | 'season' | 'seasons' | 'goal'>;
  weather?: { tempMin: number; tempMax: number; label: string } | null;
}) {
  const { kg } = useKitWeight();
  const totalG = kitItemsWeightV2(items);
  const title =
    values.name?.trim() ||
    kitProposedNameV2({ model: values.model, season: values.season, seasons: values.seasons, items }) ||
    'Kit d’aventure';
  const modelLabel =
    KIT_MODELS_V2.find((m) => m.id === values.model)?.label ??
    (values.model?.trim() || 'Bivouac');
  const seasonLabel = formatKitSeasonsSummary(values.seasons, values.season);
  const goalLabel = KIT_GOALS_V2.find((g) => g.id === values.goal)?.label ?? 'Léger';

  const catTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const cat = item.category?.trim() || 'Divers';
      map.set(cat, (map.get(cat) ?? 0) + (item.weightG ?? 0) * (item.quantity ?? 1));
    }
    return [...map.entries()]
      .filter(([, g]) => g > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <article
      className="lkdv-cv2c-kit-rect-preview"
      data-testid="cv2-kit-rect-preview"
      aria-label="Aperçu carte du kit"
    >
      <div className="lkdv-cv2c-krp-top">
        <div className="lkdv-cv2c-krp-badges">
          <span className="lkdv-cv2c-krp-pill is-dark">{modelLabel}</span>
          <span className="lkdv-cv2c-krp-pill">{seasonLabel}</span>
          <span className="lkdv-cv2c-krp-pill">{goalLabel}</span>
        </div>
        {weather ? (
          <span className="lkdv-cv2c-krp-weather">
            <CloudSun size={12} aria-hidden="true" />
            {weather.tempMax}°/{weather.tempMin}°
          </span>
        ) : null}
      </div>

      <div className="lkdv-cv2c-krp-mid">
        <div className="lkdv-cv2c-krp-title-wrap">
          <b className="lkdv-cv2c-krp-title">{title}</b>
          <small className="lkdv-cv2c-krp-sub">
            {items.length} objet{items.length > 1 ? 's' : ''} · Prêt pour le partage
          </small>
        </div>
        <div className="lkdv-cv2c-krp-weight">
          <strong>{totalG >= 1000 ? (totalG / 1000).toFixed(2).replace('.', ',') : totalG}</strong>
          <span>{totalG >= 1000 ? 'kg' : 'g'}</span>
        </div>
      </div>

      <div className="lkdv-cv2c-krp-bar" aria-hidden="true">
        {totalG > 0 && catTotals.length > 0 ? (
          catTotals.map(([cat, g], i) => (
            <span
              key={cat}
              style={{
                width: `${Math.max(4, (g / totalG) * 100)}%`,
                background: KIT_CHART_COLORS[i % KIT_CHART_COLORS.length],
              }}
            />
          ))
        ) : (
          <span style={{ width: '100%', background: 'rgba(27,67,50,0.12)' }} />
        )}
      </div>

      <div className="lkdv-cv2c-krp-foot" data-hscroll>
        {catTotals.length > 0 ? (
          catTotals.slice(0, 5).map(([cat, g], i) => (
            <span key={cat} className="lkdv-cv2c-krp-cat-chip">
              <i
                style={{ background: KIT_CHART_COLORS[i % KIT_CHART_COLORS.length] }}
                aria-hidden="true"
              />
              {cat} · {kg(g)}
            </span>
          ))
        ) : (
          <span className="lkdv-cv2c-krp-cat-chip">Ajoute des objets pour remplir la jauge</span>
        )}
      </div>
    </article>
  );
}
