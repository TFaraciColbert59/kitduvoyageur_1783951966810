'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePaysRecommendations } from '../hooks/usePaysRecommendations';
import type {
  Recommendation,
  RecommendationDuration,
  RecommendationLevel,
} from '../types';

const LEVELS: Array<{ id: RecommendationLevel; label: string }> = [
  { id: 'facile', label: 'Facile' },
  { id: 'modere', label: 'Modéré' },
  { id: 'expert', label: 'Expert' },
];

const DURATIONS: Array<{ id: RecommendationDuration; label: string }> = [
  { id: 'weekend', label: 'Week-end' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'expedition', label: 'Expédition' },
];

const KIND_LABEL: Record<Recommendation['kind'], string> = {
  season: 'Saison',
  itineraire: 'Itinéraire',
  trail: 'Sentier',
  spot: 'Incontournable',
};

/**
 * Recommandations contextualisées (profil / durée / saison) à partir des
 * données réelles du pays. Sélection déterministe + synthèse IA optionnelle.
 */
export function PaysRecommendations({
  countryCode,
  className,
}: {
  countryCode?: string;
  className?: string;
}) {
  const [level, setLevel] = useState<RecommendationLevel>('modere');
  const [duration, setDuration] = useState<RecommendationDuration>('semaine');
  const { data, isLoading, isError } = usePaysRecommendations(countryCode, level, duration);

  return (
    <section
      aria-label="Recommandations personnalisées"
      className={cn('glass rounded-[1.5rem] p-5 border border-white/50 shadow-xs space-y-3', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55]">
          Recommandé pour vous
        </span>
        <span className="text-[9.5px] font-mono text-[#5A7064]">Selon votre profil</span>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Niveau">
          {LEVELS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={level === item.id}
              onClick={() => setLevel(item.id)}
              className={cn(
                'glass-capsule-btn !min-h-[36px] !py-1 !px-3.5 !text-xs !font-bold',
                level === item.id && 'primary'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Durée">
          {DURATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={duration === item.id}
              onClick={() => setDuration(item.id)}
              className={cn(
                'glass-capsule-btn !min-h-[36px] !py-1 !px-3.5 !text-xs !font-bold',
                duration === item.id && 'primary'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3 w-3/4 rounded-full bg-[#EAE6DF]/80 animate-pulse" />
          <div className="h-3 w-2/3 rounded-full bg-[#EAE6DF]/70 animate-pulse" />
        </div>
      ) : isError || data?.status === 'error' ? (
        <p className="text-xs text-[#5A7064] font-mono">
          Recommandations momentanément indisponibles.
        </p>
      ) : !data || data.status === 'empty' || data.recommendations.length === 0 ? (
        <p className="text-xs text-[#5A7064] font-mono">
          Aucune recommandation disponible pour ce pays pour l’instant.
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.synthesis ? (
            <p className="font-serif italic text-sm text-[#2D4536] leading-relaxed">{data.synthesis}</p>
          ) : null}

          <ul className="space-y-2">
            {data.recommendations.map((recommendation, index) => (
              <li
                key={`${recommendation.kind}-${recommendation.title}-${index}`}
                className="rounded-2xl border border-white/60 bg-white/70 p-3.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#5B7F55]">
                    {KIND_LABEL[recommendation.kind]}
                  </span>
                  {recommendation.meta ? (
                    <span className="text-[9.5px] font-mono text-[#5A7064]">{recommendation.meta}</span>
                  ) : null}
                </div>
                <h4 className="font-display font-bold text-sm text-[#17402C]">{recommendation.title}</h4>
                <p className="text-[11px] text-[#5A7064] leading-relaxed">{recommendation.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
