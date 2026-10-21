'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlotSelector } from './SlotSelector';
import { SlotShell, type SlotId, type SlotLens, type Viewer, type Visibility } from './SlotShell';
import { SLOT_ICONS } from './slotIcons';
import { InvitationsSheet } from './InvitationsSheet';
import { PrivateAccountLock, profileIdentityFromPayload } from './PrivateAccountLock';
import { KitSlot } from './slots/KitSlot';
import { LoansSlot } from './slots/LoansSlot';
import { MemoriesSlot } from './slots/MemoriesSlot';
import { CommunitySlot } from './slots/CommunitySlot';
import { VitrineSlot } from './slots/VitrineSlot';

export type { SlotId, Viewer, Visibility } from './SlotShell';

const INVITATIONS_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0M19 8v6M16 11h6" />
  </svg>
);

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

/**
 * Ajoute le rôle résolu au payload bootstrap sans écraser ses données.
 *
 * Les slots lisent tous `payload.viewer` (Kit, Prêts, Vitrine, et les futurs
 * gardes Communauté) ; les trois slots qui exposent aussi une prop `viewer`
 * la reçoivent explicitement. Le payload fusionné est mémoïsé par l'hôte :
 * son identité reste stable pour le cache de visibilité de la Vitrine.
 */
function payloadWithViewer(payload: unknown, viewer: Viewer): unknown {
  if (payload !== null && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ...(payload as Record<string, unknown>), viewer };
  }
  return { viewer };
}

function renderSlotContent(
  slot: SlotId,
  lens: SlotLens,
  payload: unknown,
  viewer: Viewer
): React.ReactNode {
  switch (slot) {
    case 'vitrine':
      return <VitrineSlot lens={lens.id} payload={payload} viewer={viewer} />;
    case 'kit':
      return <KitSlot lens={lens.id} payload={payload} viewer={viewer} />;
    case 'prets':
      return <LoansSlot lens={lens.id} payload={payload} viewer={viewer} />;
    case 'souvenirs':
      return <MemoriesSlot lens={lens.id} payload={payload} />;
    case 'communaute':
      return <CommunitySlot lens={lens.id} payload={payload} />;
    default:
      return <VitrineSlot lens={lens.id} payload={payload} viewer={viewer} />;
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
  const [invitationsOpen, setInvitationsOpen] = useState(false);
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
  /* Le rôle traverse tous les slots : sans cela, un visiteur d'un profil
     public est déduit propriétaire et voit les actions du propriétaire. */
  const slotPayload = useMemo(() => payloadWithViewer(payload, viewer), [payload, viewer]);

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
        renderLens={(lens) => renderSlotContent(slot, lens, slotPayload, viewer)}
        selector={<SlotSelector activeSlot={slot} onSlotChange={handleSlotChange} />}
      />
    ),
    [slot, viewer, visibility, invited, meta, activeLensIndex, slotPayload, handleSlotChange]
  );

  const openInvitations = useCallback(() => setInvitationsOpen(true), []);
  const closeInvitations = useCallback(() => setInvitationsOpen(false), []);

  const content = (
    <>
      {locked ? (
        <PrivateAccountLock name={identity.name} avatarUrl={identity.avatarUrl} />
      ) : (
        <div className="lkdv-drawer-host">
          {shell}
          {viewer === 'owner' ? (
            <button
              type="button"
              className="lkdv-invitations-entry"
              aria-label="Gérer les invitations"
              onClick={openInvitations}
            >
              {INVITATIONS_ICON}
            </button>
          ) : null}
        </div>
      )}
      {invitationsOpen ? <InvitationsSheet onClose={closeInvitations} /> : null}
    </>
  );

  if (!target) return content;
  return createPortal(content, target);
}

export default ProfileDrawerHost;
