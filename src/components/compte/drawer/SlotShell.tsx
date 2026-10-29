'use client';

import React, { useEffect, useRef } from 'react';
import { LensPager } from './LensPager';

export type SlotId = 'vitrine' | 'kit' | 'prets' | 'souvenirs' | 'communaute';
export type Viewer = 'owner' | 'visitor';
export type Visibility = 'public' | 'prive';
export type SlotContentState = 'ready' | 'loading' | 'empty' | 'error';

export interface SlotLens {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SlotShellProps {
  slot: SlotId;
  viewer: Viewer;
  /** Visibilité du profil, reflétée pour le verrou de la tâche 14. */
  visibility?: Visibility;
  /** Invitation éventuelle, reflétée pour la tâche 14. */
  invited?: boolean;
  title: string;
  /** @deprecated en-tête supprimé : conservé pour les appels existants. */
  subtitle?: string;
  /** @deprecated en-tête supprimé : conservé pour les appels existants. */
  icon?: React.ReactNode;
  lenses: SlotLens[];
  activeLensIndex: number;
  onLensChange: (index: number) => void;
  /** @deprecated en-tête supprimé : sans effet. */
  onOpenSettings?: () => void;
  state?: SlotContentState;
  emptyLabel?: string;
  errorLabel?: string;
  onRetry?: () => void;
  /** Une pane par lentille ; reçoit la lentille, son index et son état actif. */
  renderLens?: (lens: SlotLens, index: number, active: boolean) => React.ReactNode;
  children?: React.ReactNode;
  /** Sélecteur `.ig-tabs` fourni par l'hôte (SlotSelector). */
  selector?: React.ReactNode;
}

function SkeletonState() {
  return (
    <div className="lkdv-slot-skeleton" data-state="loading" aria-busy="true">
      <span className="lkdv-slot-skel lkdv-slot-skel-lg" />
      <span className="lkdv-slot-skel" />
      <span className="lkdv-slot-skel lkdv-slot-skel-sm" />
    </div>
  );
}

function ErrorState({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="lkdv-slot-state" data-state="error" role="alert">
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        !
      </span>
      <p>{label}</p>
      {onRetry ? (
        <button type="button" className="lkdv-slot-state-retry" onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="lkdv-slot-state" data-state="empty">
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        ○
      </span>
      <p>{label}</p>
    </div>
  );
}

/**
 * Coquille commune du drawer Profil : en-tête du slot (icône, titre,
 * sous-titre, partage), segmented `.flow` des lentilles, zone de contenu
 * scrollable et états squelette / vide / erreur.
 *
 * Le sélecteur `.ig-tabs` est fourni par l'hôte (`selector`) afin de garder la
 * même lentille `.ig-th` que la carte principale, en bas à gauche.
 */
export function SlotShell({
  slot,
  viewer,
  visibility,
  invited = false,
  title,
  lenses,
  activeLensIndex,
  onLensChange,
  state = 'ready',
  emptyLabel = 'Aucun contenu pour le moment.',
  errorLabel = 'Impossible de charger ce contenu.',
  onRetry,
  renderLens,
  children,
  selector,
}: SlotShellProps) {
  const flowRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const safeIndex = lenses.length
    ? Math.max(0, Math.min(activeLensIndex, lenses.length - 1))
    : 0;
  const activeLens = lenses[safeIndex];
  const labelledBy = activeLens ? `lkdv-lens-tab-${slot}-${activeLens.id}` : undefined;

  // Les slots peuvent exposer leur propre `data-testid="slot-content"` (utile
  // pour leurs tests isolés). Dans la coquille, l'identifiant appartient à la
  // pane : une seule `slot-content` (active), les autres `slot-pane-<lens>`.
  // On retire donc les identifiants concurrents rendus par les slots.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const normalize = () => {
      shell
        .querySelectorAll<HTMLElement>('.lkdv-lens-pane [data-testid="slot-content"]')
        .forEach((node) => node.removeAttribute('data-testid'));
    };
    normalize();
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(normalize);
    observer.observe(shell, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid'],
    });
    return () => observer.disconnect();
  }, []);

  /**
   * Tablist des lentilles : flèches gauche/droite avec bouclage, Home/End.
   * Roving tabindex : seul l'onglet actif est dans l'ordre de tabulation.
   */
  const handleLensKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (lenses.length === 0) return;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') {
      next = (safeIndex - 1 + lenses.length) % lenses.length;
    } else if (event.key === 'ArrowRight') {
      next = (safeIndex + 1) % lenses.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = lenses.length - 1;
    }
    if (next === null) return;
    event.preventDefault();
    onLensChange(next);
    const tabs = flowRef.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs?.[next]?.focus();
  };

  return (
    <div
      ref={shellRef}
      className="lkdv-slot-shell"
      data-slot={slot}
      data-viewer={viewer}
      data-visibility={visibility}
      data-invited={invited ? 'true' : 'false'}
      data-lens={activeLens?.id}
      data-state={state}
    >
      <div
        className="lkdv-slot-topnav"
      >
        {selector}
      </div>

      <div className="lkdv-slot-stage">
      <div
        className="lkdv-slot-panel"
        id={`lkdv-slot-panel-${slot}`}
        role="tabpanel"
        aria-labelledby={`lkdv-slot-tab-${slot}`}
      >
        {state === 'ready' ? (
          <LensPager
            index={safeIndex}
            count={Math.max(1, lenses.length)}
            onIndexChange={onLensChange}
            flowRef={flowRef}
            label={`Lentilles de ${title}`}
          >
            {lenses.map((lens, index) => {
              const active = index === safeIndex;
              return (
                <div
                  key={lens.id}
                  className="lkdv-lens-pane"
                  id={`lkdv-lens-panel-${slot}-${lens.id}`}
                  role="tabpanel"
                  aria-labelledby={`lkdv-lens-tab-${slot}-${lens.id}`}
                  aria-hidden={!active}
                  inert={!active}
                  data-testid={active ? 'slot-content' : `slot-pane-${lens.id}`}
                  data-lens={lens.id}
                >
                  {renderLens ? renderLens(lens, index, active) : children}
                </div>
              );
            })}
          </LensPager>
        ) : (
          <div
            className="lkdv-slot-content"
            role="tabpanel"
            aria-labelledby={labelledBy}
            data-testid="slot-content"
            data-lens={activeLens?.id}
          >
            {state === 'loading' ? <SkeletonState /> : null}
            {state === 'empty' ? <EmptyState label={emptyLabel} /> : null}
            {state === 'error' ? <ErrorState label={errorLabel} onRetry={onRetry} /> : null}
          </div>
        )}
      </div>
      </div>

      <div
        ref={flowRef}
        className="ig-tabs lkdv-lens-tabs"
        role="tablist"
        aria-label={`Lentilles de ${title}`}
        aria-orientation="horizontal"
        onKeyDown={handleLensKeyDown}
        style={
          {
            '--n': lenses.length,
            '--w': `${lenses.length * 44}px`,
            '--lens-w': `calc((100% - 5px) / ${lenses.length})`,
          } as React.CSSProperties
        }
      >
        <span
          className="ig-th lens"
          aria-hidden="true"
          style={
            {
              width: `calc((100% - 4px) / ${lenses.length})`,
              transform: `translateX(${safeIndex * 100}%)`,
            } as React.CSSProperties
          }
        />
        {lenses.map((lens, index) => {
          const active = index === safeIndex;
          return (
            <button
              key={lens.id}
              id={`lkdv-lens-tab-${slot}-${lens.id}`}
              type="button"
              role="tab"
              className={active ? 'cur' : ''}
              aria-selected={active}
              aria-label={lens.label}
              title={lens.label}
              tabIndex={active ? 0 : -1}
              aria-controls={
                state === 'ready'
                  ? `lkdv-lens-panel-${slot}-${lens.id}`
                  : undefined
              }
              onClick={() => onLensChange(index)}
            >
              {lens.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Styles propres au drawer v2. Ils réutilisent les tokens du verre déjà
 * présents (`--sf`, `--label`, `--label2`, `--accent`) et ne redéfinissent que
 * la géométrie locale : le sélecteur reprend `.ig-tabs` / `.ig-th lens`, le
 * segmented reprend `.flow` / `.sel-lens`.
 */
export const DRAWER_V2_CSS = `
.lkdv-slot-root{flex:1 1 auto!important;min-height:0!important;display:flex!important;width:100%!important;overflow:hidden!important;}
.lkdv-drawer-host{position:relative!important;display:flex!important;flex:1 1 auto!important;flex-direction:column!important;min-height:0!important;width:100%!important;}
body .phone.sheet-open[data-det="card"] .map-scale-selector,body .phone.sheet-open[data-det="card"] .mctl{opacity:0!important;pointer-events:none!important;transform:translateY(12px)!important;}
.lkdv-slot-shell{position:relative!important;display:flex!important;flex-direction:column!important;gap:8px!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;padding:0 14px 54px!important;box-sizing:border-box!important;color:var(--label);}
.lkdv-slot-shell[data-slot="vitrine"]{--glass-bg-medium:rgba(255,255,255,.66)!important;--glass-tint:rgba(255,255,255,.5)!important;--card-tint:rgba(255,255,255,.6)!important;--lkv-surface-card:rgba(255,255,255,.6)!important;}
.lkdv-slot-empty{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px!important;text-align:center!important;min-height:100%!important;flex:1 1 auto!important;padding:28px 18px!important;box-sizing:border-box!important;}
.lkdv-slot-empty b{font:650 15px var(--sf)!important;color:var(--label)!important;}
.lkdv-slot-empty p{font:400 12.5px/1.45 var(--sf)!important;color:var(--label2)!important;max-width:270px!important;margin:0!important;}
.lkdv-slot-empty-cta{display:inline-flex!important;align-items:center!important;justify-content:center!important;height:36px!important;padding:0 15px!important;margin-top:3px!important;border-radius:999px!important;background:#17402C!important;color:#fff!important;font:600 12.5px var(--sf)!important;text-decoration:none!important;box-shadow:0 4px 14px rgba(23,64,44,.2)!important;}
.lkdv-slot-topnav{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;flex:none!important;}
.lkdv-slot-shell > .lkdv-slot-topnav .lkdv-slot-selector{width:100%!important;max-width:none!important;margin:0!important;flex:none!important;}
.lkdv-slot-shell > .lkdv-slot-topnav .lkdv-slot-selector.lkdv-capsule{background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.04) 46%,rgba(0,0,0,.12)),rgba(23,29,26,.76)!important;-webkit-backdrop-filter:blur(28px) saturate(180%)!important;backdrop-filter:blur(28px) saturate(180%)!important;border:.5px solid rgba(255,255,255,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 -1px 1px rgba(255,255,255,.06),0 10px 30px rgba(0,0,0,.24)!important;}
.lkdv-slot-shell > .lkdv-slot-topnav .lkdv-slot-selector .sel-lens{background:linear-gradient(180deg,rgba(255,255,255,.23),rgba(255,255,255,.1))!important;border:.5px solid rgba(255,255,255,.28)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 1px 4px rgba(0,0,0,.12)!important;}
.lkdv-slot-shell > .lkdv-slot-topnav .lkdv-slot-selector button{color:rgba(255,255,255,.62)!important;transition:color .2s ease!important;}
.lkdv-slot-shell > .lkdv-slot-topnav .lkdv-slot-selector button.active,.lkdv-slot-shell > .lkdv-slot-topnav .lkdv-slot-selector button[aria-selected="true"]{color:#d8f3de!important;}
.lkdv-slot-shell > .lkdv-lens-tabs{position:absolute!important;right:10px!important;bottom:10px!important;left:auto!important;top:auto!important;display:grid!important;width:var(--w,132px)!important;max-width:var(--w,132px)!important;height:30px!important;grid-template-columns:repeat(var(--n,3),minmax(0,1fr))!important;padding:2.5px!important;border-radius:9999px!important;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.04) 46%,rgba(0,0,0,.12)),rgba(23,29,26,.76)!important;border:.5px solid rgba(255,255,255,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 -1px 1px rgba(255,255,255,.06),0 10px 30px rgba(0,0,0,.24)!important;-webkit-backdrop-filter:blur(28px) saturate(180%)!important;backdrop-filter:blur(28px) saturate(180%)!important;z-index:14!important;box-sizing:border-box!important;}
.lkdv-slot-shell > .lkdv-lens-tabs .ig-th{top:2.5px!important;bottom:2.5px!important;left:2.5px!important;width:var(--lens-w,42px)!important;height:25px!important;border-radius:9999px!important;background:linear-gradient(180deg,rgba(255,255,255,.23),rgba(255,255,255,.1))!important;border:.5px solid rgba(255,255,255,.28)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 1px 4px rgba(0,0,0,.12)!important;}
.lkdv-slot-shell > .lkdv-lens-tabs button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:25px!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;color:rgba(255,255,255,.62)!important;cursor:pointer!important;transition:color .2s ease!important;}
.lkdv-slot-shell > .lkdv-lens-tabs button.cur,.lkdv-slot-shell > .lkdv-lens-tabs button[aria-selected="true"],.lkdv-slot-shell > .lkdv-lens-tabs button.active{color:#d8f3de!important;}
.lkdv-slot-shell > .lkdv-lens-tabs button svg{width:15px!important;height:15px!important;}
.lkdv-slot-slide{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;}
.lkdv-slot-stage{position:relative!important;display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;}

.lkdv-slot-slide[data-dir="1"] .lkdv-slot-panel{animation:lkdv-slot-in-right .34s cubic-bezier(.22,.8,.25,1)!important;}
.lkdv-slot-slide[data-dir="-1"] .lkdv-slot-panel{animation:lkdv-slot-in-left .34s cubic-bezier(.22,.8,.25,1)!important;}
@keyframes lkdv-slot-in-right{from{opacity:0;transform:translateX(16px) scale(.995)}to{opacity:1;transform:none}}
@keyframes lkdv-slot-in-left{from{opacity:0;transform:translateX(-16px) scale(.995)}to{opacity:1;transform:none}}
.lkdv-slot-panel{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;}
.lkdv-lens-pager{position:relative!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;touch-action:pan-y;outline:none!important;border-radius:18px!important;}
.lkdv-lens-pager:focus-visible{box-shadow:0 0 0 2px rgba(23,64,44,.3)!important;}
.lkdv-lens-track{display:flex!important;width:100%!important;height:100%!important;will-change:transform!important;}
.lkdv-lens-pane{flex:0 0 100%!important;width:100%!important;min-width:0!important;height:100%!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding:0 1px 8px!important;box-sizing:border-box!important;}
.lkdv-slot-content{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding:0 1px 8px!important;}
.lkdv-slot-state{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:9px!important;text-align:center!important;padding:28px 18px!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;min-height:100%!important;flex:1 1 auto!important;box-sizing:border-box!important;}
.lkdv-slot-skeleton{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:9px!important;text-align:center!important;padding:28px 18px!important;border-radius:20px!important;background:rgba(255,255,255,.46)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.07)!important;}
.lkdv-slot-state p{margin:0!important;font:400 13px/1.4 var(--sf)!important;color:var(--label2)!important;max-width:250px!important;}
.lkdv-slot-state-ico{width:38px!important;height:38px!important;display:grid!important;place-items:center!important;border-radius:50%!important;background:var(--soft,rgba(236,244,233,.7))!important;color:var(--accent)!important;font:700 17px var(--sf)!important;}
.lkdv-slot-state-retry{height:34px!important;padding:0 16px!important;border:0!important;border-radius:999px!important;background:var(--pg,rgba(150,186,142,.5))!important;color:var(--pg-ink,#17402C)!important;font:600 13px var(--sf)!important;cursor:pointer!important;}
.lkdv-slot-skeleton{align-items:stretch!important;}
.lkdv-slot-skel{display:block!important;height:14px!important;border-radius:9px!important;background:linear-gradient(90deg,rgba(23,43,36,.06),rgba(255,255,255,.72),rgba(23,43,36,.06))!important;background-size:220% 100%!important;animation:lkdv-skel 1.3s ease-in-out infinite!important;}
.lkdv-slot-skel-lg{height:72px!important;border-radius:16px!important;}
.lkdv-slot-skel-sm{width:62%!important;}
@keyframes lkdv-skel{0%{background-position:120% 0}100%{background-position:-120% 0}}
.mapzone[data-map-context] .map{filter:saturate(.6) brightness(.97)!important;transition:filter .3s ease!important;}
.mapzone[data-map-context] .sunshade{opacity:.55!important;}
.lkdv-map-context-badge{position:absolute!important;left:14px!important;top:12px!important;z-index:6!important;display:inline-flex!important;align-items:center!important;gap:6px!important;height:26px!important;padding:0 11px!important;border-radius:9999px!important;background:rgba(255,255,255,.78)!important;color:#17402C!important;font:600 11px/1 var(--sf)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12),0 4px 12px rgba(23,43,36,.1)!important;-webkit-backdrop-filter:blur(16px) saturate(160%)!important;backdrop-filter:blur(16px) saturate(160%)!important;pointer-events:none!important;}
.phone .sheet .lkdv-slot-shell > .lkdv-lens-tabs{width:var(--w,132px)!important;max-width:var(--w,132px)!important;height:30px!important;padding:2.5px!important;border-radius:9999px!important;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.04) 46%,rgba(0,0,0,.12)),rgba(23,29,26,.76)!important;border:.5px solid rgba(255,255,255,.18)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 -1px 1px rgba(255,255,255,.06),0 10px 30px rgba(0,0,0,.24)!important;-webkit-backdrop-filter:blur(28px) saturate(180%)!important;backdrop-filter:blur(28px) saturate(180%)!important;}
.phone .sheet .lkdv-slot-shell > .lkdv-lens-tabs button{width:100%!important;height:25px!important;flex:none!important;}
@media (prefers-reduced-motion:reduce){.lkdv-lens-track{transition:none!important;}.lkdv-slot-shell .lkdv-slot-selector .ig-th.lens{transition:none!important;}.lkdv-slot-skel{animation:none!important;}}
`;

export default SlotShell;
