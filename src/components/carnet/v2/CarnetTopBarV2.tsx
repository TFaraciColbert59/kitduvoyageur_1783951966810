'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Plus,
  Sun,
  SlidersHorizontal,
  Share2,
  Link2,
  Download,
  Flag,
  Pencil,
} from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetViewerRole } from '@/features/carnet/detail/types';

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
  onExport: () => void;
  onReport: () => void;
  onCopyLink: () => void;
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
  onExport,
  onReport,
  onCopyLink,
}: CarnetTopBarV2Props) {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);
  const displayBtnRef = useRef<HTMLButtonElement>(null);

  const isParticipant = viewerRole === 'participant';

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

  return (
    <div className="lkdv-carnet-topbar">
      <div className="lkdv-carnet-topbar-l">
        <button
          type="button"
          className="lkdv-gbtn"
          onClick={() => router.back()}
          aria-label="Retour"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          ref={pillRef}
          type="button"
          className="lkdv-title-pill"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Menu du carnet ${title}`}
        >
          {isEditing ? <span className="edot" aria-hidden="true" /> : null}
          <b>{title}</b>
        </button>
      </div>

      {menuOpen ? (
        <div
          ref={menuRef}
          className="lkdv-menu-popover"
          role="menu"
          aria-label="Options du carnet"
        >
          {isParticipant ? (
            <>
              {onToggleEdit ? (
                <button
                  type="button"
                  role="menuitem"
                  className="lkdv-menu-item"
                  onClick={() => {
                    closeMenu();
                    onToggleEdit();
                  }}
                >
                  <Pencil size={15} />
                  <span>{isEditing ? 'Terminer l’édition' : 'Modifier le carnet'}</span>
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="lkdv-menu-item"
                onClick={() => {
                  closeMenu();
                  onShare();
                }}
              >
                <Share2 size={15} />
                <span>Partager</span>
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
                <Link2 size={15} />
                <span>Copier le lien</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="lkdv-menu-item"
                onClick={() => {
                  closeMenu();
                  onExport();
                }}
              >
                <Download size={15} />
                <span>Exporter en JSON</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="lkdv-menu-item"
                onClick={() => {
                  closeMenu();
                  onShare();
                }}
              >
                <Share2 size={15} />
                <span>Partager</span>
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
                <Link2 size={15} />
                <span>Copier le lien</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="lkdv-menu-item"
                onClick={() => {
                  closeMenu();
                  onReport();
                }}
              >
                <Flag size={15} />
                <span>Signaler ce carnet</span>
              </button>
            </>
          )}

          <button
            type="button"
            role="menuitem"
            className="lkdv-menu-item"
            onClick={() => {
              closeMenu();
              onOpenSettings();
            }}
          >
            <SlidersHorizontal size={15} />
            <span>Paramètres et partage</span>
          </button>
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
      </div>
    </div>
  );
}
