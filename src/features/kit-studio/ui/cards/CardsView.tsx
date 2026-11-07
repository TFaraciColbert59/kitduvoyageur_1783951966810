'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { BagId, ModuleId, PartNameId, ZoneId } from '../../domain/catalog';
import { toOrder } from '../../domain/order';
import { useKitStore } from '../../store/kitStore';
import { useUiStore } from '../../store/uiStore';
import { OrderButton } from '../OrderButton';
import { Strip } from '../Drawer/Strip';
import { S } from '../strings';
import { Thumb } from '../Thumb';
import { Glyph } from '../Glyph';
import { Card } from './Card';
import { CardRail, PageDots } from './CardRail';
import { CategoryCapsule } from './CategoryCapsule';
import { FamilyCapsule } from './FamilyCapsule';
import { ModeCapsule } from './ModeCapsule';
import { addCard, catsFor, colorValue, contentCards, optionCards } from './cardsData';
import type { CardModel, OptionCat } from './cardsData';
import { getScene, subscribeScene } from '../../scene/sceneRef';
import { useCardGestures } from './useCardGestures';
import './cards.css';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface CardsViewProps {
  /** Zone du sac dont on propose les objets (défaut : tout le sac). */
  zone?: ZoneId;
  /** Position écran d'une zone du sac (vol et atterrissage). Fournie par la scène. */
  projectZone?: (zone: ZoneId) => ScreenPoint | null;
  /** Éclaire la zone visée pendant le glisser ; null l'éteint. Fournie par la scène. */
  highlightZone?: (zone: ZoneId | null) => void;
  /** Ajout d'un objet à l'inventaire (carte « Ajouter »). */
  onAdd?: () => void;
}

const BLINK_MS = 700;
const LAND_MS = 320;

interface Landing {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly to: ScreenPoint | null;
}

/** Zone visée par une carte (maquette targetZoneFor, l.1601). */
function targetZone(card: CardModel | undefined, zone: ZoneId): ZoneId {
  if (!card || card.kind === 'bag') return 'bag';
  const zs = card.zones ?? [];
  return zs.includes(zone) ? zone : (zs[0] ?? 'bag');
}

/** Contenu du tiroir en vue Cartes : rail, capsules de mode et de familles/options, glisser vers le sac. */
export function CardsView({ zone = 'bag', projectZone, highlightZone, onAdd }: CardsViewProps) {
  const { haptic } = useHapticFeedback();
  const kit = useKitStore((s) => s.kit);
  const canUndo = useKitStore((s) => s.canUndo);
  const mode = useUiStore((s) => s.mode);
  const family = useUiStore((s) => s.family);
  const category = useUiStore((s) => s.category);
  const partRaw = useUiStore((s) => s.part);
  const part = (partRaw ?? 'all') as PartNameId;

  const cats = catsFor(part);
  const cat: OptionCat = (cats as readonly string[]).includes(category ?? '') ? (category as OptionCat) : cats[0];

  const [sceneRev, setSceneRev] = useState(0);
  useEffect(() => {
    return subscribeScene(() => setSceneRev((r) => r + 1));
  }, []);

  const cards = useMemo<readonly CardModel[]>(() => {
    void sceneRev;
    if (mode === 'appearance') return optionCards(kit, part, cat);
    const list = contentCards(kit, zone, family);
    return list.length ? list : [addCard()];
  }, [mode, kit, part, cat, zone, family, sceneRev]);

  const [page, setPage] = useState(0);
  const [blink, setBlink] = useState<string | null>(null);
  const [landing, setLanding] = useState<Landing | null>(null);
  const rail = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const byId = useRef(new Map<string, CardModel>());
  byId.current = new Map(cards.map((c) => [c.id, c]));

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current.push(id);
  };

  const refuse = useCallback(
    (id: string) => {
      setBlink(id);
      haptic('warning');
      later(() => setBlink((b) => (b === id ? null : b)), BLINK_MS);
    },
    [haptic],
  );

  /** Valide une carte (toucher, clavier ou dépôt). */
  const commit = useCallback(
    (card: CardModel): boolean => {
      const store = useKitStore.getState();
      if (card.kind === 'add') {
        onAdd?.();
        return true;
      }
      if (card.disabled) {
        refuse(card.id);
        return false;
      }
      if (mode === 'content') {
        if (card.kind === 'bag') {
          const r = store.setBag(card.id as BagId);
          if (!r.ok) refuse(card.id);
          else haptic('medium');
          return r.ok;
        }
        const r = store.pack(card.id, targetZone(card, zone));
        if (!r.ok) refuse(card.id);
        else haptic('light');
        return r.ok;
      }
      if (card.selected && cat !== 'mod') {
        haptic('selection');
        return false;
      }
      if (cat === 'shape') {
        const r = store.setBag(card.id as BagId);
        if (!r.ok) refuse(card.id);
        else haptic('medium');
        return r.ok;
      }
      if (cat === 'mod') {
        const scene = getScene();
        if (scene && typeof scene.attachModule === 'function') {
          const ctrl = scene.getAttachments?.();
          const isMounted = ctrl?.listAnchors().some((a) => ctrl.getMountedModule(a.id)?.moduleId === card.id);
          if (isMounted) {
            scene.detachModule(card.id);
            haptic('light');
            return true;
          }
          scene.attachModule(card.id).then((res) => {
            if (res.ok) {
              haptic('medium');
            } else {
              refuse(card.id);
            }
          });
          return true;
        }
      }
      const value = cat === 'col' ? colorValue(part, card.id) : (card.id as ModuleId);
      const r = store.setPartOption(part, cat, value);
      if (!r.ok) refuse(card.id);
      else haptic(cat === 'mod' ? 'medium' : 'selection');
      return r.ok;
    },
    [mode, zone, cat, part, haptic, refuse, onAdd],
  );

  const gestures = useCardGestures({
    mode,
    getRail: () => rail.current,
    liftable: (kind, id) => kind !== 'add' && !byId.current.get(id)?.disabled,
    onLiftStart: (kind, id) => {
      highlightZone?.(targetZone(byId.current.get(id), zone));
      haptic('light');
      void kind;
    },
    onArmChange: () => haptic('selection'),
    onDrop: (kind, id, armed, x, y) => {
      const card = byId.current.get(id);
      const z = targetZone(card, zone);
      highlightZone?.(null);
      if (armed && card) {
        const ok = commit(card);
        if (ok) {
          setLanding({ id, kind, x, y, to: projectZone?.(z) ?? null });
          later(() => setLanding(null), LAND_MS);
          return;
        }
      }
      const el = rail.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
      const r = el?.getBoundingClientRect();
      setLanding({ id, kind, x, y, to: r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null });
      later(() => setLanding(null), LAND_MS);
    },
    onLiftCancel: () => highlightZone?.(null),
    onTryStart: (id) => {
      const card = byId.current.get(id);
      if (!card || card.disabled || cat === 'shape' || (card.selected && cat !== 'mod')) {
        if (card?.disabled) refuse(id);
        return false;
      }
      return commit(card);
    },
    onTryEnd: (id, keep) => {
      if (keep) {
        haptic('medium');
        return;
      }
      useKitStore.getState().undo();
      haptic('light');
      void id;
    },
  });

  const onActivate = useCallback(
    (card: CardModel) => {
      if (gestures.consumeClick()) return;
      commit(card);
    },
    [commit, gestures],
  );

  const railKey = `${mode}:${mode === 'content' ? (family ?? '') : `${part}:${cat}`}`;
  const focusIndex = mode === 'appearance' ? Math.max(0, cards.findIndex((c) => c.selected)) : 0;
  const pending = mode === 'appearance' && toOrder(kit).length > 0;
  const label =
    mode === 'appearance' ? `${S.categories[cat]}` : `${S.cards.addToBag}${family ? ` · ${family}` : ''}`;
  const fly = gestures.lift ?? null;
  const flyCard = fly ? byId.current.get(fly.id) : landing ? byId.current.get(landing.id) : undefined;

  return (
    <>
      <div className="ks-cards" data-mode={mode}>
        <CardRail
          key={railKey}
          label={label}
          count={cards.length}
          onPageChange={setPage}
          focusIndex={focusIndex}
          railRef={(el) => {
            rail.current = el;
          }}
          onPointerDown={gestures.onPointerDown}
        >
          {cards.map((c) => (
            <Card
              key={c.id}
              card={c}
              pressable={mode === 'appearance'}
              blink={blink === c.id}
              trying={gestures.trying === c.id}
              lifting={fly?.id === c.id}
              onActivate={onActivate}
            />
          ))}
        </CardRail>
        {pending ? <OrderButton state={kit} onClick={() => useUiStore.getState().openSheet('order')} /> : null}
      </div>

      <Strip>
        <ModeCapsule
          mode={mode}
          onChange={(m) => {
            setPage(0);
            useUiStore.getState().setMode(m);
          }}
          canUndo={canUndo}
          onUndo={() => {
            if (useKitStore.getState().undo()) haptic('light');
          }}
        />
        <PageDots count={cards.length} page={page} />
        {mode === 'content' ? (
          <FamilyCapsule
            value={family}
            onChange={(f) => {
              setPage(0);
              useUiStore.getState().setFamily(f);
            }}
          />
        ) : (
          <CategoryCapsule
            cats={cats}
            value={cat}
            onChange={(c) => {
              setPage(0);
              useUiStore.getState().setCategory(c);
            }}
          />
        )}
      </Strip>

      {(fly || landing) && flyCard ? (
        <div
          className={`ks-flyer${fly?.armed ? ' ks-flyer--armed' : ''}${landing && !fly ? ' ks-flyer--land' : ''}`}
          aria-hidden="true"
          style={{
            transform: fly
              ? `translate(${fly.x}px, ${fly.y}px) translate(-50%, -50%) scale(${fly.armed ? 1.12 : 1})`
              : landing?.to
                ? `translate(${landing.to.x}px, ${landing.to.y}px) translate(-50%, -50%) scale(.3)`
                : `translate(${landing?.x ?? 0}px, ${landing?.y ?? 0}px) translate(-50%, -50%) scale(.3)`,
            opacity: landing && !fly ? 0.1 : 1,
          }}
        >
          {flyCard.thumb ? (
            <Thumb
              thumbKey={flyCard.thumb.key}
              spec={flyCard.thumb.spec}
              fallback={<Glyph name={flyCard.glyph} size={40} />}
            />
          ) : (
            <Glyph name={flyCard.glyph} size={40} />
          )}
        </div>
      ) : null}
    </>
  );
}
