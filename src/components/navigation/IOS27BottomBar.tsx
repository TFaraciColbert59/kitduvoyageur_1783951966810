'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';
import { triggerNativeHaptic } from '@/lib/native/haptics';
import { DESTINATIONS, type DestinationId } from '@/components/mobile-nav/destinationRegistry';
import { LIQUID_TAB_ICONS } from './liquidTabIcons';

/* ----------------------------------------------------------------------------
 * Barre d'onglets Liquid Glass — réplique web du `TabView` iOS 26/27
 * (Apple Music, Prime Video, App Store).
 *
 * Comportement natif reproduit :
 * 1. Au repos : plateau teinté discret derrière l'onglet actif, icône accent.
 * 2. Au toucher : le plateau « se soulève » et devient une LENTILLE de verre
 *    clair plus grande que la barre (elle déborde en haut, en bas et sur les
 *    cellules voisines) qui GROSSIT les icônes situées dessous.
 * 3. Déplacement : la lentille suit le doigt (glisser d'onglet en onglet) ou
 *    saute vers la cible au tap ; elle s'ÉTIRE dans le sens de la vitesse et
 *    s'aplatit (squash & stretch), avec un retour haptique à chaque onglet.
 * 4. Relâchement : elle se pose sur l'onglet, rebondit légèrement et se
 *    rétracte dans la barre en redevenant un plateau teinté.
 * -------------------------------------------------------------------------- */

const COUNT = DESTINATIONS.length;
const PAD = 4; // doit correspondre à --lg-p dans liquid-tabbar.css
const HUB_LONG_PRESS_MS = 550;

// Ressorts calibrés sur l'animation native (réponse ≈ 0,38 s, ζ ≈ 0,85).
const TRAVEL_SPRING = { stiffness: 420, damping: 34, mass: 0.9 };
// Soulèvement de la lentille : légèrement sous-amorti pour le « pop ».
const LIFT_SPRING = { stiffness: 520, damping: 29, mass: 0.8 };

export interface IOS27BottomBarProps {
  /** Onglet forcé (mode contrôlé : prévisualisation, tests). */
  activeTabId?: DestinationId;
  /** Appelé à chaque sélection validée. */
  onSelectTab?: (id: DestinationId) => void;
  /** Pastilles de notification par destination. */
  badges?: Partial<Record<DestinationId, number>>;
  /** Appui long sur Hub (sélecteur d'aventure). */
  onHubLongPress?: () => void;
  /** Glissement hors écran (lkdv-toggle-bottom-bar). */
  hidden?: boolean;
  /** `false` : la barre est rendue dans le flux (le parent la positionne). */
  floating?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Désactive le masquage automatique quand le clavier iOS s'ouvre. */
  disableKeyboardDetection?: boolean;
  /** En mode contrôlé, navigue quand même vers la route de l'onglet. */
  controlledNavigates?: boolean;
}

function resolveRouteIndex(pathname: string | null): number {
  if (!pathname) return -1;
  let best = -1;
  let bestLen = -1;
  DESTINATIONS.forEach((tab, i) => {
    for (const p of [tab.href, ...tab.matchPaths]) {
      if ((pathname === p || pathname.startsWith(`${p}/`)) && p.length > bestLen) {
        best = i;
        bestLen = p.length;
      }
    }
  });
  return best;
}

export function IOS27BottomBar({
  activeTabId,
  onSelectTab,
  badges,
  onHubLongPress,
  hidden = false,
  floating = true,
  className = '',
  style,
  disableKeyboardDetection = false,
  controlledNavigates = false,
}: IOS27BottomBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const controlled = activeTabId !== undefined;

  /* ---------- Onglet actif (contrôlé, optimiste ou issu de la route) ---------- */
  const [optimistic, setOptimistic] = useState<number | null>(null);
  useEffect(() => setOptimistic(null), [pathname]);

  const routeIndex = controlled
    ? DESTINATIONS.findIndex((t) => t.id === activeTabId)
    : resolveRouteIndex(pathname);
  const activeIndex = optimistic ?? routeIndex;

  /* ---------- Géométrie ---------- */
  const navRef = useRef<HTMLElement>(null);
  const [cellW, setCellW] = useState(0);
  const [innerW, setInnerW] = useState(0);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => {
      const inner = el.clientWidth - PAD * 2;
      cellWRef.current = inner / COUNT;
      setInnerW(inner);
      setCellW(inner / COUNT);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- Physique de la lentille ---------- */
  const xTarget = useMotionValue(0);
  const x = useSpring(xTarget, TRAVEL_SPRING);
  const liftTarget = useMotionValue(0);
  const lift = useSpring(liftTarget, LIFT_SPRING);
  const velocity = useVelocity(x);

  // Étirement dans le sens du mouvement + aplatissement (squash & stretch).
  const stretch = useTransform(velocity, (v) =>
    reduceMotion ? 1 : 1 + Math.min(Math.abs(v) / 2400, 0.42),
  );
  const squash = useTransform(velocity, (v) =>
    reduceMotion ? 1 : 1 - Math.min(Math.abs(v) / 9000, 0.14),
  );
  // Soulèvement : la lentille grossit et déborde de la barre (≈ +32 % / +44 %).
  const scaleX = useTransform([stretch, lift], ([s, l]: number[]) => s * (1 + 0.32 * l));
  const scaleY = useTransform([squash, lift], ([q, l]: number[]) => q * (1 + 0.44 * l));
  const tintOpacity = useTransform(lift, [0, 1], [1, 0]);
  const glassOpacity = useTransform(lift, [0, 0.35, 1], [0, 0.85, 1]);
  const counterX = useTransform(x, (v) => -v);
  // Grossissement uniforme des icônes vues dans la lentille : on annule
  // l'étirement horizontal pour que seul le zoom (scaleY) s'applique.
  const magScaleX = useTransform([scaleX, scaleY], ([sx, sy]: number[]) => sy / sx);
  const cellWRef = useRef(0);
  const magOrigin = useTransform(x, (v) => `${v + cellWRef.current / 2}px 50%`);

  const placedRef = useRef(false);
  const pressRef = useRef<{
    id: number;
    startX: number;
    moved: boolean;
    longFired: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const lastCommitRef = useRef<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Placement initial et après redimensionnement : sans animation.
  useEffect(() => {
    if (!cellW || activeIndex < 0) return;
    if (!placedRef.current) {
      xTarget.jump(activeIndex * cellW);
      x.jump(activeIndex * cellW);
      placedRef.current = true;
    }
  }, [cellW, activeIndex, x, xTarget]);

  useEffect(() => {
    if (!cellW || !placedRef.current) return;
    xTarget.jump(Math.max(activeIndex, 0) * cellW);
    x.jump(Math.max(activeIndex, 0) * cellW);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellW]);

  // Changement d'onglet venu d'ailleurs (route, mode contrôlé, clavier) :
  // même saut de lentille qu'au tap.
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!cellW || !placedRef.current || activeIndex < 0 || pressRef.current) return;
    if (lastCommitRef.current === activeIndex) {
      lastCommitRef.current = null;
      return;
    }
    xTarget.set(activeIndex * cellW);
    if (reduceMotion) {
      x.jump(activeIndex * cellW);
      return;
    }
    liftTarget.set(1);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => liftTarget.set(0), 240);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(
    () => () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      if (pressRef.current?.timer) clearTimeout(pressRef.current.timer);
    },
    [],
  );

  /* ---------- Clavier iOS ---------- */
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (disableKeyboardDetection || typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const base = window.innerHeight;
    const onResize = () => setKeyboardOpen(vv.height < base * 0.85);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, [disableKeyboardDetection]);

  /* ---------- Sélection ---------- */
  const commit = useCallback(
    (index: number) => {
      const tab = DESTINATIONS[index];
      if (!tab) return;
      lastCommitRef.current = index;
      onSelectTab?.(tab.id);
      if (controlled) {
        if (controlledNavigates && pathname !== tab.href) router.push(tab.href);
        return;
      }
      setOptimistic(index);
      if (pathname !== tab.href) router.push(tab.href);
    },
    [controlled, controlledNavigates, onSelectTab, pathname, router],
  );

  const fingerToX = (clientX: number) => {
    const rect = navRef.current!.getBoundingClientRect();
    const raw = clientX - rect.left - PAD - cellW / 2;
    return Math.min(Math.max(raw, 0), (COUNT - 1) * cellW);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || !cellW) return;
    navRef.current?.setPointerCapture(e.pointerId);
    const fx = fingerToX(e.clientX);
    const idx = Math.round(fx / cellW);
    const press = { id: e.pointerId, startX: e.clientX, moved: false, longFired: false, timer: null as ReturnType<typeof setTimeout> | null };
    if (idx === 0 && onHubLongPress) {
      press.timer = setTimeout(() => {
        press.longFired = true;
        triggerNativeHaptic('medium');
        onHubLongPress();
      }, HUB_LONG_PRESS_MS);
    }
    pressRef.current = press;
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    setHoverIndex(idx);
    if (!placedRef.current || activeIndex < 0) {
      // Aucun onglet actif (route hors barre) : la lentille naît sous le doigt.
      xTarget.jump(fx);
      x.jump(fx);
      placedRef.current = true;
    }
    if (!reduceMotion) liftTarget.set(1);
    xTarget.set(fx);
    if (idx !== activeIndex) triggerNativeHaptic('selection');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || press.id !== e.pointerId) return;
    if (!press.moved && Math.abs(e.clientX - press.startX) > 6) {
      press.moved = true;
      if (press.timer) clearTimeout(press.timer);
    }
    if (!press.moved) return;
    const fx = fingerToX(e.clientX);
    xTarget.set(fx);
    const idx = Math.round(fx / cellW);
    if (idx !== hoverIndex) {
      setHoverIndex(idx);
      triggerNativeHaptic('selection');
    }
  };

  const endPress = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const press = pressRef.current;
    if (!press || press.id !== e.pointerId) return;
    if (press.timer) clearTimeout(press.timer);
    pressRef.current = null;
    navRef.current?.releasePointerCapture?.(e.pointerId);
    const idx = cancelled || press.longFired ? Math.max(activeIndex, 0) : (hoverIndex ?? activeIndex);
    setHoverIndex(null);
    xTarget.set(idx * cellW);
    // La lentille reste soulevée le temps du trajet, puis se rétracte.
    pulseTimer.current = setTimeout(() => liftTarget.set(0), press.moved ? 60 : 200);
    if (!cancelled && !press.longFired && idx !== activeIndex) commit(idx);
    // Onglet déjà actif mais sur une sous-page (/carnets, /clubs, /pays, une fiche…) :
    // un appui ramène à la racine de la destination, comme la barre native. Sans cela
    // l'onglet de la section en cours restait muet partout sauf sur sa page d'accueil.
    else if (!cancelled && !press.longFired && DESTINATIONS[idx] && pathname !== DESTINATIONS[idx].href) commit(idx);
    else lastCommitRef.current = null;
  };

  const onLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, index: number) => {
    // Clic souris/tactile : déjà traité par les pointer events.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // La navigation passe toujours par commit() (router.push), jamais par le lien.
    e.preventDefault();
    if (e.detail === 0) commit(index); // activation clavier (Entrée)
  };

  if (keyboardOpen) return null;

  const displayIndex = hoverIndex ?? activeIndex;
  const ready = cellW > 0 && (activeIndex >= 0 || hoverIndex !== null);

  const renderIcon = (id: DestinationId, on: boolean) =>
    on ? LIQUID_TAB_ICONS[id].filled : LIQUID_TAB_ICONS[id].outline;

  return (
    <nav
      ref={navRef}
      aria-label="Navigation principale"
      className={[
        'lg-tabbar',
        floating ? '' : 'lg-tabbar--inline',
        hidden ? 'lg-tabbar--hidden' : '',
        className,
      ].join(' ')}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endPress(e, false)}
      onPointerCancel={(e) => endPress(e, true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="lg-tabbar__bg" aria-hidden="true" />

      {DESTINATIONS.map((tab, i) => {
        const on = i === displayIndex;
        const badge = badges?.[tab.id] ?? 0;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            prefetch={false}
            draggable={false}
            className={`lg-tab${on ? ' is-active' : ''}`}
            aria-current={i === activeIndex ? 'page' : undefined}
            aria-label={badge > 0 ? `${tab.ariaLabel} — ${badge} notification${badge > 1 ? 's' : ''}` : tab.ariaLabel}
            onClick={(e) => onLinkClick(e, i)}
          >
            {renderIcon(tab.id, on)}
            {badge > 0 && <span className="lg-badge" aria-hidden="true">{badge > 9 ? '9+' : badge}</span>}
          </Link>
        );
      })}

      {/* Lentille : plateau teinté au repos → verre clair grossissant au toucher */}
      <motion.span
        className="lg-lens"
        aria-hidden="true"
        style={{
          width: cellW || `calc((100% - ${PAD * 2}px) / ${COUNT})`,
          x,
          scaleX,
          scaleY,
          opacity: ready ? 1 : 0,
        }}
      >
        <motion.span className="lg-lens__glass" style={{ opacity: glassOpacity }} />
        <motion.span className="lg-lens__tint" style={{ opacity: tintOpacity }} />
        <span className="lg-lens__clip">
          <motion.span
            className="lg-lens__mag"
            style={{ width: innerW, x: counterX, scaleX: magScaleX, transformOrigin: magOrigin }}
          >
            {DESTINATIONS.map((tab, i) => (
              <span key={tab.id} className={`lg-mag-cell${i === displayIndex ? ' is-active' : ''}`}>
                {renderIcon(tab.id, i === displayIndex)}
              </span>
            ))}
          </motion.span>
        </span>
      </motion.span>
    </nav>
  );
}

export default IOS27BottomBar;
