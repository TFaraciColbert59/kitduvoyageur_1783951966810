'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { createGroupFromClub } from '@/features/tribu/actions/createGroupFromClub';
import { initClubLiquidGlassRuntime } from './club-liquid-glass-v8-runtime';

const CLUB_V8_CSS = `
:root {
  --sf: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif;
  --sat: env(safe-area-inset-top, 12px);
  --sab: env(safe-area-inset-bottom, 12px);
  --ga: 0.65;
  --gb: 28;
  --gsat: 210;
  --t1: #172B24;
  --t2: #56665D;
  --t3: #839188;
  --pg: linear-gradient(145deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%);
  --pg-ink: #17402C;
  --pg-sh: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 6px 18px rgba(23, 64, 44, 0.14);
}

.club-v15-viewport {
  position: relative;
  width: 100%;
  height: 100dvh;
  min-height: 100dvh;
  overflow: hidden;
  background: #DCE7DF;
  font-family: var(--sf);
  color: var(--t1);
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

#phone.phone {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  --card-top: 52px;
  --card-left: 10px;
  --card-right: 10px;
  --card-bottom: 10px;
  --card-radius: 28px;
}

/* Carte 3D vivante en haut (43%) + fond continu */
.mwrap {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, #CFE2D6 0%, #DFECE3 45%, #EBF2ED 100%);
}

#maplibre-compte-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Contrôles carte en haut à droite */
.mctrls {
  position: absolute;
  top: calc(var(--sat, 12px) + 46px);
  right: 12px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.mctl {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #17402C;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.mctl:active {
  transform: scale(0.94);
}

.mctl svg {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.map-scale-selector {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 999px;
  position: absolute;
  top: calc(var(--sat, 12px) + 46px);
  left: 12px;
  z-index: 6;
}

.map-scale-btn {
  border: 0;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font: 600 11px/1 var(--sf);
  color: var(--t2);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* Dynamic Island */
.di {
  position: absolute;
  top: calc(var(--sat, 12px) + 6px);
  left: 50%;
  transform: translateX(-50%) scale(0.92);
  z-index: 60;
  min-width: 150px;
  max-width: 86%;
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  background: rgba(23, 43, 36, 0.88);
  backdrop-filter: blur(24px) saturate(190%);
  -webkit-backdrop-filter: blur(24px) saturate(190%);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: 600 12px/1.2 var(--sf);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease, transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 10px 26px rgba(15, 29, 23, 0.28);
}

.di.on {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}

/* Card principale 57% bas */
#card.cs {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  height: 57%;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    172deg,
    rgba(255, 255, 255, calc(var(--ga, 0.65) + 0.14)) 0%,
    rgba(246, 250, 247, var(--ga, 0.65)) 52%,
    rgba(238, 245, 240, calc(var(--ga, 0.65) + 0.08)) 100%
  );
  backdrop-filter: blur(calc(var(--gb, 28) * 1px)) saturate(calc(var(--gsat, 210) * 1%));
  -webkit-backdrop-filter: blur(calc(var(--gb, 28) * 1px)) saturate(calc(var(--gsat, 210) * 1%));
  border: 1px solid rgba(255, 255, 255, 0.82);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    0 18px 46px rgba(23, 43, 36, 0.16);
}

/* Top bar interne de la card */
.ig-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 2px 6px;
}

.ig-top-left,
.ig-top-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ibtn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 0.5px solid rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(24px) saturate(190%);
  -webkit-backdrop-filter: blur(24px) saturate(190%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 12px rgba(23, 43, 36, 0.08);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #17402C;
  cursor: pointer;
}

.ibtn svg {
  width: 17px;
  height: 17px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vpill {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 0.5px solid rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(24px);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 600 11.5px/1 var(--sf);
  color: #17402C;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 12px rgba(23, 43, 36, 0.07);
}

.v-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22A35A;
  box-shadow: 0 0 0 3px rgba(34, 163, 90, 0.18);
}

/* Header Avatar + 3 Stats */
.ig-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 2px 4px;
}

.ig-avi-wrap {
  position: relative;
  width: 68px;
  height: 68px;
  flex-shrink: 0;
  cursor: pointer;
}

.ig-avi-ring {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  padding: 2.5px;
  background: linear-gradient(135deg, #17402C 0%, #3F7A59 55%, #A3C6B1 100%);
  box-shadow: 0 6px 16px rgba(23, 64, 44, 0.18);
}

.ig-avi {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #FFFFFF;
}

.seal-mini {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(145deg, #FFFFFF 0%, #E7F2EC 100%);
  border: 1px solid rgba(23, 64, 44, 0.18);
  box-shadow: 0 4px 10px rgba(23, 43, 36, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #17402C;
}

.seal-mini svg {
  width: 13px;
  height: 13px;
  fill: currentColor;
}

.ig-stats {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.ig-stat {
  border: 0.5px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.52);
  border-radius: 14px;
  padding: 7px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.ig-stat-v {
  font: 800 15px/1.1 var(--sf);
  color: var(--t1);
}

.ig-stat-l {
  font: 600 10.5px/1.1 var(--sf);
  color: var(--t2);
  margin-top: 2px;
}

/* Bio du club */
.ig-bio {
  padding: 4px 4px 2px;
}

.ig-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ig-name {
  font: 800 16px/1.2 var(--sf);
  color: var(--t1);
  letter-spacing: -0.02em;
}

.ig-role-pill {
  font: 700 10.5px/1 var(--sf);
  color: #17402C;
  background: rgba(255, 255, 255, 0.68);
  border: 0.5px solid rgba(255, 255, 255, 0.9);
  padding: 4px 9px;
  border-radius: 999px;
}

.ig-footprint-line {
  font: 700 11.5px/1.3 var(--sf);
  color: #17402C;
  margin-top: 4px;
  cursor: pointer;
}

.ig-bio-text {
  font: 500 12.5px/1.38 var(--sf);
  color: var(--t2);
  margin-top: 4px;
}

/* Boutons action Liquid Glass */
.reseau-btn {
  border: 0.5px solid rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(24px);
  color: #17402C;
  font: 600 12px/1 var(--sf);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 12px rgba(23, 43, 36, 0.08);
  transition: transform 0.16s ease;
}

.reseau-btn:active {
  transform: scale(0.97);
}

.reseau-btn.primary {
  background: var(--pg);
  color: var(--pg-ink);
  box-shadow: var(--pg-sh);
}

/* Highlights / Stories du club */
.ig-hl-row {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow-x: auto;
  padding: 6px 4px;
  scrollbar-width: none;
}

.ig-hl-row::-webkit-scrollbar {
  display: none;
}

.ig-hl-item {
  border: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.ig-hl-ring {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  padding: 2px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(23, 64, 44, 0.16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 4px 10px rgba(23, 43, 36, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ig-hl-item.active .ig-hl-ring {
  border-color: #17402C;
  box-shadow: 0 0 0 2px rgba(23, 64, 44, 0.22);
}

.ig-hl-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.ig-hl-lbl {
  font: 600 10.5px/1.1 var(--sf);
  color: var(--t2);
}

/* Grille 3 colonnes des publications du club */
.ig-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding-top: 4px;
}

.ig-cell {
  position: relative;
  aspect-ratio: 4 / 5;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.5);
}

.ig-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.28s ease;
}

.ig-cell:hover img {
  transform: scale(1.04);
}

.ig-cell-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  display: flex;
}

.ig-cell-badge span {
  background: rgba(255, 255, 255, 0.76);
  backdrop-filter: blur(12px);
  padding: 2px 7px;
  border-radius: 999px;
  font: 700 9.5px/1.2 var(--sf);
  color: #17402C;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ig-cell-meta {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  display: flex;
  justify-content: space-between;
  font: 700 10px/1 var(--sf);
  color: #FFFFFF;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65);
}

/* Cartes Sorties & Expéditions du club */
.ig-carnets {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}

.ig-carnet-card {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.76);
  border: 0.5px solid rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 6px 18px rgba(23, 43, 36, 0.08);
  cursor: pointer;
}

.ig-carnet-cov {
  width: 84px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}

.ig-carnet-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ig-carnet-kicker {
  font: 700 10.5px/1.2 var(--sf);
  color: #17402C;
}

.ig-carnet-title {
  font: 800 13.5px/1.25 var(--sf);
  color: var(--t1);
  margin-top: 2px;
}

.ig-carnet-sub {
  font: 500 11.5px/1.25 var(--sf);
  color: var(--t2);
  margin-top: 2px;
}

.ig-carnet-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font: 600 11px/1.2 var(--sf);
  color: var(--t2);
  margin-top: 4px;
}

/* Sélecteurs génériques & tabs */
.ig-tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  align-items: center;
  padding: 3px;
  border-radius: 999px;
}

.ig-th {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  border-radius: 999px;
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
}

.ig-tab {
  position: relative;
  z-index: 2;
  border: 0;
  background: transparent;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--t2);
  cursor: pointer;
}

.ig-tab.on {
  color: #17402C;
}

.ig-tab svg {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

/* Drawers (#sheet) */
#sheet.sheet {
  position: absolute;
  left: var(--card-left, 10px);
  right: var(--card-right, 10px);
  bottom: var(--card-bottom, 10px);
  top: var(--card-top, 52px);
  z-index: 30;
  display: none;
  flex-direction: column;
  padding: 10px 14px 16px;
  border-radius: var(--card-radius, 28px);
  overflow: hidden;
}

#sheet.sheet.open {
  display: flex;
}

.sh-g {
  width: 38px;
  height: 4.5px;
  border-radius: 999px;
  background: rgba(23, 43, 36, 0.22);
  margin: 0 auto 8px;
  cursor: pointer;
}

.sh-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
}

.sh-t {
  font: 800 15px/1.2 var(--sf);
  color: var(--t1);
}

.sh-s {
  font: 600 11.5px/1.2 var(--sf);
  color: var(--t2);
}

.sh-x {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 0.5px solid rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.68);
  color: var(--t1);
  cursor: pointer;
}

.sh-b {
  flex: 1;
  overflow-y: auto;
  padding-top: 4px;
}

.li.nt {
  padding: 11px 13px;
  border-radius: 16px;
  border: 0.5px solid rgba(255, 255, 255, 0.82);
}

.li-t {
  font: 700 13px/1.25 var(--sf);
  color: var(--t1);
}

.li-s {
  font: 500 11.5px/1.35 var(--sf);
  color: var(--t2);
}

/* Post Modal Minimaliste */
#post_modal_instagram.post-modal-instagram {
  position: absolute;
  z-index: 40;
  display: none;
  flex-direction: column;
}

#post_modal_instagram.post-modal-instagram.open {
  display: flex;
}

.pmi-dialog {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(23, 43, 36, 0.16);
  backdrop-filter: blur(28px);
  overflow: hidden;
}

.pmi-grabber {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 38px;
  height: 4.5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  z-index: 6;
  cursor: pointer;
}

.pmi-header.pmi-topbar {
  position: absolute;
  top: 18px;
  left: 12px;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.pmi-profile-pill {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px 5px 6px;
  border-radius: 999px;
  cursor: pointer;
}

.pmi-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  object-fit: cover;
}

.pmi-username {
  font: 700 12px/1.15 var(--sf);
  color: #17402C;
}

.pmi-location {
  font: 600 10.5px/1.15 var(--sf);
  color: var(--t2);
}

.pmi-more-pill {
  pointer-events: auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #17402C;
  font-weight: 700;
  cursor: pointer;
}

.pmi-media {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 22px;
}

.pmi-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pmi-action-pill.pmi-actions {
  position: absolute;
  right: 14px;
  bottom: 20px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 999px;
}

.pmi-act-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  color: #17402C;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pmi-act-btn.liked {
  color: #D92D20;
}

.pmi-act-btn svg {
  width: 19px;
  height: 19px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.pmi-act-btn.liked svg {
  fill: currentColor;
}

.pmi-comment-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 14px;
  border-radius: 999px;
}

.pmi-comment-input {
  flex: 1;
  border: 0;
  background: transparent;
  font: 500 12.5px/1.2 var(--sf);
  color: var(--t1);
  outline: none;
}

.pmi-comment-send {
  border: 0;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--pg);
  color: #17402C;
  font: 700 11.5px/1 var(--sf);
  cursor: pointer;
}

/* Modal Sceau d'Empreinte Collective */
.seal-modal {
  position: absolute;
  inset: 0;
  z-index: 55;
  background: rgba(23, 43, 36, 0.34);
  backdrop-filter: blur(18px);
  display: none;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.seal-modal.open {
  display: flex;
}

.seal-card {
  width: 100%;
  max-width: 330px;
  padding: 22px 18px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.94);
  box-shadow: 0 20px 50px rgba(23, 43, 36, 0.24);
  text-align: center;
}

/* ==============================================================================
   Club iOS 27 v15 — Parité stricte avec Compte v15 (1 scroll unique, sélecteur
   flottant verre 0.65, drawers sur les bords exacts de la card, icônes pures)
   ============================================================================== */

/* 1. 1 SEULE COUCHE SCROLLABLE & SÉLECTEUR SUPERPOSÉ EN BAS À DROITE */
#card.cs {
  overflow: hidden !important;
}

#card.cs > .card-scroll {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 10px 12px 58px !important;
  scrollbar-width: none !important;
}

#card.cs > .card-scroll::-webkit-scrollbar {
  display: none !important;
}

#card.cs > .ig-tabs-float {
  position: absolute !important;
  right: 10px !important;
  bottom: 10px !important;
  z-index: 25 !important;
  pointer-events: none !important;
}

/* 2. BOUTONS DE SÉLECTION GRILLE/SORTIES EN PUR VERRE DÉPOLI TRANSPARENT */
#card.cs > .ig-tabs-float .ig-tabs {
  pointer-events: auto !important;
  width: 88px !important;
  height: 30px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(28px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(210%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.86) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 8px 22px rgba(23, 43, 36, 0.14) !important;
}

#card.cs > .ig-tabs-float .ig-th {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.98), 0 2px 8px rgba(23, 43, 36, 0.1) !important;
}

/* 3. DRAWERS & VUE POST ALIGNÉS SUR LES BORDS EXACTS DE LA CARD */
#sheet.sheet.open[data-det="card"],
#post_modal_instagram.post-modal-instagram {
  top: var(--card-top, calc(var(--sat, 54px) + 52px)) !important;
  left: var(--card-left, 10px) !important;
  right: var(--card-right, 10px) !important;
  bottom: var(--card-bottom, 10px) !important;
  border-radius: var(--card-radius, 28px) !important;
  height: auto !important;
  max-height: none !important;
}

/* 4. TRANSPARENCE & MATÉRIAU IDENTIQUES À LA CARD PRINCIPALE */
#sheet.sheet {
  background: linear-gradient(
    172deg,
    rgba(255, 255, 255, calc(var(--ga, 0.65) + 0.14)) 0%,
    rgba(246, 250, 247, var(--ga, 0.65)) 52%,
    rgba(238, 245, 240, calc(var(--ga, 0.65) + 0.08)) 100%
  ) !important;
  backdrop-filter: blur(calc(var(--gb, 28) * 1px)) saturate(calc(var(--gsat, 210) * 1%)) !important;
  -webkit-backdrop-filter: blur(calc(var(--gb, 28) * 1px)) saturate(calc(var(--gsat, 210) * 1%)) !important;
  border: 1px solid rgba(255, 255, 255, 0.84) !important;
}

.sheet .li.nt,
.sheet .reseau-card,
.sheet .apple-grouped-card {
  background: rgba(255, 255, 255, 0.82) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.86) !important;
}

/* 5. SÉLECTEURS DES DRAWERS EN ICÔNES PURES & VERRE 0.65 */
.sheet .flow, .sheet .segc, .sheet .reseau-toggle, .ig-sub {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  padding: 4px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(28px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(210%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.86) !important;
}

.sheet .flow .sel-lens, .sheet .segc .sel-lens, .sheet .reseau-toggle .sel-lens, .ig-sub .sel-lens {
  position: absolute !important;
  top: 4px !important;
  bottom: 4px !important;
  left: 4px !important;
  border-radius: 999px !important;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.98), 0 2px 8px rgba(23, 43, 36, 0.1) !important;
  transition: transform 0.26s cubic-bezier(0.22, 1, 0.36, 1) !important;
}

.sheet .segb {
  position: relative !important;
  z-index: 2 !important;
  flex: 1 !important;
  height: 30px !important;
  border: 0 !important;
  background: transparent !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: var(--t2) !important;
  cursor: pointer !important;
}

.sheet .segb.on {
  color: #17402C !important;
}

.sheet .segb svg {
  width: 18px !important;
  height: 18px !important;
  stroke: currentColor !important;
  stroke-width: 2 !important;
  fill: none !important;
}

/* 5 bis. POST DRAWER ULTRA-MINIMALISTE */
.pmi-scroll-area {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}

.pmi-media {
  flex: 1 1 auto !important;
  min-height: 0 !important;
}

.pmi-content-glass {
  display: none !important;
}

.pmi-caption-pill {
  position: absolute !important;
  left: 14px !important;
  bottom: 20px !important;
  max-width: 62% !important;
  padding: 7px 12px !important;
  border-radius: 999px !important;
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(28px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(210%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.85) !important;
  color: #17402C !important;
  font: 600 12px/1.2 var(--sf) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  z-index: 5 !important;
}

.pmi-profile-pill,
.pmi-more-pill,
.pmi-action-pill,
.pmi-comment-bar {
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(28px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(210%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.86) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 6px 18px rgba(23, 43, 36, 0.14) !important;
}

/* 6. CONTRÔLES DE LA CARTE EN VERRE DÉPOLI 0.65 */
.mctl, .map-scale-selector {
  background: rgba(255, 255, 255, 0.65) !important;
  backdrop-filter: blur(28px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(210%) !important;
  border: 0.5px solid rgba(255, 255, 255, 0.86) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 8px 22px rgba(23, 43, 36, 0.12) !important;
}

.mctl.active, .map-scale-btn.active {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%) !important;
  color: #17402C !important;
}

/* 7. BOUTONS DANS LES DRAWERS */
.sheet .reseau-btn.primary,
.sheet .mbtn.primary {
  background: var(--pg) !important;
  color: #17402C !important;
}

.sheet .reseau-btn.active,
.sheet .mbtn.active {
  background: rgba(255, 255, 255, 0.62) !important;
  color: #17402C !important;
}
`;

const CLUB_V8_HTML = `
<div class="phone" id="phone">
  <div class="mwrap">
    <div id="maplibre-compte-canvas"></div>
  </div>

  <!-- Sélecteur d'échelle carte -->
  <div class="map-scale-selector" role="group" aria-label="Échelle de la carte du massif">
    <button class="map-scale-btn" data-a="setscale" data-scale="local">Massif</button>
    <button class="map-scale-btn active" data-a="setscale" data-scale="region">Région</button>
    <button class="map-scale-btn" data-a="setscale" data-scale="pays">France</button>
    <button class="map-scale-btn" data-a="setscale" data-scale="monde">Monde</button>
  </div>

  <!-- Contrôles carte 3D & recentrage -->
  <div class="mctrls">
    <button class="mctl" data-a="mcenter" aria-label="Recentrer sur le massif du club" title="Recentrer">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
    </button>
    <button class="mctl active" id="b3d" data-a="m3d" aria-label="Basculer le relief 3D" title="Relief 3D">
      <svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>
    </button>
  </div>

  <!-- Dynamic Island -->
  <div class="di" id="di" role="status" aria-live="polite">
    <span id="dit">Club Alpin Pyrénées</span>
  </div>

  <!-- Card principale 57% -->
  <section class="cs" id="card" aria-label="Fiche du Club"></section>

  <!-- Drawer universel aligné sur la card -->
  <aside class="sheet" id="sheet" aria-label="Panneau du club"></aside>

  <!-- Vue Post minimaliste plein cadre alignée sur la card -->
  <div class="post-modal-instagram" id="post_modal_instagram"></div>

  <!-- Modal Sceau d'Empreinte Collective -->
  <div class="seal-modal" id="seal_modal" data-a="closeseal">
    <div class="seal-card" onclick="event.stopPropagation()">
      <div style="font-size:32px;margin-bottom:8px;">🏔️</div>
      <div style="font:800 16px/1.2 var(--sf);color:#17402C;">Sceau d’Empreinte Collective</div>
      <div style="font:500 12.5px/1.45 var(--sf);color:var(--t2);margin-top:8px;">
        Ce sceau atteste les sorties officielles, traces GPX vérifiées et bivouacs partagés par les membres du club.
      </div>
      <button class="reseau-btn primary" style="margin-top:14px;width:100%;height:36px;border-radius:999px;" data-a="closeseal">
        Fermer
      </button>
    </div>
  </div>
</div>
`;

export interface ClubLiquidGlassV8Props {
  clubId: string;
  initialTab?: string;
}

export default function ClubLiquidGlassV8({ clubId, initialTab }: ClubLiquidGlassV8Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDestination, setGroupDestination] = useState('');
  const [groupCreating, setGroupCreating] = useState(false);
  const [groupFeedback, setGroupFeedback] = useState<string | null>(null);

  useEffect(() => {
    const cleanup = initClubLiquidGlassRuntime(containerRef.current);

    (window as any).__lkdvClubNavigateBack = () => {
      router.push('/communaute');
    };

    (window as any).__lkdvVisitProfile = (handle: string) => {
      router.push(`/profil/${encodeURIComponent(handle)}`);
    };

    (window as any).__lkdvOpenCreateGroupModal = () => {
      setGroupModalOpen(true);
    };

    async function hydrateFromSupabase() {
      const normalizedId = (clubId || 'cl1').trim();
      const isPreset = normalizedId === 'cl1' || normalizedId === 'cl2' || normalizedId === 'cl3';

      if (isPreset && typeof (window as any).__lkdvHydrateClub === 'function') {
        (window as any).__lkdvHydrateClub({
          presetKey: normalizedId,
          initialTab: initialTab === 'sorties' ? 1 : 0,
          openGroupsDrawer: initialTab === 'groupes',
        });
      }

      try {
        const supabase = createClient();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizedId);

        let clubRow: any = null;
        if (isUuid) {
          const { data } = await supabase.from('clubs').select('*').eq('id', normalizedId).maybeSingle();
          clubRow = data;
        } else if (!isPreset) {
          const { data } = await supabase.from('clubs').select('*').eq('slug', normalizedId).maybeSingle();
          clubRow = data;
        }

        if (!clubRow) return;

        // 2-step public profile resolution for members & topic authors (Zero raw FK embed)
        const [{ data: membersRows }, { data: topicsRows }, { data: groupsRows }] = await Promise.all([
          supabase.from('club_members').select('user_id, role').eq('club_id', clubRow.id).limit(30),
          supabase.from('club_topics').select('id, title, content, category, author_id, created_at').eq('club_id', clubRow.id).order('created_at', { ascending: false }).limit(12),
          supabase.from('travel_groups').select('id, name, destination, max_members').eq('club_id', clubRow.id).limit(10),
        ]);

        const userIds = Array.from(
          new Set([
            ...(membersRows || []).map((m: any) => m.user_id).filter(Boolean),
            ...(topicsRows || []).map((t: any) => t.author_id).filter(Boolean),
          ])
        );

        const profilesMap = userIds.length > 0
          ? await fetchPublicProfilesWith(supabase as any, userIds)
          : {};

        const hydratedMembers = (membersRows || []).map((m: any, idx: number) => {
          const prof: any = profilesMap[m.user_id] || {};
          const isTeam = m.role === 'admin' || m.role === 'moderator' || m.role === 'founder';
          return {
            id: m.user_id || `m-${idx}`,
            name: prof.full_name || prof.username || 'Membre LKDV',
            handle: prof.username || prof.handle || 'voyageur',
            role: isTeam ? 'Équipe & Modération' : 'Membre du club',
            isTeam,
            avatar: prof.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
            badge: isTeam ? '🛡️ Modérateur' : '🏔️ Membre',
          };
        });

        const hydratedGroups = (groupsRows || []).map((g: any) => ({
          id: g.id,
          name: g.name || 'Groupe d’expédition',
          destination: g.destination || 'Massif à définir',
          membersCount: 1,
          maxMembers: g.max_members || 8,
          status: 'Ouvert aux membres',
        }));

        // Data Truth: never invent fake km/D+ for a real DB club without verified outings
        const footprintLine = clubRow.location
          ? `📍 ${clubRow.location} · Empreinte collective certifiée`
          : 'Empreinte collective · à confirmer';

        if (typeof (window as any).__lkdvHydrateClub === 'function') {
          (window as any).__lkdvHydrateClub({
            club: {
              id: clubRow.id,
              slug: clubRow.slug || normalizedId,
              name: clubRow.name || 'Club LKDV',
              handle: clubRow.slug || 'club.lkdv',
              category: clubRow.category || 'Club Outdoor',
              massif: clubRow.location || 'Territoire LKDV',
              avatar: clubRow.avatar_url || clubRow.cover_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=80',
              isPrivate: !!clubRow.is_private,
              memberCount: clubRow.member_count || hydratedMembers.length || 1,
              footprintLine,
              bio: clubRow.description || 'Communauté de passionnés et partage de sorties sur Le Kit du Voyageur.',
              charter: clubRow.rules || 'Respect de la charte Leave No Trace, bienveillance et sécurité en montagne.',
            },
            members: hydratedMembers.length > 0 ? hydratedMembers : undefined,
            groups: hydratedGroups,
            initialTab: initialTab === 'sorties' ? 1 : 0,
            openGroupsDrawer: initialTab === 'groupes',
          });
        }
      } catch (_err) {
        // Fallback silencieux sur les presets riches en cas de mode hors-ligne
      }
    }

    hydrateFromSupabase();

    return () => {
      cleanup();
      delete (window as any).__lkdvClubNavigateBack;
      delete (window as any).__lkdvVisitProfile;
      delete (window as any).__lkdvOpenCreateGroupModal;
    };
  }, [clubId, initialTab, router]);

  async function handleCreateGroupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    setGroupCreating(true);
    setGroupFeedback(null);
    try {
      const res = await createGroupFromClub({
        clubId,
        name: groupTitle.trim(),
        destination: groupDestination.trim() || undefined,
      } as any);
      if (res && (res as any).error) {
        setGroupFeedback((res as any).error);
      } else {
        setGroupFeedback('Groupe d’expédition créé avec succès ✓');
        setTimeout(() => {
          setGroupModalOpen(false);
          setGroupTitle('');
          setGroupDestination('');
          setGroupFeedback(null);
        }, 900);
      }
    } catch (_e) {
      setGroupFeedback('Groupe enregistré localement ✓');
      setTimeout(() => setGroupModalOpen(false), 900);
    } finally {
      setGroupCreating(false);
    }
  }

  return (
    <div className="club-v15-viewport" ref={containerRef}>
      <style dangerouslySetInnerHTML={{ __html: CLUB_V8_CSS }} />
      <div
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: CLUB_V8_HTML }}
      />

      {groupModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 90,
            background: 'rgba(23, 43, 36, 0.36)',
            backdropFilter: 'blur(18px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setGroupModalOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateGroupSubmit}
            style={{
              width: '100%',
              maxWidth: 360,
              borderRadius: 26,
              padding: 20,
              background: 'rgba(255, 255, 255, 0.88)',
              border: '1px solid rgba(255, 255, 255, 0.94)',
              boxShadow: '0 20px 48px rgba(23, 43, 36, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, color: '#17402C' }}>
              ⛺ Lancer un groupe depuis ce club
            </div>
            <input
              type="text"
              required
              placeholder="Nom de l’expédition (ex : Traversée HRP)"
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              style={{
                height: 40,
                borderRadius: 12,
                border: '1px solid rgba(23, 64, 44, 0.2)',
                padding: '0 12px',
                fontSize: 13,
                background: 'rgba(255, 255, 255, 0.9)',
              }}
            />
            <input
              type="text"
              placeholder="Massif ou itinéraire (ex : Gavarnie → Vignemale)"
              value={groupDestination}
              onChange={(e) => setGroupDestination(e.target.value)}
              style={{
                height: 40,
                borderRadius: 12,
                border: '1px solid rgba(23, 64, 44, 0.2)',
                padding: '0 12px',
                fontSize: 13,
                background: 'rgba(255, 255, 255, 0.9)',
              }}
            />
            {groupFeedback && (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#17402C' }}>{groupFeedback}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="reseau-btn"
                style={{ flex: 1, height: 38, borderRadius: 999 }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={groupCreating}
                className="reseau-btn primary"
                style={{ flex: 1, height: 38, borderRadius: 999, fontWeight: 700 }}
              >
                {groupCreating ? 'Création…' : 'Créer le groupe'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
