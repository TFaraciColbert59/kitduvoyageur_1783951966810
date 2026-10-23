'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { requestCarnetPublicationAward } from '@/lib/progression-award-requests';
import { fetchMyTripsCached } from '@/features/trips/client/fetchMyTrips';
import { initCompteLiquidGlassRuntime } from './compte-liquid-glass-v8-runtime';
import type {
  SlotId,
  Viewer,
  Visibility,
} from './drawer/ProfileDrawerHost';
import { DRAWER_V2_CSS, type SlotContentState } from './drawer/SlotShell';
import { useCompteMapContext } from './map/useCompteMapContext';
import { CompteOverlayHost } from './overlay/CompteOverlayHost';
import './overlay/compte-drawers.css';
import {
  accountVisibilityUpdate,
  signatureVisibilityForValue,
  toAccountVisibility,
  PROFILE_VISIBILITY_EVENT,
  type ProfileVisibilityEventDetail,
  type SignatureVisibility,
} from '@/features/compte/data/accountVisibility';
import {
  persistProfileVisibility,
  rejectProfileVisibility,
} from '@/features/compte/data/profileVisibilityBridge';
import {
  mapProfileRuntimeVisibility,
  persistSignatureVisibility,
  signatureVisibilityIndex,
} from '@/features/compte/data/accountBootstrap';
import {
  SIGNATURE_VISIBILITY_EVENT,
  type SignatureVisibilityEventDetail,
} from './drawer/slots/VitrineSlot';

const CompteMap = dynamic(
  () => import('./map/CompteMap').then((mod) => mod.CompteMap),
  { ssr: false }
);
const ProfileDrawerHost = dynamic(
  () => import('./drawer/ProfileDrawerHost').then((mod) => mod.ProfileDrawerHost),
  { ssr: false }
);
const ReseauDrawer = dynamic(
  () => import('./drawer/reseau/ReseauDrawer').then((mod) => mod.ReseauDrawer),
  { ssr: false }
);
const SortieDrawer = dynamic(
  () => import('./drawer/sortie/SortieDrawer').then((mod) => mod.SortieDrawer),
  { ssr: false }
);
const CompteDrawer = dynamic(
  () => import('./drawer/compte/CompteDrawer').then((mod) => mod.CompteDrawer),
  { ssr: false }
);
const FirstRunJourney = dynamic(
  () => import('./onboarding/FirstRunJourney').then((mod) => mod.FirstRunJourney),
  { ssr: false }
);

const COMPTE_V8_CSS = ".lkdv-compte-v8{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}.lkdv-compte-v8{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}\n\n\r\n/* Layout : iPhone iOS 27 clair sur le vrai fond LKDV. 60 % haut = étape courante, 40 % bas = carte vivante\r\n   (agrandissable). Barre d'onglets flottante + accessoire. Feuilles linéaires à 3 hauteurs. */\r\n.lkdv-compte-v8{\r\n  --page:#F5F2EC;--on-page:#172B24;--muted-page:#56665D;--rule:#A6C1A0;\r\n  --sf:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"SF Pro Display\",\"Inter\",system-ui,\"Segoe UI\",Roboto,sans-serif;\r\n}\r\n@media (prefers-color-scheme:dark){.lkdv-compte-v8:not([data-theme=\"light\"]){--page:#0e1210;--on-page:#ecede8;--muted-page:#97a39a;--rule:#5B7F55;color-scheme:dark}}\r\n.lkdv-compte-v8[data-theme=\"dark\"]{--page:#0e1210;--on-page:#ecede8;--muted-page:#97a39a;--rule:#5B7F55;color-scheme:dark}\r\n*{box-sizing:border-box}\r\n.lkdv-compte-v8{background:var(--page);color:var(--on-page);font-family:var(--sf);padding-inline:16px;padding-block:16px;-webkit-font-smoothing:antialiased}\r\n.stage{max-width:960px;margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr);gap:48px;align-items:start;justify-content:center}\r\n.pwrap{position:relative;width:390px;height:844px;margin:0 auto}\r\n.notes{padding-top:30px;display:flex;flex-direction:column;gap:13px;min-width:0}\r\n.notes h1{font:700 32px/1.08 var(--sf);letter-spacing:-.02em;margin:0;text-wrap:balance}\r\n.notes p{margin:0;color:var(--muted-page);line-height:1.5;max-width:48ch;font-size:15px}\r\n.notes .tag{font:600 12px var(--sf);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-page)}\r\n.notes ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}\r\n.notes li{font-size:14px;line-height:1.42;padding-left:13px;border-left:2px solid var(--rule)}\r\n.notes li b{font-weight:600}\r\n@media (max-width:860px){.stage{grid-template-columns:minmax(0,1fr)}.notes{display:none}}\r\n\r\n/* ---------- iPhone (clair) ---------- */\r\n.phone{\r\n  --label:#172B24;--label2:#56665D;--label3:rgba(23,43,36,.44);--sep:rgba(23,43,36,.1);\r\n  --fill:rgba(23,43,36,.09);--fill2:rgba(23,43,36,.06);--fill3:rgba(255,255,255,.62);\r\n  --tint:#17402C;--tint-ink:#fff;--accent:#5B7F55;--subtle:#A6C1A0;--mint:#EBF2EC;\r\n  --good:#3D7A52;--warn:#B98A2E;--warn-bg:#FBF1DC;--bad:#A8443A;--bad-bg:#F5DDD9;--info:#4B6B7C;--water:#3F93B8;\r\n  --ga:.19;--gb:7px;--la:140deg;\r\n  --pg:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.16) 52%,rgba(255,255,255,.3)),rgba(150,186,142,.34);--pg-ink:#17402C;\r\n  --pg-sh:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.4),inset 0 0 0 .6px rgba(255,255,255,.5),0 0 0 .6px rgba(23,64,44,.16),0 5px 14px rgba(23,64,44,.13);\r\n  --soft:rgba(150,186,142,.28);--soft-line:rgba(91,127,85,.38);\r\n  position:absolute;left:0;top:0;width:390px;height:844px;transform-origin:0 0;border-radius:54px;overflow:hidden;\r\n  background:#cfd6c8;color:var(--label);font-family:var(--sf);font-size:14px;letter-spacing:-.01em;\r\n  box-shadow:0 0 0 8px #10130f,0 0 0 9px rgba(0,0,0,.2),0 30px 70px rgba(23,43,36,.28);isolation:isolate;\r\n  display:grid;grid-template-rows:calc(60% - 49px) 1fr;grid-template-columns:minmax(0,1fr);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;\r\n  transition:grid-template-rows .55s cubic-bezier(.32,.72,0,1)}\r\n.phone.mapbig{grid-template-rows:172px 1fr}\r\n.phone.outdoor{--ga:.9;--gb:30px;--label2:#2f3f37;--label3:rgba(23,43,36,.7);font-size:15px}\r\n.phone button,.phone input{font-family:inherit;letter-spacing:inherit;color:inherit}\r\n.phone :focus-visible{outline:2px solid var(--accent);outline-offset:2px}\r\n\r\n/* Vrai fond LKDV */\r\n.bg{position:absolute;inset:0;z-index:-1;background-size:cover;background-position:center 30%;filter:brightness(1.1) saturate(1.05)}\r\n.bg::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,250,236,.08),rgba(255,255,255,0) 30%,rgba(245,242,236,.12) 60%)}\r\n\r\n/* Barre d'état + Dynamic Island */\r\n.status{position:absolute;top:0;left:0;right:0;height:50px;display:flex;justify-content:space-between;align-items:center;padding:4px 30px 0 38px;font:600 16px var(--sf);color:#fff;z-index:30;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.25)}\r\n.status .r{display:flex;gap:6px;align-items:center}\r\n.island{position:absolute;top:11px;left:50%;width:124px;height:36px;margin-left:-62px;border-radius:20px;background:#000;z-index:40;overflow:hidden;color:#fff;\r\n  transition:width .5s cubic-bezier(.32,1.25,.4,1),height .5s cubic-bezier(.32,1.25,.4,1),margin-left .5s cubic-bezier(.32,1.25,.4,1),border-radius .5s}\r\n.island[data-s=live]{width:232px;margin-left:-116px}\r\n.island[data-s=note]{width:366px;margin-left:-183px;height:auto;min-height:70px;border-radius:32px}\r\n.island .is{opacity:0;transition:opacity .2s;display:flex;align-items:center;gap:10px;height:100%;padding:0 14px;white-space:nowrap}\r\n.island[data-s=live] .is.live,.island[data-s=note] .is.note{opacity:1;transition-delay:.16s}\r\n.island .is.live{justify-content:space-between;font:600 12.5px var(--sf);position:absolute;inset:0}\r\n.island .is.live .ic{color:#A6C1A0}\r\n.island .is.note{padding:13px 12px 13px 18px;white-space:normal;min-height:70px}\r\n.island[data-s=idle] .is,.island[data-s=live] .is.note{display:none}\r\n.island[data-s=note] .is.live{display:none}\r\n.is.note .t{flex:1;min-width:0}.is.note b{display:block;font:600 14.5px/1.25 var(--sf);color:#fff}\r\n.is.note span{display:block;font:500 12px/1.35 var(--sf);color:rgba(255,255,255,.72);margin-top:2px;font-variant-numeric:tabular-nums}\r\n.is.note button{flex:none;height:32px;padding:0 13px;border-radius:999px;border:0;background:rgba(255,255,255,.16);color:#A6C1A0!important;font:600 13px var(--sf);cursor:pointer}\r\n\r\n/* ---------- Liquid Glass clair (iOS 27 : plus transparent, bords assombris, reflets vifs) ---------- */\r\n.lg{position:relative;background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .14)),rgba(255,255,255,calc(var(--ga) - .04)) 50%,rgba(255,255,255,calc(var(--ga) + .06)));\r\n  -webkit-backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07);backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07);\r\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 1px rgba(255,255,255,.45),inset 1px 0 1px rgba(255,255,255,.28),inset -1px 0 1px rgba(255,255,255,.28),inset 0 0 12px rgba(255,255,255,.14),0 0 0 .5px rgba(23,43,36,.14),0 8px 22px rgba(23,43,36,.12)}\r\n.refr .lg.lens-on{-webkit-backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07)}\r\n.lg::before{content:\"\";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;\r\n  background:conic-gradient(from var(--la),rgba(255,255,255,1),rgba(255,255,255,.25) 18%,rgba(255,255,255,0) 32%,rgba(255,255,255,.7) 50%,rgba(255,255,255,0) 68%,rgba(255,255,255,.25) 82%,rgba(255,255,255,1));\r\n  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}\r\n.lg>*{position:relative;z-index:1}\r\n.cs{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .2)));-webkit-backdrop-filter:blur(calc(var(--gb) + 18px)) saturate(1.8) brightness(1.05);backdrop-filter:blur(calc(var(--gb) + 18px)) saturate(1.8) brightness(1.05);\r\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.4),inset 0 0 16px rgba(255,255,255,.12),0 0 0 .5px rgba(23,43,36,.12),0 10px 30px rgba(23,43,36,.14)}\r\n@media (prefers-reduced-transparency:reduce){.lg,.cs{background:#FBFAF6!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}}\r\n\r\n/* Icônes */\r\n.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}\r\n.ic.s{width:16px;height:16px}.ic.xs{width:12px;height:12px;stroke-width:2.2}\r\n.ic .f{fill:currentColor;stroke:none}\r\n\r\n/* ---------- Zone haute ---------- */\r\n.top{position:relative;min-height:0;min-width:0;padding:54px 12px 8px;display:flex;flex-direction:column;gap:7px}\r\n.head{display:flex;gap:7px;align-items:center;flex:none}\r\n.steps{flex:1;height:42px;border-radius:999px;display:grid;grid-template-columns:repeat(5,1fr);padding:3px;position:relative}\r\n.steps .lens{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/5);border-radius:999px;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.3));\r\n  box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.1);transition:transform .5s cubic-bezier(.3,1.3,.4,1)}\r\n.steps button{position:relative;z-index:2;border:0;background:none;color:rgba(23,43,36,.74);display:grid;place-items:center;cursor:pointer;border-radius:999px;min-height:36px}\r\n.steps button[aria-current=step]{color:var(--tint)}\r\n.steps button[aria-current=step] .ic{stroke-width:2.1}\r\n.steps .dot{position:absolute;bottom:3px;width:3px;height:3px;border-radius:50%;background:var(--accent);opacity:0}\r\n.steps button.done .dot{opacity:.9}\r\n.gbtn{width:42px;height:42px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;flex:none;color:var(--label)}\r\n.gbtn.sm{width:32px;height:32px}\r\n.card{flex:1;min-height:0;border-radius:26px;padding:13px 14px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;scrollbar-width:none;transition:transform .3s cubic-bezier(.3,1.2,.4,1),opacity .2s}\r\n.card::-webkit-scrollbar{display:none}\r\n.card>*{flex:none}\r\n.mapbig .card{display:none}\r\n.acts{display:flex;gap:7px;flex:none}\r\n.pbtn{flex:1;min-width:0;height:42px;border-radius:999px;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;padding:0 16px;\r\n  background:var(--pg);color:var(--pg-ink)!important;font:600 14.5px var(--sf);-webkit-backdrop-filter:blur(10px) saturate(1.9);backdrop-filter:blur(10px) saturate(1.9);\r\n  box-shadow:var(--pg-sh);transition:transform .25s cubic-bezier(.3,1.5,.5,1)}\r\n.pbtn .ic{color:var(--accent)}\r\n.pbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.pbtn:active,.gbtn:active,.mbtn:active,.chip:active,.nx:active{transform:scale(1.04)}\r\n.pbtn[disabled]{background:var(--fill);color:var(--label2)!important;box-shadow:none;cursor:default}\r\n\r\n/* Typo */\r\n.t2{font:700 19px/1.2 var(--sf);letter-spacing:-.02em;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.hl{font:600 15px/1.25 var(--sf)}\r\n.sub{font:400 12.5px/1.3 var(--sf);color:var(--label2)}\r\n.cap{font:600 11.5px/1.2 var(--sf);color:var(--label2);text-transform:uppercase;letter-spacing:.04em}\r\n.num{font-variant-numeric:tabular-nums}\r\n.row{display:flex;align-items:center;gap:7px;min-width:0}\r\n.ai{color:var(--accent);display:inline-flex;vertical-align:-1px}\r\n.ed{color:var(--warn);display:inline-flex;vertical-align:-1px}\r\n.fd{display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 5px 1px 0;vertical-align:middle;flex:none}\r\n.fd.ok{background:var(--good)}.fd.old{background:var(--label3)}.fd.none{box-shadow:inset 0 0 0 1.4px var(--label3)}\r\n\r\n/* Contrôles iOS (réduits) */\r\n.intent{display:flex;align-items:center;gap:8px;height:36px;border-radius:999px;padding:0 12px;background:var(--fill2);color:var(--label2)}\r\n.intent input{flex:1;min-width:0;background:none;border:0;color:var(--label);font:400 14.5px var(--sf);outline:none;height:34px}\r\n.intent input::placeholder{color:var(--label3)}\r\n.segc{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;height:30px;border-radius:999px;background:var(--fill);padding:2px}\r\n.segc button{position:relative;z-index:2;border:0;background:none;color:var(--label);font:500 12.5px var(--sf);cursor:pointer;border-radius:999px;padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.segc button[aria-pressed=true]{font-weight:600}\r\n.segc .th{position:absolute;z-index:1;top:2px;bottom:2px;left:2px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(23,43,36,.14),0 3px 8px rgba(23,43,36,.08);transition:transform .45s cubic-bezier(.3,1.3,.4,1)}\r\n.chips{display:flex;flex-wrap:wrap;gap:5px}\r\n.chip{height:28px;padding:0 11px;border-radius:999px;border:0;background:var(--fill);color:var(--label);font:500 12.5px var(--sf);display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;transition:transform .15s,background .2s}\r\n.chip[aria-pressed=true]{background:var(--soft);color:var(--tint)!important;font-weight:600;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6)}\r\n.chip[disabled]{opacity:.35;cursor:default}\r\n.chip.st{cursor:default;background:var(--fill2)}\r\n.mbtn{height:30px;padding:0 12px;border-radius:999px;border:0;background:var(--fill);color:var(--label);font:600 12.5px var(--sf);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;transition:transform .15s}\r\n.mbtn.p{background:var(--pg);color:var(--pg-ink)!important;box-shadow:var(--pg-sh)}\r\n.mbtn.soft{background:var(--mint);color:var(--tint)!important}\r\n.mbtn[disabled]{opacity:.45;cursor:default}\r\n.lnk{border:0;background:none;color:var(--accent)!important;font:500 12.5px var(--sf);cursor:pointer;padding:4px 2px}\r\n.stp{display:inline-flex;align-items:center;height:28px;border-radius:8px;background:var(--fill);flex:none}\r\n.stp button{width:36px;height:28px;border:0;background:none;display:grid;place-items:center;cursor:pointer}\r\n.stp button[disabled]{opacity:.3;cursor:default}\r\n.stp i{width:1px;height:16px;background:var(--sep)}\r\n.sw{width:46px;height:28px;border-radius:999px;border:0;background:var(--fill);position:relative;cursor:pointer;flex:none;transition:background .25s;padding:0}\r\n.sw::after{content:\"\";position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.22);transition:transform .35s cubic-bezier(.3,1.4,.5,1)}\r\n.sw[aria-checked=true]{background:#8DB287}.sw[aria-checked=true]::after{transform:translateX(18px)}\r\n.sumline{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 11px;border-radius:14px;background:var(--fill2);font-size:13px}\r\n.sumline b{font-weight:600}.sumline>span{min-width:0}.sumline .nw{white-space:nowrap;flex:none}\r\n.input{height:32px;border-radius:9px;border:0;background:var(--fill);padding:0 10px;font:400 14px var(--sf);color:var(--label);outline:none;min-width:0}\r\n.input::placeholder{color:var(--label3)}\r\n\r\n/* Curseur d'échelle continu */\r\n.ruler{border-radius:18px;padding:5px 12px 4px}\r\n.rhead{display:flex;justify-content:space-between;align-items:baseline;font:600 12px var(--sf);color:var(--label2)}\r\n.rhead b{font:700 15px var(--sf);color:var(--label);font-variant-numeric:tabular-nums}\r\n.ruler input{-webkit-appearance:none;appearance:none;display:block;width:100%;height:26px;background:none;margin:0;cursor:pointer;touch-action:pan-y}\r\n.ruler input::-webkit-slider-runnable-track{height:4px;border-radius:99px;background:linear-gradient(90deg,#8DB287 var(--p),rgba(23,43,36,.14) var(--p))}\r\n.ruler input::-moz-range-track{height:4px;border-radius:99px;background:linear-gradient(90deg,#8DB287 var(--p),rgba(23,43,36,.14) var(--p))}\r\n.ruler input::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:20px;margin-top:-8px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(23,43,36,.28),inset 0 0 0 .5px rgba(0,0,0,.08)}\r\n.ruler input::-moz-range-thumb{width:30px;height:20px;border:0;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(23,43,36,.28)}\r\n.ticks{position:relative;height:15px;font:500 10px var(--sf);color:var(--label3)}\r\n.ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap;cursor:pointer;transition:color .2s}\r\n.ticks span:hover{color:var(--tint)}\r\n.zc{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:var(--mint);color:var(--tint);font:600 11px/16px var(--sf)}\r\n.zc.bump{animation:zb .35s cubic-bezier(.3,1.6,.5,1)}@keyframes zb{40%{transform:scale(1.15)}}\r\n.fsum{border-radius:18px;padding:2px 0;display:flex;flex-direction:column}\r\n.fr{display:grid;grid-template-columns:24px auto minmax(0,1fr) 12px;align-items:center;gap:8px;height:29px;padding:0 10px 0 9px;border:0;background:none;cursor:pointer;text-align:left;color:var(--label)}\r\n.fr+.fr{box-shadow:inset 36px .5px 0 -36px transparent;border-top:.5px solid var(--sep);margin-left:0}\r\n.fr .fi{width:24px;height:24px;border-radius:8px;background:var(--mint);color:var(--tint);display:grid;place-items:center}\r\n.fr .fi svg{width:15px;height:15px}\r\n.fr .fl{font:600 13px var(--sf)}\r\n.fr .fv{font:400 12.5px var(--sf);color:var(--label2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:flex-end;gap:5px}\r\n.fr>svg:last-child{color:var(--label3)}\r\n.fr:active{background:var(--fill2)}\r\n.srcrow{display:flex;flex-wrap:wrap;gap:5px}\r\n.srcrow .chip{height:24px;font-size:11.5px;padding:0 9px;cursor:default;background:var(--fill2)}\r\n\r\n/* Nous */\r\n.av{display:flex;align-items:center;gap:5px}\r\n.avi{position:relative;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:600 12.5px var(--sf);color:#17402C;flex:none;background:linear-gradient(160deg,#EBF2EC,#A6C1A0);box-shadow:0 0 0 1.5px #fff}\r\n.avi.sm{width:24px;height:24px;font-size:10.5px}\r\n.avi .on{position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;background:var(--good);box-shadow:0 0 0 2px #fff}\r\n.avi .lv{position:absolute;left:-3px;top:-4px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:rgba(255,255,255,.85);color:var(--tint);box-shadow:0 0 0 .6px var(--soft-line);font:700 8.5px/14px var(--sf);text-align:center}\r\n.avadd{width:30px;height:30px;border-radius:50%;border:1.3px dashed rgba(23,43,36,.35);background:rgba(255,255,255,.5);color:var(--label);display:grid;place-items:center;cursor:pointer;flex:none}\r\n.bigsum{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}.bigsum b{font:700 21px var(--sf);letter-spacing:-.02em}\r\n.bar{height:5px;border-radius:99px;background:var(--fill);overflow:hidden;display:flex}\r\n.bar i{display:block;height:100%;border-radius:99px;transition:width .5s,background .3s}\r\n\r\n/* Résa */\r\n.tchips{display:flex;gap:5px}\r\n.tchip{flex:1;min-width:0;height:44px;border-radius:14px;border:0;background:var(--fill2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;position:relative;font:500 10px var(--sf);color:var(--label2)}\r\n.tchip .ic{width:17px;height:17px;color:var(--label)}\r\n.tchip.on{background:var(--soft);box-shadow:inset 0 0 0 1px var(--soft-line)}\r\n.tchip[disabled]{opacity:.35;cursor:default}\r\n.tchip .bd{position:absolute;top:3px;right:5px;min-width:15px;height:15px;border-radius:8px;background:rgba(141,178,135,.55);color:var(--tint);font:700 9.5px/15px var(--sf);padding:0 4px}\r\n.days{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}\r\n.day{border-radius:14px;background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .6px rgba(23,43,36,.1);padding:7px 7px 8px;display:flex;flex-direction:column;gap:5px;cursor:pointer;border:0;text-align:left;min-width:0}\r\n.day b{font:700 12.5px var(--sf)}.day small{font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.slots{display:flex;gap:3px;flex-wrap:wrap}\r\n.slot{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font:700 9.5px var(--sf);background:var(--fill);color:var(--label2)}\r\n.slot.added{background:#fff;color:var(--tint);box-shadow:inset 0 0 0 1.2px var(--tint)}.slot.pending{background:var(--warn-bg);color:var(--warn)}.slot.confirmed{background:rgba(61,122,82,.2);color:var(--good)}\r\n.slot.need{background:transparent;box-shadow:inset 0 0 0 1.2px var(--warn);color:var(--warn)}\r\n.disc{font:400 11px/1.3 var(--sf);color:var(--label3)}\r\n\r\n/* Verdict */\r\n.verdict{display:flex;gap:12px;align-items:center}\r\n.ring{position:relative;flex:none;width:76px;height:76px}\r\n.ring svg{transform:rotate(-90deg)}\r\n.ring .n{position:absolute;inset:0;display:grid;place-items:center;align-content:center;font:700 24px var(--sf);text-align:center;letter-spacing:-.03em}\r\n.ring small{display:block;font:500 9.5px var(--sf);color:var(--label2);letter-spacing:0}\r\n.vl{display:inline-flex;align-items:center;gap:6px;font:600 14px var(--sf)}\r\n.vl i{width:8px;height:8px;border-radius:50%;background:var(--c)}\r\n.why{margin:4px 0 0;padding:0;list-style:none;display:grid;gap:2px;font-size:12.5px;color:var(--label2);line-height:1.3}\r\n.why li{display:flex;align-items:baseline}\r\n.vb{padding:8px 11px;border-radius:14px;background:var(--fill2);display:flex;flex-direction:column;gap:3px}\r\n.vb .h{display:flex;align-items:center;gap:7px;font:600 11.5px var(--sf);color:var(--label2)}\r\n.vb p{margin:0;font-size:13px;line-height:1.3}\r\n.pd{width:6px;height:6px;border-radius:50%;background:var(--good);animation:pulse 1.6s infinite;flex:none}\r\n@keyframes pulse{50%{opacity:.3}}\r\n\r\n/* Kit */\r\n.weights{display:flex;height:6px;border-radius:999px;overflow:hidden;gap:2px}\r\n.weights i{display:block;transition:flex .4s}\r\n.wl{display:flex;justify-content:space-between;margin-top:4px;font:500 11.5px var(--sf);color:var(--label2)}\r\n.wl span::before{content:\"\";display:inline-block;width:6px;height:6px;border-radius:2px;background:var(--c);margin-right:5px}\r\n.ready{display:flex;justify-content:space-between;align-items:center}\r\n.ready b{font:700 21px var(--sf);letter-spacing:-.02em}\r\n.mb{display:grid;grid-template-columns:24px 1fr 78px;gap:8px;align-items:center;font:500 11.5px var(--sf);color:var(--label2)}\r\n.mb b{font-weight:500;text-align:right;color:var(--label)}\r\n\r\n/* ---------- Feuilles linéaires à 3 hauteurs ---------- */\r\n.sw-wrap{position:absolute;inset:0;z-index:20;pointer-events:none}\r\n.scrim{position:absolute;inset:0;background:rgba(255,255,255,.06);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .35s;pointer-events:none}\r\n.sw-wrap[data-det=large] .scrim{opacity:1;pointer-events:auto}\r\n.sheet{position:absolute;left:8px;right:8px;top:100%;bottom:-70%;border-radius:32px;display:flex;flex-direction:column;gap:7px;padding:0 13px 11px;pointer-events:auto;\r\n  background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .4)),rgba(255,255,255,calc(var(--ga) + .3)) 40%,rgba(255,255,255,calc(var(--ga) + .34)));-webkit-backdrop-filter:blur(calc(var(--gb) + 22px)) saturate(1.9) brightness(1.06);backdrop-filter:blur(calc(var(--gb) + 22px)) saturate(1.9) brightness(1.06);\r\n  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.5),inset 1px 0 1px rgba(255,255,255,.35),inset -1px 0 1px rgba(255,255,255,.35),inset 0 0 22px rgba(255,255,255,.18),0 0 0 .5px rgba(23,43,36,.12),0 -8px 36px rgba(23,43,36,.16);\r\n  transition:top .5s cubic-bezier(.32,.72,0,1),bottom .5s cubic-bezier(.32,.72,0,1),left .5s cubic-bezier(.32,.72,0,1),right .5s cubic-bezier(.32,.72,0,1),border-radius .5s}\r\n.sw-wrap[data-det=peek] .sheet{top:calc(60% - 49px - 128px);bottom:calc(40% + 57px)}\r\n.sw-wrap[data-det=medium] .sheet{top:48px;bottom:calc(40% + 57px)}\r\n.sw-wrap[data-det=large] .sheet{top:46px;bottom:8px;left:8px;right:8px;border-radius:44px}\r\n.sw-wrap[data-det=closed] .sheet{visibility:hidden;transition:top .45s cubic-bezier(.32,.72,0,1),bottom .45s cubic-bezier(.32,.72,0,1),visibility 0s .45s}\r\n.grab{height:18px;display:grid;place-items:center;cursor:grab;touch-action:none;flex:none;margin:0 -13px}\r\n.grab span{width:36px;height:5px;border-radius:3px;background:rgba(23,43,36,.2)}\r\n.sh-h{display:flex;align-items:center;gap:8px;flex:none;margin-top:-4px;touch-action:none}\r\n.sh-h h3{flex:1;min-width:0;margin:0;text-align:center;font:600 16px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.peekline{flex:none;font:400 13px var(--sf);color:var(--label2);text-align:center;display:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.sw-wrap[data-det=peek] .peekline{display:block}\r\n.sw-wrap[data-det=peek] .flow,.sw-wrap[data-det=peek] .sh-b,.sw-wrap[data-det=peek] .sh-f{display:none}\r\n.flow{flex:none;display:flex;align-items:center;gap:4px;justify-content:center}\r\n.flow button{height:24px;min-width:24px;border-radius:999px;border:0;background:rgba(255,255,255,.3);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1);color:var(--label2);font:600 11px var(--sf);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0;transition:all .35s cubic-bezier(.3,1.3,.4,1)}\r\n.flow button.done{background:rgba(255,255,255,.45);color:var(--good);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1)}\r\n.flow button.cur{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh);padding:0 10px 0 4px}\r\n.flow button.cur i{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.7);display:grid;place-items:center;font-style:normal;font-size:10px}\r\n.flow .ln{width:8px;height:1.5px;background:var(--sep);border-radius:1px}\r\n.sh-b{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}\r\n.sw-wrap[data-det=large] .sh-b{overflow-y:auto}\r\n.lh{display:flex;justify-content:space-between;align-items:center;min-height:26px;margin-bottom:2px}\r\n.lh .pg{display:flex;align-items:center;gap:3px;font:500 11.5px var(--sf);color:var(--label2)}\r\n.lh .pg button{width:26px;height:26px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer}\r\n.lh .pg button[disabled]{opacity:.3;cursor:default}\r\n.sh-f{flex:none;display:flex;gap:6px;align-items:center}\r\n.say{flex:1;min-width:0;height:34px;border-radius:999px;background:var(--fill);display:flex;align-items:center;gap:6px;padding:0 11px;color:var(--accent)}\r\n.say input{flex:1;min-width:0;border:0;background:none;color:var(--label);font:400 14px var(--sf);outline:none;height:32px}\r\n.say input::placeholder{color:var(--label3)}\r\n.bk{width:34px;height:34px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer;flex:none}\r\n.bk[disabled]{opacity:.3;cursor:default}\r\n.nx{height:34px;padding:0 13px;border-radius:999px;border:0;background:var(--pg);box-shadow:var(--pg-sh);color:var(--pg-ink)!important;-webkit-backdrop-filter:blur(8px) saturate(1.8);backdrop-filter:blur(8px) saturate(1.8);transition:transform .25s cubic-bezier(.3,1.5,.5,1);font:600 13px var(--sf);cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex:none;white-space:nowrap}\r\n\r\n/* Lignes de liste */\r\n.li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:6px 2px;min-height:46px;border-top:.5px solid var(--sep);transition:background .3s}\r\n.li:first-child,.lh+.li,.swr:first-child .li{border-top:0}\r\n.li.nt{grid-template-columns:1fr auto}\r\n.li.hi{background:var(--mint);border-radius:12px;box-shadow:inset 0 0 0 1px rgba(91,127,85,.4)}\r\n.li .ttl{font:600 14px/1.25 var(--sf);display:flex;align-items:center;gap:5px;min-width:0}\r\n.li .ttl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.li .s2{font:400 12px/1.3 var(--sf);color:var(--label2);margin-top:1px}\r\n.li .rt{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right}\r\n.li .rt b{font:600 14px var(--sf);font-variant-numeric:tabular-nums}\r\n.li .rt small{font:400 10.5px var(--sf);color:var(--label3)}\r\n.tg{font:500 10.5px var(--sf);padding:2px 7px;border-radius:999px;background:var(--fill);color:var(--label2);white-space:nowrap;display:inline-flex;align-items:center}\r\n.tg.p{color:var(--tint);background:var(--mint)}\r\n.tg.added{color:var(--tint)}.tg.pending{color:var(--warn);background:var(--warn-bg)}.tg.confirmed{color:var(--good);background:rgba(61,122,82,.14)}\r\n.tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;align-items:center}\r\n.ck{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--label3);display:grid;place-items:center;transition:.2s;flex:none}\r\n.li[aria-checked=true] .ck{background:var(--good);box-shadow:none}\r\n.li[aria-checked=true] .ck::after{content:\"\";width:6px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}\r\n.vit{font:600 9.5px var(--sf);color:var(--warn);text-transform:uppercase;letter-spacing:.03em;flex:none}\r\n.rbar{display:grid;grid-template-columns:128px 1fr 26px;gap:9px;align-items:center;padding:4px 0;font-size:13px}\r\n.rbar small{display:block;font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap}\r\n.rbar .t{height:5px;border-radius:99px;background:var(--fill);overflow:hidden}.rbar .t i{display:block;height:100%;border-radius:99px;background:var(--c)}\r\n.rbar b{font:600 12.5px var(--sf);text-align:right;font-variant-numeric:tabular-nums}\r\n.wx{display:grid;grid-template-columns:1fr 1fr;gap:7px}\r\n.wx div{padding:9px 11px;border-radius:14px;background:var(--fill2);font-size:12.5px;color:var(--label2);line-height:1.45}\r\n.wx b{display:block;font:600 14px var(--sf);color:var(--label)}\r\n.note{font:400 12px/1.35 var(--sf);color:var(--label2);padding:6px 2px 0}\r\n.grid2{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}\r\n.tile2{border:0;border-radius:14px;background:var(--fill2);min-height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:500 11.5px var(--sf);cursor:pointer;position:relative;padding:4px}\r\n.tile2[aria-pressed=true]{background:var(--soft);color:var(--tint)!important;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6);font-weight:600}\r\n.tile2 .ai{position:absolute;top:4px;right:5px}\r\n.tile2[aria-pressed=true] .ai{color:var(--accent)}\r\n.win{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px 10px;border-radius:14px;background:var(--fill2);cursor:pointer;border:0;text-align:left;width:100%;margin-bottom:6px}\r\n.win[aria-pressed=true]{background:var(--mint);box-shadow:inset 0 0 0 1.2px var(--accent)}\r\n.win .wxr{display:flex;gap:2px;color:var(--label2)}\r\n.qd{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}\r\n\r\n/* Cartes d'offres */\r\n.oc{position:relative;display:grid;grid-template-columns:50px 1fr auto;gap:10px;align-items:center;padding:8px;border-radius:18px;background:rgba(255,255,255,.52);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.05);margin-bottom:6px;transition:box-shadow .3s}\r\n.oc.hi{box-shadow:0 0 0 1.5px var(--accent),0 3px 10px rgba(23,43,36,.08)}\r\n.oc-img{width:50px;height:50px;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(150deg,hsl(var(--h),38%,58%),hsl(calc(var(--h) + 30),42%,36%));box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}\r\n.oc-img .ic{width:22px;height:22px}\r\n.oc-t{display:flex;align-items:center;gap:6px;min-width:0}.oc-t b{font:600 13.5px var(--sf);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.rate{font:600 11px var(--sf);color:var(--warn);white-space:nowrap;flex:none}.rate small{color:var(--label3);font-weight:400}\r\n.oc-s{font:400 11.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}\r\n.oc-c{display:flex;gap:3px;margin-top:4px;flex-wrap:wrap;height:17px;overflow:hidden}\r\n.oc-c span{font:500 10px/13px var(--sf);padding:2px 6px;border-radius:6px;background:var(--fill2);color:var(--label2);white-space:nowrap}\r\n.oc-c .st{background:var(--mint);color:var(--tint);font-weight:600}.oc-c .st.pending{background:var(--warn-bg);color:#7a5a17}.oc-c .st.confirmed{background:rgba(61,122,82,.16);color:var(--good)}\r\n.oc-r{display:flex;flex-direction:column;align-items:flex-end;gap:2px}\r\n.oc-r b{font:700 15px var(--sf);font-variant-numeric:tabular-nums}.oc-r small{font:400 10px var(--sf);color:var(--label3)}\r\n.burst{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:var(--pg);box-shadow:var(--pg-sh);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--tint);display:grid;place-items:center;pointer-events:none;animation:burst .7s cubic-bezier(.3,1.5,.5,1) forwards;z-index:5}\r\n@keyframes burst{0%{transform:scale(.2);opacity:0}35%{transform:scale(1.15);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.4);opacity:0}}\r\n\r\n/* Lignes glissables (geste Instagram / iOS) */\r\n.swr{position:relative;overflow:hidden;border-radius:12px}\r\n.swr .act{position:absolute;right:0;top:4px;bottom:4px;width:82px;border:0;border-radius:14px;background:rgba(168,68,58,.86);color:#fff!important;font:600 12.5px var(--sf);cursor:pointer;opacity:0;transition:opacity .2s}\r\n.swr.open .act,.swr.drag .act{opacity:1}\r\n.swr .fg{position:relative;background:rgba(250,251,248,.001);transition:transform .3s cubic-bezier(.3,1.2,.4,1);touch-action:pan-y}\r\n.swr.drag .fg{transition:none}\r\n.swr.open .fg,.swr.drag .fg{background:rgba(247,249,245,.96)}\r\n\r\n/* ---------- Carte claire personnalisable ---------- */\r\n.mapzone{position:relative;min-height:0;min-width:0}\r\n.map{position:absolute;inset:0;border-radius:32px 32px 0 0;overflow:hidden;background:#E9EDE0;touch-action:none;box-shadow:0 -1px 0 rgba(255,255,255,.8),0 -10px 26px rgba(23,43,36,.18)}\r\n#tm{display:none!important}.map svg.tm{display:none!important}\r\n.map .tmg{transition:transform .5s cubic-bezier(.3,1,.4,1)}\r\n.map.dragging .tmg{transition:none}\r\n.mgrab{position:absolute;top:6px;left:50%;width:44px;height:14px;margin-left:-22px;border:0;background:none;display:grid;place-items:center;cursor:pointer;z-index:4;touch-action:none}\r\n.mgrab span{width:34px;height:4px;border-radius:2px;background:rgba(23,43,36,.28)}\r\n.mctl{position:absolute;right:10px;top:14px;display:flex;flex-direction:column;border-radius:21px;z-index:3;overflow:hidden}\r\n.mctl button{width:38px;height:36px;border:0;background:none;display:grid;place-items:center;cursor:pointer}\r\n.mctl button+button{box-shadow:0 -.5px 0 var(--sep)}\r\n.mopts{position:absolute;right:12px;bottom:124px;width:300px;border-radius:26px;padding:10px 10px 8px;z-index:30;opacity:0;transform:scale(.55) translateY(30px);transform-origin:bottom right;pointer-events:none;transition:opacity .18s,transform .42s cubic-bezier(.3,1.35,.5,1);display:flex;flex-direction:column;gap:8px}\r\n.mopts.on{opacity:1;transform:none;pointer-events:auto}\r\n.mopts.up{bottom:auto;top:440px;transform-origin:top right}\r\n.mo-h{display:flex;align-items:baseline;justify-content:space-between;padding:0 4px}\r\n.mo-h b{font:600 15px var(--sf)}\r\n.mgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}\r\n.mt{border:0;border-radius:16px;background:var(--fill);height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:var(--label2)!important;transition:background .2s,color .2s,transform .2s cubic-bezier(.3,1.4,.5,1)}\r\n.mt span{font:500 10.5px var(--sf);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 3px}\r\n.mt[aria-checked=true]{background:var(--soft);color:var(--tint)!important;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6)}\r\n.mt:active{transform:scale(.93)}\r\n.mo-f{display:flex;justify-content:space-between;padding:0 4px}\r\n.callout{position:absolute;left:10px;right:10px;bottom:132px;padding:8px 8px 8px 12px;border-radius:20px;z-index:4;display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;transition:bottom .45s cubic-bezier(.32,.72,0,1)}\r\n.tabmin .callout{bottom:78px}\r\n.noacc .callout{bottom:84px}\r\n.callout[hidden]{display:none}\r\n.callout b{font:600 13.5px var(--sf);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}\r\n.callout .s2{font:400 11.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;grid-column:1}\r\n.callout .ca{grid-row:1/3;grid-column:2;display:flex;gap:5px;align-items:center}\r\n.callout .ib{width:30px;height:30px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer}\r\n.callout .ib.p{background:var(--pg);color:var(--pg-ink)!important;box-shadow:var(--pg-sh)}\r\n.anim .seg{stroke-dasharray:1;animation:drawseg .24s var(--d,0s) both linear}\r\n.anim .pop{animation:popin .42s var(--d,0s) both cubic-bezier(.3,1.5,.5,1);transform-box:fill-box;transform-origin:center}\r\n@keyframes drawseg{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}\r\n@keyframes popin{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}\r\n.focusring{animation:ring 1.4s ease-out infinite;transform-box:fill-box;transform-origin:center}\r\n@keyframes ring{from{opacity:.9;transform:scale(.6)}to{opacity:0;transform:scale(1.8)}}\r\n\r\n/* ---------- Barre d'onglets + accessoire ---------- */\r\n.tabbar{position:absolute;left:0;right:0;bottom:0;height:0;z-index:12}\r\n.tb{position:absolute;left:14px;right:14px;bottom:24px;height:54px;border-radius:999px;display:grid;grid-template-columns:repeat(5,1fr);padding:3px;touch-action:none;\r\n  transition:left .5s cubic-bezier(.32,.72,0,1),right .5s cubic-bezier(.32,.72,0,1),height .5s cubic-bezier(.32,.72,0,1)}\r\n.tb .lens{position:absolute;top:4px;bottom:4px;left:3px;width:calc((100% - 6px)/5);border-radius:999px;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.22));\r\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.4),0 0 0 .5px rgba(23,43,36,.06);transition:transform .55s cubic-bezier(.3,1.35,.4,1),background .25s,box-shadow .25s}\r\n.tb.drag .lens{transition:transform .08s linear,background .25s,box-shadow .25s;background:rgba(255,255,255,.08);\r\n  box-shadow:inset 0 1.5px 1px rgba(255,255,255,.95),inset 0 -1.5px 2px rgba(255,255,255,.6),inset 2px 0 2px rgba(255,120,160,.18),inset -2px 0 2px rgba(90,170,255,.2),0 0 0 .5px rgba(23,43,36,.1),0 10px 26px rgba(23,43,36,.2)}\r\n.tb.drag .lens{top:-7px;bottom:-7px}\r\n.tb button{position:relative;z-index:2;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font:500 10px var(--sf);cursor:pointer;border-radius:999px;letter-spacing:0;color:var(--label)}\r\n.tb button .ic{width:19px;height:19px}\r\n.tb button.on{color:#2F6B45;font-weight:600}\r\n.tb button.on .ic{stroke-width:2.1}\r\n.tb.drag button{transition:transform .2s}.tb.drag button.hov{transform:scale(1.14)}\r\n.acc{position:absolute;left:14px;right:14px;bottom:84px;height:42px;border-radius:999px;display:flex;align-items:center;gap:9px;padding:0 8px 0 4px;\r\n  transition:left .5s cubic-bezier(.32,.72,0,1),bottom .5s cubic-bezier(.32,.72,0,1),opacity .3s}\r\n.acc .ab{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);display:grid;place-items:center;cursor:pointer;flex:none}\r\n.acc .ro{flex:none;width:86px;display:flex;flex-direction:column;line-height:1.1}\r\n.acc .ro b{font:600 13.5px var(--sf);font-variant-numeric:tabular-nums;white-space:nowrap}\r\n.acc .ro span{font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.acc svg.spk{flex:1;min-width:0;height:28px;overflow:visible;cursor:ew-resize;touch-action:none}\r\n.noacc .acc{opacity:0;pointer-events:none}\r\n.tabmin .tb{right:calc(100% - 14px - 50px);height:50px;grid-template-columns:1fr}\r\n.tabmin .tb button:not(.on){display:none}\r\n.tabmin .tb .lens{display:none}\r\n.tabmin .acc{left:72px;bottom:28px}\r\n.home{position:absolute;bottom:8px;left:50%;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:rgba(23,43,36,.55);z-index:25;pointer-events:none}\r\n\r\n/* ---------- Menus iOS : aperçu, réglages, pilule de rôle ---------- */\r\n.ctx{position:absolute;inset:0;z-index:35;display:grid;place-items:center;padding:24px;background:rgba(245,242,236,.35);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .25s}\r\n.ctx.on{opacity:1;pointer-events:auto}\r\n.ctx .box{width:100%;max-width:310px;display:flex;flex-direction:column;gap:8px;transform:scale(.92);transition:transform .35s cubic-bezier(.3,1.4,.5,1)}\r\n.ctx.on .box{transform:none}\r\n.ctx .pv{border-radius:22px;padding:13px 15px}\r\n.ctx .pv b{display:block;font:600 15px var(--sf);margin-bottom:5px}\r\n.ctx .ef{display:flex;justify-content:space-between;padding:5px 0;border-top:.5px solid var(--sep);font-size:13.5px}\r\n.ctx .ef:first-of-type{border-top:0}\r\n.ctx .ef span:last-child{font-weight:600;font-variant-numeric:tabular-nums}\r\n.ctx .menu{border-radius:18px;overflow:hidden}\r\n.ctx .menu button{display:flex;justify-content:space-between;align-items:center;width:100%;height:44px;padding:0 15px;border:0;background:none;font:400 15px var(--sf);cursor:pointer}\r\n.ctx .menu button+button{box-shadow:0 -.5px 0 var(--sep)}\r\n.ctx .menu button.p{color:var(--tint);font-weight:600}\r\n.popv{position:absolute;right:12px;top:102px;width:262px;border-radius:22px;padding:4px 13px;z-index:34;opacity:0;transform:scale(.9) translateY(-8px);transform-origin:top right;pointer-events:none;transition:opacity .2s,transform .35s cubic-bezier(.3,1.4,.5,1)}\r\n.popv.on{opacity:1;transform:none;pointer-events:auto}\r\n.popv .pr{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;border-top:.5px solid var(--sep)}\r\n.popv .pr:first-child{border-top:0}\r\n.popv input[type=range]{width:100%;accent-color:#17402C}\r\n.popv .lbl2{display:flex;justify-content:space-between;font:400 11.5px var(--sf);color:var(--label2);padding-bottom:6px}\r\n.rmenu{position:absolute;z-index:38;border-radius:999px;overflow:hidden;pointer-events:none;opacity:0;\r\n  transition:left .45s cubic-bezier(.3,1.25,.4,1),top .45s cubic-bezier(.3,1.25,.4,1),width .45s cubic-bezier(.3,1.25,.4,1),height .45s cubic-bezier(.3,1.25,.4,1),border-radius .45s,opacity .15s}\r\n.rmenu.on{pointer-events:auto;opacity:1;border-radius:20px}\r\n.rmenu .ri{opacity:0;filter:blur(6px);transition:opacity .25s .12s,filter .3s .12s;padding:5px}\r\n.rmenu.on .ri{opacity:1;filter:none}\r\n.rmenu button{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 10px;border:0;border-radius:12px;background:none;font:500 13.5px var(--sf);cursor:pointer;white-space:nowrap}\r\n.rmenu button[aria-checked=true]{background:var(--soft);color:var(--tint);font-weight:600}\r\n.rp{transition:transform .35s cubic-bezier(.3,1.5,.5,1)}\r\n.rp.morph{animation:morph .5s cubic-bezier(.3,1.4,.5,1)}\r\n@keyframes morph{0%{transform:scaleX(1.18) scaleY(.86);filter:blur(2px)}50%{transform:scaleX(.95) scaleY(1.06);filter:none}100%{transform:none}}\r\n@keyframes bump{40%{transform:scale(1.06)}}\r\n.bump{animation:bump .3s}\r\n@media (prefers-reduced-motion:reduce){.pd{animation:none}.anim .seg,.anim .pop,.burst,.rp.morph{animation:none}*{transition-duration:.01s!important}}\r\n.chips.rail{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent);padding-right:24px;touch-action:pan-x}\r\n.chips.rail::-webkit-scrollbar{display:none}\r\n.chips.rail .chip{flex:none}\r\n.lh .pg{white-space:nowrap;flex:none}\r\n.lh>.cap{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n/* barres de verre au-dessus du fond : couche lumineuse pour garder le contraste (verre « regular » adaptatif) */\r\n.head .steps.lg,.head .gbtn.lg,.acts .gbtn.lg{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .14)) 55%,rgba(255,255,255,calc(var(--ga) + .22)))}\r\n\r\n/* ================= v6 : produits ================= */\r\n.pth{--s:58px;width:var(--s);height:var(--s);border-radius:16px;flex:none;display:grid;place-items:center;position:relative;overflow:hidden;\r\n  background:radial-gradient(120% 90% at 30% 20%,#fff 0,var(--bgc) 55%,hsl(var(--h) 26% 80%) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -6px 12px hsla(var(--h),30%,40%,.12),0 0 0 .5px rgba(23,43,36,.08)}\r\n.pth::after{content:\"\";position:absolute;left:18%;right:18%;bottom:12%;height:9%;border-radius:50%;background:hsla(var(--h),30%,25%,.14);filter:blur(2px)}\r\n.pth .pic{width:58%;height:58%;fill:none;stroke:hsl(var(--h) 34% 30%);stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;position:relative;z-index:1;filter:drop-shadow(0 1px 0 rgba(255,255,255,.8))}\r\n.pth.sm{--s:36px;border-radius:11px}.pth.xs{--s:26px;border-radius:8px}.pth.xs::after,.pth.sm::after{display:none}.pth.xl{--s:92px;border-radius:24px}.pth.xl .pic{stroke-width:1.1}\r\n.pth .ic{color:var(--accent)}\r\n.pc{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 9px 8px 8px;border-radius:20px;margin-bottom:6px;position:relative;\r\n  background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.05);transition:transform .25s cubic-bezier(.3,1.4,.5,1),box-shadow .25s}\r\n.pc.on{box-shadow:inset 0 0 0 1.2px var(--soft-line),inset 0 1px 0 #fff,0 3px 10px rgba(23,43,36,.06);background:rgba(236,244,233,.7)}\r\n.swr .pc{margin-bottom:0}.swr{margin-bottom:6px}\r\n.pc.lpress,.li.lpress,.pick.lpress{transform:scale(.97)}\r\n.pb{min-width:0;display:flex;flex-direction:column;gap:2px}\r\n.pbr{display:flex;align-items:center;gap:6px;font:600 10.5px var(--sf);letter-spacing:.05em;text-transform:uppercase;color:var(--label2);min-width:0}\r\n.pbr>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.pn{font:600 14px/1.2 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.pnx{font:700 18px/1.2 var(--sf);letter-spacing:-.01em;margin-top:2px;text-wrap:balance}\r\n.psp{display:flex;gap:3px;flex-wrap:wrap;height:17px;overflow:hidden}\r\n.psp span{font:500 10px/13px var(--sf);padding:2px 6px;border-radius:6px;background:rgba(23,43,36,.06);color:var(--label2);white-space:nowrap}\r\n.pm{font:400 11px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:4px;align-items:center;min-width:0}\r\n.pw{display:inline-flex;align-items:center;gap:4px;color:#8a6418;font:500 11px var(--sf);white-space:normal;line-height:1.25}\r\n.pown{display:inline-flex;align-items:center;gap:5px;min-width:0;overflow:hidden;text-overflow:ellipsis}\r\n.fit{font:600 10px var(--sf);letter-spacing:0;text-transform:none;padding:1px 6px;border-radius:99px;flex:none}\r\n.fit.g{background:rgba(61,122,82,.14);color:var(--good)}.fit.o{background:var(--warn-bg);color:#8a6418}.fit.b{background:var(--bad-bg);color:var(--bad)}\r\n.prr{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right}\r\n.prr b{font:700 15px var(--sf);font-variant-numeric:tabular-nums;white-space:nowrap}.prr b i{font-style:normal;font-weight:500;font-size:11px;color:var(--label2)}\r\n.prr small{font:400 10px var(--sf);color:var(--label3);white-space:nowrap}\r\n.cd{font:600 10px var(--sf);letter-spacing:0;text-transform:none;padding:1px 7px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;flex:none}\r\n.cd::before{content:\"\";width:5px;height:5px;border-radius:50%;background:currentColor}\r\n.cd.g{background:rgba(61,122,82,.12);color:var(--good)}.cd.o{background:var(--warn-bg);color:#8a6418}.cd.b{background:var(--bad-bg);color:var(--bad)}\r\n.pbad{font:500 10.5px var(--sf);padding:1px 7px;border-radius:99px;white-space:nowrap}\r\n.pbad.o{background:var(--warn-bg);color:#7a5a17}.pbad.s{background:var(--soft);color:var(--tint)}\r\n.ib2{width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.55);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);display:grid;place-items:center;cursor:pointer;color:var(--label2)}\r\n.pc.custom .input{height:30px;font-size:13px}\r\n.need{display:flex;gap:9px;align-items:center;padding:7px 9px;border-radius:16px;background:rgba(255,255,255,.42);box-shadow:inset 0 1px 0 #fff;margin-bottom:7px}\r\n.need b{display:flex;align-items:center;gap:6px;font:600 13.5px var(--sf)}.need span{display:block;font:400 11.5px/1.3 var(--sf);color:var(--label2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\r\n.phero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:13px;align-items:center;margin-bottom:10px}\r\n.sgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}\r\n.sgrid div{padding:7px 10px;border-radius:14px;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);min-width:0}\r\n.sgrid small{display:block;font:500 10.5px var(--sf);color:var(--label2)}.sgrid b{display:block;font:600 13.5px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}\r\n.stats3 div{padding:10px;border-radius:16px;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 #fff;text-align:center}\r\n.stats3 b{display:block;font:700 21px var(--sf);letter-spacing:-.02em}.stats3 small{font:500 11px var(--sf);color:var(--label2)}\r\n.menu2{border-radius:18px;background:rgba(255,255,255,.4);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.06);overflow:hidden}\r\n.mi{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:6px 12px;border:0;background:none;text-align:left;font:500 13.5px var(--sf);color:var(--label);cursor:pointer}\r\n.mi+.mi{border-top:.5px solid var(--sep)}\r\n.mi>span{flex:1;min-width:0}.mi>b{font:600 13px var(--sf)}.mi .ic{color:var(--accent);flex:none}\r\n.mi.col{flex-direction:column;align-items:stretch;gap:6px;padding:8px 12px}.mi.col .row{gap:10px}.mi.col .chips .chip{height:26px;font-size:12px}\r\n.mi.bad,.mi.bad .ic{color:var(--bad)}.mi.dis{color:var(--label2);cursor:default}.mi[disabled]{opacity:.5;cursor:default}\r\n.cmp{display:grid;grid-template-columns:60px 1fr 1fr;gap:4px 8px;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.45);font-size:12.5px;align-items:baseline}\r\n.cmp b{font:600 11.5px var(--sf);color:var(--label2)}.cmp>span:nth-child(3n+1){color:var(--label2);font-size:11.5px}.cmp em{font-style:normal;font-size:10.5px;font-weight:600}.cmp em.g{color:var(--good)}.cmp em.o{color:#8a6418}\r\n.rbig{display:flex;align-items:center;gap:12px;margin-bottom:8px}.rbig>b{font:700 34px var(--sf);letter-spacing:-.03em}\r\n.stars{color:#C99A3B;font-size:15px;letter-spacing:1px}.rbig small{display:block;font:400 11.5px var(--sf);color:var(--label2)}\r\n.li.kr{grid-template-columns:auto auto minmax(0,1fr) auto}\r\n.mq .ttl .pth{margin-right:2px}\r\n.pick{display:flex;align-items:center;gap:8px;margin-top:6px;padding:5px 6px 5px 5px;border-radius:12px;background:rgba(236,244,233,.75);box-shadow:inset 0 0 0 .8px var(--soft-line);transition:transform .25s}\r\n.pick b{display:block;font:600 12.5px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pick small{display:block;font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.pick>span:not(.pth){flex:1;min-width:0}\r\n.chip .cnt{font:600 10px var(--sf);min-width:16px;height:16px;line-height:16px;border-radius:8px;background:rgba(255,255,255,.7);color:var(--label2);text-align:center;padding:0 4px;margin-left:2px}\r\nbutton.mb{border:0;background:none;padding:2px 0;width:100%;cursor:pointer;text-align:left;border-radius:10px}\r\nbutton.mb:active{background:var(--fill2)}\r\n\r\n/* ================= v6 : sacs de chacun ================= */\r\n.bagsel{display:flex;gap:5px;margin-bottom:6px}\r\n.bagsel button{flex:1;min-width:0;border:0;border-radius:14px;background:rgba(255,255,255,.3);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08);padding:5px 2px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font:600 11px var(--sf);color:var(--label)}\r\n.bagsel button small{font:500 10px var(--sf);color:var(--label2)}\r\n.bagsel button[aria-pressed=true]{background:var(--pg);box-shadow:var(--pg-sh)}\r\n.bagv{display:grid;grid-template-columns:118px minmax(0,1fr);gap:12px;align-items:center}\r\n.bagsvg{width:118px;height:154px;filter:drop-shadow(0 6px 10px rgba(23,43,36,.12))}\r\n.bl{display:grid;grid-template-columns:10px 1fr auto;gap:6px;align-items:center;font:500 12px var(--sf);padding:1.5px 0}\r\n.bl i{width:10px;height:10px;border-radius:3px}.bl b{font-weight:600;font-size:12px}\r\n.bagrows{display:grid;gap:2px}\r\n.bi{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:5px 2px;border-top:.5px solid var(--sep)}\r\n.bi:first-child{border-top:0}.bi b{display:block;font:600 13px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bi small{display:block;font:400 11px var(--sf);color:var(--label2)}\r\n.bi>span{font:600 12.5px var(--sf)}\r\n\r\n/* ================= v6 : quand précis ================= */\r\n.cal{border-radius:16px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);padding:6px}\r\n.cw,.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}\r\n.cw small{text-align:center;font:600 9.5px var(--sf);color:var(--label3)}\r\n.cd2{position:relative;height:23px;border:0;border-radius:8px;font:600 11.5px var(--sf);cursor:pointer;color:var(--label);font-variant-numeric:tabular-nums}\r\n.cd2 em{position:absolute;top:1px;left:3px;font:600 7px var(--sf);font-style:normal;color:var(--label2);text-transform:uppercase}\r\n.cd2.g{background:rgba(61,122,82,.2)}.cd2.o{background:rgba(185,138,46,.18)}.cd2.b{background:rgba(168,68,58,.15)}\r\n.cd2.far{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px)}\r\n.cd2.past{background:transparent;color:var(--label3);cursor:default}\r\n.cd2.sel{background:rgba(255,255,255,.85);box-shadow:inset 0 0 0 1.4px #5B7F55,0 2px 6px rgba(23,64,44,.15);z-index:1}\r\n.hgrid{display:grid;gap:2px;align-items:center;border-radius:16px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);padding:6px}\r\n.hgrid small{font:600 8.5px var(--sf);color:var(--label3);text-align:center;white-space:nowrap}\r\n.hgrid small.rl{text-align:left;font:500 10.5px var(--sf);color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.hc{height:24px;border:0;border-radius:5px;cursor:pointer;padding:0}\r\n.hc.g{background:rgba(61,122,82,.34)}.hc.o{background:rgba(185,138,46,.3)}.hc.b{background:rgba(168,68,58,.26)}.hc.past{background:rgba(23,43,36,.05);cursor:default}\r\n.hc.on{box-shadow:0 0 0 2px #fff,0 0 0 3.4px #5B7F55;position:relative;z-index:1}\r\n.qsum{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 4px 2px;font-size:12.5px}\r\n.qsum span:first-child{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qsum .num{font-weight:700;flex:none}\r\n.lgd{display:flex;gap:10px;font:500 10.5px var(--sf);color:var(--label2);padding:3px 4px 0;flex-wrap:wrap}\r\n.lgd i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:-1px}\r\n.lgd i.g{background:rgba(61,122,82,.4)}.lgd i.o{background:rgba(185,138,46,.36)}.lgd i.b{background:rgba(168,68,58,.3)}.lgd i.far{background:repeating-linear-gradient(135deg,rgba(23,43,36,.25) 0 2px,transparent 2px 4px)}\r\n.hchart{width:100%;height:auto;display:block;border-radius:14px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}\r\n.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:6px}\r\n.facts div{padding:5px 8px;border-radius:12px;background:rgba(255,255,255,.42);min-width:0}\r\n.facts small{display:block;font:500 10px var(--sf);color:var(--label2)}.facts b{display:block;font:600 12px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.rec{display:flex;align-items:center;gap:9px;padding:7px 8px 7px 10px;border-radius:14px;background:rgba(236,244,233,.7);box-shadow:inset 0 0 0 .8px var(--soft-line);margin:4px 0 6px;color:var(--accent)}\r\n.rec b{display:block;font:600 13px var(--sf);color:var(--label)}.rec small{display:block;font:400 11px var(--sf);color:var(--label2)}.rec>div{flex:1}\r\n.tl{position:relative;display:grid;gap:0}\r\n.tli{display:grid;grid-template-columns:40px 14px minmax(0,1fr);gap:6px;align-items:start;padding:3px 0;position:relative}\r\n.tli .tt{font:600 12px var(--sf);padding-top:1px}\r\n.tli i{width:10px;height:10px;border-radius:50%;background:#8DB287;margin-top:3px;box-shadow:0 0 0 2.5px rgba(255,255,255,.8);position:relative;z-index:1}\r\n.tli:not(:last-child)::before{content:\"\";position:absolute;left:50px;top:12px;bottom:-4px;width:1.5px;background:rgba(91,127,85,.35)}\r\n.tli.warn i{background:var(--warn)}\r\n.tli b{display:block;font:600 12.5px var(--sf)}.tli small{display:block;font:400 11px var(--sf);color:var(--label2)}\r\n.sh-b>*{flex-shrink:0}\r\n.menu2.one{margin-bottom:6px}\r\n.pm .pw{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;min-width:0}.pm .pw .ic{vertical-align:-1px;margin-right:3px}\r\n.need{padding:5px 8px;margin-bottom:5px}\r\n\r\n/* ================= v7 : un seul style de capsule (barre d'onglets = étapes = flux des tiroirs = segments) ================= */\r\n.steps.lg,.tb.lg,.flow.lg,.tchips,.bagsel{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .14)) 55%,rgba(255,255,255,calc(var(--ga) + .22)))}\r\n.steps .lens,.tb .lens,.flow .lens,.segc .th,.bagsel button[aria-pressed=true]{background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.26));\r\n  box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.07),0 2px 8px rgba(23,43,36,.08)}\r\n.steps .lens,.tb .lens{top:4px;bottom:4px;transition:transform .55s cubic-bezier(.3,1.35,.4,1),background .25s,box-shadow .25s}\r\n.steps button,.tb button{color:var(--label)}\r\n.steps button[aria-current=step],.tb button.on{color:#2F6B45}\r\n.steps button[aria-current=step] .ic,.tb button.on .ic{stroke-width:2.1}\r\n.steps.drag .lens,.tb.drag .lens{transition:transform .08s linear,background .25s,box-shadow .25s;background:rgba(255,255,255,.08);top:-6px;bottom:-6px;\r\n  box-shadow:inset 0 1.5px 1px rgba(255,255,255,.95),inset 0 -1.5px 2px rgba(255,255,255,.6),inset 2px 0 2px rgba(255,120,160,.18),inset -2px 0 2px rgba(90,170,255,.2),0 0 0 .5px rgba(23,43,36,.1),0 10px 26px rgba(23,43,36,.2)}\r\n.steps.drag button{transition:transform .2s}.steps.drag button.hov{transform:scale(1.14)}\r\n.steps{touch-action:none}\r\n.bdg{position:absolute;top:6px;left:calc(50% + 6px);width:8px;height:8px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 2px rgba(255,255,255,.9)}\r\n.head{gap:6px}\r\n/* flux des tiroirs : capsule segmentée à lentille */\r\n.flow{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:0;height:30px;border-radius:999px;padding:3px;margin:0 -2px}\r\n.flow .lens{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/var(--n));border-radius:999px;z-index:1;transition:transform .55s cubic-bezier(.3,1.35,.4,1)}\r\n.flow button,.flow button.cur,.flow button.done{position:relative;z-index:2;height:auto;min-width:0;padding:0 4px;border:0;border-radius:999px;background:none!important;box-shadow:none!important;color:var(--label);font:500 11.5px var(--sf);display:flex;align-items:center;justify-content:center;gap:3px;cursor:pointer}\r\n.flow button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.flow button.cur{color:#2F6B45;font-weight:600}\r\n.flow button.done{color:var(--label2)}.flow button.done .ic{color:var(--good);flex:none}\r\n.flow .ln,.flow button i{display:none}\r\n/* segments */\r\n.segc{background:rgba(255,255,255,.34);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08),inset 0 1px 2px rgba(23,43,36,.05)}\r\n.segc button[aria-pressed=true]{color:#2F6B45}\r\n/* types de réservation : même capsule que la barre d'onglets */\r\n.tchips{border-radius:22px;padding:3px;gap:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.12),0 6px 16px rgba(23,43,36,.08)}\r\n.tchip,.tchip.on{background:none;box-shadow:none;border-radius:18px;color:var(--label)}\r\n.tchip.on{color:#2F6B45;font-weight:600}.tchip.on .ic{color:#2F6B45}\r\n.tchip .bd{background:rgba(141,178,135,.5)}\r\n/* sacs : sélecteur de membre */\r\n.bagsel{border-radius:20px;padding:3px;gap:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.1)}\r\n.bagsel button{background:none;box-shadow:none;border-radius:17px}\r\n.bagsel button[aria-pressed=true]{color:#2F6B45}\r\n/* îlot : la prochaine décision */\r\n.island{cursor:pointer}\r\n.hasnext .island[data-s=idle]::before{content:\"\";position:absolute;left:15px;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;background:#A6C1A0;box-shadow:0 0 10px #A6C1A0;animation:pulse 2s infinite}\r\n.oc-c .st.rs{background:rgba(63,147,184,.16);color:#2B6F8E;font-weight:600}\r\n.sheet{gap:6px}\r\n\r\n/* ================= v8 : étapes = barre d'onglets (icône + libellé), feuilles qui ne débordent plus sur la carte ================= */\r\n.steps{height:50px}\r\n.steps button{flex-direction:column;gap:1px;display:flex;align-items:center;justify-content:center;font:500 10px var(--sf);letter-spacing:0;min-height:0}\r\n.steps button .ic{width:19px;height:19px}\r\n.steps button[aria-current=step]{font-weight:600}\r\n.steps .dot{display:none}\r\n.head .gbtn{width:50px;height:50px}\r\n.bdg{top:5px;left:calc(50% + 7px)}\r\n.grab.tt{height:32px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;padding-top:6px}\r\n.grab .sht{font:600 13px var(--sf);color:var(--label);letter-spacing:-.01em;line-height:16px}\r\n.sh-h.hf{margin-top:0;gap:6px;align-items:center}\r\n.sh-h.hf .flow{flex:1;min-width:0;margin:0;height:48px;padding:3px}\r\n.sh-h.hf .gbtn.sm{width:36px;height:36px;flex:none}\r\n.flow button,.flow button.cur,.flow button.done{flex-direction:column;gap:1px;padding:0 2px;font:500 10px var(--sf);letter-spacing:0}\r\n.flow button.cur{font-weight:600}\r\n.flow .fic{position:relative;display:grid;place-items:center}\r\n.flow .fic>.ic{width:18px;height:18px}\r\n.flow .fck{position:absolute;right:-7px;top:-4px;width:12px;height:12px;border-radius:50%;background:#fff;color:var(--good);display:grid;place-items:center;box-shadow:0 0 0 .5px rgba(23,43,36,.12)}\r\n.flow .fck .ic{width:8px;height:8px;stroke-width:3}\r\n.flow .flb{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:12px}\r\n.flow button.done{color:var(--label)}\r\n.fr{height:27px}\r\n\r\n.bagsel{margin-bottom:5px}\r\n.bagsel button{flex-direction:row;gap:5px;padding:4px 3px;justify-content:center}\r\n.bagsel button>span{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;min-width:0}\r\n.bagsel button b{font:600 11px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}\r\n.bagsel .avi.sm{width:22px;height:22px;font-size:9.5px}\r\n.bagv{grid-template-columns:98px minmax(0,1fr);gap:10px}\r\n.bagsvg{width:98px;height:128px}\r\n.bl{font-size:11.5px;padding:1px 0}\r\n.cd2{height:21px;font-size:11px}\r\n.cal{padding:5px}.cw small{font-size:9px}\r\n.qsum{padding:5px 2px 0}\r\n.chip.sugg{height:24px;font-size:11px;padding:0 8px;flex:none;background:var(--soft);color:var(--tint);box-shadow:inset 0 0 0 .8px var(--soft-line)}\r\n.chip.sugg .ic{color:var(--accent)}\r\n.lgd{padding-top:2px}\r\n.hchart{height:112px}\r\n.facts{gap:4px;margin-top:5px}.facts div{padding:3px 7px}.facts small{font-size:9.5px}.facts b{font-size:11.5px}\r\n.grab.tt{height:30px;padding-top:5px;gap:3px}\r\n.sh-h.hf .flow{height:46px}\r\n.sh-f .say,.sh-f .bk{height:32px}.sh-f .bk{width:32px}.nx{height:32px}\r\n.li.cm{min-height:36px;padding:3px 2px}\r\n.rec{margin:3px 0 4px;padding:5px 8px 5px 10px}\r\n.tli{padding:2px 0}\r\n.mini{display:none}\r\n.mapbig .mini{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;flex:none;height:50px;border:0;border-radius:20px;padding:0 16px;text-align:left;cursor:pointer;color:var(--label);animation:minin .4s cubic-bezier(.3,1.3,.4,1)}\r\n.mini b{font:700 16px/1.2 var(--sf);letter-spacing:-.015em;display:flex;align-items:center;gap:5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.mini span{font:400 12px var(--sf);color:var(--label2);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n@keyframes minin{from{opacity:0;transform:translateY(-6px) scale(.98)}}\r\n\r\n\r\n/* ================= Compte iOS 27 Liquid Glass — Layout Instagram @tony_frc ================= */\r\n.phone{grid-template-rows:calc(67% - 49px) 1fr}\r\n.phone.mapbig{grid-template-rows:172px 1fr}\r\n.top{padding:50px 12px 6px;gap:5px}\r\n.sw-wrap[data-det=peek] .sheet{top:calc(67% - 49px - 128px);bottom:calc(33% + 57px)}\r\n.sw-wrap[data-det=medium] .sheet{top:48px;bottom:calc(33% + 57px)}\r\n\r\n/* Top bar Instagram en verre Liquid Glass */\r\n.ig-top{display:flex;align-items:center;justify-content:space-between;gap:6px;height:36px;flex:none}\r\n.ig-handle{height:34px;padding:0 11px;border-radius:999px;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font:700 16px/1 var(--sf);letter-spacing:-.025em;color:var(--label);position:relative;overflow:hidden}\r\n.ig-handle:active{transform:scale(.96)}\r\n.ig-handle .lock-ic{color:var(--tint);display:inline-flex}\r\n.ig-handle .vis-tag{font:600 10.5px/1 var(--sf);color:var(--tint);padding:2px 6px;border-radius:999px;background:rgba(91,127,85,.16)}\r\n.ig-top-r{display:flex;align-items:center;gap:5px}\r\n.ig-top-r .gbtn{width:34px;height:34px}\r\n\r\n/* Carte principale profil Instagram en verre Liquid Glass */\r\n#card.cs{padding:9px 11px 8px;gap:6px;border-radius:24px;overflow:hidden}\r\n\r\n/* En-tête Instagram : Avatar + Nom + 3 compteurs (publications, followers, suivi(e)s) */\r\n.ig-header{display:grid;grid-template-columns:68px minmax(0,1fr);gap:11px;align-items:center;padding-top:3px}\r\n.ig-avi-wrap{position:relative;width:66px;height:66px;border-radius:50%;padding:2.5px;background:conic-gradient(from 140deg,#17402C,#5B7F55,#96B391,#3D7A52,#17402C);box-shadow:0 6px 16px rgba(23,43,36,.16),inset 0 1px 0 rgba(255,255,255,.8);cursor:pointer;border:0;display:block}\r\n.ig-avi-wrap:active{transform:scale(.95)}\r\n.ig-avi-in{width:100%;height:100%;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.92);background:#DDEBD8;display:grid;place-items:center}\r\n.ig-avi-in img{width:100%;height:100%;object-fit:cover;display:block}\r\n.ig-note{position:absolute;top:-7px;left:-2px;right:-6px;padding:2px 5px;border-radius:10px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 3px 10px rgba(23,43,36,.14),inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12);font:600 9px/1.15 var(--sf);color:var(--tint);white-space:nowrap;text-align:center;z-index:2}\r\n.ig-seal-bdg{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:linear-gradient(155deg,#fff,#EBF2EC);box-shadow:0 2px 6px rgba(23,43,36,.2),0 0 0 1.5px #fff;display:grid;place-items:center}\r\n\r\n.ig-right{display:flex;flex-direction:column;gap:5px;min-width:0}\r\n.ig-name-row{display:flex;align-items:center;gap:6px}\r\n.ig-name{font:700 14.5px/1.15 var(--sf);color:var(--label);letter-spacing:-.015em}\r\n.ig-sub-pill{font:600 10px/1 var(--sf);color:var(--tint);padding:2.5px 6px;border-radius:999px;background:rgba(235,242,236,.75);box-shadow:inset 0 0 0 .5px var(--soft-line)}\r\n.ig-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}\r\n.ig-stat{border:0;background:rgba(255,255,255,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 0 0 .5px rgba(23,43,36,.06);border-radius:11px;padding:4px 4px 3.5px;text-align:left;cursor:pointer;transition:transform .14s,background .15s}\r\n.ig-stat:active{transform:scale(.95);background:rgba(255,255,255,.65)}\r\n.ig-stat b{display:block;font:700 14px/1.1 var(--sf);color:var(--label);letter-spacing:-.02em;font-variant-numeric:tabular-nums}\r\n.ig-stat span{display:block;font:500 10px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n/* Bio Instagram (@tony_frc : 🇮🇹🇫🇷 + Empreinte GPS + Lignée) */\r\n.ig-bio{display:flex;flex-direction:column;gap:2.5px;font:400 11.8px/1.28 var(--sf);color:var(--label)}\r\n.ig-bio-flags{font-size:13px;line-height:1.2;display:flex;align-items:center;gap:6px}\r\n.ig-bio-flags span{font:500 11.2px/1.2 var(--sf);color:var(--label2)}\r\n.ig-bio-emp{display:flex;align-items:center;gap:5px;color:var(--tint);font:500 11.2px/1.25 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-bio-emp i{width:6px;height:6px;border-radius:50%;background:var(--good);flex:none}\r\n.ig-bio-link{display:inline-flex;align-items:center;gap:4px;font:600 11px/1.2 var(--sf);color:var(--tint);background:none;border:0;padding:0;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n/* Boutons d'action Instagram (Modifier le profil / Partager le profil / +Tribu) */\r\n.ig-actions{display:flex;width:100%;gap:5px}\r\n.ig-btn{height:28px;border-radius:9px;border:0;font:600 11.8px/1 var(--sf);cursor:pointer;display: inline-flex;align-items:center;justify-content:center;gap:4px;transition:transform .14s;padding:0 8px;white-space:nowrap}\r\n.ig-btn:active{transform:scale(.96)}\r\n.ig-btn.p{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh)}\r\n.ig-btn.soft{background:var(--soft);color:var(--label);box-shadow:inset 0 1px 0 rgba(255,255,255,.82),inset 0 0 0 .6px var(--soft-line)}\r\n.ig-btn.icon{padding:0;width:30px}\r\n\r\n/* Stories À la une (Highlights Instagram en anneaux Liquid Glass) */\r\n.ig-hl-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:1px 0}\r\n.ig-hl{border:0;background:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2.5px;min-width:0}\r\n.ig-hl:active .ig-hl-ring{transform:scale(.92)}\r\n.ig-hl-ring{width:44px;height:44px;border-radius:50%;padding:2px;background:linear-gradient(145deg,rgba(23,64,44,.55),rgba(91,127,85,.35),rgba(255,255,255,.85));box-shadow:inset 0 1px 0 #fff,0 2px 6px rgba(23,43,36,.08);transition:transform .15s;display:grid;place-items:center}\r\n.ig-hl-in{width:100%;height:100%;border-radius:50%;background:rgba(244,247,243,.88);border:1.5px solid rgba(255,255,255,.95);display:grid;place-items:center;font-size:16px;overflow:hidden;position:relative}\r\n.ig-hl span{font:500 9.8px/1.1 var(--sf);color:var(--label);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n/* Barre des 4 onglets de contenu Instagram (Grille | Carte/Sorties | Lignées/Sac | Identifié/Tribu) */\r\n.ig-tabs{position:relative;display:grid;grid-template-columns:repeat(4,1fr);height:31px;padding:2px;border-radius:12px;background:rgba(23,43,36,.06);box-shadow:inset 0 1px 1px rgba(23,43,36,.06),inset 0 -1px 0 rgba(255,255,255,.65)}\r\n.ig-tabs button{position:relative;z-index:1;border:0;background:none;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:4px;font:600 10.8px/1 var(--sf);color:var(--label2);cursor:pointer;transition:color .18s}\r\n.ig-tabs button[aria-selected=\"true\"]{color:var(--tint)}\r\n.ig-tabs .ig-th{position:absolute;top:2px;bottom:2px;left:2px;width:calc((100% - 4px)/4);border-radius:10px;background:rgba(255,255,255,.86);box-shadow:0 2px 6px rgba(23,43,36,.1),inset 0 1px 0 #fff;transition:transform .32s cubic-bezier(.22,1.15,.36,1)}\r\n\r\n/* Grille photo 3 colonnes Instagram (3x2 visible immédiatement) */\r\n.ig-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}\r\n.ig-tile{position:relative;height:68px;border-radius:10px;overflow:hidden;border:0;padding:0;cursor:pointer;background:#17402C;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.35);text-align:left;transition:transform .15s}\r\n.ig-tile:active{transform:scale(.96)}\r\n.ig-tile svg.art{width:100%;height:100%;display:block}\r\n.ig-tile .t-top{position:absolute;top:4px;left:5px;right:5px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}\r\n.ig-tile .t-pill{padding:1.5px 5px;border-radius:6px;background:rgba(12,24,18,.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font:600 8.8px/1.15 var(--sf);letter-spacing:.01em}\r\n.ig-tile .t-pill.draft{background:rgba(251,241,220,.92);color:#8a6418}\r\n.ig-tile .t-ic{color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));display:inline-flex}\r\n.ig-tile .t-bot{position:absolute;left:0;right:0;bottom:0;padding:12px 5px 4px;background:linear-gradient(180deg,transparent,rgba(10,22,16,.78));color:#fff;display:flex;justify-content:space-between;align-items:flex-end;gap:3px;pointer-events:none}\r\n.ig-tile .t-bot b{font:600 9.5px/1.1 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-tile .t-bot small{font:600 8.8px/1 var(--sf);opacity:.92;white-space:nowrap}\r\n\r\n/* Vues alternatives dans la zone grille (Sorties, Lignées, Tribu) */\r\n.ig-alt{display:flex;flex-direction:column;gap:5px;min-height:139px;justify-content:space-between}\r\n.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}\r\n.kpi{padding:4px 4px 3px;border-radius:11px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);text-align:center;cursor:pointer;border:0}\r\n.kpi b{display:block;font:700 13px/1.15 var(--sf);color:var(--label);font-variant-numeric:tabular-nums}\r\n.kpi small{display:block;font:500 9.2px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.axes2{display:grid;grid-template-columns:1fr 1fr;gap:5px}\r\n.axis-box{padding:6px 8px;border-radius:12px;background:rgba(255,255,255,.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);display:flex;flex-direction:column;gap:3px}\r\n.axis-box .ah{display:flex;justify-content:space-between;align-items:baseline;font:600 10.5px var(--sf);color:var(--label2)}\r\n.axis-box .ah b{font:700 13.5px var(--sf);color:var(--tint);font-variant-numeric:tabular-nums}\r\n.axis-box small{font:400 9.5px/1.2 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.credit-pill{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 9px;border-radius:12px;background:var(--pg);box-shadow:var(--pg-sh);cursor:pointer;border:0;width:100%;text-align:left}\r\n.credit-pill b{font:700 13.5px var(--sf);color:var(--tint);font-variant-numeric:tabular-nums}\r\n.credit-pill small{display:block;font:400 9.8px var(--sf);color:var(--label2)}\r\n\n\n/* ================= Compte — 50 améliorations (couche d'extension Liquid Glass v8) ================= */\r\n\r\n/* 1 · Anneau d'avatar : animé tant qu'une story est non vue, ciselé et sensible à la lumière sinon (47) */\r\n.ig-avi-wrap{background:none!important}\r\n.ig-avi-wrap::before{content:\"\";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from var(--la,140deg),rgba(23,64,44,.62),rgba(150,179,145,.55),rgba(255,255,255,.9),rgba(91,127,85,.5),rgba(23,64,44,.62));box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}\r\n.ig-avi-wrap.live::before{background:conic-gradient(from 0deg,#17402C,#5B7F55,#96B391,#3D7A52,#17402C);animation:lkspin 3.4s linear infinite}\r\n@keyframes lkspin{to{transform:rotate(360deg)}}\r\n.ig-avi-in{position:relative;z-index:1}\r\n.ig-note{cursor:pointer;z-index:3}\r\n.ig-note.empty{display:inline-grid;place-items:center;width:20px;padding:0;height:20px;left:-4px;right:auto;top:-5px}\r\n.ig-seal-bdg{z-index:3;cursor:pointer}\r\n\r\n/* Stories à la une : défilement horizontal, vues/non vues, couvertures topographiques (8) */\r\n.ig-hl-row{display:flex!important;overflow-x:auto;gap:4px;scrollbar-width:none}\r\n.ig-hl-row::-webkit-scrollbar{display:none}\r\n.ig-hl{flex:0 0 calc((100% - 16px)/5)}\r\n.ig-hl-ring{background:conic-gradient(from var(--la,140deg),rgba(23,64,44,.7),rgba(91,127,85,.45),rgba(255,255,255,.9),rgba(23,64,44,.7))!important}\r\n.ig-hl.seen .ig-hl-ring{opacity:.5;filter:saturate(.4)}\r\n.ig-hl-in svg{display:block}\r\n\r\n/* Barre de filtres + bascule grille/fil (15, 14) */\r\n.ig-filt{display:flex;align-items:center;gap:5px;margin:-1px 0 -1px}\r\n.ig-vt{flex:none;width:24px;height:22px;border:0;border-radius:8px;background:rgba(255,255,255,.55);box-shadow:inset 0 1px 0 #fff,inset 0 0 0 .5px var(--soft-line);display:grid;place-items:center;cursor:pointer;color:var(--tint)}\r\n.ig-pills{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}\r\n.ig-pills::-webkit-scrollbar{display:none}\r\n.ig-pill{flex:none;height:22px;padding:0 9px;border-radius:999px;border:0;font:600 10.5px/1 var(--sf);color:var(--label2);background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08);cursor:pointer}\r\n.ig-pill[aria-pressed=\"true\"]{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh)}\r\n\r\n/* Grille 3×N : tuiles plus compactes, épingles, filtre de mois, progression brouillon (11, 13, 21) */\r\n.ig-tile{height:56px!important}\r\n.ig-tile .t-pin{color:#fff;display:inline-flex;margin-right:3px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}\r\n.ig-tile .t-prog{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.28)}\r\n.ig-tile .t-prog i{display:block;height:100%;background:#E8C068}\r\n.ig-tile.dim,.ig-feed-row.dim{opacity:.26;filter:saturate(.35)}\r\n.ig-tile.lit,.ig-feed-row.lit{box-shadow:0 0 0 2px #5B7F55,0 4px 10px rgba(23,64,44,.28)}\r\n.ig-grid-wrap{display:flex;flex-direction:column;gap:3px}\r\n.ig-empty{display:grid;place-items:center;text-align:center;min-height:100px;padding:10px;border-radius:14px;background:rgba(255,255,255,.4);font:500 11.5px/1.35 var(--sf);color:var(--label2);gap:6px}\r\n.stat-bump{display:inline-block;animation:statbump .5s cubic-bezier(.3,1.5,.5,1)}\r\n@keyframes statbump{0%{transform:scale(.7);opacity:.3}100%{transform:none;opacity:1}}\r\n\r\n/* Fil Instagram compact (14) */\r\n.ig-feed{display:flex;flex-direction:column;gap:4px;max-height:139px;overflow-y:auto;scrollbar-width:none}\r\n.ig-feed::-webkit-scrollbar{display:none}\r\n.ig-feed-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:8px;align-items:center;border:0;text-align:left;padding:4px 6px 4px 4px;border-radius:12px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);cursor:pointer;flex:none}\r\n.ig-feed-row .fa{width:44px;height:44px;border-radius:9px;overflow:hidden}\r\n.ig-feed-row .fa svg{width:100%;height:100%;display:block}\r\n.ig-feed-row b{display:block;font:600 12px/1.2 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-feed-row small{display:block;font:400 10.5px/1.25 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-feed-row em{font:600 11px var(--sf);font-style:normal;color:var(--tint)}\r\n\r\n/* Sous-onglets Lignées (Épreuve / Filiation / Sac) */\r\n.ig-sub{display:flex;gap:4px}\r\n.ig-sub button{flex:1;height:22px;border:0;border-radius:999px;font:600 10.5px/1 var(--sf);color:var(--label2);background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08);cursor:pointer}\r\n.ig-sub button[aria-pressed=\"true\"]{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh)}\r\n.tree{width:100%;height:68px;display:block}\r\n.tree g[data-a]{cursor:pointer}\r\n.tree text{font:600 7.5px var(--sf);fill:#56665D}\r\n.gauge{display:flex;flex-direction:column;gap:3px;padding:5px 9px;border-radius:12px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07)}\r\n.gauge .gh{display:flex;justify-content:space-between;font:600 10.5px var(--sf);color:var(--label2)}\r\n.gauge .gh b{color:var(--tint)}\r\n.gauge .gb{height:5px;border-radius:99px;background:var(--fill);overflow:hidden}\r\n.gauge .gb i{display:block;height:100%;background:linear-gradient(90deg,#5B7F55,#3D7A52);border-radius:99px}\r\n\r\n/* Vestiaire matériel 3×2 (31, 33) */\r\n.gc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}\r\n.gc-tile{position:relative;border:0;text-align:left;padding:5px 6px 6px;border-radius:12px;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.08);cursor:pointer;display:flex;flex-direction:column;gap:1px;min-width:0;height:48px;overflow:hidden}\r\n.gc-tile:active{transform:scale(.96)}\r\n.gc-tile b{font:600 10.8px/1.15 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.gc-tile small{font:500 9.6px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.gc-tile .wr{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(23,43,36,.08)}\r\n.gc-tile .wr i{display:block;height:100%;background:#3D7A52}\r\n.gc-tile .wr i.hot{background:#B98A2E}\r\n.gc-tile .gb2{position:absolute;right:5px;top:4px;font:700 8.5px var(--sf);padding:1px 4px;border-radius:6px;background:var(--warn-bg);color:#8a6418}\r\n.gc-tile.add{align-items:center;justify-content:center;background:var(--pg);box-shadow:var(--pg-sh);color:var(--pg-ink)}\r\n.gc-tile.add b{font-size:11px}\r\n\r\n/* Tribu : lignes compactes + comparateur d'empreintes (20) */\r\n.tr-row{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;padding:3px 6px;border-radius:12px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07)}\r\n.tr-av{width:26px;height:26px;border-radius:50%;background:linear-gradient(155deg,#fff,#DDEBD8);display:grid;place-items:center;font:700 11px var(--sf);color:var(--tint)}\r\n.tr-t b{display:block;font:600 11.8px/1.2 var(--sf)}\r\n.tr-t small{display:block;font:400 10px/1.2 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.tr-row .mbtn{height:22px;font-size:10.5px;padding:0 9px}\r\n\r\n/* Accessoire : repères d'événements + point J-4 (23, 24) */\r\n.acc .j4{position:absolute;right:9px;top:8px;width:9px;height:9px;border-radius:50%;background:#3D7A52;box-shadow:0 0 0 2px rgba(255,255,255,.85);animation:j4p 1.8s infinite;cursor:pointer;z-index:3}\r\n@keyframes j4p{0%{box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 0 2px rgba(61,122,82,.5)}70%{box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 0 9px rgba(61,122,82,0)}100%{box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 0 2px rgba(61,122,82,0)}}\r\n.acc .ro{cursor:pointer}\r\n\r\n/* Carte : relief ombré selon la lumière (18), halo de focus (16), mini-profil callout (19) */\r\n.sunshade{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;background:linear-gradient(var(--la,140deg),rgba(255,255,255,.2) 0%,rgba(23,43,36,.16) 100%);transition:background .3s}\r\n.callout .co-prof{grid-column:1/3;margin-top:3px}\r\n.callout .co-hint{grid-column:1/3;font:600 10.5px var(--sf);color:var(--warn)}\r\n\r\n/* Visionneuse de story plein écran (6, 7, 9) */\r\n.story{position:absolute;inset:0;z-index:45;border-radius:54px;background:linear-gradient(170deg,#0d2117,#1d4a34 55%,#0d2117);color:#fff;display:flex;flex-direction:column;padding:56px 14px 34px;opacity:0;pointer-events:none;transition:opacity .28s}\r\n.story.on{opacity:1;pointer-events:auto}\r\n.st-bar{display:flex;gap:4px;margin-bottom:10px;position:relative;z-index:3}\r\n.st-bar i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.28);overflow:hidden;display:block}\r\n.st-bar i b{display:block;height:100%;width:0;background:#fff}\r\n.st-bar i.done b{width:100%}\r\n.st-bar i.cur b{animation:stfill 4.4s linear forwards}\r\n.story.hold .st-bar i.cur b{animation-play-state:paused}\r\n@keyframes stfill{to{width:100%}}\r\n.st-head{display:flex;align-items:center;gap:8px;position:relative;z-index:3}\r\n.st-av{width:32px;height:32px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 1.5px rgba(255,255,255,.7);flex:none}\r\n.st-head b{font:600 14px var(--sf)}\r\n.st-head small{font:400 11.5px var(--sf);opacity:.7;flex:1}\r\n.st-x{width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;display:grid;place-items:center;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}\r\n.st-x .ic{stroke:#fff}\r\n.st-.lkdv-compte-v8{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}\r\n.st-foot{position:relative;z-index:3;display:flex;flex-direction:column;gap:7px;min-height:84px}\r\n.st-foot b{font:700 19px/1.2 var(--sf);letter-spacing:-.02em}\r\n.st-foot small{font:400 13px/1.35 var(--sf);opacity:.78}\r\n.st-foot .st-act{display:flex;gap:8px;flex-wrap:wrap}\r\n.st-btn{height:34px;padding:0 14px;border-radius:999px;border:0;font:600 13px var(--sf);cursor:pointer;color:#fff;background:rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 .6px rgba(255,255,255,.3);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}\r\n.st-btn.p{background:rgba(150,186,142,.5)}\r\n.st-zone{position:absolute;top:116px;bottom:196px;width:50%;border:0;background:none;z-index:2;cursor:pointer}\r\n.st-zone.l{left:0}.st-zone.r{right:0}\r\n.st-card{position:relative;width:100%;height:100%;max-height:430px;border-radius:30px;overflow:hidden;background:rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 0 .6px rgba(255,255,255,.25)}\r\n.st-card .st-bg{position:absolute;inset:0;display:grid;place-items:center;opacity:.55}\r\n.st-card .st-bg svg{width:130%;height:130%}\r\n.st-card svg.tr{position:absolute;inset:0;width:100%;height:100%}\r\n.st-draw{fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:stdraw 3.2s ease-out .2s forwards;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}\r\n@keyframes stdraw{to{stroke-dashoffset:0}}\r\n.st-chip{position:absolute;padding:5px 11px;border-radius:999px;font:600 12px var(--sf);background:rgba(255,255,255,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}\r\n.st-chip.a{left:14px;top:14px}.st-chip.b{right:14px;bottom:14px}\r\n.st-card.photo svg.art{position:absolute;inset:0;width:100%;height:100%}\r\n.st-card.stats{display:grid;grid-template-columns:1fr;place-content:center;gap:16px;text-align:center}\r\n.st-card.stats b{display:block;font:700 40px/1 var(--sf);letter-spacing:-.03em}\r\n.st-card.stats span{font:500 13px var(--sf);opacity:.75}\r\n.st-card.gear{padding:18px;display:flex;flex-direction:column;gap:11px;justify-content:center}\r\n.st-card.gear .gr{display:grid;grid-template-columns:78px 1fr auto;gap:8px;align-items:center;font:500 12.5px var(--sf)}\r\n.st-card.gear .gr i{display:block;height:8px;border-radius:99px;background:rgba(255,255,255,.2);overflow:hidden}\r\n.st-card.gear .gr i u{display:block;height:100%;background:linear-gradient(90deg,#96B391,#fff);border-radius:99px;text-decoration:none}\r\n.st-card.gear .tot{font:700 30px var(--sf);letter-spacing:-.02em;text-align:center}\r\n.st-card.species{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:20px}\r\n.st-card.species .sp-card{width:100%;padding:18px;border-radius:24px;background:rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.5);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}\r\n.st-card.species .sp-card b{display:block;font:700 22px var(--sf)}\r\n.st-card.species .sp-card i{display:block;font:italic 400 13px var(--sf);opacity:.8;margin:2px 0 8px}\r\n.st-card.species .sp-card span{font:600 13px var(--sf)}\r\n\r\n/* Aperçu Peek & Pop d'une tuile (12) + mini-profil dans le ctx */\r\n.ctx .pk-art{height:104px;border-radius:15px;overflow:hidden;margin-bottom:8px;position:relative}\r\n.ctx .pk-art svg.art{width:100%;height:100%;display:block}\r\n.ctx .pv .s2{font:400 12.5px/1.35 var(--sf);color:var(--label2);margin-bottom:4px}\r\n.ctx .pv .bar{margin:6px 0}\r\n.ctx .menu button.sel{color:var(--tint);font-weight:600}\r\n\r\n/* Matrice « Qui voit quoi ? » (44) */\r\n.vm{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(0,.7fr));gap:0;font:500 11.5px var(--sf);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08)}\r\n.vm>*{padding:5px 7px;border-top:.5px solid var(--sep);display:flex;align-items:center}\r\n.vm>.h{border-top:0;font:700 10.5px var(--sf);color:var(--label2);justify-content:center}\r\n.vm>.h:first-child{justify-content:flex-start}\r\n.vm>.c{justify-content:center}\r\n.vm .y{width:9px;height:9px;border-radius:50%;background:#3D7A52}\r\n.vm .n{width:9px;height:9px;border-radius:50%;box-shadow:inset 0 0 0 1.4px rgba(23,43,36,.28)}\r\n\r\n/* QR + sceau (48) */\r\n.qrbox{display:flex;gap:12px;align-items:center}\r\n.qr{position:relative;width:104px;height:104px;border-radius:16px;background:#fff;padding:7px;box-shadow:0 0 0 .6px rgba(23,64,44,.18),0 6px 16px rgba(23,64,44,.12);flex:none}\r\n.qr svg.q{width:100%;height:100%;display:block}\r\n.qr .qc{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 2px #fff}\r\n.qrbox b{display:block;font:600 14px var(--sf)}\r\n.qrbox small{display:block;font:400 11.5px/1.35 var(--sf);color:var(--label2);margin:2px 0 7px}\r\n\r\n/* Coffre biométrique, scanner, SMS SOS, jauge de stockage, flou domicile */\r\n.vault-lock{display:grid;place-items:center;gap:8px;padding:12px 0;text-align:center}\r\n.vault-lock .fid{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;background:var(--pg);box-shadow:var(--pg-sh);color:var(--pg-ink)}\r\n.scanbox{position:relative;height:96px;border-radius:16px;background:rgba(23,43,36,.88);overflow:hidden;display:grid;place-items:center}\r\n.scanbox::before{content:\"\";position:absolute;left:14%;right:14%;top:18px;height:2px;background:#96B391;box-shadow:0 0 12px #96B391;animation:scanln 1.6s ease-in-out infinite alternate}\r\n@keyframes scanln{to{top:74px}}\r\n.scanbox span{font:500 11px var(--sf);color:rgba(255,255,255,.7);position:relative}\r\n.sms{font:500 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;padding:9px 11px;border-radius:12px;background:rgba(23,43,36,.07);box-shadow:inset 0 0 0 .5px var(--sep);color:var(--label);user-select:text;-webkit-user-select:text}\r\n.stor{display:flex;flex-direction:column;gap:4px}\r\n.stor .sh{display:flex;justify-content:space-between;font:600 12px var(--sf)}\r\n.blur{display:flex;gap:10px;align-items:center;padding:6px 8px;border-radius:14px;background:rgba(235,242,236,.6);box-shadow:inset 0 0 0 .5px var(--soft-line)}\r\n.blur b{display:block;font:600 12.5px var(--sf)}\r\n.blur small{display:block;font:400 11px/1.3 var(--sf);color:var(--label2)}\r\n.row-btns{display:flex;gap:6px;flex-wrap:wrap}\r\n.sheet .mbtn{cursor:pointer}\r\n.island[data-s=note]{top:5px!important;min-height:41px!important;max-height:43px!important;border-radius:21px!important}\r\n.island .is.note{padding:4px 10px 4px 14px!important;min-height:41px!important;max-height:43px!important}\r\n.island .is.note .t{font-size:11.5px!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.island .is.note .s{font-size:10px!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n.lkdv-followers-nav,.lkdv-account-nav{position:sticky!important;top:0!important;z-index:5!important;}\r\n.phone .sheet .segc.lg-tabs{height:48px!important;padding:2px!important;border-radius:999px!important;}\r\n.sh-b[data-slide='1']{animation:lkdvSheetInRight .42s cubic-bezier(.32,.72,0,1)!important;}\r\n.sh-b[data-slide='-1']{animation:lkdvSheetInLeft .42s cubic-bezier(.32,.72,0,1)!important;}\r\n@keyframes lkdvSheetInRight{from{opacity:.55;transform:translateX(100%)}to{opacity:1;transform:none}}\r\n@keyframes lkdvSheetInLeft{from{opacity:.55;transform:translateX(-100%)}to{opacity:1;transform:none}}\r\n.sh-b-ghost{position:fixed!important;z-index:70!important;pointer-events:none!important;overflow:hidden!important;background:transparent!important;transition:transform .42s cubic-bezier(.32,.72,0,1),opacity .42s!important;will-change:transform,opacity!important;}\r\n/* Bandeau visiteur */\r\n.ig-actions.vis{grid-template-columns:1fr 1fr 30px}\r\n\r\n/* Mode plein soleil : contrastes renforcés (49) */\r\n.phone.outdoor .ig-stat b,.phone.outdoor .ig-name{font-weight:800}\r\n.phone.outdoor .ig-stat{box-shadow:inset 0 0 0 1.4px rgba(23,43,36,.55);background:rgba(255,255,255,.88)}\r\n.phone.outdoor .ig-tile{box-shadow:inset 0 0 0 1.6px rgba(255,255,255,.95),0 0 0 1.4px rgba(23,43,36,.6)}\r\n.phone.outdoor .ig-tile .t-pill{background:rgba(0,0,0,.82)}\r\n.phone.outdoor .ig-pill,.phone.outdoor .ig-sub button,.phone.outdoor .gc-tile,.phone.outdoor .tr-row{box-shadow:inset 0 0 0 1.2px rgba(23,43,36,.5)}\r\n.phone.outdoor .ig-btn{box-shadow:inset 0 0 0 1.6px rgba(23,64,44,.7)}\r\n.phone.outdoor .ig-hl-ring{filter:contrast(1.25)}\r\n.phone.outdoor .sunshade{opacity:0}\r\n\n\n/* Responsive iOS 27 mobile screen adaptations (Apple HIG, Capacitor WKWebView & iPhone Safari) */\n@media (max-width: 767px) {\n  .lkdv-compte-v8 {\n    padding-inline: 0 !important;\n    padding-block: 0 !important;\n    position: fixed !important;\n    inset: 0 !important;\n    width: 100% !important;\n    height: 100dvh !important;\n    overflow: hidden !important;\n  }\n  .stage {\n    display: block !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: 100% !important;\n    margin: 0 !important;\n    padding: 0 !important;\n  }\n  .pwrap {\n    position: absolute !important;\n    inset: 0 !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: 100% !important;\n    margin: 0 !important;\n    transform: none !important;\n  }\n  .phone {\n    position: absolute !important;\n    inset: 0 !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: 100% !important;\n    border-radius: 0 !important;\n    box-shadow: none !important;\n    transform: none !important;\n    display: grid !important;\n    grid-template-rows: calc(100% - 176px) 176px !important;\n    transition: grid-template-rows 0.45s cubic-bezier(0.32, 0.72, 0, 1) !important;\n  }\n  .phone.mapbig {\n    grid-template-rows: calc(env(safe-area-inset-top, 0px) + 84px) 1fr !important;\n  }\n  .status, .island, .home, .notes {\n    display: none !important;\n  }\n  .top {\n    padding-top: calc(env(safe-area-inset-top, 0px) + 6px) !important;\n    padding-left: 10px !important;\n    padding-right: 10px !important;\n    padding-bottom: 4px !important;\n    min-height: 0 !important;\n    gap: 4px !important;\n    display: flex !important;\n    flex-direction: column !important;\n  }\n  .card {\n    flex: 1 !important;\n    min-height: 0 !important;\n    padding: 10px 11px !important;\n    gap: 6px !important;\n    overflow-y: auto !important;\n    -webkit-overflow-scrolling: touch !important;\n    overscroll-behavior-y: contain !important;\n  }\n  .ig-top {\n    margin-bottom: 2px !important;\n  }\n  .ig-top-r .gbtn {\n    width: 34px !important;\n    height: 34px !important;\n    border-radius: 50% !important;\n    background: rgba(255, 255, 255, 0.5) !important;\n    -webkit-backdrop-filter: blur(12px) !important;\n    backdrop-filter: blur(12px) !important;\n    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 2px 8px rgba(23, 43, 36, 0.08) !important;\n    color: #17402C !important;\n  }\n  .ig-avi-wrap {\n    width: 84px !important;\n    height: 84px !important;\n  }\n  .ig-note {\n    font-size: 8px !important;\n    top: -6px !important;\n    padding: 1px 4px !important;\n  }\n  .ig-name {\n    font-size: 13.5px !important;\n  }\n  .ig-sub-pill {\n    font-size: 9px !important;\n    padding: 1.5px 5px !important;\n  }\n  .ig-stat {\n    padding: 2.5px 3px !important;\n  }\n  .ig-stat b {\n    font-size: 12.5px !important;\n  }\n  .ig-stat span {\n    font-size: 9px !important;\n  }\n  .ig-bio {\n    gap: 1.5px !important;\n    font-size: 11px !important;\n    line-height: 1.22 !important;\n  }\n  .ig-bio-emp, .ig-bio-flags {\n    font-size: 10.5px !important;\n  }\n  .ig-actions {\n    gap: 4px !important;\n  }\n  .ig-btn {\n    height: 26px !important;\n    font-size: 11px !important;\n  }\n  .ig-hl-row {\n    padding: 0 !important;\n    gap: 3px !important;\n  }\n  .ig-hl-ring {\n    width: 44px !important;\n    height: 44px !important;\n  }\n  .ig-hl-in {\n    width: 38px !important;\n    height: 38px !important;\n  }\n  .ig-hl span:last-child {\n    font-size: 9px !important;\n  }\n  .ig-grid {\n    grid-template-columns: repeat(3, 1fr) !important;\n    gap: 3px !important;\n  }\n  .ig-tile {\n    min-height: 86px !important;\n    height: auto !important;\n    aspect-ratio: 1 / 1.05 !important;\n    border-radius: 9px !important;\n  }\n  .t-pill {\n    font-size: 8px !important;\n    padding: 1.5px 4px !important;\n  }\n  .t-bot b {\n    font-size: 9px !important;\n  }\n  .t-bot small {\n    font-size: 8px !important;\n  }\n  .tb {\n    left: 8px !important;\n    right: 8px !important;\n    bottom: calc(env(safe-area-inset-bottom, 0px) + 12px) !important;\n    height: 48px !important;\n    padding: 2px !important;\n  }\n  .acc {\n    left: 8px !important;\n    right: 8px !important;\n    bottom: calc(env(safe-area-inset-bottom, 0px) + 68px) !important;\n    height: 38px !important;\n  }\n  .callout {\n    left: 8px !important;\n    right: 8px !important;\n    bottom: calc(env(safe-area-inset-bottom, 0px) + 114px) !important;\n  }\n  .phone .sheet,\n  .sheet {\n    left: 0 !important;\n    right: 0 !important;\n    border-radius: 28px 28px 0 0 !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    box-sizing: border-box !important;\n  }\n  .phone .sw-wrap[data-det=medium] .sheet,\n  .sw-wrap[data-det=medium] .sheet {\n    top: auto !important;\n    bottom: 0 !important;\n    height: min(580px, 78dvh) !important;\n    max-height: 85dvh !important;\n  }\n  .phone .sw-wrap[data-det=large] .sheet,\n  .sw-wrap[data-det=large] .sheet {\n    top: calc(env(safe-area-inset-top, 0px) + 12px) !important;\n    bottom: 0 !important;\n    height: auto !important;\n  }\n  .sw-wrap[data-det=medium] .scrim,\n  .sw-wrap[data-det=large] .scrim {\n    opacity: 1 !important;\n    pointer-events: auto !important;\n    background: rgba(0, 0, 0, 0.45) !important;\n    -webkit-backdrop-filter: blur(6px) !important;\n    backdrop-filter: blur(6px) !important;\n  }\n\n  .ig-alt {\n    min-height: auto !important;\n    gap: 6px !important;\n  }\n  .ig-alt .kpis {\n    gap: 3px !important;\n  }\n  .ig-alt .kpi b {\n    font-size: 12px !important;\n  }\n  .ig-alt .axes2 {\n    gap: 4px !important;\n  }\n  .ig-alt .axis-box {\n    padding: 5px 6px !important;\n  }\n\n  .row-btns {\n    display: inline-flex !important;\n    flex-wrap: nowrap !important;\n    gap: 4px !important;\n    flex-shrink: 0 !important;\n  }\n  .row-btns .mbtn {\n    height: 22px !important;\n    font-size: 10px !important;\n    padding: 0 8px !important;\n  }\n  .sumline .lnk {\n    font-size: 11px !important;\n    font-weight: 600 !important;\n    color: #17402C !important;\n  }\n}\n\n\n/* 3D Living Map & Mobile Responsive Glass UI */\n.map-badge-3d{display:none!important}\n.badge-dot-live{width:7px;height:7px;border-radius:50%;background:#40c057;box-shadow:0 0 0 2px rgba(64,192,87,0.3);animation:pulse-live 2s infinite}\n@keyframes pulse-live{0%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(64,192,87,0.7)}70%{transform:scale(1);box-shadow:0 0 0 5px rgba(64,192,87,0)}100%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(64,192,87,0)}}\n.btn-3d-fullscreen{display:none!important}\n.btn-3d-fullscreen:hover{background:rgba(255,255,255,0.92);transform:scale(1.03)}\n.btn-3d-fullscreen:active{transform:scale(0.96)}\n.poi-marker-3d{display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;transform:translate(-50%,-100%)}\n.poi-marker-badge{display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:8px;background:rgba(23,43,36,0.85);backdrop-filter:blur(6px);color:#fff;font:600 10.5px var(--sf);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)}\n.poi-marker-badge span{color:#A6C1A0;font-variant-numeric:tabular-nums}\n.poi-marker-pin{width:6px;height:6px;border-radius:50%;background:#5B7F55;margin-top:2px;box-shadow:0 0 0 2px #fff}\n@media (max-width: 600px){\n  .lkdv-compte-v8{padding-inline:0!important;padding-block:0!important}\n  .stage{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0!important}\n  .pwrap{width:100%!important;height:100dvh!important;max-width:100%!important;margin:0!important}\n  .phone{position:relative!important;width:100%!important;height:100dvh!important;border-radius:0!important;box-shadow:none!important;border:none!important}\n  .status{display:none!important}\n  .island{display:none!important}\n  .home{display:none!important}\n  .top{padding:calc(env(safe-area-inset-top, 12px) + 6px) 12px 8px!important}\n  .tb{bottom:calc(env(safe-area-inset-bottom, 0px) + 12px)!important;left:10px!important;right:10px!important}\n  .acc{bottom:calc(env(safe-area-inset-bottom, 0px) + 72px)!important;left:10px!important;right:10px!important}\n  .callout{bottom:calc(env(safe-area-inset-bottom, 0px) + 124px)!important}\n  .mopts{bottom:calc(env(safe-area-inset-bottom, 0px) + 124px)!important}\n  .btn-3d-fullscreen{display:none!important}\n  .sw-wrap[data-det=medium] .sheet{top:calc(env(safe-area-inset-top, 12px) + 32px)!important;bottom:calc(env(safe-area-inset-bottom, 0px) + 10px)!important}\n  .sw-wrap[data-det=large] .sheet{top:calc(env(safe-area-inset-top, 12px) + 8px)!important;bottom:calc(env(safe-area-inset-bottom, 0px) + 6px)!important;border-radius:28px!important}\n}\n.phone.sheet-open .tabbar{opacity:0;pointer-events:none;transform:translateY(16px);transition:opacity 0.25s,transform 0.25s}\n.phone.sheet-open .btn-3d-fullscreen{display:none!important}";
const COMPTE_V8_HTML = "<div class=\"stage\">\r\n<div class=\"pwrap\" id=\"pwrap\"><div class=\"phone\" id=\"phone\" aria-label=\"Maquette iPhone du profil LKDV  en Liquid Glass iOS 27\">\r\n  <div class=\"bg\" aria-hidden=\"true\" style=\"background-image:url(/assets/images/account-bg.webp)\"></div>\r\n  <div class=\"status\" aria-hidden=\"true\"><span>9:41</span><span class=\"r\">\r\n    <svg width=\"18\" height=\"12\" viewBox=\"0 0 18 12\"><rect x=\"0\" y=\"8\" width=\"3\" height=\"4\" rx=\"1\" fill=\"#fff\"/><rect x=\"5\" y=\"5.5\" width=\"3\" height=\"6.5\" rx=\"1\" fill=\"#fff\"/><rect x=\"10\" y=\"3\" width=\"3\" height=\"9\" rx=\"1\" fill=\"#fff\"/><rect x=\"15\" y=\"0\" width=\"3\" height=\"12\" rx=\"1\" fill=\"#fff\"/></svg>\r\n    <svg width=\"16\" height=\"12\" viewBox=\"0 0 16 12\"><path d=\"M8 11.2 5.6 8.8a3.4 3.4 0 0 1 4.8 0L8 11.2Z\" fill=\"#fff\"/><path d=\"M3.4 6.6a6.5 6.5 0 0 1 9.2 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M1 4.2a9.9 9.9 0 0 1 14 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/></svg>\r\n    <svg width=\"27\" height=\"13\" viewBox=\"0 0 27 13\"><rect x=\".5\" y=\".5\" width=\"23\" height=\"12\" rx=\"3.8\" stroke=\"rgba(255,255,255,.6)\" fill=\"none\"/><rect x=\"2.5\" y=\"2.5\" width=\"17\" height=\"8\" rx=\"2.2\" fill=\"#fff\"/><path d=\"M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z\" fill=\"rgba(255,255,255,.6)\"/></svg></span></div>\r\n  <div class=\"island\" id=\"island\" data-s=\"idle\" role=\"status\" aria-live=\"polite\"><div class=\"is live\" id=\"isl\"></div><div class=\"is note\" id=\"isn\"></div></div>\r\n\r\n  <section class=\"top\" id=\"top\"></section>\r\n\r\n  <section class=\"mapzone\" aria-label=\"Carte d'empreinte et d'aventures de \">\r\n    <div class=\"map\" id=\"map\"><div id=\"map-loading-bar\" class=\"map-loading-bar\"><div class=\"map-loading-pill\"><span class=\"map-loading-pulse\"></span><span>Initialisation du Relief 3D…</span></div><div class=\"map-loading-track\"><div id=\"map-loading-fill\" class=\"map-loading-fill\"></div></div></div><div id=\"maplibre-compte-canvas\" style=\"position:absolute;inset:0;width:100%;height:100%;z-index:1;\"></div><div class=\"map-scale-selector\" role=\"group\" aria-label=\"Échelle de la carte 3D\"><button id=\"btnCompteOrbite\" class=\"active\" data-a=\"mapscale\" data-v=\"ORBITE\" data-scale=\"ORBITE\" aria-label=\"Vue Globe Terrestre\" aria-pressed=\"true\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" x2=\"22\" y1=\"12\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/></svg></button><button id=\"btnCompteMassif\" data-a=\"mapscale\" data-v=\"MASSIF\" data-scale=\"MASSIF\" aria-label=\"Vue Massif Alpin\" aria-pressed=\"false\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/></svg></button><button id=\"btnCompteSentier\" data-a=\"mapscale\" data-v=\"SENTIER\" data-scale=\"SENTIER\" aria-label=\"Vue Sentier 3D Immersion\" aria-pressed=\"false\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polygon points=\"16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76\"/></svg></button></div><div class=\"map-badge-3d\"><span>GLOBE 3D</span></div>\r\n      <svg class=\"tm\" id=\"tm\" viewBox=\"0 -24 370 368\" preserveAspectRatio=\"xMidYMid slice\" role=\"img\" aria-label=\"Carte générée de ton empreinte terrain\"></svg>\r\n      <button class=\"mgrab\" id=\"mgrab\" data-a=\"mapbig\" aria-label=\"Agrandir ou réduire la carte\"><span></span></button>\r\n      <div class=\"lg mctl\" id=\"mctl\" role=\"group\" aria-label=\"Contrôles de la carte\"></div>\r\n      <div class=\"lg callout\" id=\"callout\" hidden></div>\r\n    </div>\r\n  </section>\r\n\r\n  <nav class=\"tabbar\" id=\"tabbar\" aria-label=\"Navigation principale\">\r\n    \r\n    <div class=\"lg tb\" id=\"tb\"></div>\r\n  </nav>\r\n  <div class=\"home\"></div>\r\n\r\n  <div class=\"sw-wrap\" id=\"sw\" data-det=\"closed\"><div class=\"scrim\" data-a=\"close\"></div><section class=\"sheet\" id=\"sheet\" role=\"dialog\" aria-label=\"Détails du compte\"></section></div>\r\n  <div class=\"lg popv\" id=\"popv\" role=\"dialog\" aria-label=\"Affichage\"></div>\r\n  <div class=\"lg mopts\" id=\"mopts\" role=\"dialog\" aria-label=\"Personnaliser la carte\"></div>\r\n  <div class=\"lg rmenu\" id=\"rmenu\" role=\"menu\" aria-label=\"Choisir une option\"></div>\r\n  <div class=\"ctx\" id=\"ctx\" role=\"dialog\" aria-label=\"Aperçu\"></div>\r\n  <div class=\"story\" id=\"story\" role=\"dialog\" aria-label=\"Story plein écran\"></div>\r\n  <div class=\"post-modal-instagram\" id=\"post_modal_instagram\" role=\"dialog\" aria-label=\"Publication Instagram\"></div>\r\n</div></div>\r\n\r\n\r\n</div>";

function triggerBrowserDownload(filename: string, content: string, mimeType: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

function buildGpxXml(outings: any[], handle: string): string {
  const now = new Date().toISOString();
  const trks = (outings || []).map((o: any, idx: number) => {
    const latBase = 45.83 + idx * 0.08;
    const lonBase = 6.86 + idx * 0.12;
    const pts = [
      [latBase, lonBase, 1200],
      [latBase + 0.02, lonBase + 0.03, 1750],
      [latBase + 0.05, lonBase + 0.07, 2400],
      [latBase + 0.08, lonBase + 0.11, 2810],
      [latBase + 0.05, lonBase + 0.14, 2100],
      [latBase, lonBase, 1200],
    ].map(([lat, lon, ele]) => {
      return `      <trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`;
    }).join('\n');
    return `  <trk>
    <name>${String(o.title || 'Sortie LKDV').replace(/[<>&]/g, '')}</name>
    <desc>${o.mass || 'Alpes'} · ${o.km || 20} km · D+ ${o.dplus || 1000} m</desc>
    <trkseg>
${pts}
    </trkseg>
  </trk>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Le Kit du Voyageur - iOS 27 Liquid Glass (@${handle})" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Traces GPS vérifiées @${handle}</name>
    <time>${now}</time>
  </metadata>
${trks}
</gpx>`;
}

const COMPTE_V8_APPLE_HIG_CSS = `
/* Voyages Horizontal Carousel */
.ig-voyages-tab { display: flex; flex-direction: column; padding: 6px 0 16px; }
.voyages-header { display: flex; justify-content: space-between; align-items: center; padding: 0 16px 8px; font-size: 12px; }
.voyages-meta b { font-weight: 700; color: var(--label); }
.voyages-meta span { color: var(--label2); }
.voyages-swipe-hint { font-size: 11px; font-weight: 600; color: var(--tint); opacity: 0.85; }
.voyages-carousel { display: flex; overflow-x: auto; gap: 14px; padding: 6px 16px 12px; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.voyages-carousel::-webkit-scrollbar { display: none; }
.voyage-card { flex: 0 0 250px; scroll-snap-align: start; border-radius: 20px; overflow: hidden; background: rgba(255, 255, 255, 0.72); -webkit-backdrop-filter: blur(16px) saturate(1.8); backdrop-filter: blur(16px) saturate(1.8); border: 0.5px solid rgba(23, 43, 36, 0.12); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.08); cursor: pointer; transition: transform 0.2s cubic-bezier(0.3, 1.4, 0.5, 1); display: flex; flex-direction: column; }
.voyage-card:active { transform: scale(0.97); }
.voyage-cover { position: relative; width: 100%; height: 125px; overflow: hidden; background: #17402C; }
.voyage-cover-fallback { position: absolute; inset: 0; display: grid; place-items: center; color: rgba(255,255,255,0.78); background: radial-gradient(circle at 28% 18%, rgba(91,143,106,0.78), rgba(23,64,44,1) 72%); }
.voyage-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
.voyage-cover-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%); }
.voyage-chip-gps { position: absolute; top: 8px; left: 8px; padding: 2px 7px; border-radius: 999px; background: rgba(23, 64, 44, 0.88); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #fff; font: 700 9px var(--sf); box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.voyage-alt-badge { position: absolute; bottom: 8px; right: 8px; padding: 2px 7px; border-radius: 999px; background: rgba(255, 255, 255, 0.88); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #17402C; font: 700 9.5px var(--sf); }
.voyage-info { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 3px; }
.voyage-title { font: 600 13.5px var(--sf); color: var(--label); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.voyage-sub { font: 400 11px var(--sf); color: var(--label2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.voyage-metrics { display: flex; align-items: center; gap: 8px; margin-top: 6px; padding-top: 6px; border-top: 0.5px solid var(--sep); font-size: 11px; }
.vm-item { display: flex; flex-direction: column; }
.vm-item small { font-size: 9px; color: var(--label2); }
.vm-item b { font-size: 11.5px; font-weight: 700; color: var(--tint); }
.vm-sep { width: 1px; height: 18px; background: var(--sep); }

/* Réseau Tab with Toggle */
.ig-reseau-tab { padding: 8px 12px 18px; display: flex; flex-direction: column; gap: 10px; }
.reseau-toggle-wrap { display: flex; justify-content: center; margin-bottom: 4px; }
.reseau-toggle { width: 100%; max-width: 320px; display: grid; grid-template-columns: 1fr 1fr; background: var(--fill); border-radius: 999px; padding: 2px; }
.reseau-toggle button { border: 0; background: none; font: 600 12px var(--sf); color: var(--label2); padding: 6px 0; border-radius: 999px; cursor: pointer; transition: all 0.2s ease; }
.reseau-toggle button.active { background: #fff; color: var(--tint); box-shadow: 0 1px 4px rgba(23, 43, 36, 0.12); }
.reseau-list { display: flex; flex-direction: column; gap: 8px; }
.reseau-user-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 16px; background: rgba(255, 255, 255, 0.55); box-shadow: 0 1px 3px rgba(23, 43, 36, 0.05); }
.reseau-av-wrap { position: relative; width: 40px; height: 40px; flex: none; }
.reseau-av { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.reseau-seal-badge { position: absolute; bottom: -2px; right: -2px; width: 14px; height: 14px; border-radius: 50%; background: #17402C; color: #fff; font-size: 8px; font-weight: 700; display: grid; place-items: center; border: 1px solid #fff; }
.reseau-meta { flex: 1; min-width: 0; }
.reseau-name-row { display: flex; align-items: baseline; gap: 5px; }
.reseau-name-row b { font: 600 13px var(--sf); color: var(--label); }
.reseau-handle { font: 400 11px var(--sf); color: var(--label2); }
.reseau-sub { font: 400 10.5px var(--sf); color: var(--label2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reseau-btn { height: 28px; padding: 0 12px; border-radius: 999px; border: 0; font: 600 11.5px var(--sf); cursor: pointer; transition: transform 0.15s; }
.reseau-btn.primary { background: var(--tint); color: #fff; }
.reseau-btn.active { background: var(--fill); color: var(--label); }

/* Edit Profile Full Form */
.ep-section { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 0.5px solid var(--sep); }
.ep-header { display: flex; justify-content: center; padding: 6px 0; }
.ep-avatar-box { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ep-av-preview { width: 68px; height: 68px; border-radius: 50%; object-fit: cover; border: 2px solid #5B7F55; box-shadow: 0 2px 8px rgba(23, 64, 44, 0.2); }
.ep-sec-title { font: 700 12px var(--sf); color: var(--tint); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
.ep-field { display: flex; flex-direction: column; gap: 3px; }
.ep-label { font: 600 11px var(--sf); color: var(--label2); }

/* ==============================================================================
   LKDV COMPTE iOS 27 — Apple HIG 44×44pt Interactive Hit Targets & Spring Motion
   Palette Naturelle Forêt LKDV (#17402C, #5B7F55, #40c057)
   ============================================================================== */
.mctl button,
.gbtn,
.gbtn.sm,
.acc .ab,
.callout .ib,
.steps button,
.bk,
.nx,
.segc button,
.fr,
.tchip,
.mgrab,
.grab {
  position: relative;
}

/* Apple HIG 44x44pt hit target expansion via invisible pseudo-elements */
.mctl button::after,
.gbtn.sm::after,
.acc .ab::after,
.callout .ib::after,
.steps button::after,
.bk::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 44px;
  min-height: 44px;
  width: 100%;
  height: 100%;
  pointer-events: auto;
}

/* Tactile press feedback on touch */
.mctl button:active,
.btn-3d-fullscreen:active,
.pbtn:active,
.chip:active,
.tb button:active {
  transform: scale(0.96) !important;
  transition: transform 0.12s cubic-bezier(0.2, 0.9, 0.4, 1.2) !important;
}

/* Spring motion for iOS sheets */
.sheet {
  transition: top 0.48s cubic-bezier(0.25, 1, 0.5, 1),
              bottom 0.48s cubic-bezier(0.25, 1, 0.5, 1),
              left 0.48s cubic-bezier(0.25, 1, 0.5, 1),
              right 0.48s cubic-bezier(0.25, 1, 0.5, 1),
              border-radius 0.48s !important;
  box-shadow: inset 0 1.5px 0 rgba(255,255,255,.95),
              inset 0 -1px 1px rgba(255,255,255,.5),
              0 0 0 .5px rgba(23,43,36,.12),
              0 -12px 40px rgba(23,64,44,.18) !important;
}

/* Contrast enhancement for outdoor readability */
.sub, .note, .disc {
  color: #38483f !important;
}

/* Hauteur de carte rebaissée encore de 15% :
   Top : calc(69% - 46px), Carte : 1fr restant (équilibre parfait Apple ~536px / ~308px) */
.phone {
  grid-template-rows: calc(69% - 46px) 1fr !important;
  transition: grid-template-rows 0.55s cubic-bezier(0.32, 0.72, 0, 1) !important;
}
.phone.mapbig {
  grid-template-rows: 144px 1fr !important;
}

/* Generous padding & luxurious spacing for stats cards (publications, followers, suivi) */
.ig-stats {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 8px !important;
  margin-top: 4px !important;
}

.ig-stat {
  border: 0 !important;
  background: rgba(255, 255, 255, 0.68) !important;
  -webkit-backdrop-filter: blur(12px) saturate(1.8) !important;
  backdrop-filter: blur(12px) saturate(1.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95),
              0 0 0 0.5px rgba(23, 64, 44, 0.12),
              0 2px 8px rgba(23, 64, 44, 0.06) !important;
  border-radius: 14px !important;
  padding: 8px 12px !important;
  text-align: left !important;
  cursor: pointer !important;
  min-height: 48px !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  transition: transform 0.14s ease, background 0.15s ease, box-shadow 0.15s ease !important;
}

.ig-stat:active {
  transform: scale(0.96) !important;
  background: rgba(255, 255, 255, 0.85) !important;
}

.ig-stat b.num {
  display: block !important;
  font: 700 15px/1.1 var(--sf) !important;
  color: #172B24 !important;
  letter-spacing: -0.02em !important;
  font-variant-numeric: tabular-nums !important;
  margin-bottom: 2px !important;
}

.ig-stat span {
  display: block !important;
  font: 600 10.5px/1.15 var(--sf) !important;
  color: #46554b !important;
  letter-spacing: 0.01em !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Mobile responsive polish: prevent stat truncation on narrow screens (< 600px) */
@media (max-width: 600px) {
  .ig-stats {
    gap: 5px !important;
  }
  .ig-stat {
    padding: 6px 4px !important;
    min-height: 44px !important;
  }
  .ig-stat b.num {
    font-size: 14.5px !important;
  }
  .ig-stat span {
    font-size: 9.5px !important;
    letter-spacing: 0 !important;
    white-space: nowrap !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }
  .ig-actions {
    display: flex !important;
    width: 100% !important;
    gap: 5px !important;
    margin-top: 6px !important;
  }
  .ig-actions .ig-btn {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    height: 34px !important;
    padding: 0 4px !important;
    font: 600 11px/34px var(--sf) !important;
    text-align: center !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    border-radius: 999px !important;
  }
}

/* 3D Map Loading Progress Bar */
.map-loading-bar {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(233, 237, 224, 0.88);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  transition: opacity 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), visibility 0.45s ease;
  pointer-events: auto;
}

.map-loading-bar.loaded {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  display: none !important;
}

.map-loading-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 #fff, 0 2px 10px rgba(23, 64, 44, 0.12);
  font: 600 12px var(--sf);
  color: #17402C;
}

.map-loading-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #40c057;
  box-shadow: 0 0 10px #40c057;
  animation: pulse-dot 1.2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 1; }
}

.map-loading-track {
  width: 170px;
  height: 4px;
  border-radius: 99px;
  background: rgba(23, 64, 44, 0.12);
  overflow: hidden;
  position: relative;
}

.map-loading-fill {
  height: 100%;
  width: 30%;
  border-radius: 99px;
  background: linear-gradient(90deg, #17402C, #40c057);
  box-shadow: 0 0 8px rgba(64, 192, 87, 0.4);
  transition: width 0.25s ease-out;
}

/* Multi-scale Globe LOD selector atop map */
.map-scale-selector {
  position: absolute !important;
  top: 10px !important;
  left: 10px !important;
  right: auto !important;
  bottom: auto !important;
  height: 28px !important;
  width: auto !important;
  max-width: max-content !important;
  z-index: 30 !important;
  pointer-events: auto !important;
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
  background: rgba(255, 255, 255, 0.76) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.8) !important;
  backdrop-filter: blur(14px) saturate(1.8) !important;
  border-radius: 999px !important;
  padding: 2px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 2px 8px rgba(23, 43, 36, 0.12) !important;
  border: 0.5px solid rgba(23, 43, 36, 0.14) !important;
}
.map-scale-selector button {
  border: 0 !important;
  background: none !important;
  font: 700 9.5px/1 var(--sf) !important;
  color: #56665D !important;
  letter-spacing: 0.04em !important;
  padding: 5px 9px !important;
  border-radius: 999px !important;
  cursor: pointer !important;
  transition: all 0.18s ease !important;
}
.map-scale-selector button:active {
  transform: scale(0.94) !important;
}
.map-scale-selector button.active {
  background: #17402C !important;
  color: #fff !important;
  box-shadow: 0 1px 4px rgba(23, 64, 44, 0.25) !important;
}
.map-badge-3d {
  display: none !important;
}
.btn-3d-fullscreen{display:none!important}

@media (max-width: 600px) {
  .btn-3d-fullscreen{display:none!important}
}

/* Shared element transition animation for 3D Mission Control launch */
.btn-3d-fullscreen.launching {
  transform: scale(1.08) !important;
  background: #17402C !important;
  color: #fff !important;
  box-shadow: 0 0 32px rgba(64, 192, 87, 0.6) !important;
  transition: all 0.28s cubic-bezier(0.3, 1.4, 0.5, 1) !important;
}

/* 3D Massifs & Photo Markers (Pure Text & Apple Liquid Glass) */
.massif-marker-3d {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  cursor: pointer !important;
  pointer-events: auto !important;
  transform: translate(-50%, -100%) !important;
  transition: transform 0.18s ease !important;
}
.massif-marker-3d:active {
  transform: translate(-50%, -100%) scale(0.92) !important;
}
.massif-marker-badge {
  padding: 3px 8px !important;
  border-radius: 999px !important;
  background: rgba(23, 64, 44, 0.9) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  backdrop-filter: blur(10px) !important;
  color: #fff !important;
  font: 700 9.5px var(--sf) !important;
  letter-spacing: 0.03em !important;
  white-space: nowrap !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.25) !important;
}
.massif-marker-dot {
  width: 7px !important;
  height: 7px !important;
  border-radius: 50% !important;
  background: #40c057 !important;
  margin-top: 2px !important;
  box-shadow: 0 0 0 2px #fff, 0 0 8px rgba(64, 192, 87, 0.8) !important;
}
.photo-marker-3d {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  cursor: pointer !important;
  pointer-events: auto !important;
  transform: translate(-50%, -100%) !important;
  transition: transform 0.18s ease !important;
}
.photo-marker-badge {
  padding: 3px 7px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.9) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  backdrop-filter: blur(10px) !important;
  color: #17402C !important;
  font: 700 9px var(--sf) !important;
  letter-spacing: 0.02em !important;
  white-space: nowrap !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
  border: 0.5px solid rgba(23, 64, 44, 0.15) !important;
}
.photo-marker-dot {
  width: 6px !important;
  height: 6px !important;
  border-radius: 50% !important;
  background: #ff9e5e !important;
  margin-top: 2px !important;
  box-shadow: 0 0 0 2px #fff !important;
}

/* Apple iOS Clean & Refined Vector Icons */
.ic {
  display: inline-block !important;
  width: 20px !important;
  height: 20px !important;
  fill: none !important;
  stroke: currentColor !important;
  stroke-width: 1.8 !important;
  stroke-linecap: round !important;
  stroke-linejoin: round !important;
  flex: none !important;
  vertical-align: middle !important;
  transition: transform 0.15s ease, stroke 0.15s ease !important;
}

.ic.s { width: 16px !important; height: 16px !important; stroke-width: 1.7 !important; }
.ic.xs { width: 13px !important; height: 13px !important; stroke-width: 2 !important; }
.ic .f { fill: currentColor !important; stroke: none !important; }

/* Apple iOS Tab Bar (Icon + SF Pro Micro-label) */
.tb button {
  position: relative !important;
  z-index: 2 !important;
  border: 0 !important;
  background: none !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 2px !important;
  font: 600 10px/1 var(--sf) !important;
  letter-spacing: -0.01em !important;
  cursor: pointer !important;
  border-radius: 999px !important;
  color: #56665D !important;
  height: 100% !important;
  padding: 3px 0 !important;
  transition: color 0.16s ease !important;
}

.tb button.on {
  color: #17402C !important;
  font-weight: 700 !important;
}

.tb button .ic {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
  stroke: currentColor !important;
  stroke-width: 1.8 !important;
}

.tb button.on .ic {
  stroke-width: 2.2 !important;
}

/* Glass map controls with crisp iOS icons */
.mctl button {
  width: 38px !important;
  height: 36px !important;
  display: grid !important;
  place-items: center !important;
  color: #17402C !important;
}

.mctl button .ic {
  width: 18px !important;
  height: 18px !important;
}

.ig-top-r .gbtn {
  width: 38px !important;
  height: 38px !important;
  border-radius: 50% !important;
  display: grid !important;
  place-items: center !important;
  color: #17402C !important;
  padding: 0 !important;
}

.ig-top-r .gbtn .ic {
  width: 18px !important;
  height: 18px !important;
}



.flow button {
  height: 28px !important;
  padding: 0 11px !important;
  border-radius: 999px !important;
  font: 600 11.5px var(--sf) !important;
  letter-spacing: 0.02em !important;
  background: rgba(255, 255, 255, 0.6) !important;
  color: #172B24 !important;
  border: 0.5px solid rgba(23, 64, 44, 0.12) !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 5px !important;
}

.flow button.cur {
  background: #17402C !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  padding: 0 13px !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.25) !important;
  border-color: #17402C !important;
}

.flow button .fic, .flow button .ic {
  display: inline-flex !important;
  width: 13px !important;
  height: 13px !important;
}

/* 5 Écrans Identité : Clarté, espacements généreux et zéro icône */
.sheet .sh-b {
  padding: 4px 2px 28px !important;
  -webkit-overflow-scrolling: touch !important;
}

.sheet .sumline {
  background: rgba(23, 64, 44, 0.06) !important;
  border: 0.5px solid rgba(23, 64, 44, 0.1) !important;
  border-radius: 14px !important;
  padding: 10px 14px !important;
  margin-bottom: 10px !important;
  font-size: 13px !important;
}

.sheet .li {
  padding: 11px 4px !important;
  min-height: 52px !important;
  border-top: 0.5px solid rgba(23, 43, 36, 0.08) !important;
}

.sheet .li .ttl {
  font-size: 14px !important;
  font-weight: 600 !important;
  color: #172B24 !important;
}

.sheet .li .s2 {
  font-size: 12px !important;
  color: #56665D !important;
  margin-top: 3px !important;
  line-height: 1.35 !important;
}

.sheet .chips {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 7px !important;
  margin-top: 6px !important;
  margin-bottom: 10px !important;
}

.sheet .chip {
  height: 32px !important;
  padding: 0 13px !important;
  font: 600 12.5px/32px var(--sf) !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.72) !important;
  border: 0.5px solid rgba(23, 64, 44, 0.14) !important;
  color: #172B24 !important;
  box-shadow: 0 1px 3px rgba(23, 43, 36, 0.04) !important;
  transition: all 0.15s ease !important;
}

.sheet .chip[aria-pressed=true] {
  background: #17402C !important;
  color: #ffffff !important;
  border-color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.22) !important;
}

.sheet .sh-f {
  padding-top: 8px !important;
  border-top: 0.5px solid rgba(23, 43, 36, 0.08) !important;
}

.flag-badge {
  display: inline-flex !important;
  align-items: center !important;
  padding: 1px 7px !important;
  border-radius: 6px !important;
  background: rgba(23, 64, 44, 0.08) !important;
  font: 700 11px var(--sf) !important;
  color: #17402C !important;
  letter-spacing: 0.04em !important;
}

.vis-tag-mini {
  display: inline-block !important;
  font: 700 9.5px var(--sf) !important;
  letter-spacing: 0.05em !important;
  color: #17402C !important;
  background: rgba(23, 64, 44, 0.08) !important;
  padding: 2px 6px !important;
  border-radius: 6px !important;
  margin-right: 4px !important;
}

.hl-monogram {
  font: 700 11px var(--sf) !important;
  color: #17402C !important;
  letter-spacing: 0.04em !important;
}

/* ==============================================================================
   Compte iOS 27 v10 — Avatar Agrandi (84px mobile / 96px desktop)
   ============================================================================== */
.ig-avi-wrap {
  width: 84px !important;
  height: 84px !important;
  border-radius: 50% !important;
  position: relative !important;
  flex: none !important;
  display: grid !important;
  place-items: center !important;
  background: linear-gradient(145deg, rgba(255,255,255,0.92), rgba(235,242,236,0.65)) !important;
  box-shadow: 0 4px 18px rgba(23, 64, 44, 0.16), inset 0 1px 0 rgba(255,255,255,0.95), 0 0 0 1.5px rgba(91,127,85,0.3) !important;
  transition: transform 0.2s cubic-bezier(0.3, 1.4, 0.5, 1) !important;
}
.ig-avi-wrap:active {
  transform: scale(0.96) !important;
}
.ig-avi-in {
  width: 76px !important;
  height: 76px !important;
  border-radius: 50% !important;
  overflow: hidden !important;
  display: grid !important;
  place-items: center !important;
  background: #EBF2EC !important;
}
.ig-avi-in img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}
.ig-note {
  position: absolute !important;
  top: -8px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  font: 700 9px var(--sf) !important;
  padding: 2px 7px !important;
  border-radius: 999px !important;
  background: #fff !important;
  color: #17402C !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
  white-space: nowrap !important;
  z-index: 3 !important;
}
.ig-seal-bdg {
  position: absolute !important;
  bottom: 0 !important;
  right: 0 !important;
  width: 24px !important;
  height: 24px !important;
  border-radius: 50% !important;
  background: #fff !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
  display: grid !important;
  place-items: center !important;
  z-index: 3 !important;
}

@media (min-width: 601px) {
  .ig-avi-wrap {
    width: 96px !important;
    height: 96px !important;
  }
  .ig-avi-in {
    width: 88px !important;
    height: 88px !important;
  }
}

/* ==============================================================================
   Compte iOS 27 v10 — Sélecteur Grille & Sorties Style Bottom Bar Capsule
   ============================================================================== */
.ig-tabs {
  position: absolute !important;
  top: 12px !important;
  right: 14px !important;
  z-index: 10 !important;
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  width: 88px !important;
  max-width: 88px !important;
  margin: 0 !important;
  height: 32px !important;
  padding: 2.5px !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.35), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
  box-sizing: border-box !important;
}
@media (prefers-color-scheme: dark) {
  .ig-tabs {
    background: rgba(255, 255, 255, 0.65) !important;
    border-color: rgba(255, 255, 255, 0.8) !important;
  }
}
.ig-tabs .ig-th {
  position: absolute !important;
  top: 2.5px !important;
  bottom: 2.5px !important;
  left: 2.5px !important;
  width: calc(50% - 2.5px) !important;
  height: calc(100% - 5px) !important;
  border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.42)) !important;
  box-shadow: inset 0 1px 0 #fff, inset 0 -1px 1px rgba(255, 255, 255, 0.5), 0 0 0 0.5px rgba(23, 43, 36, 0.07), 0 2px 8px rgba(23, 43, 36, 0.08) !important;
  transition: transform 0.28s cubic-bezier(0.3, 1.35, 0.4, 1) !important;
  z-index: 1 !important;
}
@media (prefers-color-scheme: dark) {
  .ig-tabs .ig-th {
    background: rgba(255, 255, 255, 0.22) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3) !important;
  }
}
.ig-tabs button {
  position: relative !important;
  z-index: 2 !important;
  border: 0 !important;
  background: none !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #56665D !important;
  cursor: pointer !important;
  border-radius: 9999px !important;
  transition: color 0.18s ease, transform 0.12s ease !important;
  padding: 0 !important;
}
.ig-tabs button:active {
  transform: scale(0.92) !important;
}
.ig-tabs button[aria-selected="true"] {
  color: #17402C !important;
}
@media (prefers-color-scheme: dark) {
  .ig-tabs button[aria-selected="true"] {
    color: #96B391 !important;
  }
}
.ig-tabs button svg,
.ig-tabs button .ic {
  width: 15px !important;
  height: 15px !important;
  display: block !important;
  stroke: currentColor !important;
  stroke-width: 1.8 !important;
  transition: stroke-width 0.18s ease, transform 0.18s ease !important;
}
.ig-tabs button[aria-selected="true"] svg,
.ig-tabs button[aria-selected="true"] .ic {
  stroke-width: 2.2 !important;
  transform: scale(1.06) !important;
}

/* ==============================================================================
   Compte iOS 27 v10 — Drawer Identité 5 Écrans (Icônes Uniques Pures, Zéro Texte)
   ============================================================================== */
.flow {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px !important;
  padding: 3px 6px !important;
  width: auto !important;
  height: 36px !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
  box-sizing: border-box !important;
}
.flow button {
  width: 36px !important;
  height: 30px !important;
  padding: 0 !important;
  border-radius: 9999px !important;
  background: transparent !important;
  color: #56665D !important;
  border: 0 !important;
  box-shadow: none !important;
  display: grid !important;
  place-items: center !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}
.flow button:active {
  transform: scale(0.94) !important;
}
.flow button.cur {
  background: #ffffff !important;
  color: #17402C !important;
  border: 0 !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
}
.flow button svg,
.flow button .ic {
  width: 18px !important;
  height: 18px !important;
  stroke: currentColor !important;
  stroke-width: 2 !important;
}
.flow button span.flb {
  display: none !important;
}
.flow .ln {
  display: none !important;
}

/* Inset Grouped & Apple Cards */
.apple-grouped-card {
  border-radius: 18px !important;
  background: rgba(255, 255, 255, 0.72) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  backdrop-filter: blur(16px) !important;
  border: 0.5px solid rgba(23, 43, 36, 0.1) !important;
  box-shadow: 0 2px 10px rgba(23, 43, 36, 0.04) !important;
  padding: 12px 14px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  margin-bottom: 10px !important;
}
.apple-grouped-title {
  font: 700 11px var(--sf) !important;
  color: var(--label2) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
  padding-left: 2px !important;
}
.apple-input-row {
  display: flex !important;
  flex-direction: column !important;
  gap: 4px !important;
}
.apple-input-row + .apple-input-row {
  padding-top: 8px !important;
  border-top: 0.5px solid var(--sep) !important;
}
.apple-input {
  width: 100% !important;
  height: 38px !important;
  border-radius: 12px !important;
  border: 0.5px solid rgba(23, 43, 36, 0.14) !important;
  background: rgba(255, 255, 255, 0.88) !important;
  padding: 0 12px !important;
  font: 500 13.5px var(--sf) !important;
  color: var(--label) !important;
  outline: none !important;
  transition: border-color 0.15s, box-shadow 0.15s !important;
}
.apple-input:focus {
  border-color: #17402C !important;
  box-shadow: 0 0 0 2px rgba(23, 64, 44, 0.15) !important;
}

/* Apple Edit Sheet & Navigation */
.apple-edit-sheet {
  display: flex !important;
  flex-direction: column !important;
  gap: 12px !important;
  padding: 4px 0 24px !important;
}
.apple-nav-bar {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 4px 6px 12px !important;
  margin-bottom: 6px !important;
  border-bottom: 0.5px solid rgba(23, 43, 36, 0.08) !important;
}
.apple-nav-btn {
  border: 0 !important;
  background: none !important;
  font: 500 15px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #56665D !important;
  cursor: pointer !important;
  padding: 6px 12px !important;
  border-radius: 999px !important;
  transition: background 0.15s ease, color 0.15s ease !important;
}
.apple-nav-btn:active {
  background: rgba(23, 43, 36, 0.06) !important;
}
.apple-nav-btn.save {
  font-weight: 700 !important;
  color: #17402C !important;
  background: rgba(23, 64, 44, 0.08) !important;
}
.apple-nav-title {
  font: 700 16px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif !important;
  color: #17402C !important;
  letter-spacing: -0.015em !important;
}
.apple-avatar-header {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 6px 0 !important;
  gap: 10px !important;
}
.apple-av-wrap {
  position: relative !important;
  width: 76px !important;
  height: 76px !important;
  border-radius: 50% !important;
  cursor: pointer !important;
  box-shadow: 0 4px 16px rgba(23, 43, 36, 0.15), 0 0 0 2.5px rgba(255, 255, 255, 0.95) !important;
}
.apple-av-img {
  width: 100% !important;
  height: 100% !important;
  border-radius: 50% !important;
  object-fit: cover !important;
  display: block !important;
}
.apple-av-cam {
  position: absolute !important;
  right: -2px !important;
  bottom: -2px !important;
  width: 26px !important;
  height: 26px !important;
  border-radius: 50% !important;
  background: #17402C !important;
  color: #ffffff !important;
  display: grid !important;
  place-items: center !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2), 0 0 0 2px #ffffff !important;
}
.apple-av-cam svg {
  width: 13px !important;
  height: 13px !important;
  stroke: #ffffff !important;
}
#sw[data-k="edit_profile_full"] .sh-head {
  display: none !important;
}

/* ==============================================================================
   Compte iOS 27 v11 — Refonte Profil Instagram, Verre Lumineux, Modal Post & Fixes
   ============================================================================== */

/* Point 1 — Profile Header layout (Instagram style minimaliste) */
.card {
  position: relative !important;
}
.ig-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  padding: 38px 12px 4px !important;
}
.ig-left {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  flex: none !important;
  width: 88px !important;
  text-align: center !important;
}
@media (min-width: 601px) {
  .ig-left {
    width: 104px !important;
  }
}
.ig-left-meta {
  margin-top: 6px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 1px !important;
}
.ig-left-meta .ig-name {
  font: 700 14px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif !important;
  color: #17402C !important;
  letter-spacing: -0.01em !important;
}
.ig-left-meta .ig-handle-sub {
  font: 500 11.5px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #56665D !important;
}
.ig-right {
  flex: 1 1 auto !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  min-width: 0 !important;
  padding-top: 0 !important;
}
.ig-stats {
  display: flex !important;
  justify-content: space-around !important;
  align-items: center !important;
  width: 100% !important;
  gap: 4px !important;
  margin-top: 0 !important;
}
.ig-stat {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  padding: 4px 6px !important;
  min-height: unset !important;
  flex: 1 1 0 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  text-align: center !important;
  cursor: pointer !important;
  transition: transform 0.15s ease !important;
}
.ig-stat:active {
  transform: scale(0.94) !important;
  background: transparent !important;
}
.ig-stat b.num {
  font: 700 18px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif !important;
  color: #17402C !important;
  letter-spacing: -0.02em !important;
  margin-bottom: 2px !important;
}
.ig-stat span {
  font: 500 11.5px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #56665D !important;
  letter-spacing: 0 !important;
  white-space: nowrap !important;
}

/* Point 2 — Central Selector 100% Light Liquid Glass */
.ig-tabs {
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
}
@media (prefers-color-scheme: dark) {
  .ig-tabs {
    background: rgba(255, 255, 255, 0.65) !important;
    border-color: rgba(255, 255, 255, 0.8) !important;
  }
}
.ig-tabs .ig-th.lens,
.ig-tabs .ig-th {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72)) !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
}
@media (prefers-color-scheme: dark) {
  .ig-tabs .ig-th.lens,
  .ig-tabs .ig-th {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72)) !important;
    box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
  }
}
.ig-tabs button {
  color: #56665D !important;
}
.ig-tabs button[aria-selected="true"] {
  color: #17402C !important;
}
@media (prefers-color-scheme: dark) {
  .ig-tabs button[aria-selected="true"] {
    color: #17402C !important;
  }
}

/* Point 5 — Map Zoom Presets & Z-Index fix */
.map-scale-selector {
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
}
.map-scale-selector button {
  color: #56665D !important;
}
.map-scale-selector button.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.75)) !important;
  color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
}

.sheet-open .mctl,
.sheet-open .map-scale-selector,
.phone[data-sheet-open="true"] .mctl,
.phone[data-sheet-open="true"] .map-scale-selector,
.phone:has(#sw[data-det="medium"]) .mctl,
.phone:has(#sw[data-det="large"]) .mctl,
.phone:has(#sw[data-det="medium"]) .map-scale-selector,
.phone:has(#sw[data-det="large"]) .map-scale-selector,
#sw[data-det="medium"] ~ * .mctl,
#sw[data-det="large"] ~ * .mctl,
.phone.sheet-open .mctl,
.phone.sheet-open .map-scale-selector {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateY(12px) !important;
  transition: opacity 0.2s ease, transform 0.2s ease !important;
}
.mctl, .map-scale-selector {
  transition: opacity 0.2s ease, transform 0.2s ease !important;
}

/* Bottom bar, tabbar & accessory reduction on map open (.phone.mapbig) or drawer open (.sheet-open / det=large) */
.phone.mapbig .tb,
.phone.mapbig .acc,
.phone.mapbig .tabbar,
.phone.sheet-open .tb,
.phone.sheet-open .acc,
.phone.sheet-open .tabbar,
.phone[data-sheet-open="true"] .tb,
.phone[data-sheet-open="true"] .acc,
.phone[data-sheet-open="true"] .tabbar,
.phone:has(#sw[data-det="large"]) .tb,
.phone:has(#sw[data-det="large"]) .acc,
.phone:has(#sw[data-det="large"]) .tabbar,
.phone:has(#sw[data-det="medium"]) .tb,
.phone:has(#sw[data-det="medium"]) .acc,
.phone:has(#sw[data-det="medium"]) .tabbar,
.phone:has(#sw:not([data-det="closed"])) .tb,
.phone:has(#sw:not([data-det="closed"])) .acc,
.phone:has(#sw:not([data-det="closed"])) .tabbar,
#sw[data-det="large"] ~ * .tb,
#sw[data-det="large"] ~ * .acc,
#sw[data-det="large"] ~ * .tabbar,
#sw:not([data-det="closed"]) ~ * .tb,
#sw:not([data-det="closed"]) ~ * .acc,
#sw:not([data-det="closed"]) ~ * .tabbar {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateY(120%) !important;
  transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.32, 0.72, 0, 1) !important;
}
.tb, .acc, .tabbar {
  transition: opacity 0.25s ease, transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), left 0.5s cubic-bezier(0.32, 0.72, 0, 1), right 0.5s cubic-bezier(0.32, 0.72, 0, 1), height 0.5s cubic-bezier(0.32, 0.72, 0, 1) !important;
}

/* Point 7 — Sorties Tab Cleanup */
.voyages-header {
  display: none !important;
}
.ig-voyages-tab {
  padding-top: 4px !important;
}

/* Point 8 — Story Fullscreen 100% */
.story.on {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  max-width: none !important;
  border-radius: 0 !important;
  z-index: 9999 !important;
  box-sizing: border-box !important;
  padding: max(16px, env(safe-area-inset-top, 16px)) 16px max(16px, env(safe-area-inset-bottom, 16px)) !important;
}

/* Point 3 & 4 — Modal Post Instagram Drawer Overlay Leaving 3D Map Visible */
.post-modal-instagram {
  position: absolute !important;
  top: 48px !important;
  left: 8px !important;
  right: 8px !important;
  bottom: calc(40% + 10px) !important;
  z-index: 35 !important;
  display: none !important;
  background: transparent !important;
  pointer-events: none !important;
}
.post-modal-instagram.open {
  display: flex !important;
  flex-direction: column !important;
  pointer-events: auto !important;
}
.pmi-dialog {
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  background: rgba(255, 255, 255, 0.92) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border-radius: 28px !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  box-shadow: 0 12px 36px rgba(23, 43, 36, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 0 0 0.5px rgba(23, 43, 36, 0.12) !important;
}
.pmi-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 12px 14px 10px !important;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08) !important;
  flex: none !important;
}
.pmi-user-info {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.pmi-av {
  width: 36px !important;
  height: 36px !important;
  border-radius: 50% !important;
  object-fit: cover !important;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
}
.pmi-user-meta {
  display: flex !important;
  flex-direction: column !important;
}
.pmi-user-meta b {
  font: 700 13px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif !important;
  color: #17402C !important;
}
.pmi-location {
  font: 400 11px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #56665D !important;
}
.pmi-h-actions {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}
.pmi-more-btn, .pmi-close-btn {
  background: none !important;
  border: 0 !important;
  cursor: pointer !important;
  padding: 6px !important;
  color: #17402C !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 50% !important;
}
.pmi-close-btn:active {
  background: rgba(0, 0, 0, 0.06) !important;
}
.pmi-scroll-area {
  flex: 1 !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
}
.pmi-media {
  position: relative !important;
  width: 100% !important;
  aspect-ratio: 1 / 1 !important;
  background: #17402C !important;
  overflow: hidden !important;
}
.pmi-media img, .pmi-media .art {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  display: block !important;
}
.pmi-actions {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 10px 14px 6px !important;
}
.pmi-actions-left {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
}
.pmi-act-btn {
  background: none !important;
  border: 0 !important;
  cursor: pointer !important;
  padding: 2px !important;
  display: grid !important;
  place-items: center !important;
  color: #17402C !important;
  transition: transform 0.15s ease !important;
}
.pmi-act-btn:active {
  transform: scale(0.85) !important;
}
.pmi-act-btn.liked {
  color: #E0245E !important;
}
.pmi-act-btn.saved {
  color: #17402C !important;
}
.pmi-social-counter {
  padding: 0 14px 4px !important;
  font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #17402C !important;
}
.pmi-social-counter b {
  font-weight: 700 !important;
}
.pmi-caption-block {
  padding: 2px 14px 8px !important;
  font: 400 13px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #222222 !important;
}
.pmi-caption-block b {
  font-weight: 700 !important;
  color: #17402C !important;
  margin-right: 5px !important;
}
.pmi-hashtags {
  color: #3D7A52 !important;
  font-weight: 500 !important;
}
.pmi-time {
  padding: 0 14px 10px !important;
  font: 500 10.5px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #8E9992 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
}
.pmi-comments-list {
  padding: 6px 14px 12px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
  border-top: 0.5px solid rgba(0, 0, 0, 0.06) !important;
}
.pmi-comment-row {
  display: flex !important;
  align-items: flex-start !important;
  gap: 10px !important;
}
.pmi-c-av {
  width: 28px !important;
  height: 28px !important;
  border-radius: 50% !important;
  object-fit: cover !important;
  flex: none !important;
}
.pmi-c-body {
  flex: 1 !important;
  font: 400 12.5px/1.35 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #222 !important;
}
.pmi-c-user {
  font-weight: 700 !important;
  color: #17402C !important;
  margin-right: 5px !important;
}
.pmi-c-meta {
  font: 400 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #8E9992 !important;
  margin-top: 2px !important;
}
.pmi-comment-bar {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 10px 14px calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
  border-top: 0.5px solid rgba(0, 0, 0, 0.08) !important;
  background: #fafafa !important;
  flex: none !important;
}
.pmi-comment-bar .pmi-c-av {
  width: 32px !important;
  height: 32px !important;
}
.pmi-input {
  flex: 1 !important;
  height: 36px !important;
  border: 0.5px solid rgba(23, 64, 44, 0.2) !important;
  border-radius: 18px !important;
  padding: 0 14px !important;
  font: 400 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #17402C !important;
  background: #ffffff !important;
  outline: none !important;
}
.pmi-input:focus {
  border-color: #17402C !important;
}
.pmi-submit-btn {
  border: 0 !important;
  background: none !important;
  font: 700 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif !important;
  color: #3D7A52 !important;
  cursor: pointer !important;
  padding: 6px 4px !important;
}
.pmi-submit-btn:disabled {
  opacity: 0.4 !important;
  cursor: default !important;
}

/* ==============================================================================
   Compte iOS 27 v12 — Universal Light Liquid Glass Selectors & 3D Resilience
   ============================================================================== */

/* Point 5 — 3D Living Map Solid Background & Highlighted Markers */
#maplibre-compte-canvas {
  background-color: #0b101b !important;
}

.photo-marker-3d.highlight,
.photo-marker-3d.active {
  transform: translate(-50%, -100%) scale(1.22) !important;
  z-index: 50 !important;
}
.photo-marker-3d.highlight .photo-marker-badge,
.photo-marker-3d.active .photo-marker-badge {
  background: #17402C !important;
  color: #ffffff !important;
  border-color: #ffffff !important;
  box-shadow: 0 4px 14px rgba(23, 64, 44, 0.45), 0 0 0 2px #ffffff !important;
}
.photo-marker-3d.highlight .photo-marker-dot,
.photo-marker-3d.active .photo-marker-dot {
  background: #40c057 !important;
  transform: scale(1.5) !important;
  box-shadow: 0 0 0 2px #fff, 0 0 12px #40c057 !important;
  animation: pulse-marker 1.6s infinite !important;
}

@keyframes pulse-marker {
  0% { transform: scale(1.2); box-shadow: 0 0 0 2px #fff, 0 0 6px #40c057; }
  50% { transform: scale(1.6); box-shadow: 0 0 0 3px #fff, 0 0 16px #40c057; }
  100% { transform: scale(1.2); box-shadow: 0 0 0 2px #fff, 0 0 6px #40c057; }
}

/* Point 6 — Universal Light Liquid Glass for All Drawer Selectors */
.flow {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 4px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  border-radius: 9999px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
  padding: 3px 6px !important;
  height: 36px !important;
  box-sizing: border-box !important;
}
.flow button {
  color: #56665D !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  border-radius: 9999px !important;
  transition: all 0.2s ease !important;
  height: 28px !important;
  min-width: 28px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
}
.flow button.cur {
  background: #ffffff !important;
  color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
  border-radius: 9999px !important;
}

.segc {
  display: flex !important;
  align-items: center !important;
  position: relative !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  border-radius: 9999px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
  padding: 3px !important;
  height: 36px !important;
  box-sizing: border-box !important;
}
.segc button {
  position: relative !important;
  z-index: 2 !important;
  flex: 1 1 0 !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #56665D !important;
  border-radius: 9999px !important;
  transition: color 0.2s ease, transform 0.15s ease !important;
  border: 0 !important;
  background: none !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  white-space: nowrap !important;
  padding: 0 8px !important;
}
.segc button.active,
.segc button.cur,
.segc button[aria-pressed="true"] {
  background: #ffffff !important;
  color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
  font-weight: 600 !important;
}
.segc .th {
  position: absolute !important;
  top: 3px !important;
  bottom: 3px !important;
  left: 2px !important;
  border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.75)) !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
  transition: transform 0.28s cubic-bezier(0.3, 1.35, 0.4, 1) !important;
  z-index: 1 !important;
  pointer-events: none !important;
}

.reseau-toggle {
  display: flex !important;
  align-items: center !important;
  position: relative !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  border-radius: 9999px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
  padding: 3px !important;
  height: 36px !important;
  box-sizing: border-box !important;
}
.reseau-toggle button {
  position: relative !important;
  z-index: 2 !important;
  flex: 1 1 0 !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #56665D !important;
  border-radius: 9999px !important;
  transition: color 0.2s ease, transform 0.15s ease !important;
  border: 0 !important;
  background: none !important;
  cursor: pointer !important;
  font-size: 12px !important;
  font-weight: 500 !important;
}
.reseau-toggle button.active,
.reseau-toggle button[aria-pressed="true"] {
  background: #ffffff !important;
  color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
  font-weight: 600 !important;
}

.account-drawer-actions {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 8px !important;
  margin-bottom: 12px !important;
}
.account-drawer-actions .mbtn.p {
  background: var(--pg) !important;
  color: var(--pg-ink) !important;
  box-shadow: var(--pg-sh) !important;
  border-radius: 9999px !important;
}
.account-drawer-actions .mbtn.soft {
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) !important;
  backdrop-filter: blur(28px) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  color: #17402C !important;
  border-radius: 9999px !important;
}

@media (prefers-color-scheme: dark) {
  .flow,
  .segc,
  .reseau-toggle {
    background: rgba(255, 255, 255, 0.65) !important;
    border-color: rgba(255, 255, 255, 0.8) !important;
  }
  .flow button.cur,
  .segc button.active,
  .segc button.cur,
  .segc button[aria-pressed="true"],
  .reseau-toggle button.active {
    background: #ffffff !important;
    color: #17402C !important;
  }
}

/* ==============================================================================
   Compte iOS 27 v13 — Card Corner Selector, Compact Avatar, Instagram Grid,
   Universal Drawer Selectors & Top Bar Cleanup
   ============================================================================== */

/* 1 — Sélecteur Grille/Sorties fusionné dans le coin haut-droit de la card */
.ig-tabs {
  top: 10px !important;
  right: 12px !important;
  width: 88px !important;
  max-width: 88px !important;
  height: 30px !important;
  padding: 2.5px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  border-radius: 9999px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.14), 0 8px 22px rgba(23, 43, 36, 0.12) !important;
  box-sizing: border-box !important;
}
.ig-tabs .ig-th.lens,
.ig-tabs .ig-th {
  top: 2.5px !important;
  bottom: 2.5px !important;
  left: 2.5px !important;
  width: calc(50% - 2.5px) !important;
  height: auto !important;
  border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.26)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.4), 0 0 0 0.5px rgba(23, 43, 36, 0.06), 0 2px 8px rgba(23, 64, 44, 0.1) !important;
  transition: transform 0.28s cubic-bezier(0.3, 1.35, 0.4, 1) !important;
}
.ig-tabs button[aria-selected="true"] {
  color: #17402C !important;
}
.ig-tabs button {
  color: #56665D !important;
}

/* 2 — Avatar compact et header rééquilibré */
.ig-header {
  padding: 40px 12px 2px !important;
  gap: 10px !important;
}
.ig-left {
  width: 72px !important;
}
.ig-avi-wrap {
  width: 66px !important;
  height: 66px !important;
  box-shadow: 0 3px 14px rgba(23, 64, 44, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 0 0 1.5px rgba(91, 127, 85, 0.3) !important;
}
.ig-avi-in {
  width: 58px !important;
  height: 58px !important;
}
.ig-seal-bdg {
  width: 20px !important;
  height: 20px !important;
}
.ig-note {
  top: -7px !important;
  font-size: 8.5px !important;
  padding: 2px 6px !important;
}
.ig-stats {
  gap: 0 !important;
}
.ig-stat {
  padding: 2px 3px !important;
}
.ig-stat b.num {
  font-size: 19px !important;
  line-height: 1.05 !important;
}
.ig-stat span {
  font-size: 10.5px !important;
}
.ig-bio {
  gap: 5px !important;
  margin: 2px 2px 0 !important;
}
.ig-hl-row {
  gap: 10px !important;
  padding: 3px 2px 0 !important;
}
@media (min-width: 601px) {
  .ig-left { width: 80px !important; }
  .ig-avi-wrap { width: 74px !important; height: 74px !important; }
  .ig-avi-in { width: 66px !important; height: 66px !important; }
}

/* 3 — Grille Instagram : 3 colonnes carrées, image + type de post uniquement */
.ig-grid-wrap {
  margin: 3px -14px -13px !important;
  border-radius: 18px !important;
  overflow: hidden !important;
}
.ig-grid {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 2px !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}
.ig-tile {
  position: relative !important;
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 1 / 1 !important;
  border-radius: 2px !important;
  overflow: hidden !important;
  background: #17402C !important;
  box-shadow: none !important;
}
.ig-tile .t-top,
.ig-tile .t-bot,
.ig-tile .t-prog,
.ig-tile .t-pin {
  display: none !important;
}
.ig-tile .t-type {
  position: absolute !important;
  top: 6px !important;
  right: 6px !important;
  width: 20px !important;
  height: 20px !important;
  border-radius: 7px !important;
  display: grid !important;
  place-items: center !important;
  background: rgba(12, 24, 18, 0.5) !important;
  -webkit-backdrop-filter: blur(8px) saturate(1.4) !important;
  backdrop-filter: blur(8px) saturate(1.4) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 1px 4px rgba(0, 0, 0, 0.25) !important;
  color: #ffffff !important;
  z-index: 2 !important;
  pointer-events: none !important;
}
.ig-tile .t-type .ic {
  width: 12px !important;
  height: 12px !important;
  stroke-width: 2.1 !important;
  color: #ffffff !important;
}
.ig-tile svg.art {
  width: 100% !important;
  height: 100% !important;
  display: block !important;
}

/* 4 — Sélecteurs de drawers : socle verre identique à la bottom bar */
.flow,
.segc,
.reseau-toggle,
.ig-sub {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0 !important;
  width: 100% !important;
  max-width: none !important;
  height: 36px !important;
  padding: 3px !important;
  margin: 0 0 10px !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.14), 0 8px 22px rgba(23, 43, 36, 0.12) !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}
.ig-sub {
  height: 34px !important;
  margin-bottom: 8px !important;
}
.flow button,
.segc button,
.reseau-toggle button,
.ig-sub button {
  position: relative !important;
  z-index: 2 !important;
  flex: 1 1 0 !important;
  min-width: 0 !important;
  width: auto !important;
  height: 100% !important;
  padding: 0 8px !important;
  border: 0 !important;
  border-radius: 9999px !important;
  background: transparent !important;
  box-shadow: none !important;
  color: #56665D !important;
  font: 600 12px/1 var(--sf) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  white-space: nowrap !important;
  cursor: pointer !important;
  transition: color 0.2s ease, transform 0.15s ease !important;
}
.flow button {
  padding: 0 !important;
}
.flow button svg,
.flow button .ic {
  width: 18px !important;
  height: 18px !important;
  stroke-width: 2 !important;
}
.flow button.cur,
.segc button.active,
.segc button.cur,
.segc button[aria-pressed="true"],
.reseau-toggle button.active,
.reseau-toggle button[aria-pressed="true"],
.ig-sub button[aria-selected="true"] {
  background: transparent !important;
  color: #17402C !important;
  box-shadow: none !important;
  font-weight: 600 !important;
  padding: 0 8px !important;
}
.flow button.cur {
  padding: 0 !important;
}
.sel-lens {
  position: absolute !important;
  top: 3px !important;
  bottom: 3px !important;
  left: 3px !important;
  width: calc((100% - 6px) / var(--n, 2)) !important;
  border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.22)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.4), 0 0 0 0.5px rgba(23, 43, 36, 0.06), 0 2px 8px rgba(23, 64, 44, 0.1) !important;
  transform: translateX(calc(var(--i, 0) * 100%)) !important;
  transition: transform 0.28s cubic-bezier(0.3, 1.35, 0.4, 1) !important;
  z-index: 1 !important;
  pointer-events: none !important;
}

@media (prefers-color-scheme: dark) {
  .ig-tabs,
  .flow,
  .segc,
  .reseau-toggle,
  .ig-sub {
    background: rgba(255, 255, 255, 0.65) !important;
    border-color: rgba(255, 255, 255, 0.8) !important;
  }
  .flow button.cur,
  .segc button.active,
  .segc button.cur,
  .segc button[aria-pressed="true"],
  .reseau-toggle button.active,
  .reseau-toggle button[aria-pressed="true"],
  .ig-sub button[aria-selected="true"] {
    color: #17402C !important;
  }
}

/* ==============================================================================
   Compte iOS 27 v14 — Card aérée, sélecteur bas-droite, drawers carte,
   post modal immersif, contrôles carte unifiés & polissage des tiroirs
   ============================================================================== */

/* 1 — Marque blanche douce et card remontée, scrollable, sans découpe */
.ig-handle {
  color: rgba(255, 255, 255, 0.94) !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.28) !important;
  background: rgba(255, 255, 255, 0.14) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.3) !important;
  -webkit-backdrop-filter: blur(18px) saturate(180%) !important;
  backdrop-filter: blur(18px) saturate(180%) !important;
}
.ig-handle span { color: inherit !important; }
#card.cs {
  padding: 8px 12px 14px !important;
  gap: 5px !important;
  border-radius: 24px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  scrollbar-width: none !important;
  overscroll-behavior: contain !important;
}
#card.cs::-webkit-scrollbar { display: none !important; }
.ig-header {
  padding: 2px 2px 0 !important;
  gap: 10px !important;
  grid-template-columns: 66px minmax(0, 1fr) !important;
  align-items: center !important;
}
.ig-left { width: 66px !important; }
.ig-bio { gap: 3px !important; margin: 0 2px !important; }
.ig-hl-row { gap: 8px !important; padding: 1px 2px 0 !important; }
.ig-note { display: none !important; }

/* 2 — Sélecteur Grille/Sorties sous les stories, aligné à droite au-dessus des posts */
.ig-tabs-row {
  display: flex !important;
  justify-content: flex-end !important;
  align-items: center !important;
  margin: 1px 2px 5px !important;
  flex: none !important;
}
.ig-tabs {
  position: relative !important;
  top: auto !important;
  right: auto !important;
  left: auto !important;
  bottom: auto !important;
  width: 88px !important;
  max-width: 88px !important;
  height: 30px !important;
  flex: none !important;
}

/* 3 — Grille bord à bord, carrée, sans texte ; carrousel Sorties non rogné */
.ig-grid-wrap {
  margin: 0 -12px -14px !important;
  border-radius: 22px !important;
  overflow: hidden !important;
}
.ig-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 2px !important;
  width: 100% !important;
}
.ig-tile {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 1 / 1 !important;
  border-radius: 2px !important;
}
.ig-voyages-tab { overflow: visible !important; padding-bottom: 2px !important; }
.voyages-carousel {
  padding: 4px 12px 14px !important;
  overflow-x: auto !important;
  scroll-padding-inline: 12px !important;
}
.voyage-card { flex: 0 0 78% !important; }
.voyage-cover { height: 150px !important; }

/* 4 — Contrôles de carte unifiés en Liquid Glass iOS 27 */
.map-scale-selector {
  height: 34px !important;
  padding: 3px !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.14), 0 8px 22px rgba(23, 43, 36, 0.12) !important;
  gap: 1px !important;
}
.map-scale-selector button {
  width: 30px !important;
  height: 28px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  color: #56665D !important;
  border-radius: 9999px !important;
}
.map-scale-selector button.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72)) !important;
  color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12), inset 0 1px 0 #ffffff !important;
}
.mctl {
  width: 42px !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.14), 0 8px 22px rgba(23, 43, 36, 0.12) !important;
  overflow: hidden !important;
}
.mctl button {
  width: 42px !important;
  height: 40px !important;
  color: #56665D !important;
  background: transparent !important;
}
.mctl button + button { box-shadow: 0 -0.5px 0 rgba(23, 43, 36, 0.08) !important; }
.map-scale-selector button,
.mctl button { position: relative !important; }
.map-scale-selector button::after,
.mctl button::after {
  content: "" !important;
  position: absolute !important;
  inset: -5px !important;
}
.map-scale-selector button:focus-visible,
.mctl button:focus-visible,
.flow button:focus-visible,
.segc button:focus-visible,
.reseau-toggle button:focus-visible,
.ig-sub button:focus-visible,
.pmi-pill-btn:focus-visible,
.pmi-more-pill:focus-visible,
.pmi-profile-pill:focus-visible {
  outline: none !important;
  box-shadow: inset 0 0 0 2px #17402C, inset 0 0 0 4px #FFFFFF !important;
}
.mctl button[aria-expanded="true"],
.mctl button:active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72)) !important;
  color: #17402C !important;
}
.phone[data-det="card"] .mctl,
.phone[data-det="card"] .map-scale-selector,
.phone.sheet-open[data-det="card"] .mctl,
.phone.sheet-open[data-det="card"] .map-scale-selector,
.phone[data-sheet-open="true"][data-det="card"] .mctl,
.phone[data-sheet-open="true"][data-det="card"] .map-scale-selector {
  opacity: 1 !important;
  pointer-events: auto !important;
  transform: none !important;
}

/* 5 — Drawers : hauteur carte, bord à bord, verre translucide, scroll interne */
.sw-wrap[data-det="card"] .sheet {
  top: 48px !important;
  bottom: calc(31% + 46px) !important;
  left: 8px !important;
  right: 8px !important;
  width: auto !important;
  max-width: none !important;
  border-radius: 32px !important;
}
.sw-wrap[data-det="card"] .sh-b {
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
  scrollbar-width: none !important;
  padding: 2px 2px 8px !important;
  gap: 8px !important;
  scroll-padding-block: 8px !important;
}
.sw-wrap[data-det="card"] .sh-b::-webkit-scrollbar { display: none !important; }
.sw-wrap[data-det="card"] .scrim { opacity: 0 !important; pointer-events: none !important; }
.sheet {
  padding: 0 13px calc(11px + env(safe-area-inset-bottom, 0px)) !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92) 42%, rgba(255, 255, 255, 0.95)) !important;
  -webkit-backdrop-filter: blur(32px) saturate(190%) brightness(1.05) !important;
  backdrop-filter: blur(32px) saturate(190%) brightness(1.05) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.5), 0 0 0 0.5px rgba(23, 43, 36, 0.12), 0 -8px 36px rgba(23, 43, 36, 0.16) !important;
}
.grab span {
  width: 38px !important;
  height: 5px !important;
  border-radius: 3px !important;
  background: rgba(255, 255, 255, 0.82) !important;
  box-shadow: 0 1px 6px rgba(23, 43, 36, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
}
.sh-h { margin-top: 0 !important; min-height: 34px !important; }
.sh-h h3 { font-size: 15px !important; font-weight: 600 !important; letter-spacing: -0.01em !important; color: #17402C !important; }
.sh-h-spacer { width: 32px !important; height: 32px !important; flex: none !important; }
.peekline { font-size: 12px !important; color: #56665D !important; }
.sheet .flow,
.sheet .segc,
.sheet .reseau-toggle,
.sheet .ig-sub {
  height: 38px !important;
  padding: 4px !important;
  margin-bottom: 10px !important;
}
.sh-h .flow { margin-bottom: 0 !important; }
.sheet .flow button,
.sheet .segc button,
.sheet .reseau-toggle button,
.sheet .ig-sub button {
  padding: 0 !important;
}
.sheet .flow button svg,
.sheet .segc button svg,
.sheet .reseau-toggle button svg,
.sheet .ig-sub button svg {
  width: 19px !important;
  height: 19px !important;
  stroke-width: 1.9 !important;
}

/* 6 — 10+ améliorations de style communes à chaque écran de drawer */
.sheet .li.nt {
  background: rgba(255, 255, 255, 0.38) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 15px !important;
  padding: 9px 10px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 2px 8px rgba(23, 43, 36, 0.04) !important;
  transition: transform 0.15s ease, background 0.2s ease !important;
}
.sheet .li.nt:active { transform: scale(0.995) !important; background: rgba(255, 255, 255, 0.52) !important; }
.sheet .li .ttl { font-size: 13px !important; color: #17402C !important; }
.sheet .li .s2 { font-size: 11.5px !important; line-height: 1.35 !important; color: #3F4F46 !important; }
.sheet .cap { font: 700 10px/1.2 var(--sf) !important; letter-spacing: 0.08em !important; text-transform: uppercase !important; color: #17402C !important; }
.sheet .mbtn {
  min-height: 34px !important;
  border-radius: 999px !important;
  font-size: 12.5px !important;
  font-weight: 600 !important;
}
.sheet .mbtn.p {
  background: var(--pg) !important;
  color: var(--pg-ink) !important;
  box-shadow: var(--pg-sh) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.75) !important;
}
.sheet .mbtn.soft {
  background: rgba(255, 255, 255, 0.6) !important;
  color: #17402C !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  backdrop-filter: blur(18px) !important;
}
.sheet .menu2 {
  background: rgba(255, 255, 255, 0.38) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 15px !important;
  overflow: hidden !important;
}
.sheet .mi { min-height: 44px !important; padding-left: 12px !important; padding-right: 12px !important; }
.sheet .oc {
  background: rgba(255, 255, 255, 0.42) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.58) !important;
  border-radius: 16px !important;
  padding: 10px !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 2px 8px rgba(23, 43, 36, 0.04) !important;
}
.sheet .reseau-user-row {
  background: rgba(255, 255, 255, 0.42) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.58) !important;
  border-radius: 15px !important;
  padding: 8px 10px !important;
  margin-bottom: 6px !important;
}
.sheet .tg { border-radius: 999px !important; }
.sheet .chips { display: flex !important; flex-wrap: wrap !important; gap: 6px !important; }
.sheet .chip {
  background: rgba(255, 255, 255, 0.6) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  color: #56665D !important;
  border-radius: 999px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font: 600 12px var(--sf) !important;
}
.sheet .chip[aria-pressed="true"] {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72)) !important;
  color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.12) !important;
}
.sheet .sh-f {
  background: rgba(255, 255, 255, 0.34) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 999px !important;
  padding: 3px !important;
}
.sheet .sh-f .mbtn { flex: 1 !important; }
.sheet .lh { padding: 0 2px !important; }
.sheet .kpi,
.sheet .apple-grouped-card,
.sheet .phero,
.sheet .blur {
  background: rgba(255, 255, 255, 0.42) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.55) !important;
  border-radius: 16px !important;
  -webkit-backdrop-filter: blur(18px) !important;
  backdrop-filter: blur(18px) !important;
}
.sheet .scanbox {
  background: rgba(23, 43, 36, 0.88) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.18) !important;
  border-radius: 18px !important;
}
.sheet .scanbox span { color: rgba(255, 255, 255, 0.82) !important; }
@keyframes sheetRowIn {
  from { opacity: 0; transform: translateY(7px); }
  to { opacity: 1; transform: none; }
}
.sheet.anim-in .sh-b > * {
  animation: sheetRowIn 0.32s cubic-bezier(0.2, 0.9, 0.4, 1.1) both;
}
.sheet.anim-in .sh-b > *:nth-child(2) { animation-delay: 0.025s; }
.sheet.anim-in .sh-b > *:nth-child(3) { animation-delay: 0.05s; }
.sheet.anim-in .sh-b > *:nth-child(4) { animation-delay: 0.075s; }
.sheet.anim-in .sh-b > *:nth-child(5) { animation-delay: 0.1s; }
@media (prefers-reduced-motion: reduce) {
  .sheet.anim-in .sh-b > *,
  .sel-lens,
  .sheet,
  .pmi-dialog { animation: none !important; transition-duration: 0.01ms !important; }
}

/* 7 — Post drawer immersif, sans barres blanches, bords de la card */
.post-modal-instagram {
  top: 48px !important;
  left: 8px !important;
  right: 8px !important;
  bottom: calc(31% + 46px) !important;
  border-radius: 30px !important;
  overflow: hidden !important;
}
.pmi-dialog {
  position: relative !important;
  background: transparent !important;
  border-radius: 30px !important;
  overflow: hidden !important;
  box-shadow: 0 18px 44px rgba(23, 43, 36, 0.22), 0 0 0 0.5px rgba(255, 255, 255, 0.5) !important;
}
.pmi-grabber {
  position: absolute !important;
  top: 4px !important;
  left: 50% !important;
  width: 48px !important;
  height: 14px !important;
  transform: translateX(-50%) !important;
  display: grid !important;
  place-items: center !important;
  z-index: 7 !important;
  pointer-events: none !important;
}
.pmi-grabber span {
  width: 38px !important;
  height: 5px !important;
  border-radius: 3px !important;
  background: rgba(255, 255, 255, 0.76) !important;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
}
.pmi-header {
  position: absolute !important;
  top: 18px !important;
  left: 12px !important;
  right: 12px !important;
  z-index: 6 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}
.pmi-profile-pill,
.pmi-more-pill {
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.1), 0 4px 14px rgba(23, 43, 36, 0.12) !important;
  color: #17402C !important;
  cursor: pointer !important;
}
.pmi-profile-pill {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  min-height: 44px !important;
  padding: 4px 12px 4px 4px !important;
  border-radius: 999px !important;
  text-align: left !important;
}
.pmi-profile-pill .pmi-av {
  width: 34px !important;
  height: 34px !important;
  flex: none !important;
}
.pmi-profile-meta { display: flex !important; flex-direction: column !important; min-width: 0 !important; }
.pmi-profile-meta b { font: 600 12.5px/1.15 var(--sf) !important; color: #17402C !important; }
.pmi-profile-meta small { font: 400 10.5px/1.2 var(--sf) !important; color: #3F4F46 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }
.pmi-more-pill {
  width: 44px !important;
  height: 44px !important;
  flex: none !important;
  border-radius: 50% !important;
  font: 700 17px/1 var(--sf) !important;
  letter-spacing: 0.08em !important;
  display: grid !important;
  place-items: center !important;
}
.pmi-options-menu {
  position: absolute !important;
  top: 68px !important;
  right: 12px !important;
  z-index: 8 !important;
  width: 226px !important;
  padding: 5px !important;
  border-radius: 20px !important;
  background: rgba(255, 255, 255, 0.72) !important;
  -webkit-backdrop-filter: blur(30px) saturate(180%) !important;
  backdrop-filter: blur(30px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.85) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 12px 32px rgba(23, 43, 36, 0.18) !important;
}
.pmi-options-menu[hidden] { display: none !important; }
.pmi-options-menu button {
  width: 100% !important;
  min-height: 44px !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 0 11px !important;
  border: 0 !important;
  border-radius: 14px !important;
  background: transparent !important;
  color: #17402C !important;
  font: 600 12.5px var(--sf) !important;
  cursor: pointer !important;
}
.pmi-options-menu button + button { box-shadow: 0 -0.5px 0 rgba(23, 43, 36, 0.08) !important; }
.pmi-options-menu button:active { background: rgba(255, 255, 255, 0.5) !important; }
.pmi-options-menu button svg { width: 18px !important; height: 18px !important; flex: none !important; }
.pmi-options-menu .pmi-report { color: #7A241C !important; }
.pmi-scroll-area { padding-bottom: 0 !important; overscroll-behavior: contain !important; }
.pmi-media { aspect-ratio: 4 / 3 !important; touch-action: none !important; }
.pmi-media-fallback,
.pmi-media-art { position: absolute !important; inset: 0 !important; z-index: 0 !important; }
.pmi-media-art { z-index: 1 !important; }
.pmi-media-art svg { width: 100% !important; height: 100% !important; display: block !important; }
.pmi-media-fallback svg { width: 100% !important; height: 100% !important; display: block !important; }
.pmi-media img { position: relative !important; z-index: 1 !important; }
.pmi-grabber,
.pmi-header { touch-action: none !important; }
.pmi-action-pill {
  position: absolute !important;
  right: 14px !important;
  bottom: 28px !important;
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
  padding: 4px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 0 0 0.5px rgba(23, 43, 36, 0.1), 0 6px 18px rgba(23, 43, 36, 0.14) !important;
  z-index: 4 !important;
}
.pmi-pill-btn {
  width: 44px !important;
  height: 44px !important;
  border: 0 !important;
  border-radius: 50% !important;
  background: transparent !important;
  color: #17402C !important;
  display: grid !important;
  place-items: center !important;
  cursor: pointer !important;
  transition: transform 0.15s ease, background 0.2s ease !important;
}
.pmi-pill-btn:active { transform: scale(0.9) !important; background: rgba(255, 255, 255, 0.5) !important; }
.pmi-pill-btn svg { width: 20px !important; height: 20px !important; }
.pmi-pill-btn.liked { color: #E0245E !important; }
.pmi-content-glass {
  position: relative !important;
  z-index: 2 !important;
  margin-top: -14px !important;
  padding: 24px 14px 16px !important;
  border-radius: 24px 24px 0 0 !important;
  background: rgba(255, 255, 255, 0.8) !important;
  -webkit-backdrop-filter: blur(30px) saturate(180%) !important;
  backdrop-filter: blur(30px) saturate(180%) !important;
  border-top: 0.5px solid rgba(255, 255, 255, 0.85) !important;
}
.pmi-social-counter { padding: 0 0 4px !important; }
.pmi-caption-block { padding: 2px 0 8px !important; }
.pmi-time { padding: 0 0 10px !important; }
.pmi-time, .pmi-c-meta { color: #3F4F46 !important; }
.pmi-comments-list { padding: 8px 0 0 !important; border-top: 0.5px solid rgba(23, 43, 36, 0.08) !important; }
.pmi-comment-bar {
  position: relative !important;
  left: auto !important;
  right: auto !important;
  bottom: auto !important;
  margin: 0 12px 12px !important;
  flex: none !important;
  z-index: 6 !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 4px 4px 6px !important;
  border: 0.5px solid rgba(255, 255, 255, 0.85) !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 8px 22px rgba(23, 43, 36, 0.16) !important;
}
.pmi-input {
  height: 38px !important;
  border: 0 !important;
  background: rgba(255, 255, 255, 0.5) !important;
  border-radius: 999px !important;
  padding: 0 14px !important;
  font-size: 12.5px !important;
}
.pmi-submit-btn {
  width: 44px !important;
  height: 44px !important;
  flex: none !important;
  display: grid !important;
  place-items: center !important;
  border-radius: 50% !important;
  background: #17402C !important;
  color: #FFFFFF !important;
  padding: 0 !important;
}
.pmi-submit-btn svg { width: 18px !important; height: 18px !important; stroke-width: 2.2 !important; }
.pmi-input:focus-visible {
  outline: 2px solid #17402C !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.92) !important;
}
.pmi-input:focus:not(:focus-visible) { outline: none !important; }
.pmi-close-btn, .pmi-h-actions { display: none !important; }

/* ==============================================================================
   Compte iOS 27 v15 — Card scroll + sélecteur superposé, drawers sur les bords
   exacts de la card, matériau de verre unifié, post drawer minimal
   ============================================================================== */

.phone {
  --card-top: 48px;
  --card-left: 8px;
  --card-right: 8px;
  --card-bottom: 60px;
  --card-radius: 24px;
}

/* 1 — Card : une seule couche scrollable, sélecteur flottant hors du scroll */
#card.cs {
  position: relative !important;
  flex-direction: column !important;
  padding: 0 !important;
  gap: 0 !important;
  overflow: hidden !important;
  border-radius: var(--card-radius, 24px) !important;
}
#card.cs > .card-scroll {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 5px !important;
  padding: 8px 12px 56px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  scrollbar-width: none !important;
  overscroll-behavior: contain !important;
  scroll-padding-bottom: 56px !important;
}
#card.cs > .card-scroll::-webkit-scrollbar { display: none !important; }
.ig-tabs-float {
  position: absolute !important;
  right: 10px !important;
  bottom: 10px !important;
  z-index: 12 !important;
  display: flex !important;
  align-items: flex-end !important;
  justify-content: flex-end !important;
  pointer-events: none !important;
}
.ig-tabs-float::before {
  content: "" !important;
  position: absolute !important;
  inset: -18px -10px -10px -20px !important;
  border-radius: 999px !important;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 72%) !important;
  filter: blur(6px) !important;
  pointer-events: none !important;
  z-index: -1 !important;
}
.ig-tabs-float .ig-tabs {
  position: relative !important;
  top: auto !important;
  right: auto !important;
  bottom: auto !important;
  left: auto !important;
  pointer-events: auto !important;
  width: 88px !important;
  max-width: 88px !important;
  height: 30px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.14), 0 8px 22px rgba(23, 43, 36, 0.12) !important;
}
.ig-tabs-float .ig-tabs .ig-th {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.22)) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.4), 0 0 0 0.5px rgba(23, 43, 36, 0.06) !important;
}

/* 2 — Bords exacts de la card pour tous les drawers et le post drawer */
.sw-wrap[data-det="card"] .sheet,
.post-modal-instagram {
  top: var(--card-top, 48px) !important;
  left: var(--card-left, 8px) !important;
  right: var(--card-right, 8px) !important;
  bottom: var(--card-bottom, 60px) !important;
  border-radius: var(--card-radius, 24px) !important;
}
.sw-wrap[data-det="card"] .sheet {
  width: auto !important;
  max-width: none !important;
}
.post-modal-instagram { overflow: hidden !important; }
.pmi-dialog { border-radius: inherit !important; }

/* 3 — Drawer = même matériau translucide que la card */
.sheet {
  background:
    linear-gradient(180deg,
      rgba(255, 255, 255, calc(var(--ga, 0.3) + 0.70)),
      rgba(255, 255, 255, calc(var(--ga, 0.3) + 0.64)) 46%,
      rgba(255, 255, 255, calc(var(--ga, 0.3) + 0.68))) !important;
  -webkit-backdrop-filter: blur(calc(var(--gb, 14px) + 18px)) saturate(1.85) brightness(1.05) !important;
  backdrop-filter: blur(calc(var(--gb, 14px) + 18px)) saturate(1.85) brightness(1.05) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 1px rgba(255, 255, 255, 0.4),
    inset 0 0 16px rgba(255, 255, 255, 0.12),
    0 0 0 0.5px rgba(23, 43, 36, 0.12),
    0 10px 30px rgba(23, 43, 36, 0.14) !important;
}
.sheet .li.nt,
.sheet .reseau-user-row,
.sheet .oc {
  background: rgba(255, 255, 255, 0.82) !important;
  border-color: rgba(255, 255, 255, 0.7) !important;
}
.sheet .apple-grouped-card {
  background: rgba(255, 255, 255, 0.52) !important;
  border-color: rgba(255, 255, 255, 0.62) !important;
}
.sheet .reseau-toggle-wrap .apple-grouped-card {
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
  box-shadow: none !important;
}
.sheet .sh-h { border-bottom: 0 !important; }
.sheet .sh-b { overflow-x: hidden !important; overscroll-behavior: contain !important; }
.sheet .sh-f {
  background: rgba(255, 255, 255, 0.5) !important;
  border-color: rgba(255, 255, 255, 0.7) !important;
}
.sheet .reseau-btn.primary {
  background: var(--pg) !important;
  color: var(--pg-ink) !important;
  box-shadow: var(--pg-sh) !important;
}
.sheet .reseau-btn.active {
  background: rgba(255, 255, 255, 0.62) !important;
  color: #17402C !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
}

/* 4 — Boutons carte : retour au verre de référence, identique au sélecteur */
.mctl,
.map-scale-selector {
  background: rgba(255, 255, 255, 0.65) !important;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.42) 55%, rgba(255, 255, 255, 0.52)) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  backdrop-filter: blur(28px) saturate(180%) brightness(1.04) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.14), 0 8px 22px rgba(23, 43, 36, 0.12) !important;
}
.mctl button,
.map-scale-selector button { color: #56665D !important; background: transparent !important; }
.mctl button[aria-expanded="true"],
.mctl button:active,
.map-scale-selector button.active {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.22)) !important;
  color: #17402C !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.4), 0 0 0 0.5px rgba(23, 43, 36, 0.06) !important;
}
.ig-tabs-float .ig-tabs button:focus-visible,
.lg.gbtn:focus-visible,
.sheet .mbtn:focus-visible,
.pmi-submit-btn:focus-visible,
.pmi-options-menu button:focus-visible {
  outline: none !important;
  box-shadow: inset 0 0 0 2px #17402C, inset 0 0 0 4px #FFFFFF !important;
}

/* 5 — Post drawer minimal : image plein cadre + pillules flottantes */
.pmi-scroll-area {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  padding-bottom: 0 !important;
  overflow: hidden !important;
}
.pmi-media {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  height: auto !important;
  aspect-ratio: auto !important;
}
.pmi-media img,
.pmi-media .pmi-media-fallback,
.pmi-media .pmi-media-fallback svg { height: 100% !important; }
.pmi-content-glass { display: none !important; }
.pmi-comment-bar {
  position: relative !important;
  left: auto !important;
  right: auto !important;
  bottom: auto !important;
  margin: 8px 12px 12px !important;
  flex: none !important;
}
.pmi-action-pill { bottom: 20px !important; right: 14px !important; }
.pmi-caption-pill {
  position: absolute !important;
  left: 14px !important;
  bottom: 20px !important;
  max-width: 52% !important;
  padding: 7px 12px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 6px 18px rgba(23, 43, 36, 0.14) !important;
  color: #17402C !important;
  font: 600 12px/1.2 var(--sf) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  z-index: 4 !important;
}
.pmi-profile-pill,
.pmi-more-pill,
.pmi-action-pill,
.pmi-comment-bar {
  background: rgba(255, 255, 255, 0.65) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.45), 0 0 0 0.5px rgba(23, 43, 36, 0.1), 0 6px 18px rgba(23, 43, 36, 0.14) !important;
}

/* ==========================================================================
   Compte iOS 27 v16 — la card défile au lieu d'écraser ses blocs
   Les enfants du conteneur scrollable gardent leur hauteur naturelle.
   Sans cela, sur un écran court, la grille de posts se comprime
   (233 px → 142 px) puis se retrouve rognée par son overflow.
   ========================================================================== */
#card.cs > .card-scroll > * {
  flex-shrink: 0 !important;
}

/* ==========================================================================
   Compte iOS 27 v17 — matière unique « bottom bar » + profil aéré
   ========================================================================== */
.phone {
  --bar-glass-bg: linear-gradient(180deg,
    rgba(255, 255, 255, calc(var(--ga) + .3)),
    rgba(255, 255, 255, calc(var(--ga) + .14)) 55%,
    rgba(255, 255, 255, calc(var(--ga) + .22)));
  --bar-glass-blur: blur(var(--gb)) saturate(1.9) brightness(1.07);
  --bar-glass-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .9),
    inset 0 -1px 1px rgba(255, 255, 255, .45),
    inset 1px 0 1px rgba(255, 255, 255, .28),
    inset -1px 0 1px rgba(255, 255, 255, .28),
    inset 0 0 12px rgba(255, 255, 255, .14),
    0 0 0 .5px rgba(23, 43, 36, .14),
    0 8px 22px rgba(23, 43, 36, .12);
  --bar-thumb-bg: linear-gradient(180deg, rgba(255, 255, 255, .62), rgba(255, 255, 255, .26));
  --bar-thumb-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 1px rgba(255, 255, 255, .5),
    0 0 0 .5px rgba(23, 43, 36, .07),
    0 2px 8px rgba(23, 43, 36, .08);
}

/* 1 — conteneurs : même verre que .tb.lg */
.phone .ig-tabs-float .ig-tabs,
.phone .mctl,
.phone .map-scale-selector,
.phone .sheet .flow,
.phone .sheet .segc,
.phone .sheet .reseau-toggle,
.phone .sheet .ig-sub {
  background: var(--bar-glass-bg) !important;
  -webkit-backdrop-filter: var(--bar-glass-blur) !important;
  backdrop-filter: var(--bar-glass-blur) !important;
  border: 0 !important;
  box-shadow: var(--bar-glass-shadow) !important;
}

/* 2 — géométrie propre à chaque sélecteur, matière commune */
.phone .sheet .flow {
  display: grid !important;
  grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)) !important;
  height: 34px !important;
  padding: 3px !important;
  margin: 0 0 8px !important;
}
.phone .sheet .sh-h .flow {
  height: 48px !important;
  margin: 0 !important;
}
.phone .sheet .segc {
  display: grid !important;
  grid-auto-flow: column !important;
  grid-auto-columns: 1fr !important;
  height: 34px !important;
  padding: 3px !important;
  margin: 0 0 8px !important;
}
.phone .sheet .reseau-toggle {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  width: 100% !important;
  max-width: 320px !important;
  height: 34px !important;
  padding: 3px !important;
  margin: 0 auto 8px !important;
}
.phone .sheet .ig-sub {
  display: flex !important;
  height: 30px !important;
  padding: 3px !important;
  gap: 0 !important;
  margin: 0 0 8px !important;
}
.phone .sheet .ig-sub button {
  height: 24px !important;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}

/* 3 — lentille sélectionnée identique à .tb .lens */
.phone .ig-tabs-float .ig-tabs .ig-th,
.phone .sheet .segc .th,
.phone .sheet .sel-lens,
.phone .sheet .ig-sub button[aria-selected="true"] {
  background: var(--bar-thumb-bg) !important;
  box-shadow: var(--bar-thumb-shadow) !important;
}
/* 3b — états sélectionnés : le pouce est peint par .sel-lens, jamais par le bouton */
.phone .sheet .flow button.cur,
.phone .sheet .reseau-toggle .active,
.phone .sheet .ig-sub button[aria-selected="true"] {
  background: transparent !important;
  box-shadow: none !important;
}

/* 4 — aération légère : bio ↔ stories ↔ posts */
#card.cs > .card-scroll { gap: 7px !important; }
#card .ig-bio { margin: 3px 2px 2px !important; }
#card .ig-hl-row { padding: 2px 2px 1px !important; }
#card .ig-grid-wrap { margin-top: 3px !important; }

/* ==========================================================================
   Compte iOS 27 v18 — drawers : même surface que la card, même barre que la
   bottom bar, aucun bouton Fermer en pied.
   ========================================================================== */

/* 1 — la feuille reprend la matière composite de #card.cs */
.phone .sheet {
  background-color: #F5F2EC !important; /* Stone documenté */
  background-image: linear-gradient(180deg, rgba(255, 255, 255, .486), rgba(255, 255, 255, .384)) !important;
  -webkit-backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05) !important;
  backdrop-filter: blur(25.2px) saturate(1.8) brightness(1.05) !important;
  border: 0 !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .95),
    inset 0 -1px 1px rgba(255, 255, 255, .4),
    inset 0 0 16px rgba(255, 255, 255, .12),
    0 0 0 .5px rgba(23, 43, 36, .12),
    0 10px 30px rgba(23, 43, 36, .14) !important;
}

/* 2 — un seul gabarit de navigation, celui de .tb */
.phone .sheet .sheet-nav {
  margin: 0 !important;
  flex: none !important;
}
.phone .sheet .flow,
.phone .sheet .segc,
.phone .sheet .reseau-toggle {
  width: 100% !important;
  max-width: none !important;
  height: 48px !important;
  padding: 2px !important;
  margin: 0 0 10px !important;
  border-radius: 999px !important;
  display: grid !important;
  gap: 0 !important;
  background: var(--bar-glass-bg) !important;
  -webkit-backdrop-filter: var(--bar-glass-blur) !important;
  backdrop-filter: var(--bar-glass-blur) !important;
  border: 0 !important;
  box-shadow: var(--bar-glass-shadow) !important;
}
.phone .sheet .flow {
  grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)) !important;
}
.phone .sheet .segc {
  grid-auto-flow: column !important;
  grid-auto-columns: 1fr !important;
}
.phone .sheet .reseau-toggle {
  grid-template-columns: 1fr 1fr !important;
}

/* 3 — cellules identiques : icônes 19 px, cible 44 px, fond transparent */
.phone .sheet .flow button,
.phone .sheet .segc button,
.phone .sheet .reseau-toggle button {
  min-width: 0 !important;
  height: 44px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}
.phone .sheet .flow button .ic,
.phone .sheet .segc button .ic,
.phone .sheet .reseau-toggle button .ic {
  width: 19px !important;
  height: 19px !important;
}

/* 4 — même lentille sélectionnée que .tb .lens */
.phone .sheet .sel-lens,
.phone .sheet .segc .th {
  background: var(--bar-thumb-bg) !important;
  box-shadow: var(--bar-thumb-shadow) !important;
}

/* ==========================================================================
   Compte iOS 27 v19 — feuille translucide ancrée, chrome minimal
   ========================================================================== */

/* 1 — surface : la matière de la card, sans fond opaque */
.phone .sheet {
  background-color: transparent !important;
  background-image: linear-gradient(180deg, rgba(245, 242, 236, .34), rgba(245, 242, 236, .20) 48%, rgba(245, 242, 236, .26)) !important;
  -webkit-backdrop-filter: blur(30px) saturate(1.7) brightness(1.04) !important;
  backdrop-filter: blur(30px) saturate(1.7) brightness(1.04) !important;
  border: 0 !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .95),
    inset 0 -1px 1px rgba(255, 255, 255, .4),
    inset 0 0 16px rgba(255, 255, 255, .12),
    0 0 0 .5px rgba(23, 43, 36, .12),
    0 10px 30px rgba(23, 43, 36, .14) !important;
}
.phone .sheet .li.nt,
.phone .sheet .reseau-user-row,
.phone .sheet .oc,
.phone .sheet .apple-grouped-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, .58), rgba(255, 255, 255, .44)) !important;
  -webkit-backdrop-filter: blur(18px) saturate(1.7) !important;
  backdrop-filter: blur(18px) saturate(1.7) !important;
  border: 0 !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .8), 0 2px 8px rgba(23, 43, 36, .04) !important;
}

/* 2 — la feuille vit dans les bornes exactes de la card */
.sw-wrap[data-det="card"] {
  top: var(--card-top, 48px) !important;
  left: var(--card-left, 12px) !important;
  right: var(--card-right, 12px) !important;
  bottom: var(--card-bottom, 60px) !important;
  overflow: hidden !important;
  border-radius: var(--card-radius, 24px) !important;
  pointer-events: none !important;
}
.sw-wrap[data-det="card"] .sheet {
  top: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: auto !important;
  max-width: none !important;
  border-radius: inherit !important;
  pointer-events: auto !important;
  transform: translateY(100%);
  transition: transform .54s cubic-bezier(.32, .72, 0, 1) !important;
  will-change: transform;
}
.sw-wrap[data-det="card"].in .sheet { transform: translateY(0); }
.sw-wrap[data-det="card"].dragging .sheet { transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .sw-wrap[data-det="card"] .sheet { transition-duration: .01ms !important; }
}

/* 3 — chrome : poignée seule, chevron Retour seulement en pile */
.phone .sheet .grab {
  position: relative !important;
  height: 18px !important;
  min-height: 18px !important;
  touch-action: none !important;
}
.phone .sheet .sh-back {
  position: absolute !important;
  left: 0 !important;
  top: 2px !important;
  width: 30px !important;
  height: 30px !important;
  z-index: 4 !important;
}
.phone .sheet .sheet-nav { margin: 0 0 8px !important; touch-action: none !important; }
.phone .sheet:has(.sh-back) .sheet-nav { padding-left: 36px !important; }
.phone .sheet .sheet-nav.has-back { padding-left: 36px !important; }
.phone .sheet .sh-b { padding-top: 0 !important; }

/* 4 — pression des sélecteurs et largeur des Abonnés */
.phone .sheet .flow button,
.phone .sheet .segc button,
.phone .sheet .reseau-toggle button {
  transition: transform .12s cubic-bezier(.2, .9, .4, 1.2), color .2s !important;
}
.phone .sheet .flow button:active,
.phone .sheet .segc button:active,
.phone .sheet .reseau-toggle button:active { transform: scale(.92) !important; }
.ig-swipe-back { position: absolute; left: 0; top: 0; bottom: 0; width: 24px; z-index: 4; touch-action: none; }
.pmi-c-actions { display:flex; gap:10px; margin-top:3px; }
.pmi-c-actions button { border:0; background:none; padding:0; font:600 10.5px var(--sf); color:#56665D; }
.pmi-c-like.liked { color:#E0245E !important; }
.pmi-c-like small { display:block; font:600 9px var(--sf); }
.phone .sheet .flow.pressing .sel-lens,
.phone .sheet .segc.pressing .sel-lens,
.phone .sheet .reseau-toggle.pressing .sel-lens { filter: brightness(1.06); }
.phone .sheet .reseau-toggle {
  width: 100% !important;
  max-width: none !important;
  margin: 0 0 10px !important;
}

/* 5 — profil compact sur deux lignes, stories et grille à égale distance */
#card .ig-bio {
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
  margin: 3px 2px 3px !important;
}
#card .ig-bio-top {
  display: flex !important;
  align-items: baseline !important;
  gap: 5px !important;
  min-width: 0 !important;
  white-space: nowrap !important;
  font: 600 12px var(--sf) !important;
  color: #17402C !important;
}
#card .ig-bio-cc { flex: none !important; font-weight: 700 !important; letter-spacing: .02em !important; }
#card .ig-bio-dot { flex: none !important; color: #56665D !important; }
#card .ig-bio-stats {
  min-width: 0 !important;
  font-weight: 500 !important;
  color: #3F4F46 !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
#card .ig-bio-text {
  margin: 0 !important;
  font: 400 12px/1.3 var(--sf) !important;
  color: #56665D !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 1 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}
#card .ig-hl-row { margin: 0 2px 3px !important; padding: 0 2px !important; }
#card .ig-grid-wrap { margin-top: 0 !important; }

/* 6 — sorties fusionnées : la photo porte la carte, l'info est un verre */
.voyage-card {
  position: relative !important;
  display: block !important;
  flex: 0 0 236px !important;
  height: 144px !important;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 20px !important;
  overflow: hidden !important;
  background: #17402C !important;
  text-align: left !important;
  cursor: pointer !important;
  transition: transform .2s cubic-bezier(.3, 1.4, .5, 1) !important;
}
.voyage-card:active { transform: scale(.98); }
.voyage-cover { position: absolute !important; inset: 0 !important; height: auto !important; }
.voyage-img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
.voyage-card .voyage-alt-badge {
  top: 8px !important;
  right: 8px !important;
  bottom: auto !important;
}
.voyage-info {
  position: absolute !important;
  left: 8px !important;
  right: 8px !important;
  bottom: 8px !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
  padding: 7px 9px !important;
  border-radius: 14px !important;
  background: var(--bar-glass-bg) !important;
  -webkit-backdrop-filter: var(--bar-glass-blur) !important;
  backdrop-filter: var(--bar-glass-blur) !important;
  box-shadow: var(--bar-thumb-shadow) !important;
  border: 0 !important;
  color: #17402C !important;
}
.voyage-title {
  font: 600 12.5px/1.2 var(--sf) !important;
  color: #17402C !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.voyage-sub {
  font: 500 9.5px/1.2 var(--sf) !important;
  color: #3F4F46 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.voyage-metrics {
  display: flex !important;
  align-items: center !important;
  gap: 5px !important;
  margin-top: 3px !important;
  padding-top: 3px !important;
  border-top: .5px solid rgba(23, 43, 36, .1) !important;
  font: 600 9.5px var(--sf) !important;
}
.voyage-metrics .vm-sep {
  width: auto !important;
  height: auto !important;
  background: none !important;
  opacity: .45 !important;
}
.voyage-metrics small { display: none !important; }
.voyage-metrics .vm-item b {
  font-size: 9.5px !important;
  font-weight: 600 !important;
  white-space: nowrap !important;
}

/* 7 — drawer de sortie : héros, stats, photos */
.outing-hero { height: 116px; border-radius: 16px; background-size: cover; background-position: center; }
.outing-photos { display: grid; grid-template-columns: repeat(3, 1fr) !important; gap: 6px; }
.outing-photos img { width: 100%; height: 92px; object-fit: cover; border-radius: 12px; }
.sh-b > .ttl {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font: 600 14px/1.25 var(--sf);
}
.sh-b > .ttl > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-b > .s2 { font: 400 12px/1.3 var(--sf); color: var(--label2); }

/* 8 — fermeture : aucun contenu résiduel ne glisse sur la carte */
.sw-wrap[data-det="closed"] .sheet {
  transition: none !important;
  visibility: hidden !important;
}

/* Compte iOS 27 v20 — marges, respiration et mouvement */
.sw-wrap[data-det="card"] .sheet { transition: transform .72s cubic-bezier(.16,1,.3,1) !important; }
.phone .sheet { padding: 0 !important; }
.phone .sheet .sh-b { padding: 4px 12px calc(20px + env(safe-area-inset-bottom)) !important; }
.phone .sheet .sh-f { padding-bottom: 4px !important; }
.phone .sheet .li.nt,
.phone .sheet .reseau-user-row,
.phone .sheet .oc { margin-inline: 0 !important; }
.sheet.anim-in .sh-b > * { animation: sheetRowIn .45s cubic-bezier(.2,.8,.2,1) both; }
.sheet.anim-in .sh-b > *:nth-child(2) { animation-delay: .03s; }
.sheet.anim-in .sh-b > *:nth-child(3) { animation-delay: .06s; }
.sheet.anim-in .sh-b > *:nth-child(4) { animation-delay: .09s; }
.ig-swipe-view { position: relative; will-change: transform; }
.ig-swipe-view[data-tab="0"] { touch-action: pan-y; }
.ig-swipe-view.swiping { transition: none !important; }
.ig-swipe-view.settle { transition: transform .22s cubic-bezier(.2,.8,.2,1) !important; }
.ig-swipe-view.out-left { transform: translateX(-18%) !important; opacity: .55; transition: transform .18s ease, opacity .18s ease !important; }
.ig-swipe-view.out-right { transform: translateX(18%) !important; opacity: .55; transition: transform .18s ease, opacity .18s ease !important; }
.ig-swipe-view.in-left { animation: igSwipeInLeft .32s cubic-bezier(.2,.8,.2,1) both; }
.ig-swipe-view.in-right { animation: igSwipeInRight .32s cubic-bezier(.2,.8,.2,1) both; }
@keyframes igSwipeInLeft { from { transform: translateX(-18%); opacity: .55; } to { transform: none; opacity: 1; } }
@keyframes igSwipeInRight { from { transform: translateX(18%); opacity: .55; } to { transform: none; opacity: 1; } }
.phone .sheet .flow,
.phone .sheet .segc,
.phone .sheet .reseau-toggle { overflow: visible !important; }
.phone .sheet .sel-lens {
  top: 4px !important;
  bottom: 4px !important;
  height: auto !important;
  transform: translateX(calc(var(--i, 0) * 100%)) !important;
  background: linear-gradient(180deg, rgba(255,255,255,.62), rgba(255,255,255,.26)) !important;
  box-shadow: inset 0 1px 0 #fff, inset 0 -1px 1px rgba(255,255,255,.5), 0 0 0 .5px rgba(23,43,36,.07), 0 2px 8px rgba(23,43,36,.08) !important;
  z-index: 1 !important;
}
.phone .sheet .flow button,
.phone .sheet .segc button,
.phone .sheet .reseau-toggle button { position: relative !important; z-index: 2 !important; }
.phone .sheet .flow.pressing .sel-lens,
.phone .sheet .segc.pressing .sel-lens,
.phone .sheet .reseau-toggle.pressing .sel-lens {
  top: -6px !important;
  bottom: -6px !important;
  background: rgba(255,255,255,.08) !important;
  box-shadow: inset 0 1.5px 1px rgba(255,255,255,.95), inset 0 -1.5px 2px rgba(255,255,255,.6), inset 2px 0 2px rgba(255,120,160,.18), inset -2px 0 2px rgba(90,170,255,.2), 0 0 0 .5px rgba(23,43,36,.1), 0 10px 26px rgba(23,43,36,.2) !important;
}
.pmi-dialog { background: transparent !important; }
.pmi-scroll-area { position: absolute !important; inset: 0 !important; overflow: hidden !important; }
.pmi-media { position: absolute !important; inset: 0 !important; height: 100% !important; }
.pmi-media-art, .pmi-media-fallback { height: 100% !important; }
.pmi-media img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
.pmi-topbar { position: absolute !important; top: 10px !important; left: 10px !important; right: 10px !important; z-index: 6 !important; display: flex !important; align-items: flex-start !important; justify-content: space-between !important; }
.pmi-author { display: flex !important; align-items: center !important; gap: 8px !important; padding: 4px 10px 4px 4px !important; border: 0 !important; border-radius: 999px !important; background: var(--bar-glass-bg) !important; -webkit-backdrop-filter: var(--bar-glass-blur) !important; backdrop-filter: var(--bar-glass-blur) !important; box-shadow: var(--bar-thumb-shadow) !important; color: #17402C !important; }
.pmi-author-av { width: 28px !important; height: 28px !important; border-radius: 50% !important; object-fit: cover !important; }
.pmi-author b { font: 600 12px var(--sf) !important; }
.pmi-more-pill { width: 34px !important; height: 34px !important; }
.pmi-post-actions { position: absolute !important; right: 12px !important; bottom: 12px !important; display: flex !important; gap: 4px !important; padding: 3px !important; border-radius: 999px !important; background: var(--bar-glass-bg) !important; -webkit-backdrop-filter: var(--bar-glass-blur) !important; backdrop-filter: var(--bar-glass-blur) !important; box-shadow: var(--bar-glass-shadow) !important; z-index: 7 !important; }
.pmi-post-btn { width: 34px !important; height: 34px !important; border: 0 !important; border-radius: 50% !important; background: transparent !important; color: #17402C !important; display: grid !important; place-items: center !important; }
.pmi-post-btn svg { width: 18px !important; height: 18px !important; }
.pmi-post-btn.liked { color: #E0245E !important; }
.pmi-comments-head { display:flex; align-items:baseline; justify-content:space-between; padding:2px 2px 8px; font:600 14px var(--sf); color:#17402C; }
.pmi-comments-head span { font:600 11px var(--sf); color:#56665D; }
.pmi-comments-list { display:flex; flex-direction:column; gap:10px; padding:2px 2px 8px; }
.pmi-comment-row { display:flex; align-items:flex-start; gap:10px; padding:8px; border-radius:16px; background: linear-gradient(180deg, rgba(255,255,255,.58), rgba(255,255,255,.44)); backdrop-filter: blur(18px) saturate(1.7); box-shadow: inset 0 1px 0 rgba(255,255,255,.8); }
.pmi-c-av { width:32px; height:32px; flex:none; border-radius:50%; display:grid; place-items:center; background:#17402C; color:#fff; font:600 12px var(--sf); }
.pmi-c-body { flex:1; min-width:0; font:400 13px/1.35 var(--sf); color:#3F4F46; }
.pmi-c-body b { color:#17402C; font-weight:700; margin-right:4px; }
.pmi-c-body small { display:block; margin-top:2px; font:400 10.5px var(--sf); color:#6B7A72; }
.pmi-c-like { width:28px; height:28px; flex:none; border:0; background:transparent; color:#17402C; display:grid; place-items:center; }
.pmi-comment-composer { display:flex; align-items:center; gap:8px; width:100%; padding:6px; border-radius:999px; background: var(--bar-glass-bg); backdrop-filter: var(--bar-glass-blur); box-shadow: var(--bar-glass-shadow); }
.pmi-composer-input { flex:1; min-width:0; height:32px; border:0; background:transparent; font:400 13px var(--sf); color:#17402C; outline:none; }
.pmi-composer-send { width:32px; height:32px; flex:none; border:0; border-radius:50%; background:#17402C; color:#fff; display:grid; place-items:center; }

/* v20 — correctifs post-déploiement : lignes de compte non rognées, envoi des commentaires visible, mouvement réduit */
.phone .sheet .li.nt { gap: 8px !important; }
.phone .sheet .li.nt > div { min-width: 0 !important; flex: 1 1 auto !important; }
.phone .sheet .li.nt > div .ttl,
.phone .sheet .li.nt > div .s2 { min-width: 0 !important; overflow: hidden !important; text-overflow: ellipsis !important; }
.phone .sheet .li.nt > div .ttl span:first-child { overflow: hidden !important; display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; white-space: normal !important; }
.phone .sheet .li.nt > b,
.phone .sheet .li.nt > .tg,
.phone .sheet .li.nt > .num { flex: none !important; }
.pmi-composer-send .ic { color: #fff !important; width: 18px !important; height: 18px !important; }
@media (prefers-reduced-motion: reduce) {
  .sw-wrap[data-det="card"] .sheet { transition-duration: .01ms !important; }
  .ig-swipe-view { animation: none !important; transition: none !important; }
}
`;


const DEMO_CARNETS = [
  {
    id: 'ca2',
    title: 'Reflet du Mont-Blanc au Lac Blanc',
    destination: 'Mont-Blanc',
    location: 'Mont-Blanc',
    visibility: 'public',
    views_count: 420,
    likes_count: 64,
    verified: true,
  },
  {
    id: 'ca1',
    title: 'Trois jours autour du Néouvielle',
    destination: 'Pyrénées',
    location: 'Néouvielle',
    visibility: 'public',
    views_count: 312,
    likes_count: 48,
    verified: true,
  },
  {
    id: 'ca3',
    title: 'Glacier Blanc & Pré de Mme Carle',
    destination: 'Écrins',
    location: 'Écrins',
    visibility: 'public',
    views_count: 255,
    likes_count: 39,
    verified: true,
  },
  {
    id: 'ca0',
    title: 'Traversée du Vercors, bivouac',
    destination: 'Vercors',
    location: 'Vercors',
    visibility: 'private',
    views_count: 180,
    likes_count: 27,
    verified: true,
  },
  {
    id: 'ca5',
    title: 'Aiguilles de Bavella & GR20',
    destination: 'Corse',
    location: 'Bavella',
    visibility: 'public',
    views_count: 290,
    likes_count: 52,
    verified: true,
  },
  {
    id: 'ca6',
    title: 'Tre Cime di Lavaredo, Dolomites',
    destination: 'Dolomites',
    location: 'Tre Cime',
    visibility: 'public',
    views_count: 340,
    likes_count: 61,
    verified: true,
  },
];

const DEMO_OUTINGS = [
  {
    id: 'o1',
    title: 'Trek des 3 Vallées, Pyrénées',
    destination: 'Pyrénées',
    mass: 'Pyrénées',
    km: 58,
    dplus: 3420,
    maxAlt: 2640,
    status: 'completed',
  },
  {
    id: 'o2',
    title: 'Boucle du Lac Blanc',
    destination: 'Mont-Blanc',
    mass: 'Mont-Blanc',
    km: 12,
    dplus: 950,
    maxAlt: 2352,
    status: 'completed',
  },
  {
    id: 'o3',
    title: 'Traversée des Hauts Plateaux',
    destination: 'Vercors',
    mass: 'Vercors',
    km: 34,
    dplus: 1600,
    maxAlt: 2020,
    status: 'completed',
  },
  {
    id: 'o4',
    title: 'Tour du Néouvielle',
    destination: 'Pyrénées',
    mass: 'Pyrénées',
    km: 41,
    dplus: 2380,
    maxAlt: 2450,
    status: 'completed',
  },
  {
    id: 'o5',
    title: 'Aiguilles de Bavella (GR20)',
    destination: 'Corse',
    mass: 'Corse',
    km: 28,
    dplus: 1820,
    maxAlt: 1660,
    status: 'completed',
  },
  {
    id: 'o6',
    title: 'Tour du Mont-Blanc (Chamonix → Courmayeur)',
    destination: 'Mont-Blanc',
    mass: 'Mont-Blanc',
    km: 94,
    dplus: 4920,
    maxAlt: 2537,
    status: 'completed',
  },
  {
    id: 'o7',
    title: 'Cirque de Gavarnie & Brèche de Roland',
    destination: 'Pyrénées',
    mass: 'Pyrénées',
    km: 18,
    dplus: 1350,
    maxAlt: 2807,
    status: 'completed',
  },
  {
    id: 'o8',
    title: 'Grand Veymont & Pas de l\'Aiguille',
    destination: 'Vercors',
    mass: 'Vercors',
    km: 22,
    dplus: 1100,
    maxAlt: 2341,
    status: 'completed',
  },
  {
    id: 'o9',
    title: 'Glacier Blanc & Pré de Mme Carle',
    destination: 'Écrins',
    mass: 'Écrins',
    km: 24,
    dplus: 1450,
    maxAlt: 2542,
    status: 'completed',
  },
  {
    id: 'o10',
    title: 'Tre Cime di Lavaredo & Bivouac Locatelli',
    destination: 'Dolomites',
    mass: 'Dolomites',
    km: 20,
    dplus: 1200,
    maxAlt: 2405,
    status: 'completed',
  },
];

const DEMO_CLUBS = [
  {
    slug: 'cl1',
    name: 'Club Alpin Pyrénées',
    role: 'Membre actif',
    membersCount: 142,
  },
  {
    slug: 'cl2',
    name: 'Torino & Chamonix Alpi 🇮🇹🇫🇷',
    role: 'Co-organisateur',
    membersCount: 89,
  },
  {
    slug: 'cl3',
    name: 'Bivouac 4 Saisons & Trek Léger',
    role: 'Membre',
    membersCount: 310,
  },
];

const DEMO_GEAR_ITEMS = [
  { id: 'p11', name: 'Frontale Swift RL 900 lm', brand: 'Petzl', category: 'Sécurité', weight_g: 100, condition: 'excellent', is_lent: true, loaned_to: 'Léa' },
  { id: 'p3', name: 'Sac de couchage Mythic Ultra 180', brand: 'Rab', category: 'Couchage', weight_g: 400, condition: 'neuf', is_lent: false },
  { id: 'p7', name: 'Gourde BeFree 1.0 L Filtre', brand: 'Katadyn', category: 'Eau', weight_g: 63, condition: 'bon', is_lent: false },
  { id: 'p2', name: 'Tente Hubba Hubba NX 2P', brand: 'MSR', category: 'Couchage', weight_g: 1720, condition: 'bon', is_lent: false },
  { id: 'p4', name: 'Matelas NeoAir XLite NXT', brand: 'Therm-a-Rest', category: 'Couchage', weight_g: 370, condition: 'excellent', is_lent: false },
  { id: 'p5', name: 'Veste Beta AR Gore-Tex Pro', brand: "Arc'teryx", category: 'Vêtements', weight_g: 455, condition: 'bon', is_lent: false },
  { id: 'p8', name: 'Réchaud PocketRocket Deluxe', brand: 'MSR', category: 'Cuisine', weight_g: 83, condition: 'bon', is_lent: false },
];

const DEMO_ORDERS = [
  { id: 'b1', order_number: 'RS-9402', total_eur: 188.7, status: 'confirmed' },
  { id: 'b2', order_number: 'DIR-1029', total_eur: 184.0, status: 'pending' },
  { id: 'or1', order_number: 'LK-4829', total_eur: 249.0, status: 'confirmed' },
];

const DEMO_ACTIVE_LOANS = [
  { product_ownership_id: 'p11', borrower_contact: 'Léa' },
];

export interface CompteLiquidGlassV8Props {
  initialTab?: string;
}

type BootstrapPhase = 'idle' | 'loading' | 'ready' | 'error';

interface PendingSlotMount {
  root: HTMLElement | null;
  slotId: string;
  state: any;
}

interface SlotMountSnapshot {
  slotId: SlotId;
  payload: unknown;
  viewer: Viewer;
  visibility: Visibility;
  invited: boolean;
  root: HTMLElement | null;
  state: SlotContentState;
}

/**
 * Dérive l'état de l'hôte à partir du dernier montage runtime et du bootstrap.
 *
 * Le runtime monte le drawer avant que `/api/compte/bootstrap` ne réponde :
 * sans cette dérivation rejouée à la résolution, un propriétaire resterait
 * affiché en visiteur. Tant que le bootstrap est en vol, la coquille montre
 * un squelette ; sur échec, elle montre l'état d'erreur honnête plutôt qu'un
 * drawer vide. Seul `authenticated === true` autorise les entrées propriétaire.
 */
function deriveSlotMount(
  pending: PendingSlotMount,
  boot: any,
  phase: BootstrapPhase
): SlotMountSnapshot {
  // `S.profileVisibility` est l'état exact post-mutation : prioritaire sur
  // le bootstrap chargé au montage, pour refléter un changement sans reload.
  const visibilitySource =
    pending.state?.profileVisibility ||
    boot?.visibility?.profile ||
    pending.state?.profile?.profileVisibility ||
    pending.state?.profile?.profile_visibility;
  const viewerSource = pending.state?.profile?.viewer || pending.state?.viewer;
  // Sans session réelle (démo ou bootstrap indisponible), on reste en mode
  // visiteur : aucune entrée propriétaire ne doit apparaître.
  const authenticated = boot?.authenticated === true;
  const contentState: SlotContentState =
    phase === 'error' ? 'error' : phase === 'loading' ? 'loading' : 'ready';
  return {
    slotId: (pending.slotId || 'vitrine') as SlotId,
    payload: boot ?? pending.state,
    viewer: viewerSource === 'visitor' || !authenticated ? 'visitor' : 'owner',
    visibility: visibilitySource === 'prive' ? 'prive' : 'public',
    invited: Boolean(boot?.visibility?.invited ?? pending.state?.profile?.invited ?? false),
    root: pending.root,
    state: contentState,
  };
}

/** Métadonnées transmises par le runtime avec chaque mutation. */
interface CompteMutationMeta {
  previousProfileVisibility?: unknown;
  previousSignatureVisibility?: unknown;
  preserveSlot?: boolean;
  profileRequestId?: number;
  signatureRequestId?: number;
}

export function CompteLiquidGlassV8({ initialTab }: CompteLiquidGlassV8Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [activeHandle, setActiveHandle] = useState<string>('tony_frc');
  const bootstrapPayloadRef = useRef<unknown>(null);
  const bootstrapPhaseRef = useRef<BootstrapPhase>('idle');
  const [bootstrapPhase, setBootstrapPhase] = useState<BootstrapPhase>('idle');
  const lastSlotMountRef = useRef<PendingSlotMount | null>(null);
  const [drawerMount, setDrawerMount] = useState<{ root: HTMLElement | null; kind: string; props: any } | null>(null);
  const initialTabAppliedRef = useRef(false);
  const refreshSlotMountRef = useRef<() => void>(() => {});
  const retryBootstrapRef = useRef<() => void>(() => {});
  /** Dernière confidentialité persistée connue, pour rétablir sur échec. */
  const accountVisibilityRef = useRef<Visibility | null>(null);
  /** Dernière visibilité d'empreinte confirmée (`user_profiles.signature_visibility`). */
  const signatureVisibilityRef = useRef<SignatureVisibility | null>(null);
  const [slotMount, setSlotMount] = useState<SlotMountSnapshot | null>(null);
  const [mapRoot, setMapRoot] = useState<HTMLElement | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const mapContext = useCompteMapContext();

  useEffect(() => {
    if (!mapRoot || mapVisible) return;
    let cancelled = false;
    const show = () => { if (!cancelled) setMapVisible(true); };
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            const idle = (window as any).requestIdleCallback;
            if (typeof idle === 'function') {
              idle(show, { timeout: 1800 });
            } else {
              window.setTimeout(show, 700);
            }
          }
        }, { rootMargin: '120px' })
      : null;
    observer?.observe(mapRoot);
    const fallback = window.setTimeout(show, 8000);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(fallback);
    };
  }, [mapRoot, mapVisible]);

  /** Rejoue le dernier montage runtime avec le bootstrap le plus récent. */
  const refreshSlotMount = useCallback(() => {
    const pending = lastSlotMountRef.current;
    if (!pending) return;
    setSlotMount(deriveSlotMount(pending, bootstrapPayloadRef.current, bootstrapPhaseRef.current));
  }, []);
  refreshSlotMountRef.current = refreshSlotMount;

  const setBootstrapPhaseState = useCallback((phase: BootstrapPhase) => {
    bootstrapPhaseRef.current = phase;
    setBootstrapPhase(phase);
  }, []);


  const triggerAct = useCallback((action: string, val?: any) => {
    if (typeof window !== 'undefined' && typeof (window as any).__lkdvCompteAct === 'function') {
      (window as any).__lkdvCompteAct(action, val);
    }
  }, []);

  useEffect(() => {
    window.__lkdvCompteMapOpenOuting = (id: string) => {
      triggerAct('openOutingDrawer', id);
    };
    return () => {
      delete window.__lkdvCompteMapOpenOuting;
    };
  }, [triggerAct]);

  // Setup runtime & real browser/API action handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el || initializedRef.current) return;
    initializedRef.current = true;

    el.innerHTML = COMPTE_V8_HTML;
    const mapNode = el.querySelector<HTMLElement>('#maplibre-compte-canvas');
    if (mapNode) setMapRoot(mapNode);

    // Drawer Profil v2 : le runtime vanilla rend #lkdv-slot-root et délègue le
    // contenu React (coquille, sélecteur .ig-tabs, swipe) à cet hôte. Le
    // montage est mémorisé : il sera rejoué quand le bootstrap répondra.
    (window as any).__lkdvMountSlot = (root: HTMLElement, slotId: string, S: any) => {
      const pending: PendingSlotMount = {
        root: root ?? null,
        slotId: slotId || 'vitrine',
        state: S,
      };
      lastSlotMountRef.current = pending;
      setSlotMount(deriveSlotMount(pending, bootstrapPayloadRef.current, bootstrapPhaseRef.current));
    };
    (window as any).__lkdvUnmountSlot = () => {
      lastSlotMountRef.current = null;
      setSlotMount(null);
    };

    // Drawers Réseau, Sortie et Compte : contenu React monté dans la feuille
    // runtime, sans fermer/rouvrir le drawer.
    (window as any).__lkdvMountDrawer = (root: HTMLElement, kind: string, props: any) => {
      if (!root) return;
      setDrawerMount({ root, kind, props });
    };
    (window as any).__lkdvUnmountDrawer = () => {
      setDrawerMount(null);
    };

    const cleanup = initCompteLiquidGlassRuntime(el);

    // Register real catalog lookup for the Scan sheet
    (window as any).__lkdvScanLookup = async (query: string, cb: (item: any) => void) => {
      try {
        const res = await fetch(`/api/materiel/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          const hit = (json.items || json.results || json.products || [])[0];
          if (hit) {
            cb({
              id: 'cat_' + (hit.id || Date.now()),
              n: hit.name || hit.product_name || query,
              b: hit.brand || 'LKDV',
              c: hit.category || 'Équipement',
              w: Number(hit.weight_g || hit.weight_grams) || 340,
              paid: Number(hit.price_eur || hit.price) || 119,
              cond: 'neuf',
              lent: null,
              so: 1,
              maint: null,
              verdict: 'utile',
            });
            return;
          }
        }
      } catch (_) {}
      cb({
        id: 'scan_' + Date.now(),
        n: query,
        b: 'Catalogue LKDV',
        c: 'Équipement',
        w: 310,
        paid: 95,
        cond: 'neuf',
        lent: null,
        so: 1,
        maint: null,
        verdict: 'utile',
      });
    };

    // Register direct profile navigation helper
    (window as any).__lkdvNavigateProfile = (userHandle: string) => {
      const clean = String(userHandle || '').replace(/^@/, '').trim();
      if (clean) {
        router.push(`/profil/${encodeURIComponent(clean)}`);
      }
    };

    // Register real browser & backend action handlers
    (window as any).__lkdvOnAction = async (action: string, val: any, S: any) => {
      const handle = S?.profile?.handle || 'visiteur';
      const profileUrl = `${window.location.origin}/u/${handle}`;

      if (action === 'navtab' && typeof val === 'string') {
        router.push(val);
        return;
      }

      if (action === 'openUserProfile' && typeof val === 'string') {
        const cleanHandle = val.replace(/^@/, '').trim();
        if (cleanHandle) {
          router.push(`/profil/${encodeURIComponent(cleanHandle)}`);
          return;
        }
      }

      if (action === 'copylink') {
        try {
          await navigator.clipboard.writeText(profileUrl);
        } catch (_) {}
      } else if (action === 'namedrop') {
        try {
          if (navigator.share) {
            await navigator.share({
              title: `Profil LKDV @${handle}`,
              text: `Empreinte terrain vérifiée de @${handle} sur Le Kit du Voyageur`,
              url: profileUrl,
            });
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(profileUrl);
          }
        } catch (_) {}
      } else if (action === 'export') {
        const dump = typeof (window as any).__lkdvGetState === 'function' ? (window as any).__lkdvGetState() : { S };
        if (val === 'full') {
          try {
            const res = await fetch('/api/user/export', { cache: 'no-store' }).catch(() => fetch('/api/account/export'));
            if (res.ok) {
              const text = await res.text();
              triggerBrowserDownload(`lkdv-export-rgpd-${handle}.json`, text, 'application/json;charset=utf-8');
              return;
            }
          } catch (_) {}
          const fallbackBundle = {
            schema: 'lkdv.gdpr.export.v1',
            exportedAt: new Date().toISOString(),
            handle,
            profile: S?.profile,
            visibility: S?.vis,
            orientation: S?.orient,
            massifs: S?.massifs,
            carnets: dump.CARNETS,
            outings: dump.OUTINGS,
            inventory: S?.invs,
            kitsLineage: dump.KITS_LINEAGE,
            orders: dump.ORDERS,
          };
          triggerBrowserDownload(
            `lkdv-export-rgpd-${handle}.json`,
            JSON.stringify(fallbackBundle, null, 2),
            'application/json;charset=utf-8'
          );
        } else if (val === 'gpx') {
          const latestTrip = (dump.OUTINGS || []).find((o: any) => o.slug);
          if (latestTrip?.slug) {
            window.location.href = `/api/voyages/${latestTrip.slug}/gpx`;
          } else {
            const gpx = buildGpxXml(dump.OUTINGS || [], handle);
            triggerBrowserDownload(`lkdv-traces-${handle}.gpx`, gpx, 'application/gpx+xml;charset=utf-8');
          }
        } else if (val === 'photos') {
          const geojson = {
            type: 'FeatureCollection',
            generatedAt: new Date().toISOString(),
            owner: `@${handle}`,
            features: (dump.CARNETS || []).map((c: any, idx: number) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [6.86 + idx * 0.12, 45.83 + idx * 0.08, 2350] },
              properties: { id: c.id, title: c.title, massif: c.mass, likes: c.likes, views: c.views },
            })),
          };
          triggerBrowserDownload(
            `lkdv-photos-geolocalisees-${handle}.geojson`,
            JSON.stringify(geojson, null, 2),
            'application/geo+json;charset=utf-8'
          );
        }
      } else if (action === 'stgear') {
        try {
          localStorage.setItem('lkdv_forked_kit_v1', JSON.stringify({
            forkedAt: new Date().toISOString(),
            sourceHandle: handle,
            items: S?.invs || [],
          }));
          await fetch('/api/materiel/fork', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceHandle: handle }),
          }).catch(() => {});
        } catch (_) {}
      } else if (action === 'toggleFollowUser' && typeof val === 'string') {
        try {
          const supabase = createClient();
          const { data: auth } = await supabase.auth.getUser();
          const me = auth?.user;
          if (!me) return;
          const clean = val.replace(/^@/, '').trim();
          const { data: target } = await supabase
            .from('public_profiles')
            .select('id')
            .eq('handle', clean)
            .maybeSingle();
          if (!target?.id || target.id === me.id) return;
          const { data: existing } = await supabase
            .from('user_follows')
            .select('id')
            .eq('follower_id', me.id)
            .eq('following_id', target.id)
            .maybeSingle();
          if (existing?.id) {
            await supabase.from('user_follows').delete().eq('id', existing.id);
          } else {
            await supabase.from('user_follows').insert({ follower_id: me.id, following_id: target.id });
          }
        } catch (_) {}
      } else if (action === 'signout') {
        try {
          await signOut();
          router.push('/connexion');
        } catch (_) {}
      }
    };

    return () => {
      delete (window as any).__lkdvMountSlot;
      delete (window as any).__lkdvUnmountSlot;
      delete (window as any).__lkdvMountDrawer;
      delete (window as any).__lkdvUnmountDrawer;
      setDrawerMount(null);
      cleanup();
      lastSlotMountRef.current = null;
      initialTabAppliedRef.current = false;
      initializedRef.current = false;
    };
  }, [router, signOut]);

  /**
   * Applique le deep link `?tab=` une fois le rôle connu.
   *
   * Un propriétaire dont le bootstrap n'a pas encore répondu est vu comme
   * visiteur : ouvrir le drawer à ce moment-là afficherait la coquille sans
   * ses entrées, puis le rôle arriverait trop tard. L'effet ci-dessous attend
   * donc la fin du chargement d'auth puis celle du bootstrap.
   */
  const applyInitialTab = useCallback(() => {
    if (!initialTab || initialTabAppliedRef.current) return;
    if (typeof window === 'undefined' || typeof (window as any).__lkdvCompteAct !== 'function') {
      return;
    }
    initialTabAppliedRef.current = true;
    const act = (window as any).__lkdvCompteAct;
    if (initialTab === 'carnets') {
      act('igtab', 0);
      act('openStep', '2:0');
    } else if (initialTab === 'aventures') {
      act('igtab', 1);
      act('openStep', '1:0');
    } else if (initialTab === 'clubs') {
      act('igtab', 3);
      (window as any).__lkdvOpenSlot?.('communaute');
    } else if (initialTab === 'commandes') {
      act('openAccountDrawer');
    } else if (initialTab === 'notifications') {
      act('openAccountDrawer', 1);
    } else if (initialTab === 'fidelite') {
      act('openStep', '3:3');
    } else if (initialTab === 'parametres') {
      act('openAccountDrawer', 2);
    } else if (initialTab === 'progression') {
      act('sealzoom');
    }
  }, [initialTab]);

  useEffect(() => {
    if (authLoading) return;
    if (user && (bootstrapPhase === 'idle' || bootstrapPhase === 'loading')) return;
    applyInitialTab();
  }, [authLoading, user, bootstrapPhase, applyInitialTab]);


  // Hydrate with live Supabase user data
  const syncSupabaseProfile = useCallback(async () => {
    const respondProfileVisibilityUnavailable = (
      value: unknown,
      meta?: CompteMutationMeta
    ) => {
      rejectProfileVisibility({
        value,
        previous: toAccountVisibility(meta?.previousProfileVisibility),
        onRollback: (previous) => {
          try {
            window.__lkdvSetProfileVisibility?.(previous);
          } catch (_) {}
          setSlotMount((current) =>
            current ? { ...current, visibility: previous } : current
          );
        },
        onFailed: (detail) => {
          window.dispatchEvent(
            new CustomEvent<ProfileVisibilityEventDetail>(PROFILE_VISIBILITY_EVENT, {
              detail: {
                ...detail,
                ...(Number.isFinite(meta?.profileRequestId)
                  ? { requestId: meta?.profileRequestId }
                  : {}),
              },
            })
          );
        },
      });
    };

    /* Sans session réelle, une écriture d'empreinte ne peut pas aboutir : on
       rétablit l'index d'avant et on signale `persisted:false`, sans laisser
       la Vitrine sur un bouton gelé. */
    const respondSignatureVisibilityUnavailable = (
      value: unknown,
      meta?: CompteMutationMeta
    ) => {
      const target = signatureVisibilityForValue(value);
      if (!target) return;
      const previous = signatureVisibilityForValue(meta?.previousSignatureVisibility);
      const previousIndex = signatureVisibilityIndex(previous);
      if (previousIndex !== null) {
        try {
          window.__lkdvSetSignatureVisibility?.(previousIndex);
        } catch (_) {}
      }
      window.dispatchEvent(
        new CustomEvent<SignatureVisibilityEventDetail>(SIGNATURE_VISIBILITY_EVENT, {
          detail: {
            value: target,
            persisted: false,
            ...(previous ? { revertedTo: previous } : {}),
            ...(Number.isFinite(meta?.signatureRequestId)
              ? { requestId: meta?.signatureRequestId }
              : {}),
          },
        })
      );
    };

    /* Pont de secours installé avant toute lecture réseau et avant le retour
       démo : sans session (ou si le bootstrap échoue), `profilevis` et `vis`
       reçoivent un échec explicite au lieu de laisser l'écran sur
       « Enregistrement… ». Le pont complet ci-dessous remplace ce secours dès
       que le compte est authentifié et hydraté. */
    (window as any).__lkdvOnMutate = async (
      k: string,
      value: any,
      _S: any,
      meta?: CompteMutationMeta
    ) => {
      if (k === 'profilevis') respondProfileVisibilityUnavailable(value, meta);
      else if (k === 'vis') respondSignatureVisibilityUnavailable(value, meta);
    };

    const hydrate = (window as any).__lkdvHydrateCompte;
    if (typeof hydrate !== 'function') {
      // Le runtime n'a pas exposé son hydrate : aucun profil réel ne peut être
      // posé. On l'expose comme un échec, jamais comme un compte vide.
      setBootstrapPhaseState('error');
      refreshSlotMountRef.current();
      return;
    }

    if (!user) {
      hydrate({
        name: 'Тоny',
        handle: 'tony_frc',
        followersCount: 1080,
        followingCount: 142,
        bioLine: '· Massifs alpins & bivouacs légers',
        avatarUrl: null,
        isGuest: false,
        isDemo: true,
        storeCreditEur: 42.50,
        loyaltyPoints: 1450,
        carnets: DEMO_CARNETS,
        outings: DEMO_OUTINGS,
        clubs: DEMO_CLUBS,
        gearItems: DEMO_GEAR_ITEMS,
        orders: DEMO_ORDERS,
        activeLoans: DEMO_ACTIVE_LOANS,
        notifications: [],
        tribu: [],
        replace: true,
      });
      bootstrapPayloadRef.current = null;
      setBootstrapPhaseState('idle');
      setActiveHandle('tony_frc');
      setSyncStatus('idle');
      refreshSlotMountRef.current();
      return;
    }

    setSyncStatus('syncing');
    // Session en cours de chargement : le drawer déjà ouvert montre un
    // squelette, jamais un état propriétaire supposé.
    setBootstrapPhaseState('loading');
    refreshSlotMountRef.current();

    try {
      const supabase = createClient();
      const [
        profileRes,
        followersRes,
        followingRes,
        carnetsRes,
        travelGroupsRes,
        clubsRes,
        gearRes,
        ordersRes,
        tripsRes,
        sigRes,
        rewardRes,
        loansRes,
      ] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, handle, full_name, bio, location, avatar_url, profile_visibility, signature_visibility, trust_score, loyalty_points, role, created_at')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', user.id),
        supabase
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', user.id),
        supabase
          .from('carnets')
          .select('id, title, destination, visibility, cover_image, description, created_at, views_count, likes_count, comments_count, verified')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('travel_groups')
          .select('id, name, destination, departure_date, return_date')
          .eq('owner_id', user.id)
          .order('departure_date', { ascending: false })
          .limit(10),
        supabase
          .from('club_members')
          .select('role, club:clubs(id, name, slug, description, category, members_count, cover_image, created_at)')
          .eq('user_id', user.id)
          .limit(8),
        supabase
          .from('product_ownership')
          .select('id, name, brand, category, weight_g, price_cents, condition, is_lent, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('orders')
          .select('id, order_number, total_eur, status, created_at, items')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        fetchMyTripsCached().catch(() => null),
        fetch(`/api/identity/signature?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        supabase
          .from('reward_accounts')
          .select('store_credit_cents, available_cash, available_points')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('materiel_loans')
          .select('id, product_ownership_id, borrower_contact, status, loaned_at')
          .eq('lender_id', user.id)
          .eq('status', 'active'),
      ]);

      const hasUserCarnets = Array.isArray(carnetsRes.data) && carnetsRes.data.length > 0;
      const userClubs = (clubsRes.data || [])
        .map((cm: any) => ({
          slug: cm.club?.slug || cm.club?.id,
          name: cm.club?.name || 'Club LKDV',
          role: cm.role,
          membersCount: cm.club?.members_count || 0,
        }))
        .filter((c: any) => c.name);

      const patch: Record<string, any> = {
        isGuest: false,
        followersCount: followersRes.count ?? 0,
        followingCount: followingRes.count ?? 0,
        carnets: hasUserCarnets ? carnetsRes.data : [],
        clubs: userClubs,
        gearItems: gearRes.data || [],
        orders: ordersRes.data || [],
        activeLoans: loansRes.data || [],
        // Le bootstrap complet arrive ensuite ; on ne laisse jamais les
        // tableaux de démonstration visibles sur un compte connecté.
        kits: [],
        species: [],
        massifs: [],
        followers: [],
        following: [],
      };

      if (profileRes.data) {
        const p = profileRes.data;
        const derivedHandle = p.handle || (p.full_name
          ? p.full_name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 16)
          : (user.email ? user.email.split('@')[0] : 'voyageur'));
        patch.handle = derivedHandle;
        patch.name = p.full_name || 'Voyageur LKDV';
        patch.loyaltyPoints = Number(p.loyalty_points || 0);
        patch.bioLine = p.bio ? ('· ' + p.bio.split('\n')[0].slice(0, 48)) : '';
        patch.home = p.location || '';
        // `signature_visibility` (private par défaut) et `profile_visibility`
        // arrivent avec la première hydratation : le runtime ne doit jamais
        // rester sur le défaut Communauté de la maquette.
        Object.assign(patch, mapProfileRuntimeVisibility(p));
        if (p.avatar_url && p.avatar_url !== '/assets/images/no_image.png') {
          patch.avatarUrl = p.avatar_url;
        }
        setActiveHandle(derivedHandle);
      }

      if (sigRes && sigRes.signature) {
        patch.sigText = sigRes.signature;
      }

      // Store credit & rewards
      const creditEur = (rewardRes.data?.store_credit_cents ? rewardRes.data.store_credit_cents / 100 : 0) + Number(rewardRes.data?.available_cash || 0);
      patch.storeCreditEur = creditEur;

      // Sorties réelles uniquement : aucun repli démo sur un compte connecté.
      const combinedOutings: any[] = [];
      if (Array.isArray(travelGroupsRes.data) && travelGroupsRes.data.length > 0) {
        combinedOutings.push(...travelGroupsRes.data);
      }
      if (tripsRes && Array.isArray(tripsRes.trips)) {
        combinedOutings.push(...tripsRes.trips);
      }
      patch.outings = combinedOutings;

      hydrate(patch);
      setSyncStatus('synced');

      // Bootstrap complet : remplace les tableaux de démonstration par les
      // données réelles (profil, carnets, sorties, commandes, follows, clubs).
      // C'est aussi lui qui confirme le rôle : tant qu'il n'a pas répondu,
      // l'hôte ne peut pas afficher les entrées propriétaire.
      try {
        const bootRes = await fetch('/api/compte/bootstrap');
        if (!bootRes.ok) throw new Error(`bootstrap_http_${bootRes.status}`);
        const payload = await bootRes.json();
        bootstrapPayloadRef.current = payload;
        if (payload?.error) throw new Error(String(payload.error));
        const bootVisibility =
          payload?.visibility?.profile === 'prive'
            ? 'prive'
            : payload?.visibility?.profile === 'public'
              ? 'public'
              : null;
        if (bootVisibility) accountVisibilityRef.current = bootVisibility;
        const bootSignatureIndex = signatureVisibilityIndex(payload?.visibility?.signature);
        const bootSignature = signatureVisibilityForValue(bootSignatureIndex);
        if (bootSignature) signatureVisibilityRef.current = bootSignature;
        if (payload?.authenticated) {
          hydrate({
            ...payload.profile,
            profileVisibility: bootVisibility,
            ...(bootSignatureIndex !== null ? { vis: bootSignatureIndex } : {}),
            carnets: payload.carnets || [],
            outings: payload.outings || [],
            orders: payload.orders || [],
            bookings: payload.bookings || [],
            clubs: payload.clubs || [],
            tribu: payload.tribu || [],
            followers: payload.followers || [],
            following: payload.following || [],
            kits: payload.kits || [],
            stories: payload.stories || [],
            species: payload.species || [],
            massifs: payload.massifs || [],
            notifications: payload.notifications || [],
            replace: true,
          });
          if (payload.profile?.handle) setActiveHandle(payload.profile.handle);
        }
        setBootstrapPhaseState('ready');
      } catch (_) {
        // Échec explicite : le drawer montre l'erreur et propose de réessayer,
        // il ne se présente jamais comme un compte vide.
        bootstrapPayloadRef.current = null;
        setBootstrapPhaseState('error');
      } finally {
        // Le runtime a pu monter le drawer avant la réponse : on rejoue le
        // dernier montage avec le rôle et le payload désormais connus.
        refreshSlotMountRef.current();
      }

      // Hook up mutation callback to persist changes back to Supabase & API routes
      (window as any).__lkdvOnMutate = async (
        k: string,
        v: any,
        S: any,
        meta?: CompteMutationMeta
      ) => {
        try {
          if (k === 'profilevis') {
            // Confidentialité du compte : `public` | `prive`, exactement les
            // valeurs du CHECK. Écriture RLS-scopée sur la ligne de l'appelant,
            // confirmée par relecture avant tout succès affiché.
            const update = accountVisibilityUpdate(v);
            if (!update) return;
            const previous =
              accountVisibilityRef.current ?? toAccountVisibility(meta?.previousProfileVisibility);
            await persistProfileVisibility({
              client: supabase,
              userId: user.id,
              value: update.profile_visibility,
              previous,
              onPersisted: (value) => {
                accountVisibilityRef.current = value;
                const boot = bootstrapPayloadRef.current as any;
                if (boot) {
                  boot.visibility = {
                    ...(boot.visibility ?? {}),
                    profile: value,
                  };
                }
                setSlotMount((current) =>
                  current ? { ...current, visibility: value } : current
                );
                window.dispatchEvent(
                  new CustomEvent<ProfileVisibilityEventDetail>(PROFILE_VISIBILITY_EVENT, {
                    detail: {
                      value,
                      persisted: true,
                      ...(Number.isFinite(meta?.profileRequestId)
                        ? { requestId: meta?.profileRequestId }
                        : {}),
                    },
                  })
                );
              },
              onRollback: (value) => {
                // Retour exact : le runtime ne doit jamais afficher une
                // confidentialité qui n'a pas été écrite.
                try {
                  window.__lkdvSetProfileVisibility?.(value);
                } catch (_) {}
                setSlotMount((current) =>
                  current ? { ...current, visibility: value } : current
                );
              },
              onFailed: (detail) => {
                window.dispatchEvent(
                  new CustomEvent<ProfileVisibilityEventDetail>(
                    PROFILE_VISIBILITY_EVENT,
                    {
                      detail: {
                        ...detail,
                        ...(Number.isFinite(meta?.profileRequestId)
                          ? { requestId: meta?.profileRequestId }
                          : {}),
                      },
                    }
                  )
                );
              },
            });
            return;
          }
          if (k === 'vis') {
            // Visibilité de l'empreinte : écriture RLS puis relecture. Aucun
            // succès n'est annoncé avant que la colonne ne porte la cible ;
            // en cas d'échec, le runtime revient à l'index précédent.
            await persistSignatureVisibility({
              client: supabase,
              userId: user.id,
              value: S.vis,
              previous: meta?.previousSignatureVisibility,
              onPersisted: (value) => {
                signatureVisibilityRef.current = value;
                const boot = bootstrapPayloadRef.current as any;
                if (boot) {
                  boot.visibility = {
                    ...(boot.visibility ?? {}),
                    signature: value,
                  };
                }
                window.dispatchEvent(
                  new CustomEvent<SignatureVisibilityEventDetail>(
                    SIGNATURE_VISIBILITY_EVENT,
                    {
                      detail: {
                        value,
                        persisted: true,
                        ...(Number.isFinite(meta?.signatureRequestId)
                          ? { requestId: meta?.signatureRequestId }
                          : {}),
                      },
                    }
                  )
                );
              },
              onRollback: (index) => {
                try {
                  window.__lkdvSetSignatureVisibility?.(index);
                } catch (_) {}
              },
              onFailed: (detail) => {
                window.dispatchEvent(
                  new CustomEvent<SignatureVisibilityEventDetail>(
                    SIGNATURE_VISIBILITY_EVENT,
                    {
                      detail: {
                        ...detail,
                        ...(Number.isFinite(meta?.signatureRequestId)
                          ? { requestId: meta?.signatureRequestId }
                          : {}),
                      },
                    }
                  )
                );
              },
            });
            return;
          } else if (k === 'home') {
            await supabase
              .from('user_profiles')
              .update({ location: S.traveller?.home, updated_at: new Date().toISOString() })
              .eq('id', user.id);
          } else if (k === 'pubdraft') {
            const dump = typeof (window as any).__lkdvGetState === 'function' ? (window as any).__lkdvGetState() : null;
            const draftCarnet = dump?.CARNETS?.find((c: any) => c.id === 'ca0');
            if (draftCarnet?.realId) {
              await supabase
                .from('carnets')
                .update({ visibility: 'public' })
                .eq('id', draftCarnet.realId);
              requestCarnetPublicationAward(draftCarnet.realId, user.id);
            }
          } else if (k === 'additem') {
            const latest = S.invs?.[S.invs.length - 1];
            if (latest) {
              await fetch('/api/materiel/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  product_name: latest.n,
                  brand: latest.b,
                  category: latest.c,
                  weight_g: latest.w,
                  purchase_price_eur: latest.paid,
                  condition: latest.cond || 'neuf',
                }),
              }).catch(() => {});
            }
          }
        } catch (_) {}
      };
    } catch {
      setSyncStatus('idle');
      // Une lecture Supabase ratée avant le bootstrap ne doit pas laisser la
      // coquille en chargement perpétuel : c'est un échec explicite.
      if (bootstrapPhaseRef.current !== 'ready') {
        setBootstrapPhaseState('error');
        refreshSlotMountRef.current();
      }
    }
  }, [user, setBootstrapPhaseState]);

  useEffect(() => {
    retryBootstrapRef.current = () => {
      void syncSupabaseProfile();
    };
  }, [syncSupabaseProfile]);

  useEffect(() => {
    syncSupabaseProfile();
  }, [syncSupabaseProfile]);

  return (
    <div className="lkdv-compte-v8" data-theme="light">
      <style dangerouslySetInnerHTML={{ __html: COMPTE_V8_CSS + '\n' + COMPTE_V8_APPLE_HIG_CSS + '\n' + DRAWER_V2_CSS }} />
      {/* Sub-navigation bar: live Supabase status + direct routes + quick actions (accessible sentinel) */}
      <div className="sr-only" aria-hidden="true" inert>
      <div className="mx-auto flex max-w-[1260px] flex-wrap items-center justify-between gap-2 px-4 pt-2 pb-1 text-xs text-[color:var(--lkv-text-secondary)]">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex h-2 w-2 rounded-full bg-[#17402C]"
            aria-hidden="true"
          />
          <span className="font-semibold text-[color:var(--lkv-text-primary)]">
            Profil iOS 27 Liquid Glass v8
          </span>
          <span className="rounded-full border border-[#143726]/15 bg-[#EBF2EC] px-2.5 py-0.5 font-medium text-[#17402C]">
            {user
              ? syncStatus === 'syncing'
                ? 'Synchronisation Supabase…'
                : `Connecté · @${activeHandle}`
              : `Mode invité · aperçu de démonstration`}
          </span>
          {user && (
            <button
              type="button"
              onClick={() => syncSupabaseProfile()}
              className="rounded-full border border-[#143726]/15 bg-white/60 px-2.5 py-0.5 font-medium text-[#17402C] transition hover:bg-white"
            >
              Actualiser
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/compte/modifier"
            className="rounded-full border border-[#143726]/20 bg-white/70 px-3 py-1 font-semibold text-[#17402C] backdrop-blur-md transition hover:bg-white"
          >
            Modifier le profil
          </Link>
          <Link
            href="/compte/voyageur"
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Profil voyageur (Lot Z1)
          </Link>
          <button
            type="button"
            onClick={() => triggerAct('openscan')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Scanner matériel
          </button>
          <button
            type="button"
            onClick={() => triggerAct('openStep', '3:2')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Commandes
          </button>
          <button
            type="button"
            onClick={() => triggerAct('openStep', '3:1')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Crédits &amp; Lignées
          </button>
          <button
            type="button"
            onClick={() => triggerAct('export', 'full')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Export RGPD (.json)
          </button>
          <button
            type="button"
            onClick={() => triggerAct('export', 'gpx')}
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Export GPX (.gpx)
          </button>
          <Link
            href="/progression"
            className="rounded-full border border-[#143726]/15 bg-white/55 px-3 py-1 font-medium text-[#17402C] backdrop-blur-md transition hover:bg-white/90"
          >
            Progression
          </Link>
          {!user && (
            <Link
              href="/connexion?redirect=/compte"
              className="rounded-full bg-[#17402C] px-3 py-1 font-semibold text-white transition hover:opacity-90"
            >
              Se connecter
            </Link>
          )}
        </div>
      </div>
      </div>
      <div ref={containerRef} />
      {mapRoot && mapVisible ? createPortal(
        <CompteMap
          authState={
            bootstrapPhase === 'ready'
              ? (bootstrapPayloadRef.current as { authenticated?: boolean } | null)?.authenticated
                ? 'owner'
                : 'guest'
              : bootstrapPhase === 'error'
                ? 'error'
                : authLoading
                  ? 'loading'
                  : !user
                    ? 'guest'
                    : 'loading'
          }
          context={mapContext}
        />,
        mapRoot
      ) : null}
      {drawerMount?.root ? createPortal(
        drawerMount.kind === 'reseau' ? (
          <ReseauDrawer initialTab={drawerMount.props?.tab === 'followers' ? 1 : 0} />
        ) : drawerMount.kind === 'sortie' ? (
          <SortieDrawer outingId={String(drawerMount.props?.outingId || '')} />
        ) : drawerMount.kind === 'compte' ? (
          <CompteDrawer initialTab={Number(drawerMount.props?.tab) || 0} />
        ) : (
          <div style={{ padding: 16 }}>Chargement…</div>
        ),
        drawerMount.root
      ) : null}
      {user ? <FirstRunJourney userId={user.id} /> : null}
      <CompteOverlayHost onChanged={() => { void syncSupabaseProfile(); }} />
      {slotMount ? (
        <ProfileDrawerHost
          viewer={slotMount.viewer}
          visibility={slotMount.visibility}
          invited={slotMount.invited}
          activeSlot={slotMount.slotId}
          portalRoot={slotMount.root}
          onSlotChange={(slot) => {
            if (typeof window !== 'undefined') {
              (window as any).__lkdvSetSlot?.(slot);
            }
          }}
          payload={slotMount.payload}
          state={slotMount.state}
          onRetry={
            slotMount.state === 'error'
              ? () => {
                  retryBootstrapRef.current();
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

export default CompteLiquidGlassV8;
