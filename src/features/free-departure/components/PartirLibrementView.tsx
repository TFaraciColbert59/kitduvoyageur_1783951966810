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
 *
 * LES DEUX BOUTONS QUI N'AGISSAIENT PAS, et pourquoi ils ne partent pas tous
 * les deux. Un `<button>` sans `onClick` promet une action et n'en fait aucune :
 * on le presse, rien ne bouge, et l'application parait cassee.
 *
 *   « Pause »               -> il reste, et il fonctionne. Le chrono est une
 *                              VRAIE mesure, il tourne deja ; suspendre une
 *                              mesure reelle est une capacite reelle. Le
 *                              retirer supprimerait un existant pour un simple
 *                              defaut de branchement.
 *   « Enregistrer cette     -> il part. Il n'y a AUCUNE trace a enregistrer :
 *      trace »                 ce composant n'a jamais demarre de GPS, donc il
 *                              n'a rien a ecrire sur le disque. `saveAdventure`
 *                              enregistre un PROGRAMME prepare, pas une sortie
 *                              de terrain. Le bouton promettait de sauver un
 *                              objet qui n'a jamais existe. Son absence se dit.
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
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (state !== 'during' || paused) return;
    const interval = setInterval(() => {
      setSecondsElapsed(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state, paused]);

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
            <Button variant="primary" size="lg" style={{ width: '100%' }} onClick={() => { setState('during'); setSecondsElapsed(0); setPaused(false); }}>
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
              <Button
                variant="secondary"
                size="lg"
                style={{ flex: 1 }}
                onClick={() => setPaused(p => !p)}
              >
                {paused ? 'Reprendre' : 'Pause'}
              </Button>
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
              {/* Retirer ce bouton n'est pas se taire : la ligne ci-dessous dit
                  POURQUOI il n'y a rien a enregistrer. Un recapitulatif qui
                  affiche une duree et refuse de la garder sans rien dire laisse
                  croire a une panne ; il n'y en a pas. */}
              <p className="prep-note" style={{ color: 'var(--lkv-text-subtle)', textAlign: 'center' }}>
                Aucune trace à enregistrer : le suivi de position n’a jamais été actif.
              </p>
              <Button variant="ghost" size="lg" style={{ width: '100%' }} onClick={() => setState('before')}>Recommencer</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
