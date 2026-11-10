'use client';

import React, { useEffect, useRef } from 'react';
import AppImage from '@/components/ui/AppImage';
import { ClubCrest } from '../../shared/ClubCrest';
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
  /** Graine et activité du blason (club) — bandeau de la maquette. */
  crestSeed?: string | null;
  activity?: string | null;
  actions: PeekAction[];
}

export interface PeekOverlayProps {
  peek: PeekItem | null;
  onClose: () => void;
}

/**
 * Peek & Pop (appui long 460 ms, `Recherche#14`, `Carnets#12`, `Clubs#15`,
 * `Sorties` peek) : aperçu + **4 actions, dont « Fermer »** (FID-065), dans le
 * tiroir. Échap et le toucher du fond ferment l'aperçu ; le focus va à la
 * première action.
 *
 * Composition fidèle à `maquette-communaute.html` L1771-1775 : une carte
 * d'aperçu avec bandeau (couverture, blason ou billet) puis une carte d'actions
 * séparée, largeur 310 px, libellé à gauche et icône à droite (44 px par ligne).
 * La ligne « Fermer » est le dernier `menuitem` de la maquette (`data-c="x"`,
 * icône x) ; les autres actions restent des boutons (la recette E2E existante
 * les compte par `role=button` — changement à répercuter côté tests).
 */
export function PeekOverlay({ peek, onClose }: PeekOverlayProps) {
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!peek) return;
    const frame = window.requestAnimationFrame(() => {
      firstActionRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [peek]);

  // Piège de tabulation de la maquette (`CTX.addEventListener('keydown')`) :
  // l'aperçu est `aria-modal`, le fond du tiroir ne doit pas recevoir le focus.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const nodes = Array.from(boxRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
    if (nodes.length === 0) return;
    const current = nodes.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    event.stopPropagation();
    const next = (current + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  if (!peek) return null;

  const stamp = peek.kind === 'sortie' ? formatDateStamp(peek.dateIso) : null;

  return (
    <div className="lkdv-cv2-peek">
      <div className="lkdv-cv2x-peek-scrim" aria-hidden="true" onPointerDown={onClose} />
      {/* Le dialogue est la **carte** (310 px, maquette `.ctx .box`), pas le voile
          pleine feuille : sa géométrie est celle que le banc de fidélité mesure. */}
      <div
        className="lkdv-cv2-peek-box lkdv-cv2x-peek-box"
        role="dialog"
        aria-modal="true"
        aria-label={`Aperçu : ${peek.title}`}
        ref={boxRef}
        onKeyDown={onKeyDown}
      >
        <div className="lkdv-cv2x-peek-preview">
          <span className="lkdv-cv2x-peek-media" data-kind={peek.kind} aria-hidden="true">
            {peek.kind === 'club' ? (
              <ClubCrest
                name={peek.title}
                activity={peek.activity}
                seed={peek.crestSeed ?? peek.title}
                size={64}
              />
            ) : stamp ? (
              <span className="lkdv-cv2x-peek-stamp">
                <b>{stamp.day}</b>
                <i>{stamp.month}</i>
              </span>
            ) : peek.cover ? (
              <AppImage src={peek.cover} alt="" width={280} height={104} className="lkdv-cv2x-cover-img" />
            ) : (
              <span className="lkdv-cv2x-peek-avatar">{(peek.initials ?? '?').slice(0, 1)}</span>
            )}
          </span>
          <span className="lkdv-cv2x-peek-text">
            <b>{peek.title}</b>
            <small>{peek.subtitle}</small>
          </span>
        </div>
        <div
          className="lkdv-cv2-peek-actions lkdv-cv2x-peek-actions"
          role="menu"
          aria-label="Actions"
        >
          {peek.actions.map((action, index) => (
            <button
              key={action.label}
              ref={index === 0 ? firstActionRef : undefined}
              type="button"
              role="menuitem"
              className="lkdv-cv2-peek-action lkdv-cv2x-peek-action"
              data-primary={action.primary || undefined}
              data-tone={action.tone}
              onClick={() => {
                action.onSelect();
                onClose();
              }}
            >
              <span>{action.label}</span>
              <ExploreIcon name={action.icon} size={18} />
            </button>
          ))}
          {/* Maquette (L1772) : Fermer est la 4ᵉ ligne, toujours en dernier,
              en `menuitem` de 44 px avec l'icône x. */}
          <button
            type="button"
            role="menuitem"
            className="lkdv-cv2-peek-action lkdv-cv2x-peek-action"
            data-cv2-peek-close
            onClick={onClose}
          >
            <span>Fermer</span>
            <ExploreIcon name="close" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PeekOverlay;
