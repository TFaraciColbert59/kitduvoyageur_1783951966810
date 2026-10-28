'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { IOS27BottomBar } from '@/components/navigation/IOS27BottomBar';
import { DESTINATIONS, type DestinationId } from '@/components/mobile-nav/destinationRegistry';

const WALLPAPERS = [
  {
    id: 'minimal',
    label: '✨ Verre Clair LKDV',
    bg: 'linear-gradient(180deg, #f5f7f3 0%, #e2e8de 50%, #cfd6c8 100%)',
    textColor: '#17402c',
  },
  {
    id: 'alps',
    label: '🏔️ Haute Montagne',
    bg: 'linear-gradient(180deg, #b8cde3 0%, #e8edf3 35%, #768d9e 70%, #3e505d 100%)',
    textColor: '#17402c',
  },
  {
    id: 'forest',
    label: '🌲 Forêt Brumeuse',
    bg: 'linear-gradient(180deg, #d3ded5 0%, #a2bba9 40%, #466753 75%, #1b3826 100%)',
    textColor: '#17402c',
  },
  {
    id: 'sunset',
    label: '🌅 Lac d’Altitude',
    bg: 'linear-gradient(180deg, #f9dfca 0%, #e5b9a8 35%, #88687a 70%, #2f2a40 100%)',
    textColor: '#17402c',
  },
  {
    id: 'dark',
    label: '🌑 Nuit Sombre',
    bg: 'linear-gradient(180deg, #1c2522 0%, #0d1512 60%, #050907 100%)',
    textColor: '#e8f0ec',
  },
];

export default function IOS27BottomBarDevPage() {
  const [activeTab, setActiveTab] = useState<DestinationId | undefined>('me');
  const [wallpaperId, setWallpaperId] = useState('minimal');
  const [showSimulatedKeyboard, setShowSimulatedKeyboard] = useState(false);
  const [hapticLog, setHapticLog] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'iphone' | 'fullscreen'>('iphone');

  const currentWp = WALLPAPERS.find((w) => w.id === wallpaperId) || WALLPAPERS[0];

  const handleTabSelect = (id: DestinationId) => {
    setActiveTab(id);
    const now = new Date().toLocaleTimeString('fr-FR', { second: '2-digit', fractionalSecondDigits: 2 } as any);
    setHapticLog((prev) => [`[${now}] Haptic selectionChanged() → Tab: ${id}`, ...prev.slice(0, 4)]);
  };

  return (
    <div className="min-h-screen w-full bg-[#0e1613] text-[#d6ded9] font-sans p-4 md:p-8 flex flex-col items-center">
      {/* Header Lab */}
      <header className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#23352c]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-[#1f4a36] text-[#6ee7b7] tracking-wider uppercase">
              Laboratoire UI LKDV
            </span>
            <span className="text-xs text-[#82998e]">Next.js 15 · iOS 27 Liquid Glass</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
            Bottom Bar iOS 27 Swift — Liquid Glass & Stretch Élastique
          </h1>
          <p className="text-sm text-[#8fa79c] mt-0.5">
            Pilule sélective à étirement fluide qui déborde des cellules en vol · Texture Liquid Glass · Icônes modernes Apple / Instagram sans texte.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/compte"
            className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#1a2d24] hover:bg-[#254234] text-[#a4c7b5] transition-colors"
          >
            ← Retour au Compte
          </Link>
          <div className="flex rounded-lg bg-[#15231c] p-0.5 border border-[#23382d]">
            <button
              onClick={() => setViewMode('iphone')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'iphone' ? 'bg-[#29543e] text-white shadow-sm' : 'text-[#7d998c] hover:text-white'
              }`}
            >
              📱 iPhone Mockup
            </button>
            <button
              onClick={() => setViewMode('fullscreen')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'fullscreen' ? 'bg-[#29543e] text-white shadow-sm' : 'text-[#7d998c] hover:text-white'
              }`}
            >
              🖥️ Plein Écran
            </button>
          </div>
        </div>
      </header>

      {/* Main Sandbox Layout */}
      <main className="w-full max-w-5xl mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Phone Canvas */}
        <section className={`${viewMode === 'iphone' ? 'lg:col-span-6' : 'lg:col-span-12'} flex justify-center`}>
          {viewMode === 'iphone' ? (
            /* iPhone 16 Pro Frame (430 × 932) */
            <div
              className="relative rounded-[var(--lkv-radius-device-frame)] p-3 shadow-2xl transition-all duration-300"
              style={{
                width: 'min(100%, 430px)',
                height: '840px',
                background: 'linear-gradient(135deg, #3d4a44 0%, #1a221f 50%, #0d1210 100%)',
                boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8), inset 0 0 2px 1px rgba(255,255,255,0.2)',
              }}
            >
              {/* Screen Interior */}
              <div
                className="relative w-full h-full rounded-[var(--lkv-radius-device-screen)] overflow-hidden flex flex-col justify-between"
                style={{
                  background: currentWp.bg,
                  transition: 'background 0.5s ease',
                }}
              >
                {/* Dynamic Island & Status Bar */}
                <div className="w-full pt-3 px-7 flex items-center justify-between z-30 select-none">
                  <span className="text-xs font-semibold" style={{ color: currentWp.textColor }}>
                    09:41
                  </span>
                  {/* Dynamic Island Pill */}
                  <div className="w-28 h-7 bg-black rounded-full flex items-center justify-end pr-2.5 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#17223b] border border-[#2b3957]" />
                  </div>
                  {/* Battery & Signal icons */}
                  <div className="flex items-center gap-1.5" style={{ color: currentWp.textColor }}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z" />
                    </svg>
                    <div className="w-5 h-2.5 rounded-sm border border-current p-0.5 flex items-center">
                      <div className="h-full w-3 bg-current rounded-2xs" />
                    </div>
                  </div>
                </div>

                {/* Simulated Content Body */}
                <div className="flex-1 p-5 overflow-y-auto z-10 flex flex-col justify-start">
                  {/* Hero Glass Card inside phone */}
                  <div
                    className="p-4 rounded-2xl border mb-4 backdrop-blur-md"
                    style={{
                      background: 'rgba(255, 255, 255, 0.45)',
                      borderColor: 'rgba(255, 255, 255, 0.6)',
                      boxShadow: '0 8px 24px rgba(23,43,36,0.08)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#17402c] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        LK
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-[#17402c]">Le Kit du Voyageur</h2>
                        <p className="text-xs text-[#56665d]">Style Instagram & Apple iOS 27</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#3d4d44] mt-3 leading-relaxed">
                      Cliquez entre deux onglets éloignés (ex: <b>Hub ↔ Compte</b>) pour observer la pilule de verre s’étirer élastiquement au-delà des cellules avant d’atterrir avec le rebond liquide Apple.
                    </p>
                  </div>

                  {/* Interactive Input for Keyboard Test */}
                  <div className="p-3.5 rounded-xl bg-white/40 border border-white/50 backdrop-blur-sm">
                    <label className="text-[11px] font-semibold text-[#17402c] block mb-1">
                      Test de saisie (Clavier iOS)
                    </label>
                    <input
                      type="text"
                      placeholder="Tapez un message..."
                      onFocus={() => setShowSimulatedKeyboard(true)}
                      onBlur={() => setShowSimulatedKeyboard(false)}
                      className="w-full text-xs px-3 py-2 rounded-lg bg-white/70 border border-white/80 text-[#17402c] placeholder-[#7d8f85] outline-none focus:ring-2 focus:ring-[#17402c]/20"
                    />
                    <span className="text-[10px] text-[#56665d] mt-1 block">
                      En prenant le focus, la barre s’efface en douceur.
                    </span>
                  </div>
                </div>

                {/* Simulated Keyboard Overlay if active */}
                {showSimulatedKeyboard && (
                  <div className="w-full bg-[#d1d5db]/90 backdrop-blur-xl p-3 border-t border-white/40 z-40 animate-slide-up flex flex-col items-center">
                    <div className="flex justify-between w-full text-xs text-[#374151] px-2 mb-2 font-medium">
                      <span>Clavier Virtuel iOS</span>
                      <button
                        onClick={() => setShowSimulatedKeyboard(false)}
                        className="text-[#2563eb] font-semibold"
                      >
                        Terminer
                      </button>
                    </div>
                    <div className="w-full h-36 rounded-xl bg-[#e5e7eb]/80 border border-black/10 flex items-center justify-center text-xs text-[#6b7280]">
                      [Clavier iOS simulé — la barre s’efface]
                    </div>
                  </div>
                )}

                {/* IOS 27 Bottom Bar in Phone Context */}
                <div className="relative w-full pb-6 px-3 flex justify-center z-20">
                  <IOS27BottomBar
                    activeTabId={activeTab}
                    onSelectTab={handleTabSelect}
                    disableKeyboardDetection={true}
                    style={{
                      position: 'relative',
                      bottom: 0,
                      transform: 'none',
                      left: 'auto',
                    }}
                  />
                </div>

                {/* Home Indicator */}
                <div className="w-full pb-2 flex justify-center z-30 select-none">
                  <div className="w-36 h-1 rounded-full bg-black/60" />
                </div>
              </div>
            </div>
          ) : (
            /* Fullscreen Mode */
            <div
              className="w-full min-h-[500px] rounded-2xl relative p-6 flex flex-col justify-between overflow-hidden shadow-xl"
              style={{ background: currentWp.bg }}
            >
              <div>
                <h2 className="text-xl font-bold" style={{ color: currentWp.textColor }}>
                  Vue Intégrée Plein Écran
                </h2>
                <p className="text-sm mt-1" style={{ color: currentWp.textColor, opacity: 0.85 }}>
                  La barre basse flotte librement en bas du conteneur en appliquant la transparence au contenu d’arrière-plan.
                </p>
              </div>

              <div className="w-full py-8 flex justify-center">
                <IOS27BottomBar
                  activeTabId={activeTab}
                  onSelectTab={handleTabSelect}
                  style={{
                    position: 'relative',
                    bottom: 0,
                    transform: 'none',
                    left: 'auto',
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Controls & Tokens Inspector */}
        <aside className={`${viewMode === 'iphone' ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-6`}>
          {/* Controls Box */}
          <div className="p-5 rounded-2xl bg-[#141f1a] border border-[#23352c]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <span>⚡</span> Contrôles d’Étirement Liquide
            </h3>

            {/* Tab Selection */}
            <div className="mb-4">
              <label className="text-xs text-[#8fa79c] font-semibold block mb-2">
                Sauter vers un onglet (Déclenche l’étirement élastique)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {DESTINATIONS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    className={`px-2 py-2 text-xs rounded-lg font-medium transition-all text-center ${
                      activeTab === tab.id
                        ? 'bg-[#29543e] text-white shadow-md'
                        : 'bg-[#1b2b23] text-[#7d998c] hover:bg-[#22382d]'
                    }`}
                  >
                    {tab.label.fr}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Jumps for Stretch Demos */}
            <div className="mb-4 p-3 rounded-xl bg-[#172620] border border-[#23382d]">
              <span className="text-[11px] text-[#8fa79c] font-semibold block mb-2">
                Démonstrations de saut de distance :
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleTabSelect(activeTab === 'adventures' ? 'me' : 'adventures');
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#214232] hover:bg-[#2a543f] text-[#6ee7b7] transition-all"
                >
                  🚀 Grand saut (Hub ↔ Compte)
                </button>
                <button
                  onClick={() => {
                    const next = activeTab === 'explorer' ? 'community' : 'explorer';
                    handleTabSelect(next);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#1a3327] hover:bg-[#234233] text-[#a4c7b5] transition-all"
                >
                  ↔ Saut voisin (1 cellule)
                </button>
              </div>
            </div>

            {/* Wallpaper Selection */}
            <div className="mb-4">
              <label className="text-xs text-[#8fa79c] font-semibold block mb-2">
                Fond d’Arrière-Plan (Réfraction du Verre)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WALLPAPERS.map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => setWallpaperId(wp.id)}
                    className={`px-3 py-2 text-xs rounded-lg font-medium border text-left transition-all ${
                      wallpaperId === wp.id
                        ? 'border-[#4ade80] bg-[#1a3327] text-white'
                        : 'border-[#263c31] bg-[#17251f] text-[#8fa79c] hover:border-[#355243]'
                    }`}
                  >
                    {wp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard & Inactive Toggle */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#23352c]">
              <button
                onClick={() => setShowSimulatedKeyboard((v) => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e3027] hover:bg-[#284236] text-[#b3d4c3] transition-colors"
              >
                {showSimulatedKeyboard ? 'Masquer Clavier' : 'Simuler Clavier Virtuel iOS'}
              </button>
              <button
                onClick={() => {
                  setActiveTab(undefined);
                  setHapticLog((p) => [`Lentille masquée (route externe)`, ...p.slice(0, 4)]);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e3027] hover:bg-[#284236] text-[#b3d4c3] transition-colors"
              >
                Désélectionner (Opacité 0)
              </button>
            </div>
          </div>

          {/* Haptic Log Box */}
          <div className="p-4 rounded-xl bg-[#141f1a] border border-[#23352c]">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>📳 Journal Haptique (Taptic Engine)</span>
              <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
            </h4>
            <div className="space-y-1 font-mono text-xs text-[#7d998c]">
              {hapticLog.length === 0 ? (
                <p className="text-[#4e6459] italic">Cliquez sur un onglet pour déclencher l’haptique...</p>
              ) : (
                hapticLog.map((log, i) => (
                  <div key={i} className="text-[#96dfb9]">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Technical Specs Comparison */}
          <div className="p-5 rounded-2xl bg-[#141f1a] border border-[#23352c] space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              📐 Caractéristiques Liquid Stretch & Iconographie
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#182620] border border-[#23382e]">
                <span className="text-[#6ee7b7] font-semibold block">Étirement Liquide (scaleX)</span>
                <p className="text-[#a4c7b5] mt-1">Jusqu’à 1.58x en vol</p>
                <p className="text-[#647e71] mt-0.5">Dépassement franc des limites</p>
              </div>

              <div className="p-3 rounded-lg bg-[#182620] border border-[#23382e]">
                <span className="text-[#6ee7b7] font-semibold block">Physique Ressort</span>
                <p className="text-[#a4c7b5] mt-1">Stiffness 440 · Damping 27</p>
                <p className="text-[#647e71] mt-0.5">Rebond et compression d’atterrissage</p>
              </div>

              <div className="p-3 rounded-lg bg-[#182620] border border-[#23382e]">
                <span className="text-[#6ee7b7] font-semibold block">Style Icônes</span>
                <p className="text-[#a4c7b5] mt-1">Apple / Instagram SF-style</p>
                <p className="text-[#647e71] mt-0.5">Outline fin ↔ Rempli actif 22px</p>
              </div>

              <div className="p-3 rounded-lg bg-[#182620] border border-[#23382e]">
                <span className="text-[#6ee7b7] font-semibold block">Zéro Texte Visible</span>
                <p className="text-[#a4c7b5] mt-1">100% Icônes seules</p>
                <p className="text-[#647e71] mt-0.5">Accessibilité aria-label complète</p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
