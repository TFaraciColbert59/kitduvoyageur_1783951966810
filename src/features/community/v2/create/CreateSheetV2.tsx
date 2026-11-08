'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { BookOpen, Backpack, Camera, Map as MapIcon, PenLine, Users } from 'lucide-react';
import { CommunitySheetShell } from '../shared/CommunitySheetShell';
import { DynamicIsland } from '@/components/ui/drawer/DynamicIsland';
import { useKeyboardInsets } from '@/hooks/useKeyboardInsets';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CREATE_KINDS_V2, type CreateKindV2 } from './engine/createSchemasV2';
import { createKindConfig, stepAriaLabel } from './engine/steps';
import type { CreateNavV2 } from './engine/nav';
import { flushDraftV2 } from './engine/useDraftV2';
import { PostFormV2 } from './forms/PostFormV2';
import { StoryFormV2 } from './forms/StoryFormV2';
import { SortieFormV2 } from './forms/SortieFormV2';
import { ClubFormV2 } from './forms/ClubFormV2';
import { KitFormV2 } from './forms/KitFormV2';
import { CarnetFormV2 } from './forms/CarnetFormV2';
import {
  CreateSheetContext,
  type CreateDetailRequest,
  type CreateSheetContextValue,
  type CreateSuccessV2,
} from './CreateSheetContext';
import './create-v2.css';

/**
 * Tiroir Création V2 — coque `/compte` (`CommunitySheetShell`) + moteur unique
 * pour les 6 types (`CreateFormEngineV2`).
 *
 * - capsule 56 px = les 6 types ; mini-capsule 30 px = les étapes du type
 *   courant (« Étape i : … ») ; pied fixe Retour / Suivant / action finale ;
 * - changement de type = étapes à zéro, **brouillon du type quitté conservé** ;
 * - fermeture = confirmation si saisie (piège de focus), brouillon écrit à la
 *   fermeture, à `pagehide` et à `visibilitychange` ;
 * - succès = île `DynamicIsland` (« Publié », « Story publiée », « Carnet créé »,
 *   « Sortie créée », « Kit créé », « Club créé ») avec Voir / Partager /
 *   Ouvrir la page, puis `onCreated(kind)` et fermeture ;
 * - clavier : `visualViewport` (`useKeyboardInsets`) → pied au-dessus du clavier,
 *   étape et champ actif ramenés à l'écran.
 */

export interface CreateSheetV2Props {
  open: boolean;
  initialKind: CreateKindV2;
  onClose: () => void;
  user: User | null;
  onCreated: (kind: CreateKindV2) => void;
  onRequireAuth: () => void;
  /**
   * Préremplissage à l'ouverture (`{clubId, clubName}`, `{kitId, kitName}`,
   * `{kind}`…) — lu à chaque ouverture, appliqué au formulaire concerné.
   */
  initialPrefill?: Record<string, unknown> | null;
  /**
   * Enchaînement interne : fin de Club → « Organiser la première sortie »
   * (`{clubId, clubName}`), fin de Kit → Sortie (`{kitId, kitName}`).
   * La page peut aussi l'utiliser pour ouvrir Création depuis ses états vides.
   */
  onCreateRequested?: (kind: CreateKindV2, prefill?: Record<string, unknown>) => void;
}

const KIND_META: Record<CreateKindV2, { label: string; icon: React.ReactNode }> = {
  post: { label: 'Publication', icon: <PenLine size={22} aria-hidden="true" /> },
  story: { label: 'Story', icon: <Camera size={22} aria-hidden="true" /> },
  carnet: { label: 'Carnet', icon: <BookOpen size={22} aria-hidden="true" /> },
  sortie: { label: 'Sortie', icon: <MapIcon size={22} aria-hidden="true" /> },
  kit: { label: 'Kit', icon: <Backpack size={22} aria-hidden="true" /> },
  club: { label: 'Club', icon: <Users size={22} aria-hidden="true" /> },
};

interface IslandState {
  title: string;
  subtitle: string;
  kind: CreateKindV2;
  actionLabel: string;
  action: () => void;
  undoLabel?: string;
  undo?: () => void;
}

function kindIndexOf(kind: CreateKindV2): number {
  const index = CREATE_KINDS_V2.indexOf(kind);
  return index >= 0 ? index : 0;
}

export function CreateSheetV2({
  open,
  initialKind,
  onClose,
  user,
  onCreated,
  onRequireAuth,
  initialPrefill = null,
  onCreateRequested,
}: CreateSheetV2Props) {
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const keyboard = useKeyboardInsets();
  const [kindIndex, setKindIndex] = useState(() => kindIndexOf(initialKind));
  const [visited, setVisited] = useState<CreateKindV2[]>(() => [initialKind]);
  const [navs, setNavs] = useState<Map<CreateKindV2, CreateNavV2>>(() => new Map());
  const [detail, setDetail] = useState<CreateDetailRequest | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [island, setIsland] = useState<IslandState | null>(null);
  const [prefillByKind, setPrefillByKind] = useState<Partial<Record<CreateKindV2, Record<string, unknown>>>>(
    {},
  );
  const [prefillNonce, setPrefillNonce] = useState(0);
  const keepOpenRef = useRef(false);
  const authAskedRef = useRef(false);
  const activeKind = CREATE_KINDS_V2[kindIndex] ?? 'post';
  const activeNav = navs.get(activeKind) ?? null;
  const config = createKindConfig(activeKind);

  // Ouverture : type demandé, préremplissage, remise à zéro des couches.
  useEffect(() => {
    if (!open) {
      authAskedRef.current = false;
      return;
    }
    setKindIndex(kindIndexOf(initialKind));
    setVisited((current) => (current.includes(initialKind) ? current : [...current, initialKind]));
    setConfirmClose(false);
    setIsland(null);
    setDetail(null);
    if (initialPrefill) {
      setPrefillByKind((current) => ({
        ...current,
        [initialKind]: { ...(current[initialKind] ?? {}), ...initialPrefill },
      }));
      setPrefillNonce((nonce) => nonce + 1);
    }
  }, [initialKind, initialPrefill, open]);

  // Toute écriture exige un compte en règle (`01 § 1`).
  useEffect(() => {
    if (!open) return;
    if (user && !user.is_anonymous) return;
    if (authAskedRef.current) return;
    authAskedRef.current = true;
    onRequireAuth();
  }, [onRequireAuth, open, user]);

  const reportNav = useMemo(() => {
    const map = new Map<CreateKindV2, (nav: CreateNavV2) => void>();
    for (const kind of CREATE_KINDS_V2) {
      map.set(kind, (nav: CreateNavV2) => {
        setNavs((current) => {
          const previous = current.get(kind);
          if (
            previous &&
            previous.stepIndex === nav.stepIndex &&
            previous.busy === nav.busy &&
            previous.busyLabel === nav.busyLabel &&
            previous.serverError === nav.serverError &&
            previous.hasContent === nav.hasContent
          ) {
            return current;
          }
          const next = new Map(current);
          next.set(kind, nav);
          return next;
        });
      });
    }
    return map;
    // Les setters sont stables : une seule carte pour toute la vie du tiroir.
  }, []);

  const markVisited = useCallback((kind: CreateKindV2) => {
    setVisited((current) => (current.includes(kind) ? current : [...current, kind]));
  }, []);

  const changeKind = useCallback(
    (index: number) => {
      const nextKind = CREATE_KINDS_V2[index];
      if (!nextKind || nextKind === activeKind) return;
      const currentNav = navs.get(activeKind);
      currentNav?.flushDraft();
      haptic('selection');
      setKindIndex(index);
      markVisited(nextKind);
      setDetail(null);
    },
    [activeKind, haptic, markVisited, navs],
  );

  const requestCreate = useCallback(
    (kind: CreateKindV2, prefill?: Record<string, unknown>) => {
      const currentKind = CREATE_KINDS_V2[kindIndex] ?? 'post';
      navs.get(currentKind)?.flushDraft();
      if (prefill) {
        setPrefillByKind((current) => ({ ...current, [kind]: { ...(current[kind] ?? {}), ...prefill } }));
        setPrefillNonce((nonce) => nonce + 1);
      }
      setKindIndex(kindIndexOf(kind));
      markVisited(kind);
      setDetail(null);
      onCreateRequested?.(kind, prefill);
    },
    [kindIndex, markVisited, navs, onCreateRequested],
  );

  const flushAllDrafts = useCallback(() => {
    for (const kind of visited) flushDraftV2(kind);
    navs.forEach((nav) => nav.flushDraft());
  }, [navs, visited]);

  const closeNow = useCallback(() => {
    flushAllDrafts();
    setConfirmClose(false);
    setIsland(null);
    setDetail(null);
    onClose();
  }, [flushAllDrafts, onClose]);

  const requestClose = useCallback(() => {
    if (island) return;
    if (detail) {
      setDetail(null);
      return;
    }
    if (activeNav?.busy) return;
    if (activeNav?.hasContent) {
      activeNav.flushDraft();
      setConfirmClose(true);
      haptic('medium');
      return;
    }
    closeNow();
  }, [activeNav, closeNow, detail, haptic, island]);

  const handleEscape = useCallback((): boolean => {
    if (island) {
      return true; // l'île se ferme d'elle-même (action ou repos)
    }
    if (confirmClose) {
      setConfirmClose(false);
      return true;
    }
    return false;
  }, [confirmClose, island]);

  const openDetail = useCallback((request: CreateDetailRequest) => {
    setDetail(request);
    haptic('light');
  }, [haptic]);

  const closeDetail = useCallback(() => setDetail(null), []);

  const finishCreated = useCallback(
    (kind: CreateKindV2) => {
      flushDraftV2(kind);
      onCreated(kind);
    },
    [onCreated],
  );

  const reportCreated = useCallback(
    (kind: CreateKindV2, result: CreateSuccessV2) => {
      haptic('success');
      const openPage = () => {
        keepOpenRef.current = false;
        if (kind === 'club' && result.slug) router.push(`/clubs/${result.slug}`);
        else if (kind === 'carnet') router.push(`/carnets/${result.id}`);
        else if (kind === 'sortie') router.push(`/sorties/${result.id}`);
        else if (kind === 'post') router.push(`/communaute?post=${result.id}`);
        finishCreated(kind);
      };
      const share = async () => {
        keepOpenRef.current = false;
        const url =
          kind === 'carnet'
            ? `${window.location.origin}/carnets/${result.id}`
            : kind === 'sortie'
              ? `${window.location.origin}/sorties/${result.id}`
              : undefined;
        try {
          if (navigator.share) {
            await navigator.share({ title: result.name ?? config.successTitle, url });
          } else if (url) {
            await navigator.clipboard.writeText(url);
          }
        } catch {
          /* partage annulé */
        }
        finishCreated(kind);
      };

      const base: IslandState = {
        title: config.successTitle,
        subtitle:
          kind === 'club'
            ? 'Le club et ton adhésion d’administrateur sont créés.'
            : kind === 'kit'
              ? 'Le kit est prêt à être partagé.'
              : kind === 'carnet'
                ? 'Le carnet est enregistré.'
                : kind === 'sortie'
                  ? 'Les participants peuvent s’inscrire.'
                  : kind === 'story'
                    ? 'Visible 24 h.'
                    : 'Visible dans le fil.',
        kind,
        actionLabel:
          kind === 'carnet' || kind === 'club'
            ? 'Ouvrir la page'
            : kind === 'post'
              ? 'Voir'
              : kind === 'story'
                ? 'Voir'
                : 'Partager',
        action: kind === 'post' || kind === 'story' ? openPage : kind === 'carnet' || kind === 'club' ? openPage : share,
      };
      if (kind === 'club') {
        base.undoLabel = 'Organiser une sortie';
        base.undo = () => {
          keepOpenRef.current = true;
          setIsland(null);
          requestCreate('sortie', {
            clubId: result.id,
            clubName: result.name ?? '',
          });
        };
      }
      setIsland(base);
    },
    [config.successTitle, finishCreated, haptic, requestCreate, router],
  );

  const contextValue = useMemo<CreateSheetContextValue>(
    () => ({
      user,
      requireAuth: onRequireAuth,
      reportCreated,
      openDetail,
      closeDetail,
      requestCreate,
    }),
    [closeDetail, onRequireAuth, openDetail, reportCreated, requestCreate, user],
  );

  const capsureItems = useMemo(
    () =>
      CREATE_KINDS_V2.map((kind) => ({
        id: kind,
        label: KIND_META[kind].label,
        icon: KIND_META[kind].icon,
      })),
    [],
  );

  const mini = useMemo(() => {
    if (!activeNav) return null;
    return {
      items: config.steps.map((step, index) => ({
        id: `cv2c-step-${index}`,
        label: stepAriaLabel(index, step.label),
        icon: <span className="lkdv-cv2c-step-num">{index + 1}</span>,
      })),
      active: activeNav.stepIndex,
      onChange: (index: number) => activeNav.goToStep(index),
      label: `Étapes de la création : ${KIND_META[activeKind].label}`,
    };
  }, [activeKind, activeNav, config.steps]);

  const footer = activeNav ? (
    <div className="lkdv-cv2c-footbar">
      {activeNav.serverError ? (
        <p className="lkdv-cv2c-server" role="alert">
          {activeNav.serverError}
        </p>
      ) : null}
      <div className="lkdv-cv2c-foot-actions">
        {activeNav.canBack ? (
          <button
            type="button"
            className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-back"
            onClick={activeNav.goBack}
            disabled={activeNav.busy}
          >
            Retour
          </button>
        ) : null}
        <button
          type="button"
          className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2c-next"
          onClick={activeNav.goNext}
          disabled={activeNav.busy || !user}
          aria-busy={activeNav.busy || undefined}
        >
          {activeNav.busy
            ? activeNav.busyLabel ?? 'Envoi…'
            : activeNav.stepIndex >= activeNav.stepCount - 1
              ? activeNav.finalLabel
              : 'Suivant'}
        </button>
      </div>
    </div>
  ) : null;

  const formsByKind: Record<CreateKindV2, React.ReactNode> = {
    post: <PostFormV2 active={activeKind === 'post'} prefill={prefillByKind.post} prefillNonce={prefillNonce} onNavChange={reportNav.get('post')!} />,
    story: <StoryFormV2 active={activeKind === 'story'} prefill={prefillByKind.story} prefillNonce={prefillNonce} onNavChange={reportNav.get('story')!} />,
    sortie: <SortieFormV2 active={activeKind === 'sortie'} prefill={prefillByKind.sortie} prefillNonce={prefillNonce} onNavChange={reportNav.get('sortie')!} />,
    club: <ClubFormV2 active={activeKind === 'club'} prefill={prefillByKind.club} prefillNonce={prefillNonce} onNavChange={reportNav.get('club')!} />,
    kit: <KitFormV2 active={activeKind === 'kit'} prefill={prefillByKind.kit} prefillNonce={prefillNonce} onNavChange={reportNav.get('kit')!} />,
    carnet: <CarnetFormV2 active={activeKind === 'carnet'} prefill={prefillByKind.carnet} prefillNonce={prefillNonce} onNavChange={reportNav.get('carnet')!} />,
  };

  const panes = CREATE_KINDS_V2.map((kind, index) => (
    <div key={kind} className="lkdv-cv2c-form-host" data-kind={kind} data-current={index === kindIndex ? 'true' : undefined}>
      {visited.includes(kind) ? formsByKind[kind] : null}
    </div>
  ));

  const sheetDetail = detail
    ? {
        pages: [detail.node],
        index: 0,
        title: detail.title,
        meta: detail.meta,
        onBack: closeDetail,
      }
    : null;

  const islandNode = island ? (
    <DynamicIsland
      open
      title={island.title}
      subtitle={island.subtitle}
      action={{ label: island.actionLabel, onAction: island.action }}
      undo={island.undo && island.undoLabel ? { label: island.undoLabel, onUndo: island.undo } : undefined}
      onClose={() => {
        const stay = keepOpenRef.current;
        keepOpenRef.current = false;
        setIsland(null);
        if (!stay) finishCreated(island.kind);
      }}
    />
  ) : null;

  return (
    <CreateSheetContext.Provider value={contextValue}>
      <CommunitySheetShell
        open={open}
        onClose={requestClose}
        label="Créer dans la communauté"
        capsule={{ items: capsureItems, active: kindIndex, onChange: changeKind, ariaLabel: 'Type de création' }}
        mini={detail ? null : mini}
        footer={detail ? null : footer}
        panes={panes}
        detail={sheetDetail}
        onEscape={handleEscape}
        resetKey={`${activeKind}:${prefillNonce}`}
        island={islandNode}
        className={keyboard > 0 ? 'lkdv-cv2c-keyboard' : undefined}
      >
        {confirmClose ? (
          <div className="lkdv-cv2c-confirm-layer">
            <div
              className="lkdv-cv2-confirm lkdv-cv2c-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="cv2c-confirm-title"
              aria-describedby="cv2c-confirm-text"
              onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                const nodes = event.currentTarget.querySelectorAll<HTMLElement>('button');
                if (nodes.length === 0) return;
                const first = nodes[0];
                const last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }}
            >
              <b id="cv2c-confirm-title">Fermer sans publier ?</b>
              <p id="cv2c-confirm-text" className="lkdv-cv2-field-hint">
                Ton brouillon de {KIND_META[activeKind].label.toLowerCase()} est conservé sur cet
                appareil. Tu pourras reprendre où tu t’es arrêté.
              </p>
              <div className="lkdv-cv2-confirm-actions">
                <button
                  type="button"
                  className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
                  onClick={() => closeNow()}
                >
                  Fermer
                </button>
                <button
                  type="button"
                  className="lkdv-cv2-pill lkdv-cv2-pill--primary"
                  data-cv2-autofocus
                  onClick={() => setConfirmClose(false)}
                >
                  Continuer l’édition
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </CommunitySheetShell>
    </CreateSheetContext.Provider>
  );
}

export default CreateSheetV2;
