'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { cog, cogState } from '../domain/balance';
import { blockers, readiness } from '../domain/blockers';
import { totals } from '../domain/totals';
import { setStudioData } from '../domain/studioData';
import type { StudioData } from '../domain/studioData';
import { useKitStore } from '../store/kitStore';
import { AUTO_OPEN_MS, useUiStore } from '../store/uiStore';
import { setStudioSyncHandler } from '../services/studioSync';
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

export interface KitStudioClientProps {
  /** Données réelles lues côté serveur (`getStudioData`). Absent/null = repli local de démonstration. */
  readonly initialData?: StudioData | null;
}

/** Écran unique : scène 3D plein écran + pilule du poids + tiroir. */
export function KitStudioClient({ initialData = null }: KitStudioClientProps) {
  const { haptic } = useHapticFeedback();
  const offline = useOffline();
  const dockRef = useRef<HTMLElement | null>(null);
  const kit = useKitStore((s) => s.kit);
  const sync = useKitStore((s) => s.sync);
  const retry = useKitStore((s) => s.retry);
  const dockOpen = useUiStore((s) => s.dockOpen);
  const view = useUiStore((s) => s.view);
  const sheet = useUiStore((s) => s.sheet);

  useEffect(() => {
    // Bootstrap : la donnée serveur remplace le registre AVANT l'hydratation du store, puis le
    // handler d'écriture serveur est installé (aucun handler = mode local/hors-ligne, zéro réseau).
    if (initialData) setStudioData(initialData);
    setStudioSyncHandler(createStudioSyncHandler());
    void useKitStore.getState().hydrate();
    return () => {
      setStudioSyncHandler(null);
      void useKitStore.getState().flush();
    };
  }, [initialData]);

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

  const bl = blockers(kit);
  // `totals` compte en grammes ; la pilule affiche des kilos (maquette : wt(bagWeight())).
  const kg = totals(kit).onBack / 1000;
  const ready = readiness(bl, cogState(cog(kit)));
  const label = view === 'deck' ? S.deck.title : sheet ? SHEET_TITLES[sheet.kind] : S.cards.addToBag;

  return (
    <OfflineContext.Provider value={offline}>
      <div className="ks-root ks-stage" data-offline={offline || undefined} data-sync={sync}>
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
        {sync === 'error' ? (
          <button
            type="button"
            onClick={() => void retry()}
            aria-live="polite"
            style={{
              position: 'absolute',
              top: 'calc(var(--safe-top) + 12px)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 80,
              padding: '8px 14px',
              minHeight: 44,
              borderRadius: 999,
              border: '1px solid var(--lkv-danger)',
              background: 'var(--lkv-danger-bg)',
              color: 'var(--lkv-danger-dark)',
              font: 'inherit',
              fontSize: 13,
              letterSpacing: '0.02em',
              cursor: 'pointer',
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
