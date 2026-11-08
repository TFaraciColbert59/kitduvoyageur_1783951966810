'use client';

import React, { useRef, useState, useEffect } from 'react';
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
  Check,
} from 'lucide-react';
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
  onShare: () => void;
  onExport: () => void;
  onReport: () => void;
  onCopyLink: () => void;
}

export function CarnetTopBarV2({
  title,
  viewerRole,
  isEditing = false,
  onToggleEdit,
  onOpenSettings,
  onCreateMoment,
  onToggleOutdoor,
  isOutdoor,
  onShare,
  onExport,
  onReport,
  onCopyLink,
}: CarnetTopBarV2Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);

  const isParticipant = viewerRole === 'participant';

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        pillRef.current &&
        !pillRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleClickOutside);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div className="lkdv-carnet-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <button
          type="button"
          className="lkdv-gbtn transition-colors [transition-duration:var(--dur-fast)]"
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
                    setMenuOpen(false);
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
                  setMenuOpen(false);
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
                  setMenuOpen(false);
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
                  setMenuOpen(false);
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
                  setMenuOpen(false);
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
                  setMenuOpen(false);
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
                  setMenuOpen(false);
                  onReport();
                }}
              >
                <Flag size={15} />
                <span>Signaler ce carnet</span>
              </button>
            </>
          )}
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
          type="button"
          className="lkdv-gbtn"
          onClick={onToggleOutdoor}
          aria-label={isOutdoor ? 'Mode normal' : 'Mode plein soleil'}
          aria-pressed={isOutdoor}
        >
          <Sun size={17} />
        </button>

        <button
          type="button"
          className="lkdv-gbtn"
          onClick={onOpenSettings}
          aria-label="Paramètres et partage du carnet"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
