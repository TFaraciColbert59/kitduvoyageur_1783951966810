'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlotSelector } from './SlotSelector';
import { LENS_ICONS } from './lensIcons';
import {
  SlotShell,
  type SlotContentState,
  type SlotId,
  type SlotLens,
  type Viewer,
  type Visibility,
} from './SlotShell';
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
  /**
   * État de la lecture bootstrap. Tant qu'elle est en vol, la coquille montre
   * un squelette ; sur échec, un état d'erreur avec nouvel essai.
   */
  state?: SlotContentState;
  /** Relance la lecture bootstrap après un échec. */
  onRetry?: () => void;
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
    subtitle: 'Ta trace publique vérifiée',
    lenses: [
      { id: 'stats', label: 'Stats', icon: LENS_ICONS.stats },
      { id: 'repost', label: 'Republication', icon: LENS_ICONS.repost },
      { id: 'badges', label: 'Trophées', icon: LENS_ICONS.badges },
    ],
  },
  kit: {
    title: 'Kit',
    subtitle: 'Tes kits, ton matériel et tes preuves',
    lenses: [
      { id: 'kits', label: 'Kits', icon: LENS_ICONS.kits },
      { id: 'inventory', label: 'Inventaire', icon: LENS_ICONS.inventory },
    ],
  },
  prets: {
    title: 'Prêts',
    subtitle: 'Ce que tu prêtes, ce que tu empruntes',
    lenses: [
      { id: 'lender', label: 'Je prête', icon: LENS_ICONS.lender },
      { id: 'borrower', label: "J'emprunte", icon: LENS_ICONS.borrower },
      { id: 'trust', label: 'Confiance', icon: LENS_ICONS.trust },
    ],
  },
  souvenirs: {
    title: 'Souvenirs',
    subtitle: 'Tes sorties, tes lieux et tes À la une',
    lenses: [
      { id: 'timeline', label: 'Timeline', icon: LENS_ICONS.timeline },
      { id: 'passport', label: 'Passeport', icon: LENS_ICONS.passport },
      { id: 'souvenirs', label: 'Souvenirs', icon: LENS_ICONS.souvenirs },
    ],
  },
  communaute: {
    title: 'Communauté',
    subtitle: 'Défis et clubs',
    lenses: [
      { id: 'challenges', label: 'Défis', icon: LENS_ICONS.challenges },
      { id: 'clubs', label: 'Clubs', icon: LENS_ICONS.clubs },
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
  state = 'ready',
  onRetry,
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
  const [displaySlot, setDisplaySlot] = useState<SlotId>(activeSlot);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [slideSeq, setSlideSeq] = useState(0);

  useEffect(() => {
    setDisplaySlot(activeSlot);
  }, [activeSlot]);

  const handleSlotChange = useCallback(
    (slotId: SlotId) => {
      const order: SlotId[] = ['vitrine', 'kit', 'prets', 'souvenirs', 'communaute'];
      const dir: 1 | -1 = order.indexOf(slotId) >= order.indexOf(displaySlot) ? 1 : -1;

      setSlideDir(dir);
      setSlideSeq((value) => value + 1);
      setDisplaySlot(slotId);
      onSlotChangeRef.current?.(slotId);
    },
    [displaySlot]
  );

  useEffect(() => {
    setActiveLensIndex(0);
  }, [displaySlot]);

  const slot: SlotId = SLOT_META[displaySlot] ? displaySlot : 'vitrine';
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
      <div className="lkdv-slot-slide" data-dir={slideDir} key={slideSeq}>
      <SlotShell
        slot={slot}
        viewer={viewer}
        visibility={visibility}
        invited={invited}
        title={meta.title}
        lenses={meta.lenses}
        activeLensIndex={activeLensIndex}
        onLensChange={setActiveLensIndex}
        state={state}
        onRetry={onRetry}
        errorLabel="Impossible de charger ce profil."
        renderLens={(lens) => renderSlotContent(slot, lens, slotPayload, viewer)}
        selector={<SlotSelector activeSlot={slot} onSlotChange={handleSlotChange} />}
      />
      </div>
    ),
    [slot, slideDir, slideSeq, viewer, visibility, invited, meta, activeLensIndex, slotPayload, handleSlotChange, state, onRetry]
  );

  const content = (
    <>
      {locked ? (
        <PrivateAccountLock name={identity.name} avatarUrl={identity.avatarUrl} />
      ) : (
        <div className="lkdv-drawer-host">
          {shell}
        </div>
      )}
    </>
  );

  if (!target) return content;
  return createPortal(content, target);
}

export default ProfileDrawerHost;
