'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import '@/features/compas/v5/v5.css';
import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';
import { ALL_LAYERS, type LayerState } from '@/features/compas/engine/mapLayers';
import type { MapBase } from '@/features/compas/engine/mapStyle';
import { LiveMap } from '@/features/compas/v5/map/LiveMap';
import { SAMPLE_NIGHTS, SAMPLE_ORIGIN, SAMPLE_STAGES, samplePoints, sampleTrack } from './sample';

/**
 * Le banc n'a pas la coque du Compas : il pose lui-même l'encre (la couche `html[data-liquid-ios27]` met les
 * textes en blanc) et une grille à deux rangées (barre du banc, carte).
 */
const LAB_STYLE = {
  gridTemplateRows: 'auto minmax(0, 1fr)',
  '--v5-label': 'var(--lkv-ink-900)',
  '--v5-label2': 'var(--lkv-ink-700)',
  '--v5-label3': 'rgb(23 43 36 / 0.78)',
  '--v5-accent': 'var(--lkv-sage-500)',
} as CSSProperties;

/**
 * Banc visuel de la carte vivante v5 (développement seulement) : la vraie `LiveMap` sur des données d'exemple,
 * avec de quoi changer de jour, de fond, de calques, de zone masquée, et un journal des gestes reçus.
 */
export function LiveMapLab() {
  const [layers, setLayers] = useState<LayerState>({ ...ALL_LAYERS });
  const [base, setBase] = useState<MapBase>('osm');
  const [day, setDay] = useState<number | null>(null);
  const [big, setBig] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [withTrack, setWithTrack] = useState(true);
  const [withOrigin, setWithOrigin] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((l) => [line, ...l].slice(0, 6));

  const track = useMemo(() => sampleTrack(), []);
  const points = useMemo(() => samplePoints(), []);
  const nights = useMemo(() => (empty ? [] : SAMPLE_NIGHTS), [empty]);

  return (
    <div className="v5" data-map={big ? 'big' : undefined} style={LAB_STYLE}>
      <CompasLightTheme />
      <div className="v5-bg" />
      <div className="v5-lg v5-cs" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, borderRadius: 22 }} data-testid="lab-bar">
        <button type="button" className="v5-mbtn" aria-pressed={day == null} onClick={() => setDay(null)}>
          Voyage
        </button>
        {[1, 2, 3].map((d) => (
          <button key={d} type="button" className="v5-mbtn" aria-pressed={day === d} onClick={() => setDay(d)}>
            Jour {d}
          </button>
        ))}
        <button type="button" className="v5-mbtn" aria-pressed={drawer} onClick={() => setDrawer((v) => !v)}>
          Tiroir ouvert
        </button>
        <button type="button" className="v5-mbtn" aria-pressed={withTrack} onClick={() => setWithTrack((v) => !v)}>
          Tracé réel
        </button>
        <button type="button" className="v5-mbtn" aria-pressed={withOrigin} onClick={() => setWithOrigin((v) => !v)}>
          Départ
        </button>
        <button type="button" className="v5-mbtn" aria-pressed={empty} onClick={() => setEmpty((v) => !v)}>
          Vide
        </button>
        <span style={{ fontSize: 11, alignSelf: 'center' }} data-testid="lab-log">
          {log.join(' · ') || 'Aucun geste'}
        </span>
      </div>
      <LiveMap
        name="Vercors · données d’exemple"
        routeGeojson={empty || !withTrack ? null : track}
        coords={[]}
        stages={empty ? [] : SAMPLE_STAGES}
        origin={empty || !withOrigin ? null : SAMPLE_ORIGIN}
        nights={nights}
        points={empty ? [] : points}
        layers={layers}
        onLayers={setLayers}
        base={base}
        onBase={setBase}
        focus={day == null ? { kind: 'trip' } : { kind: 'day', day }}
        inset={{ top: 70, bottom: drawer ? 300 : 24, left: 24, right: 70 }}
        onSelectDay={(d) => {
          setDay(d);
          note(`jour ${d}`);
        }}
        onSelectNight={(d) => {
          setDay(d);
          note(`nuit ${d}`);
        }}
        onPickAlternative={(d, id) => note(`alternative ${id} (jour ${d})`)}
        onPoi={(p) => note(`point ${p.label}`)}
        big={big}
        onToggleBig={() => setBig((v) => !v)}
        emptyText="Aucun lieu à montrer pour l’instant."
      />
    </div>
  );
}
