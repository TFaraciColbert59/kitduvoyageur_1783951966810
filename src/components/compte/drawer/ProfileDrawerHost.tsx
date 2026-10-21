'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlotSelector } from './SlotSelector';
import { SlotShell, type SlotId, type SlotLens, type Viewer, type Visibility } from './SlotShell';
import { SLOT_ICONS } from './slotIcons';
import { PrivateAccountLock, profileIdentityFromPayload } from './PrivateAccountLock';
import { KitSlot } from './slots/KitSlot';
import { LoansSlot } from './slots/LoansSlot';
import { MemoriesSlot } from './slots/MemoriesSlot';
import { CommunitySlot } from './slots/CommunitySlot';
import { VitrineSlot } from './slots/VitrineSlot';

export type { SlotId, Viewer, Visibility } from './SlotShell';

export interface ProfileDrawerHostProps {
  viewer: Viewer;
  visibility: Visibility;
  /**
   * Invitation accordée au visiteur. `undefined`/`false` verrouille un profil
   * privé : seul `invited === true` ouvre les slots.
   */
  invited?: boolean;
  activeSlot?: SlotId;
  onSlotChange?: (slot: SlotId) => void;
  /** Payload du bootstrap (tâche 2). Aucune donnée inventée ici. */
  payload?: unknown;
  /** Nœud runtime passé par `__lkdvMountSlot`, prioritaire sur le fallback. */
  portalRoot?: HTMLElement | null;
}

interface SlotMeta {
  title: string;
  subtitle: string;
  lenses: SlotLens[];
}

const SLOT_META: Record<SlotId, SlotMeta> = {
  vitrine: {
    title: 'Vitrine',
    subtitle: 'Ta trace publique, vérifiée sur le terrain',
    lenses: [
      { id: 'stats', label: 'Stats' },
      { id: 'repost', label: 'Republication' },
      { id: 'badges', label: 'Trophées' },
    ],
  },
  kit: {
    title: 'Kit',
    subtitle: 'Tes kits, ton matériel et tes preuves',
    lenses: [
      { id: 'kits', label: 'Kits' },
      { id: 'inventory', label: 'Inventaire' },
    ],
  },
  prets: {
    title: 'Prêts',
    subtitle: 'Ce que tu prêtes, ce que tu empruntes',
    lenses: [
      { id: 'lender', label: 'Je prête' },
      { id: 'borrower', label: "J'emprunte" },
      { id: 'trust', label: 'Confiance' },
    ],
  },
  souvenirs: {
    title: 'Souvenirs',
    subtitle: 'Tes sorties, tes lieux et tes À la une',
    lenses: [
      { id: 'timeline', label: 'Timeline' },
      { id: 'passport', label: 'Passeport' },
      { id: 'souvenirs', label: 'Souvenirs' },
    ],
  },
  communaute: {
    title: 'Communauté',
    subtitle: 'Défis, clubs et cordée',
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
 * Toutes les props de navigation sont optionnelles afin qu'un rendu isolé
 * (tests de la tâche 14, verrou privé) reste possible sans montage runtime.
 */
export function ProfileDrawerHost({
  viewer,
  visibility,
  invited = false,
  activeSlot = 'vitrine',
  onSlotChange,
  payload = null,
  portalRoot = null,
}: ProfileDrawerHostProps) {
  const [activeLensIndex, setActiveLensIndex] = useState(0);
  const [fallbackRoot] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.getElementById('lkdv-slot-root')
  );

  // Le runtime reconstruit le nœud à chaque `renderSheet()` : on utilise la
  // dernière référence passée par `__lkdvMountSlot`, sans observer le body.
  const target = portalRoot ?? fallbackRoot;

  // Stabilise le callback pour ne pas reconstruire la coquille à chaque rendu
  // du parent (le runtime passe une lambda).
  const onSlotChangeRef = useRef(onSlotChange);
  useEffect(() => {
    onSlotChangeRef.current = onSlotChange;
  }, [onSlotChange]);
  const handleSlotChange = useCallback((slotId: SlotId) => {
    onSlotChangeRef.current?.(slotId);
  }, []);

  useEffect(() => {
    setActiveLensIndex(0);
  }, [activeSlot]);

  const slot: SlotId = SLOT_META[activeSlot] ? activeSlot : 'vitrine';
  const meta = SLOT_META[slot];

  // Un visiteur sans invitation ne voit aucun slot : le verrou remplace toute
  // la coquille (et donc le sélecteur `.ig-tabs`). Le propriétaire, lui, voit
  // toujours ses slots, même sur un profil privé.
  const locked = viewer === 'visitor' && visibility === 'prive' && invited !== true;
  const identity = useMemo(() => profileIdentityFromPayload(payload), [payload]);

  const shell = useMemo(
    () => (
      <SlotShell
        slot={slot}
        viewer={viewer}
        visibility={visibility}
        invited={invited}
        title={meta.title}
        subtitle={meta.subtitle}
        icon={SLOT_ICONS[slot]}
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
        selector={<SlotSelector activeSlot={slot} onSlotChange={handleSlotChange} />}
      />
    ),
    [slot, viewer, visibility, invited, meta, activeLensIndex, payload, handleSlotChange]
  );

  const content = locked ? (
    <PrivateAccountLock viewer={viewer} name={identity.name} avatarUrl={identity.avatarUrl} />
  ) : (
    shell
  );

  if (!target) return content;
  return createPortal(content, target);
}

export default ProfileDrawerHost;
