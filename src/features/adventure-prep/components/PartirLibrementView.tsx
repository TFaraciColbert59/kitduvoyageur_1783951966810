'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import Icon from '@/components/ui/Icon';

type LibreState = 'before' | 'during' | 'after';

/**
 * Les mesures de session — ou, plus honestement, leur ABSENCE.
 *
 * CE QUE CE FICHIER N'A PAS, et qu'il faut dire avant tout :
 * il ne demarre aucun GPS. `watchPosition` n'est appele nulle part dans le
 * feature, donc il n'existe ici aucun traceur a afficher, et les trois nombres
 * qui s'affichaient — « 0.0 km », « 2.4 km », « 120 m » — n'etaient mesures par
 * rien : des constantes ecrites en dur dans le JSX, sur une page reellement
 * servie par `/partir-librement`. Un recapitulatif qui invente sa distance ne se
 * distingue pas d'un recapitulatif honnete.
 *
 * La regle du produit s'applique donc telle quelle : une mesure absente
 * s'affiche « A verifier », jamais zero. Le compteur de temps, lui, reste une
 * mesure — il compte le temps reellement ecoule depuis l'entree en session.
 *
 * Brancher `watchPosition` (permission, cadence, accumulation) est une
 * decision de produit, pas un correctif de style : elle n'est pas prise ici, et
 * le manque reste nomme.
 */
const MESURE_ABSENTE = 'À vérifier' as const;

interface MesuresSession {
  readonly distanceM: number | null;
  readonly deniveleM: number | null;
}

/** Aucune position n'est observee : tout ce qui vient du GPS reste inconnu. */
const MESURES_REELLES: MesuresSession = { distanceM: null, deniveleM: null };

export default function PartirLibrementView() {
  const [state, setState] = useState<LibreState>('before');
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (state === 'during') {
      interval = setInterval(() => {
        setSecondsElapsed(s => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="prep-libre">
      <div className="prep-libre__map" style={{ backgroundColor: 'var(--prep-map-skeleton-bg)' }}>
        <div style={{ padding: 20, textAlign: 'center', opacity: 0.5, paddingTop: 100 }}>
          <Icon name="map" size={48} />
          {/* Aucune carte n est rendue : ce composant ne monte pas MapLibre et ne
              trace aucun parcours. Un fond « carte » sur lequel on ecrit « carte
              plein ecran » ferait croire a une carte la. On nomme donc
              l'absence plutot que de la maquiller. */}
          <p>Aucune carte — le suivi de position n’est pas actif</p>
          {state === 'during' && <p style={{ marginTop: 10 }}>-- Session en cours --</p>}
        </div>
      </div>
      
      <div className="prep-libre__overlay">
        {state === 'before' && (
          <div className="prep-map__glass" style={{ flexDirection: 'column', padding: 'var(--space-4)', width: '100%', borderRadius: 'var(--card-radius)' }}>
            <p className="prep-note" style={{ color: 'var(--lkv-text-primary)' }}>Tu es libre. La carte t'appartient.</p>
            <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => { setState('during'); setSecondsElapsed(0); }}>
              Commencer ma session
            </Button>
          </div>
        )}

        {state === 'during' && (
          <div className="prep-map__glass" style={{ flexDirection: 'column', padding: 'var(--space-4)', width: '100%', borderRadius: 'var(--card-radius)' }}>
            <div className="prep-metrics" style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginBottom: 'var(--space-4)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-subtle)' }}>Durée</div>
                <div style={{ fontSize: 'var(--lkv-text-headline)', fontWeight: 'bold' }}>{formatTime(secondsElapsed)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-subtle)' }}>Distance</div>
                <div style={{ fontSize: 'var(--lkv-text-headline)', fontWeight: 'bold' }}>{MESURES_REELLES.distanceM === null ? MESURE_ABSENTE : MESURES_REELLES.distanceM + ' m'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%' }}>
              <Button variant="secondary" size="lg" style={{ flex: 1 }}>Pause</Button>
              <Button variant="primary" size="lg" style={{ flex: 1 }} onClick={() => setState('after')}>Terminer</Button>
            </div>
          </div>
        )}

        {state === 'after' && (
          <div className="prep-map__glass" style={{ flexDirection: 'column', padding: 'var(--space-4)', width: '100%', borderRadius: 'var(--card-radius)' }}>
            <h3 style={{ fontSize: 'var(--lkv-text-headline)', marginBottom: 'var(--space-3)', textAlign: 'center' }}>Récapitulatif session</h3>
            <div className="prep-metrics" style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginBottom: 'var(--space-4)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-subtle)' }}>Durée</div>
                <div style={{ fontSize: 'var(--lkv-text-body)', fontWeight: 'bold' }}>{formatTime(secondsElapsed)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-subtle)' }}>Distance</div>
                <div style={{ fontSize: 'var(--lkv-text-body)', fontWeight: 'bold' }}>{MESURES_REELLES.distanceM === null ? MESURE_ABSENTE : MESURES_REELLES.distanceM + ' m'}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--lkv-text-caption)', color: 'var(--lkv-text-subtle)' }}>D+</div>
                <div style={{ fontSize: 'var(--lkv-text-body)', fontWeight: 'bold' }}>{MESURES_REELLES.deniveleM === null ? MESURE_ABSENTE : MESURES_REELLES.deniveleM + ' m'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
              <Button variant="primary" size="lg" style={{ width: '100%' }}>Enregistrer cette trace</Button>
              <Button variant="ghost" size="lg" style={{ width: '100%' }} onClick={() => setState('before')}>Recommencer</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
