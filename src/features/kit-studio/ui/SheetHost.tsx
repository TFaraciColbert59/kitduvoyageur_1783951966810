'use client';
import { useCallback } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { createDeck } from '../domain/deck';
import type { DeckKind } from '../domain/deck';
import { getItem } from '../domain/state';
import type { KitState } from '../domain/types';
import type { ZoneId } from '../domain/catalog';
import { useKitStore } from '../store/kitStore';
import { useUiStore } from '../store/uiStore';
import { useOffline } from './offline';
import { BagSheet } from './sheets/BagSheet';
import { BilanSheet } from './sheets/BilanSheet';
import type { BilanIntent } from './sheets/BilanSheet';
import { DeckSheet } from './sheets/DeckSheet';
import { ItemSheet } from './sheets/ItemSheet';
import type { ItemIntent } from './sheets/ItemSheet';
import { OrderSheet } from './sheets/OrderSheet';
import './sheets/sheets.css';
import './sheets/bilan.css';
import './sheets/deck.css';

/**
 * Contenu du tiroir hors vue Cartes (maquette Kit_Studio_v2.html : .vsheet / .vdeck).
 * Les feuilles sont contrôlées : elles produisent un état ou une intention, l'hôte applique.
 */
export function SheetHost() {
  const { haptic } = useHapticFeedback();
  const offline = useOffline();
  const kit = useKitStore((s) => s.kit);
  const apply = useKitStore((s) => s.apply);
  const view = useUiStore((s) => s.view);
  const sheet = useUiStore((s) => s.sheet);
  const deck = useUiStore((s) => s.deck);
  const page = sheet?.page ?? 0;

  const back = useCallback(() => {
    const ui = useUiStore.getState();
    ui.closeSheet();
    ui.setDeck(null);
    ui.setView('cards');
    haptic('light');
  }, [haptic]);

  const startDeck = useCallback(
    (kind: DeckKind) => {
      const ui = useUiStore.getState();
      ui.setDeck(createDeck(useKitStore.getState().kit, kind));
      ui.setView('deck');
      haptic('medium');
    },
    [haptic],
  );

  const onPage = useCallback((p: number) => useUiStore.getState().setSheetPage(p), []);

  if (view === 'deck' && deck) {
    return (
      <div className="ks-sheetview">
        <DeckSheet
          state={kit}
          deck={deck}
          onDeck={(d) => useUiStore.getState().setDeck(d)}
          onState={(n) => apply(n)}
          onQuit={back}
        />
      </div>
    );
  }

  if (view !== 'sheet' || !sheet) return null;

  if (sheet.kind === 'bilan') {
    return (
      <div className="ks-sheetview">
        <BilanSheet
          state={kit}
          page={page}
          onPage={onPage}
          onBack={back}
          onAction={(n) => {
            const intent = n as BilanIntent;
            if (intent.type === 'deck') {
              startDeck(intent.deck);
              return;
            }
            if (intent.type === 'blocker') {
              if (intent.blocker.id) {
                useUiStore.getState().openSheet('item', intent.blocker.id);
                haptic('light');
              }
              return;
            }
            apply(n as KitState);
          }}
        />
      </div>
    );
  }

  if (sheet.kind === 'item' || sheet.kind === 'part') {
    if (!sheet.id) return null;
    const itemId = sheet.id;
    return (
      <div className="ks-sheetview">
        <ItemSheet
          state={kit}
          itemId={itemId}
          page={page}
          onPage={onPage}
          onBack={back}
          onAction={(n) => {
            const intent = n as ItemIntent;
            if (intent.type === 'pack') {
              const it = getItem(useKitStore.getState().kit, intent.id);
              const zone: ZoneId = it?.zones.includes('main') ? 'main' : ((it?.zones[0] ?? 'main') as ZoneId);
              useKitStore.getState().pack(intent.id, zone);
              return;
            }
            apply(n as KitState);
          }}
        />
      </div>
    );
  }

  if (sheet.kind === 'bag') {
    return (
      <div className="ks-sheetview">
        <BagSheet
          state={kit}
          onChange={(n) => apply(n)}
          onOpenOrder={() => useUiStore.getState().openSheet('order')}
          onCustomise={() => {
            useUiStore.getState().setMode('appearance');
            back();
          }}
          page={page}
          onPageChange={onPage}
        />
      </div>
    );
  }

  if (sheet.kind === 'order') {
    return (
      <div className="ks-sheetview">
        <OrderSheet
          state={kit}
          offline={offline}
          onConfirmOrder={(n) => {
            apply(n);
            haptic('medium');
          }}
          page={page}
          onPageChange={onPage}
        />
      </div>
    );
  }

  return null;
}
