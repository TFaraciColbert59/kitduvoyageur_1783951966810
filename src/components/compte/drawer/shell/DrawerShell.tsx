'use client';

import React, { useEffect, useState } from 'react';

export interface DrawerTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
}

export interface DrawerSecondaryItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface DrawerShellProps {
  tabs: DrawerTab[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  secondary?: {
    items: DrawerSecondaryItem[];
    active: number;
    onChange: (index: number) => void;
    label?: string;
  };
  state?: 'ready' | 'loading' | 'error';
  onRetry?: () => void;
  children?: React.ReactNode;
}

export function DrawerSkeleton() {
  return (
    <div className="lkdv-drawer-skeleton" data-state="loading" aria-busy="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function DrawerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="lkdv-drawer-state" data-state="error" role="alert">
      <p>Impossible de charger ce contenu.</p>
      {onRetry ? (
        <button type="button" className="lkdv-drawer-retry" onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

export function DrawerEmpty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="lkdv-drawer-state" data-state="empty">
      <span className="lkdv-drawer-empty-ico" aria-hidden="true">○</span>
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  );
}

/**
 * Coquille commune des drawers Réseau, Sortie et Compte.
 *
 * Même capsule que le drawer Profil : `.segc.lg-tabs.lens-on` en haut,
 * capsule flottante `.ig-tabs-float` en bas à droite si un second niveau
 * existe, contenu en pistes horizontales (glissement 420 ms).
 */
export function DrawerShell({
  tabs,
  activeIndex,
  onIndexChange,
  secondary,
  state = 'ready',
  onRetry,
  children,
}: DrawerShellProps) {
  const [visited, setVisited] = useState<Set<number>>(() => new Set([activeIndex]));

  useEffect(() => {
    setVisited((current) => {
      if (current.has(activeIndex)) return current;
      const next = new Set(current);
      next.add(activeIndex);
      return next;
    });
  }, [activeIndex]);

  const safeIndex = Math.max(0, Math.min(activeIndex, tabs.length - 1));

  // La géométrie de la capsule secondaire est portée par `DRAWER_SHELL_CSS`
  // (`--n` suffit) : les largeurs de `.ig-tabs` sont en `!important` et une
  // largeur inline perdrait ce conflit.
  const secondaryStyle = secondary
    ? ({ '--n': secondary.items.length } as React.CSSProperties)
    : undefined;

  return (
    <div className="lkdv-drawer-shell" data-state={state} data-secondary={secondary ? 'true' : 'false'}>
      <style dangerouslySetInnerHTML={{ __html: DRAWER_SHELL_CSS }} />

      <div className="lkdv-drawer-topnav">
        <div
          className="segc lg-tabs lens-on lkdv-drawer-tabs"
          role="tablist"
          aria-label="Sections"
          style={{ '--n': tabs.length } as React.CSSProperties}
        >
          <span
            className="sel-lens"
            aria-hidden="true"
            style={{ '--i': safeIndex } as React.CSSProperties}
          />
          {tabs.map((tab, index) => {
            const active = index === safeIndex;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={active ? 'active' : ''}
                aria-selected={active}
                aria-label={tab.label}
                title={tab.label}
                tabIndex={active ? 0 : -1}
                onClick={() => onIndexChange(index)}
              >
                <span className="ic s">{tab.icon}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lkdv-drawer-viewport">
        {state === 'loading' ? <DrawerSkeleton /> : null}
        {state === 'error' ? <DrawerError onRetry={onRetry} /> : null}
        {state === 'ready' ? (
          <div className="lkdv-drawer-track">
            {tabs.map((tab, index) => {
              const active = index === safeIndex;
              return (
                <div
                  key={tab.id}
                  className={active ? 'lkdv-drawer-pane active' : 'lkdv-drawer-pane'}
                  role="tabpanel"
                  aria-label={tab.label}
                  aria-hidden={!active}
                  inert={!active}
                >
                  {visited.has(index) ? tab.render() : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {secondary && secondary.items.length > 1 ? (
        <div className="ig-tabs-float lkdv-drawer-secondary">
          <div
            className="ig-tabs"
            role="tablist"
            aria-label={secondary.label || 'Filtres'}
            style={secondaryStyle}
          >
            <span
              className="ig-th lens"
              aria-hidden="true"
              style={{ transform: `translateX(${secondary.active * 100}%)` }}
            />
            {secondary.items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={index === secondary.active}
                aria-label={item.label}
                title={item.label}
                onClick={() => secondary.onChange(index)}
              >
                {item.icon}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {state === 'ready' ? children : null}
    </div>
  );
}

export const DRAWER_SHELL_CSS = `
.lkdv-drawer-root{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;}
body .phone.sheet-open[data-det="card"] .map-scale-selector,body .phone.sheet-open[data-det="card"] .mctl,body .phone[data-sheet-open="true"][data-det="card"] .map-scale-selector,body .phone[data-sheet-open="true"][data-det="card"] .mctl{opacity:0!important;pointer-events:none!important;transform:translateY(12px)!important;}
.lkdv-drawer-shell{position:relative!important;display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;padding:0 14px 16px!important;box-sizing:border-box!important;gap:8px!important;color:var(--label)!important;background:linear-gradient(180deg,rgba(250,252,248,.95),rgba(244,248,240,.92))!important;-webkit-backdrop-filter:blur(30px) saturate(150%)!important;backdrop-filter:blur(30px) saturate(150%)!important;border-radius:0 0 26px 26px!important;}
.lkdv-drawer-shell[data-secondary="true"]{padding-bottom:calc(56px + env(safe-area-inset-bottom,0px))!important;}
.lkdv-drawer-topnav{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;flex:none!important;}
.lkdv-drawer-shell .lkdv-drawer-topnav .segc.lkdv-drawer-tabs{display:grid!important;grid-auto-flow:column!important;grid-auto-columns:minmax(0,1fr)!important;align-items:stretch!important;gap:0!important;width:100%!important;max-width:none!important;height:48px!important;margin:0!important;padding:2px!important;border-radius:999px!important;background:rgba(255,255,255,.65)!important;-webkit-backdrop-filter:blur(28px) saturate(180%)!important;backdrop-filter:blur(28px) saturate(180%)!important;border:.5px solid rgba(255,255,255,.8)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 4px 14px rgba(23,43,36,.08)!important;box-sizing:border-box!important;flex:none!important;overflow:visible!important;}
.lkdv-drawer-shell .lkdv-drawer-topnav .lkdv-drawer-tabs .sel-lens{top:4px!important;bottom:4px!important;left:3px!important;width:calc((100% - 6px)/var(--n,2))!important;height:auto!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.26))!important;box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.07),0 2px 8px rgba(23,43,36,.08)!important;transform:translateX(calc(var(--i,0)*100%))!important;transition:transform .42s cubic-bezier(.32,.72,0,1)!important;z-index:1!important;pointer-events:none!important;}
.lkdv-drawer-shell .lkdv-drawer-topnav .lkdv-drawer-tabs button{position:relative!important;z-index:2!important;display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;min-height:44px!important;height:100%!important;padding:0!important;border:0!important;border-radius:999px!important;background:none!important;box-shadow:none!important;color:var(--label2)!important;cursor:pointer!important;}
.lkdv-drawer-shell .lkdv-drawer-topnav .lkdv-drawer-tabs button.active,.lkdv-drawer-shell .lkdv-drawer-topnav .lkdv-drawer-tabs button[aria-selected="true"]{color:#17402C!important;}
.lkdv-drawer-shell .lkdv-drawer-topnav .lkdv-drawer-tabs button .ic{display:grid!important;place-items:center!important;width:18px!important;height:18px!important;color:inherit!important;}
.lkdv-drawer-shell .lkdv-drawer-topnav .lkdv-drawer-tabs button:focus-visible,.lkdv-drawer-shell .lkdv-drawer-secondary .ig-tabs button:focus-visible{outline:2px solid #17402C!important;outline-offset:2px!important;}
.lkdv-drawer-viewport{position:relative!important;flex:1 1 auto!important;min-height:0!important;overflow:hidden!important;}
.lkdv-drawer-track{position:relative!important;display:block!important;height:100%!important;}
.lkdv-drawer-pane{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;padding:0 1px 4px!important;box-sizing:border-box!important;opacity:0!important;visibility:hidden!important;transform:translateY(5px) scale(.998)!important;transition:opacity .26s ease,transform .34s cubic-bezier(.22,.8,.25,1),visibility 0s linear .34s!important;pointer-events:none!important;}
.lkdv-drawer-pane.active{opacity:1!important;visibility:visible!important;transform:none!important;pointer-events:auto!important;transition:opacity .3s ease,transform .36s cubic-bezier(.22,.8,.25,1),visibility 0s!important;}
.lkdv-drawer-shell .lkdv-drawer-secondary{position:absolute!important;right:10px!important;bottom:10px!important;left:auto!important;top:auto!important;z-index:14!important;}
.lkdv-drawer-shell .lkdv-drawer-secondary .ig-tabs{width:calc(var(--n,2)*44px + 5px)!important;max-width:calc(var(--n,2)*44px + 5px)!important;grid-template-columns:repeat(var(--n,2),minmax(0,1fr))!important;align-items:stretch!important;height:30px!important;padding:2.5px!important;border-radius:9999px!important;background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.42) 55%,rgba(255,255,255,.52))!important;border:0!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.45),0 0 0 .5px rgba(23,43,36,.14),0 8px 22px rgba(23,43,36,.12)!important;box-sizing:border-box!important;}
.lkdv-drawer-shell .lkdv-drawer-secondary .ig-tabs .ig-th{top:2.5px!important;bottom:2.5px!important;left:2.5px!important;width:calc((100% - 5px)/var(--n,2))!important;height:25px!important;border-radius:9999px!important;}
.lkdv-drawer-shell .lkdv-drawer-secondary .ig-tabs button{position:relative!important;height:25px!important;min-height:25px!important;padding:0!important;border:0!important;background:none!important;box-shadow:none!important;cursor:pointer!important;}
.lkdv-drawer-shell .lkdv-drawer-secondary .ig-tabs button::after{content:""!important;position:absolute!important;left:0!important;right:0!important;top:-10px!important;bottom:-10px!important;border-radius:12px!important;}
.lkdv-drawer-skeleton{display:flex!important;flex-direction:column!important;gap:10px!important;padding:10px 0!important;}
.lkdv-drawer-skeleton span{display:block!important;height:64px!important;border-radius:18px!important;background:linear-gradient(90deg,rgba(255,255,255,.35),rgba(255,255,255,.65),rgba(255,255,255,.35))!important;background-size:200% 100%!important;animation:lkdvDrawerShimmer 1.4s ease-in-out infinite!important;}
.lkdv-drawer-state{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px!important;text-align:center!important;padding:28px 16px!important;color:var(--label2)!important;}
.lkdv-drawer-state b{font:600 14px var(--sf)!important;color:var(--label)!important;}
.lkdv-drawer-state p{font:400 12.5px/1.4 var(--sf)!important;max-width:260px!important;margin:0!important;}
.lkdv-drawer-empty-ico{font-size:22px!important;color:var(--label3)!important;}
.lkdv-drawer-retry{height:34px!important;padding:0 16px!important;border:0!important;border-radius:999px!important;background:var(--pg)!important;color:var(--pg-ink)!important;font:600 12.5px var(--sf)!important;cursor:pointer!important;}
.lkdv-drawer-auth{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:9px!important;text-align:center!important;padding:30px 18px!important;color:var(--label2)!important;min-height:240px!important;}
.lkdv-drawer-auth-ico{width:52px!important;height:52px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,rgba(255,255,255,.9),rgba(221,235,216,.85))!important;color:#17402C!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1),0 8px 22px rgba(23,43,36,.08)!important;}
.lkdv-drawer-auth b{font:650 15px var(--sf)!important;color:var(--label)!important;}
.lkdv-drawer-auth p{font:400 12.5px/1.45 var(--sf)!important;max-width:270px!important;margin:0!important;}
.lkdv-drawer-auth-cta{display:inline-flex!important;align-items:center!important;gap:6px!important;height:38px!important;padding:0 17px!important;margin-top:2px!important;border-radius:999px!important;background:#17402C!important;color:#fff!important;font:600 12.5px var(--sf)!important;text-decoration:none!important;box-shadow:0 4px 14px rgba(23,64,44,.2)!important;}
.lkdv-drawer-auth small{font:500 10.5px var(--sf)!important;color:var(--label3)!important;max-width:240px!important;}
@keyframes lkdvDrawerShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.lkdv-drawer-pane{transition:none!important;}.lkdv-drawer-skeleton span{animation:none!important;}.lkdv-drawer-shell .lkdv-drawer-topnav .lkdv-drawer-tabs .sel-lens{transition:none!important;}}
`;
