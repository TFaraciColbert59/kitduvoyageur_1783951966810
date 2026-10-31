'use client';

import React from 'react';
import Link from 'next/link';
import { ChallengeRow, type Challenge } from '../cards/ChallengeRow';
import { pluralizeCommunity } from '../cards/communityFormat';
import { ClubCard, type Club } from '../cards/ClubCard';
import { ClubDrawer } from '../ClubDrawer';
import {
  CompanionRow,
  type Companion,
  type CommunityPerson,
} from '../cards/CompanionRow';

export type CommunityLens = 'challenges' | 'clubs' | 'cordee';

export interface CommunitySlotProps {
  lens?: CommunityLens | string;
  /** Payload du bootstrap (`challenges`, `clubs`, `companions`…). */
  payload?: unknown;
  /** Raccourcis de test/intégration : prioritaires sur le payload. */
  challenges?: Challenge[];
  clubs?: Club[];
  companions?: Companion[];
  followers?: CommunityPerson[];
  following?: CommunityPerson[];
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
.lkdv-challenge-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#96B391,#3D7A52);transition:width .35s var(--ease-glass);}
.lkdv-challenge-deadline{margin:0;font:500 10.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-comm-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:14px;background:rgba(255,255,255,.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.06);font:600 12.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label,#172B24);cursor:pointer;text-align:left;}
.lkdv-comm-toggle svg{width:14px;height:14px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .25s ease;}
.lkdv-comm-toggle[aria-expanded="true"] svg{transform:rotate(180deg);}
.lkdv-comm-toggle:focus-visible{outline:none;box-shadow:inset 0 0 0 1.5px rgba(23,64,44,.45),inset 0 1px 0 #fff;}
.lkdv-comm-done{opacity:.92;}
.lkdv-comm-link{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;margin-top:2px;border-radius:999px;background:var(--pg,rgba(150,186,142,.5));box-shadow:var(--pg-sh,inset 0 1px 0 rgba(255,255,255,.6));font:600 13px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--pg-ink,#17402C);text-decoration:none;}
.lkdv-club-rail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:2px;padding:2px 2px 10px;margin:0 -2px;touch-action:pan-x pan-y;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.lkdv-club-rail::-webkit-scrollbar{display:none;}
.lkdv-club-item{display:flex;min-width:0;scroll-snap-align:start;}
.lkdv-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
.lkdv-club-card{box-sizing:border-box;width:100%;min-height:184px;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:12px 13px 11px;border:0;border-radius:20px;text-align:left;background:linear-gradient(165deg,rgba(255,255,255,.72),rgba(236,244,233,.6));box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.09),0 6px 16px rgba(23,43,36,.06);color:var(--label,#172B24);cursor:pointer;transition:transform .22s var(--ease-spring),box-shadow .22s;}
.lkdv-club-card:active{transform:scale(.98);}
.lkdv-club-card:focus-visible{outline:none;box-shadow:inset 0 0 0 1.6px rgba(23,64,44,.5),inset 0 1px 0 #fff,0 6px 16px rgba(23,43,36,.08);}
.lkdv-club-top{display:flex;align-items:center;gap:7px;min-width:0;}
.lkdv-club-badge{width:32px;height:32px;flex:none;display:grid;place-items:center;border-radius:11px;background:linear-gradient(180deg,#fff,#DDEBD8);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);font:700 14px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--tint,#17402C);}
.lkdv-club-badge-lg{width:44px;height:44px;border-radius:14px;font-size:18px;}
.lkdv-club-role{display:inline-flex;align-items:center;height:22px;max-width:100%;padding:0 8px;border-radius:999px;background:rgba(61,122,82,.12);font:600 10.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--good,#3D7A52);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-club-name{font:700 16px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;}
.lkdv-club-cat{font:500 10.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-club-members{font:400 11px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-club-next{display:flex;flex-direction:column;gap:1px;margin-top:5px;padding:6px 8px;border-radius:12px;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.85);min-width:0;}
.lkdv-club-next-label{font:600 9px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:.05em;text-transform:uppercase;color:var(--label2,#56665D);}
.lkdv-club-next b{font:600 11.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-club-next small{font:400 10px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-club-open{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:auto;padding-top:5px;font:600 11px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--tint,#17402C);}
.lkdv-club-open svg{width:14px;height:14px;flex:none;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-club-panel{box-sizing:border-box;width:100%;max-height:94%;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:11px;padding:7px 14px calc(14px + env(safe-area-inset-bottom,0px));border-radius:26px 26px 0 0;background:linear-gradient(180deg,rgba(250,249,245,.99),rgba(243,243,237,.99));box-shadow:0 -10px 34px rgba(23,43,36,.22),inset 0 1px 0 #fff;color:var(--label,#172B24);}
.lkdv-club-panel:focus{outline:none;}
.lkdv-club-grab{width:38px;height:5px;flex:none;margin:0 auto 1px;border-radius:99px;background:rgba(23,43,36,.18);}
.lkdv-club-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;}
.lkdv-club-head-txt{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px;}
.lkdv-club-title{margin:0;max-width:100%;font:700 20px/1.15 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-club-close{width:44px;height:44px;flex:none;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.68);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);color:var(--label,#172B24);cursor:pointer;}
.lkdv-club-close:active{transform:scale(.94);}
.lkdv-club-close svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;}
.lkdv-club-members-line{display:flex;align-items:baseline;gap:5px;margin:0;padding:0 1px;color:var(--label2,#56665D);font:500 12px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);}
.lkdv-club-members-line b{font:700 24px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:-.03em;color:var(--label,#172B24);font-variant-numeric:tabular-nums;}
.lkdv-club-sec{display:flex;flex-direction:column;gap:5px;}
.lkdv-club-sec-title{margin:0;font:600 11px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--label2,#56665D);}
.lkdv-club-event{display:flex;flex-direction:column;gap:8px;padding:9px 10px;border-radius:16px;background:rgba(255,255,255,.6);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.07);}
.lkdv-club-event-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
.lkdv-club-event-txt{min-width:0;}
.lkdv-club-event-title{margin:0;font:600 14.5px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);}
.lkdv-club-event-meta{margin:2px 0 0;font:400 10.5px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-club-attendance{flex:none;display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:999px;background:rgba(61,122,82,.12);font:600 10.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--good,#3D7A52);white-space:nowrap;font-variant-numeric:tabular-nums;}
.lkdv-rsvp{display:flex;gap:5px;}
.lkdv-rsvp-btn{flex:1;min-width:0;min-height:44px;padding:0 6px;border:0;border-radius:12px;background:rgba(255,255,255,.56);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.09);font:600 11.5px/1.1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label,#172B24);cursor:pointer;}
.lkdv-rsvp-btn[aria-pressed="true"]{background:var(--pg,rgba(150,186,142,.5));color:var(--pg-ink,#17402C);box-shadow:var(--pg-sh,inset 0 1px 0 rgba(255,255,255,.6));}
.lkdv-rsvp-btn:focus-visible,.lkdv-club-btn:focus-visible,.lkdv-club-close:focus-visible{outline:none;box-shadow:inset 0 0 0 1.6px rgba(23,64,44,.5),inset 0 1px 0 #fff;}
.lkdv-club-topics,.lkdv-club-kits,.lkdv-club-safety{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;}
.lkdv-club-topic,.lkdv-club-kit{display:flex;align-items:center;gap:7px;min-height:34px;padding:4px 9px;border-radius:12px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 0 0 .5px rgba(23,43,36,.06);font:500 12px/1.25 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);}
.lkdv-club-topic-title,.lkdv-club-kit-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lkdv-club-pin{flex:none;font:600 9px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:.04em;text-transform:uppercase;color:#7A5A17;background:rgba(185,138,46,.15);padding:3px 6px;border-radius:999px;}
.lkdv-club-kit-ico{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:7px;background:rgba(150,186,142,.24);color:var(--tint,#17402C);font:700 10px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);}
.lkdv-club-kit small{flex:none;font:500 10px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-club-safety li{position:relative;padding:0 0 0 14px;font:400 11.5px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-club-safety li::before{content:"";position:absolute;left:2px;top:6px;width:5px;height:5px;border-radius:50%;background:var(--good,#3D7A52);}
.lkdv-club-empty{margin:0;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.34);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.06);font:400 11.5px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-club-actions{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:5px;}
.lkdv-club-btn{min-height:44px;padding:0 8px;border:0;border-radius:999px;background:rgba(255,255,255,.64);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);font:600 12px/1.1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label,#172B24);cursor:pointer;}
.lkdv-club-btn.primary{background:var(--pg,rgba(150,186,142,.5));color:var(--pg-ink,#17402C);box-shadow:var(--pg-sh,inset 0 1px 0 rgba(255,255,255,.6));}
.lkdv-club-btn.danger{background:rgba(168,68,58,.1);color:var(--bad,#A8443A);}
.lkdv-club-btn:active{transform:scale(.97);}
.lkdv-club-notice{min-height:15px;margin:0;font:500 11px/1.3 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-comm-hint{font:400 11px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)!important;color:var(--label2,#56665D)!important;max-width:250px!important;}
.lkdv-cordee-trust{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;padding:10px 12px;border-radius:18px;background:linear-gradient(135deg,rgba(236,244,233,.92),rgba(255,255,255,.52));box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(91,127,85,.22),0 4px 12px rgba(23,43,36,.05);}
.lkdv-cordee-shield{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:50%;background:rgba(61,122,82,.13);color:var(--good,#3D7A52);}
.lkdv-cordee-shield svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
.lkdv-cordee-trust-txt{min-width:0;}
.lkdv-cordee-trust-txt b{display:block;font:600 12.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label,#172B24);}
.lkdv-cordee-trust-txt p{margin:2px 0 0;font:400 10.5px/1.35 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-cordee-people{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.lkdv-cordee-stat{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:9px 11px;border-radius:16px;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.07);}
.lkdv-cordee-stat-label{font:500 11px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);}
.lkdv-cordee-stat b{font:700 19px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);letter-spacing:-.02em;color:var(--tint,#17402C);font-variant-numeric:tabular-nums;}
.lkdv-companion-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;}
.lkdv-companion{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:62px;padding:7px 10px 7px 7px;border-radius:17px;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.07),0 3px 9px rgba(23,43,36,.04);}
.lkdv-companion-avatar{position:relative;width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:50%;overflow:hidden;background:linear-gradient(155deg,#fff,#DDEBD8);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);color:var(--tint,#17402C);}
.lkdv-companion-initial{font:700 15px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);}
.lkdv-companion-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
.lkdv-companion-txt{min-width:0;display:flex;flex-direction:column;gap:1px;}
.lkdv-companion-name{margin:0;font:600 13px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label,#172B24);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-companion-handle{font:400 10.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lkdv-companion-meta{min-width:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px;text-align:right;}
.lkdv-companion-outings{display:inline-flex;align-items:center;height:19px;padding:0 7px;border-radius:999px;background:rgba(61,122,82,.12);font:600 9.5px/1 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--good,#3D7A52);white-space:nowrap;}
.lkdv-companion-massif{max-width:104px;font:500 9.5px/1.2 var(--sf,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--label2,#56665D);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
@media (prefers-reduced-motion:reduce){.lkdv-challenge-bar span,.lkdv-comm-toggle svg,.lkdv-club-card,.lkdv-club-btn{transition:none;}.lkdv-club-card:active,.lkdv-club-btn:active,.lkdv-club-close:active{transform:none;}}
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
            <span
              className="lkdv-comm-count"
              aria-label={`${pluralizeCommunity(active.length, 'défi')} en cours`}
            >
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

function ClubsLens({ clubs }: { clubs: Club[] }) {
  const titleId = React.useId();
  const [openClubId, setOpenClubId] = React.useState<string | null>(null);
  const openClub = openClubId ? clubs.find((club) => club.id === openClubId) ?? null : null;
  const closeDrawer = React.useCallback(() => setOpenClubId(null), []);

  if (clubs.length === 0) {
    return (
      <div className="lkdv-comm">
        <CommunityEmpty icon="○">
          <p>Aucun club.</p>
          <Link className="lkdv-comm-link" href="/clubs">
            Découvrir des clubs
          </Link>
        </CommunityEmpty>
      </div>
    );
  }

  return (
    <div className="lkdv-comm">
      <div className="lkdv-comm-head">
        <h3 className="lkdv-comm-title" id={titleId}>
          Mes clubs
        </h3>
        <span className="lkdv-comm-count" aria-label={pluralizeCommunity(clubs.length, 'club')}>
          {clubs.length}
        </span>
      </div>

      <div
        className="lkdv-club-rail overflow-x-auto snap-x snap-mandatory"
        data-testid="club-rail"
        data-hscroll="true"
        role="list"
        aria-label="Clubs"
        style={{ touchAction: 'pan-x pan-y' }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} onOpen={(selected) => setOpenClubId(selected.id)} />
        ))}
      </div>

      {openClub ? <ClubDrawer club={openClub} onClose={closeDrawer} /> : null}
    </div>
  );
}

function CordeeLens({
  companions,
  followers,
  following,
}: {
  companions: Companion[];
  followers: CommunityPerson[];
  following: CommunityPerson[];
}) {
  const titleId = React.useId();

  return (
    <div className="lkdv-comm">
      <div className="lkdv-cordee-trust" role="note">
        <span className="lkdv-cordee-shield" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 3.5 19 6v6c0 4.2-2.8 7.3-7 8.5-4.2-1.2-7-4.3-7-8.5V6l7-2.5Z" />
            <path d="m9 12 2 2 4-4.2" />
          </svg>
        </span>
        <div className="lkdv-cordee-trust-txt">
          <b>Cordée de confiance</b>
          <p>
            Les compagnons de ta cordée partagent une sortie réelle avec toi. Aucun contact
            n&apos;est suggéré sans sortie commune.
          </p>
        </div>
      </div>

      <div className="lkdv-cordee-people" role="group" aria-label="Abonnés et abonnements">
        <div className="lkdv-cordee-stat">
          <span className="lkdv-cordee-stat-label">Abonnés</span>
          <b data-testid="cordee-followers-count">{followers.length}</b>
        </div>
        <div className="lkdv-cordee-stat">
          <span className="lkdv-cordee-stat-label">Abonnements</span>
          <b data-testid="cordee-following-count">{following.length}</b>
        </div>
      </div>

      <section className="lkdv-comm-section" aria-labelledby={titleId}>
        <div className="lkdv-comm-head">
          <h3 className="lkdv-comm-title" id={titleId}>
            Compagnons de cordée
          </h3>
          {companions.length > 0 ? (
            <span
              className="lkdv-comm-count"
              aria-label={pluralizeCommunity(companions.length, 'compagnon')}
            >
              {companions.length}
            </span>
          ) : null}
        </div>

        {companions.length > 0 ? (
          <ul className="lkdv-companion-list">
            {companions.map((companion) => (
              <CompanionRow key={companion.id} companion={companion} />
            ))}
          </ul>
        ) : (
          <CommunityEmpty icon="○">
            <p>Aucune sortie partagée.</p>
            <p className="lkdv-comm-hint">
              Les compagnons apparaissent après une sortie réelle en commun.
            </p>
          </CommunityEmpty>
        )}
      </section>
    </div>
  );
}

/**
 * Slot Communauté — lentilles Défis, Clubs et Cordée.
 *
 * Le contenu vient exclusivement du payload réel du bootstrap ; les états
 * vides sont explicites et aucune donnée de démonstration n'est créée ici.
 */
export function CommunitySlot({
  lens,
  payload,
  challenges,
  clubs,
  companions,
  followers,
  following,
}: CommunitySlotProps) {
  useCommunitySlotStyles();
  const resolvedLens: CommunityLens = COMMUNITY_LENSES.includes(lens as CommunityLens)
    ? (lens as CommunityLens)
    : 'challenges';
  const challengeItems = listFromPayload(challenges, payload, 'challenges');
  const clubItems = listFromPayload(clubs, payload, 'clubs');
  const companionItems = listFromPayload(companions, payload, 'companions');
  const followerItems = listFromPayload(followers, payload, 'followers');
  const followingItems = listFromPayload(following, payload, 'following');
  // `data-state` reflète ce qui est réellement rendu après filtrage :
  // un défi terminé reste visible (section repliée), un défi inactif non.
  const visibleChallenges = challengeItems.filter((challenge) => challenge.active !== false);
  const empty =
    resolvedLens === 'challenges'
      ? visibleChallenges.length === 0
      : resolvedLens === 'clubs'
        ? clubItems.length === 0
        : companionItems.length === 0;

  return (
    <div
      data-testid="slot-content"
      data-slot="communaute"
      data-lens={resolvedLens}
      data-state={empty ? 'empty' : 'ready'}
    >
      {resolvedLens === 'challenges' ? <ChallengesLens challenges={challengeItems} /> : null}
      {resolvedLens === 'clubs' ? <ClubsLens clubs={clubItems} /> : null}
      {resolvedLens === 'cordee' ? (
        <CordeeLens
          companions={companionItems}
          followers={followerItems}
          following={followingItems}
        />
      ) : null}
    </div>
  );
}

export default CommunitySlot;
