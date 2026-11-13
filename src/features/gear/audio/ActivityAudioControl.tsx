'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, MoreHorizontal, Music2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import {
  audioProviderLabel,
  createSpotifyAudioPort,
  readSpotifyAvailability,
  spotifyUnavailableMessage,
} from './spotify';
import styles from './ActivityAudioControl.module.css';

/**
 * Contrôle audio de la sortie active, monté dans la pilule d'activité.
 *
 * Le panneau est un sous-drawer : il s'ouvre sur action explicite, se ferme par
 * Échap ou par le bouton, et rend le focus au déclencheur sans quitter la
 * sortie. Aucun appel réseau, aucun jeton, aucune lecture simulée : l'état
 * indisponible est affiché tel quel et l'enregistrement n'est pas interrompu.
 */
export function ActivityAudioControl() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const availability = useMemo(
    () =>
      readSpotifyAvailability({
        NEXT_PUBLIC_SPOTIFY_CLIENT_ID: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID,
      }),
    []
  );
  const port = useMemo(() => createSpotifyAudioPort(), []);
  const canControl = availability.available && port !== null;

  const close = useCallback(() => {
    setOpen(false);
    // Le déclencheur est toujours monté : on lui rend le focus avant que le
    // portail ne disparaisse, pour ne pas laisser le focus sur `body`.
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`xp-pill-btn ${styles.trigger}`}
        onClick={() => setOpen(true)}
        aria-label="Plus d’options, contrôle audio"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className={styles.scrim}
              onClick={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <section
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-labelledby="xp-audio-title"
                aria-describedby="xp-audio-status"
              >
                <header className={styles.head}>
                  <span className={styles.statusIcon} aria-hidden="true">
                    <Music2 size={17} />
                  </span>
                  <div className={styles.headText}>
                    <span className={styles.kicker}>Audio de la sortie</span>
                    <h2 className={styles.title} id="xp-audio-title">
                      {audioProviderLabel(availability.provider)}
                    </h2>
                  </div>
                  <button
                    ref={closeRef}
                    type="button"
                    className={styles.close}
                    onClick={close}
                    aria-label="Fermer le contrôle audio"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </header>

                <div className={styles.status} id="xp-audio-status">
                  <span className={styles.statusIcon} aria-hidden="true">
                    <Lock size={15} />
                  </span>
                  <div className={styles.statusText}>
                    <b>
                      {canControl ? 'Lecture pilotable' : 'Contrôle audio indisponible'}
                    </b>
                    <p>
                      {canControl
                        ? 'Le lecteur est relié à cette sortie.'
                        : spotifyUnavailableMessage(availability.reason)}
                    </p>
                  </div>
                </div>

                <div className={styles.transport} role="group" aria-label="Commandes de lecture">
                  <button
                    type="button"
                    className={styles.transportButton}
                    aria-label="Piste précédente"
                    disabled={!canControl}
                    onClick={() => void port?.previous()}
                  >
                    <SkipBack size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.transportButton} ${styles.playButton}`}
                    aria-label="Lecture ou pause"
                    disabled={!canControl}
                    onClick={() => void port?.play()}
                  >
                    <Play size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.transportButton}
                    aria-label="Mettre en pause"
                    disabled={!canControl}
                    onClick={() => void port?.pause()}
                  >
                    <Pause size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.transportButton}
                    aria-label="Piste suivante"
                    disabled={!canControl}
                    onClick={() => void port?.next()}
                  >
                    <SkipForward size={18} aria-hidden="true" />
                  </button>
                </div>

                <p className={styles.note}>
                  <Lock size={12} aria-hidden="true" />
                  <span>
                    L’enregistrement GPS et la trace continuent. Ce panneau ne modifie pas la séance et
                    n’utilise aucun jeton Spotify.
                  </span>
                </p>
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export default ActivityAudioControl;
