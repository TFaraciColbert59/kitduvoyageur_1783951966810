'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { Sheet } from '@/components/ui';

type CreateRow = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  href?: string;
  action?: 'story';
};

const ROWS: CreateRow[] = [
  {
    id: 'carnet',
    icon: 'book-open',
    title: 'Nouveau carnet de voyage',
    subtitle: 'Raconte une expédition avec photos géolocalisées et tracé',
    badge: 'Carnet',
    href: '/carnets/nouveau',
  },
  {
    id: 'voyage',
    icon: 'map',
    title: 'Nouveau voyage / sortie GPS',
    subtitle: 'Importe un fichier GPX ou planifie un trek avec le Compas',
    badge: 'Tracé',
    href: '/voyages',
  },
  {
    id: 'kit',
    icon: 'backpack',
    title: 'Nouveau kit de matériel',
    subtitle: 'Compose un sac ultraléger personnalisé avec jauge d’endurance',
    badge: 'Kit',
    href: '/materiel',
  },
  {
    id: 'club',
    icon: 'users',
    title: 'Nouveau club ou tribu',
    subtitle: 'Rassemble ta cordée, partage ton inventaire et lance des sorties',
    badge: 'Club',
    href: '/clubs/nouveau',
  },
  {
    id: 'story',
    icon: 'plus',
    title: 'Nouvelle story à la une',
    subtitle: 'Épingle un souvenir terrain marquant directement sur ton profil',
    badge: 'Story',
    action: 'story',
  },
];

export interface AccountCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStory: () => void;
}

/**
 * Drawer « Créer dans l'application » du Compte, à l'identique : 5 lignes,
 * icône 38 px, titre, sous-titre et badge.
 */
export function AccountCreateSheet({ open, onOpenChange, onStory }: AccountCreateSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      hideTitle
      title="Créer dans l'application"
      detent="large"
      dragToDismiss
      panelClassName="lkdv-feed-sheet"
      contentClassName="lkdv-feed-sheet-content"
    >
      <div className="lkdv-create-sheet">
        <h2 className="lkdv-create-title">Créer dans l’application</h2>
        {ROWS.map((row) => {
          const content = (
            <>
              <span className="lkdv-create-ico" aria-hidden="true">
                <Icon name={row.icon} size={20} />
              </span>
              <span className="lkdv-create-txt">
                <b>{row.title}</b>
                <small>{row.subtitle}</small>
              </span>
              <span className="lkdv-create-badge">{row.badge}</span>
            </>
          );

          if (row.action === 'story') {
            return (
              <button
                key={row.id}
                type="button"
                className="lkdv-create-row"
                onClick={() => {
                  onOpenChange(false);
                  onStory();
                }}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={row.id}
              href={row.href!}
              className="lkdv-create-row"
              onClick={() => onOpenChange(false)}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </Sheet>
  );
}

export default AccountCreateSheet;
