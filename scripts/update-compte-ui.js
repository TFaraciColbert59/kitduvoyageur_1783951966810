const fs = require('fs');

const v8File = 'src/components/compte/CompteLiquidGlassV8.tsx';
let v8Content = fs.readFileSync(v8File, 'utf8');

// 1. Insert map loading bar into COMPTE_V8_HTML inside #map
const oldMapMarkup = '<div class=\\"map\\" id=\\"map\\"><div id=\\"maplibre-compte-canvas\\" style=\\"position:absolute;inset:0;width:100%;height:100%;z-index:1;\\"></div><div class=\\"map-badge-3d\\"><span class=\\"badge-dot-live\\"></span><span>Relief 3D Vivant</span></div><a href=\\"/carte-3d\\" class=\\"btn-3d-fullscreen\\" aria-label=\\"Ouvrir la carte 3D plein écran\\">Mission Control 3D ↗</a>';

const newMapMarkup = '<div class=\\"map\\" id=\\"map\\"><div id=\\"map-loading-bar\\" class=\\"map-loading-bar\\"><div class=\\"map-loading-pill\\"><span class=\\"map-loading-pulse\\"></span><span>Initialisation du Relief 3D…</span></div><div class=\\"map-loading-track\\"><div id=\\"map-loading-fill\\" class=\\"map-loading-fill\\"></div></div></div><div id=\\"maplibre-compte-canvas\\" style=\\"position:absolute;inset:0;width:100%;height:100%;z-index:1;\\"></div><div class=\\"map-badge-3d\\"><span class=\\"badge-dot-live\\"></span><span>Relief 3D Vivant</span></div><a href=\\"/carte-3d\\" class=\\"btn-3d-fullscreen\\" aria-label=\\"Ouvrir la carte 3D plein écran\\">Mission Control 3D ↗</a>';

if (v8Content.includes(oldMapMarkup)) {
  v8Content = v8Content.replace(oldMapMarkup, newMapMarkup);
  console.log('Successfully inserted map loading bar into COMPTE_V8_HTML');
} else {
  console.log('Warning: oldMapMarkup not matched directly');
}

// 2. Expand COMPTE_V8_APPLE_HIG_CSS with +20% map height, generous stat box padding, and 3D loading bar
const oldHigCssStart = 'const COMPTE_V8_APPLE_HIG_CSS = `';
const newHigCss = `const COMPTE_V8_APPLE_HIG_CSS = \`
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

/* +20% Map Height: adjust grid from 60% top / 40% map to 48% top / 52% map */
.phone {
  grid-template-rows: calc(48% - 39px) 1fr !important;
  transition: grid-template-rows 0.55s cubic-bezier(0.32, 0.72, 0, 1) !important;
}
.phone.mapbig {
  grid-template-rows: 120px 1fr !important;
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
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
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

/* Shared element transition animation for 3D Mission Control launch */
.btn-3d-fullscreen.launching {
  transform: scale(1.08) !important;
  background: #17402C !important;
  color: #fff !important;
  box-shadow: 0 0 32px rgba(64, 192, 87, 0.6) !important;
  transition: all 0.28s cubic-bezier(0.3, 1.4, 0.5, 1) !important;
}
\`;`;

const higCssRegex = /const COMPTE_V8_APPLE_HIG_CSS = `[\s\S]*?`;/;
if (higCssRegex.test(v8Content)) {
  v8Content = v8Content.replace(higCssRegex, newHigCss);
  console.log('Successfully updated COMPTE_V8_APPLE_HIG_CSS');
} else {
  console.log('Warning: COMPTE_V8_APPLE_HIG_CSS not matched');
}

fs.writeFileSync(v8File, v8Content, 'utf8');
console.log('CompteLiquidGlassV8.tsx updated successfully');
