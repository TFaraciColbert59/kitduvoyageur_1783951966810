'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { ExploreIcon } from '../explore/ExploreIcons';
import { CommunitySheetShell } from '../shared/CommunitySheetShell';
import { SheetPreviewContext } from '../shared/SheetPreview';
import { DynamicIsland } from '@/components/ui/drawer/DynamicIsland';
import { useKeyboardInsets } from '@/hooks/useKeyboardInsets';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CREATE_KINDS_V2, type CreateKindV2 } from './engine/createSchemasV2';
import { createKindConfig, stepAriaLabel } from './engine/steps';
import type { CreateNavV2 } from './engine/nav';
import { flushDraftV2, hasDraftContentV2 } from './engine/useDraftV2';
import { ConfirmDialogV2 } from './ConfirmDialogV2';
import dynamic from 'next/dynamic';
import {
  CreateSheetContext,
  type CreateDetailRequest,
  type CreateSheetContextValue,
  type CreateSuccessV2,
} from './CreateSheetContext';
import './create-v2.css';

// Perf : chaque formulaire (carte MapLibre, éditeur photo, kit…) est un chunk
// séparé. Seul le type actif est chargé à l'ouverture ; les autres sont
// préchargés au repos pour que le changement de type reste instantané.
const FORM_LOADERS = {
  post: () => import('./forms/PostFormV2').then((m) => ({ default: m.PostFormV2 })),
  story: () => import('./forms/StoryFormV2').then((m) => ({ default: m.StoryFormV2 })),
  sortie: () => import('./forms/SortieFormV2').then((m) => ({ default: m.SortieFormV2 })),
  club: () => import('./forms/ClubFormV2').then((m) => ({ default: m.ClubFormV2 })),
  kit: () => import('./forms/KitFormV2').then((m) => ({ default: m.KitFormV2 })),
  carnet: () => import('./forms/CarnetFormV2').then((m) => ({ default: m.CarnetFormV2 })),
} as const;
const formLoading = () => <div className="lkdv-cv2c-form-loading" aria-busy="true" />;
const PostFormV2 = dynamic(FORM_LOADERS.post, { ssr: false, loading: formLoading });
const StoryFormV2 = dynamic(FORM_LOADERS.story, { ssr: false, loading: formLoading });
const SortieFormV2 = dynamic(FORM_LOADERS.sortie, { ssr: false, loading: formLoading });
const ClubFormV2 = dynamic(FORM_LOADERS.club, { ssr: false, loading: formLoading });
const KitFormV2 = dynamic(FORM_LOADERS.kit, { ssr: false, loading: formLoading });
const CarnetFormV2 = dynamic(FORM_LOADERS.carnet, { ssr: false, loading: formLoading });

let formsPrefetched = false;
function prefetchAllForms(first?: CreateKindV2) {
  if (first) void FORM_LOADERS[first]().catch(() => {});
  if (formsPrefetched || typeof window === 'undefined') return;
  formsPrefetched = true;
  const run = () => {
    for (const load of Object.values(FORM_LOADERS)) void load().catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 2500 });
  else window.setTimeout(run, 800);
}

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
   * Préremplissage multi-types (ex. sortie terminée depuis Explorer : adapte
   * simultanément Carnet, Publication, Story, Sortie, Kit et Club).
   */
  initialPrefillsByKind?: Partial<Record<CreateKindV2, Record<string, unknown>>> | null;
  /**
   * Enchaînement interne : fin de Club → « Organiser la première sortie »
   * (`{clubId, clubName}`), fin de Kit → Sortie (`{kitId, kitName}`).
   * La page peut aussi l'utiliser pour ouvrir Création depuis ses états vides.
   */
  onCreateRequested?: (kind: CreateKindV2, prefill?: Record<string, unknown>) => void;
}

/** Pictogrammes de la capsule : ceux de la maquette (`CRTYPES`, L2618), 24 px comme la capsule de l'Explorer. */
const KIND_META: Record<CreateKindV2, { label: string; icon: React.ReactNode }> = {
  post: { label: 'Publication', icon: <ExploreIcon name="pen" size={24} /> },
  story: { label: 'Story', icon: <ExploreIcon name="camera" size={24} /> },
  carnet: { label: 'Carnet', icon: <ExploreIcon name="book" size={24} /> },
  sortie: { label: 'Sortie', icon: <ExploreIcon name="map" size={24} /> },
  kit: { label: 'Kit', icon: <ExploreIcon name="backpack" size={24} /> },
  club: { label: 'Club', icon: <ExploreIcon name="users" size={24} /> },
};

interface IslandState {
  title: string;
  subtitle: string;
  kind: CreateKindV2;
  actionLabel?: string;
  action?: () => void;
  undoLabel?: string;
  undo?: () => void;
  stayOpen?: boolean;
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
  initialPrefillsByKind = null,
  onCreateRequested,
}: CreateSheetV2Props) {
  const isGuest = !user?.id || user.is_anonymous === true;
  const router = useRouter();
  const { haptic } = useHapticFeedback();
  const keyboard = useKeyboardInsets();
  const [kindIndex, setKindIndex] = useState(() => kindIndexOf(initialKind));
  const [navs, setNavs] = useState<Map<CreateKindV2, CreateNavV2>>(() => new Map());
  const [detail, setDetail] = useState<CreateDetailRequest | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [island, setIsland] = useState<IslandState | null>(null);
  const [prefillByKind, setPrefillByKind] = useState<Partial<Record<CreateKindV2, Record<string, unknown>>>>(
    {},
  );
  const [prefillNonce, setPrefillNonce] = useState(0);
  // FID-056 : cible DOM de l'aperçu vivant, rendue par la coque au-dessus du
  // pager ; les formulaires y portent leur aperçu (`SheetPreview`).
  const [previewSlot, setPreviewSlot] = useState<HTMLDivElement | null>(null);
  const keepOpenRef = useRef(false);
  const finishedRef = useRef(false);
  const authAskedRef = useRef(false);
  const activeKind = CREATE_KINDS_V2[kindIndex] ?? 'post';
  const activeNav = navs.get(activeKind) ?? null;
  const config = createKindConfig(activeKind);

  // Perf : le formulaire demandé part tout de suite, les autres au repos.
  useEffect(() => {
    prefetchAllForms(initialKind);
  }, [initialKind]);

  // Ouverture : type demandé, préremplissage, remise à zéro des couches.
  useEffect(() => {
    if (!open) {
      authAskedRef.current = false;
      return;
    }
    setKindIndex(kindIndexOf(initialKind));
    setConfirmClose(false);
    setIsland(null);
    setDetail(null);
    finishedRef.current = false;
    if (initialPrefillsByKind || initialPrefill) {
      setPrefillByKind((current) => {
        const next: Partial<Record<CreateKindV2, Record<string, unknown>>> = { ...current };
        if (initialPrefillsByKind) {
          for (const [k, vals] of Object.entries(initialPrefillsByKind)) {
            if (!vals) continue;
            const kindKey = k as CreateKindV2;
            next[kindKey] = { ...(next[kindKey] ?? {}), ...vals };
          }
        }
        if (initialPrefill) {
          next[initialKind] = { ...(next[initialKind] ?? {}), ...initialPrefill };
        }
        return next;
      });
      setPrefillNonce((nonce) => nonce + 1);
    }
  }, [initialKind, initialPrefill, initialPrefillsByKind, open]);

  // Écoute des notifications d'erreur/alerte Dynamic Island iPhone (ex. tracé trop long d'un coup).
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    const onIslandEvent = (event: Event) => {
      const detailPayload = (event as CustomEvent<{ title?: string; subtitle?: string }>).detail;
      if (!detailPayload?.title) return;
      keepOpenRef.current = true;
      setIsland({
        title: detailPayload.title,
        subtitle: detailPayload.subtitle ?? '',
        kind: activeKind,
        stayOpen: true,
      });
    };
    window.addEventListener('lkdv-create-island', onIslandEvent);
    return () => window.removeEventListener('lkdv-create-island', onIslandEvent);
  }, [activeKind, open]);

  // Clavier mobile : le champ actif reste visible au-dessus du clavier.
  useEffect(() => {
    if (!open || keyboard <= 0 || typeof document === 'undefined') return;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const editable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (!editable || !target.closest('.lkdv-cv2-sheet')) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 120);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [keyboard, open]);

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

  const changeKind = useCallback(
    (index: number) => {
      const nextKind = CREATE_KINDS_V2[index];
      if (!nextKind || nextKind === activeKind) return;
      const currentNav = navs.get(activeKind);
      currentNav?.flushDraft();
      haptic('selection');
      setKindIndex(index);
      setDetail(null);
    },
    [activeKind, haptic, navs],
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
      setDetail(null);
      // Une nouvelle création dans le même montage doit pouvoir re-remonter
      // l'île de succès (enchaînement Club → Sortie, Kit → Sortie).
      finishedRef.current = false;
      onCreateRequested?.(kind, prefill);
    },
    [kindIndex, navs, onCreateRequested],
  );

  const flushAllDrafts = useCallback(() => {
    navs.forEach((nav) => nav.flushDraft());
  }, [navs]);

  const closeNow = useCallback(() => {
    flushAllDrafts();
    setConfirmClose(false);
    setIsland(null);
    setDetail(null);
    onClose();
  }, [flushAllDrafts, onClose]);

  /**
   * FID-035 — la maquette confirme la fermeture dès que `CRE.dirty()` est vrai
   * **tous types confondus** (HTML L1988-1993), pas seulement le type affiché.
   * `activeNav.hasContent` ne voit que le type courant : on interroge aussi les
   * brouillons des cinq autres types (mémoire vive, puis localStorage).
   */
  const dirtyKinds = useMemo(
    () =>
      CREATE_KINDS_V2.filter((kind) =>
        kind === activeKind ? Boolean(activeNav?.hasContent) : hasDraftContentV2(kind),
      ),
    [activeKind, activeNav?.hasContent],
  );

  const requestClose = useCallback(() => {
    if (island) return;
    if (detail) {
      setDetail(null);
      return;
    }
    if (activeNav?.busy) return;
    if (dirtyKinds.length > 0) {
      activeNav?.flushDraft();
      setConfirmClose(true);
      haptic('medium');
      return;
    }
    closeNow();
  }, [activeNav, closeNow, detail, dirtyKinds.length, haptic, island]);

  /**
   * FID-033 — maquette `finish()` → `startSheetClose()` (HTML L1991) : la
   * feuille se ferme **derrière** l'île de succès, qui reste au-dessus du fil.
   * Le formulaire du moteur est remis à neuf juste après l'envoi (même frame) ;
   * `onCreated` rafraîchit le fil et ferme le tiroir côté page.
   */
  const closeBehindIsland = useCallback(
    (kind: CreateKindV2) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onCreated(kind);
    },
    [onCreated],
  );

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
      if (finishedRef.current) return;
      finishedRef.current = true;
      flushDraftV2(kind);
      onCreated(kind);
    },
    [onCreated],
  );

  const reportCreated = useCallback(
    (kind: CreateKindV2, result: CreateSuccessV2) => {
      haptic('success');
      if (kind === 'sortie' && prefillByKind.sortie?.returnToPostEvent) {
        keepOpenRef.current = true;
        setPrefillByKind((current) => {
          const prevSortie = current.sortie ?? {};
          const { returnToPostEvent: _consumed, ...restSortie } = prevSortie;
          return {
            ...current,
            sortie: restSortie,
          };
        });
        toast.success('Sortie créée et rattachée à ton événement.');
        requestCreate('post', {
          format: 'event',
          linkedEventId: result.id,
          linkedEventTitle: result.name ?? '',
          eventDate:
            typeof result.extra?.eventDate === 'string' ? result.extra.eventDate : undefined,
          location:
            typeof result.extra?.eventLocation === 'string' && result.extra.eventLocation
              ? result.extra.eventLocation
              : undefined,
          step: 1,
        });
        return;
      }
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
                    : 'Dans le fil de la communauté.',
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
      if (kind === 'kit') {
        base.undoLabel = 'Utiliser pour une sortie';
        base.undo = () => {
          keepOpenRef.current = true;
          setIsland(null);
          requestCreate('sortie', {
            kitId: result.id,
            kitName: result.name ?? '',
          });
        };
      }
      setIsland(base);
      // L'île est posée : la feuille se referme derrière elle (FID-033).
      closeBehindIsland(kind);
    },
    [closeBehindIsland, config.successTitle, finishCreated, haptic, prefillByKind.sortie, requestCreate, router],
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

  const stepHostsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [, bumpHostsVersion] = useState(0);
  const attachStepHost = useCallback((stepIndex: number, element: HTMLDivElement | null) => {
    if (stepHostsRef.current[stepIndex] === element) return;
    stepHostsRef.current[stepIndex] = element;
    if (element) {
      queueMicrotask(() => bumpHostsVersion((version) => version + 1));
    }
  }, []);
  const miniPages = useMemo(
    () =>
      CREATE_KINDS_V2.map((kind, index) =>
        index === kindIndex
          ? config.steps.map((step, stepIndex) => (
              <div
                key={`${kind}-${step.id}`}
                ref={(element) => attachStepHost(stepIndex, element)}
                className="lkdv-cv2c-step-host"
                data-step-host={stepIndex}
              />
            ))
          : [],
      ),
    [attachStepHost, config.steps, kindIndex],
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
      pages: miniPages,
    };
  }, [activeKind, activeNav, config.steps, miniPages]);

  const footer = activeNav ? (
    <div className="lkdv-cv2c-footbar">
      {activeNav.serverError ? (
        <p className="lkdv-cv2c-server" role="alert">
          {activeNav.serverError}
        </p>
      ) : null}
      <LayoutGroup id="cv2c-foot-actions-group">
        <motion.div
          layout
          className="lkdv-cv2c-foot-actions lkdv-cv2c-foot-actions--compact"
          transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {activeNav.canBack ? (
              <motion.button
                key="cv2c-back-btn"
                layout
                type="button"
                className="lkdv-cv2-pill lkdv-cv2-pill--secondary lkdv-cv2c-back lkdv-cv2c-back--icon"
                aria-label="Retour"
                onClick={activeNav.goBack}
                disabled={activeNav.busy}
                initial={{ opacity: 0, x: 34, scale: 0.6 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 34, scale: 0.6 }}
                transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'relative', zIndex: 1 }}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </motion.button>
            ) : null}
          </AnimatePresence>
          <motion.button
            key="cv2c-next-btn"
            layout="position"
            type="button"
            className="lkdv-cv2-pill lkdv-cv2-pill--primary lkdv-cv2c-next"
            onClick={activeNav.goNext}
            disabled={activeNav.busy || !user}
            aria-busy={activeNav.busy || undefined}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'relative', zIndex: 2 }}
          >
            {activeNav.busy
              ? 'Envoi…'
              : activeNav.busyLabel ??
                (activeNav.stepIndex >= activeNav.stepCount - 1
                  ? activeNav.serverError
                    ? 'Réessayer'
                    : activeNav.finalLabel
                  : 'Suivant')}
            <ChevronRight size={15} aria-hidden="true" />
          </motion.button>
        </motion.div>
      </LayoutGroup>
    </div>
  ) : null;

  const activeFormByKind: Record<CreateKindV2, React.ReactNode> = {
    post: (
      <PostFormV2
        active={activeKind === 'post'}
        prefill={prefillByKind.post}
        prefillNonce={prefillNonce}
        onNavChange={reportNav.get('post')!}
        stepHosts={stepHostsRef.current}
      />
    ),
    story: (
      <StoryFormV2
        active={activeKind === 'story'}
        prefill={prefillByKind.story}
        prefillNonce={prefillNonce}
        onNavChange={reportNav.get('story')!}
        stepHosts={stepHostsRef.current}
      />
    ),
    sortie: (
      <SortieFormV2
        active={activeKind === 'sortie'}
        prefill={prefillByKind.sortie}
        prefillNonce={prefillNonce}
        onNavChange={reportNav.get('sortie')!}
        stepHosts={stepHostsRef.current}
      />
    ),
    club: (
      <ClubFormV2
        active={activeKind === 'club'}
        prefill={prefillByKind.club}
        prefillNonce={prefillNonce}
        onNavChange={reportNav.get('club')!}
        stepHosts={stepHostsRef.current}
      />
    ),
    kit: (
      <KitFormV2
        active={activeKind === 'kit'}
        prefill={prefillByKind.kit}
        prefillNonce={prefillNonce}
        onNavChange={reportNav.get('kit')!}
        stepHosts={stepHostsRef.current}
      />
    ),
    carnet: (
      <CarnetFormV2
        active={activeKind === 'carnet'}
        prefill={prefillByKind.carnet}
        prefillNonce={prefillNonce}
        onNavChange={reportNav.get('carnet')!}
        stepHosts={stepHostsRef.current}
      />
    ),
  };

  // La coque ignorera `panes` (mini.pages fourni) ; on conserve un repli neutre.
  const panes = CREATE_KINDS_V2.map((kind) => <div key={kind} data-kind={kind} />);

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
      action={island.action && island.actionLabel ? { label: island.actionLabel, onAction: island.action } : undefined}
      undo={island.undo && island.undoLabel ? { label: island.undoLabel, onUndo: island.undo } : undefined}
      onClose={() => {
        const stay = keepOpenRef.current || Boolean(island.stayOpen);
        keepOpenRef.current = false;
        setIsland(null);
        if (!stay) finishCreated(island.kind);
      }}
    />
  ) : null;

  const usesPreviewSlot =
    activeKind === 'post' ||
    activeKind === 'story' ||
    activeKind === 'carnet' ||
    activeKind === 'sortie' ||
    activeKind === 'club' ||
    activeKind === 'kit';

  return (
    <CreateSheetContext.Provider value={contextValue}>
      <SheetPreviewContext.Provider value={usesPreviewSlot ? previewSlot : null}>
        <CommunitySheetShell
          open={open}
          onClose={requestClose}
          kind="create"
          guestNotice={isGuest}
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
          previewSlotRef={usesPreviewSlot ? setPreviewSlot : undefined}
        >
          <div className="lkdv-cv2c-form-mount" data-kind={activeKind}>
            {activeFormByKind[activeKind]}
          </div>
          <Toaster
            position="top-center"
            richColors
            offset="max(11px, calc(env(safe-area-inset-top, 0px) - 48px))"
            toastOptions={{
              className: 'lkdv-island-toast',
            }}
          />
          <ConfirmDialogV2
            open={confirmClose}
            title="Fermer sans publier ?"
            // Message **générique** de la maquette (L1990), sans type interpolé
            // (FID-061) ; il ne cite pas non plus le brouillon d'un autre type.
            text="Ton brouillon est conservé sur cet appareil. Tu pourras reprendre où tu t’es arrêté."
            cancelLabel="Continuer l’édition"
            confirmLabel="Fermer"
            // Hiérarchie de la maquette `lkvConfirm(..., danger=true)` L1759 :
            // action sûre à gauche (focus initial), « Fermer » en danger à droite.
            danger
            testId="cv2c-close-confirm"
            onCancel={() => setConfirmClose(false)}
            onConfirm={() => closeNow()}
          />
        </CommunitySheetShell>
      </SheetPreviewContext.Provider>
    </CreateSheetContext.Provider>
  );
}

export default CreateSheetV2;
