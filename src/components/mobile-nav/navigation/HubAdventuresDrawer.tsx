'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useActiveAdventure } from '@/features/hub/context/ActiveAdventureContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { AdventureGroups } from '@/features/hub/context/adventureLists';
import {
  DRAWER_LIST_HEADING,
  DRAWER_SUBTITLE,
  DRAWER_TITLE,
  EMPTY_ADVENTURES_HINT,
  EMPTY_ADVENTURES_TITLE,
  adventureRows,
  consumeDrawerAutoOpen,
  drawerActions,
  isEmptyAdventures,
  type DrawerAction,
  type DrawerRow,
} from './adventuresDrawerModel';
import './hubAdventuresDrawer.css';

/**
 * Marque posee sur <html> pendant que le tiroir est ouvert (cf. CSS). */
export const OPEN_ATTRIBUTE = 'data-had-open';

export interface HubAdventuresDrawerContentProps {
  groups: AdventureGroups;
  getLastSection: (key: string) => string | null;
  onNavigate: (href: string) => void;
}

/**
 * Contenu du tiroir — composant PUR (aucun router, aucun contexte) : le
 * test le rend directement en markup statique. L'ordre du DOM est un contrat :
 * les deux actions passent AVANT la liste, pour que l'action primaire soit le
 * premier element focusable du panneau (au doigt comme au clavier).
 */
export function HubAdventuresDrawerContent({
  groups,
  getLastSection,
  onNavigate,
}: HubAdventuresDrawerContentProps) {
  const actions = drawerActions();
  const isEmpty = isEmptyAdventures(groups);
  // Sans aventure, le tiroir montre l'etat vide de la maquette et rien
  // d'autre : le materiel reste accessible par le hub et le switcher clavier.
  const rows = isEmpty ? [] : adventureRows(groups, getLastSection);

  return (
    <div className="had">
      {isEmpty ? (
        <div className="had-empty">
          <span className="had-empty__icon" aria-hidden="true">
            <Icon name="compass" size={18} />
          </span>
          <p className="had-empty__title">{EMPTY_ADVENTURES_TITLE}</p>
          <p className="had-empty__hint">{EMPTY_ADVENTURES_HINT}</p>
        </div>
      ) : null}

      <div className="had-actions" aria-label={DRAWER_LIST_HEADING}>
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            data-had-action={action.id}
            className={`had-action had-action--${action.variant}`}
            aria-label={`${action.label} — ${action.description}`}
            onClick={() => onNavigate(action.href)}
          >
            <span className="had-action__lead" aria-hidden="true">
              <Icon name={action.icon} size={18} />
            </span>
            <span className="had-action__text">
              <span className="had-action__label">{action.label}</span>
              <span className="had-action__description">{action.description}</span>
            </span>
            <Icon name="chevron-right" size={16} className="had-action__chevron" aria-hidden="true" />
          </button>
        ))}
      </div>

      {isEmpty ? null : (
        <section className="had-list" aria-label="Aventures disponibles">
          <h2 className="had-list__heading">{DRAWER_LIST_HEADING}</h2>
          <ul className="had-list__items">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  data-had-row={row.id}
                  className="had-row"
                  aria-label={`Ouvrir ${row.title}`}
                  onClick={() => onNavigate(row.href)}
                >
                  <span className="had-row__lead" aria-hidden="true">
                    <Icon name={row.icon} size={16} />
                  </span>
                  <span className="had-row__text">
                    <span className="had-row__title">{row.title}</span>
                    <span className="had-row__subtitle">{row.subtitle}</span>
                  </span>
                  <Icon name="chevron-right" size={14} className="had-row__chevron" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Tiroir « Tes aventures » — ecran `01-drawer`.
 *
 * Ouvert par l'appui long sur l'onglet Hub (evenement `hub:open-switcher`,
 * emis par `useProminentAction`). Hors surface hub, `useProminentAction` pose
 * un signal one-shot puis navigue vers /hub : ce tiroir le consomme au montage
 * et se rouvre une fois — exactement le comportement du switchher precedent.
 *
 * Le `Sheet` partage porte le focus trap, la restitution du focus, Echap et la
 * fermeture au clic sur l'arrière-plan. Un seul dialogue a la fois : ce tiroir
 * remplace l'ancien switcher sur ce geste, qui reste disponible au clavier
 * (Ctrl/Cmd+K ou J) via l'AdventureSwitcher.
 */
export function HubAdventuresDrawer() {
  const router = useRouter();
  const pathname = usePathname();
  const { groups, getLastSection } = useActiveAdventure();
  const { triggerHaptic } = useHapticFeedback();
  const [open, setOpen] = useState(false);
  const autopenDone = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // Signal one-shot « appui long hors hub » : consomme AVANT tout effet
  // concurrent (l'ancien switcher) pour qu'un seul dialogue s'ouvre.
  useEffect(() => {
    if (autopenDone.current) return;
    autopenDone.current = true;
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    if (consumeDrawerAutoOpen(storage)) setOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener('hub:open-switcher', onOpen);
    window.addEventListener('hub:close-switcher', onClose);
    return () => {
      window.removeEventListener('hub:open-switcher', onOpen);
      window.removeEventListener('hub:close-switcher', onClose);
    };
  }, []);

  // Dialogue d'etat : le retour materiel Android ferme ce qui est ouvert.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('hub:switcher-state', { detail: { open } }));
  }, [open]);

  // Sort la barre d’onglets de l’echelle visuelle tant que le tiroir est
  // ouvert : sous le verre du Sheet (z 50 > z 40), ses icones se lisaient
  // dans la derniere ligne. L’attribut est retire au demontage, donc un
  // demontage en cours de route ne laisse jamais la barre invisible derriere
  // un dialogue ferme.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.setAttribute(OPEN_ATTRIBUTE, 'true');
    return () => root.removeAttribute(OPEN_ATTRIBUTE);
  }, [open]);

  // Le tiroir ne survit jamais a une navigation (une action, un retour, un deep link).
  useEffect(() => {
    if (open) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navigate = useCallback(
    (href: string) => {
      triggerHaptic('selection');
      close();
      router.push(href);
    },
    [close, router, triggerHaptic],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen} title={DRAWER_TITLE} description={DRAWER_SUBTITLE}>
      <HubAdventuresDrawerContent groups={groups} getLastSection={getLastSection} onNavigate={navigate} />
    </Sheet>
  );
}

export default HubAdventuresDrawer;