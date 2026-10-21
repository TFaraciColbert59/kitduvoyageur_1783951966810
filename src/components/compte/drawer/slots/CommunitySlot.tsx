'use client';

import React from 'react';
import { ChallengeRow, type Challenge } from '../cards/ChallengeRow';

export type CommunityLens = 'challenges' | 'clubs' | 'cordee';

export interface CommunitySlotProps {
  lens?: CommunityLens | string;
  /** Payload du bootstrap (`challenges`, `clubs`, `companions`…). */
  payload?: unknown;
  /** Raccourcis de test/intégration : prioritaires sur le payload. */
  challenges?: Challenge[];
  [key: string]: unknown;
}

const COMMUNITY_LENSES: readonly CommunityLens[] = ['challenges', 'clubs', 'cordee'];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Lit une liste soit dans les props directes (tests, intégration), soit dans le
 * payload du bootstrap, y compris sous `community` / `communaute`.
 */
function listFromPayload<T>(
  direct: readonly T[] | undefined,
  payload: unknown,
  ...keys: string[]
): T[] {
  if (Array.isArray(direct)) return direct as T[];
  const root = asRecord(payload);
  if (!root) return [];
  const containers = [root, asRecord(root.community), asRecord(root.communaute)];
  for (const container of containers) {
    if (!container) continue;
    for (const key of keys) {
      const value = container[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

const COMMUNITY_SLOT_CSS = `
.lkdv-comm{display:flex;flex-direction:column;gap:8px;padding:2px 1px 10px;color:var(--label,#172B24);}
.lkdv-comm-section{display:flex;flex-direction:column;gap:6px;}
.lkdv-comm-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px;}
.lkdv-comm-title{margin:0;font:600 11.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:.04em;text-transform:uppercase;color:var(--label2,#56665D);}
.lkdv-comm-count{min-width:24px;height:20px;display:inline-flex;align-items:center;justify-content:center;padding:0 7px;border-radius:999px;background:rgba(255,255,255,.58);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.08);font:600 10.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);font-variant-numeric:tabular-nums;}
.lkdv-challenge-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
.lkdv-challenge{box-sizing:border-box;min-height:84px;display:flex;flex-direction:column;justify-content:center;gap:5px;padding:9px 12px;border-radius:18px;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.05);}
.lkdv-challenge[data-completed="true"]{background:rgba(236,244,233,.62);}
.lkdv-challenge-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;}
.lkdv-challenge-title{margin:0;min-width:0;font:600 14px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label,#172B24);letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lkdv-challenge-check{display:inline-grid;place-items:center;width:16px;height:16px;margin-right:5px;border-radius:50%;background:rgba(61,122,82,.14);color:var(--good,#3D7A52);font:700 10px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);vertical-align:1px;}
.lkdv-challenge-count{flex:none;font:700 12.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--tint,#17402C);font-variant-numeric:tabular-nums;}
.lkdv-challenge-meta{display:flex;align-items:center;gap:4px;flex-wrap:wrap;}
.lkdv-challenge-meta span{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;background:rgba(23,43,36,.06);font:500 10px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);white-space:nowrap;}
.lkdv-challenge-meta .lkdv-challenge-xp{background:rgba(185,138,46,.15);color:#7A5A17;font-weight:600;}
.lkdv-challenge-bar{height:5px;border-radius:999px;background:rgba(23,43,36,.08);overflow:hidden;}
.lkdv-challenge-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#96B391,#3D7A52);transition:width .35s cubic-bezier(.3,1,.4,1);}
.lkdv-challenge-deadline{margin:0;font:500 10.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-comm-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:14px;background:rgba(255,255,255,.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.06);font:600 12.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label,#172B24);cursor:pointer;text-align:left;}
.lkdv-comm-toggle svg{width:14px;height:14px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .25s ease;}
.lkdv-comm-toggle[aria-expanded="true"] svg{transform:rotate(180deg);}
.lkdv-comm-toggle:focus-visible{outline:none;box-shadow:inset 0 0 0 1.5px rgba(23,64,44,.45),inset 0 1px 0 #fff;}
.lkdv-comm-done{opacity:.92;}
@media (prefers-reduced-motion:reduce){.lkdv-challenge-bar span,.lkdv-comm-toggle svg{transition:none;}}
`;

let communityStylesInjected = false;

function useCommunitySlotStyles() {
  React.useInsertionEffect(() => {
    if (communityStylesInjected || typeof document === 'undefined') return;
    if (document.head.querySelector('style[data-lkdv-community]')) {
      communityStylesInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.setAttribute('data-lkdv-community', '');
    style.textContent = COMMUNITY_SLOT_CSS;
    document.head.appendChild(style);
    communityStylesInjected = true;
  }, []);
}

function CommunityEmpty({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="lkdv-slot-state" data-state="empty">
      <span className="lkdv-slot-state-ico" aria-hidden="true">
        {icon}
      </span>
      {children}
    </div>
  );
}

function ChallengesLens({ challenges }: { challenges: Challenge[] }) {
  const [doneOpen, setDoneOpen] = React.useState(false);
  const titleId = React.useId();
  const doneId = React.useId();

  const active = challenges.filter((challenge) => challenge.active !== false && !challenge.completed);
  const done = challenges.filter((challenge) => challenge.active !== false && challenge.completed);

  return (
    <div className="lkdv-comm">
      <section className="lkdv-comm-section" aria-labelledby={titleId}>
        <div className="lkdv-comm-head">
          <h3 className="lkdv-comm-title" id={titleId}>
            En cours
          </h3>
          {active.length > 0 ? (
            <span className="lkdv-comm-count" aria-label={`${active.length} défis en cours`}>
              {active.length}
            </span>
          ) : null}
        </div>

        {active.length > 0 ? (
          <ul className="lkdv-challenge-list">
            {active.map((challenge) => (
              <ChallengeRow key={challenge.id} challenge={challenge} />
            ))}
          </ul>
        ) : (
          <CommunityEmpty icon="○">
            <p>Aucun défi en cours.</p>
          </CommunityEmpty>
        )}
      </section>

      {done.length > 0 ? (
        <section className="lkdv-comm-section" aria-label="Défis terminés">
          <button
            type="button"
            className="lkdv-comm-toggle"
            aria-expanded={doneOpen}
            aria-controls={doneId}
            onClick={() => setDoneOpen((open) => !open)}
          >
            <span>Terminés ({done.length})</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {doneOpen ? (
            <ul className="lkdv-challenge-list lkdv-comm-done" id={doneId}>
              {done.map((challenge) => (
                <ChallengeRow key={challenge.id} challenge={challenge} completed />
              ))}
            </ul>
          ) : (
            <span id={doneId} hidden />
          )}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Slot Communauté — lentilles Défis, Clubs et Cordée.
 *
 * Le contenu vient exclusivement du payload réel du bootstrap ; les états
 * vides sont explicites et aucune donnée de démonstration n'est créée ici.
 */
export function CommunitySlot({ lens, payload, challenges }: CommunitySlotProps) {
  useCommunitySlotStyles();
  const resolvedLens: CommunityLens = COMMUNITY_LENSES.includes(lens as CommunityLens)
    ? (lens as CommunityLens)
    : 'challenges';
  const challengeItems = listFromPayload(challenges, payload, 'challenges');
  const empty = resolvedLens === 'challenges' && challengeItems.length === 0;

  return (
    <div
      className="lkdv-comm-root"
      data-testid="slot-content"
      data-slot="communaute"
      data-lens={resolvedLens}
      data-state={empty ? 'empty' : 'ready'}
    >
      {resolvedLens === 'challenges' ? <ChallengesLens challenges={challengeItems} /> : null}
      {resolvedLens === 'clubs' ? (
        <CommunityEmpty icon="○">
          <p>Aucun club.</p>
        </CommunityEmpty>
      ) : null}
      {resolvedLens === 'cordee' ? (
        <CommunityEmpty icon="○">
          <p>Aucune sortie partagée.</p>
        </CommunityEmpty>
      ) : null}
    </div>
  );
}

export default CommunitySlot;
