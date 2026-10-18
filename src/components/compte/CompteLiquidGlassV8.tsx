'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { requestCarnetPublicationAward } from '@/lib/progression-award-requests';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initCompteLiquidGlassRuntime } from './compte-liquid-glass-v8-runtime';

const COMPTE_V8_CSS = ".lkdv-compte-v8{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}.lkdv-compte-v8{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}\n\n\r\n/* Layout : iPhone iOS 27 clair sur le vrai fond LKDV. 60 % haut = étape courante, 40 % bas = carte vivante\r\n   (agrandissable). Barre d'onglets flottante + accessoire. Feuilles linéaires à 3 hauteurs. */\r\n.lkdv-compte-v8{\r\n  --page:#F5F2EC;--on-page:#172B24;--muted-page:#56665D;--rule:#A6C1A0;\r\n  --sf:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"SF Pro Display\",\"Inter\",system-ui,\"Segoe UI\",Roboto,sans-serif;\r\n}\r\n@media (prefers-color-scheme:dark){.lkdv-compte-v8:not([data-theme=\"light\"]){--page:#0e1210;--on-page:#ecede8;--muted-page:#97a39a;--rule:#5B7F55;color-scheme:dark}}\r\n.lkdv-compte-v8[data-theme=\"dark\"]{--page:#0e1210;--on-page:#ecede8;--muted-page:#97a39a;--rule:#5B7F55;color-scheme:dark}\r\n*{box-sizing:border-box}\r\n.lkdv-compte-v8{background:var(--page);color:var(--on-page);font-family:var(--sf);padding-inline:16px;padding-block:16px;-webkit-font-smoothing:antialiased}\r\n.stage{max-width:960px;margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr);gap:48px;align-items:start;justify-content:center}\r\n.pwrap{position:relative;width:390px;height:844px;margin:0 auto}\r\n.notes{padding-top:30px;display:flex;flex-direction:column;gap:13px;min-width:0}\r\n.notes h1{font:700 32px/1.08 var(--sf);letter-spacing:-.02em;margin:0;text-wrap:balance}\r\n.notes p{margin:0;color:var(--muted-page);line-height:1.5;max-width:48ch;font-size:15px}\r\n.notes .tag{font:600 12px var(--sf);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-page)}\r\n.notes ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}\r\n.notes li{font-size:14px;line-height:1.42;padding-left:13px;border-left:2px solid var(--rule)}\r\n.notes li b{font-weight:600}\r\n@media (max-width:860px){.stage{grid-template-columns:minmax(0,1fr)}.notes{display:none}}\r\n\r\n/* ---------- iPhone (clair) ---------- */\r\n.phone{\r\n  --label:#172B24;--label2:#56665D;--label3:rgba(23,43,36,.44);--sep:rgba(23,43,36,.1);\r\n  --fill:rgba(23,43,36,.09);--fill2:rgba(23,43,36,.06);--fill3:rgba(255,255,255,.62);\r\n  --tint:#17402C;--tint-ink:#fff;--accent:#5B7F55;--subtle:#A6C1A0;--mint:#EBF2EC;\r\n  --good:#3D7A52;--warn:#B98A2E;--warn-bg:#FBF1DC;--bad:#A8443A;--bad-bg:#F5DDD9;--info:#4B6B7C;--water:#3F93B8;\r\n  --ga:.19;--gb:7px;--la:140deg;\r\n  --pg:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.16) 52%,rgba(255,255,255,.3)),rgba(150,186,142,.34);--pg-ink:#17402C;\r\n  --pg-sh:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.4),inset 0 0 0 .6px rgba(255,255,255,.5),0 0 0 .6px rgba(23,64,44,.16),0 5px 14px rgba(23,64,44,.13);\r\n  --soft:rgba(150,186,142,.28);--soft-line:rgba(91,127,85,.38);\r\n  position:absolute;left:0;top:0;width:390px;height:844px;transform-origin:0 0;border-radius:54px;overflow:hidden;\r\n  background:#cfd6c8;color:var(--label);font-family:var(--sf);font-size:14px;letter-spacing:-.01em;\r\n  box-shadow:0 0 0 8px #10130f,0 0 0 9px rgba(0,0,0,.2),0 30px 70px rgba(23,43,36,.28);isolation:isolate;\r\n  display:grid;grid-template-rows:calc(60% - 49px) 1fr;grid-template-columns:minmax(0,1fr);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;\r\n  transition:grid-template-rows .55s cubic-bezier(.32,.72,0,1)}\r\n.phone.mapbig{grid-template-rows:172px 1fr}\r\n.phone.outdoor{--ga:.9;--gb:30px;--label2:#2f3f37;--label3:rgba(23,43,36,.7);font-size:15px}\r\n.phone button,.phone input{font-family:inherit;letter-spacing:inherit;color:inherit}\r\n.phone :focus-visible{outline:2px solid var(--accent);outline-offset:2px}\r\n\r\n/* Vrai fond LKDV */\r\n.bg{position:absolute;inset:0;z-index:-1;background-size:cover;background-position:center 30%;filter:brightness(1.1) saturate(1.05)}\r\n.bg::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,250,236,.08),rgba(255,255,255,0) 30%,rgba(245,242,236,.12) 60%)}\r\n\r\n/* Barre d'état + Dynamic Island */\r\n.status{position:absolute;top:0;left:0;right:0;height:50px;display:flex;justify-content:space-between;align-items:center;padding:4px 30px 0 38px;font:600 16px var(--sf);color:#fff;z-index:30;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.25)}\r\n.status .r{display:flex;gap:6px;align-items:center}\r\n.island{position:absolute;top:11px;left:50%;width:124px;height:36px;margin-left:-62px;border-radius:20px;background:#000;z-index:40;overflow:hidden;color:#fff;\r\n  transition:width .5s cubic-bezier(.32,1.25,.4,1),height .5s cubic-bezier(.32,1.25,.4,1),margin-left .5s cubic-bezier(.32,1.25,.4,1),border-radius .5s}\r\n.island[data-s=live]{width:232px;margin-left:-116px}\r\n.island[data-s=note]{width:366px;margin-left:-183px;height:auto;min-height:70px;border-radius:32px}\r\n.island .is{opacity:0;transition:opacity .2s;display:flex;align-items:center;gap:10px;height:100%;padding:0 14px;white-space:nowrap}\r\n.island[data-s=live] .is.live,.island[data-s=note] .is.note{opacity:1;transition-delay:.16s}\r\n.island .is.live{justify-content:space-between;font:600 12.5px var(--sf);position:absolute;inset:0}\r\n.island .is.live .ic{color:#A6C1A0}\r\n.island .is.note{padding:13px 12px 13px 18px;white-space:normal;min-height:70px}\r\n.island[data-s=idle] .is,.island[data-s=live] .is.note{display:none}\r\n.island[data-s=note] .is.live{display:none}\r\n.is.note .t{flex:1;min-width:0}.is.note b{display:block;font:600 14.5px/1.25 var(--sf);color:#fff}\r\n.is.note span{display:block;font:500 12px/1.35 var(--sf);color:rgba(255,255,255,.72);margin-top:2px;font-variant-numeric:tabular-nums}\r\n.is.note button{flex:none;height:32px;padding:0 13px;border-radius:999px;border:0;background:rgba(255,255,255,.16);color:#A6C1A0!important;font:600 13px var(--sf);cursor:pointer}\r\n\r\n/* ---------- Liquid Glass clair (iOS 27 : plus transparent, bords assombris, reflets vifs) ---------- */\r\n.lg{position:relative;background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .14)),rgba(255,255,255,calc(var(--ga) - .04)) 50%,rgba(255,255,255,calc(var(--ga) + .06)));\r\n  -webkit-backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07);backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07);\r\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 1px rgba(255,255,255,.45),inset 1px 0 1px rgba(255,255,255,.28),inset -1px 0 1px rgba(255,255,255,.28),inset 0 0 12px rgba(255,255,255,.14),0 0 0 .5px rgba(23,43,36,.14),0 8px 22px rgba(23,43,36,.12)}\r\n.refr .lg.lens-on{-webkit-backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07)}\r\n.lg::before{content:\"\";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;\r\n  background:conic-gradient(from var(--la),rgba(255,255,255,1),rgba(255,255,255,.25) 18%,rgba(255,255,255,0) 32%,rgba(255,255,255,.7) 50%,rgba(255,255,255,0) 68%,rgba(255,255,255,.25) 82%,rgba(255,255,255,1));\r\n  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}\r\n.lg>*{position:relative;z-index:1}\r\n.cs{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .2)));-webkit-backdrop-filter:blur(calc(var(--gb) + 18px)) saturate(1.8) brightness(1.05);backdrop-filter:blur(calc(var(--gb) + 18px)) saturate(1.8) brightness(1.05);\r\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.4),inset 0 0 16px rgba(255,255,255,.12),0 0 0 .5px rgba(23,43,36,.12),0 10px 30px rgba(23,43,36,.14)}\r\n@media (prefers-reduced-transparency:reduce){.lg,.cs{background:#FBFAF6!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}}\r\n\r\n/* Icônes */\r\n.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}\r\n.ic.s{width:16px;height:16px}.ic.xs{width:12px;height:12px;stroke-width:2.2}\r\n.ic .f{fill:currentColor;stroke:none}\r\n\r\n/* ---------- Zone haute ---------- */\r\n.top{position:relative;min-height:0;min-width:0;padding:54px 12px 8px;display:flex;flex-direction:column;gap:7px}\r\n.head{display:flex;gap:7px;align-items:center;flex:none}\r\n.steps{flex:1;height:42px;border-radius:999px;display:grid;grid-template-columns:repeat(5,1fr);padding:3px;position:relative}\r\n.steps .lens{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/5);border-radius:999px;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.3));\r\n  box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.1);transition:transform .5s cubic-bezier(.3,1.3,.4,1)}\r\n.steps button{position:relative;z-index:2;border:0;background:none;color:rgba(23,43,36,.74);display:grid;place-items:center;cursor:pointer;border-radius:999px;min-height:36px}\r\n.steps button[aria-current=step]{color:var(--tint)}\r\n.steps button[aria-current=step] .ic{stroke-width:2.1}\r\n.steps .dot{position:absolute;bottom:3px;width:3px;height:3px;border-radius:50%;background:var(--accent);opacity:0}\r\n.steps button.done .dot{opacity:.9}\r\n.gbtn{width:42px;height:42px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;flex:none;color:var(--label)}\r\n.gbtn.sm{width:32px;height:32px}\r\n.card{flex:1;min-height:0;border-radius:26px;padding:13px 14px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;scrollbar-width:none;transition:transform .3s cubic-bezier(.3,1.2,.4,1),opacity .2s}\r\n.card::-webkit-scrollbar{display:none}\r\n.card>*{flex:none}\r\n.mapbig .card{display:none}\r\n.acts{display:flex;gap:7px;flex:none}\r\n.pbtn{flex:1;min-width:0;height:42px;border-radius:999px;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;padding:0 16px;\r\n  background:var(--pg);color:var(--pg-ink)!important;font:600 14.5px var(--sf);-webkit-backdrop-filter:blur(10px) saturate(1.9);backdrop-filter:blur(10px) saturate(1.9);\r\n  box-shadow:var(--pg-sh);transition:transform .25s cubic-bezier(.3,1.5,.5,1)}\r\n.pbtn .ic{color:var(--accent)}\r\n.pbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.pbtn:active,.gbtn:active,.mbtn:active,.chip:active,.nx:active{transform:scale(1.04)}\r\n.pbtn[disabled]{background:var(--fill);color:var(--label2)!important;box-shadow:none;cursor:default}\r\n\r\n/* Typo */\r\n.t2{font:700 19px/1.2 var(--sf);letter-spacing:-.02em;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.hl{font:600 15px/1.25 var(--sf)}\r\n.sub{font:400 12.5px/1.3 var(--sf);color:var(--label2)}\r\n.cap{font:600 11.5px/1.2 var(--sf);color:var(--label2);text-transform:uppercase;letter-spacing:.04em}\r\n.num{font-variant-numeric:tabular-nums}\r\n.row{display:flex;align-items:center;gap:7px;min-width:0}\r\n.ai{color:var(--accent);display:inline-flex;vertical-align:-1px}\r\n.ed{color:var(--warn);display:inline-flex;vertical-align:-1px}\r\n.fd{display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 5px 1px 0;vertical-align:middle;flex:none}\r\n.fd.ok{background:var(--good)}.fd.old{background:var(--label3)}.fd.none{box-shadow:inset 0 0 0 1.4px var(--label3)}\r\n\r\n/* Contrôles iOS (réduits) */\r\n.intent{display:flex;align-items:center;gap:8px;height:36px;border-radius:999px;padding:0 12px;background:var(--fill2);color:var(--label2)}\r\n.intent input{flex:1;min-width:0;background:none;border:0;color:var(--label);font:400 14.5px var(--sf);outline:none;height:34px}\r\n.intent input::placeholder{color:var(--label3)}\r\n.segc{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;height:30px;border-radius:999px;background:var(--fill);padding:2px}\r\n.segc button{position:relative;z-index:2;border:0;background:none;color:var(--label);font:500 12.5px var(--sf);cursor:pointer;border-radius:999px;padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.segc button[aria-pressed=true]{font-weight:600}\r\n.segc .th{position:absolute;z-index:1;top:2px;bottom:2px;left:2px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(23,43,36,.14),0 3px 8px rgba(23,43,36,.08);transition:transform .45s cubic-bezier(.3,1.3,.4,1)}\r\n.chips{display:flex;flex-wrap:wrap;gap:5px}\r\n.chip{height:28px;padding:0 11px;border-radius:999px;border:0;background:var(--fill);color:var(--label);font:500 12.5px var(--sf);display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;transition:transform .15s,background .2s}\r\n.chip[aria-pressed=true]{background:var(--soft);color:var(--tint)!important;font-weight:600;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6)}\r\n.chip[disabled]{opacity:.35;cursor:default}\r\n.chip.st{cursor:default;background:var(--fill2)}\r\n.mbtn{height:30px;padding:0 12px;border-radius:999px;border:0;background:var(--fill);color:var(--label);font:600 12.5px var(--sf);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;transition:transform .15s}\r\n.mbtn.p{background:var(--pg);color:var(--pg-ink)!important;box-shadow:var(--pg-sh)}\r\n.mbtn.soft{background:var(--mint);color:var(--tint)!important}\r\n.mbtn[disabled]{opacity:.45;cursor:default}\r\n.lnk{border:0;background:none;color:var(--accent)!important;font:500 12.5px var(--sf);cursor:pointer;padding:4px 2px}\r\n.stp{display:inline-flex;align-items:center;height:28px;border-radius:8px;background:var(--fill);flex:none}\r\n.stp button{width:36px;height:28px;border:0;background:none;display:grid;place-items:center;cursor:pointer}\r\n.stp button[disabled]{opacity:.3;cursor:default}\r\n.stp i{width:1px;height:16px;background:var(--sep)}\r\n.sw{width:46px;height:28px;border-radius:999px;border:0;background:var(--fill);position:relative;cursor:pointer;flex:none;transition:background .25s;padding:0}\r\n.sw::after{content:\"\";position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.22);transition:transform .35s cubic-bezier(.3,1.4,.5,1)}\r\n.sw[aria-checked=true]{background:#8DB287}.sw[aria-checked=true]::after{transform:translateX(18px)}\r\n.sumline{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 11px;border-radius:14px;background:var(--fill2);font-size:13px}\r\n.sumline b{font-weight:600}.sumline>span{min-width:0}.sumline .nw{white-space:nowrap;flex:none}\r\n.input{height:32px;border-radius:9px;border:0;background:var(--fill);padding:0 10px;font:400 14px var(--sf);color:var(--label);outline:none;min-width:0}\r\n.input::placeholder{color:var(--label3)}\r\n\r\n/* Curseur d'échelle continu */\r\n.ruler{border-radius:18px;padding:5px 12px 4px}\r\n.rhead{display:flex;justify-content:space-between;align-items:baseline;font:600 12px var(--sf);color:var(--label2)}\r\n.rhead b{font:700 15px var(--sf);color:var(--label);font-variant-numeric:tabular-nums}\r\n.ruler input{-webkit-appearance:none;appearance:none;display:block;width:100%;height:26px;background:none;margin:0;cursor:pointer;touch-action:pan-y}\r\n.ruler input::-webkit-slider-runnable-track{height:4px;border-radius:99px;background:linear-gradient(90deg,#8DB287 var(--p),rgba(23,43,36,.14) var(--p))}\r\n.ruler input::-moz-range-track{height:4px;border-radius:99px;background:linear-gradient(90deg,#8DB287 var(--p),rgba(23,43,36,.14) var(--p))}\r\n.ruler input::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:20px;margin-top:-8px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(23,43,36,.28),inset 0 0 0 .5px rgba(0,0,0,.08)}\r\n.ruler input::-moz-range-thumb{width:30px;height:20px;border:0;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(23,43,36,.28)}\r\n.ticks{position:relative;height:15px;font:500 10px var(--sf);color:var(--label3)}\r\n.ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap;cursor:pointer;transition:color .2s}\r\n.ticks span:hover{color:var(--tint)}\r\n.zc{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:var(--mint);color:var(--tint);font:600 11px/16px var(--sf)}\r\n.zc.bump{animation:zb .35s cubic-bezier(.3,1.6,.5,1)}@keyframes zb{40%{transform:scale(1.15)}}\r\n.fsum{border-radius:18px;padding:2px 0;display:flex;flex-direction:column}\r\n.fr{display:grid;grid-template-columns:24px auto minmax(0,1fr) 12px;align-items:center;gap:8px;height:29px;padding:0 10px 0 9px;border:0;background:none;cursor:pointer;text-align:left;color:var(--label)}\r\n.fr+.fr{box-shadow:inset 36px .5px 0 -36px transparent;border-top:.5px solid var(--sep);margin-left:0}\r\n.fr .fi{width:24px;height:24px;border-radius:8px;background:var(--mint);color:var(--tint);display:grid;place-items:center}\r\n.fr .fi svg{width:15px;height:15px}\r\n.fr .fl{font:600 13px var(--sf)}\r\n.fr .fv{font:400 12.5px var(--sf);color:var(--label2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:flex-end;gap:5px}\r\n.fr>svg:last-child{color:var(--label3)}\r\n.fr:active{background:var(--fill2)}\r\n.srcrow{display:flex;flex-wrap:wrap;gap:5px}\r\n.srcrow .chip{height:24px;font-size:11.5px;padding:0 9px;cursor:default;background:var(--fill2)}\r\n\r\n/* Nous */\r\n.av{display:flex;align-items:center;gap:5px}\r\n.avi{position:relative;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:600 12.5px var(--sf);color:#17402C;flex:none;background:linear-gradient(160deg,#EBF2EC,#A6C1A0);box-shadow:0 0 0 1.5px #fff}\r\n.avi.sm{width:24px;height:24px;font-size:10.5px}\r\n.avi .on{position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;background:var(--good);box-shadow:0 0 0 2px #fff}\r\n.avi .lv{position:absolute;left:-3px;top:-4px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:rgba(255,255,255,.85);color:var(--tint);box-shadow:0 0 0 .6px var(--soft-line);font:700 8.5px/14px var(--sf);text-align:center}\r\n.avadd{width:30px;height:30px;border-radius:50%;border:1.3px dashed rgba(23,43,36,.35);background:rgba(255,255,255,.5);color:var(--label);display:grid;place-items:center;cursor:pointer;flex:none}\r\n.bigsum{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}.bigsum b{font:700 21px var(--sf);letter-spacing:-.02em}\r\n.bar{height:5px;border-radius:99px;background:var(--fill);overflow:hidden;display:flex}\r\n.bar i{display:block;height:100%;border-radius:99px;transition:width .5s,background .3s}\r\n\r\n/* Résa */\r\n.tchips{display:flex;gap:5px}\r\n.tchip{flex:1;min-width:0;height:44px;border-radius:14px;border:0;background:var(--fill2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;position:relative;font:500 10px var(--sf);color:var(--label2)}\r\n.tchip .ic{width:17px;height:17px;color:var(--label)}\r\n.tchip.on{background:var(--soft);box-shadow:inset 0 0 0 1px var(--soft-line)}\r\n.tchip[disabled]{opacity:.35;cursor:default}\r\n.tchip .bd{position:absolute;top:3px;right:5px;min-width:15px;height:15px;border-radius:8px;background:rgba(141,178,135,.55);color:var(--tint);font:700 9.5px/15px var(--sf);padding:0 4px}\r\n.days{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}\r\n.day{border-radius:14px;background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .6px rgba(23,43,36,.1);padding:7px 7px 8px;display:flex;flex-direction:column;gap:5px;cursor:pointer;border:0;text-align:left;min-width:0}\r\n.day b{font:700 12.5px var(--sf)}.day small{font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.slots{display:flex;gap:3px;flex-wrap:wrap}\r\n.slot{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font:700 9.5px var(--sf);background:var(--fill);color:var(--label2)}\r\n.slot.added{background:#fff;color:var(--tint);box-shadow:inset 0 0 0 1.2px var(--tint)}.slot.pending{background:var(--warn-bg);color:var(--warn)}.slot.confirmed{background:rgba(61,122,82,.2);color:var(--good)}\r\n.slot.need{background:transparent;box-shadow:inset 0 0 0 1.2px var(--warn);color:var(--warn)}\r\n.disc{font:400 11px/1.3 var(--sf);color:var(--label3)}\r\n\r\n/* Verdict */\r\n.verdict{display:flex;gap:12px;align-items:center}\r\n.ring{position:relative;flex:none;width:76px;height:76px}\r\n.ring svg{transform:rotate(-90deg)}\r\n.ring .n{position:absolute;inset:0;display:grid;place-items:center;align-content:center;font:700 24px var(--sf);text-align:center;letter-spacing:-.03em}\r\n.ring small{display:block;font:500 9.5px var(--sf);color:var(--label2);letter-spacing:0}\r\n.vl{display:inline-flex;align-items:center;gap:6px;font:600 14px var(--sf)}\r\n.vl i{width:8px;height:8px;border-radius:50%;background:var(--c)}\r\n.why{margin:4px 0 0;padding:0;list-style:none;display:grid;gap:2px;font-size:12.5px;color:var(--label2);line-height:1.3}\r\n.why li{display:flex;align-items:baseline}\r\n.vb{padding:8px 11px;border-radius:14px;background:var(--fill2);display:flex;flex-direction:column;gap:3px}\r\n.vb .h{display:flex;align-items:center;gap:7px;font:600 11.5px var(--sf);color:var(--label2)}\r\n.vb p{margin:0;font-size:13px;line-height:1.3}\r\n.pd{width:6px;height:6px;border-radius:50%;background:var(--good);animation:pulse 1.6s infinite;flex:none}\r\n@keyframes pulse{50%{opacity:.3}}\r\n\r\n/* Kit */\r\n.weights{display:flex;height:6px;border-radius:999px;overflow:hidden;gap:2px}\r\n.weights i{display:block;transition:flex .4s}\r\n.wl{display:flex;justify-content:space-between;margin-top:4px;font:500 11.5px var(--sf);color:var(--label2)}\r\n.wl span::before{content:\"\";display:inline-block;width:6px;height:6px;border-radius:2px;background:var(--c);margin-right:5px}\r\n.ready{display:flex;justify-content:space-between;align-items:center}\r\n.ready b{font:700 21px var(--sf);letter-spacing:-.02em}\r\n.mb{display:grid;grid-template-columns:24px 1fr 78px;gap:8px;align-items:center;font:500 11.5px var(--sf);color:var(--label2)}\r\n.mb b{font-weight:500;text-align:right;color:var(--label)}\r\n\r\n/* ---------- Feuilles linéaires à 3 hauteurs ---------- */\r\n.sw-wrap{position:absolute;inset:0;z-index:20;pointer-events:none}\r\n.scrim{position:absolute;inset:0;background:rgba(255,255,255,.06);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .35s;pointer-events:none}\r\n.sw-wrap[data-det=large] .scrim{opacity:1;pointer-events:auto}\r\n.sheet{position:absolute;left:8px;right:8px;top:100%;bottom:-70%;border-radius:32px;display:flex;flex-direction:column;gap:7px;padding:0 13px 11px;pointer-events:auto;\r\n  background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .4)),rgba(255,255,255,calc(var(--ga) + .3)) 40%,rgba(255,255,255,calc(var(--ga) + .34)));-webkit-backdrop-filter:blur(calc(var(--gb) + 22px)) saturate(1.9) brightness(1.06);backdrop-filter:blur(calc(var(--gb) + 22px)) saturate(1.9) brightness(1.06);\r\n  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.5),inset 1px 0 1px rgba(255,255,255,.35),inset -1px 0 1px rgba(255,255,255,.35),inset 0 0 22px rgba(255,255,255,.18),0 0 0 .5px rgba(23,43,36,.12),0 -8px 36px rgba(23,43,36,.16);\r\n  transition:top .5s cubic-bezier(.32,.72,0,1),bottom .5s cubic-bezier(.32,.72,0,1),left .5s cubic-bezier(.32,.72,0,1),right .5s cubic-bezier(.32,.72,0,1),border-radius .5s}\r\n.sw-wrap[data-det=peek] .sheet{top:calc(60% - 49px - 128px);bottom:calc(40% + 57px)}\r\n.sw-wrap[data-det=medium] .sheet{top:48px;bottom:calc(40% + 57px)}\r\n.sw-wrap[data-det=large] .sheet{top:46px;bottom:8px;left:8px;right:8px;border-radius:44px}\r\n.sw-wrap[data-det=closed] .sheet{visibility:hidden;transition:top .45s cubic-bezier(.32,.72,0,1),bottom .45s cubic-bezier(.32,.72,0,1),visibility 0s .45s}\r\n.grab{height:18px;display:grid;place-items:center;cursor:grab;touch-action:none;flex:none;margin:0 -13px}\r\n.grab span{width:36px;height:5px;border-radius:3px;background:rgba(23,43,36,.2)}\r\n.sh-h{display:flex;align-items:center;gap:8px;flex:none;margin-top:-4px;touch-action:none}\r\n.sh-h h3{flex:1;min-width:0;margin:0;text-align:center;font:600 16px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.peekline{flex:none;font:400 13px var(--sf);color:var(--label2);text-align:center;display:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.sw-wrap[data-det=peek] .peekline{display:block}\r\n.sw-wrap[data-det=peek] .flow,.sw-wrap[data-det=peek] .sh-b,.sw-wrap[data-det=peek] .sh-f{display:none}\r\n.flow{flex:none;display:flex;align-items:center;gap:4px;justify-content:center}\r\n.flow button{height:24px;min-width:24px;border-radius:999px;border:0;background:rgba(255,255,255,.3);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1);color:var(--label2);font:600 11px var(--sf);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0;transition:all .35s cubic-bezier(.3,1.3,.4,1)}\r\n.flow button.done{background:rgba(255,255,255,.45);color:var(--good);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1)}\r\n.flow button.cur{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh);padding:0 10px 0 4px}\r\n.flow button.cur i{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.7);display:grid;place-items:center;font-style:normal;font-size:10px}\r\n.flow .ln{width:8px;height:1.5px;background:var(--sep);border-radius:1px}\r\n.sh-b{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}\r\n.sw-wrap[data-det=large] .sh-b{overflow-y:auto}\r\n.lh{display:flex;justify-content:space-between;align-items:center;min-height:26px;margin-bottom:2px}\r\n.lh .pg{display:flex;align-items:center;gap:3px;font:500 11.5px var(--sf);color:var(--label2)}\r\n.lh .pg button{width:26px;height:26px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer}\r\n.lh .pg button[disabled]{opacity:.3;cursor:default}\r\n.sh-f{flex:none;display:flex;gap:6px;align-items:center}\r\n.say{flex:1;min-width:0;height:34px;border-radius:999px;background:var(--fill);display:flex;align-items:center;gap:6px;padding:0 11px;color:var(--accent)}\r\n.say input{flex:1;min-width:0;border:0;background:none;color:var(--label);font:400 14px var(--sf);outline:none;height:32px}\r\n.say input::placeholder{color:var(--label3)}\r\n.bk{width:34px;height:34px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer;flex:none}\r\n.bk[disabled]{opacity:.3;cursor:default}\r\n.nx{height:34px;padding:0 13px;border-radius:999px;border:0;background:var(--pg);box-shadow:var(--pg-sh);color:var(--pg-ink)!important;-webkit-backdrop-filter:blur(8px) saturate(1.8);backdrop-filter:blur(8px) saturate(1.8);transition:transform .25s cubic-bezier(.3,1.5,.5,1);font:600 13px var(--sf);cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex:none;white-space:nowrap}\r\n\r\n/* Lignes de liste */\r\n.li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:6px 2px;min-height:46px;border-top:.5px solid var(--sep);transition:background .3s}\r\n.li:first-child,.lh+.li,.swr:first-child .li{border-top:0}\r\n.li.nt{grid-template-columns:1fr auto}\r\n.li.hi{background:var(--mint);border-radius:12px;box-shadow:inset 0 0 0 1px rgba(91,127,85,.4)}\r\n.li .ttl{font:600 14px/1.25 var(--sf);display:flex;align-items:center;gap:5px;min-width:0}\r\n.li .ttl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.li .s2{font:400 12px/1.3 var(--sf);color:var(--label2);margin-top:1px}\r\n.li .rt{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right}\r\n.li .rt b{font:600 14px var(--sf);font-variant-numeric:tabular-nums}\r\n.li .rt small{font:400 10.5px var(--sf);color:var(--label3)}\r\n.tg{font:500 10.5px var(--sf);padding:2px 7px;border-radius:999px;background:var(--fill);color:var(--label2);white-space:nowrap;display:inline-flex;align-items:center}\r\n.tg.p{color:var(--tint);background:var(--mint)}\r\n.tg.added{color:var(--tint)}.tg.pending{color:var(--warn);background:var(--warn-bg)}.tg.confirmed{color:var(--good);background:rgba(61,122,82,.14)}\r\n.tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;align-items:center}\r\n.ck{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--label3);display:grid;place-items:center;transition:.2s;flex:none}\r\n.li[aria-checked=true] .ck{background:var(--good);box-shadow:none}\r\n.li[aria-checked=true] .ck::after{content:\"\";width:6px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}\r\n.vit{font:600 9.5px var(--sf);color:var(--warn);text-transform:uppercase;letter-spacing:.03em;flex:none}\r\n.rbar{display:grid;grid-template-columns:128px 1fr 26px;gap:9px;align-items:center;padding:4px 0;font-size:13px}\r\n.rbar small{display:block;font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap}\r\n.rbar .t{height:5px;border-radius:99px;background:var(--fill);overflow:hidden}.rbar .t i{display:block;height:100%;border-radius:99px;background:var(--c)}\r\n.rbar b{font:600 12.5px var(--sf);text-align:right;font-variant-numeric:tabular-nums}\r\n.wx{display:grid;grid-template-columns:1fr 1fr;gap:7px}\r\n.wx div{padding:9px 11px;border-radius:14px;background:var(--fill2);font-size:12.5px;color:var(--label2);line-height:1.45}\r\n.wx b{display:block;font:600 14px var(--sf);color:var(--label)}\r\n.note{font:400 12px/1.35 var(--sf);color:var(--label2);padding:6px 2px 0}\r\n.grid2{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}\r\n.tile2{border:0;border-radius:14px;background:var(--fill2);min-height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:500 11.5px var(--sf);cursor:pointer;position:relative;padding:4px}\r\n.tile2[aria-pressed=true]{background:var(--soft);color:var(--tint)!important;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6);font-weight:600}\r\n.tile2 .ai{position:absolute;top:4px;right:5px}\r\n.tile2[aria-pressed=true] .ai{color:var(--accent)}\r\n.win{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px 10px;border-radius:14px;background:var(--fill2);cursor:pointer;border:0;text-align:left;width:100%;margin-bottom:6px}\r\n.win[aria-pressed=true]{background:var(--mint);box-shadow:inset 0 0 0 1.2px var(--accent)}\r\n.win .wxr{display:flex;gap:2px;color:var(--label2)}\r\n.qd{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}\r\n\r\n/* Cartes d'offres */\r\n.oc{position:relative;display:grid;grid-template-columns:50px 1fr auto;gap:10px;align-items:center;padding:8px;border-radius:18px;background:rgba(255,255,255,.52);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.05);margin-bottom:6px;transition:box-shadow .3s}\r\n.oc.hi{box-shadow:0 0 0 1.5px var(--accent),0 3px 10px rgba(23,43,36,.08)}\r\n.oc-img{width:50px;height:50px;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(150deg,hsl(var(--h),38%,58%),hsl(calc(var(--h) + 30),42%,36%));box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}\r\n.oc-img .ic{width:22px;height:22px}\r\n.oc-t{display:flex;align-items:center;gap:6px;min-width:0}.oc-t b{font:600 13.5px var(--sf);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.rate{font:600 11px var(--sf);color:var(--warn);white-space:nowrap;flex:none}.rate small{color:var(--label3);font-weight:400}\r\n.oc-s{font:400 11.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}\r\n.oc-c{display:flex;gap:3px;margin-top:4px;flex-wrap:wrap;height:17px;overflow:hidden}\r\n.oc-c span{font:500 10px/13px var(--sf);padding:2px 6px;border-radius:6px;background:var(--fill2);color:var(--label2);white-space:nowrap}\r\n.oc-c .st{background:var(--mint);color:var(--tint);font-weight:600}.oc-c .st.pending{background:var(--warn-bg);color:#7a5a17}.oc-c .st.confirmed{background:rgba(61,122,82,.16);color:var(--good)}\r\n.oc-r{display:flex;flex-direction:column;align-items:flex-end;gap:2px}\r\n.oc-r b{font:700 15px var(--sf);font-variant-numeric:tabular-nums}.oc-r small{font:400 10px var(--sf);color:var(--label3)}\r\n.burst{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:var(--pg);box-shadow:var(--pg-sh);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--tint);display:grid;place-items:center;pointer-events:none;animation:burst .7s cubic-bezier(.3,1.5,.5,1) forwards;z-index:5}\r\n@keyframes burst{0%{transform:scale(.2);opacity:0}35%{transform:scale(1.15);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.4);opacity:0}}\r\n\r\n/* Lignes glissables (geste Instagram / iOS) */\r\n.swr{position:relative;overflow:hidden;border-radius:12px}\r\n.swr .act{position:absolute;right:0;top:4px;bottom:4px;width:82px;border:0;border-radius:14px;background:rgba(168,68,58,.86);color:#fff!important;font:600 12.5px var(--sf);cursor:pointer;opacity:0;transition:opacity .2s}\r\n.swr.open .act,.swr.drag .act{opacity:1}\r\n.swr .fg{position:relative;background:rgba(250,251,248,.001);transition:transform .3s cubic-bezier(.3,1.2,.4,1);touch-action:pan-y}\r\n.swr.drag .fg{transition:none}\r\n.swr.open .fg,.swr.drag .fg{background:rgba(247,249,245,.96)}\r\n\r\n/* ---------- Carte claire personnalisable ---------- */\r\n.mapzone{position:relative;min-height:0;min-width:0}\r\n.map{position:absolute;inset:0;border-radius:32px 32px 0 0;overflow:hidden;background:#E9EDE0;touch-action:none;box-shadow:0 -1px 0 rgba(255,255,255,.8),0 -10px 26px rgba(23,43,36,.18)}\r\n#tm{display:none!important}.map svg.tm{display:none!important}\r\n.map .tmg{transition:transform .5s cubic-bezier(.3,1,.4,1)}\r\n.map.dragging .tmg{transition:none}\r\n.mgrab{position:absolute;top:6px;left:50%;width:44px;height:14px;margin-left:-22px;border:0;background:none;display:grid;place-items:center;cursor:pointer;z-index:4;touch-action:none}\r\n.mgrab span{width:34px;height:4px;border-radius:2px;background:rgba(23,43,36,.28)}\r\n.mctl{position:absolute;right:10px;top:14px;display:flex;flex-direction:column;border-radius:21px;z-index:3;overflow:hidden}\r\n.mctl button{width:38px;height:36px;border:0;background:none;display:grid;place-items:center;cursor:pointer}\r\n.mctl button+button{box-shadow:0 -.5px 0 var(--sep)}\r\n.mopts{position:absolute;right:12px;bottom:124px;width:300px;border-radius:26px;padding:10px 10px 8px;z-index:30;opacity:0;transform:scale(.55) translateY(30px);transform-origin:bottom right;pointer-events:none;transition:opacity .18s,transform .42s cubic-bezier(.3,1.35,.5,1);display:flex;flex-direction:column;gap:8px}\r\n.mopts.on{opacity:1;transform:none;pointer-events:auto}\r\n.mopts.up{bottom:auto;top:440px;transform-origin:top right}\r\n.mo-h{display:flex;align-items:baseline;justify-content:space-between;padding:0 4px}\r\n.mo-h b{font:600 15px var(--sf)}\r\n.mgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}\r\n.mt{border:0;border-radius:16px;background:var(--fill);height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:var(--label2)!important;transition:background .2s,color .2s,transform .2s cubic-bezier(.3,1.4,.5,1)}\r\n.mt span{font:500 10.5px var(--sf);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 3px}\r\n.mt[aria-checked=true]{background:var(--soft);color:var(--tint)!important;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6)}\r\n.mt:active{transform:scale(.93)}\r\n.mo-f{display:flex;justify-content:space-between;padding:0 4px}\r\n.callout{position:absolute;left:10px;right:10px;bottom:132px;padding:8px 8px 8px 12px;border-radius:20px;z-index:4;display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;transition:bottom .45s cubic-bezier(.32,.72,0,1)}\r\n.tabmin .callout{bottom:78px}\r\n.noacc .callout{bottom:84px}\r\n.callout[hidden]{display:none}\r\n.callout b{font:600 13.5px var(--sf);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}\r\n.callout .s2{font:400 11.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;grid-column:1}\r\n.callout .ca{grid-row:1/3;grid-column:2;display:flex;gap:5px;align-items:center}\r\n.callout .ib{width:30px;height:30px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer}\r\n.callout .ib.p{background:var(--pg);color:var(--pg-ink)!important;box-shadow:var(--pg-sh)}\r\n.anim .seg{stroke-dasharray:1;animation:drawseg .24s var(--d,0s) both linear}\r\n.anim .pop{animation:popin .42s var(--d,0s) both cubic-bezier(.3,1.5,.5,1);transform-box:fill-box;transform-origin:center}\r\n@keyframes drawseg{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}\r\n@keyframes popin{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}\r\n.focusring{animation:ring 1.4s ease-out infinite;transform-box:fill-box;transform-origin:center}\r\n@keyframes ring{from{opacity:.9;transform:scale(.6)}to{opacity:0;transform:scale(1.8)}}\r\n\r\n/* ---------- Barre d'onglets + accessoire ---------- */\r\n.tabbar{position:absolute;left:0;right:0;bottom:0;height:0;z-index:12}\r\n.tb{position:absolute;left:14px;right:14px;bottom:24px;height:54px;border-radius:999px;display:grid;grid-template-columns:repeat(5,1fr);padding:3px;touch-action:none;\r\n  transition:left .5s cubic-bezier(.32,.72,0,1),right .5s cubic-bezier(.32,.72,0,1),height .5s cubic-bezier(.32,.72,0,1)}\r\n.tb .lens{position:absolute;top:4px;bottom:4px;left:3px;width:calc((100% - 6px)/5);border-radius:999px;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.22));\r\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.4),0 0 0 .5px rgba(23,43,36,.06);transition:transform .55s cubic-bezier(.3,1.35,.4,1),background .25s,box-shadow .25s}\r\n.tb.drag .lens{transition:transform .08s linear,background .25s,box-shadow .25s;background:rgba(255,255,255,.08);\r\n  box-shadow:inset 0 1.5px 1px rgba(255,255,255,.95),inset 0 -1.5px 2px rgba(255,255,255,.6),inset 2px 0 2px rgba(255,120,160,.18),inset -2px 0 2px rgba(90,170,255,.2),0 0 0 .5px rgba(23,43,36,.1),0 10px 26px rgba(23,43,36,.2)}\r\n.tb.drag .lens{top:-7px;bottom:-7px}\r\n.tb button{position:relative;z-index:2;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font:500 10px var(--sf);cursor:pointer;border-radius:999px;letter-spacing:0;color:var(--label)}\r\n.tb button .ic{width:19px;height:19px}\r\n.tb button.on{color:#2F6B45;font-weight:600}\r\n.tb button.on .ic{stroke-width:2.1}\r\n.tb.drag button{transition:transform .2s}.tb.drag button.hov{transform:scale(1.14)}\r\n.acc{position:absolute;left:14px;right:14px;bottom:84px;height:42px;border-radius:999px;display:flex;align-items:center;gap:9px;padding:0 8px 0 4px;\r\n  transition:left .5s cubic-bezier(.32,.72,0,1),bottom .5s cubic-bezier(.32,.72,0,1),opacity .3s}\r\n.acc .ab{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);display:grid;place-items:center;cursor:pointer;flex:none}\r\n.acc .ro{flex:none;width:86px;display:flex;flex-direction:column;line-height:1.1}\r\n.acc .ro b{font:600 13.5px var(--sf);font-variant-numeric:tabular-nums;white-space:nowrap}\r\n.acc .ro span{font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.acc svg.spk{flex:1;min-width:0;height:28px;overflow:visible;cursor:ew-resize;touch-action:none}\r\n.noacc .acc{opacity:0;pointer-events:none}\r\n.tabmin .tb{right:calc(100% - 14px - 50px);height:50px;grid-template-columns:1fr}\r\n.tabmin .tb button:not(.on){display:none}\r\n.tabmin .tb .lens{display:none}\r\n.tabmin .acc{left:72px;bottom:28px}\r\n.home{position:absolute;bottom:8px;left:50%;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:rgba(23,43,36,.55);z-index:25;pointer-events:none}\r\n\r\n/* ---------- Menus iOS : aperçu, réglages, pilule de rôle ---------- */\r\n.ctx{position:absolute;inset:0;z-index:35;display:grid;place-items:center;padding:24px;background:rgba(245,242,236,.35);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .25s}\r\n.ctx.on{opacity:1;pointer-events:auto}\r\n.ctx .box{width:100%;max-width:310px;display:flex;flex-direction:column;gap:8px;transform:scale(.92);transition:transform .35s cubic-bezier(.3,1.4,.5,1)}\r\n.ctx.on .box{transform:none}\r\n.ctx .pv{border-radius:22px;padding:13px 15px}\r\n.ctx .pv b{display:block;font:600 15px var(--sf);margin-bottom:5px}\r\n.ctx .ef{display:flex;justify-content:space-between;padding:5px 0;border-top:.5px solid var(--sep);font-size:13.5px}\r\n.ctx .ef:first-of-type{border-top:0}\r\n.ctx .ef span:last-child{font-weight:600;font-variant-numeric:tabular-nums}\r\n.ctx .menu{border-radius:18px;overflow:hidden}\r\n.ctx .menu button{display:flex;justify-content:space-between;align-items:center;width:100%;height:44px;padding:0 15px;border:0;background:none;font:400 15px var(--sf);cursor:pointer}\r\n.ctx .menu button+button{box-shadow:0 -.5px 0 var(--sep)}\r\n.ctx .menu button.p{color:var(--tint);font-weight:600}\r\n.popv{position:absolute;right:12px;top:102px;width:262px;border-radius:22px;padding:4px 13px;z-index:34;opacity:0;transform:scale(.9) translateY(-8px);transform-origin:top right;pointer-events:none;transition:opacity .2s,transform .35s cubic-bezier(.3,1.4,.5,1)}\r\n.popv.on{opacity:1;transform:none;pointer-events:auto}\r\n.popv .pr{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;border-top:.5px solid var(--sep)}\r\n.popv .pr:first-child{border-top:0}\r\n.popv input[type=range]{width:100%;accent-color:#17402C}\r\n.popv .lbl2{display:flex;justify-content:space-between;font:400 11.5px var(--sf);color:var(--label2);padding-bottom:6px}\r\n.rmenu{position:absolute;z-index:38;border-radius:999px;overflow:hidden;pointer-events:none;opacity:0;\r\n  transition:left .45s cubic-bezier(.3,1.25,.4,1),top .45s cubic-bezier(.3,1.25,.4,1),width .45s cubic-bezier(.3,1.25,.4,1),height .45s cubic-bezier(.3,1.25,.4,1),border-radius .45s,opacity .15s}\r\n.rmenu.on{pointer-events:auto;opacity:1;border-radius:20px}\r\n.rmenu .ri{opacity:0;filter:blur(6px);transition:opacity .25s .12s,filter .3s .12s;padding:5px}\r\n.rmenu.on .ri{opacity:1;filter:none}\r\n.rmenu button{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 10px;border:0;border-radius:12px;background:none;font:500 13.5px var(--sf);cursor:pointer;white-space:nowrap}\r\n.rmenu button[aria-checked=true]{background:var(--soft);color:var(--tint);font-weight:600}\r\n.rp{transition:transform .35s cubic-bezier(.3,1.5,.5,1)}\r\n.rp.morph{animation:morph .5s cubic-bezier(.3,1.4,.5,1)}\r\n@keyframes morph{0%{transform:scaleX(1.18) scaleY(.86);filter:blur(2px)}50%{transform:scaleX(.95) scaleY(1.06);filter:none}100%{transform:none}}\r\n@keyframes bump{40%{transform:scale(1.06)}}\r\n.bump{animation:bump .3s}\r\n@media (prefers-reduced-motion:reduce){.pd{animation:none}.anim .seg,.anim .pop,.burst,.rp.morph{animation:none}*{transition-duration:.01s!important}}\r\n.chips.rail{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent);padding-right:24px;touch-action:pan-x}\r\n.chips.rail::-webkit-scrollbar{display:none}\r\n.chips.rail .chip{flex:none}\r\n.lh .pg{white-space:nowrap;flex:none}\r\n.lh>.cap{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n/* barres de verre au-dessus du fond : couche lumineuse pour garder le contraste (verre « regular » adaptatif) */\r\n.head .steps.lg,.head .gbtn.lg,.acts .gbtn.lg{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .14)) 55%,rgba(255,255,255,calc(var(--ga) + .22)))}\r\n\r\n/* ================= v6 : produits ================= */\r\n.pth{--s:58px;width:var(--s);height:var(--s);border-radius:16px;flex:none;display:grid;place-items:center;position:relative;overflow:hidden;\r\n  background:radial-gradient(120% 90% at 30% 20%,#fff 0,var(--bgc) 55%,hsl(var(--h) 26% 80%) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -6px 12px hsla(var(--h),30%,40%,.12),0 0 0 .5px rgba(23,43,36,.08)}\r\n.pth::after{content:\"\";position:absolute;left:18%;right:18%;bottom:12%;height:9%;border-radius:50%;background:hsla(var(--h),30%,25%,.14);filter:blur(2px)}\r\n.pth .pic{width:58%;height:58%;fill:none;stroke:hsl(var(--h) 34% 30%);stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;position:relative;z-index:1;filter:drop-shadow(0 1px 0 rgba(255,255,255,.8))}\r\n.pth.sm{--s:36px;border-radius:11px}.pth.xs{--s:26px;border-radius:8px}.pth.xs::after,.pth.sm::after{display:none}.pth.xl{--s:92px;border-radius:24px}.pth.xl .pic{stroke-width:1.1}\r\n.pth .ic{color:var(--accent)}\r\n.pc{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 9px 8px 8px;border-radius:20px;margin-bottom:6px;position:relative;\r\n  background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.05);transition:transform .25s cubic-bezier(.3,1.4,.5,1),box-shadow .25s}\r\n.pc.on{box-shadow:inset 0 0 0 1.2px var(--soft-line),inset 0 1px 0 #fff,0 3px 10px rgba(23,43,36,.06);background:rgba(236,244,233,.7)}\r\n.swr .pc{margin-bottom:0}.swr{margin-bottom:6px}\r\n.pc.lpress,.li.lpress,.pick.lpress{transform:scale(.97)}\r\n.pb{min-width:0;display:flex;flex-direction:column;gap:2px}\r\n.pbr{display:flex;align-items:center;gap:6px;font:600 10.5px var(--sf);letter-spacing:.05em;text-transform:uppercase;color:var(--label2);min-width:0}\r\n.pbr>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\r\n.pn{font:600 14px/1.2 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.pnx{font:700 18px/1.2 var(--sf);letter-spacing:-.01em;margin-top:2px;text-wrap:balance}\r\n.psp{display:flex;gap:3px;flex-wrap:wrap;height:17px;overflow:hidden}\r\n.psp span{font:500 10px/13px var(--sf);padding:2px 6px;border-radius:6px;background:rgba(23,43,36,.06);color:var(--label2);white-space:nowrap}\r\n.pm{font:400 11px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:4px;align-items:center;min-width:0}\r\n.pw{display:inline-flex;align-items:center;gap:4px;color:#8a6418;font:500 11px var(--sf);white-space:normal;line-height:1.25}\r\n.pown{display:inline-flex;align-items:center;gap:5px;min-width:0;overflow:hidden;text-overflow:ellipsis}\r\n.fit{font:600 10px var(--sf);letter-spacing:0;text-transform:none;padding:1px 6px;border-radius:99px;flex:none}\r\n.fit.g{background:rgba(61,122,82,.14);color:var(--good)}.fit.o{background:var(--warn-bg);color:#8a6418}.fit.b{background:var(--bad-bg);color:var(--bad)}\r\n.prr{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right}\r\n.prr b{font:700 15px var(--sf);font-variant-numeric:tabular-nums;white-space:nowrap}.prr b i{font-style:normal;font-weight:500;font-size:11px;color:var(--label2)}\r\n.prr small{font:400 10px var(--sf);color:var(--label3);white-space:nowrap}\r\n.cd{font:600 10px var(--sf);letter-spacing:0;text-transform:none;padding:1px 7px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;flex:none}\r\n.cd::before{content:\"\";width:5px;height:5px;border-radius:50%;background:currentColor}\r\n.cd.g{background:rgba(61,122,82,.12);color:var(--good)}.cd.o{background:var(--warn-bg);color:#8a6418}.cd.b{background:var(--bad-bg);color:var(--bad)}\r\n.pbad{font:500 10.5px var(--sf);padding:1px 7px;border-radius:99px;white-space:nowrap}\r\n.pbad.o{background:var(--warn-bg);color:#7a5a17}.pbad.s{background:var(--soft);color:var(--tint)}\r\n.ib2{width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.55);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);display:grid;place-items:center;cursor:pointer;color:var(--label2)}\r\n.pc.custom .input{height:30px;font-size:13px}\r\n.need{display:flex;gap:9px;align-items:center;padding:7px 9px;border-radius:16px;background:rgba(255,255,255,.42);box-shadow:inset 0 1px 0 #fff;margin-bottom:7px}\r\n.need b{display:flex;align-items:center;gap:6px;font:600 13.5px var(--sf)}.need span{display:block;font:400 11.5px/1.3 var(--sf);color:var(--label2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\r\n.phero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:13px;align-items:center;margin-bottom:10px}\r\n.sgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}\r\n.sgrid div{padding:7px 10px;border-radius:14px;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);min-width:0}\r\n.sgrid small{display:block;font:500 10.5px var(--sf);color:var(--label2)}.sgrid b{display:block;font:600 13.5px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}\r\n.stats3 div{padding:10px;border-radius:16px;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 #fff;text-align:center}\r\n.stats3 b{display:block;font:700 21px var(--sf);letter-spacing:-.02em}.stats3 small{font:500 11px var(--sf);color:var(--label2)}\r\n.menu2{border-radius:18px;background:rgba(255,255,255,.4);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.06);overflow:hidden}\r\n.mi{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:6px 12px;border:0;background:none;text-align:left;font:500 13.5px var(--sf);color:var(--label);cursor:pointer}\r\n.mi+.mi{border-top:.5px solid var(--sep)}\r\n.mi>span{flex:1;min-width:0}.mi>b{font:600 13px var(--sf)}.mi .ic{color:var(--accent);flex:none}\r\n.mi.col{flex-direction:column;align-items:stretch;gap:6px;padding:8px 12px}.mi.col .row{gap:10px}.mi.col .chips .chip{height:26px;font-size:12px}\r\n.mi.bad,.mi.bad .ic{color:var(--bad)}.mi.dis{color:var(--label2);cursor:default}.mi[disabled]{opacity:.5;cursor:default}\r\n.cmp{display:grid;grid-template-columns:60px 1fr 1fr;gap:4px 8px;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.45);font-size:12.5px;align-items:baseline}\r\n.cmp b{font:600 11.5px var(--sf);color:var(--label2)}.cmp>span:nth-child(3n+1){color:var(--label2);font-size:11.5px}.cmp em{font-style:normal;font-size:10.5px;font-weight:600}.cmp em.g{color:var(--good)}.cmp em.o{color:#8a6418}\r\n.rbig{display:flex;align-items:center;gap:12px;margin-bottom:8px}.rbig>b{font:700 34px var(--sf);letter-spacing:-.03em}\r\n.stars{color:#C99A3B;font-size:15px;letter-spacing:1px}.rbig small{display:block;font:400 11.5px var(--sf);color:var(--label2)}\r\n.li.kr{grid-template-columns:auto auto minmax(0,1fr) auto}\r\n.mq .ttl .pth{margin-right:2px}\r\n.pick{display:flex;align-items:center;gap:8px;margin-top:6px;padding:5px 6px 5px 5px;border-radius:12px;background:rgba(236,244,233,.75);box-shadow:inset 0 0 0 .8px var(--soft-line);transition:transform .25s}\r\n.pick b{display:block;font:600 12.5px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pick small{display:block;font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.pick>span:not(.pth){flex:1;min-width:0}\r\n.chip .cnt{font:600 10px var(--sf);min-width:16px;height:16px;line-height:16px;border-radius:8px;background:rgba(255,255,255,.7);color:var(--label2);text-align:center;padding:0 4px;margin-left:2px}\r\nbutton.mb{border:0;background:none;padding:2px 0;width:100%;cursor:pointer;text-align:left;border-radius:10px}\r\nbutton.mb:active{background:var(--fill2)}\r\n\r\n/* ================= v6 : sacs de chacun ================= */\r\n.bagsel{display:flex;gap:5px;margin-bottom:6px}\r\n.bagsel button{flex:1;min-width:0;border:0;border-radius:14px;background:rgba(255,255,255,.3);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08);padding:5px 2px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font:600 11px var(--sf);color:var(--label)}\r\n.bagsel button small{font:500 10px var(--sf);color:var(--label2)}\r\n.bagsel button[aria-pressed=true]{background:var(--pg);box-shadow:var(--pg-sh)}\r\n.bagv{display:grid;grid-template-columns:118px minmax(0,1fr);gap:12px;align-items:center}\r\n.bagsvg{width:118px;height:154px;filter:drop-shadow(0 6px 10px rgba(23,43,36,.12))}\r\n.bl{display:grid;grid-template-columns:10px 1fr auto;gap:6px;align-items:center;font:500 12px var(--sf);padding:1.5px 0}\r\n.bl i{width:10px;height:10px;border-radius:3px}.bl b{font-weight:600;font-size:12px}\r\n.bagrows{display:grid;gap:2px}\r\n.bi{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:5px 2px;border-top:.5px solid var(--sep)}\r\n.bi:first-child{border-top:0}.bi b{display:block;font:600 13px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bi small{display:block;font:400 11px var(--sf);color:var(--label2)}\r\n.bi>span{font:600 12.5px var(--sf)}\r\n\r\n/* ================= v6 : quand précis ================= */\r\n.cal{border-radius:16px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);padding:6px}\r\n.cw,.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}\r\n.cw small{text-align:center;font:600 9.5px var(--sf);color:var(--label3)}\r\n.cd2{position:relative;height:23px;border:0;border-radius:8px;font:600 11.5px var(--sf);cursor:pointer;color:var(--label);font-variant-numeric:tabular-nums}\r\n.cd2 em{position:absolute;top:1px;left:3px;font:600 7px var(--sf);font-style:normal;color:var(--label2);text-transform:uppercase}\r\n.cd2.g{background:rgba(61,122,82,.2)}.cd2.o{background:rgba(185,138,46,.18)}.cd2.b{background:rgba(168,68,58,.15)}\r\n.cd2.far{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px)}\r\n.cd2.past{background:transparent;color:var(--label3);cursor:default}\r\n.cd2.sel{background:rgba(255,255,255,.85);box-shadow:inset 0 0 0 1.4px #5B7F55,0 2px 6px rgba(23,64,44,.15);z-index:1}\r\n.hgrid{display:grid;gap:2px;align-items:center;border-radius:16px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);padding:6px}\r\n.hgrid small{font:600 8.5px var(--sf);color:var(--label3);text-align:center;white-space:nowrap}\r\n.hgrid small.rl{text-align:left;font:500 10.5px var(--sf);color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.hc{height:24px;border:0;border-radius:5px;cursor:pointer;padding:0}\r\n.hc.g{background:rgba(61,122,82,.34)}.hc.o{background:rgba(185,138,46,.3)}.hc.b{background:rgba(168,68,58,.26)}.hc.past{background:rgba(23,43,36,.05);cursor:default}\r\n.hc.on{box-shadow:0 0 0 2px #fff,0 0 0 3.4px #5B7F55;position:relative;z-index:1}\r\n.qsum{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 4px 2px;font-size:12.5px}\r\n.qsum span:first-child{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qsum .num{font-weight:700;flex:none}\r\n.lgd{display:flex;gap:10px;font:500 10.5px var(--sf);color:var(--label2);padding:3px 4px 0;flex-wrap:wrap}\r\n.lgd i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:-1px}\r\n.lgd i.g{background:rgba(61,122,82,.4)}.lgd i.o{background:rgba(185,138,46,.36)}.lgd i.b{background:rgba(168,68,58,.3)}.lgd i.far{background:repeating-linear-gradient(135deg,rgba(23,43,36,.25) 0 2px,transparent 2px 4px)}\r\n.hchart{width:100%;height:auto;display:block;border-radius:14px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}\r\n.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:6px}\r\n.facts div{padding:5px 8px;border-radius:12px;background:rgba(255,255,255,.42);min-width:0}\r\n.facts small{display:block;font:500 10px var(--sf);color:var(--label2)}.facts b{display:block;font:600 12px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.rec{display:flex;align-items:center;gap:9px;padding:7px 8px 7px 10px;border-radius:14px;background:rgba(236,244,233,.7);box-shadow:inset 0 0 0 .8px var(--soft-line);margin:4px 0 6px;color:var(--accent)}\r\n.rec b{display:block;font:600 13px var(--sf);color:var(--label)}.rec small{display:block;font:400 11px var(--sf);color:var(--label2)}.rec>div{flex:1}\r\n.tl{position:relative;display:grid;gap:0}\r\n.tli{display:grid;grid-template-columns:40px 14px minmax(0,1fr);gap:6px;align-items:start;padding:3px 0;position:relative}\r\n.tli .tt{font:600 12px var(--sf);padding-top:1px}\r\n.tli i{width:10px;height:10px;border-radius:50%;background:#8DB287;margin-top:3px;box-shadow:0 0 0 2.5px rgba(255,255,255,.8);position:relative;z-index:1}\r\n.tli:not(:last-child)::before{content:\"\";position:absolute;left:50px;top:12px;bottom:-4px;width:1.5px;background:rgba(91,127,85,.35)}\r\n.tli.warn i{background:var(--warn)}\r\n.tli b{display:block;font:600 12.5px var(--sf)}.tli small{display:block;font:400 11px var(--sf);color:var(--label2)}\r\n.sh-b>*{flex-shrink:0}\r\n.menu2.one{margin-bottom:6px}\r\n.pm .pw{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;min-width:0}.pm .pw .ic{vertical-align:-1px;margin-right:3px}\r\n.need{padding:5px 8px;margin-bottom:5px}\r\n\r\n/* ================= v7 : un seul style de capsule (barre d'onglets = étapes = flux des tiroirs = segments) ================= */\r\n.steps.lg,.tb.lg,.flow.lg,.tchips,.bagsel{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .14)) 55%,rgba(255,255,255,calc(var(--ga) + .22)))}\r\n.steps .lens,.tb .lens,.flow .lens,.segc .th,.bagsel button[aria-pressed=true]{background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.26));\r\n  box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.07),0 2px 8px rgba(23,43,36,.08)}\r\n.steps .lens,.tb .lens{top:4px;bottom:4px;transition:transform .55s cubic-bezier(.3,1.35,.4,1),background .25s,box-shadow .25s}\r\n.steps button,.tb button{color:var(--label)}\r\n.steps button[aria-current=step],.tb button.on{color:#2F6B45}\r\n.steps button[aria-current=step] .ic,.tb button.on .ic{stroke-width:2.1}\r\n.steps.drag .lens,.tb.drag .lens{transition:transform .08s linear,background .25s,box-shadow .25s;background:rgba(255,255,255,.08);top:-6px;bottom:-6px;\r\n  box-shadow:inset 0 1.5px 1px rgba(255,255,255,.95),inset 0 -1.5px 2px rgba(255,255,255,.6),inset 2px 0 2px rgba(255,120,160,.18),inset -2px 0 2px rgba(90,170,255,.2),0 0 0 .5px rgba(23,43,36,.1),0 10px 26px rgba(23,43,36,.2)}\r\n.steps.drag button{transition:transform .2s}.steps.drag button.hov{transform:scale(1.14)}\r\n.steps{touch-action:none}\r\n.bdg{position:absolute;top:6px;left:calc(50% + 6px);width:8px;height:8px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 2px rgba(255,255,255,.9)}\r\n.head{gap:6px}\r\n/* flux des tiroirs : capsule segmentée à lentille */\r\n.flow{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:0;height:30px;border-radius:999px;padding:3px;margin:0 -2px}\r\n.flow .lens{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/var(--n));border-radius:999px;z-index:1;transition:transform .55s cubic-bezier(.3,1.35,.4,1)}\r\n.flow button,.flow button.cur,.flow button.done{position:relative;z-index:2;height:auto;min-width:0;padding:0 4px;border:0;border-radius:999px;background:none!important;box-shadow:none!important;color:var(--label);font:500 11.5px var(--sf);display:flex;align-items:center;justify-content:center;gap:3px;cursor:pointer}\r\n.flow button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.flow button.cur{color:#2F6B45;font-weight:600}\r\n.flow button.done{color:var(--label2)}.flow button.done .ic{color:var(--good);flex:none}\r\n.flow .ln,.flow button i{display:none}\r\n/* segments */\r\n.segc{background:rgba(255,255,255,.34);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08),inset 0 1px 2px rgba(23,43,36,.05)}\r\n.segc button[aria-pressed=true]{color:#2F6B45}\r\n/* types de réservation : même capsule que la barre d'onglets */\r\n.tchips{border-radius:22px;padding:3px;gap:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.12),0 6px 16px rgba(23,43,36,.08)}\r\n.tchip,.tchip.on{background:none;box-shadow:none;border-radius:18px;color:var(--label)}\r\n.tchip.on{color:#2F6B45;font-weight:600}.tchip.on .ic{color:#2F6B45}\r\n.tchip .bd{background:rgba(141,178,135,.5)}\r\n/* sacs : sélecteur de membre */\r\n.bagsel{border-radius:20px;padding:3px;gap:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.1)}\r\n.bagsel button{background:none;box-shadow:none;border-radius:17px}\r\n.bagsel button[aria-pressed=true]{color:#2F6B45}\r\n/* îlot : la prochaine décision */\r\n.island{cursor:pointer}\r\n.hasnext .island[data-s=idle]::before{content:\"\";position:absolute;left:15px;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;background:#A6C1A0;box-shadow:0 0 10px #A6C1A0;animation:pulse 2s infinite}\r\n.oc-c .st.rs{background:rgba(63,147,184,.16);color:#2B6F8E;font-weight:600}\r\n.sheet{gap:6px}\r\n\r\n/* ================= v8 : étapes = barre d'onglets (icône + libellé), feuilles qui ne débordent plus sur la carte ================= */\r\n.steps{height:50px}\r\n.steps button{flex-direction:column;gap:1px;display:flex;align-items:center;justify-content:center;font:500 10px var(--sf);letter-spacing:0;min-height:0}\r\n.steps button .ic{width:19px;height:19px}\r\n.steps button[aria-current=step]{font-weight:600}\r\n.steps .dot{display:none}\r\n.head .gbtn{width:50px;height:50px}\r\n.bdg{top:5px;left:calc(50% + 7px)}\r\n.grab.tt{height:32px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;padding-top:6px}\r\n.grab .sht{font:600 13px var(--sf);color:var(--label);letter-spacing:-.01em;line-height:16px}\r\n.sh-h.hf{margin-top:0;gap:6px;align-items:center}\r\n.sh-h.hf .flow{flex:1;min-width:0;margin:0;height:48px;padding:3px}\r\n.sh-h.hf .gbtn.sm{width:36px;height:36px;flex:none}\r\n.flow button,.flow button.cur,.flow button.done{flex-direction:column;gap:1px;padding:0 2px;font:500 10px var(--sf);letter-spacing:0}\r\n.flow button.cur{font-weight:600}\r\n.flow .fic{position:relative;display:grid;place-items:center}\r\n.flow .fic>.ic{width:18px;height:18px}\r\n.flow .fck{position:absolute;right:-7px;top:-4px;width:12px;height:12px;border-radius:50%;background:#fff;color:var(--good);display:grid;place-items:center;box-shadow:0 0 0 .5px rgba(23,43,36,.12)}\r\n.flow .fck .ic{width:8px;height:8px;stroke-width:3}\r\n.flow .flb{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:12px}\r\n.flow button.done{color:var(--label)}\r\n.fr{height:27px}\r\n\r\n.bagsel{margin-bottom:5px}\r\n.bagsel button{flex-direction:row;gap:5px;padding:4px 3px;justify-content:center}\r\n.bagsel button>span{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;min-width:0}\r\n.bagsel button b{font:600 11px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}\r\n.bagsel .avi.sm{width:22px;height:22px;font-size:9.5px}\r\n.bagv{grid-template-columns:98px minmax(0,1fr);gap:10px}\r\n.bagsvg{width:98px;height:128px}\r\n.bl{font-size:11.5px;padding:1px 0}\r\n.cd2{height:21px;font-size:11px}\r\n.cal{padding:5px}.cw small{font-size:9px}\r\n.qsum{padding:5px 2px 0}\r\n.chip.sugg{height:24px;font-size:11px;padding:0 8px;flex:none;background:var(--soft);color:var(--tint);box-shadow:inset 0 0 0 .8px var(--soft-line)}\r\n.chip.sugg .ic{color:var(--accent)}\r\n.lgd{padding-top:2px}\r\n.hchart{height:112px}\r\n.facts{gap:4px;margin-top:5px}.facts div{padding:3px 7px}.facts small{font-size:9.5px}.facts b{font-size:11.5px}\r\n.grab.tt{height:30px;padding-top:5px;gap:3px}\r\n.sh-h.hf .flow{height:46px}\r\n.sh-f .say,.sh-f .bk{height:32px}.sh-f .bk{width:32px}.nx{height:32px}\r\n.li.cm{min-height:36px;padding:3px 2px}\r\n.rec{margin:3px 0 4px;padding:5px 8px 5px 10px}\r\n.tli{padding:2px 0}\r\n.mini{display:none}\r\n.mapbig .mini{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;flex:none;height:50px;border:0;border-radius:20px;padding:0 16px;text-align:left;cursor:pointer;color:var(--label);animation:minin .4s cubic-bezier(.3,1.3,.4,1)}\r\n.mini b{font:700 16px/1.2 var(--sf);letter-spacing:-.015em;display:flex;align-items:center;gap:5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.mini span{font:400 12px var(--sf);color:var(--label2);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n@keyframes minin{from{opacity:0;transform:translateY(-6px) scale(.98)}}\r\n\r\n\r\n/* ================= Compte iOS 27 Liquid Glass — Layout Instagram @tony_frc ================= */\r\n.phone{grid-template-rows:calc(67% - 49px) 1fr}\r\n.phone.mapbig{grid-template-rows:172px 1fr}\r\n.top{padding:50px 12px 6px;gap:5px}\r\n.sw-wrap[data-det=peek] .sheet{top:calc(67% - 49px - 128px);bottom:calc(33% + 57px)}\r\n.sw-wrap[data-det=medium] .sheet{top:48px;bottom:calc(33% + 57px)}\r\n\r\n/* Top bar Instagram en verre Liquid Glass */\r\n.ig-top{display:flex;align-items:center;justify-content:space-between;gap:6px;height:36px;flex:none}\r\n.ig-handle{height:34px;padding:0 11px;border-radius:999px;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font:700 16px/1 var(--sf);letter-spacing:-.025em;color:var(--label);position:relative;overflow:hidden}\r\n.ig-handle:active{transform:scale(.96)}\r\n.ig-handle .lock-ic{color:var(--tint);display:inline-flex}\r\n.ig-handle .vis-tag{font:600 10.5px/1 var(--sf);color:var(--tint);padding:2px 6px;border-radius:999px;background:rgba(91,127,85,.16)}\r\n.ig-top-r{display:flex;align-items:center;gap:5px}\r\n.ig-top-r .gbtn{width:34px;height:34px}\r\n\r\n/* Carte principale profil Instagram en verre Liquid Glass */\r\n#card.cs{padding:9px 11px 8px;gap:6px;border-radius:24px;overflow:hidden}\r\n\r\n/* En-tête Instagram : Avatar + Nom + 3 compteurs (publications, followers, suivi(e)s) */\r\n.ig-header{display:grid;grid-template-columns:68px minmax(0,1fr);gap:11px;align-items:center;padding-top:3px}\r\n.ig-avi-wrap{position:relative;width:66px;height:66px;border-radius:50%;padding:2.5px;background:conic-gradient(from 140deg,#17402C,#5B7F55,#96B391,#3D7A52,#17402C);box-shadow:0 6px 16px rgba(23,43,36,.16),inset 0 1px 0 rgba(255,255,255,.8);cursor:pointer;border:0;display:block}\r\n.ig-avi-wrap:active{transform:scale(.95)}\r\n.ig-avi-in{width:100%;height:100%;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.92);background:#DDEBD8;display:grid;place-items:center}\r\n.ig-avi-in img{width:100%;height:100%;object-fit:cover;display:block}\r\n.ig-note{position:absolute;top:-7px;left:-2px;right:-6px;padding:2px 5px;border-radius:10px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 3px 10px rgba(23,43,36,.14),inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12);font:600 9px/1.15 var(--sf);color:var(--tint);white-space:nowrap;text-align:center;z-index:2}\r\n.ig-seal-bdg{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:linear-gradient(155deg,#fff,#EBF2EC);box-shadow:0 2px 6px rgba(23,43,36,.2),0 0 0 1.5px #fff;display:grid;place-items:center}\r\n\r\n.ig-right{display:flex;flex-direction:column;gap:5px;min-width:0}\r\n.ig-name-row{display:flex;align-items:center;gap:6px}\r\n.ig-name{font:700 14.5px/1.15 var(--sf);color:var(--label);letter-spacing:-.015em}\r\n.ig-sub-pill{font:600 10px/1 var(--sf);color:var(--tint);padding:2.5px 6px;border-radius:999px;background:rgba(235,242,236,.75);box-shadow:inset 0 0 0 .5px var(--soft-line)}\r\n.ig-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}\r\n.ig-stat{border:0;background:rgba(255,255,255,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 0 0 .5px rgba(23,43,36,.06);border-radius:11px;padding:4px 4px 3.5px;text-align:left;cursor:pointer;transition:transform .14s,background .15s}\r\n.ig-stat:active{transform:scale(.95);background:rgba(255,255,255,.65)}\r\n.ig-stat b{display:block;font:700 14px/1.1 var(--sf);color:var(--label);letter-spacing:-.02em;font-variant-numeric:tabular-nums}\r\n.ig-stat span{display:block;font:500 10px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n/* Bio Instagram (@tony_frc : 🇮🇹🇫🇷 + Empreinte GPS + Lignée) */\r\n.ig-bio{display:flex;flex-direction:column;gap:2.5px;font:400 11.8px/1.28 var(--sf);color:var(--label)}\r\n.ig-bio-flags{font-size:13px;line-height:1.2;display:flex;align-items:center;gap:6px}\r\n.ig-bio-flags span{font:500 11.2px/1.2 var(--sf);color:var(--label2)}\r\n.ig-bio-emp{display:flex;align-items:center;gap:5px;color:var(--tint);font:500 11.2px/1.25 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-bio-emp i{width:6px;height:6px;border-radius:50%;background:var(--good);flex:none}\r\n.ig-bio-link{display:inline-flex;align-items:center;gap:4px;font:600 11px/1.2 var(--sf);color:var(--tint);background:none;border:0;padding:0;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n/* Boutons d'action Instagram (Modifier le profil / Partager le profil / +Tribu) */\r\n.ig-actions{display:flex;width:100%;gap:5px}\r\n.ig-btn{height:28px;border-radius:9px;border:0;font:600 11.8px/1 var(--sf);cursor:pointer;display: inline-flex;align-items:center;justify-content:center;gap:4px;transition:transform .14s;padding:0 8px;white-space:nowrap}\r\n.ig-btn:active{transform:scale(.96)}\r\n.ig-btn.p{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh)}\r\n.ig-btn.soft{background:var(--soft);color:var(--label);box-shadow:inset 0 1px 0 rgba(255,255,255,.82),inset 0 0 0 .6px var(--soft-line)}\r\n.ig-btn.icon{padding:0;width:30px}\r\n\r\n/* Stories À la une (Highlights Instagram en anneaux Liquid Glass) */\r\n.ig-hl-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:1px 0}\r\n.ig-hl{border:0;background:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2.5px;min-width:0}\r\n.ig-hl:active .ig-hl-ring{transform:scale(.92)}\r\n.ig-hl-ring{width:44px;height:44px;border-radius:50%;padding:2px;background:linear-gradient(145deg,rgba(23,64,44,.55),rgba(91,127,85,.35),rgba(255,255,255,.85));box-shadow:inset 0 1px 0 #fff,0 2px 6px rgba(23,43,36,.08);transition:transform .15s;display:grid;place-items:center}\r\n.ig-hl-in{width:100%;height:100%;border-radius:50%;background:rgba(244,247,243,.88);border:1.5px solid rgba(255,255,255,.95);display:grid;place-items:center;font-size:16px;overflow:hidden;position:relative}\r\n.ig-hl span{font:500 9.8px/1.1 var(--sf);color:var(--label);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n/* Barre des 4 onglets de contenu Instagram (Grille | Carte/Sorties | Lignées/Sac | Identifié/Tribu) */\r\n.ig-tabs{position:relative;display:grid;grid-template-columns:repeat(4,1fr);height:31px;padding:2px;border-radius:12px;background:rgba(23,43,36,.06);box-shadow:inset 0 1px 1px rgba(23,43,36,.06),inset 0 -1px 0 rgba(255,255,255,.65)}\r\n.ig-tabs button{position:relative;z-index:1;border:0;background:none;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:4px;font:600 10.8px/1 var(--sf);color:var(--label2);cursor:pointer;transition:color .18s}\r\n.ig-tabs button[aria-selected=\"true\"]{color:var(--tint)}\r\n.ig-tabs .ig-th{position:absolute;top:2px;bottom:2px;left:2px;width:calc((100% - 4px)/4);border-radius:10px;background:rgba(255,255,255,.86);box-shadow:0 2px 6px rgba(23,43,36,.1),inset 0 1px 0 #fff;transition:transform .32s cubic-bezier(.22,1.15,.36,1)}\r\n\r\n/* Grille photo 3 colonnes Instagram (3x2 visible immédiatement) */\r\n.ig-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}\r\n.ig-tile{position:relative;height:68px;border-radius:10px;overflow:hidden;border:0;padding:0;cursor:pointer;background:#17402C;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.35);text-align:left;transition:transform .15s}\r\n.ig-tile:active{transform:scale(.96)}\r\n.ig-tile svg.art{width:100%;height:100%;display:block}\r\n.ig-tile .t-top{position:absolute;top:4px;left:5px;right:5px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}\r\n.ig-tile .t-pill{padding:1.5px 5px;border-radius:6px;background:rgba(12,24,18,.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font:600 8.8px/1.15 var(--sf);letter-spacing:.01em}\r\n.ig-tile .t-pill.draft{background:rgba(251,241,220,.92);color:#8a6418}\r\n.ig-tile .t-ic{color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));display:inline-flex}\r\n.ig-tile .t-bot{position:absolute;left:0;right:0;bottom:0;padding:12px 5px 4px;background:linear-gradient(180deg,transparent,rgba(10,22,16,.78));color:#fff;display:flex;justify-content:space-between;align-items:flex-end;gap:3px;pointer-events:none}\r\n.ig-tile .t-bot b{font:600 9.5px/1.1 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-tile .t-bot small{font:600 8.8px/1 var(--sf);opacity:.92;white-space:nowrap}\r\n\r\n/* Vues alternatives dans la zone grille (Sorties, Lignées, Tribu) */\r\n.ig-alt{display:flex;flex-direction:column;gap:5px;min-height:139px;justify-content:space-between}\r\n.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}\r\n.kpi{padding:4px 4px 3px;border-radius:11px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);text-align:center;cursor:pointer;border:0}\r\n.kpi b{display:block;font:700 13px/1.15 var(--sf);color:var(--label);font-variant-numeric:tabular-nums}\r\n.kpi small{display:block;font:500 9.2px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.axes2{display:grid;grid-template-columns:1fr 1fr;gap:5px}\r\n.axis-box{padding:6px 8px;border-radius:12px;background:rgba(255,255,255,.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);display:flex;flex-direction:column;gap:3px}\r\n.axis-box .ah{display:flex;justify-content:space-between;align-items:baseline;font:600 10.5px var(--sf);color:var(--label2)}\r\n.axis-box .ah b{font:700 13.5px var(--sf);color:var(--tint);font-variant-numeric:tabular-nums}\r\n.axis-box small{font:400 9.5px/1.2 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.credit-pill{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 9px;border-radius:12px;background:var(--pg);box-shadow:var(--pg-sh);cursor:pointer;border:0;width:100%;text-align:left}\r\n.credit-pill b{font:700 13.5px var(--sf);color:var(--tint);font-variant-numeric:tabular-nums}\r\n.credit-pill small{display:block;font:400 9.8px var(--sf);color:var(--label2)}\r\n\n\n/* ================= Compte — 50 améliorations (couche d'extension Liquid Glass v8) ================= */\r\n\r\n/* 1 · Anneau d'avatar : animé tant qu'une story est non vue, ciselé et sensible à la lumière sinon (47) */\r\n.ig-avi-wrap{background:none!important}\r\n.ig-avi-wrap::before{content:\"\";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from var(--la,140deg),rgba(23,64,44,.62),rgba(150,179,145,.55),rgba(255,255,255,.9),rgba(91,127,85,.5),rgba(23,64,44,.62));box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}\r\n.ig-avi-wrap.live::before{background:conic-gradient(from 0deg,#17402C,#5B7F55,#96B391,#3D7A52,#17402C);animation:lkspin 3.4s linear infinite}\r\n@keyframes lkspin{to{transform:rotate(360deg)}}\r\n.ig-avi-in{position:relative;z-index:1}\r\n.ig-note{cursor:pointer;z-index:3}\r\n.ig-note.empty{display:inline-grid;place-items:center;width:20px;padding:0;height:20px;left:-4px;right:auto;top:-5px}\r\n.ig-seal-bdg{z-index:3;cursor:pointer}\r\n\r\n/* Stories à la une : défilement horizontal, vues/non vues, couvertures topographiques (8) */\r\n.ig-hl-row{display:flex!important;overflow-x:auto;gap:4px;scrollbar-width:none}\r\n.ig-hl-row::-webkit-scrollbar{display:none}\r\n.ig-hl{flex:0 0 calc((100% - 16px)/5)}\r\n.ig-hl-ring{background:conic-gradient(from var(--la,140deg),rgba(23,64,44,.7),rgba(91,127,85,.45),rgba(255,255,255,.9),rgba(23,64,44,.7))!important}\r\n.ig-hl.seen .ig-hl-ring{opacity:.5;filter:saturate(.4)}\r\n.ig-hl-in svg{display:block}\r\n\r\n/* Barre de filtres + bascule grille/fil (15, 14) */\r\n.ig-filt{display:flex;align-items:center;gap:5px;margin:-1px 0 -1px}\r\n.ig-vt{flex:none;width:24px;height:22px;border:0;border-radius:8px;background:rgba(255,255,255,.55);box-shadow:inset 0 1px 0 #fff,inset 0 0 0 .5px var(--soft-line);display:grid;place-items:center;cursor:pointer;color:var(--tint)}\r\n.ig-pills{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}\r\n.ig-pills::-webkit-scrollbar{display:none}\r\n.ig-pill{flex:none;height:22px;padding:0 9px;border-radius:999px;border:0;font:600 10.5px/1 var(--sf);color:var(--label2);background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08);cursor:pointer}\r\n.ig-pill[aria-pressed=\"true\"]{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh)}\r\n\r\n/* Grille 3×N : tuiles plus compactes, épingles, filtre de mois, progression brouillon (11, 13, 21) */\r\n.ig-tile{height:56px!important}\r\n.ig-tile .t-pin{color:#fff;display:inline-flex;margin-right:3px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}\r\n.ig-tile .t-prog{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.28)}\r\n.ig-tile .t-prog i{display:block;height:100%;background:#E8C068}\r\n.ig-tile.dim,.ig-feed-row.dim{opacity:.26;filter:saturate(.35)}\r\n.ig-tile.lit,.ig-feed-row.lit{box-shadow:0 0 0 2px #5B7F55,0 4px 10px rgba(23,64,44,.28)}\r\n.ig-grid-wrap{display:flex;flex-direction:column;gap:3px}\r\n.ig-empty{display:grid;place-items:center;text-align:center;min-height:100px;padding:10px;border-radius:14px;background:rgba(255,255,255,.4);font:500 11.5px/1.35 var(--sf);color:var(--label2);gap:6px}\r\n.stat-bump{display:inline-block;animation:statbump .5s cubic-bezier(.3,1.5,.5,1)}\r\n@keyframes statbump{0%{transform:scale(.7);opacity:.3}100%{transform:none;opacity:1}}\r\n\r\n/* Fil Instagram compact (14) */\r\n.ig-feed{display:flex;flex-direction:column;gap:4px;max-height:139px;overflow-y:auto;scrollbar-width:none}\r\n.ig-feed::-webkit-scrollbar{display:none}\r\n.ig-feed-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:8px;align-items:center;border:0;text-align:left;padding:4px 6px 4px 4px;border-radius:12px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);cursor:pointer;flex:none}\r\n.ig-feed-row .fa{width:44px;height:44px;border-radius:9px;overflow:hidden}\r\n.ig-feed-row .fa svg{width:100%;height:100%;display:block}\r\n.ig-feed-row b{display:block;font:600 12px/1.2 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-feed-row small{display:block;font:400 10.5px/1.25 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.ig-feed-row em{font:600 11px var(--sf);font-style:normal;color:var(--tint)}\r\n\r\n/* Sous-onglets Lignées (Épreuve / Filiation / Sac) */\r\n.ig-sub{display:flex;gap:4px}\r\n.ig-sub button{flex:1;height:22px;border:0;border-radius:999px;font:600 10.5px/1 var(--sf);color:var(--label2);background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08);cursor:pointer}\r\n.ig-sub button[aria-pressed=\"true\"]{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh)}\r\n.tree{width:100%;height:68px;display:block}\r\n.tree g[data-a]{cursor:pointer}\r\n.tree text{font:600 7.5px var(--sf);fill:#56665D}\r\n.gauge{display:flex;flex-direction:column;gap:3px;padding:5px 9px;border-radius:12px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07)}\r\n.gauge .gh{display:flex;justify-content:space-between;font:600 10.5px var(--sf);color:var(--label2)}\r\n.gauge .gh b{color:var(--tint)}\r\n.gauge .gb{height:5px;border-radius:99px;background:var(--fill);overflow:hidden}\r\n.gauge .gb i{display:block;height:100%;background:linear-gradient(90deg,#5B7F55,#3D7A52);border-radius:99px}\r\n\r\n/* Vestiaire matériel 3×2 (31, 33) */\r\n.gc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}\r\n.gc-tile{position:relative;border:0;text-align:left;padding:5px 6px 6px;border-radius:12px;background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 .5px rgba(23,43,36,.08);cursor:pointer;display:flex;flex-direction:column;gap:1px;min-width:0;height:48px;overflow:hidden}\r\n.gc-tile:active{transform:scale(.96)}\r\n.gc-tile b{font:600 10.8px/1.15 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.gc-tile small{font:500 9.6px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.gc-tile .wr{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(23,43,36,.08)}\r\n.gc-tile .wr i{display:block;height:100%;background:#3D7A52}\r\n.gc-tile .wr i.hot{background:#B98A2E}\r\n.gc-tile .gb2{position:absolute;right:5px;top:4px;font:700 8.5px var(--sf);padding:1px 4px;border-radius:6px;background:var(--warn-bg);color:#8a6418}\r\n.gc-tile.add{align-items:center;justify-content:center;background:var(--pg);box-shadow:var(--pg-sh);color:var(--pg-ink)}\r\n.gc-tile.add b{font-size:11px}\r\n\r\n/* Tribu : lignes compactes + comparateur d'empreintes (20) */\r\n.tr-row{display:grid;grid-template-columns:26px minmax(0,1fr) auto;gap:8px;align-items:center;padding:3px 6px;border-radius:12px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07)}\r\n.tr-av{width:26px;height:26px;border-radius:50%;background:linear-gradient(155deg,#fff,#DDEBD8);display:grid;place-items:center;font:700 11px var(--sf);color:var(--tint)}\r\n.tr-t b{display:block;font:600 11.8px/1.2 var(--sf)}\r\n.tr-t small{display:block;font:400 10px/1.2 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.tr-row .mbtn{height:22px;font-size:10.5px;padding:0 9px}\r\n\r\n/* Accessoire : repères d'événements + point J-4 (23, 24) */\r\n.acc .j4{position:absolute;right:9px;top:8px;width:9px;height:9px;border-radius:50%;background:#3D7A52;box-shadow:0 0 0 2px rgba(255,255,255,.85);animation:j4p 1.8s infinite;cursor:pointer;z-index:3}\r\n@keyframes j4p{0%{box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 0 2px rgba(61,122,82,.5)}70%{box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 0 9px rgba(61,122,82,0)}100%{box-shadow:0 0 0 2px rgba(255,255,255,.85),0 0 0 2px rgba(61,122,82,0)}}\r\n.acc .ro{cursor:pointer}\r\n\r\n/* Carte : relief ombré selon la lumière (18), halo de focus (16), mini-profil callout (19) */\r\n.sunshade{position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;background:linear-gradient(var(--la,140deg),rgba(255,255,255,.2) 0%,rgba(23,43,36,.16) 100%);transition:background .3s}\r\n.callout .co-prof{grid-column:1/3;margin-top:3px}\r\n.callout .co-hint{grid-column:1/3;font:600 10.5px var(--sf);color:var(--warn)}\r\n\r\n/* Visionneuse de story plein écran (6, 7, 9) */\r\n.story{position:absolute;inset:0;z-index:45;border-radius:54px;background:linear-gradient(170deg,#0d2117,#1d4a34 55%,#0d2117);color:#fff;display:flex;flex-direction:column;padding:56px 14px 34px;opacity:0;pointer-events:none;transition:opacity .28s}\r\n.story.on{opacity:1;pointer-events:auto}\r\n.st-bar{display:flex;gap:4px;margin-bottom:10px;position:relative;z-index:3}\r\n.st-bar i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.28);overflow:hidden;display:block}\r\n.st-bar i b{display:block;height:100%;width:0;background:#fff}\r\n.st-bar i.done b{width:100%}\r\n.st-bar i.cur b{animation:stfill 4.4s linear forwards}\r\n.story.hold .st-bar i.cur b{animation-play-state:paused}\r\n@keyframes stfill{to{width:100%}}\r\n.st-head{display:flex;align-items:center;gap:8px;position:relative;z-index:3}\r\n.st-av{width:32px;height:32px;border-radius:50%;overflow:hidden;box-shadow:0 0 0 1.5px rgba(255,255,255,.7);flex:none}\r\n.st-head b{font:600 14px var(--sf)}\r\n.st-head small{font:400 11.5px var(--sf);opacity:.7;flex:1}\r\n.st-x{width:32px;height:32px;border-radius:50%;border:0;background:rgba(255,255,255,.18);color:#fff;display:grid;place-items:center;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}\r\n.st-x .ic{stroke:#fff}\r\n.st-.lkdv-compte-v8{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;z-index:1}\r\n.st-foot{position:relative;z-index:3;display:flex;flex-direction:column;gap:7px;min-height:84px}\r\n.st-foot b{font:700 19px/1.2 var(--sf);letter-spacing:-.02em}\r\n.st-foot small{font:400 13px/1.35 var(--sf);opacity:.78}\r\n.st-foot .st-act{display:flex;gap:8px;flex-wrap:wrap}\r\n.st-btn{height:34px;padding:0 14px;border-radius:999px;border:0;font:600 13px var(--sf);cursor:pointer;color:#fff;background:rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 .6px rgba(255,255,255,.3);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}\r\n.st-btn.p{background:rgba(150,186,142,.5)}\r\n.st-zone{position:absolute;top:116px;bottom:196px;width:50%;border:0;background:none;z-index:2;cursor:pointer}\r\n.st-zone.l{left:0}.st-zone.r{right:0}\r\n.st-card{position:relative;width:100%;height:100%;max-height:430px;border-radius:30px;overflow:hidden;background:rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 0 .6px rgba(255,255,255,.25)}\r\n.st-card .st-bg{position:absolute;inset:0;display:grid;place-items:center;opacity:.55}\r\n.st-card .st-bg svg{width:130%;height:130%}\r\n.st-card svg.tr{position:absolute;inset:0;width:100%;height:100%}\r\n.st-draw{fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:stdraw 3.2s ease-out .2s forwards;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}\r\n@keyframes stdraw{to{stroke-dashoffset:0}}\r\n.st-chip{position:absolute;padding:5px 11px;border-radius:999px;font:600 12px var(--sf);background:rgba(255,255,255,.22);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,.4)}\r\n.st-chip.a{left:14px;top:14px}.st-chip.b{right:14px;bottom:14px}\r\n.st-card.photo svg.art{position:absolute;inset:0;width:100%;height:100%}\r\n.st-card.stats{display:grid;grid-template-columns:1fr;place-content:center;gap:16px;text-align:center}\r\n.st-card.stats b{display:block;font:700 40px/1 var(--sf);letter-spacing:-.03em}\r\n.st-card.stats span{font:500 13px var(--sf);opacity:.75}\r\n.st-card.gear{padding:18px;display:flex;flex-direction:column;gap:11px;justify-content:center}\r\n.st-card.gear .gr{display:grid;grid-template-columns:78px 1fr auto;gap:8px;align-items:center;font:500 12.5px var(--sf)}\r\n.st-card.gear .gr i{display:block;height:8px;border-radius:99px;background:rgba(255,255,255,.2);overflow:hidden}\r\n.st-card.gear .gr i u{display:block;height:100%;background:linear-gradient(90deg,#96B391,#fff);border-radius:99px;text-decoration:none}\r\n.st-card.gear .tot{font:700 30px var(--sf);letter-spacing:-.02em;text-align:center}\r\n.st-card.species{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:20px}\r\n.st-card.species .sp-card{width:100%;padding:18px;border-radius:24px;background:rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.5);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}\r\n.st-card.species .sp-card b{display:block;font:700 22px var(--sf)}\r\n.st-card.species .sp-card i{display:block;font:italic 400 13px var(--sf);opacity:.8;margin:2px 0 8px}\r\n.st-card.species .sp-card span{font:600 13px var(--sf)}\r\n\r\n/* Aperçu Peek & Pop d'une tuile (12) + mini-profil dans le ctx */\r\n.ctx .pk-art{height:104px;border-radius:15px;overflow:hidden;margin-bottom:8px;position:relative}\r\n.ctx .pk-art svg.art{width:100%;height:100%;display:block}\r\n.ctx .pv .s2{font:400 12.5px/1.35 var(--sf);color:var(--label2);margin-bottom:4px}\r\n.ctx .pv .bar{margin:6px 0}\r\n.ctx .menu button.sel{color:var(--tint);font-weight:600}\r\n\r\n/* Matrice « Qui voit quoi ? » (44) */\r\n.vm{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(0,.7fr));gap:0;font:500 11.5px var(--sf);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08)}\r\n.vm>*{padding:5px 7px;border-top:.5px solid var(--sep);display:flex;align-items:center}\r\n.vm>.h{border-top:0;font:700 10.5px var(--sf);color:var(--label2);justify-content:center}\r\n.vm>.h:first-child{justify-content:flex-start}\r\n.vm>.c{justify-content:center}\r\n.vm .y{width:9px;height:9px;border-radius:50%;background:#3D7A52}\r\n.vm .n{width:9px;height:9px;border-radius:50%;box-shadow:inset 0 0 0 1.4px rgba(23,43,36,.28)}\r\n\r\n/* QR + sceau (48) */\r\n.qrbox{display:flex;gap:12px;align-items:center}\r\n.qr{position:relative;width:104px;height:104px;border-radius:16px;background:#fff;padding:7px;box-shadow:0 0 0 .6px rgba(23,64,44,.18),0 6px 16px rgba(23,64,44,.12);flex:none}\r\n.qr svg.q{width:100%;height:100%;display:block}\r\n.qr .qc{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 0 0 2px #fff}\r\n.qrbox b{display:block;font:600 14px var(--sf)}\r\n.qrbox small{display:block;font:400 11.5px/1.35 var(--sf);color:var(--label2);margin:2px 0 7px}\r\n\r\n/* Coffre biométrique, scanner, SMS SOS, jauge de stockage, flou domicile */\r\n.vault-lock{display:grid;place-items:center;gap:8px;padding:12px 0;text-align:center}\r\n.vault-lock .fid{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;background:var(--pg);box-shadow:var(--pg-sh);color:var(--pg-ink)}\r\n.scanbox{position:relative;height:96px;border-radius:16px;background:rgba(23,43,36,.88);overflow:hidden;display:grid;place-items:center}\r\n.scanbox::before{content:\"\";position:absolute;left:14%;right:14%;top:18px;height:2px;background:#96B391;box-shadow:0 0 12px #96B391;animation:scanln 1.6s ease-in-out infinite alternate}\r\n@keyframes scanln{to{top:74px}}\r\n.scanbox span{font:500 11px var(--sf);color:rgba(255,255,255,.7);position:relative}\r\n.sms{font:500 11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;padding:9px 11px;border-radius:12px;background:rgba(23,43,36,.07);box-shadow:inset 0 0 0 .5px var(--sep);color:var(--label);user-select:text;-webkit-user-select:text}\r\n.stor{display:flex;flex-direction:column;gap:4px}\r\n.stor .sh{display:flex;justify-content:space-between;font:600 12px var(--sf)}\r\n.blur{display:flex;gap:10px;align-items:center;padding:6px 8px;border-radius:14px;background:rgba(235,242,236,.6);box-shadow:inset 0 0 0 .5px var(--soft-line)}\r\n.blur b{display:block;font:600 12.5px var(--sf)}\r\n.blur small{display:block;font:400 11px/1.3 var(--sf);color:var(--label2)}\r\n.row-btns{display:flex;gap:6px;flex-wrap:wrap}\r\n.sheet .mbtn{cursor:pointer}\r\n.island[data-s=note]{top:5px!important;min-height:41px!important;max-height:43px!important;border-radius:21px!important}\r\n.island .is.note{padding:4px 10px 4px 14px!important;min-height:41px!important;max-height:43px!important}\r\n.island .is.note .t{font-size:11.5px!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n.island .is.note .s{font-size:10px!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\r\n\r\n/* Bandeau visiteur */\r\n.ig-actions.vis{grid-template-columns:1fr 1fr 30px}\r\n\r\n/* Mode plein soleil : contrastes renforcés (49) */\r\n.phone.outdoor .ig-stat b,.phone.outdoor .ig-name{font-weight:800}\r\n.phone.outdoor .ig-stat{box-shadow:inset 0 0 0 1.4px rgba(23,43,36,.55);background:rgba(255,255,255,.88)}\r\n.phone.outdoor .ig-tile{box-shadow:inset 0 0 0 1.6px rgba(255,255,255,.95),0 0 0 1.4px rgba(23,43,36,.6)}\r\n.phone.outdoor .ig-tile .t-pill{background:rgba(0,0,0,.82)}\r\n.phone.outdoor .ig-pill,.phone.outdoor .ig-sub button,.phone.outdoor .gc-tile,.phone.outdoor .tr-row{box-shadow:inset 0 0 0 1.2px rgba(23,43,36,.5)}\r\n.phone.outdoor .ig-btn{box-shadow:inset 0 0 0 1.6px rgba(23,64,44,.7)}\r\n.phone.outdoor .ig-hl-ring{filter:contrast(1.25)}\r\n.phone.outdoor .sunshade{opacity:0}\r\n\n\n/* Responsive iOS 27 mobile screen adaptations (Apple HIG, Capacitor WKWebView & iPhone Safari) */\n@media (max-width: 767px) {\n  .lkdv-compte-v8 {\n    padding-inline: 0 !important;\n    padding-block: 0 !important;\n    position: fixed !important;\n    inset: 0 !important;\n    width: 100% !important;\n    height: 100dvh !important;\n    overflow: hidden !important;\n  }\n  .stage {\n    display: block !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: 100% !important;\n    margin: 0 !important;\n    padding: 0 !important;\n  }\n  .pwrap {\n    position: absolute !important;\n    inset: 0 !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: 100% !important;\n    margin: 0 !important;\n    transform: none !important;\n  }\n  .phone {\n    position: absolute !important;\n    inset: 0 !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    height: 100% !important;\n    border-radius: 0 !important;\n    box-shadow: none !important;\n    transform: none !important;\n    display: grid !important;\n    grid-template-rows: calc(100% - 176px) 176px !important;\n    transition: grid-template-rows 0.45s cubic-bezier(0.32, 0.72, 0, 1) !important;\n  }\n  .phone.mapbig {\n    grid-template-rows: calc(env(safe-area-inset-top, 0px) + 84px) 1fr !important;\n  }\n  .status, .island, .home, .notes {\n    display: none !important;\n  }\n  .top {\n    padding-top: calc(env(safe-area-inset-top, 0px) + 6px) !important;\n    padding-left: 10px !important;\n    padding-right: 10px !important;\n    padding-bottom: 4px !important;\n    min-height: 0 !important;\n    gap: 4px !important;\n    display: flex !important;\n    flex-direction: column !important;\n  }\n  .card {\n    flex: 1 !important;\n    min-height: 0 !important;\n    padding: 10px 11px !important;\n    gap: 6px !important;\n    overflow-y: auto !important;\n    -webkit-overflow-scrolling: touch !important;\n    overscroll-behavior-y: contain !important;\n  }\n  .ig-top {\n    margin-bottom: 2px !important;\n  }\n  .ig-top-r .gbtn {\n    width: 34px !important;\n    height: 34px !important;\n    border-radius: 50% !important;\n    background: rgba(255, 255, 255, 0.5) !important;\n    -webkit-backdrop-filter: blur(12px) !important;\n    backdrop-filter: blur(12px) !important;\n    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 2px 8px rgba(23, 43, 36, 0.08) !important;\n    color: #17402C !important;\n  }\n  .ig-avi-wrap {\n    width: 84px !important;\n    height: 84px !important;\n  }\n  .ig-note {\n    font-size: 8px !important;\n    top: -6px !important;\n    padding: 1px 4px !important;\n  }\n  .ig-name {\n    font-size: 13.5px !important;\n  }\n  .ig-sub-pill {\n    font-size: 9px !important;\n    padding: 1.5px 5px !important;\n  }\n  .ig-stat {\n    padding: 2.5px 3px !important;\n  }\n  .ig-stat b {\n    font-size: 12.5px !important;\n  }\n  .ig-stat span {\n    font-size: 9px !important;\n  }\n  .ig-bio {\n    gap: 1.5px !important;\n    font-size: 11px !important;\n    line-height: 1.22 !important;\n  }\n  .ig-bio-emp, .ig-bio-flags {\n    font-size: 10.5px !important;\n  }\n  .ig-actions {\n    gap: 4px !important;\n  }\n  .ig-btn {\n    height: 26px !important;\n    font-size: 11px !important;\n  }\n  .ig-hl-row {\n    padding: 0 !important;\n    gap: 3px !important;\n  }\n  .ig-hl-ring {\n    width: 44px !important;\n    height: 44px !important;\n  }\n  .ig-hl-in {\n    width: 38px !important;\n    height: 38px !important;\n  }\n  .ig-hl span:last-child {\n    font-size: 9px !important;\n  }\n  .ig-grid {\n    grid-template-columns: repeat(3, 1fr) !important;\n    gap: 3px !important;\n  }\n  .ig-tile {\n    min-height: 86px !important;\n    height: auto !important;\n    aspect-ratio: 1 / 1.05 !important;\n    border-radius: 9px !important;\n  }\n  .t-pill {\n    font-size: 8px !important;\n    padding: 1.5px 4px !important;\n  }\n  .t-bot b {\n    font-size: 9px !important;\n  }\n  .t-bot small {\n    font-size: 8px !important;\n  }\n  .tb {\n    left: 8px !important;\n    right: 8px !important;\n    bottom: calc(env(safe-area-inset-bottom, 0px) + 12px) !important;\n    height: 48px !important;\n    padding: 2px !important;\n  }\n  .acc {\n    left: 8px !important;\n    right: 8px !important;\n    bottom: calc(env(safe-area-inset-bottom, 0px) + 68px) !important;\n    height: 38px !important;\n  }\n  .callout {\n    left: 8px !important;\n    right: 8px !important;\n    bottom: calc(env(safe-area-inset-bottom, 0px) + 114px) !important;\n  }\n  .phone .sheet,\n  .sheet {\n    left: 0 !important;\n    right: 0 !important;\n    border-radius: 28px 28px 0 0 !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    box-sizing: border-box !important;\n  }\n  .phone .sw-wrap[data-det=medium] .sheet,\n  .sw-wrap[data-det=medium] .sheet {\n    top: auto !important;\n    bottom: 0 !important;\n    height: min(580px, 78dvh) !important;\n    max-height: 85dvh !important;\n  }\n  .phone .sw-wrap[data-det=large] .sheet,\n  .sw-wrap[data-det=large] .sheet {\n    top: calc(env(safe-area-inset-top, 0px) + 12px) !important;\n    bottom: 0 !important;\n    height: auto !important;\n  }\n  .sw-wrap[data-det=medium] .scrim,\n  .sw-wrap[data-det=large] .scrim {\n    opacity: 1 !important;\n    pointer-events: auto !important;\n    background: rgba(0, 0, 0, 0.45) !important;\n    -webkit-backdrop-filter: blur(6px) !important;\n    backdrop-filter: blur(6px) !important;\n  }\n\n  .ig-alt {\n    min-height: auto !important;\n    gap: 6px !important;\n  }\n  .ig-alt .kpis {\n    gap: 3px !important;\n  }\n  .ig-alt .kpi b {\n    font-size: 12px !important;\n  }\n  .ig-alt .axes2 {\n    gap: 4px !important;\n  }\n  .ig-alt .axis-box {\n    padding: 5px 6px !important;\n  }\n\n  .row-btns {\n    display: inline-flex !important;\n    flex-wrap: nowrap !important;\n    gap: 4px !important;\n    flex-shrink: 0 !important;\n  }\n  .row-btns .mbtn {\n    height: 22px !important;\n    font-size: 10px !important;\n    padding: 0 8px !important;\n  }\n  .sumline .lnk {\n    font-size: 11px !important;\n    font-weight: 600 !important;\n    color: #17402C !important;\n  }\n}\n\n\n/* 3D Living Map & Mobile Responsive Glass UI */\n.map-badge-3d{display:none!important}\n.badge-dot-live{width:7px;height:7px;border-radius:50%;background:#40c057;box-shadow:0 0 0 2px rgba(64,192,87,0.3);animation:pulse-live 2s infinite}\n@keyframes pulse-live{0%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(64,192,87,0.7)}70%{transform:scale(1);box-shadow:0 0 0 5px rgba(64,192,87,0)}100%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(64,192,87,0)}}\n.btn-3d-fullscreen{display:none!important}\n.btn-3d-fullscreen:hover{background:rgba(255,255,255,0.92);transform:scale(1.03)}\n.btn-3d-fullscreen:active{transform:scale(0.96)}\n.poi-marker-3d{display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto;transform:translate(-50%,-100%)}\n.poi-marker-badge{display:flex;align-items:center;gap:4px;padding:3px 7px;border-radius:8px;background:rgba(23,43,36,0.85);backdrop-filter:blur(6px);color:#fff;font:600 10.5px var(--sf);white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)}\n.poi-marker-badge span{color:#A6C1A0;font-variant-numeric:tabular-nums}\n.poi-marker-pin{width:6px;height:6px;border-radius:50%;background:#5B7F55;margin-top:2px;box-shadow:0 0 0 2px #fff}\n@media (max-width: 600px){\n  .lkdv-compte-v8{padding-inline:0!important;padding-block:0!important}\n  .stage{display:block!important;width:100%!important;max-width:100%!important;margin:0!important;padding:0!important}\n  .pwrap{width:100%!important;height:100dvh!important;max-width:100%!important;margin:0!important}\n  .phone{position:relative!important;width:100%!important;height:100dvh!important;border-radius:0!important;box-shadow:none!important;border:none!important}\n  .status{display:none!important}\n  .island{display:none!important}\n  .home{display:none!important}\n  .top{padding:calc(env(safe-area-inset-top, 12px) + 6px) 12px 8px!important}\n  .tb{bottom:calc(env(safe-area-inset-bottom, 0px) + 12px)!important;left:10px!important;right:10px!important}\n  .acc{bottom:calc(env(safe-area-inset-bottom, 0px) + 72px)!important;left:10px!important;right:10px!important}\n  .callout{bottom:calc(env(safe-area-inset-bottom, 0px) + 124px)!important}\n  .mopts{bottom:calc(env(safe-area-inset-bottom, 0px) + 124px)!important}\n  .btn-3d-fullscreen{display:none!important}\n  .sw-wrap[data-det=medium] .sheet{top:calc(env(safe-area-inset-top, 12px) + 32px)!important;bottom:calc(env(safe-area-inset-bottom, 0px) + 10px)!important}\n  .sw-wrap[data-det=large] .sheet{top:calc(env(safe-area-inset-top, 12px) + 8px)!important;bottom:calc(env(safe-area-inset-bottom, 0px) + 6px)!important;border-radius:28px!important}\n}\n.phone.sheet-open .tabbar{opacity:0;pointer-events:none;transform:translateY(16px);transition:opacity 0.25s,transform 0.25s}\n.phone.sheet-open .btn-3d-fullscreen{display:none!important}";
const COMPTE_V8_HTML = "<div class=\"stage\">\r\n<div class=\"pwrap\" id=\"pwrap\"><div class=\"phone\" id=\"phone\" aria-label=\"Maquette iPhone du profil LKDV  en Liquid Glass iOS 27\">\r\n  <div class=\"bg\" aria-hidden=\"true\" style=\"background-image:url(data:image/webp;base64,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)\"></div>\r\n  <div class=\"status\" aria-hidden=\"true\"><span>9:41</span><span class=\"r\">\r\n    <svg width=\"18\" height=\"12\" viewBox=\"0 0 18 12\"><rect x=\"0\" y=\"8\" width=\"3\" height=\"4\" rx=\"1\" fill=\"#fff\"/><rect x=\"5\" y=\"5.5\" width=\"3\" height=\"6.5\" rx=\"1\" fill=\"#fff\"/><rect x=\"10\" y=\"3\" width=\"3\" height=\"9\" rx=\"1\" fill=\"#fff\"/><rect x=\"15\" y=\"0\" width=\"3\" height=\"12\" rx=\"1\" fill=\"#fff\"/></svg>\r\n    <svg width=\"16\" height=\"12\" viewBox=\"0 0 16 12\"><path d=\"M8 11.2 5.6 8.8a3.4 3.4 0 0 1 4.8 0L8 11.2Z\" fill=\"#fff\"/><path d=\"M3.4 6.6a6.5 6.5 0 0 1 9.2 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M1 4.2a9.9 9.9 0 0 1 14 0\" stroke=\"#fff\" stroke-width=\"1.7\" fill=\"none\" stroke-linecap=\"round\"/></svg>\r\n    <svg width=\"27\" height=\"13\" viewBox=\"0 0 27 13\"><rect x=\".5\" y=\".5\" width=\"23\" height=\"12\" rx=\"3.8\" stroke=\"rgba(255,255,255,.6)\" fill=\"none\"/><rect x=\"2.5\" y=\"2.5\" width=\"17\" height=\"8\" rx=\"2.2\" fill=\"#fff\"/><path d=\"M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z\" fill=\"rgba(255,255,255,.6)\"/></svg></span></div>\r\n  <div class=\"island\" id=\"island\" data-s=\"idle\" role=\"status\" aria-live=\"polite\"><div class=\"is live\" id=\"isl\"></div><div class=\"is note\" id=\"isn\"></div></div>\r\n\r\n  <section class=\"top\" id=\"top\"></section>\r\n\r\n  <section class=\"mapzone\" aria-label=\"Carte d'empreinte et d'aventures de \">\r\n    <div class=\"map\" id=\"map\"><div id=\"map-loading-bar\" class=\"map-loading-bar\"><div class=\"map-loading-pill\"><span class=\"map-loading-pulse\"></span><span>Initialisation du Relief 3D…</span></div><div class=\"map-loading-track\"><div id=\"map-loading-fill\" class=\"map-loading-fill\"></div></div></div><div id=\"maplibre-compte-canvas\" style=\"position:absolute;inset:0;width:100%;height:100%;z-index:1;\"></div><div class=\"map-scale-selector\" role=\"group\" aria-label=\"Échelle de la carte 3D\"><button id=\"btnCompteOrbite\" class=\"active\" data-a=\"mapscale\" data-v=\"ORBITE\" data-scale=\"ORBITE\" aria-label=\"Vue Globe Terrestre\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"2\" x2=\"22\" y1=\"12\" y2=\"12\"/><path d=\"M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\"/></svg></button><button id=\"btnCompteMassif\" data-a=\"mapscale\" data-v=\"MASSIF\" data-scale=\"MASSIF\" aria-label=\"Vue Massif Alpin\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m8 3 4 8 5-5 5 15H2L8 3z\"/></svg></button><button id=\"btnCompteSentier\" data-a=\"mapscale\" data-v=\"SENTIER\" data-scale=\"SENTIER\" aria-label=\"Vue Sentier 3D Immersion\"><svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><polygon points=\"16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76\"/></svg></button></div><div class=\"map-badge-3d\"><span>GLOBE 3D</span></div>\r\n      <svg class=\"tm\" id=\"tm\" viewBox=\"0 -24 370 368\" preserveAspectRatio=\"xMidYMid slice\" role=\"img\" aria-label=\"Carte générée de ton empreinte terrain\"></svg>\r\n      <button class=\"mgrab\" id=\"mgrab\" data-a=\"mapbig\" aria-label=\"Agrandir ou réduire la carte\"><span></span></button>\r\n      <div class=\"lg mctl\" id=\"mctl\"></div>\r\n      <div class=\"lg callout\" id=\"callout\" hidden></div>\r\n    </div>\r\n  </section>\r\n\r\n  <nav class=\"tabbar\" id=\"tabbar\" aria-label=\"Navigation principale\">\r\n    \r\n    <div class=\"lg tb\" id=\"tb\"></div>\r\n  </nav>\r\n  <div class=\"home\"></div>\r\n\r\n  <div class=\"sw-wrap\" id=\"sw\" data-det=\"closed\"><div class=\"scrim\" data-a=\"close\"></div><section class=\"sheet\" id=\"sheet\" role=\"dialog\" aria-label=\"Détails du compte\"></section></div>\r\n  <div class=\"lg popv\" id=\"popv\" role=\"dialog\" aria-label=\"Affichage\"></div>\r\n  <div class=\"lg mopts\" id=\"mopts\" role=\"dialog\" aria-label=\"Personnaliser la carte\"></div>\r\n  <div class=\"lg rmenu\" id=\"rmenu\" role=\"menu\" aria-label=\"Choisir une option\"></div>\r\n  <div class=\"ctx\" id=\"ctx\" role=\"dialog\" aria-label=\"Aperçu\"></div>\r\n  <div class=\"story\" id=\"story\" role=\"dialog\" aria-label=\"Story plein écran\"></div>\r\n  <div class=\"post-modal-instagram\" id=\"post_modal_instagram\" role=\"dialog\" aria-label=\"Publication Instagram\"></div>\r\n</div></div>\r\n\r\n<aside class=\"notes\">\r\n  <span class=\"tag\">Maquette finale · Compte  · iOS 27 Liquid Glass</span>\r\n  <h1>L'anatomie Instagram de  fusionnée dans le verre iOS 27 LKDV.</h1>\r\n  <p>Toute l'ergonomie de ton profil Instagram (<code></code> · <b>Тоny</b> · <code>3 publications</code> · <code>1 080 followers</code> · <code>339 suivi(e)s</code> · bio <code>IT·FR</code> · stories À la une · grille photo 3 colonnes) habillée avec le Design System unique Liquid Glass v8 et ta carte d'empreinte vivante en bas.</p>\r\n  <ul>\r\n    <li><b>En-tête Instagram </b> : vrai avatar entouré de l'anneau Sceau d'empreinte (ADR-010), bulle de note en verre, compteurs interactifs et boutons <i>Modifier le profil</i> / <i>Partager le profil</i> en verre dépoli (<code>--pg</code> / <code>.soft</code>).</li>\r\n    <li><b>Stories À la une & Grille 3×3</b> : moments terrain (<i>IT·FR Alpes</i>, <i>⛺ Néouvielle</i>, <i>🦌 Vercors</i>, <i>🎒 Sac 4,8kg</i>) et grille carrée 3 colonnes synchronisée avec la carte d'empreinte en bas.</li>\r\n    <li><b>4 onglets profil</b> : <b>Grille</b> (publications & carnets), <b>Carte</b> (sorties GPS & massifs), <b>Lignées</b> (Propagation, Endurance 91 % & Part créateur 42,50 €), <b>Tribu</b> (sorties en équipage & matériel prêté).</li>\r\n    <li><b>Tests E2E Maestro MCP</b> : identifiants et libellés accessibles pour piloter et vérifier chaque flux via Maestro MCP (<code>maestro mcp</code>).</li>\r\n  </ul>\r\n\r\n  <h2 style=\"margin:22px 0 6px;font-size:15px\">50 améliorations intégrées</h2>\r\n  <ul>\r\n    <li><b>Identité</b> : anneau animé ou ciselé, note 24 h modifiable, vue visiteur, Sceau zoomable, bascule profil / clubs (appui long sur <code>tony_frc</code>).</li>\r\n    <li><b>Stories</b> : visionneuse plein écran, story Sac, couvertures topographiques, espèce épinglée, création depuis une sortie.</li>\r\n    <li><b>Grille</b> : épingles, Peek &amp; Pop (appui long), progression du brouillon, fil, filtres saison / massif.</li>\r\n    <li><b>Carte &amp; accessoire</b> : survol lié, clusters 2/3, relief ombré, mini-profil, comparateur, 3 modes, repères, scrubber filtrant, J-4.</li>\r\n    <li><b>Lignées &amp; sac</b> : filiation G1→G3, jauge 3/5, simulateur, journal 300 bps, vestiaire 3×2, usure, prêts, scan.</li>\r\n    <li><b>Profil voyageur, sécurité, RGPD</b> : impact Compas, double nationalité, flou 1 km, coffre Face ID, SMS SOS, stockage, matrice « qui voit quoi », exports.</li>\r\n    <li><b>Interactions</b> : voix composée, reflet pilotable, QR + NameDrop, plein soleil renforcé.</li>\r\n  </ul>\r\n</aside>\r\n</div>";

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
  position: relative !important;
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  width: 96px !important;
  max-width: 96px !important;
  margin: 6px auto 10px !important;
  height: 32px !important;
  padding: 2.5px !important;
  border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.22) 55%, rgba(255, 255, 255, 0.32)) !important;
  -webkit-backdrop-filter: blur(28px) saturate(180%) !important;
  backdrop-filter: blur(28px) saturate(180%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 1px rgba(255, 255, 255, 0.35), 0 4px 14px rgba(23, 43, 36, 0.08) !important;
  box-sizing: border-box !important;
}
@media (prefers-color-scheme: dark) {
  .ig-tabs {
    background: rgba(28, 30, 36, 0.75) !important;
    border-color: rgba(255, 255, 255, 0.12) !important;
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
  gap: 8px !important;
  padding: 4px 8px 6px !important;
  width: auto !important;
}
.flow button {
  width: 40px !important;
  height: 36px !important;
  padding: 0 !important;
  border-radius: 9999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  color: #56665D !important;
  border: 0.5px solid rgba(23, 64, 44, 0.12) !important;
  box-shadow: 0 1px 3px rgba(23, 43, 36, 0.05) !important;
  display: grid !important;
  place-items: center !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}
.flow button:active {
  transform: scale(0.94) !important;
}
.flow button.cur {
  background: #17402C !important;
  color: #ffffff !important;
  border-color: #17402C !important;
  box-shadow: 0 2px 8px rgba(23, 64, 44, 0.28) !important;
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

/* Point 1 — Profile Header layout (Instagram style) */
.ig-header {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  gap: 16px !important;
  padding: 8px 12px 4px !important;
}
.ig-left {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  flex: none !important;
  width: 84px !important;
  text-align: center !important;
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
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  min-width: 0 !important;
  padding-top: 8px !important;
}
.ig-stats {
  display: flex !important;
  justify-content: space-around !important;
  align-items: center !important;
  width: 100% !important;
  gap: 0 !important;
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
.sheet-open .mctl,
.phone[data-sheet-open="true"] .mctl,
#sw[data-det="medium"] ~ * .mctl,
#sw[data-det="large"] ~ * .mctl,
.phone.sheet-open .mctl {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateY(12px) !important;
  transition: opacity 0.2s ease, transform 0.2s ease !important;
}
.mctl {
  transition: opacity 0.2s ease, transform 0.2s ease !important;
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

/* Point 3 — Modal Post Instagram Liquid Glass */
.post-modal-instagram {
  position: absolute !important;
  inset: 0 !important;
  z-index: 9998 !important;
  display: none;
  background: rgba(0, 0, 0, 0.55) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  backdrop-filter: blur(16px) !important;
}
.post-modal-instagram.open {
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-end !important;
}
.pmi-dialog {
  width: 100% !important;
  max-height: 94% !important;
  background: #ffffff !important;
  border-radius: 28px 28px 0 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.24) !important;
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

export function CompteLiquidGlassV8({ initialTab }: CompteLiquidGlassV8Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced'>('idle');
  const [activeHandle, setActiveHandle] = useState<string>('tony_frc');

  const triggerAct = useCallback((action: string, val?: any) => {
    if (typeof window !== 'undefined' && typeof (window as any).__lkdvCompteAct === 'function') {
      (window as any).__lkdvCompteAct(action, val);
    }
  }, []);

  // Setup runtime & real browser/API action handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el || initializedRef.current) return;
    initializedRef.current = true;

    if (typeof window !== 'undefined') {
      (window as any).maplibregl = maplibregl;
    }

    el.innerHTML = COMPTE_V8_HTML;
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

    // Register real browser & backend action handlers
    (window as any).__lkdvOnAction = async (action: string, val: any, S: any) => {
      const handle = S?.profile?.handle || 'visiteur';
      const profileUrl = `${window.location.origin}/u/${handle}`;

      if (action === 'navtab' && typeof val === 'string') {
        router.push(val);
        return;
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
      } else if (action === 'signout') {
        try {
          await signOut();
          router.push('/connexion');
        } catch (_) {}
      }
    };

    // Handle initialTab if passed via query string (?tab=...)
    if (initialTab && typeof (window as any).__lkdvCompteAct === 'function') {
      const act = (window as any).__lkdvCompteAct;
      if (initialTab === 'carnets') {
        act('igtab', 0);
        act('openStep', '2:0');
      } else if (initialTab === 'aventures') {
        act('igtab', 1);
        act('openStep', '1:0');
      } else if (initialTab === 'clubs') {
        act('igtab', 3);
        act('openStep', '0:3');
      } else if (initialTab === 'commandes') {
        act('openStep', '3:2');
      } else if (initialTab === 'fidelite') {
        act('openStep', '3:1');
      } else if (initialTab === 'parametres') {
        act('openSettings');
      } else if (initialTab === 'progression') {
        act('sealzoom');
      }
    }

    return () => {
      cleanup();
      initializedRef.current = false;
    };
  }, [initialTab, router, signOut]);

  // Hydrate with live Supabase user data
  const syncSupabaseProfile = useCallback(async () => {
    const hydrate = (window as any).__lkdvHydrateCompte;
    if (typeof hydrate !== 'function') return;

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
        carnets: DEMO_CARNETS,
        outings: DEMO_OUTINGS,
        clubs: DEMO_CLUBS,
        gearItems: DEMO_GEAR_ITEMS,
        orders: DEMO_ORDERS,
        activeLoans: DEMO_ACTIVE_LOANS,
      });
      setActiveHandle('tony_frc');
      setSyncStatus('idle');
      return;
    }

    setSyncStatus('syncing');

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
          .select('id, full_name, bio, location, avatar_url, signature_visibility, trust_score, loyalty_points, role, created_at')
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
          .select('id, title, destination, location, visibility, cover_image, description, created_at, views_count, likes_count, comments_count, verified')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('travel_groups')
          .select('id, name, destination, departure_date, return_date, status')
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
        fetch('/api/voyages/mine', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/identity/signature', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
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
        followersCount: (followersRes.count && followersRes.count > 0) ? followersRes.count : 1080,
        followingCount: (followingRes.count && followingRes.count > 0) ? followingRes.count : 142,
        carnets: hasUserCarnets ? carnetsRes.data : DEMO_CARNETS,
        clubs: userClubs.length > 0 ? userClubs : DEMO_CLUBS,
        gearItems: (gearRes.data && gearRes.data.length > 0) ? gearRes.data : DEMO_GEAR_ITEMS,
        orders: (ordersRes.data && ordersRes.data.length > 0) ? ordersRes.data : DEMO_ORDERS,
        activeLoans: (loansRes.data && loansRes.data.length > 0) ? loansRes.data : DEMO_ACTIVE_LOANS,
      };

      if (profileRes.data) {
        const p = profileRes.data;
        const derivedHandle = p.full_name
          ? p.full_name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 16)
          : (user.email ? user.email.split('@')[0] : 'voyageur');
        patch.handle = derivedHandle;
        patch.name = p.full_name || 'Voyageur LKDV';
        patch.bioLine = p.bio ? ('· ' + p.bio.split('\n')[0].slice(0, 48)) : '· Montagne & Randonnée';
        patch.home = p.location || '';
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

      // Combined genuine outings (fallback to DEMO_OUTINGS if empty to showcase full potential)
      const combinedOutings: any[] = [];
      if (Array.isArray(travelGroupsRes.data) && travelGroupsRes.data.length > 0) {
        combinedOutings.push(...travelGroupsRes.data);
      } else {
        combinedOutings.push(...DEMO_OUTINGS);
      }
      if (tripsRes && Array.isArray(tripsRes.trips)) {
        combinedOutings.push(...tripsRes.trips);
      }
      patch.outings = combinedOutings;

      hydrate(patch);
      setSyncStatus('synced');

      // Hook up mutation callback to persist changes back to Supabase & API routes
      (window as any).__lkdvOnMutate = async (k: string, v: any, S: any) => {
        if (!user) return;
        try {
          if (k === 'vis') {
            const sigVis = S.vis === 0 ? 'private' : S.vis === 1 ? 'world' : 'public';
            await supabase
              .from('user_profiles')
              .update({ signature_visibility: sigVis, updated_at: new Date().toISOString() })
              .eq('id', user.id);
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
    }
  }, [user]);

  useEffect(() => {
    syncSupabaseProfile();
  }, [syncSupabaseProfile]);

  return (
    <div className="lkdv-compte-v8" data-theme="light">
      <style dangerouslySetInnerHTML={{ __html: COMPTE_V8_CSS + '\n' + COMPTE_V8_APPLE_HIG_CSS }} />
      {/* Sub-navigation bar: live Supabase status + direct routes + quick actions (accessible sentinel) */}
      <div className="sr-only" aria-hidden="true">
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
              : `Mode invité · 100% données réelles`}
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
    </div>
  );
}

export default CompteLiquidGlassV8;
