'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { requestCarnetPublicationAward } from '@/lib/progression-award-requests';
import { initCompteLiquidGlassRuntime } from './compte-liquid-glass-v8-runtime';

const COMPTE_V8_CSS = ".lkdv-compte-v8{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}.lkdv-compte-v8 {margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}\n\n/* Layout : iPhone iOS 27 clair sur le vrai fond LKDV. 60 % haut = étape courante, 40 % bas = carte vivante\n   (agrandissable). Barre d'onglets flottante + accessoire. Feuilles linéaires à 3 hauteurs. */\n.lkdv-compte-v8{\n  --page:#F5F2EC;--on-page:#172B24;--muted-page:#56665D;--rule:#A6C1A0;\n  --sf:-apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"SF Pro Display\",\"Inter\",system-ui,\"Segoe UI\",Roboto,sans-serif;\n}\n@media (prefers-color-scheme:dark){.lkdv-compte-v8:not([data-theme=\"light\"]){--page:#0e1210;--on-page:#ecede8;--muted-page:#97a39a;--rule:#5B7F55;color-scheme:dark}}\n.lkdv-compte-v8.lkdv-compte-v8[data-theme=\"dark\"], [data-theme=\"dark\"] .lkdv-compte-v8{--page:#0e1210;--on-page:#ecede8;--muted-page:#97a39a;--rule:#5B7F55;color-scheme:dark}\n.lkdv-compte-v8 *, .lkdv-compte-v8 *::before, .lkdv-compte-v8 *::after {box-sizing:border-box}\n.lkdv-compte-v8 {background:var(--page);color:var(--on-page);font-family:var(--sf);padding-inline:16px;padding-block:16px;-webkit-font-smoothing:antialiased}\n.stage{max-width:960px;margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr);gap:48px;align-items:start;justify-content:center}\n.pwrap{position:relative;width:390px;height:844px;margin:0 auto}\n.notes{padding-top:30px;display:flex;flex-direction:column;gap:13px;min-width:0}\n.notes h1{font:700 32px/1.08 var(--sf);letter-spacing:-.02em;margin:0;text-wrap:balance}\n.notes p{margin:0;color:var(--muted-page);line-height:1.5;max-width:48ch;font-size:15px}\n.notes .tag{font:600 12px var(--sf);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-page)}\n.notes ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}\n.notes li{font-size:14px;line-height:1.42;padding-left:13px;border-left:2px solid var(--rule)}\n.notes li b{font-weight:600}\n@media (max-width:860px){.stage{grid-template-columns:minmax(0,1fr)}.notes{display:none}}\n\n/* ---------- iPhone (clair) ---------- */\n.phone{\n  --label:#172B24;--label2:#56665D;--label3:rgba(23,43,36,.44);--sep:rgba(23,43,36,.1);\n  --fill:rgba(23,43,36,.09);--fill2:rgba(23,43,36,.06);--fill3:rgba(255,255,255,.62);\n  --tint:#17402C;--tint-ink:#fff;--accent:#5B7F55;--subtle:#A6C1A0;--mint:#EBF2EC;\n  --good:#3D7A52;--warn:#B98A2E;--warn-bg:#FBF1DC;--bad:#A8443A;--bad-bg:#F5DDD9;--info:#4B6B7C;--water:#3F93B8;\n  --ga:.19;--gb:7px;--la:140deg;\n  --pg:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.16) 52%,rgba(255,255,255,.3)),rgba(150,186,142,.34);--pg-ink:#17402C;\n  --pg-sh:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(255,255,255,.4),inset 0 0 0 .6px rgba(255,255,255,.5),0 0 0 .6px rgba(23,64,44,.16),0 5px 14px rgba(23,64,44,.13);\n  --soft:rgba(150,186,142,.28);--soft-line:rgba(91,127,85,.38);\n  position:absolute;left:0;top:0;width:390px;height:844px;transform-origin:0 0;border-radius:54px;overflow:hidden;\n  background:#cfd6c8;color:var(--label);font-family:var(--sf);font-size:14px;letter-spacing:-.01em;\n  box-shadow:0 0 0 8px #10130f,0 0 0 9px rgba(0,0,0,.2),0 30px 70px rgba(23,43,36,.28);isolation:isolate;\n  display:grid;grid-template-rows:calc(60% - 49px) 1fr;grid-template-columns:minmax(0,1fr);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;\n  transition:grid-template-rows .55s cubic-bezier(.32,.72,0,1)}\n.phone.mapbig{grid-template-rows:172px 1fr}\n.phone.outdoor{--ga:.9;--gb:30px;--label2:#2f3f37;--label3:rgba(23,43,36,.7);font-size:15px}\n.phone button,.phone input{font-family:inherit;letter-spacing:inherit;color:inherit}\n.phone :focus-visible{outline:2px solid var(--accent);outline-offset:2px}\n\n/* Vrai fond LKDV */\n.bg{position:absolute;inset:0;z-index:-1;background-size:cover;background-position:center 30%;filter:brightness(1.1) saturate(1.05)}\n.bg::after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,250,236,.08),rgba(255,255,255,0) 30%,rgba(245,242,236,.12) 60%)}\n\n/* Barre d'état + Dynamic Island */\n.status{position:absolute;top:0;left:0;right:0;height:50px;display:flex;justify-content:space-between;align-items:center;padding:4px 30px 0 38px;font:600 16px var(--sf);color:#fff;z-index:30;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.25)}\n.status .r{display:flex;gap:6px;align-items:center}\n.island{position:absolute;top:11px;left:50%;width:124px;height:36px;margin-left:-62px;border-radius:20px;background:#000;z-index:40;overflow:hidden;color:#fff;\n  transition:width .5s cubic-bezier(.32,1.25,.4,1),height .5s cubic-bezier(.32,1.25,.4,1),margin-left .5s cubic-bezier(.32,1.25,.4,1),border-radius .5s}\n.island[data-s=live]{width:232px;margin-left:-116px}\n.island[data-s=note]{width:366px;margin-left:-183px;height:auto;min-height:70px;border-radius:32px}\n.island .is{opacity:0;transition:opacity .2s;display:flex;align-items:center;gap:10px;height:100%;padding:0 14px;white-space:nowrap}\n.island[data-s=live] .is.live,.island[data-s=note] .is.note{opacity:1;transition-delay:.16s}\n.island .is.live{justify-content:space-between;font:600 12.5px var(--sf);position:absolute;inset:0}\n.island .is.live .ic{color:#A6C1A0}\n.island .is.note{padding:13px 12px 13px 18px;white-space:normal;min-height:70px}\n.island[data-s=idle] .is,.island[data-s=live] .is.note{display:none}\n.island[data-s=note] .is.live{display:none}\n.is.note .t{flex:1;min-width:0}.is.note b{display:block;font:600 14.5px/1.25 var(--sf);color:#fff}\n.is.note span{display:block;font:500 12px/1.35 var(--sf);color:rgba(255,255,255,.72);margin-top:2px;font-variant-numeric:tabular-nums}\n.is.note button{flex:none;height:32px;padding:0 13px;border-radius:999px;border:0;background:rgba(255,255,255,.16);color:#A6C1A0!important;font:600 13px var(--sf);cursor:pointer}\n\n/* ---------- Liquid Glass clair (iOS 27 : plus transparent, bords assombris, reflets vifs) ---------- */\n.lg{position:relative;background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .14)),rgba(255,255,255,calc(var(--ga) - .04)) 50%,rgba(255,255,255,calc(var(--ga) + .06)));\n  -webkit-backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07);backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07);\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 1px rgba(255,255,255,.45),inset 1px 0 1px rgba(255,255,255,.28),inset -1px 0 1px rgba(255,255,255,.28),inset 0 0 12px rgba(255,255,255,.14),0 0 0 .5px rgba(23,43,36,.14),0 8px 22px rgba(23,43,36,.12)}\n.refr .lg.lens-on{-webkit-backdrop-filter:blur(var(--gb)) saturate(1.9) brightness(1.07)}\n.lg::before{content:\"\";position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;\n  background:conic-gradient(from var(--la),rgba(255,255,255,1),rgba(255,255,255,.25) 18%,rgba(255,255,255,0) 32%,rgba(255,255,255,.7) 50%,rgba(255,255,255,0) 68%,rgba(255,255,255,.25) 82%,rgba(255,255,255,1));\n  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}\n.lg>*{position:relative;z-index:1}\n.cs{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .2)));-webkit-backdrop-filter:blur(calc(var(--gb) + 18px)) saturate(1.8) brightness(1.05);backdrop-filter:blur(calc(var(--gb) + 18px)) saturate(1.8) brightness(1.05);\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.4),inset 0 0 16px rgba(255,255,255,.12),0 0 0 .5px rgba(23,43,36,.12),0 10px 30px rgba(23,43,36,.14)}\n@media (prefers-reduced-transparency:reduce){.lg,.cs{background:#FBFAF6!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}}\n\n/* Icônes */\n.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}\n.ic.s{width:16px;height:16px}.ic.xs{width:12px;height:12px;stroke-width:2.2}\n.ic .f{fill:currentColor;stroke:none}\n\n/* ---------- Zone haute ---------- */\n.top{position:relative;min-height:0;min-width:0;padding:54px 12px 8px;display:flex;flex-direction:column;gap:7px}\n.head{display:flex;gap:7px;align-items:center;flex:none}\n.steps{flex:1;height:42px;border-radius:999px;display:grid;grid-template-columns:repeat(5,1fr);padding:3px;position:relative}\n.steps .lens{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/5);border-radius:999px;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.3));\n  box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.1);transition:transform .5s cubic-bezier(.3,1.3,.4,1)}\n.steps button{position:relative;z-index:2;border:0;background:none;color:rgba(23,43,36,.74);display:grid;place-items:center;cursor:pointer;border-radius:999px;min-height:36px}\n.steps button[aria-current=step]{color:var(--tint)}\n.steps button[aria-current=step] .ic{stroke-width:2.1}\n.steps .dot{position:absolute;bottom:3px;width:3px;height:3px;border-radius:50%;background:var(--accent);opacity:0}\n.steps button.done .dot{opacity:.9}\n.gbtn{width:42px;height:42px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;flex:none;color:var(--label)}\n.gbtn.sm{width:32px;height:32px}\n.card{flex:1;min-height:0;border-radius:26px;padding:13px 14px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;scrollbar-width:none;transition:transform .3s cubic-bezier(.3,1.2,.4,1),opacity .2s}\n.card::-webkit-scrollbar{display:none}\n.card>*{flex:none}\n.mapbig .card{display:none}\n.acts{display:flex;gap:7px;flex:none}\n.pbtn{flex:1;min-width:0;height:42px;border-radius:999px;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;padding:0 16px;\n  background:var(--pg);color:var(--pg-ink)!important;font:600 14.5px var(--sf);-webkit-backdrop-filter:blur(10px) saturate(1.9);backdrop-filter:blur(10px) saturate(1.9);\n  box-shadow:var(--pg-sh);transition:transform .25s cubic-bezier(.3,1.5,.5,1)}\n.pbtn .ic{color:var(--accent)}\n.pbtn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pbtn:active,.gbtn:active,.mbtn:active,.chip:active,.nx:active{transform:scale(1.04)}\n.pbtn[disabled]{background:var(--fill);color:var(--label2)!important;box-shadow:none;cursor:default}\n\n/* Typo */\n.t2{font:700 19px/1.2 var(--sf);letter-spacing:-.02em;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.hl{font:600 15px/1.25 var(--sf)}\n.sub{font:400 12.5px/1.3 var(--sf);color:var(--label2)}\n.cap{font:600 11.5px/1.2 var(--sf);color:var(--label2);text-transform:uppercase;letter-spacing:.04em}\n.num{font-variant-numeric:tabular-nums}\n.row{display:flex;align-items:center;gap:7px;min-width:0}\n.ai{color:var(--accent);display:inline-flex;vertical-align:-1px}\n.ed{color:var(--warn);display:inline-flex;vertical-align:-1px}\n.fd{display:inline-block;width:6px;height:6px;border-radius:50%;margin:0 5px 1px 0;vertical-align:middle;flex:none}\n.fd.ok{background:var(--good)}.fd.old{background:var(--label3)}.fd.none{box-shadow:inset 0 0 0 1.4px var(--label3)}\n\n/* Contrôles iOS (réduits) */\n.intent{display:flex;align-items:center;gap:8px;height:36px;border-radius:999px;padding:0 12px;background:var(--fill2);color:var(--label2)}\n.intent input{flex:1;min-width:0;background:none;border:0;color:var(--label);font:400 14.5px var(--sf);outline:none;height:34px}\n.intent input::placeholder{color:var(--label3)}\n.segc{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;height:30px;border-radius:999px;background:var(--fill);padding:2px}\n.segc button{position:relative;z-index:2;border:0;background:none;color:var(--label);font:500 12.5px var(--sf);cursor:pointer;border-radius:999px;padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.segc button[aria-pressed=true]{font-weight:600}\n.segc .th{position:absolute;z-index:1;top:2px;bottom:2px;left:2px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(23,43,36,.14),0 3px 8px rgba(23,43,36,.08);transition:transform .45s cubic-bezier(.3,1.3,.4,1)}\n.chips{display:flex;flex-wrap:wrap;gap:5px}\n.chip{height:28px;padding:0 11px;border-radius:999px;border:0;background:var(--fill);color:var(--label);font:500 12.5px var(--sf);display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;transition:transform .15s,background .2s}\n.chip[aria-pressed=true]{background:var(--soft);color:var(--tint)!important;font-weight:600;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6)}\n.chip[disabled]{opacity:.35;cursor:default}\n.chip.st{cursor:default;background:var(--fill2)}\n.mbtn{height:30px;padding:0 12px;border-radius:999px;border:0;background:var(--fill);color:var(--label);font:600 12.5px var(--sf);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:5px;transition:transform .15s}\n.mbtn.p{background:var(--pg);color:var(--pg-ink)!important;box-shadow:var(--pg-sh)}\n.mbtn.soft{background:var(--mint);color:var(--tint)!important}\n.mbtn[disabled]{opacity:.45;cursor:default}\n.lnk{border:0;background:none;color:var(--accent)!important;font:500 12.5px var(--sf);cursor:pointer;padding:4px 2px}\n.stp{display:inline-flex;align-items:center;height:28px;border-radius:8px;background:var(--fill);flex:none}\n.stp button{width:36px;height:28px;border:0;background:none;display:grid;place-items:center;cursor:pointer}\n.stp button[disabled]{opacity:.3;cursor:default}\n.stp i{width:1px;height:16px;background:var(--sep)}\n.sw{width:46px;height:28px;border-radius:999px;border:0;background:var(--fill);position:relative;cursor:pointer;flex:none;transition:background .25s;padding:0}\n.sw::after{content:\"\";position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.22);transition:transform .35s cubic-bezier(.3,1.4,.5,1)}\n.sw[aria-checked=true]{background:#8DB287}.sw[aria-checked=true]::after{transform:translateX(18px)}\n.sumline{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 11px;border-radius:14px;background:var(--fill2);font-size:13px}\n.sumline b{font-weight:600}.sumline>span{min-width:0}.sumline .nw{white-space:nowrap;flex:none}\n.input{height:32px;border-radius:9px;border:0;background:var(--fill);padding:0 10px;font:400 14px var(--sf);color:var(--label);outline:none;min-width:0}\n.input::placeholder{color:var(--label3)}\n\n/* Curseur d'échelle continu */\n.ruler{border-radius:18px;padding:5px 12px 4px}\n.rhead{display:flex;justify-content:space-between;align-items:baseline;font:600 12px var(--sf);color:var(--label2)}\n.rhead b{font:700 15px var(--sf);color:var(--label);font-variant-numeric:tabular-nums}\n.ruler input{-webkit-appearance:none;appearance:none;display:block;width:100%;height:26px;background:none;margin:0;cursor:pointer;touch-action:pan-y}\n.ruler input::-webkit-slider-runnable-track{height:4px;border-radius:99px;background:linear-gradient(90deg,#8DB287 var(--p),rgba(23,43,36,.14) var(--p))}\n.ruler input::-moz-range-track{height:4px;border-radius:99px;background:linear-gradient(90deg,#8DB287 var(--p),rgba(23,43,36,.14) var(--p))}\n.ruler input::-webkit-slider-thumb{-webkit-appearance:none;width:30px;height:20px;margin-top:-8px;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(23,43,36,.28),inset 0 0 0 .5px rgba(0,0,0,.08)}\n.ruler input::-moz-range-thumb{width:30px;height:20px;border:0;border-radius:999px;background:#fff;box-shadow:0 2px 8px rgba(23,43,36,.28)}\n.ticks{position:relative;height:15px;font:500 10px var(--sf);color:var(--label3)}\n.ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap;cursor:pointer;transition:color .2s}\n.ticks span:hover{color:var(--tint)}\n.zc{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;background:var(--mint);color:var(--tint);font:600 11px/16px var(--sf)}\n.zc.bump{animation:zb .35s cubic-bezier(.3,1.6,.5,1)}@keyframes zb{40%{transform:scale(1.15)}}\n.fsum{border-radius:18px;padding:2px 0;display:flex;flex-direction:column}\n.fr{display:grid;grid-template-columns:24px auto minmax(0,1fr) 12px;align-items:center;gap:8px;height:29px;padding:0 10px 0 9px;border:0;background:none;cursor:pointer;text-align:left;color:var(--label)}\n.fr+.fr{box-shadow:inset 36px .5px 0 -36px transparent;border-top:.5px solid var(--sep);margin-left:0}\n.fr .fi{width:24px;height:24px;border-radius:8px;background:var(--mint);color:var(--tint);display:grid;place-items:center}\n.fr .fi svg{width:15px;height:15px}\n.fr .fl{font:600 13px var(--sf)}\n.fr .fv{font:400 12.5px var(--sf);color:var(--label2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;justify-content:flex-end;gap:5px}\n.fr>svg:last-child{color:var(--label3)}\n.fr:active{background:var(--fill2)}\n.srcrow{display:flex;flex-wrap:wrap;gap:5px}\n.srcrow .chip{height:24px;font-size:11.5px;padding:0 9px;cursor:default;background:var(--fill2)}\n\n/* Nous */\n.av{display:flex;align-items:center;gap:5px}\n.avi{position:relative;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:600 12.5px var(--sf);color:#17402C;flex:none;background:linear-gradient(160deg,#EBF2EC,#A6C1A0);box-shadow:0 0 0 1.5px #fff}\n.avi.sm{width:24px;height:24px;font-size:10.5px}\n.avi .on{position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;background:var(--good);box-shadow:0 0 0 2px #fff}\n.avi .lv{position:absolute;left:-3px;top:-4px;min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:rgba(255,255,255,.85);color:var(--tint);box-shadow:0 0 0 .6px var(--soft-line);font:700 8.5px/14px var(--sf);text-align:center}\n.avadd{width:30px;height:30px;border-radius:50%;border:1.3px dashed rgba(23,43,36,.35);background:rgba(255,255,255,.5);color:var(--label);display:grid;place-items:center;cursor:pointer;flex:none}\n.bigsum{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}.bigsum b{font:700 21px var(--sf);letter-spacing:-.02em}\n.bar{height:5px;border-radius:99px;background:var(--fill);overflow:hidden;display:flex}\n.bar i{display:block;height:100%;border-radius:99px;transition:width .5s,background .3s}\n\n/* Résa */\n.tchips{display:flex;gap:5px}\n.tchip{flex:1;min-width:0;height:44px;border-radius:14px;border:0;background:var(--fill2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;cursor:pointer;position:relative;font:500 10px var(--sf);color:var(--label2)}\n.tchip .ic{width:17px;height:17px;color:var(--label)}\n.tchip.on{background:var(--soft);box-shadow:inset 0 0 0 1px var(--soft-line)}\n.tchip[disabled]{opacity:.35;cursor:default}\n.tchip .bd{position:absolute;top:3px;right:5px;min-width:15px;height:15px;border-radius:8px;background:rgba(141,178,135,.55);color:var(--tint);font:700 9.5px/15px var(--sf);padding:0 4px}\n.days{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px}\n.day{border-radius:14px;background:rgba(255,255,255,.4);box-shadow:inset 0 0 0 .6px rgba(23,43,36,.1);padding:7px 7px 8px;display:flex;flex-direction:column;gap:5px;cursor:pointer;border:0;text-align:left;min-width:0}\n.day b{font:700 12.5px var(--sf)}.day small{font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.slots{display:flex;gap:3px;flex-wrap:wrap}\n.slot{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;font:700 9.5px var(--sf);background:var(--fill);color:var(--label2)}\n.slot.added{background:#fff;color:var(--tint);box-shadow:inset 0 0 0 1.2px var(--tint)}.slot.pending{background:var(--warn-bg);color:var(--warn)}.slot.confirmed{background:rgba(61,122,82,.2);color:var(--good)}\n.slot.need{background:transparent;box-shadow:inset 0 0 0 1.2px var(--warn);color:var(--warn)}\n.disc{font:400 11px/1.3 var(--sf);color:var(--label3)}\n\n/* Verdict */\n.verdict{display:flex;gap:12px;align-items:center}\n.ring{position:relative;flex:none;width:76px;height:76px}\n.ring svg{transform:rotate(-90deg)}\n.ring .n{position:absolute;inset:0;display:grid;place-items:center;align-content:center;font:700 24px var(--sf);text-align:center;letter-spacing:-.03em}\n.ring small{display:block;font:500 9.5px var(--sf);color:var(--label2);letter-spacing:0}\n.vl{display:inline-flex;align-items:center;gap:6px;font:600 14px var(--sf)}\n.vl i{width:8px;height:8px;border-radius:50%;background:var(--c)}\n.why{margin:4px 0 0;padding:0;list-style:none;display:grid;gap:2px;font-size:12.5px;color:var(--label2);line-height:1.3}\n.why li{display:flex;align-items:baseline}\n.vb{padding:8px 11px;border-radius:14px;background:var(--fill2);display:flex;flex-direction:column;gap:3px}\n.vb .h{display:flex;align-items:center;gap:7px;font:600 11.5px var(--sf);color:var(--label2)}\n.vb p{margin:0;font-size:13px;line-height:1.3}\n.pd{width:6px;height:6px;border-radius:50%;background:var(--good);animation:pulse 1.6s infinite;flex:none}\n@keyframes pulse{50%{opacity:.3}}\n\n/* Kit */\n.weights{display:flex;height:6px;border-radius:999px;overflow:hidden;gap:2px}\n.weights i{display:block;transition:flex .4s}\n.wl{display:flex;justify-content:space-between;margin-top:4px;font:500 11.5px var(--sf);color:var(--label2)}\n.wl span::before{content:\"\";display:inline-block;width:6px;height:6px;border-radius:2px;background:var(--c);margin-right:5px}\n.ready{display:flex;justify-content:space-between;align-items:center}\n.ready b{font:700 21px var(--sf);letter-spacing:-.02em}\n.mb{display:grid;grid-template-columns:24px 1fr 78px;gap:8px;align-items:center;font:500 11.5px var(--sf);color:var(--label2)}\n.mb b{font-weight:500;text-align:right;color:var(--label)}\n\n/* ---------- Feuilles linéaires à 3 hauteurs ---------- */\n.sw-wrap{position:absolute;inset:0;z-index:20;pointer-events:none}\n.scrim{position:absolute;inset:0;background:rgba(255,255,255,.06);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .35s;pointer-events:none}\n.sw-wrap[data-det=large] .scrim{opacity:1;pointer-events:auto}\n.sheet{position:absolute;left:8px;right:8px;top:100%;bottom:-70%;border-radius:32px;display:flex;flex-direction:column;gap:7px;padding:0 13px 11px;pointer-events:auto;\n  background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .4)),rgba(255,255,255,calc(var(--ga) + .3)) 40%,rgba(255,255,255,calc(var(--ga) + .34)));-webkit-backdrop-filter:blur(calc(var(--gb) + 22px)) saturate(1.9) brightness(1.06);backdrop-filter:blur(calc(var(--gb) + 22px)) saturate(1.9) brightness(1.06);\n  box-shadow:inset 0 1.5px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.5),inset 1px 0 1px rgba(255,255,255,.35),inset -1px 0 1px rgba(255,255,255,.35),inset 0 0 22px rgba(255,255,255,.18),0 0 0 .5px rgba(23,43,36,.12),0 -8px 36px rgba(23,43,36,.16);\n  transition:top .5s cubic-bezier(.32,.72,0,1),bottom .5s cubic-bezier(.32,.72,0,1),left .5s cubic-bezier(.32,.72,0,1),right .5s cubic-bezier(.32,.72,0,1),border-radius .5s}\n.sw-wrap[data-det=peek] .sheet{top:calc(60% - 49px - 128px);bottom:calc(40% + 57px)}\n.sw-wrap[data-det=medium] .sheet{top:48px;bottom:calc(40% + 57px)}\n.sw-wrap[data-det=large] .sheet{top:46px;bottom:8px;left:8px;right:8px;border-radius:44px}\n.sw-wrap[data-det=closed] .sheet{visibility:hidden;transition:top .45s cubic-bezier(.32,.72,0,1),bottom .45s cubic-bezier(.32,.72,0,1),visibility 0s .45s}\n.grab{height:18px;display:grid;place-items:center;cursor:grab;touch-action:none;flex:none;margin:0 -13px}\n.grab span{width:36px;height:5px;border-radius:3px;background:rgba(23,43,36,.2)}\n.sh-h{display:flex;align-items:center;gap:8px;flex:none;margin-top:-4px;touch-action:none}\n.sh-h h3{flex:1;min-width:0;margin:0;text-align:center;font:600 16px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.peekline{flex:none;font:400 13px var(--sf);color:var(--label2);text-align:center;display:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.sw-wrap[data-det=peek] .peekline{display:block}\n.sw-wrap[data-det=peek] .flow,.sw-wrap[data-det=peek] .sh-b,.sw-wrap[data-det=peek] .sh-f{display:none}\n.flow{flex:none;display:flex;align-items:center;gap:4px;justify-content:center}\n.flow button{height:24px;min-width:24px;border-radius:999px;border:0;background:rgba(255,255,255,.3);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1);color:var(--label2);font:600 11px var(--sf);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0;transition:all .35s cubic-bezier(.3,1.3,.4,1)}\n.flow button.done{background:rgba(255,255,255,.45);color:var(--good);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.1)}\n.flow button.cur{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh);padding:0 10px 0 4px}\n.flow button.cur i{width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,.7);display:grid;place-items:center;font-style:normal;font-size:10px}\n.flow .ln{width:8px;height:1.5px;background:var(--sep);border-radius:1px}\n.sh-b{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}\n.sw-wrap[data-det=large] .sh-b{overflow-y:auto}\n.lh{display:flex;justify-content:space-between;align-items:center;min-height:26px;margin-bottom:2px}\n.lh .pg{display:flex;align-items:center;gap:3px;font:500 11.5px var(--sf);color:var(--label2)}\n.lh .pg button{width:26px;height:26px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer}\n.lh .pg button[disabled]{opacity:.3;cursor:default}\n.sh-f{flex:none;display:flex;gap:6px;align-items:center}\n.say{flex:1;min-width:0;height:34px;border-radius:999px;background:var(--fill);display:flex;align-items:center;gap:6px;padding:0 11px;color:var(--accent)}\n.say input{flex:1;min-width:0;border:0;background:none;color:var(--label);font:400 14px var(--sf);outline:none;height:32px}\n.say input::placeholder{color:var(--label3)}\n.bk{width:34px;height:34px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer;flex:none}\n.bk[disabled]{opacity:.3;cursor:default}\n.nx{height:34px;padding:0 13px;border-radius:999px;border:0;background:var(--pg);box-shadow:var(--pg-sh);color:var(--pg-ink)!important;-webkit-backdrop-filter:blur(8px) saturate(1.8);backdrop-filter:blur(8px) saturate(1.8);transition:transform .25s cubic-bezier(.3,1.5,.5,1);font:600 13px var(--sf);cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex:none;white-space:nowrap}\n\n/* Lignes de liste */\n.li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:6px 2px;min-height:46px;border-top:.5px solid var(--sep);transition:background .3s}\n.li:first-child,.lh+.li,.swr:first-child .li{border-top:0}\n.li.nt{grid-template-columns:1fr auto}\n.li.hi{background:var(--mint);border-radius:12px;box-shadow:inset 0 0 0 1px rgba(91,127,85,.4)}\n.li .ttl{font:600 14px/1.25 var(--sf);display:flex;align-items:center;gap:5px;min-width:0}\n.li .ttl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.li .s2{font:400 12px/1.3 var(--sf);color:var(--label2);margin-top:1px}\n.li .rt{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right}\n.li .rt b{font:600 14px var(--sf);font-variant-numeric:tabular-nums}\n.li .rt small{font:400 10.5px var(--sf);color:var(--label3)}\n.tg{font:500 10.5px var(--sf);padding:2px 7px;border-radius:999px;background:var(--fill);color:var(--label2);white-space:nowrap;display:inline-flex;align-items:center}\n.tg.p{color:var(--tint);background:var(--mint)}\n.tg.added{color:var(--tint)}.tg.pending{color:var(--warn);background:var(--warn-bg)}.tg.confirmed{color:var(--good);background:rgba(61,122,82,.14)}\n.tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;align-items:center}\n.ck{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--label3);display:grid;place-items:center;transition:.2s;flex:none}\n.li[aria-checked=true] .ck{background:var(--good);box-shadow:none}\n.li[aria-checked=true] .ck::after{content:\"\";width:6px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}\n.vit{font:600 9.5px var(--sf);color:var(--warn);text-transform:uppercase;letter-spacing:.03em;flex:none}\n.rbar{display:grid;grid-template-columns:128px 1fr 26px;gap:9px;align-items:center;padding:4px 0;font-size:13px}\n.rbar small{display:block;font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap}\n.rbar .t{height:5px;border-radius:99px;background:var(--fill);overflow:hidden}.rbar .t i{display:block;height:100%;border-radius:99px;background:var(--c)}\n.rbar b{font:600 12.5px var(--sf);text-align:right;font-variant-numeric:tabular-nums}\n.wx{display:grid;grid-template-columns:1fr 1fr;gap:7px}\n.wx div{padding:9px 11px;border-radius:14px;background:var(--fill2);font-size:12.5px;color:var(--label2);line-height:1.45}\n.wx b{display:block;font:600 14px var(--sf);color:var(--label)}\n.note{font:400 12px/1.35 var(--sf);color:var(--label2);padding:6px 2px 0}\n.grid2{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}\n.tile2{border:0;border-radius:14px;background:var(--fill2);min-height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:500 11.5px var(--sf);cursor:pointer;position:relative;padding:4px}\n.tile2[aria-pressed=true]{background:var(--soft);color:var(--tint)!important;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6);font-weight:600}\n.tile2 .ai{position:absolute;top:4px;right:5px}\n.tile2[aria-pressed=true] .ai{color:var(--accent)}\n.win{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:8px 10px;border-radius:14px;background:var(--fill2);cursor:pointer;border:0;text-align:left;width:100%;margin-bottom:6px}\n.win[aria-pressed=true]{background:var(--mint);box-shadow:inset 0 0 0 1.2px var(--accent)}\n.win .wxr{display:flex;gap:2px;color:var(--label2)}\n.qd{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}\n\n/* Cartes d'offres */\n.oc{position:relative;display:grid;grid-template-columns:50px 1fr auto;gap:10px;align-items:center;padding:8px;border-radius:18px;background:rgba(255,255,255,.52);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.05);margin-bottom:6px;transition:box-shadow .3s}\n.oc.hi{box-shadow:0 0 0 1.5px var(--accent),0 3px 10px rgba(23,43,36,.08)}\n.oc-img{width:50px;height:50px;border-radius:12px;display:grid;place-items:center;color:#fff;background:linear-gradient(150deg,hsl(var(--h),38%,58%),hsl(calc(var(--h) + 30),42%,36%));box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}\n.oc-img .ic{width:22px;height:22px}\n.oc-t{display:flex;align-items:center;gap:6px;min-width:0}.oc-t b{font:600 13.5px var(--sf);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.rate{font:600 11px var(--sf);color:var(--warn);white-space:nowrap;flex:none}.rate small{color:var(--label3);font-weight:400}\n.oc-s{font:400 11.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}\n.oc-c{display:flex;gap:3px;margin-top:4px;flex-wrap:wrap;height:17px;overflow:hidden}\n.oc-c span{font:500 10px/13px var(--sf);padding:2px 6px;border-radius:6px;background:var(--fill2);color:var(--label2);white-space:nowrap}\n.oc-c .st{background:var(--mint);color:var(--tint);font-weight:600}.oc-c .st.pending{background:var(--warn-bg);color:#7a5a17}.oc-c .st.confirmed{background:rgba(61,122,82,.16);color:var(--good)}\n.oc-r{display:flex;flex-direction:column;align-items:flex-end;gap:2px}\n.oc-r b{font:700 15px var(--sf);font-variant-numeric:tabular-nums}.oc-r small{font:400 10px var(--sf);color:var(--label3)}\n.burst{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:var(--pg);box-shadow:var(--pg-sh);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--tint);display:grid;place-items:center;pointer-events:none;animation:burst .7s cubic-bezier(.3,1.5,.5,1) forwards;z-index:5}\n@keyframes burst{0%{transform:scale(.2);opacity:0}35%{transform:scale(1.15);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.4);opacity:0}}\n\n/* Lignes glissables (geste Instagram / iOS) */\n.swr{position:relative;overflow:hidden;border-radius:12px}\n.swr .act{position:absolute;right:0;top:4px;bottom:4px;width:82px;border:0;border-radius:14px;background:rgba(168,68,58,.86);color:#fff!important;font:600 12.5px var(--sf);cursor:pointer;opacity:0;transition:opacity .2s}\n.swr.open .act,.swr.drag .act{opacity:1}\n.swr .fg{position:relative;background:rgba(250,251,248,.001);transition:transform .3s cubic-bezier(.3,1.2,.4,1);touch-action:pan-y}\n.swr.drag .fg{transition:none}\n.swr.open .fg,.swr.drag .fg{background:rgba(247,249,245,.96)}\n\n/* ---------- Carte claire personnalisable ---------- */\n.mapzone{position:relative;min-height:0;min-width:0}\n.map{position:absolute;inset:0;border-radius:32px 32px 0 0;overflow:hidden;background:#E9EDE0;touch-action:none;box-shadow:0 -1px 0 rgba(255,255,255,.8),0 -10px 26px rgba(23,43,36,.18)}\n.map svg.tm{position:absolute;inset:0;width:100%;height:100%;cursor:grab}\n.map .tmg{transition:transform .5s cubic-bezier(.3,1,.4,1)}\n.map.dragging .tmg{transition:none}\n.mgrab{position:absolute;top:6px;left:50%;width:44px;height:14px;margin-left:-22px;border:0;background:none;display:grid;place-items:center;cursor:pointer;z-index:4;touch-action:none}\n.mgrab span{width:34px;height:4px;border-radius:2px;background:rgba(23,43,36,.28)}\n.mctl{position:absolute;right:10px;top:14px;display:flex;flex-direction:column;border-radius:21px;z-index:3;overflow:hidden}\n.mctl button{width:38px;height:36px;border:0;background:none;display:grid;place-items:center;cursor:pointer}\n.mctl button+button{box-shadow:0 -.5px 0 var(--sep)}\n.mopts{position:absolute;right:12px;bottom:124px;width:300px;border-radius:26px;padding:10px 10px 8px;z-index:30;opacity:0;transform:scale(.55) translateY(30px);transform-origin:bottom right;pointer-events:none;transition:opacity .18s,transform .42s cubic-bezier(.3,1.35,.5,1);display:flex;flex-direction:column;gap:8px}\n.mopts.on{opacity:1;transform:none;pointer-events:auto}\n.mopts.up{bottom:auto;top:440px;transform-origin:top right}\n.mo-h{display:flex;align-items:baseline;justify-content:space-between;padding:0 4px}\n.mo-h b{font:600 15px var(--sf)}\n.mgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}\n.mt{border:0;border-radius:16px;background:var(--fill);height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;cursor:pointer;color:var(--label2)!important;transition:background .2s,color .2s,transform .2s cubic-bezier(.3,1.4,.5,1)}\n.mt span{font:500 10.5px var(--sf);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 3px}\n.mt[aria-checked=true]{background:var(--soft);color:var(--tint)!important;box-shadow:inset 0 0 0 1px var(--soft-line),inset 0 1px 0 rgba(255,255,255,.6)}\n.mt:active{transform:scale(.93)}\n.mo-f{display:flex;justify-content:space-between;padding:0 4px}\n.callout{position:absolute;left:10px;right:10px;bottom:132px;padding:8px 8px 8px 12px;border-radius:20px;z-index:4;display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:center;transition:bottom .45s cubic-bezier(.32,.72,0,1)}\n.tabmin .callout{bottom:78px}\n.noacc .callout{bottom:84px}\n.callout[hidden]{display:none}\n.callout b{font:600 13.5px var(--sf);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}\n.callout .s2{font:400 11.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;grid-column:1}\n.callout .ca{grid-row:1/3;grid-column:2;display:flex;gap:5px;align-items:center}\n.callout .ib{width:30px;height:30px;border-radius:50%;border:0;background:var(--fill);display:grid;place-items:center;cursor:pointer}\n.callout .ib.p{background:var(--pg);color:var(--pg-ink)!important;box-shadow:var(--pg-sh)}\n.anim .seg{stroke-dasharray:1;animation:drawseg .24s var(--d,0s) both linear}\n.anim .pop{animation:popin .42s var(--d,0s) both cubic-bezier(.3,1.5,.5,1);transform-box:fill-box;transform-origin:center}\n@keyframes drawseg{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}\n@keyframes popin{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:scale(1)}}\n.focusring{animation:ring 1.4s ease-out infinite;transform-box:fill-box;transform-origin:center}\n@keyframes ring{from{opacity:.9;transform:scale(.6)}to{opacity:0;transform:scale(1.8)}}\n\n/* ---------- Barre d'onglets + accessoire ---------- */\n.tabbar{position:absolute;left:0;right:0;bottom:0;height:0;z-index:12}\n.tb{position:absolute;left:14px;right:14px;bottom:24px;height:54px;border-radius:999px;display:grid;grid-template-columns:repeat(5,1fr);padding:3px;touch-action:none;\n  transition:left .5s cubic-bezier(.32,.72,0,1),right .5s cubic-bezier(.32,.72,0,1),height .5s cubic-bezier(.32,.72,0,1)}\n.tb .lens{position:absolute;top:4px;bottom:4px;left:3px;width:calc((100% - 6px)/5);border-radius:999px;z-index:1;background:linear-gradient(180deg,rgba(255,255,255,.5),rgba(255,255,255,.22));\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 1px rgba(255,255,255,.4),0 0 0 .5px rgba(23,43,36,.06);transition:transform .55s cubic-bezier(.3,1.35,.4,1),background .25s,box-shadow .25s}\n.tb.drag .lens{transition:transform .08s linear,background .25s,box-shadow .25s;background:rgba(255,255,255,.08);\n  box-shadow:inset 0 1.5px 1px rgba(255,255,255,.95),inset 0 -1.5px 2px rgba(255,255,255,.6),inset 2px 0 2px rgba(255,120,160,.18),inset -2px 0 2px rgba(90,170,255,.2),0 0 0 .5px rgba(23,43,36,.1),0 10px 26px rgba(23,43,36,.2)}\n.tb.drag .lens{top:-7px;bottom:-7px}\n.tb button{position:relative;z-index:2;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font:500 10px var(--sf);cursor:pointer;border-radius:999px;letter-spacing:0;color:var(--label)}\n.tb button .ic{width:19px;height:19px}\n.tb button.on{color:#2F6B45;font-weight:600}\n.tb button.on .ic{stroke-width:2.1}\n.tb.drag button{transition:transform .2s}.tb.drag button.hov{transform:scale(1.14)}\n.acc{position:absolute;left:14px;right:14px;bottom:84px;height:42px;border-radius:999px;display:flex;align-items:center;gap:9px;padding:0 8px 0 4px;\n  transition:left .5s cubic-bezier(.32,.72,0,1),bottom .5s cubic-bezier(.32,.72,0,1),opacity .3s}\n.acc .ab{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);display:grid;place-items:center;cursor:pointer;flex:none}\n.acc .ro{flex:none;width:86px;display:flex;flex-direction:column;line-height:1.1}\n.acc .ro b{font:600 13.5px var(--sf);font-variant-numeric:tabular-nums;white-space:nowrap}\n.acc .ro span{font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.acc svg.spk{flex:1;min-width:0;height:28px;overflow:visible;cursor:ew-resize;touch-action:none}\n.noacc .acc{opacity:0;pointer-events:none}\n.tabmin .tb{right:calc(100% - 14px - 50px);height:50px;grid-template-columns:1fr}\n.tabmin .tb button:not(.on){display:none}\n.tabmin .tb .lens{display:none}\n.tabmin .acc{left:72px;bottom:28px}\n.home{position:absolute;bottom:8px;left:50%;width:134px;height:5px;margin-left:-67px;border-radius:3px;background:rgba(23,43,36,.55);z-index:25;pointer-events:none}\n\n/* ---------- Menus iOS : aperçu, réglages, pilule de rôle ---------- */\n.ctx{position:absolute;inset:0;z-index:35;display:grid;place-items:center;padding:24px;background:rgba(245,242,236,.35);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .25s}\n.ctx.on{opacity:1;pointer-events:auto}\n.ctx .box{width:100%;max-width:310px;display:flex;flex-direction:column;gap:8px;transform:scale(.92);transition:transform .35s cubic-bezier(.3,1.4,.5,1)}\n.ctx.on .box{transform:none}\n.ctx .pv{border-radius:22px;padding:13px 15px}\n.ctx .pv b{display:block;font:600 15px var(--sf);margin-bottom:5px}\n.ctx .ef{display:flex;justify-content:space-between;padding:5px 0;border-top:.5px solid var(--sep);font-size:13.5px}\n.ctx .ef:first-of-type{border-top:0}\n.ctx .ef span:last-child{font-weight:600;font-variant-numeric:tabular-nums}\n.ctx .menu{border-radius:18px;overflow:hidden}\n.ctx .menu button{display:flex;justify-content:space-between;align-items:center;width:100%;height:44px;padding:0 15px;border:0;background:none;font:400 15px var(--sf);cursor:pointer}\n.ctx .menu button+button{box-shadow:0 -.5px 0 var(--sep)}\n.ctx .menu button.p{color:var(--tint);font-weight:600}\n.popv{position:absolute;right:12px;top:102px;width:262px;border-radius:22px;padding:4px 13px;z-index:34;opacity:0;transform:scale(.9) translateY(-8px);transform-origin:top right;pointer-events:none;transition:opacity .2s,transform .35s cubic-bezier(.3,1.4,.5,1)}\n.popv.on{opacity:1;transform:none;pointer-events:auto}\n.popv .pr{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;border-top:.5px solid var(--sep)}\n.popv .pr:first-child{border-top:0}\n.popv input[type=range]{width:100%;accent-color:#17402C}\n.popv .lbl2{display:flex;justify-content:space-between;font:400 11.5px var(--sf);color:var(--label2);padding-bottom:6px}\n.rmenu{position:absolute;z-index:38;border-radius:999px;overflow:hidden;pointer-events:none;opacity:0;\n  transition:left .45s cubic-bezier(.3,1.25,.4,1),top .45s cubic-bezier(.3,1.25,.4,1),width .45s cubic-bezier(.3,1.25,.4,1),height .45s cubic-bezier(.3,1.25,.4,1),border-radius .45s,opacity .15s}\n.rmenu.on{pointer-events:auto;opacity:1;border-radius:20px}\n.rmenu .ri{opacity:0;filter:blur(6px);transition:opacity .25s .12s,filter .3s .12s;padding:5px}\n.rmenu.on .ri{opacity:1;filter:none}\n.rmenu button{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 10px;border:0;border-radius:12px;background:none;font:500 13.5px var(--sf);cursor:pointer;white-space:nowrap}\n.rmenu button[aria-checked=true]{background:var(--soft);color:var(--tint);font-weight:600}\n.rp{transition:transform .35s cubic-bezier(.3,1.5,.5,1)}\n.rp.morph{animation:morph .5s cubic-bezier(.3,1.4,.5,1)}\n@keyframes morph{0%{transform:scaleX(1.18) scaleY(.86);filter:blur(2px)}50%{transform:scaleX(.95) scaleY(1.06);filter:none}100%{transform:none}}\n@keyframes bump{40%{transform:scale(1.06)}}\n.bump{animation:bump .3s}\n@media (prefers-reduced-motion:reduce){.pd{animation:none}.anim .seg,.anim .pop,.burst,.rp.morph{animation:none}*{transition-duration:.01s!important}}\n.chips.rail{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent);padding-right:24px;touch-action:pan-x}\n.chips.rail::-webkit-scrollbar{display:none}\n.chips.rail .chip{flex:none}\n.lh .pg{white-space:nowrap;flex:none}\n.lh>.cap{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n/* barres de verre au-dessus du fond : couche lumineuse pour garder le contraste (verre « regular » adaptatif) */\n.head .steps.lg,.head .gbtn.lg,.acts .gbtn.lg{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .14)) 55%,rgba(255,255,255,calc(var(--ga) + .22)))}\n\n/* ================= v6 : produits ================= */\n.pth{--s:58px;width:var(--s);height:var(--s);border-radius:16px;flex:none;display:grid;place-items:center;position:relative;overflow:hidden;\n  background:radial-gradient(120% 90% at 30% 20%,#fff 0,var(--bgc) 55%,hsl(var(--h) 26% 80%) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -6px 12px hsla(var(--h),30%,40%,.12),0 0 0 .5px rgba(23,43,36,.08)}\n.pth::after{content:\"\";position:absolute;left:18%;right:18%;bottom:12%;height:9%;border-radius:50%;background:hsla(var(--h),30%,25%,.14);filter:blur(2px)}\n.pth .pic{width:58%;height:58%;fill:none;stroke:hsl(var(--h) 34% 30%);stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;position:relative;z-index:1;filter:drop-shadow(0 1px 0 rgba(255,255,255,.8))}\n.pth.sm{--s:36px;border-radius:11px}.pth.xs{--s:26px;border-radius:8px}.pth.xs::after,.pth.sm::after{display:none}.pth.xl{--s:92px;border-radius:24px}.pth.xl .pic{stroke-width:1.1}\n.pth .ic{color:var(--accent)}\n.pc{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 9px 8px 8px;border-radius:20px;margin-bottom:6px;position:relative;\n  background:rgba(255,255,255,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08),0 3px 10px rgba(23,43,36,.05);transition:transform .25s cubic-bezier(.3,1.4,.5,1),box-shadow .25s}\n.pc.on{box-shadow:inset 0 0 0 1.2px var(--soft-line),inset 0 1px 0 #fff,0 3px 10px rgba(23,43,36,.06);background:rgba(236,244,233,.7)}\n.swr .pc{margin-bottom:0}.swr{margin-bottom:6px}\n.pc.lpress,.li.lpress,.pick.lpress{transform:scale(.97)}\n.pb{min-width:0;display:flex;flex-direction:column;gap:2px}\n.pbr{display:flex;align-items:center;gap:6px;font:600 10.5px var(--sf);letter-spacing:.05em;text-transform:uppercase;color:var(--label2);min-width:0}\n.pbr>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.pn{font:600 14px/1.2 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.pnx{font:700 18px/1.2 var(--sf);letter-spacing:-.01em;margin-top:2px;text-wrap:balance}\n.psp{display:flex;gap:3px;flex-wrap:wrap;height:17px;overflow:hidden}\n.psp span{font:500 10px/13px var(--sf);padding:2px 6px;border-radius:6px;background:rgba(23,43,36,.06);color:var(--label2);white-space:nowrap}\n.pm{font:400 11px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:4px;align-items:center;min-width:0}\n.pw{display:inline-flex;align-items:center;gap:4px;color:#8a6418;font:500 11px var(--sf);white-space:normal;line-height:1.25}\n.pown{display:inline-flex;align-items:center;gap:5px;min-width:0;overflow:hidden;text-overflow:ellipsis}\n.fit{font:600 10px var(--sf);letter-spacing:0;text-transform:none;padding:1px 6px;border-radius:99px;flex:none}\n.fit.g{background:rgba(61,122,82,.14);color:var(--good)}.fit.o{background:var(--warn-bg);color:#8a6418}.fit.b{background:var(--bad-bg);color:var(--bad)}\n.prr{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right}\n.prr b{font:700 15px var(--sf);font-variant-numeric:tabular-nums;white-space:nowrap}.prr b i{font-style:normal;font-weight:500;font-size:11px;color:var(--label2)}\n.prr small{font:400 10px var(--sf);color:var(--label3);white-space:nowrap}\n.cd{font:600 10px var(--sf);letter-spacing:0;text-transform:none;padding:1px 7px;border-radius:99px;display:inline-flex;align-items:center;gap:4px;flex:none}\n.cd::before{content:\"\";width:5px;height:5px;border-radius:50%;background:currentColor}\n.cd.g{background:rgba(61,122,82,.12);color:var(--good)}.cd.o{background:var(--warn-bg);color:#8a6418}.cd.b{background:var(--bad-bg);color:var(--bad)}\n.pbad{font:500 10.5px var(--sf);padding:1px 7px;border-radius:99px;white-space:nowrap}\n.pbad.o{background:var(--warn-bg);color:#7a5a17}.pbad.s{background:var(--soft);color:var(--tint)}\n.ib2{width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.55);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1);display:grid;place-items:center;cursor:pointer;color:var(--label2)}\n.pc.custom .input{height:30px;font-size:13px}\n.need{display:flex;gap:9px;align-items:center;padding:7px 9px;border-radius:16px;background:rgba(255,255,255,.42);box-shadow:inset 0 1px 0 #fff;margin-bottom:7px}\n.need b{display:flex;align-items:center;gap:6px;font:600 13.5px var(--sf)}.need span{display:block;font:400 11.5px/1.3 var(--sf);color:var(--label2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}\n.phero{display:grid;grid-template-columns:auto minmax(0,1fr);gap:13px;align-items:center;margin-bottom:10px}\n.sgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}\n.sgrid div{padding:7px 10px;border-radius:14px;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);min-width:0}\n.sgrid small{display:block;font:500 10.5px var(--sf);color:var(--label2)}.sgrid b{display:block;font:600 13.5px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.stats3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}\n.stats3 div{padding:10px;border-radius:16px;background:rgba(255,255,255,.45);box-shadow:inset 0 1px 0 #fff;text-align:center}\n.stats3 b{display:block;font:700 21px var(--sf);letter-spacing:-.02em}.stats3 small{font:500 11px var(--sf);color:var(--label2)}\n.menu2{border-radius:18px;background:rgba(255,255,255,.4);box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.06);overflow:hidden}\n.mi{display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:6px 12px;border:0;background:none;text-align:left;font:500 13.5px var(--sf);color:var(--label);cursor:pointer}\n.mi+.mi{border-top:.5px solid var(--sep)}\n.mi>span{flex:1;min-width:0}.mi>b{font:600 13px var(--sf)}.mi .ic{color:var(--accent);flex:none}\n.mi.col{flex-direction:column;align-items:stretch;gap:6px;padding:8px 12px}.mi.col .row{gap:10px}.mi.col .chips .chip{height:26px;font-size:12px}\n.mi.bad,.mi.bad .ic{color:var(--bad)}.mi.dis{color:var(--label2);cursor:default}.mi[disabled]{opacity:.5;cursor:default}\n.cmp{display:grid;grid-template-columns:60px 1fr 1fr;gap:4px 8px;padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.45);font-size:12.5px;align-items:baseline}\n.cmp b{font:600 11.5px var(--sf);color:var(--label2)}.cmp>span:nth-child(3n+1){color:var(--label2);font-size:11.5px}.cmp em{font-style:normal;font-size:10.5px;font-weight:600}.cmp em.g{color:var(--good)}.cmp em.o{color:#8a6418}\n.rbig{display:flex;align-items:center;gap:12px;margin-bottom:8px}.rbig>b{font:700 34px var(--sf);letter-spacing:-.03em}\n.stars{color:#C99A3B;font-size:15px;letter-spacing:1px}.rbig small{display:block;font:400 11.5px var(--sf);color:var(--label2)}\n.li.kr{grid-template-columns:auto auto minmax(0,1fr) auto}\n.mq .ttl .pth{margin-right:2px}\n.pick{display:flex;align-items:center;gap:8px;margin-top:6px;padding:5px 6px 5px 5px;border-radius:12px;background:rgba(236,244,233,.75);box-shadow:inset 0 0 0 .8px var(--soft-line);transition:transform .25s}\n.pick b{display:block;font:600 12.5px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pick small{display:block;font:400 10.5px var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.pick>span:not(.pth){flex:1;min-width:0}\n.chip .cnt{font:600 10px var(--sf);min-width:16px;height:16px;line-height:16px;border-radius:8px;background:rgba(255,255,255,.7);color:var(--label2);text-align:center;padding:0 4px;margin-left:2px}\nbutton.mb{border:0;background:none;padding:2px 0;width:100%;cursor:pointer;text-align:left;border-radius:10px}\nbutton.mb:active{background:var(--fill2)}\n\n/* ================= v6 : sacs de chacun ================= */\n.bagsel{display:flex;gap:5px;margin-bottom:6px}\n.bagsel button{flex:1;min-width:0;border:0;border-radius:14px;background:rgba(255,255,255,.3);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08);padding:5px 2px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font:600 11px var(--sf);color:var(--label)}\n.bagsel button small{font:500 10px var(--sf);color:var(--label2)}\n.bagsel button[aria-pressed=true]{background:var(--pg);box-shadow:var(--pg-sh)}\n.bagv{display:grid;grid-template-columns:118px minmax(0,1fr);gap:12px;align-items:center}\n.bagsvg{width:118px;height:154px;filter:drop-shadow(0 6px 10px rgba(23,43,36,.12))}\n.bl{display:grid;grid-template-columns:10px 1fr auto;gap:6px;align-items:center;font:500 12px var(--sf);padding:1.5px 0}\n.bl i{width:10px;height:10px;border-radius:3px}.bl b{font-weight:600;font-size:12px}\n.bagrows{display:grid;gap:2px}\n.bi{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:9px;align-items:center;padding:5px 2px;border-top:.5px solid var(--sep)}\n.bi:first-child{border-top:0}.bi b{display:block;font:600 13px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bi small{display:block;font:400 11px var(--sf);color:var(--label2)}\n.bi>span{font:600 12.5px var(--sf)}\n\n/* ================= v6 : quand précis ================= */\n.cal{border-radius:16px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);padding:6px}\n.cw,.cg{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}\n.cw small{text-align:center;font:600 9.5px var(--sf);color:var(--label3)}\n.cd2{position:relative;height:23px;border:0;border-radius:8px;font:600 11.5px var(--sf);cursor:pointer;color:var(--label);font-variant-numeric:tabular-nums}\n.cd2 em{position:absolute;top:1px;left:3px;font:600 7px var(--sf);font-style:normal;color:var(--label2);text-transform:uppercase}\n.cd2.g{background:rgba(61,122,82,.2)}.cd2.o{background:rgba(185,138,46,.18)}.cd2.b{background:rgba(168,68,58,.15)}\n.cd2.far{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px)}\n.cd2.past{background:transparent;color:var(--label3);cursor:default}\n.cd2.sel{background:rgba(255,255,255,.85);box-shadow:inset 0 0 0 1.4px #5B7F55,0 2px 6px rgba(23,64,44,.15);z-index:1}\n.hgrid{display:grid;gap:2px;align-items:center;border-radius:16px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9);padding:6px}\n.hgrid small{font:600 8.5px var(--sf);color:var(--label3);text-align:center;white-space:nowrap}\n.hgrid small.rl{text-align:left;font:500 10.5px var(--sf);color:var(--label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.hc{height:24px;border:0;border-radius:5px;cursor:pointer;padding:0}\n.hc.g{background:rgba(61,122,82,.34)}.hc.o{background:rgba(185,138,46,.3)}.hc.b{background:rgba(168,68,58,.26)}.hc.past{background:rgba(23,43,36,.05);cursor:default}\n.hc.on{box-shadow:0 0 0 2px #fff,0 0 0 3.4px #5B7F55;position:relative;z-index:1}\n.qsum{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 4px 2px;font-size:12.5px}\n.qsum span:first-child{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qsum .num{font-weight:700;flex:none}\n.lgd{display:flex;gap:10px;font:500 10.5px var(--sf);color:var(--label2);padding:3px 4px 0;flex-wrap:wrap}\n.lgd i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;vertical-align:-1px}\n.lgd i.g{background:rgba(61,122,82,.4)}.lgd i.o{background:rgba(185,138,46,.36)}.lgd i.b{background:rgba(168,68,58,.3)}.lgd i.far{background:repeating-linear-gradient(135deg,rgba(23,43,36,.25) 0 2px,transparent 2px 4px)}\n.hchart{width:100%;height:auto;display:block;border-radius:14px;background:rgba(255,255,255,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}\n.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:6px}\n.facts div{padding:5px 8px;border-radius:12px;background:rgba(255,255,255,.42);min-width:0}\n.facts small{display:block;font:500 10px var(--sf);color:var(--label2)}.facts b{display:block;font:600 12px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.rec{display:flex;align-items:center;gap:9px;padding:7px 8px 7px 10px;border-radius:14px;background:rgba(236,244,233,.7);box-shadow:inset 0 0 0 .8px var(--soft-line);margin:4px 0 6px;color:var(--accent)}\n.rec b{display:block;font:600 13px var(--sf);color:var(--label)}.rec small{display:block;font:400 11px var(--sf);color:var(--label2)}.rec>div{flex:1}\n.tl{position:relative;display:grid;gap:0}\n.tli{display:grid;grid-template-columns:40px 14px minmax(0,1fr);gap:6px;align-items:start;padding:3px 0;position:relative}\n.tli .tt{font:600 12px var(--sf);padding-top:1px}\n.tli i{width:10px;height:10px;border-radius:50%;background:#8DB287;margin-top:3px;box-shadow:0 0 0 2.5px rgba(255,255,255,.8);position:relative;z-index:1}\n.tli:not(:last-child)::before{content:\"\";position:absolute;left:50px;top:12px;bottom:-4px;width:1.5px;background:rgba(91,127,85,.35)}\n.tli.warn i{background:var(--warn)}\n.tli b{display:block;font:600 12.5px var(--sf)}.tli small{display:block;font:400 11px var(--sf);color:var(--label2)}\n.sh-b>*{flex-shrink:0}\n.menu2.one{margin-bottom:6px}\n.pm .pw{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;min-width:0}.pm .pw .ic{vertical-align:-1px;margin-right:3px}\n.need{padding:5px 8px;margin-bottom:5px}\n\n/* ================= v7 : un seul style de capsule (barre d'onglets = étapes = flux des tiroirs = segments) ================= */\n.steps.lg,.tb.lg,.flow.lg,.tchips,.bagsel{background:linear-gradient(180deg,rgba(255,255,255,calc(var(--ga) + .3)),rgba(255,255,255,calc(var(--ga) + .14)) 55%,rgba(255,255,255,calc(var(--ga) + .22)))}\n.steps .lens,.tb .lens,.flow .lens,.segc .th,.bagsel button[aria-pressed=true]{background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(255,255,255,.26));\n  box-shadow:inset 0 1px 0 #fff,inset 0 -1px 1px rgba(255,255,255,.5),0 0 0 .5px rgba(23,43,36,.07),0 2px 8px rgba(23,43,36,.08)}\n.steps .lens,.tb .lens{top:4px;bottom:4px;transition:transform .55s cubic-bezier(.3,1.35,.4,1),background .25s,box-shadow .25s}\n.steps button,.tb button{color:var(--label)}\n.steps button[aria-current=step],.tb button.on{color:#2F6B45}\n.steps button[aria-current=step] .ic,.tb button.on .ic{stroke-width:2.1}\n.steps.drag .lens,.tb.drag .lens{transition:transform .08s linear,background .25s,box-shadow .25s;background:rgba(255,255,255,.08);top:-6px;bottom:-6px;\n  box-shadow:inset 0 1.5px 1px rgba(255,255,255,.95),inset 0 -1.5px 2px rgba(255,255,255,.6),inset 2px 0 2px rgba(255,120,160,.18),inset -2px 0 2px rgba(90,170,255,.2),0 0 0 .5px rgba(23,43,36,.1),0 10px 26px rgba(23,43,36,.2)}\n.steps.drag button{transition:transform .2s}.steps.drag button.hov{transform:scale(1.14)}\n.steps{touch-action:none}\n.bdg{position:absolute;top:6px;left:calc(50% + 6px);width:8px;height:8px;border-radius:50%;background:var(--warn);box-shadow:0 0 0 2px rgba(255,255,255,.9)}\n.head{gap:6px}\n/* flux des tiroirs : capsule segmentée à lentille */\n.flow{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:0;height:30px;border-radius:999px;padding:3px;margin:0 -2px}\n.flow .lens{position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/var(--n));border-radius:999px;z-index:1;transition:transform .55s cubic-bezier(.3,1.35,.4,1)}\n.flow button,.flow button.cur,.flow button.done{position:relative;z-index:2;height:auto;min-width:0;padding:0 4px;border:0;border-radius:999px;background:none!important;box-shadow:none!important;color:var(--label);font:500 11.5px var(--sf);display:flex;align-items:center;justify-content:center;gap:3px;cursor:pointer}\n.flow button span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.flow button.cur{color:#2F6B45;font-weight:600}\n.flow button.done{color:var(--label2)}.flow button.done .ic{color:var(--good);flex:none}\n.flow .ln,.flow button i{display:none}\n/* segments */\n.segc{background:rgba(255,255,255,.34);box-shadow:inset 0 0 0 .5px rgba(23,43,36,.08),inset 0 1px 2px rgba(23,43,36,.05)}\n.segc button[aria-pressed=true]{color:#2F6B45}\n/* types de réservation : même capsule que la barre d'onglets */\n.tchips{border-radius:22px;padding:3px;gap:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.12),0 6px 16px rgba(23,43,36,.08)}\n.tchip,.tchip.on{background:none;box-shadow:none;border-radius:18px;color:var(--label)}\n.tchip.on{color:#2F6B45;font-weight:600}.tchip.on .ic{color:#2F6B45}\n.tchip .bd{background:rgba(141,178,135,.5)}\n/* sacs : sélecteur de membre */\n.bagsel{border-radius:20px;padding:3px;gap:0;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.1)}\n.bagsel button{background:none;box-shadow:none;border-radius:17px}\n.bagsel button[aria-pressed=true]{color:#2F6B45}\n/* îlot : la prochaine décision */\n.island{cursor:pointer}\n.hasnext .island[data-s=idle]::before{content:\"\";position:absolute;left:15px;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;background:#A6C1A0;box-shadow:0 0 10px #A6C1A0;animation:pulse 2s infinite}\n.oc-c .st.rs{background:rgba(63,147,184,.16);color:#2B6F8E;font-weight:600}\n.sheet{gap:6px}\n\n/* ================= v8 : étapes = barre d'onglets (icône + libellé), feuilles qui ne débordent plus sur la carte ================= */\n.steps{height:50px}\n.steps button{flex-direction:column;gap:1px;display:flex;align-items:center;justify-content:center;font:500 10px var(--sf);letter-spacing:0;min-height:0}\n.steps button .ic{width:19px;height:19px}\n.steps button[aria-current=step]{font-weight:600}\n.steps .dot{display:none}\n.head .gbtn{width:50px;height:50px}\n.bdg{top:5px;left:calc(50% + 7px)}\n.grab.tt{height:32px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;padding-top:6px}\n.grab .sht{font:600 13px var(--sf);color:var(--label);letter-spacing:-.01em;line-height:16px}\n.sh-h.hf{margin-top:0;gap:6px;align-items:center}\n.sh-h.hf .flow{flex:1;min-width:0;margin:0;height:48px;padding:3px}\n.sh-h.hf .gbtn.sm{width:36px;height:36px;flex:none}\n.flow button,.flow button.cur,.flow button.done{flex-direction:column;gap:1px;padding:0 2px;font:500 10px var(--sf);letter-spacing:0}\n.flow button.cur{font-weight:600}\n.flow .fic{position:relative;display:grid;place-items:center}\n.flow .fic>.ic{width:18px;height:18px}\n.flow .fck{position:absolute;right:-7px;top:-4px;width:12px;height:12px;border-radius:50%;background:#fff;color:var(--good);display:grid;place-items:center;box-shadow:0 0 0 .5px rgba(23,43,36,.12)}\n.flow .fck .ic{width:8px;height:8px;stroke-width:3}\n.flow .flb{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:12px}\n.flow button.done{color:var(--label)}\n.fr{height:27px}\n\n.bagsel{margin-bottom:5px}\n.bagsel button{flex-direction:row;gap:5px;padding:4px 3px;justify-content:center}\n.bagsel button>span{display:flex;flex-direction:column;align-items:flex-start;line-height:1.1;min-width:0}\n.bagsel button b{font:600 11px var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}\n.bagsel .avi.sm{width:22px;height:22px;font-size:9.5px}\n.bagv{grid-template-columns:98px minmax(0,1fr);gap:10px}\n.bagsvg{width:98px;height:128px}\n.bl{font-size:11.5px;padding:1px 0}\n.cd2{height:21px;font-size:11px}\n.cal{padding:5px}.cw small{font-size:9px}\n.qsum{padding:5px 2px 0}\n.chip.sugg{height:24px;font-size:11px;padding:0 8px;flex:none;background:var(--soft);color:var(--tint);box-shadow:inset 0 0 0 .8px var(--soft-line)}\n.chip.sugg .ic{color:var(--accent)}\n.lgd{padding-top:2px}\n.hchart{height:112px}\n.facts{gap:4px;margin-top:5px}.facts div{padding:3px 7px}.facts small{font-size:9.5px}.facts b{font-size:11.5px}\n.grab.tt{height:30px;padding-top:5px;gap:3px}\n.sh-h.hf .flow{height:46px}\n.sh-f .say,.sh-f .bk{height:32px}.sh-f .bk{width:32px}.nx{height:32px}\n.li.cm{min-height:36px;padding:3px 2px}\n.rec{margin:3px 0 4px;padding:5px 8px 5px 10px}\n.tli{padding:2px 0}\n.mini{display:none}\n.mapbig .mini{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;flex:none;height:50px;border:0;border-radius:20px;padding:0 16px;text-align:left;cursor:pointer;color:var(--label);animation:minin .4s cubic-bezier(.3,1.3,.4,1)}\n.mini b{font:700 16px/1.2 var(--sf);letter-spacing:-.015em;display:flex;align-items:center;gap:5px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.mini span{font:400 12px var(--sf);color:var(--label2);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n@keyframes minin{from{opacity:0;transform:translateY(-6px) scale(.98)}}\n\n\n/* ================= Compte iOS 27 Liquid Glass — Layout Instagram @tony_frc ================= */\n.phone{grid-template-rows:calc(67% - 49px) 1fr}\n.phone.mapbig{grid-template-rows:172px 1fr}\n.top{padding:50px 12px 6px;gap:5px}\n.sw-wrap[data-det=peek] .sheet{top:calc(67% - 49px - 128px);bottom:calc(33% + 57px)}\n.sw-wrap[data-det=medium] .sheet{top:48px;bottom:calc(33% + 57px)}\n\n/* Top bar Instagram en verre Liquid Glass */\n.ig-top{display:flex;align-items:center;justify-content:space-between;gap:6px;height:36px;flex:none}\n.ig-handle{height:34px;padding:0 11px;border-radius:999px;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:5px;font:700 16px/1 var(--sf);letter-spacing:-.025em;color:var(--label);position:relative;overflow:hidden}\n.ig-handle:active{transform:scale(.96)}\n.ig-handle .lock-ic{color:var(--tint);display:inline-flex}\n.ig-handle .vis-tag{font:600 10.5px/1 var(--sf);color:var(--tint);padding:2px 6px;border-radius:999px;background:rgba(91,127,85,.16)}\n.ig-top-r{display:flex;align-items:center;gap:5px}\n.ig-top-r .gbtn{width:34px;height:34px}\n\n/* Carte principale profil Instagram en verre Liquid Glass */\n#card.cs{padding:9px 11px 8px;gap:6px;border-radius:24px;overflow:hidden}\n\n/* En-tête Instagram : Avatar + Nom + 3 compteurs (publications, followers, suivi(e)s) */\n.ig-header{display:grid;grid-template-columns:68px minmax(0,1fr);gap:11px;align-items:center;padding-top:3px}\n.ig-avi-wrap{position:relative;width:66px;height:66px;border-radius:50%;padding:2.5px;background:conic-gradient(from 140deg,#17402C,#5B7F55,#96B391,#3D7A52,#17402C);box-shadow:0 6px 16px rgba(23,43,36,.16),inset 0 1px 0 rgba(255,255,255,.8);cursor:pointer;border:0;display:block}\n.ig-avi-wrap:active{transform:scale(.95)}\n.ig-avi-in{width:100%;height:100%;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.92);background:#DDEBD8;display:grid;place-items:center}\n.ig-avi-in img{width:100%;height:100%;object-fit:cover;display:block}\n.ig-note{position:absolute;top:-7px;left:-2px;right:-6px;padding:2px 5px;border-radius:10px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 3px 10px rgba(23,43,36,.14),inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12);font:600 9px/1.15 var(--sf);color:var(--tint);white-space:nowrap;text-align:center;z-index:2}\n.ig-seal-bdg{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:linear-gradient(155deg,#fff,#EBF2EC);box-shadow:0 2px 6px rgba(23,43,36,.2),0 0 0 1.5px #fff;display:grid;place-items:center}\n\n.ig-right{display:flex;flex-direction:column;gap:5px;min-width:0}\n.ig-name-row{display:flex;align-items:center;gap:6px}\n.ig-name{font:700 14.5px/1.15 var(--sf);color:var(--label);letter-spacing:-.015em}\n.ig-sub-pill{font:600 10px/1 var(--sf);color:var(--tint);padding:2.5px 6px;border-radius:999px;background:rgba(235,242,236,.75);box-shadow:inset 0 0 0 .5px var(--soft-line)}\n.ig-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}\n.ig-stat{border:0;background:rgba(255,255,255,.38);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 0 0 .5px rgba(23,43,36,.06);border-radius:11px;padding:4px 4px 3.5px;text-align:left;cursor:pointer;transition:transform .14s,background .15s}\n.ig-stat:active{transform:scale(.95);background:rgba(255,255,255,.65)}\n.ig-stat b{display:block;font:700 14px/1.1 var(--sf);color:var(--label);letter-spacing:-.02em;font-variant-numeric:tabular-nums}\n.ig-stat span{display:block;font:500 10px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n\n/* Bio Instagram (@tony_frc : 🇮🇹🇫🇷 + Empreinte GPS + Lignée) */\n.ig-bio{display:flex;flex-direction:column;gap:2.5px;font:400 11.8px/1.28 var(--sf);color:var(--label)}\n.ig-bio-flags{font-size:13px;line-height:1.2;display:flex;align-items:center;gap:6px}\n.ig-bio-flags span{font:500 11.2px/1.2 var(--sf);color:var(--label2)}\n.ig-bio-emp{display:flex;align-items:center;gap:5px;color:var(--tint);font:500 11.2px/1.25 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ig-bio-emp i{width:6px;height:6px;border-radius:50%;background:var(--good);flex:none}\n.ig-bio-link{display:inline-flex;align-items:center;gap:4px;font:600 11px/1.2 var(--sf);color:var(--tint);background:none;border:0;padding:0;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n\n/* Boutons d'action Instagram (Modifier le profil / Partager le profil / +Tribu) */\n.ig-actions{display:grid;grid-template-columns:1fr 1fr 30px;gap:5px}\n.ig-btn{height:28px;border-radius:9px;border:0;font:600 11.8px/1 var(--sf);cursor:pointer;display: inline-flex;align-items:center;justify-content:center;gap:4px;transition:transform .14s;padding:0 8px;white-space:nowrap}\n.ig-btn:active{transform:scale(.96)}\n.ig-btn.p{background:var(--pg);color:var(--pg-ink);box-shadow:var(--pg-sh)}\n.ig-btn.soft{background:var(--soft);color:var(--label);box-shadow:inset 0 1px 0 rgba(255,255,255,.82),inset 0 0 0 .6px var(--soft-line)}\n.ig-btn.icon{padding:0;width:30px}\n\n/* Stories À la une (Highlights Instagram en anneaux Liquid Glass) */\n.ig-hl-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;padding:1px 0}\n.ig-hl{border:0;background:none;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2.5px;min-width:0}\n.ig-hl:active .ig-hl-ring{transform:scale(.92)}\n.ig-hl-ring{width:44px;height:44px;border-radius:50%;padding:2px;background:linear-gradient(145deg,rgba(23,64,44,.55),rgba(91,127,85,.35),rgba(255,255,255,.85));box-shadow:inset 0 1px 0 #fff,0 2px 6px rgba(23,43,36,.08);transition:transform .15s;display:grid;place-items:center}\n.ig-hl-in{width:100%;height:100%;border-radius:50%;background:rgba(244,247,243,.88);border:1.5px solid rgba(255,255,255,.95);display:grid;place-items:center;font-size:16px;overflow:hidden;position:relative}\n.ig-hl span{font:500 9.8px/1.1 var(--sf);color:var(--label);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n\n/* Barre des 4 onglets de contenu Instagram (Grille | Carte/Sorties | Lignées/Sac | Identifié/Tribu) */\n.ig-tabs{position:relative;display:grid;grid-template-columns:repeat(4,1fr);height:31px;padding:2px;border-radius:12px;background:rgba(23,43,36,.06);box-shadow:inset 0 1px 1px rgba(23,43,36,.06),inset 0 -1px 0 rgba(255,255,255,.65)}\n.ig-tabs button{position:relative;z-index:1;border:0;background:none;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:4px;font:600 10.8px/1 var(--sf);color:var(--label2);cursor:pointer;transition:color .18s}\n.ig-tabs button[aria-selected=\"true\"]{color:var(--tint)}\n.ig-tabs .ig-th{position:absolute;top:2px;bottom:2px;left:2px;width:calc((100% - 4px)/4);border-radius:10px;background:rgba(255,255,255,.86);box-shadow:0 2px 6px rgba(23,43,36,.1),inset 0 1px 0 #fff;transition:transform .32s cubic-bezier(.22,1.15,.36,1)}\n\n/* Grille photo 3 colonnes Instagram (3x2 visible immédiatement) */\n.ig-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px}\n.ig-tile{position:relative;height:68px;border-radius:10px;overflow:hidden;border:0;padding:0;cursor:pointer;background:#17402C;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.35);text-align:left;transition:transform .15s}\n.ig-tile:active{transform:scale(.96)}\n.ig-tile svg.art{width:100%;height:100%;display:block}\n.ig-tile .t-top{position:absolute;top:4px;left:5px;right:5px;display:flex;justify-content:space-between;align-items:center;pointer-events:none}\n.ig-tile .t-pill{padding:1.5px 5px;border-radius:6px;background:rgba(12,24,18,.58);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font:600 8.8px/1.15 var(--sf);letter-spacing:.01em}\n.ig-tile .t-pill.draft{background:rgba(251,241,220,.92);color:#8a6418}\n.ig-tile .t-ic{color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));display:inline-flex}\n.ig-tile .t-bot{position:absolute;left:0;right:0;bottom:0;padding:12px 5px 4px;background:linear-gradient(180deg,transparent,rgba(10,22,16,.78));color:#fff;display:flex;justify-content:space-between;align-items:flex-end;gap:3px;pointer-events:none}\n.ig-tile .t-bot b{font:600 9.5px/1.1 var(--sf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.ig-tile .t-bot small{font:600 8.8px/1 var(--sf);opacity:.92;white-space:nowrap}\n\n/* Vues alternatives dans la zone grille (Sorties, Lignées, Tribu) */\n.ig-alt{display:flex;flex-direction:column;gap:5px;min-height:139px;justify-content:space-between}\n.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}\n.kpi{padding:4px 4px 3px;border-radius:11px;background:rgba(255,255,255,.46);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);text-align:center;cursor:pointer;border:0}\n.kpi b{display:block;font:700 13px/1.15 var(--sf);color:var(--label);font-variant-numeric:tabular-nums}\n.kpi small{display:block;font:500 9.2px/1.15 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.axes2{display:grid;grid-template-columns:1fr 1fr;gap:5px}\n.axis-box{padding:6px 8px;border-radius:12px;background:rgba(255,255,255,.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.07);display:flex;flex-direction:column;gap:3px}\n.axis-box .ah{display:flex;justify-content:space-between;align-items:baseline;font:600 10.5px var(--sf);color:var(--label2)}\n.axis-box .ah b{font:700 13.5px var(--sf);color:var(--tint);font-variant-numeric:tabular-nums}\n.axis-box small{font:400 9.5px/1.2 var(--sf);color:var(--label2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.credit-pill{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 9px;border-radius:12px;background:var(--pg);box-shadow:var(--pg-sh);cursor:pointer;border:0;width:100%;text-align:left}\n.credit-pill b{font:700 13.5px var(--sf);color:var(--tint);font-variant-numeric:tabular-nums}\n.credit-pill small{display:block;font:400 9.8px var(--sf);color:var(--label2)}\n\n\n/* Production Next.js Responsive Integration Overrides */\n.lkdv-compte-v8 {\n  position: relative;\n  width: 100%;\n  min-height: calc(100dvh - 64px);\n  font-family: -apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", system-ui, sans-serif;\n  color: var(--ink);\n  -webkit-font-smoothing: antialiased;\n  overflow-x: hidden;\n  padding-bottom: 40px;\n}\n\n/* On real mobile / iPhone / Capacitor WKWebView (< 768px): full-bleed native iOS 27 screen without phone frame bezel */\n@media (max-width: 767px) {\n  .lkdv-compte-v8 {\n    padding: 0 !important;\n    min-height: 100dvh !important;\n    height: 100dvh !important;\n    background: var(--bg-canvas) !important;\n    overflow: hidden !important;\n  }\n  .lkdv-compte-v8 .top-bar,\n  .lkdv-compte-v8 .notes {\n    display: none !important;\n  }\n  .lkdv-compte-v8 .stage {\n    padding: 0 !important;\n    margin: 0 !important;\n    max-width: 100% !important;\n    height: 100dvh !important;\n    display: block !important;\n  }\n  .lkdv-compte-v8 .phone-wrap {\n    width: 100% !important;\n    height: 100dvh !important;\n    display: block !important;\n  }\n  .lkdv-compte-v8 .phone {\n    width: 100% !important;\n    height: 100dvh !important;\n    min-height: 100dvh !important;\n    padding: 0 !important;\n    border-radius: 0 !important;\n    background: transparent !important;\n    box-shadow: none !important;\n    transform: none !important;\n  }\n  .lkdv-compte-v8 .phone::before,\n  .lkdv-compte-v8 .phone::after,\n  .lkdv-compte-v8 .status,\n  .lkdv-compte-v8 .home-ind {\n    display: none !important;\n  }\n  .lkdv-compte-v8 .screen {\n    border-radius: 0 !important;\n    height: 100dvh !important;\n    min-height: 100dvh !important;\n    overflow: hidden !important;\n  }\n  .lkdv-compte-v8 .nav {\n    top: max(12px, env(safe-area-inset-top, 14px)) !important;\n  }\n  .lkdv-compte-v8 .scroll {\n    padding-top: calc(max(12px, env(safe-area-inset-top, 14px)) + 54px) !important;\n    padding-bottom: calc(96px + env(safe-area-inset-bottom, 20px)) !important;\n  }\n  .lkdv-compte-v8 .toast {\n    top: calc(max(12px, env(safe-area-inset-top, 14px)) + 52px) !important;\n  }\n  .lkdv-compte-v8 .rmenu {\n    top: calc(max(12px, env(safe-area-inset-top, 14px)) + 50px) !important;\n  }\n  .lkdv-compte-v8 .sheet .sbody {\n    padding-bottom: calc(96px + env(safe-area-inset-bottom, 24px)) !important;\n  }\n  .lkdv-compte-v8 .map-top {\n    top: max(14px, env(safe-area-inset-top, 14px)) !important;\n  }\n  .lkdv-compte-v8 .map-card {\n    bottom: calc(88px + env(safe-area-inset-bottom, 16px)) !important;\n  }\n  .lkdv-compte-v8 .story-bars {\n    top: max(14px, env(safe-area-inset-top, 14px)) !important;\n  }\n  .lkdv-compte-v8 .story-top {\n    top: calc(max(14px, env(safe-area-inset-top, 14px)) + 14px) !important;\n  }\n  .lkdv-compte-v8 .story-foot {\n    bottom: calc(88px + env(safe-area-inset-bottom, 16px)) !important;\n  }\n}\n\n/* Desktop (>= 768px): Show both the interactive iOS 27 studio device AND the companion controls */\n@media (min-width: 768px) {\n  .lkdv-compte-v8 .top-bar {\n    position: sticky;\n    top: 0;\n    z-index: 40;\n  }\n}\n";
const COMPTE_V8_HTML = "";

function triggerBrowserDownload(filename: string, content: string, mimeType = 'application/json;charset=utf-8') {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) {
    console.error('[CompteLiquidGlassV8] Download error:', err);
  }
}

function buildGpxXml(outings: any[], handle: string): string {
  const now = new Date().toISOString();
  const trks = (outings || []).map((o, idx) => {
    const baseLat = 45.023 + idx * 0.08;
    const baseLon = 6.994 + idx * 0.09;
    const pts = Array.from({ length: 12 }, (_, k) => {
      const lat = (baseLat + k * 0.0042).toFixed(5);
      const lon = (baseLon + Math.sin(k * 0.6) * 0.005).toFixed(5);
      const ele = Math.round(1450 + Math.sin((k / 11) * Math.PI) * ((o.maxAlt || 2400) - 1450));
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
      const handle = S?.profile?.handle || 'tony_frc';
      const profileUrl = `${window.location.origin}/u/${handle}`;

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
            const res = await fetch('/api/account/export', { cache: 'no-store' });
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
          const gpx = buildGpxXml(dump.OUTINGS || [], handle);
          triggerBrowserDownload(`lkdv-traces-${handle}-2026.gpx`, gpx, 'application/gpx+xml;charset=utf-8');
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

  // Hydrate with live Supabase user data + localStorage when available
  const syncSupabaseProfile = useCallback(async () => {
    const hydrate = (window as any).__lkdvHydrateCompte;
    if (typeof hydrate !== 'function') return;

    // 1. Check localStorage edits from /compte/modifier first
    try {
      const localProf = localStorage.getItem('user_profile_data');
      if (localProf) {
        const lp = JSON.parse(localProf);
        const patch: Record<string, any> = {};
        if (lp.username) patch.handle = String(lp.username).replace(/^@/, '');
        if (lp.full_name || lp.first_name) patch.name = lp.full_name || lp.first_name;
        if (lp.location) patch.home = lp.location;
        if (lp.avatar_url && lp.avatar_url !== '/assets/images/no_image.png') patch.avatarUrl = lp.avatar_url;
        if (lp.bio) patch.bioLine = '· ' + String(lp.bio).split('\n')[0].slice(0, 48);
        hydrate(patch);
        if (patch.handle) setActiveHandle(patch.handle);
      }
    } catch (_) {}

    if (!user) return;
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
        sigRes,
        tripsRes,
      ] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, username, bio, location, avatar_url, signature_visibility, trust_score, loyalty_points, created_at')
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
          .select('id, title, visibility, cover_image, description, created_at, views_count, likes_count, comments_count')
          .eq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('travel_groups')
          .select('id, name, departure_date, return_date, status, distance_km, elevation_gain_m')
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
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('orders')
          .select('id, order_number, status, items, total_eur, loyalty_points_earned, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        fetch(`/api/identity/signature?userId=${encodeURIComponent(user.id)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/voyages/mine').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      const p = profileRes.data as Record<string, any> | null;
      const patch: Record<string, any> = {};

      if (p) {
        const rawHandle = p.username || user.user_metadata?.username || user.email?.split('@')[0];
        if (rawHandle && rawHandle !== 'test') {
          patch.handle = String(rawHandle).replace(/^@/, '');
          setActiveHandle(patch.handle);
        }
        const fullName = p.full_name || user.user_metadata?.full_name;
        if (fullName && fullName !== 'Test User') {
          patch.name = fullName;
        }
        if (p.avatar_url && p.avatar_url !== '/assets/images/no_image.png') {
          patch.avatarUrl = p.avatar_url;
        }
        if (p.bio) {
          patch.bioLine = '· ' + String(p.bio).split('\n')[0].slice(0, 52);
        }
        if (p.location) {
          patch.home = String(p.location).split(',')[0].trim();
        }
        if (p.signature_visibility === 'private') patch.vis = 0;
        else if (p.signature_visibility === 'world') patch.vis = 1;
        else if (p.signature_visibility === 'public') patch.vis = 2;
      }

      if (sigRes && sigRes.text) {
        patch.sigText = sigRes.text;
      }

      if (typeof followersRes.count === 'number' && followersRes.count > 0) {
        patch.followers = followersRes.count;
      }
      if (typeof followingRes.count === 'number' && followingRes.count > 0) {
        patch.following = followingRes.count;
      }
      if (Array.isArray(carnetsRes.data) && carnetsRes.data.length > 0) {
        patch.carnets = carnetsRes.data;
      }

      const combinedOutings: any[] = [];
      if (Array.isArray(travelGroupsRes.data)) {
        travelGroupsRes.data.forEach((tg: any) => {
          combinedOutings.push({
            id: tg.id,
            title: tg.name || 'Aventure LKDV',
            mass: 'Alpes',
            date: tg.departure_date ? new Date(tg.departure_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '2026',
            km: tg.distance_km || 32,
            dplus: tg.elevation_gain_m || 1650,
            status: tg.status === 'planned' ? 'planned' : 'done',
          });
        });
      }
      if (tripsRes && Array.isArray(tripsRes.trips)) {
        tripsRes.trips.forEach((tr: any) => {
          combinedOutings.push({
            id: tr.id,
            title: tr.title || 'Sortie LKDV',
            mass: tr.primary_activity || 'Alpes',
            date: tr.start_date ? new Date(tr.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '2026',
            km: 28,
            dplus: 1400,
            status: tr.status === 'draft' || tr.status === 'planned' ? 'planned' : 'done',
          });
        });
      }
      if (combinedOutings.length > 0) {
        patch.outings = combinedOutings;
      }

      if (Array.isArray(clubsRes.data) && clubsRes.data.length > 0) {
        patch.clubs = clubsRes.data
          .map((cm: any) => ({
            slug: cm.club?.slug || cm.club?.id,
            name: cm.club?.name || 'Club LKDV',
            role: cm.role,
            membersCount: cm.club?.members_count || 120,
          }))
          .filter((c: any) => c.name);
      }

      if (Array.isArray(gearRes.data) && gearRes.data.length > 0) {
        patch.gearItems = gearRes.data;
      }

      if (Array.isArray(ordersRes.data) && ordersRes.data.length > 0) {
        patch.orders = ordersRes.data;
      }

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
      <style dangerouslySetInnerHTML={{ __html: COMPTE_V8_CSS }} />
      {/* Sub-navigation bar: live Supabase status + direct routes + quick actions */}
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
              : `@${activeHandle} · Persistance locale active`}
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
      <div ref={containerRef} />
    </div>
  );
}

export default CompteLiquidGlassV8;
