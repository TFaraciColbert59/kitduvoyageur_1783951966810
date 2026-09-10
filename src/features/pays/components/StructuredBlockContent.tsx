import React from 'react';
import type { SectionBlock } from '../types';
import { parseStructuredBlock } from '../mappers/structuredBlock';

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'sage' }) {
  return (
    <span
      className={`glass-pill !px-2 !py-0.5 text-[9px] font-mono font-bold uppercase ${
        tone === 'sage' ? 'text-[#5B7F55]' : 'text-[#17402C]'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Rendu riche d'un bloc IA structuré (`content_json`). Retourne `null` si les
 * données ne sont pas exploitables → l'appelant affiche le markdown.
 */
export function StructuredBlockContent({ block }: { block: SectionBlock }) {
  const structured = parseStructuredBlock(block);
  if (!structured) return null;

  if (structured.kind === 'spots') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {structured.items.map((spot, index) => (
          <div
            key={`${spot.nom}-${index}`}
            className="rounded-2xl border border-white/60 bg-white/70 p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display font-bold text-sm text-[#17402C]">{spot.nom}</h4>
              {spot.type_outdoor ? <Pill tone="sage">{spot.type_outdoor}</Pill> : null}
            </div>
            {spot.localisation ? (
              <p className="text-[10.5px] font-mono text-[#5A7064]">📍 {spot.localisation}</p>
            ) : null}
            <p className="text-xs text-[#5A7064] leading-relaxed">{spot.description}</p>
          </div>
        ))}
      </div>
    );
  }

  if (structured.kind === 'itineraires') {
    return (
      <div className="space-y-3">
        {structured.items.map((itineraire, index) => (
          <div key={`${itineraire.nom}-${index}`} className="rounded-2xl border border-white/60 bg-white/70 p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="font-display font-bold text-sm text-[#17402C] mr-1">{itineraire.nom}</h4>
              <Pill>{itineraire.duree_jours} j</Pill>
              {itineraire.denivele_positif_m ? <Pill>±{itineraire.denivele_positif_m} m</Pill> : null}
              {itineraire.difficulte ? <Pill tone="sage">{itineraire.difficulte}</Pill> : null}
            </div>
            <p className="text-xs text-[#5A7064] leading-relaxed">{itineraire.description}</p>
            {itineraire.etapes && itineraire.etapes.length > 0 ? (
              <ol className="mt-1 space-y-1 list-decimal list-inside text-[11px] text-[#2D4536]">
                {itineraire.etapes.map((etape, stepIndex) => (
                  <li key={stepIndex}>{etape}</li>
                ))}
              </ol>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (structured.kind === 'difficulte') {
    return (
      <div className="space-y-3">
        {structured.items.map((item, index) => (
          <div key={`${item.activite}-${index}`} className="rounded-2xl border border-white/60 bg-white/70 p-4 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display font-bold text-sm text-[#17402C]">{item.activite}</h4>
              {item.niveau ? <Pill tone="sage">{item.niveau}</Pill> : null}
            </div>
            <p className="text-xs text-[#5A7064] leading-relaxed">{item.facteurs}</p>
            <p className="text-xs text-[#2D4536] leading-relaxed">
              <strong className="font-bold text-[#17402C]">Conseil.</strong> {item.conseils}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {structured.items.map((item, index) => (
        <div key={`${item.activite}-${index}`} className="rounded-2xl border border-white/60 bg-white/70 p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display font-bold text-sm text-[#17402C]">{item.activite}</h4>
            {item.mois_favorables ? <Pill tone="sage">{item.mois_favorables}</Pill> : null}
          </div>
          <p className="text-xs text-[#5A7064] leading-relaxed">{item.conditions}</p>
          {item.points_vigilance ? (
            <p className="text-[11px] text-[#8C6418] leading-relaxed">⚠ {item.points_vigilance}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
