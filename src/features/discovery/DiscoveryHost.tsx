'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { onDynamicIsland } from '@/lib/dynamic-island';
import { useExplorerStore } from '@/features/explorer-v2/state/store';
import { getDiscoveryStepById, getStepsForSurface, resolveDiscoverySurface } from './catalog';
import { detectIslandGeometry, type DiscoveryIslandGeometry } from './deviceGeometry';
import { DiscoveryVisual } from './DiscoveryVisuals';
import {
  DISCOVERY_ENTRY_DELAY_MS,
  activateDiscoveryStep,
  completeDiscoveryStep,
  dismissDiscoveryStep,
  hydrateDiscoveryState,
  pauseActiveDiscoveryStep,
  pickNextDiscoveryStep,
  useDiscoveryState,
} from './store';

/** Vérifie qu'une ancre `data-discover` existe et est visible dans le viewport. */
function findVisibleAnchorElement(anchor: string): HTMLElement | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(anchor)
      : anchor.replace(/["\\]/g, '\\$&');
  const el = document.querySelector<HTMLElement>(`[data-discover="${escaped}"]`);
  if (!el || !el.isConnected) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const style = window.getComputedStyle(el);
  if (
    style.visibility === 'hidden' ||
    style.display === 'none' ||
    (style.opacity !== '' && Number(style.opacity) === 0)
  ) {
    return null;
  }
  const vh = window.innerHeight || 0;
  const vw = window.innerWidth || 0;
  if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) {
    return null;
  }
  return el;
}

/** Retourne true uniquement pour une alerte/confirmation destructive bloquante. */
function isBlockingAlertOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('[role="alertdialog"]'));
}

/** Retourne true si un tiroir modal (Communauté, Création, Compte, Club…) est ouvert. */
function isModalDrawerOpen(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.body.classList.contains('lkdv-dialog-open')) return true;
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
}

/** Retourne true si un tiroir docké (ex. Explorer) est actuellement déployé (mid / full). */
function isDockedDrawerExpanded(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector(
      '[data-testid="xp20-glass-drawer"][data-detent="mid"], [data-testid="xp20-glass-drawer"][data-detent="full"]',
    ),
  );
}

/** Déclenche un léger retour haptique sur Capacitor natif si disponible. */
function triggerGentleHaptic(): void {
  if (typeof window === 'undefined') return;
  try {
    const cap = (window as unknown as {
      Capacitor?: { Plugins?: { Haptics?: { selectionChanged?: () => Promise<void> } } };
    }).Capacitor;
    void cap?.Plugins?.Haptics?.selectionChanged?.();
  } catch {
    // Haptique indisponible (web pur) : ignoré sans bruit
  }
}

/**
 * Orchestrateur global + Îlot de découverte adaptatif LKDV.
 *
 * - 100 % non-bloquant : ne capture jamais les gestes ni les clics hors de la pilule.
 * - Timeline unique : strictement 1 repère actif dans toute l'app, avec cooldown calme.
 * - Effet sur cible : pose `data-discover-active="true"` sur l'élément ciblé (halo vert
 *   Liquid Glass + micro-vibration douce) et valide dès le premier appui sur l'élément.
 * - Îlot adaptatif : morphing depuis la Dynamic Island sur iPhone, pilule flottante sous
 *   la barre d'état sur Android / Desktop.
 */
export function DiscoveryHost() {
  const pathname = usePathname();
  const discovery = useDiscoveryState();
  const activeOuting = useExplorerStore((s) => s.activity);

  const [geometry, setGeometry] = useState<DiscoveryIslandGeometry>('desktop-pill');
  const [systemIslandBusy, setSystemIslandBusy] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [domVersion, setDomVersion] = useState(0);

  const dragStartYRef = useRef<number | null>(null);
  const activeElRef = useRef<HTMLElement | null>(null);

  // Hydratation client depuis localStorage + géométrie écran
  useEffect(() => {
    hydrateDiscoveryState();
    const updateGeometry = () => setGeometry(detectIslandGeometry());
    updateGeometry();
    window.addEventListener('resize', updateGeometry);
    return () => window.removeEventListener('resize', updateGeometry);
  }, []);

  // Réveil léger du scheduler uniquement quand l'état d'un tiroir (ouvert / déployé) change réellement
  useEffect(() => {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
    let lastModal = isModalDrawerOpen();
    let lastExpanded = isDockedDrawerExpanded();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const checkDrawerTransition = () => {
      const nextModal = isModalDrawerOpen();
      const nextExpanded = isDockedDrawerExpanded();
      if (nextModal === lastModal && nextExpanded === lastExpanded) return;
      lastModal = nextModal;
      lastExpanded = nextExpanded;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setDomVersion((v) => v + 1);
      }, 220);
    };
    const observer = new MutationObserver(checkDrawerTransition);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-detent'],
    });
    return () => {
      observer.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // Priorité absolue aux notifications système DynamicIslandHost
  useEffect(() => {
    return onDynamicIsland((ev) => {
      setSystemIslandBusy(Boolean(ev));
    });
  }, []);

  // Si on change de route alors qu'un repère d'une autre surface est affiché, on le suspend
  useEffect(() => {
    const currentStep = getDiscoveryStepById(discovery.activeStepId);
    if (!currentStep || currentStep.surface === 'drawer') return;
    const currentSurface = resolveDiscoverySurface(pathname);
    if (currentSurface !== currentStep.surface) {
      pauseActiveDiscoveryStep();
    }
  }, [pathname, discovery.activeStepId]);

  // Pause immédiate si une sortie GPS tourne ou si une notif système occupe l'îlot
  useEffect(() => {
    if ((activeOuting || systemIslandBusy) && discovery.activeStepId) {
      pauseActiveDiscoveryStep();
    }
  }, [activeOuting, systemIslandBusy, discovery.activeStepId]);

  // Scheduler de timeline : déclenche le prochain repère de la surface courante ou du tiroir actif
  useEffect(() => {
    if (!discovery.enabled) return;
    if (discovery.activeStepId) return;
    if (activeOuting || systemIslandBusy) return;

    const surface = resolveDiscoverySurface(pathname);
    const modalOpen = isModalDrawerOpen();
    if (!surface && !modalOpen) return;

    const now = Date.now();
    const waitMs = Math.max(DISCOVERY_ENTRY_DELAY_MS, discovery.cooldownUntil - now);

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const trySchedule = (attempt: number) => {
      if (cancelled) return;
      if (isBlockingAlertOpen()) {
        if (attempt < 5) {
          retryTimer = setTimeout(() => trySchedule(attempt + 1), 1600);
        }
        return;
      }

      const next = pickNextDiscoveryStep(
        pathname,
        discovery,
        (anchor) => Boolean(findVisibleAnchorElement(anchor)),
        {
          modalDrawerOpen: isModalDrawerOpen(),
          drawerExpanded: isDockedDrawerExpanded(),
        },
      );
      if (next) {
        const activated = activateDiscoveryStep(next.id);
        if (activated) {
          triggerGentleHaptic();
        }
        return;
      }

      // Les éléments lazy (carte 3D, drawers) peuvent arriver légèrement après le mount
      const remainingPage = surface
        ? getStepsForSurface(surface).some(
            (s) => !discovery.completedIds.includes(s.id) && !discovery.dismissedIds.includes(s.id),
          )
        : false;
      const remainingDrawer = getStepsForSurface('drawer').some(
        (s) => !discovery.completedIds.includes(s.id) && !discovery.dismissedIds.includes(s.id),
      );
      if ((remainingPage || remainingDrawer) && attempt < 3) {
        retryTimer = setTimeout(() => trySchedule(attempt + 1), 1100);
      }
    };

    const entryTimer = setTimeout(() => trySchedule(0), waitMs);

    return () => {
      cancelled = true;
      clearTimeout(entryTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [pathname, discovery, activeOuting, systemIslandBusy, domVersion]);

  const activeStep = getDiscoveryStepById(discovery.activeStepId);

  // Pose `data-discover-active="true"` sur l'élément DOM ciblé + écoute son clic pour valider
  useEffect(() => {
    if (activeElRef.current) {
      activeElRef.current.removeAttribute('data-discover-active');
      activeElRef.current = null;
    }
    if (!activeStep) return;

    const el = findVisibleAnchorElement(activeStep.anchor);
    if (!el) {
      pauseActiveDiscoveryStep();
      return;
    }

    el.setAttribute('data-discover-active', 'true');
    activeElRef.current = el;

    const onTargetInteract = () => {
      completeDiscoveryStep(activeStep.id);
    };

    el.addEventListener('pointerdown', onTargetInteract, { capture: true, once: true });
    el.addEventListener('click', onTargetInteract, { capture: true, once: true });

    return () => {
      el.removeAttribute('data-discover-active');
      el.removeEventListener('pointerdown', onTargetInteract, { capture: true });
      el.removeEventListener('click', onTargetInteract, { capture: true });
      if (activeElRef.current === el) {
        activeElRef.current = null;
      }
    };
  }, [activeStep]);

  // Auto-repli doux après durationMs (mis en pause si l'utilisateur survole/touche la pilule)
  useEffect(() => {
    if (!activeStep || hoverPaused) return;
    const duration = activeStep.durationMs ?? 6800;
    const id = window.setTimeout(() => {
      dismissDiscoveryStep(activeStep.id);
    }, duration);
    return () => window.clearTimeout(id);
  }, [activeStep, hoverPaused]);

  const handleDismiss = useCallback(() => {
    if (!activeStep) return;
    setDragOffsetY(0);
    dismissDiscoveryStep(activeStep.id);
  }, [activeStep]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.clientY;
    setHoverPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = e.clientY - dragStartYRef.current;
    // Autorise uniquement le glissement vers le haut pour replier dans l'îlot
    setDragOffsetY(dy < 0 ? Math.max(dy, -64) : Math.min(dy * 0.18, 10));
  };

  const handlePointerUp = () => {
    if (dragStartYRef.current === null) return;
    const shouldDismiss = dragOffsetY <= -22;
    dragStartYRef.current = null;
    setHoverPaused(false);
    if (shouldDismiss) {
      handleDismiss();
    } else {
      setDragOffsetY(0);
    }
  };

  if (!activeStep || systemIslandBusy || activeOuting) return null;

  const surfaceSteps = getStepsForSurface(activeStep.surface);
  const stepIndex = Math.max(
    1,
    surfaceSteps.findIndex((s) => s.id === activeStep.id) + 1,
  );
  const durationMs = activeStep.durationMs ?? 6800;

  return (
    <aside
      aria-label="Astuce de découverte"
      className="lkdv-discover-island-host"
      data-geometry={geometry}
    >
      <div
        key={activeStep.id}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="lkdv-discover-island-card"
        data-geometry={geometry}
        data-paused={hoverPaused ? 'true' : undefined}
        style={{
          ['--discover-duration' as string]: `${durationMs}ms`,
          transform: dragOffsetY !== 0 ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined,
        }}
        onPointerEnter={() => setHoverPaused(true)}
        onPointerLeave={() => {
          setHoverPaused(false);
          dragStartYRef.current = null;
          setDragOffsetY(0);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleDismiss}
      >
        <DiscoveryVisual kind={activeStep.visual} />

        <div className="lkdv-discover-island-copy">
          <div className="lkdv-discover-island-head">
            <span className="lkdv-discover-island-title">{activeStep.title}</span>
            {surfaceSteps.length > 1 ? (
              <span className="lkdv-discover-island-step" aria-hidden="true">
                {stepIndex}/{surfaceSteps.length}
              </span>
            ) : null}
          </div>
          <p className="lkdv-discover-island-body">{activeStep.body}</p>
        </div>

        <span className="lkdv-discover-island-progress" aria-hidden="true">
          <span className="lkdv-discover-island-progress-fill" />
        </span>
      </div>
    </aside>
  );
}

export default DiscoveryHost;
