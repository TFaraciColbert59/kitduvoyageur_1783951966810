'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Plus,
  Sun,
  SlidersHorizontal,
  Share2,
  Link2,
  Flag,
  Pencil,
  UserPlus,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetViewerRole } from '@/features/carnet/detail/types';
import { isParticipantRole } from '@/features/carnet/detail/viewerRole';

/**
 * Morphing de la pilule titre — maquette `.rp` + `@keyframes morph` (0,5 s,
 * `--ease-spring`) et point vert `.edot` pulsant en édition.
 * Le mouvement réduit neutralise les deux, y compris via le popover Affichage.
 */
const TOPBAR_MOTION_CSS = `
@keyframes lkdv-title-morph{0%{transform:scaleX(1.18) scaleY(.86);filter:blur(2px)}50%{transform:scaleX(.95) scaleY(1.06);filter:none}100%{transform:none}}
@keyframes lkdv-edot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(1.35)}}
.lkdv-carnet-topbar .lkdv-title-pill .edot{animation:lkdv-edot 1.6s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.lkdv-carnet-topbar .lkdv-title-pill,.lkdv-carnet-topbar .lkdv-title-pill .edot{animation:none!important}}
.lkdv-carnet-v2-root[data-reduce-motion='true'] .lkdv-carnet-topbar .lkdv-title-pill,
.lkdv-carnet-v2-root[data-reduce-motion='true'] .lkdv-carnet-topbar .lkdv-title-pill .edot{animation:none!important}
`;

export interface CarnetTopBarV2Props {
  title: string;
  viewerRole: CarnetViewerRole;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onOpenSettings: () => void;
  onCreateMoment?: () => void;
  onToggleOutdoor: () => void;
  isOutdoor: boolean;
  /** Réduction manuelle des animations de la fiche (popover Affichage). */
  reduceMotion?: boolean;
  onToggleReduceMotion?: () => void;
  onShare: () => void;
  /** Conservé pour compatibilité : l'export JSON vit dans l'onglet « Gérer ». */
  onExport?: () => void;
  onReport: () => void;
  onCopyLink: () => void;
  /** Visiteur : suivre (ou ne plus suivre) l'auteur du carnet. */
  onFollow?: () => void;
  isFollowing?: boolean;
}

/**
 * Barre haute de la fiche carnet : trois boutons ronds au maximum
 * (retour, ajouter, affichage). Les réglages passent par le menu du titre.
 * Le popover « Affichage » est la famille D du socle : verre, Échap, clic
 * extérieur, focus rendu au déclencheur.
 */
export function CarnetTopBarV2({
  title,
  viewerRole,
  isEditing = false,
  onToggleEdit,
  onOpenSettings,
  onCreateMoment,
  onToggleOutdoor,
  isOutdoor,
  reduceMotion = false,
  onToggleReduceMotion,
  onShare,
  onReport,
  onCopyLink,
  onFollow,
  isFollowing = false,
}: CarnetTopBarV2Props) {
  const { haptic } = useHapticFeedback();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [titleMorph, setTitleMorph] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const displayBtnRef = useRef<HTMLButtonElement>(null);

  const isParticipant = isParticipantRole(viewerRole);

  // Clic extérieur + Échap, une seule écoute par surface ouverte.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || pillRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      pillRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!displayOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (displayRef.current?.contains(target) || displayBtnRef.current?.contains(target)) return;
      setDisplayOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setDisplayOpen(false);
      displayBtnRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [displayOpen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    pillRef.current?.focus();
  }, []);

  // Morphing joué à l'ouverture du menu (0,5 s), puis rendu à l'état repos.
  useEffect(() => {
    if (!titleMorph) return;
    const timer = window.setTimeout(() => setTitleMorph(false), 600);
    return () => window.clearTimeout(timer);
  }, [titleMorph]);

  const toggleTitleMenu = useCallback(() => {
    const next = !menuOpen;
    setMenuOpen(next);
    if (next) setTitleMorph(true);
  }, [menuOpen]);

  return (
    <div className="lkdv-carnet-topbar">
      <style dangerouslySetInnerHTML={{ __html: TOPBAR_MOTION_CSS }} />

      <div className="lkdv-carnet-topbar-l">
        <button
          ref={pillRef}
          type="button"
          className="lkdv-title-pill"
          onClick={toggleTitleMenu}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Menu du carnet ${title}`}
          style={titleMorph ? { animation: 'lkdv-title-morph 500ms var(--ease-spring)' } : undefined}
          onAnimationEnd={() => setTitleMorph(false)}
        >
          {isEditing ? <span className="edot" aria-hidden="true" /> : null}
          <b>{title}</b>
          <ChevronDown size={15} aria-hidden="true" className="lkdv-title-chev" />
        </button>
      </div>

      {menuOpen ? (
        <div ref={menuRef} className="lkdv-menu-popover" role="menu" aria-label="Options du carnet">
          {isParticipant ? (
            <>
              {onToggleEdit ? (
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isEditing}
                  className="lkdv-menu-item"
                  onClick={() => {
                    closeMenu();
                    onToggleEdit();
                  }}
                >
                  <Pencil size={15} aria-hidden="true" />
                  <span>Modifier le carnet</span>
                </button>
              ) : null}
              <hr className="lkdv-menu-sep" />
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="lkdv-menu-item"
                onClick={() => {
                  closeMenu();
                  onFollow?.();
                }}
              >
                <UserPlus size={15} aria-hidden="true" />
                <span>{isFollowing ? 'Ne plus suivre le carnet' : 'Suivre le carnet'}</span>
              </button>
              <hr className="lkdv-menu-sep" />
            </>
          )}

          <button
            type="button"
            role="menuitem"
            className="lkdv-menu-item"
            onClick={() => {
              closeMenu();
              onShare();
            }}
          >
            <Share2 size={15} aria-hidden="true" />
            <span>Partager…</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lkdv-menu-item"
            onClick={() => {
              closeMenu();
              onCopyLink();
            }}
          >
            <Link2 size={15} aria-hidden="true" />
            <span>Copier le lien</span>
          </button>
          {!isParticipant ? (
            <button
              type="button"
              role="menuitem"
              className="lkdv-menu-item"
              onClick={() => {
                closeMenu();
                onReport();
              }}
            >
              <Flag size={15} aria-hidden="true" />
              <span>Signaler</span>
            </button>
          ) : null}

        </div>
      ) : null}

      <div className="lkdv-carnet-topbar-r">
        {isParticipant && onCreateMoment ? (
          <button
            type="button"
            className="lkdv-gbtn"
            onClick={onCreateMoment}
            aria-label="Ajouter un moment"
          >
            <Plus size={18} />
          </button>
        ) : null}

        <button
          ref={displayBtnRef}
          type="button"
          className="lkdv-gbtn"
          onClick={() => setDisplayOpen((prev) => !prev)}
          aria-label="Affichage"
          aria-haspopup="dialog"
          aria-expanded={displayOpen}
        >
          <Sun size={17} />
        </button>

        {displayOpen ? (
          <div
            ref={displayRef}
            className="lkdv-display-popover"
            role="dialog"
            aria-label="Affichage"
          >
            <div className="lkdv-display-row">
              <div>
                <b>Plein soleil</b>
                <small>Contraste renforcé, texte plus grand</small>
              </div>
              <Switch
                checked={isOutdoor}
                onCheckedChange={() => {
                  haptic('selection');
                  onToggleOutdoor();
                }}
                aria-label="Plein soleil"
              />
            </div>
            <div className="lkdv-display-row">
              <div>
                <b>Réduire les animations</b>
                <small>Mouvements simplifiés</small>
              </div>
              <Switch
                checked={reduceMotion}
                onCheckedChange={() => {
                  haptic('selection');
                  onToggleReduceMotion?.();
                }}
                aria-label="Réduire les animations"
              />
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="lkdv-gbtn"
          onClick={onOpenSettings}
          aria-label="Carnet : notifications, partage, paramètres"
          aria-haspopup="dialog"
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>
    </div>
  );
}
