'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlotSelector } from './SlotSelector';
import {
  SlotShell,
  type SlotId,
  type SlotLens,
  type Viewer,
  type Visibility,
} from './SlotShell';
import { KitSlot } from './slots/KitSlot';
import { LoansSlot } from './slots/LoansSlot';
import { MemoriesSlot } from './slots/MemoriesSlot';
import { CommunitySlot } from './slots/CommunitySlot';
import { VitrineSlot } from './slots/VitrineSlot';

export type { SlotId, Viewer, Visibility } from './SlotShell';

export interface ProfileDrawerHostProps {
  viewer: Viewer;
  visibility: Visibility;
  /** Consommé par la tâche 14 (compte privé et invitations). */
  invited?: boolean;
  activeSlot: SlotId;
  onSlotChange: (slot: SlotId) => void;
  /** Payload du bootstrap (tâche 2). Aucune donnée inventée ici. */
  payload: unknown;
}

interface SlotMeta {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  lenses: SlotLens[];
}

const iconProps = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: 'false',
} as const;

const SLOT_META: Record<SlotId, SlotMeta> = {
  vitrine: {
    title: 'Vitrine',
    subtitle: 'Ta trace publique, vérifiée sur le terrain',
    icon: (
      <svg {...iconProps}>
        <path d="M4 10v10h16V10M3 10l1.6-5h14.8L21 10M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
    lenses: [
      { id: 'stats', label: 'Stats' },
      { id: 'repost', label: 'Republication' },
      { id: 'badges', label: 'Trophées' },
    ],
  },
  kit: {
    title: 'Kit',
    subtitle: 'Tes kits, ton matériel et tes preuves',
    icon: (
      <svg {...iconProps}>
        <path d="M9 6.5V5a3 3 0 0 1 6 0v1.5" />
        <path d="M6 10.5a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8.5Z" />
        <path d="M9.5 14h5v4h-5z" />
      </svg>
    ),
    lenses: [
      { id: 'kits', label: 'Kits' },
      { id: 'inventory', label: 'Inventaire' },
    ],
  },
  prets: {
    title: 'Prêts',
    subtitle: 'Ce que tu prêtes, ce que tu empruntes',
    icon: (
      <svg {...iconProps}>
        <path d="M4 8h13l3 5v5H4V8Z" />
        <path d="M4 13h16M8 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </svg>
    ),
    lenses: [
      { id: 'lender', label: 'Je prête' },
      { id: 'borrower', label: "J'emprunte" },
      { id: 'trust', label: 'Confiance' },
    ],
  },
  souvenirs: {
    title: 'Souvenirs',
    subtitle: 'Tes sorties, tes lieux et tes À la une',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="15" rx="2.5" />
        <circle cx="8.5" cy="10" r="1.6" />
        <path d="m4 18 5-5 4 4 3-3 4 4" />
      </svg>
    ),
    lenses: [
      { id: 'timeline', label: 'Timeline' },
      { id: 'passport', label: 'Passeport' },
      { id: 'souvenirs', label: 'Souvenirs' },
    ],
  },
  communaute: {
    title: 'Communauté',
    subtitle: 'Défis, clubs et cordée',
    icon: (
      <svg {...iconProps}>
        <path d="M9 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM3 19.5c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3M16.5 11a2.6 2.6 0 1 0 0-5.2M17 14.4c2.2.3 3.6 2 4 5" />
      </svg>
    ),
    lenses: [
      { id: 'challenges', label: 'Défis' },
      { id: 'clubs', label: 'Clubs' },
      { id: 'cordee', label: 'Cordée' },
    ],
  },
};

function renderSlotContent(slot: SlotId, lens: SlotLens, payload: unknown): React.ReactNode {
  switch (slot) {
    case 'vitrine':
      return <VitrineSlot lens={lens.id} payload={payload} />;
    case 'kit':
      return <KitSlot lens={lens.id} payload={payload} />;
    case 'prets':
      return <LoansSlot lens={lens.id} payload={payload} />;
    case 'souvenirs':
      return <MemoriesSlot lens={lens.id} payload={payload} />;
    case 'communaute':
      return <CommunitySlot lens={lens.id} payload={payload} />;
    default:
      return <VitrineSlot lens={lens.id} payload={payload} />;
  }
}

/**
 * Hôte React du drawer Profil v2.
 *
 * Le runtime vanilla garde la feuille, les gestes et la carte du bas : pour
 * `S.step === 0`, il rend `<div id="lkdv-slot-root">` puis appelle
 * `window.__lkdvMountSlot?.(root, slotId, S)`. Cet hôte est alors rendu par
 * `CompteLiquidGlassV8` et portalise la coquille dans ce nœud runtime.
 *
 * Aucun contenu de slot n'est livré ici : chaque slot est un placeholder
 * d'état vide, remplacé par les tâches 4 à 13 sans modifier cet hôte.
 */
export function ProfileDrawerHost({
  viewer,
  visibility,
  activeSlot,
  onSlotChange,
  payload,
}: ProfileDrawerHostProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [activeLensIndex, setActiveLensIndex] = useState(0);

  useEffect(() => {
    setActiveLensIndex(0);
  }, [activeSlot]);

  // Le runtime reconstruit `#lkdv-slot-root` à chaque `renderSheet()` :
  // on suit le nœud courant pour ne jamais portailiser dans un nœud détaché.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => {
      const element = document.getElementById('lkdv-slot-root');
      setPortalTarget((current) => (current === element ? current : element));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const slot: SlotId = SLOT_META[activeSlot] ? activeSlot : 'vitrine';
  const meta = SLOT_META[slot];

  // En navigateur, on préfère toujours le nœud runtime courant (il vient
  // d'être recréé) ; en test/SSR sans nœud, la coquille est rendue en ligne.
  const liveTarget =
    typeof document !== 'undefined' ? document.getElementById('lkdv-slot-root') : null;
  const target = liveTarget ?? portalTarget;

  const shell = useMemo(
    () => (
      <SlotShell
        slot={slot}
        viewer={viewer}
        visibility={visibility}
        title={meta.title}
        subtitle={meta.subtitle}
        icon={meta.icon}
        lenses={meta.lenses}
        activeLensIndex={activeLensIndex}
        onLensChange={setActiveLensIndex}
        onShare={() => {
          if (typeof window === 'undefined') return;
          const act = (window as unknown as { __lkdvCompteAct?: (action: string) => void })
            .__lkdvCompteAct;
          if (typeof act === 'function') act('shareProfile');
        }}
        renderLens={(lens) => renderSlotContent(slot, lens, payload)}
        selector={
          <SlotSelector activeSlot={slot} onSlotChange={onSlotChange} />
        }
      />
    ),
    [slot, viewer, visibility, meta, activeLensIndex, payload, onSlotChange]
  );

  if (!target) return shell;
  return createPortal(shell, target);
}

export default ProfileDrawerHost;
