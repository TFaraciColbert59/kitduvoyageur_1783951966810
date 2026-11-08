'use client';

import React, { useEffect, useRef } from 'react';
import AppImage from '@/components/ui/AppImage';
import { formatDateStamp } from '../../shared/format';
import { ExploreIcon, type ExploreIconName } from '../ExploreIcons';

export interface PeekAction {
  label: string;
  icon: ExploreIconName;
  /** Action principale (mise en avant). */
  primary?: boolean;
  tone?: 'danger';
  onSelect: () => void;
}

export interface PeekItem {
  kind: 'carnet' | 'club' | 'sortie' | 'membre' | 'post';
  title: string;
  subtitle: string;
  /** Couverture éventuelle (carnet, avatar). */
  cover?: string | null;
  /** Initiales pour un membre / un post sans image. */
  initials?: string;
  /** Date ISO (billet de sortie). */
  dateIso?: string | null;
  actions: PeekAction[];
}

export interface PeekOverlayProps {
  peek: PeekItem | null;
  onClose: () => void;
}

/**
 * Peek & Pop (appui long 460 ms, `Recherche#14`, `Carnets#12`, `Clubs#15`,
 * `Sorties` peek) : aperçu + 3 actions dans le tiroir (ni bouton « Fermer » ni
 * action supplémentaire — la recette E2E en attend exactement trois). Échap et
 * le toucher du fond ferment l'aperçu ; le focus va à la première action.
 */
export function PeekOverlay({ peek, onClose }: PeekOverlayProps) {
  const firstActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!peek) return;
    const frame = window.requestAnimationFrame(() => {
      firstActionRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [peek]);

  if (!peek) return null;

  const stamp = peek.kind === 'sortie' ? formatDateStamp(peek.dateIso) : null;

  return (
    <div className="lkdv-cv2-peek" role="dialog" aria-modal="true" aria-label={`Aperçu : ${peek.title}`}>
      <div className="lkdv-cv2x-peek-scrim" aria-hidden="true" onPointerDown={onClose} />
      <div className="lkdv-cv2-peek-box lkdv-cv2x-peek-box">
        <div className="lkdv-cv2x-peek-preview">
          <span className="lkdv-cv2x-peek-media" aria-hidden="true">
            {stamp ? (
              <span className="lkdv-cv2x-search-stamp">
                <b>{stamp.day}</b>
                <i>{stamp.month}</i>
              </span>
            ) : peek.kind === 'club' ? (
              <span className="lkdv-cv2x-peek-crest">
                <ExploreIcon name="users" size={26} />
              </span>
            ) : peek.cover ? (
              <AppImage src={peek.cover} alt="" width={86} height={68} className="lkdv-cv2x-cover-img" />
            ) : (
              <span className="lkdv-cv2x-search-avatar">{peek.initials ?? '?'}</span>
            )}
          </span>
          <span className="lkdv-cv2x-peek-text">
            <b>{peek.title}</b>
            <small>{peek.subtitle}</small>
          </span>
        </div>
        <div className="lkdv-cv2-peek-actions">
          {peek.actions.map((action, index) => (
            <button
              key={action.label}
              ref={index === 0 ? firstActionRef : undefined}
              type="button"
              className="lkdv-cv2-peek-action"
              data-tone={action.tone}
              onClick={() => {
                action.onSelect();
                onClose();
              }}
            >
              <ExploreIcon name={action.icon} size={18} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PeekOverlay;
