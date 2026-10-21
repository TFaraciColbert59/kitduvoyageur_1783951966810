'use client';

import React, { useEffect, useRef } from 'react';
import { LensPager } from './LensPager';
import { ProfileSettingsSheet } from './ProfileSettingsSheet';

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
  subtitle: string;
  icon: React.ReactNode;
  lenses: SlotLens[];
  activeLensIndex: number;
  onLensChange: (index: number) => void;
  onShare?: () => void;
  /**
   * Ouvre les réglages du propriétaire (re-homing des anciens onglets
   * Pratique / Voyageur / Vie privée). Sans ce prop, la coquille émet
   * `lkdv:open-settings` et ouvre sa propre feuille.
   */
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

const SHARE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
  </svg>
);

const SETTINGS_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="3.1" />
    <path d="M19.1 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.67 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.3 14.6a1.7 1.7 0 0 0-1.56-1.03H2.65v-4h.09A1.7 1.7 0 0 0 4.3 8.54a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 9.7 2.62V2.53h4v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.87 1.7 1.7 0 0 0 1.56 1.03h.09v4h-.09a1.7 1.7 0 0 0-1.55 1.03Z" />
  </svg>
);

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
  subtitle,
  icon,
  lenses,
  activeLensIndex,
  onLensChange,
  onShare,
  onOpenSettings,
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

  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
      return;
    }
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('lkdv:open-settings'));
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
      <header className="lkdv-slot-head">
        <span className="lkdv-slot-head-ico" aria-hidden="true">
          {icon}
        </span>
        <div className="lkdv-slot-head-txt">
          <h2 className="lkdv-slot-title">{title}</h2>
          <p className="lkdv-slot-subtitle">{subtitle}</p>
        </div>
        {viewer === 'owner' ? (
          <button
            type="button"
            className="lkdv-slot-settings"
            aria-label="Réglages du profil"
            aria-haspopup="dialog"
            onClick={handleOpenSettings}
          >
            {SETTINGS_ICON}
          </button>
        ) : null}
        <button
          type="button"
          className="lkdv-slot-share"
          aria-label={`Partager ${title}`}
          onClick={onShare}
        >
          {SHARE_ICON}
        </button>
      </header>

      <div
        ref={flowRef}
        className="flow"
        role="tablist"
        aria-label={`Lentilles de ${title}`}
        style={{ '--n': lenses.length } as React.CSSProperties}
      >
        <span
          className="sel-lens"
          aria-hidden="true"
          style={{ '--i': safeIndex } as React.CSSProperties}
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
              /* Les panneaux de lentilles ne sont montés qu'en état `ready` :
                 en chargement/vide/erreur, aucun IDREF ne doit pendre. */
              aria-controls={
                state === 'ready'
                  ? `lkdv-lens-panel-${slot}-${lens.id}`
                  : undefined
              }
              onClick={() => onLensChange(index)}
            >
              {lens.icon}
              <span className="flb">{lens.label}</span>
            </button>
          );
        })}
      </div>

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

      {selector}

      {viewer === 'owner' ? (
        <ProfileSettingsSheet viewer={viewer} visibility={visibility} />
      ) : null}
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
.lkdv-slot-root{flex:1 1 auto!important;min-height:0!important;display:flex!important;width:100%!important;}
.lkdv-slot-shell{position:relative!important;display:flex!important;flex-direction:column!important;gap:8px!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;padding:0 1px calc(58px + env(safe-area-inset-bottom,0px))!important;box-sizing:border-box!important;color:var(--label);}
.lkdv-slot-head{display:flex!important;align-items:center!important;gap:10px!important;flex:none!important;padding:1px 2px 0!important;}
.lkdv-slot-head-ico{width:36px!important;height:36px!important;flex:none!important;display:grid!important;place-items:center!important;border-radius:12px!important;color:var(--accent)!important;background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.38))!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1),0 3px 10px rgba(23,43,36,.07)!important;}
.lkdv-slot-head-ico svg{width:22px!important;height:22px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.lkdv-slot-head-txt{flex:1!important;min-width:0!important;}
.lkdv-slot-title{margin:0!important;font:700 22px/1.15 var(--sf)!important;letter-spacing:-.02em!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-slot-subtitle{margin:2px 0 0!important;font:400 13px/1.3 var(--sf)!important;color:var(--label2)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-slot-share{width:32px!important;height:32px!important;flex:none!important;display:grid!important;place-items:center!important;border:0!important;border-radius:50%!important;background:rgba(255,255,255,.55)!important;color:var(--accent)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;cursor:pointer!important;}
.lkdv-slot-share:active{transform:scale(.94)!important;}
.lkdv-slot-share svg{width:17px!important;height:17px!important;fill:none!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.lkdv-slot-settings{width:44px!important;height:44px!important;flex:none!important;display:grid!important;place-items:center!important;border:0!important;border-radius:50%!important;background:rgba(255,255,255,.55)!important;color:var(--accent)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;cursor:pointer!important;}
.lkdv-slot-settings:active{transform:scale(.94)!important;}
.lkdv-slot-settings:focus-visible{outline:2px solid rgba(23,64,44,.55)!important;outline-offset:2px!important;}
.lkdv-slot-settings svg{width:20px!important;height:20px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.lkdv-slot-shell .flow{height:44px!important;margin:0!important;flex:none!important;}
.lkdv-slot-shell .flow button{flex-direction:column!important;gap:1px!important;padding:0 3px!important;font:500 9.5px/12px var(--sf)!important;letter-spacing:0!important;}
.lkdv-slot-shell .flow button svg,.lkdv-slot-shell .flow button .ic{width:16px!important;height:16px!important;stroke-width:1.9!important;}
.lkdv-slot-shell .flow button .flb{display:block!important;max-width:100%!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font:500 9.5px/12px var(--sf)!important;color:inherit!important;}
.lkdv-slot-shell .flow button.cur .flb{font-weight:600!important;}
.lkdv-slot-panel{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;}
.lkdv-lens-pager{position:relative!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;touch-action:pan-y!important;outline:none!important;border-radius:18px!important;}
.lkdv-lens-pager:focus-visible{box-shadow:0 0 0 2px rgba(23,64,44,.3)!important;}
.lkdv-lens-track{display:flex!important;width:100%!important;height:100%!important;will-change:transform!important;}
.lkdv-lens-pane{flex:0 0 100%!important;width:100%!important;min-width:0!important;height:100%!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding:0 1px 2px!important;box-sizing:border-box!important;}
.lkdv-slot-content{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding:0 1px 2px!important;}
.lkdv-slot-state,.lkdv-slot-skeleton{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:9px!important;text-align:center!important;padding:28px 18px!important;border-radius:20px!important;background:rgba(255,255,255,.46)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.07)!important;}
.lkdv-slot-state p{margin:0!important;font:400 13px/1.4 var(--sf)!important;color:var(--label2)!important;max-width:250px!important;}
.lkdv-slot-state-ico{width:38px!important;height:38px!important;display:grid!important;place-items:center!important;border-radius:50%!important;background:var(--soft,rgba(236,244,233,.7))!important;color:var(--accent)!important;font:700 17px var(--sf)!important;}
.lkdv-slot-state-retry{height:34px!important;padding:0 16px!important;border:0!important;border-radius:999px!important;background:var(--pg,rgba(150,186,142,.5))!important;color:var(--pg-ink,#17402C)!important;font:600 13px var(--sf)!important;cursor:pointer!important;}
.lkdv-slot-skeleton{align-items:stretch!important;}
.lkdv-slot-skel{display:block!important;height:14px!important;border-radius:9px!important;background:linear-gradient(90deg,rgba(23,43,36,.06),rgba(255,255,255,.72),rgba(23,43,36,.06))!important;background-size:220% 100%!important;animation:lkdv-skel 1.3s ease-in-out infinite!important;}
.lkdv-slot-skel-lg{height:72px!important;border-radius:16px!important;}
.lkdv-slot-skel-sm{width:62%!important;}
@keyframes lkdv-skel{0%{background-position:120% 0}100%{background-position:-120% 0}}
.lkdv-slot-shell .lkdv-slot-selector{position:absolute!important;left:0!important;right:auto!important;top:auto!important;bottom:2px!important;display:flex!important;align-items:center!important;grid-template-columns:none!important;gap:2px!important;width:auto!important;max-width:none!important;height:44px!important;padding:0!important;border-radius:9999px!important;z-index:14!important;box-sizing:border-box!important;}
.lkdv-slot-shell .lkdv-slot-selector .ig-th.lens{left:0!important;top:3px!important;bottom:3px!important;width:var(--lens-w,44px)!important;height:auto!important;transform:translateX(var(--lens-x,0px))!important;transition:transform .3s cubic-bezier(.3,1.35,.4,1),width .3s cubic-bezier(.3,1.35,.4,1)!important;}
.lkdv-slot-shell .lkdv-slot-selector button{position:relative!important;z-index:2!important;flex:none!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;height:44px!important;min-width:44px!important;padding:0 10px!important;border:0!important;border-radius:9999px!important;background:none!important;box-shadow:none!important;color:#56665D!important;cursor:pointer!important;}
.lkdv-slot-shell .lkdv-slot-selector button[aria-selected="true"]{color:#17402C!important;}
.lkdv-slot-shell .lkdv-slot-selector button svg{width:18px!important;height:18px!important;flex:none!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important;}
.lkdv-slot-selector-label{font:600 11px/1 var(--sf)!important;letter-spacing:-.01em!important;white-space:nowrap!important;}
.mapzone[data-map-context] .map{filter:saturate(.6) brightness(.97)!important;transition:filter .3s ease!important;}
.mapzone[data-map-context] .sunshade{opacity:.55!important;}
.lkdv-map-context-badge{position:absolute!important;left:14px!important;top:12px!important;z-index:6!important;display:inline-flex!important;align-items:center!important;gap:6px!important;height:26px!important;padding:0 11px!important;border-radius:9999px!important;background:rgba(255,255,255,.78)!important;color:#17402C!important;font:600 11px/1 var(--sf)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12),0 4px 12px rgba(23,43,36,.1)!important;-webkit-backdrop-filter:blur(16px) saturate(160%)!important;backdrop-filter:blur(16px) saturate(160%)!important;pointer-events:none!important;}
@media (prefers-reduced-motion:reduce){.lkdv-lens-track{transition:none!important;}.lkdv-slot-shell .lkdv-slot-selector .ig-th.lens{transition:none!important;}.lkdv-slot-skel{animation:none!important;}}
`;

export default SlotShell;
