'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { cog, cogState } from '../domain/balance';
import { blockers, readiness } from '../domain/blockers';
import { totals } from '../domain/totals';
import { setStudioData } from '../domain/studioData';
import type { StudioData } from '../domain/studioData';
import { useKitStore } from '../store/kitStore';
import { AUTO_OPEN_MS, useUiStore } from '../store/uiStore';
import { setStudioSyncHandler } from '../services/studioSync';
import { saveStudioCache } from '../services/studioOffline';
import { createStudioSyncHandler } from './studioSyncClient';
import { CardsSlot } from './cards/CardsSlot';
import { SheetHost } from './SheetHost';
import { getScene } from '../scene/sceneRef';
import { Dock } from './Drawer/Dock';
import { OfflineContext, useOffline } from './offline';
import { Pill } from './Pill';
import { S, pillLabel } from './strings';
import './kit-studio.css';
import './route.css';

const SceneView = dynamic(() => import('../scene/SceneView'), { ssr: false, loading: () => null });

const SHEET_TITLES = {
  bilan: S.bilan.title,
  item: S.item.title,
  part: S.item.title,
  bag: S.bag.title,
  order: S.order.title,
  deck: S.deck.title,
} as const;

/**
 * Mode d'affichage du studio :
 * - `debug` : mode démonstration explicite (`?debug=1`), jeu de test + stockage local ;
 * - `server` : données réelles lues côté serveur, écritures synchronisées ;
 * - `offline` : dernier cache serveur RÉEL (base indisponible), écritures locales seulement.
 * Aucun mode ne retombe sur la démonstration par défaut.
 */
export type StudioClientMode = 'debug' | 'server' | 'offline';

export type KitStudioClientProps =
  | { readonly mode: 'debug'; readonly onExit?: () => void }
  | { readonly mode: 'server'; readonly initialData: StudioData; readonly onExit?: () => void }
  | { readonly mode: 'offline'; readonly initialData: StudioData; readonly onExit?: () => void };

const bannerStyle = {
  position: 'absolute',
  top: 'calc(var(--safe-top) + 12px)',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 80,
  padding: '6px 14px',
  minHeight: 32,
  borderRadius: 999,
  border: '1px solid var(--lkv-forest-200)',
  background: 'var(--lkv-stone-50)',
  color: 'var(--lkv-forest-900)',
  font: 'inherit',
  fontSize: 12,
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
} as const;

/** Écran unique : scène 3D plein écran + pilule du poids + tiroir. */
function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function KitStudioClient(props: KitStudioClientProps) {
  const { mode, onExit } = props;
  const initialData = props.mode === 'debug' ? null : props.initialData;
  const router = useSafeRouter();
  const { haptic } = useHapticFeedback();
  const offline = useOffline();
  const dockRef = useRef<HTMLElement | null>(null);
  const kit = useKitStore((s) => s.kit);
  const hydrated = useKitStore((s) => s.hydrated);
  const sync = useKitStore((s) => s.sync);
  const retry = useKitStore((s) => s.retry);
  const dockOpen = useUiStore((s) => s.dockOpen);
  const view = useUiStore((s) => s.view);
  const sheet = useUiStore((s) => s.sheet);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else if (router) {
      router.push('/hub');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/hub';
    }
  }, [onExit, router]);

  // La barre de navigation basse (bottom bar) est formellement interdite sur Kit Studio
  useEffect(() => {
    document.documentElement.setAttribute('data-kit-studio-open', 'true');
    document.body.setAttribute('data-kit-studio-open', 'true');
    window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: true } }));

    try {
      // Masquage proactif de la tab bar native Capacitor iOS
      const { registerPlugin, Capacitor } = require('@capacitor/core');
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        const bar = registerPlugin('LKDVAccountTabBar');
        bar?.setVisible?.({ visible: false, revision: Date.now() })?.catch?.(() => undefined);
      }
    } catch (_e) {
      // Ignore si Capacitor n'est pas présent dans l'environnement courant
    }

    return () => {
      document.documentElement.removeAttribute('data-kit-studio-open');
      document.body.removeAttribute('data-kit-studio-open');
      window.dispatchEvent(new CustomEvent('lkdv-toggle-bottom-bar', { detail: { hide: false } }));
    };
  }, []);

  // Sortie et retour au camp par mouvement de glissement vers la droite (swipe right)
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();

      const target = e.target instanceof Element ? e.target : null;
      const insideSlider = Boolean(target?.closest('input, textarea, select, .ks-card-rail'));

      // Glissement vers la droite admissible depuis :
      // - le bord gauche (startX <= 140px, standard geste retour)
      // - la zone haute (startY <= 240px, zone du bandeau / ancien bouton)
      // - n'importe où hors d'un slider ou élément à défilement horizontal
      if (!insideSlider && (startX <= 140 || startY <= 240)) {
        tracking = true;
      } else {
        tracking = false;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = performance.now() - startTime;

      // Geste vers la droite : dx > 0, trajectoire dominante horizontale
      const isFlick = dt < 400 && dx >= 45;
      const isSustained = dx >= 75;
      const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.15;

      if ((isFlick || isSustained) && isHorizontal) {
        haptic('medium');
        handleExit();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleExit, haptic]);

  useEffect(() => {
    // Bootstrap : la donnée du mode remplace le registre AVANT l'hydratation du store.
    // - debug : jeu de démonstration explicite (aucune donnée réelle) ;
    // - server/offline : donnée réelle (serveur ou dernier cache synchronisé).
    setStudioData(mode === 'debug' ? null : initialData);
    // Le cache local n'est alimenté que par une vraie réponse serveur (jamais en debug).
    if (mode === 'server' && initialData) saveStudioCache(initialData);
    setStudioSyncHandler(mode === 'server' ? createStudioSyncHandler() : null);
    void useKitStore.getState().hydrate();
    return () => {
      setStudioSyncHandler(null);
      void useKitStore.getState().flush();
    };
  }, [mode, initialData]);

  // Ouverture automatique à 750 ms, sauf si la personne a déjà agi (tout setter de l'UI annule le jeton).
  useEffect(() => {
    const token = useUiStore.getState().armOpen();
    const t = setTimeout(() => {
      if (useUiStore.getState().commitOpen(token)) haptic('light');
    }, AUTO_OPEN_MS);
    return () => {
      clearTimeout(t);
      useUiStore.getState().cancelOpen();
    };
  }, [haptic]);

  const closeDock = useCallback(() => {
    const ui = useUiStore.getState();
    ui.closeSheet();
    ui.setView('cards');
    ui.setDockOpen(false);
    haptic('light');
  }, [haptic]);

  // Échap en chaîne : feuille ou vue → cartes, puis tiroir → fermé.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const ui = useUiStore.getState();
      if (ui.sheet || ui.view !== 'cards') {
        e.stopPropagation();
        ui.closeSheet();
        ui.setView('cards');
        haptic('selection');
      } else if (ui.dockOpen) {
        e.stopPropagation();
        closeDock();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [haptic, closeDock]);

  // Pilule : ouvre le Bilan, ou le referme si c'est déjà lui qui est affiché (maquette pillTap).
  const openBilan = () => {
    const ui = useUiStore.getState();
    if (ui.view === 'sheet' && ui.sheet?.kind === 'bilan') {
      ui.closeSheet();
      ui.setView('cards');
      haptic('light');
      return;
    }
    ui.openSheet('bilan');
    ui.setView('sheet');
    ui.setDockOpen(true);
    haptic('light');
  };

  // En production (serveur ou cache hors-ligne), l'écran n'est monté qu'une fois le store
  // hydraté avec les données réelles : aucun rendu intermédiaire avec le jeu de démonstration.
  // Le mode démo, lui, peut rendre immédiatement (c'est son objet).
  if (mode !== 'debug' && !hydrated) {
    return <div className="ks-root ks-stage" aria-busy="true" data-mode={mode} />;
  }

  const bl = blockers(kit);
  // `totals` compte en grammes ; la pilule affiche des kilos (maquette : wt(bagWeight())).
  const kg = totals(kit).onBack / 1000;
  const ready = readiness(bl, cogState(cog(kit)));
  const label = view === 'deck' ? S.deck.title : sheet ? SHEET_TITLES[sheet.kind] : S.cards.addToBag;

  return (
    <OfflineContext.Provider value={offline}>
      <div className="ks-root ks-stage" data-offline={offline || undefined} data-sync={sync} data-mode={mode}>
        <SceneView />
        <Pill
          kg={kg}
          ratio={ready / 100}
          alerts={bl.length}
          open={dockOpen}
          dockRef={dockRef}
          viewKey={view}
          label={pillLabel(kg, bl.length)}
          onClick={openBilan}
        />
        {mode === 'debug' ? (
          <div role="status" data-testid="studio-mode-banner" style={bannerStyle}>
            Mode démo · données fictives
          </div>
        ) : null}
        {mode === 'offline' ? (
          <div role="status" data-testid="studio-mode-banner" style={bannerStyle}>
            Hors ligne · dernière donnée synchronisée
          </div>
        ) : null}
        {sync === 'error' ? (
          <button
            type="button"
            onClick={() => void retry()}
            aria-live="polite"
            style={{
              ...bannerStyle,
              pointerEvents: 'auto',
              cursor: 'pointer',
              minHeight: 44,
              padding: '8px 14px',
              fontSize: 13,
              border: '1px solid var(--lkv-danger)',
              background: 'var(--lkv-danger-bg)',
              color: 'var(--lkv-danger-dark)',
            }}
          >
            Non enregistré · réessaie
          </button>
        ) : null}
        <Dock open={dockOpen} label={label} onClose={closeDock} dockRef={dockRef}>
          {view === 'cards' ? (
            <CardsSlot
              projectZone={(z) => getScene()?.projectZone(z) ?? null}
              highlightZone={(z) => getScene()?.highlightZone(z)}
            />
          ) : (
            <SheetHost />
          )}
        </Dock>
      </div>
    </OfflineContext.Provider>
  );
}
