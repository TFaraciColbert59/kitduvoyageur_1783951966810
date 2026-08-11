// page.tsx - Redesign complet EARTH
// Design basé sur Earth.html - Globe central absolu avec panels contextuels

'"'"'use client'"'"';

import React, { useState, useMemo, useEffect, useCallback } from '"'"'react'"'"';
import dynamic from '"'"'next/dynamic'"'"';
import { useRouter } from '"'"'next/navigation'"'"';
import Link from '"'"'next/link'"'"';
import { getAllCountries, type Country } from '"'"'@/lib/countries'"'"';

// Composants Earth
import EarthLayout from '"'"'@/components/earth/EarthLayout'"'"';
import EarthHeader from '"'"'@/components/earth/EarthHeader'"'"';
import EarthExplorer from '"'"'@/components/earth/EarthExplorer'"'"';
import EarthStats from '"'"'@/components/earth/EarthStats'"'"';
import EarthNavigation from '"'"'@/components/earth/EarthNavigation'"'"';
import EarthCountryPanel from '"'"'@/components/earth/EarthCountryPanel'"'"';

// Globe 3D
const CountryGlobe = dynamic(
  () => import('"'"'@/components/pays/CountryGlobe'"'"'),
  { ssr: false }
);

const ALL_COUNTRIES = getAllCountries();

// Types pour les continents
type ContinentFilter = '"'"'all'"'"' | '"'"'europe'"'"' | '"'"'asia'"'"' | '"'"'africa'"'"' | '"'"'north-america'"'"' | '"'"'south-america'"'"' | '"'"'oceania'"'"';
type DangerFilter = '"'"'all'"'"' | '"'"'low'"'"' | '"'"'medium'"'"' | '"'"'high'"'"';

export default function EarthPage() {
  const router = useRouter();
  
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showCountryPanel, setShowCountryPanel] = useState(false);
  const [focusCode, setFocusCode] = useState<string | undefined>(undefined);
  const [webglSupported, setWebglSupported] = useState(true);

  // Détection WebGL
  useEffect(() => {
    if (typeof document !== '"'"'undefined'"'"') {
      const canvas = document.createElement('"'"'canvas'"'"');
      const gl = canvas.getContext('"'"'webgl'"'"') || canvas.getContext('"'"'webgl2'"'"');
      if (!gl) setWebglSupported(false);
    }
  }, []);

  const handleCountryClick = useCallback((code: string) => {
    const country = ALL_COUNTRIES.find(c => c.code.toLowerCase() === code.toLowerCase());
    if (country) {
      setSelectedCountry(country);
      setShowCountryPanel(true);
      setFocusCode(code.toLowerCase());
    }
  }, []);

  const handleExploreCountry = useCallback((code: string) => {
    router.push(`/pays/${code.toLowerCase()}`);
  }, [router]);

  const handleResetView = useCallback(() => {
    setSelectedCountry(null);
    setShowCountryPanel(false);
    setFocusCode(undefined);
  }, []);

  // Fallback WebGL
  if (!webglSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">🌍</div>
          <h1 className="text-3xl font-bold text-white mb-4">WebGL requis</h1>
          <p className="text-white/70 mb-6">
            Votre navigateur ne supporte pas WebGL, nécessaire pour l'"'"'expérience Earth 3D.
            Essayez avec Chrome, Firefox ou Edge récent.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
          >
            Rafraîchir la page
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Navigation overlay */}
      <div className="fixed top-0 left-0 right-0 z-50 px-6 md:px-10 lg:px-16 pt-6">
        <div className="max-w-7xl mx-auto">
          <nav className="bg-[rgba(10,30,23,0.55)] backdrop-blur-[20px] saturate-[1.4] border-b border-[rgba(168,196,162,0.10)] rounded-[999px] px-4 py-3 md:py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-white">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
                  </svg>
                </div>
                <span className="text-white font-semibold tracking-wide">Le Kit du Voyageur</span>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/pays" className="text-[rgba(255,255,255,0.75)] hover:text-white text-[13px] transition-colors">Earth</Link>
                <Link href="/aventures" className="text-[rgba(255,255,255,0.75)] hover:text-white text-[13px] transition-colors">Aventures</Link>
                <Link href="/refuges" className="text-[rgba(255,255,255,0.75)] hover:text-white text-[13px] transition-colors">Refuges</Link>
                <Link href="/massifs" className="text-[rgba(255,255,255,0.75)] hover:text-white text-[13px] transition-colors">Massifs</Link>
                <button className="text-[rgba(255,255,255,0.75)] hover:text-white hover:bg-[rgba(255,255,255,0.08)] rounded-full p-2 transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>
      
      <EarthLayout
        topContent={<EarthHeader onSearchChange={(v) => setFocusCode(v || undefined)} searchValue={focusCode || '"'"''"'"'} />}
        leftContent={
          <EarthExplorer 
            onContinentSelect={(c) => setFocusCode(undefined)}
            selectedContinent="all"
            selectedDanger="all"
          />
        }
        centerContent={
          <div className="relative w-full h-full">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-full max-w-4xl max-h-[70vh]">
                <CountryGlobe
                  countries={ALL_COUNTRIES}
                  onCountryClick={handleCountryClick}
                  focusCode={focusCode}
                  fullscreen={true}
                />
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-slate-950/30"></div>
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-slate-950 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent"></div>
            </div>
          </div>
        }
        rightContent={<EarthStats />}
        bottomContent={
          <EarthNavigation
            selectedCountry={selectedCountry?.nom || null}
            totalCountries={ALL_COUNTRIES.length}
            filteredCountries={ALL_COUNTRIES.length}
            onResetView={handleResetView}
          />
        }
      />

      <EarthCountryPanel
        country={selectedCountry}
        isVisible={showCountryPanel}
        onClose={() => setShowCountryPanel(false)}
        onExploreCountry={handleExploreCountry}
      />

      {/* Destinations section */}
      <section className="relative z-20 py-16 px-6 md:px-10 lg:px-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <div className="text-sm text-emerald-600 mb-3">Découvertes · saison automne 2026</div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Six pays <em className="font-serif text-emerald-700">qui montent.</em>
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl">
              Les destinations où la communauté trace de nouveaux itinéraires ce trimestre.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
            {/* Wide card */}
            <div className="lg:col-span-4.8 relative group overflow-hidden rounded-2xl aspect-[4/5] bg-slate-100 cursor-pointer transition-transform hover:-translate-y-1">
              <img src="https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Chartreuse" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-106" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute top-4 left-4">
                <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1">
                  <span className="text-lg">🇫🇷</span> FR
                </div>
              </div>
              <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Massif de la Chartreuse <em className="font-serif text-emerald-300">,</em></h3>
                <p className="text-sm text-white/70 mb-3">Alpes du Nord · 312 itinéraires · refuges gardés</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Alt</span> 2082 m</span>
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Saison</span> Mai–Oct</span>
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Diff</span> Modérée</span>
                </div>
              </div>
            </div>

            {/* Two regular cards */}
            <div className="lg:col-span-2.4 relative group overflow-hidden rounded-2xl aspect-[4/5] bg-slate-100 cursor-pointer transition-transform hover:-translate-y-1">
              <img src="https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Landmannalaugar" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-106" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute top-4 left-4">
                <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1">
                  <span className="text-lg">🇮🇸</span> IS
                </div>
              </div>
              <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Landmannalaugar <em className="font-serif text-emerald-300">.</em></h3>
                <p className="text-sm text-white/70 mb-3">Hautes terres · 4 j</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Type</span> Trek</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2.4 relative group overflow-hidden rounded-2xl aspect-[4/5] bg-slate-100 cursor-pointer transition-transform hover:-translate-y-1">
              <img src="https://images.pexels.com/photos/691637/pexels-photo-691637.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Kumano" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-106" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute top-4 left-4">
                <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1">
                  <span className="text-lg">🇯🇵</span> JP
                </div>
              </div>
              <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Kumano <em className="font-serif text-emerald-300">Kodō.</em></h3>
                <p className="text-sm text-white/70 mb-3">Kii · 7 jours</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Type</span> Pèlerinage</span>
                </div>
              </div>
            </div>

            {/* Three cards row 2 */}
            <div className="lg:col-span-2.4 relative group overflow-hidden rounded-2xl aspect-[4/5] bg-slate-100 cursor-pointer transition-transform hover:-translate-y-1">
              <img src="https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Lofoten" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-106" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute top-4 left-4">
                <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1">
                  <span className="text-lg">🇳🇴</span> NO
                </div>
              </div>
              <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Lofoten <em className="font-serif text-emerald-300">.</em></h3>
                <p className="text-sm text-white/70 mb-3">Archipel · 5 j</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Type</span> Côtier</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2.4 relative group overflow-hidden rounded-2xl aspect-[4/5] bg-slate-100 cursor-pointer transition-transform hover:-translate-y-1">
              <img src="https://images.pexels.com/photos/814499/pexels-photo-814499.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Langtang" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-106" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute top-4 left-4">
                <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1">
                  <span className="text-lg">🇳🇵</span> NP
                </div>
              </div>
              <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Vallée du Langtang <em className="font-serif text-emerald-300">.</em></h3>
                <p className="text-sm text-white/70 mb-3">Himalaya · 10 j</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Alt</span> 4984 m</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4.8 relative group overflow-hidden rounded-2xl aspect-[4/5] bg-slate-100 cursor-pointer transition-transform hover:-translate-y-1">
              <img src="https://images.pexels.com/photos/2437291/pexels-photo-2437291.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Torres del Paine" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-106" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
              <div className="absolute top-4 left-4">
                <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-900 flex items-center gap-1">
                  <span className="text-lg">🇨🇱</span> CL
                </div>
              </div>
              <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Torres del Paine <em className="font-serif text-emerald-300">.</em></h3>
                <p className="text-sm text-white/70 mb-3">Patagonie · 8 jours · circuit W</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Alt</span> 1200 m</span>
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Saison</span> Déc–Fév</span>
                  <span className="px-3 py-1 bg-white/15 backdrop-blur rounded-full text-[10px] font-medium text-white"><span className="opacity-60">Diff</span> Soutenue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats section */}
      <section className="relative z-20 py-16 px-6 md:px-10 lg:px-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-900 rounded-2xl p-6 text-white">
              <div className="text-sm text-emerald-300 mb-2">🌍 Pays cartographiés</div>
              <div className="text-4xl font-bold mb-2">137 <span className="text-2xl text-emerald-400">/ 195</span></div>
              <div className="text-sm text-slate-400">70 % du globe. On avance département par département.</div>
            </div>
            <div className="bg-emerald-900 rounded-2xl p-6 text-white">
              <div className="text-sm text-emerald-200 mb-2">🧭 Itinéraires vérifiés</div>
              <div className="text-4xl font-bold mb-2">2 481</div>
              <div className="text-sm text-emerald-100/80">Chaque itinéraire passe par un testeur avant publication.</div>
            </div>
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-sm text-emerald-700 mb-3">01 · Terrain</div>
                <h4 className="text-xl font-bold mb-3">Six semaines de marche.</h4>
                <p className="text-sm text-slate-600">Chaque région est visitée par trois testeurs partenaires.</p>
              </div>
              <div>
                <div className="text-sm text-emerald-700 mb-3">02 · Relecture</div>
                <h4 className="text-xl font-bold mb-3">Une carte relue à deux voix.</h4>
                <p className="text-sm text-slate-600">Chaque itinéraire est confié à un second testeur.</p>
              </div>
              <div>
                <div className="text-sm text-emerald-700 mb-3">03 · Publication</div>
                <h4 className="text-xl font-bold mb-3">Publié quand on est sûrs.</h4>
                <p className="text-sm text-slate-600">On préfère 137 pays vérifiés à 195 pays approximatifs.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
