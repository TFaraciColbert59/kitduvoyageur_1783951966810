"use client";

import '@/app/pays/styles/tokens.css';
import '@/app/pays/styles/shop.css';
import '@/app/pays/styles/earth.css';

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobilePageShell from "@/components/mobile-nav/MobilePageShell";
import { getAllCountries, type Country } from "@/lib/countries";

// Globe 3D dynamique
const CountryGlobe = dynamic(
  () => import("@/components/pays/CountryGlobe"),
  { ssr: false }
);

const ALL_COUNTRIES = getAllCountries();

export default function EarthPage() {
  const router = useRouter();
  
  const [isMobile, setIsMobile] = useState<boolean>(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [focusCode, setFocusCode] = useState<string | undefined>(undefined);
  const [selectedContinent, setSelectedContinent] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("Chartreuse");

  const handleCountryClick = useCallback((code: string) => {
    router.push(`/pays/${code.toLowerCase()}`);
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-[#F5F2EA] text-[#1C2620] flex flex-col overflow-x-hidden font-sans">
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        {/* Site Header */}
        <Header />

        {/* Main Content */}
        <main className="flex-1 w-full pt-20 pb-12">
        <div className="max-w-[1500px] mx-auto px-2 sm:px-4">
          {/* EARTH HERO CONTAINER (Floating Dark Green Stage on Light Background) */}
          <section className="earth-hero w-full relative rounded-[0.75rem] sm:rounded-[36px] shadow-2xl overflow-hidden my-2">
            {/* HEADING */}
            <div className="hero-head max-w-5xl mx-auto pt-10 sm:pt-14 pb-6">
              <div className="eye">
                <span className="dot"></span>Earth · Cartographie vivante · 137 pays
              </div>
              <h1>Le monde,<br/><em>à hauteur de sentier.</em></h1>
              <p>Faites tourner la planète, choisissez un pays, découvrez les itinéraires testés par la communauté. Chaque point est une histoire de terrain.</p>

              {/* Search bar moved here to avoid overlapping the globe */}
              <div className="globe-search">
                <svg className="lkv-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
                </svg>
                <input
                  type="text"
                  placeholder="Chercher un pays, une région, un massif…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setFocusCode(e.target.value || undefined);
                  }}
                />
                <span className="kbd"><span>⌘</span><span>K</span></span>
                <button className="go-btn" onClick={() => setFocusCode(searchQuery)}>Lancer</button>
              </div>
            </div>

            {/* GLOBE STAGE */}
            <div className="globe-stage w-full max-w-[1400px] mx-auto relative">

              {/* Left: Continents panel */}
              <aside className="globe-side hidden md:block">
                <div className="lbl">Continents <span>7 / 7</span></div>
                <div className={`cont-row ${selectedContinent === "europe" || selectedContinent === "all" ? "on" : ""}`} onClick={() => setSelectedContinent("europe")}>
                  <div className="l"><span className="k">01</span> Europe</div>
                  <div className="r">44 pays</div>
                </div>
                <div className={`cont-row ${selectedContinent === "asia" ? "on" : ""}`} onClick={() => setSelectedContinent("asia")}>
                  <div className="l"><span className="k">02</span> Asie</div>
                  <div className="r">48 pays</div>
                </div>
                <div className={`cont-row ${selectedContinent === "africa" ? "on" : ""}`} onClick={() => setSelectedContinent("africa")}>
                  <div className="l"><span className="k">03</span> Afrique</div>
                  <div className="r">54 pays</div>
                </div>
                <div className={`cont-row ${selectedContinent === "north-america" ? "on" : ""}`} onClick={() => setSelectedContinent("north-america")}>
                  <div className="l"><span className="k">04</span> Amérique N.</div>
                  <div className="r">23 pays</div>
                </div>
                <div className={`cont-row ${selectedContinent === "south-america" ? "on" : ""}`} onClick={() => setSelectedContinent("south-america")}>
                  <div className="l"><span className="k">05</span> Amérique S.</div>
                  <div className="r">12 pays</div>
                </div>
                <div className={`cont-row ${selectedContinent === "oceania" ? "on" : ""}`} onClick={() => setSelectedContinent("oceania")}>
                  <div className="l"><span className="k">06</span> Océanie</div>
                  <div className="r">14 pays</div>
                </div>
                <div className="cont-row">
                  <div className="l"><span className="k">07</span> Antarctique</div>
                  <div className="r">— · zones</div>
                </div>
              </aside>

              {/* Globe Canvas */}
              <div id="globeViz" className="w-full h-full flex items-center justify-center">
                {!isMobile && (
                  <CountryGlobe
                    countries={ALL_COUNTRIES}
                    onCountryClick={handleCountryClick}
                    focusCode={focusCode}
                    fullscreen={true}
                  />
                )}
              </div>

              {/* Ambient Orbits */}
              <div className="orbit o1"></div>
              <div className="orbit o2"></div>
              <div className="orbit o3"></div>

              {/* Right: Destination info card */}
              <aside className="globe-info-card hidden md:block">
                <div className="flag">🇫🇷 · France · Rhône-Alpes</div>
                <h3>Chartreuse<em>, massif</em></h3>
                <div className="region">45.35°N · 5.86°E · 2 082 m max</div>
                <div className="stats-row">
                  <div>
                    <div className="n">312</div>
                    <div className="l">Itinéraires</div>
                  </div>
                  <div>
                    <div className="n">4 850</div>
                    <div className="l">Voyageurs</div>
                  </div>
                  <div>
                    <div className="n">47</div>
                    <div className="l">Refuges</div>
                  </div>
                  <div>
                    <div className="n">6</div>
                    <div className="l">Testeurs LKV</div>
                  </div>
                </div>
                <Link href="/pays/fr" className="cta">
                  Explorer la Chartreuse
                  <svg className="lkv-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </Link>
              </aside>

              {/* Bottom: Controls */}
              <div className="globe-controls">
                <button className="gc-btn on">
                  <svg className="lkv-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg>
                  Vue mondiale
                </button>
                <button className="gc-btn">
                  <svg className="lkv-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M12 2v20"/></svg>
                  Grille
                </button>
                <button className="gc-btn">
                  <svg className="lkv-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v4l3 2"/></svg>
                  Nuit
                </button>
                <div className="sep"></div>
                <button className="gc-btn" aria-label="Layout">
                  <svg className="lkv-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>
                </button>
                <button className="gc-btn" aria-label="Suivant">
                  <svg className="lkv-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M14 6l6 6-6 6"/></svg>
                </button>
              </div>
            </div>

            {/* Bottom Hints */}
            <div className="earth-bottom max-w-[1400px] mx-auto px-6">
              <div className="hints">
                <div className="hint"><span className="k">Cliquer</span>un pays pour zoomer</div>
                <div className="hint"><span className="k">Glisser</span>pour tourner</div>
                <div className="hint"><span className="k">Scroll</span>pour mezoomer</div>
              </div>
              <div className="marker"><span className="d"></span>Données mises à jour il y a 3 minutes · 8 428 points actifs</div>
            </div>
          </section>

          {/* DESTINATIONS SECTION */}
          <section className="dest-section w-full rounded-[0.75rem] mt-8">
            <div className="max-w-[1400px] mx-auto">
              <div className="dest-head">
                <div className="l">
                  <div className="lkv-eyebrow">Découvertes · saison automne 2026</div>
                  <h2>Six pays<br/><em>qui montent.</em></h2>
                  <p>Les destinations où la communauté trace de nouveaux itinéraires ce trimestre. Sélection humaine, pas d'algorithme.</p>
                </div>
                <div className="filters">
                  <button className="on">Tendance</button>
                  <button>Populaires</button>
                  <button>Sauvage</button>
                  <button>Proche</button>
                </div>
              </div>

              <div className="dest-grid">
                <Link href="/pays/fr" className="dest-card wide">
                  <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=1200')` }}></div>
                  <div className="top">
                    <div className="flag-code"><span className="fc">FR</span> France</div>
                    <button className="fav" aria-label="Favori">
                      <svg className="lkv-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>
                    </button>
                  </div>
                  <div className="info">
                    <h3>Massif de la<br/><em>Chartreuse.</em></h3>
                    <div className="sub">Alpes du Nord <span className="sep">·</span> 312 itinéraires <span className="sep">·</span> refuges gardés</div>
                    <div className="meta">
                      <span className="m-chip"><span className="k">Alt</span>2 082 m</span>
                      <span className="m-chip"><span className="k">Saison</span>Mai–Oct</span>
                      <span className="m-chip"><span className="k">Diff</span>Modérée</span>
                    </div>
                  </div>
                </Link>

                <Link href="/pays/is" className="dest-card">
                  <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=800')` }}></div>
                  <div className="top">
                    <div className="flag-code"><span className="fc">IS</span> Islande</div>
                    <button className="fav" aria-label="Favori">
                      <svg className="lkv-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>
                    </button>
                  </div>
                  <div className="info">
                    <h3>Landmannalaugar<em>.</em></h3>
                    <div className="sub">Hautes terres <span className="sep">·</span> 4 j</div>
                    <div className="meta">
                      <span className="m-chip"><span className="k">Type</span>Trek</span>
                    </div>
                  </div>
                </Link>

                <Link href="/pays/jp" className="dest-card">
                  <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/691637/pexels-photo-691637.jpeg?auto=compress&cs=tinysrgb&w=800')` }}></div>
                  <div className="top">
                    <div className="flag-code"><span className="fc">JP</span> Japon</div>
                    <button className="fav" aria-label="Favori">
                      <svg className="lkv-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>
                    </button>
                  </div>
                  <div className="info">
                    <h3>Kumano<br/><em>Kodō.</em></h3>
                    <div className="sub">Kii · 7 jours</div>
                    <div className="meta">
                      <span className="m-chip"><span className="k">Type</span>Pèlerinage</span>
                    </div>
                  </div>
                </Link>
              </div>

              <div className="dest-grid row-2">
                <Link href="/pays/no" className="dest-card">
                  <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/572897/pexels-photo-572897.jpeg?auto=compress&cs=tinysrgb&w=800')` }}></div>
                  <div className="top">
                    <div className="flag-code"><span className="fc">NO</span> Norvège</div>
                    <button className="fav" aria-label="Favori">
                      <svg className="lkv-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>
                    </button>
                  </div>
                  <div className="info">
                    <h3>Lofoten<em>.</em></h3>
                    <div className="sub">Archipel · 5 j</div>
                    <div className="meta">
                      <span className="m-chip"><span className="k">Type</span>Côtier</span>
                    </div>
                  </div>
                </Link>

                <Link href="/pays/np" className="dest-card">
                  <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/814499/pexels-photo-814499.jpeg?auto=compress&cs=tinysrgb&w=800')` }}></div>
                  <div className="top">
                    <div className="flag-code"><span className="fc">NP</span> Népal</div>
                    <button className="fav" aria-label="Favori">
                      <svg className="lkv-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>
                    </button>
                  </div>
                  <div className="info">
                    <h3>Vallée du<br/><em>Langtang.</em></h3>
                    <div className="sub">Himalaya · 10 j</div>
                    <div className="meta">
                      <span className="m-chip"><span className="k">Alt</span>4 984 m</span>
                    </div>
                  </div>
                </Link>

                <Link href="/pays/cl" className="dest-card wide">
                  <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/2437291/pexels-photo-2437291.jpeg?auto=compress&cs=tinysrgb&w=1200')` }}></div>
                  <div className="top">
                    <div className="flag-code"><span className="fc">CL</span> Chili</div>
                    <button className="fav" aria-label="Favori">
                      <svg className="lkv-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/></svg>
                    </button>
                  </div>
                  <div className="info">
                    <h3>Torres del<br/><em>Paine.</em></h3>
                    <div className="sub">Patagonie <span className="sep">·</span> 8 jours <span className="sep">·</span> circuit W</div>
                    <div className="meta">
                      <span className="m-chip"><span className="k">Alt</span>1 200 m</span>
                      <span className="m-chip"><span className="k">Saison</span>Déc–Fév</span>
                      <span className="m-chip"><span className="k">Diff</span>Soutenue</span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </section>

          {/* LIVE + STATS */}
          <section className="live-section w-full rounded-[0.75rem] mt-8">
            <div className="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Live Feed */}
              <div className="live-panel lg:col-span-5">
                <div className="head">
                  <div className="l"><span className="dot"></span><span>Activité live</span></div>
                  <div className="cnt">14:32 · 8 428 en ligne</div>
                </div>
                <h3>Ce qui se passe<br/><em>en ce moment.</em></h3>
                <div className="live-feed">
                  <div className="live-item">
                    <div className="av" style={{ backgroundImage: `url('https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="txt">
                      <div className="n">Léna a bivouaqué au <em>Grand Som</em></div>
                      <div className="m">FR · Chartreuse · il y a 4 min</div>
                    </div>
                    <div className="code">FR · 45.3N</div>
                  </div>
                  <div className="live-item">
                    <div className="av" style={{ backgroundImage: `url('https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="txt">
                      <div className="n">Antoine a publié un carnet <em>Kumano</em></div>
                      <div className="m">JP · Kii · il y a 12 min</div>
                    </div>
                    <div className="code">JP · 33.8N</div>
                  </div>
                  <div className="live-item">
                    <div className="av" style={{ backgroundImage: `url('https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="txt">
                      <div className="n">Hélène cherche un binôme pour <em>Landmannalaugar</em></div>
                      <div className="m">IS · Août 2026 · il y a 28 min</div>
                    </div>
                    <div className="code">IS · 63.9N</div>
                  </div>
                  <div className="live-item">
                    <div className="av" style={{ backgroundImage: `url('https://images.pexels.com/photos/1043473/pexels-photo-1043473.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="txt">
                      <div className="n">Bertrand a rejoint le club <em>Patagonie 2026</em></div>
                      <div className="m">CL · Torres del Paine · il y a 41 min</div>
                    </div>
                    <div className="code">CL · 50.9S</div>
                  </div>
                  <div className="live-item">
                    <div className="av" style={{ backgroundImage: `url('https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="txt">
                      <div className="n">Marie a validé le refuge <em>Bellefond</em></div>
                      <div className="m">FR · Vercors · il y a 1 h</div>
                    </div>
                    <div className="code">FR · 45.0N</div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="stats-panel lg:col-span-7">
                <div className="stat-card">
                  <div className="lbl">
                    <div className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg></div>
                    Pays cartographiés
                  </div>
                  <div className="n">137<em> / 195</em></div>
                  <div className="desc">70 % du globe. On avance département par département, jamais par claim marketing.<span className="delta">+8 ce mois</span></div>
                </div>

                <div className="stat-card dark">
                  <div className="lbl">
                    <div className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12"><path d="M9 20l-5-5 5-5M4 15h11a5 5 0 000-10H9"/></svg></div>
                    Itinéraires vérifiés
                  </div>
                  <div className="n">2 481</div>
                  <div className="desc">Chaque itinéraire passe par un testeur avant publication. Aucun accord commercial.<span className="delta">+12 % T3</span></div>
                </div>

                <div className="stat-card feat">
                  <div>
                    <div className="lbl">
                      <div className="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12"><path d="M12 22s-8-9-8-14a8 8 0 1116 0c0 5-8 14-8 14z"/><circle cx="12" cy="8" r="3"/></svg></div>
                      Focus région · Été 2026
                    </div>
                    <h4>La Chartreuse<br/>en <em>six semaines.</em></h4>
                    <p className="desc">Trois testeurs, 42 nuits en bivouac, 312 itinéraires notés. Le journal complet arrive en septembre.</p>
                    <Link href="/journal" className="lkv-btn lkv-btn-primary lkv-btn-sm cta">
                      Lire les carnets
                      <svg className="lkv-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </Link>
                  </div>
                  <div className="mini-map">
                    <div className="pin p1"></div>
                    <div className="pin p2"></div>
                    <div className="pin p3"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* METHOD SECTION */}
          <section className="method-section w-full rounded-[0.75rem] mt-8">
            <div className="max-w-[1400px] mx-auto">
              <div className="method-head">
                <div className="lkv-eyebrow">Notre méthode · terrain d'abord</div>
                <h2>On cartographie<br/><em>ce qu'on a marché.</em></h2>
                <p>Pas de scraping. Pas d'IA générative pour peupler la carte. Chaque point vient d'un carnet signé, relu, situé.</p>
              </div>
              <div className="method-grid">
                <div className="method-card">
                  <div className="num">01 · Terrain</div>
                  <h4>Six semaines<br/>de <em>marche.</em></h4>
                  <p>Chaque région est visitée par trois testeurs partenaires. Ils partent avec un carnet vierge et rentrent avec des points GPS, des relevés météo, des noms d'aubergistes.</p>
                </div>
                <div className="method-card">
                  <div className="num">02 · Relecture</div>
                  <h4>Une carte<br/><em>relue</em> à deux voix.</h4>
                  <p>Chaque itinéraire est confié à un second testeur, indépendant du premier. Ce qu'ils voient différemment, on le note. Ce qui casse, on le retire.</p>
                </div>
                <div className="method-card">
                  <div className="num">03 · Publication</div>
                  <h4>Publié quand<br/>on est <em>sûrs.</em></h4>
                  <p>Un pays ne monte sur l'atlas qu'après avoir traversé nos deux filtres. On préfère 137 pays vérifiés à 195 pays approximatifs.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Site Footer */}
      <Footer />
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell background="var(--lkv-forest-950)">
          <div className="m-earth">
            <div className="m-earth-body">
              {/* Hero (Title, Search) */}
              <div className="m-earth-hero">
                <div className="m-eye">
                  <span className="d"></span>137 pays cartographiés
                </div>
                <h1>Le monde,<br/><em>à hauteur de sentier.</em></h1>
                <p>Faites tourner la planète, plongez dans les régions.</p>
                <div className="m-search">
                  <svg className="lkv-icon" viewBox="0 0 24 24" width="14" height="14" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="France, Népal, Chartreuse…"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFocusCode(e.target.value || undefined);
                    }}
                  />
                  <button className="b active:scale-95 transition-transform duration-100" onClick={() => setFocusCode(searchQuery)}>Go</button>
                </div>
              </div>

              {/* Globe */}
              <div className="m-globe-stage w-full h-[360px] mb-8 relative">
                <div className="w-full h-full relative" id="mGlobeViz">
                  {isMobile && (
                    <CountryGlobe
                      countries={ALL_COUNTRIES}
                      onCountryClick={handleCountryClick}
                      focusCode={focusCode}
                      fullscreen={false}
                    />
                  )}
                </div>
                <div className="m-orbit o1"></div>
                <div className="m-orbit o2"></div>
              </div>

              {/* Continent strip */}
              <div className="m-cont-strip">
                <div className={`p ${selectedContinent === "europe" || selectedContinent === "all" ? "on" : ""} active:scale-95 transition-transform duration-100 cursor-pointer`} onClick={() => setSelectedContinent("europe")}>
                  <span className="k">01</span>Europe
                </div>
                <div className={`p ${selectedContinent === "asia" ? "on" : ""} active:scale-95 transition-transform duration-100 cursor-pointer`} onClick={() => setSelectedContinent("asia")}>
                  <span className="k">02</span>Asie
                </div>
                <div className={`p ${selectedContinent === "africa" ? "on" : ""} active:scale-95 transition-transform duration-100 cursor-pointer`} onClick={() => setSelectedContinent("africa")}>
                  <span className="k">03</span>Afrique
                </div>
                <div className={`p ${selectedContinent === "north-america" ? "on" : ""} active:scale-95 transition-transform duration-100 cursor-pointer`} onClick={() => setSelectedContinent("north-america")}>
                  <span className="k">04</span>Am. N.
                </div>
                <div className={`p ${selectedContinent === "south-america" ? "on" : ""} active:scale-95 transition-transform duration-100 cursor-pointer`} onClick={() => setSelectedContinent("south-america")}>
                  <span className="k">05</span>Am. S.
                </div>
                <div className={`p ${selectedContinent === "oceania" ? "on" : ""} active:scale-95 transition-transform duration-100 cursor-pointer`} onClick={() => setSelectedContinent("oceania")}>
                  <span className="k">06</span>Océanie
                </div>
              </div>

              {/* Body Content */}
              <div className="m-body">
                <h3 className="m-sec-title">Six pays qui <em>montent</em></h3>
                <div className="m-dest-grid">
                  <Link href="/pays/fr" className="m-dest active:scale-[0.98] transition-transform duration-100">
                    <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=400')` }}></div>
                    <div className="fc">FR</div>
                    <div className="info">
                      <h5>Chartreuse<em>.</em></h5>
                      <div className="sub">312 itinéraires</div>
                    </div>
                  </Link>

                  <Link href="/pays/is" className="m-dest active:scale-[0.98] transition-transform duration-100">
                    <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/1287145/pexels-photo-1287145.jpeg?auto=compress&cs=tinysrgb&w=400')` }}></div>
                    <div className="fc">IS</div>
                    <div className="info">
                      <h5>Landmanna<em>laugar.</em></h5>
                      <div className="sub">Hautes terres</div>
                    </div>
                  </Link>

                  <Link href="/pays/jp" className="m-dest active:scale-[0.98] transition-transform duration-100">
                    <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/691637/pexels-photo-691637.jpeg?auto=compress&cs=tinysrgb&w=400')` }}></div>
                    <div className="fc">JP</div>
                    <div className="info">
                      <h5>Kumano <em>Kodō.</em></h5>
                      <div className="sub">7 jours</div>
                    </div>
                  </Link>

                  <Link href="/pays/cl" className="m-dest active:scale-[0.98] transition-transform duration-100">
                    <div className="bg" style={{ backgroundImage: `url('https://images.pexels.com/photos/2437291/pexels-photo-2437291.jpeg?auto=compress&cs=tinysrgb&w=400')` }}></div>
                    <div className="fc">CL</div>
                    <div className="info">
                      <h5>Torres del <em>Paine.</em></h5>
                      <div className="sub">Patagonie</div>
                    </div>
                  </Link>
                </div>

                {/* Live Activity Box */}
                <div className="m-live-box bg-white/5 border border-white/10 rounded-2xl p-4 mt-5">
                  <div className="h flex items-center gap-2 mb-3">
                    <span className="d w-1.5 h-1.5 rounded-full bg-[#8BAF7C] shadow-[0_0_8px_#8BAF7C] animate-pulse"></span>
                    <span className="text-[10px] uppercase tracking-widest text-[#A8C4A2] font-semibold">Activité live · 8 428 en ligne</span>
                  </div>
                  <div className="m-live-item flex items-center gap-3 py-2 border-t border-white/5 first:border-t-0">
                    <div className="av w-7 h-7 rounded-full bg-cover bg-center shrink-0 border border-white/10" style={{ backgroundImage: `url('https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="n flex-1 text-xs text-white/85">Léna · bivouac au <em className="font-serif italic text-[#A8C4A2]">Grand Som</em></div>
                    <div className="t font-mono text-[10px] text-white/40">4 m</div>
                  </div>
                  <div className="m-live-item flex items-center gap-3 py-2 border-t border-white/5 first:border-t-0">
                    <div className="av w-7 h-7 rounded-full bg-cover bg-center shrink-0 border border-white/10" style={{ backgroundImage: `url('https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="n flex-1 text-xs text-white/85">Antoine · carnet <em className="font-serif italic text-[#A8C4A2]">Kumano</em></div>
                    <div className="t font-mono text-[10px] text-white/40">12 m</div>
                  </div>
                  <div className="m-live-item flex items-center gap-3 py-2 border-t border-white/5 first:border-t-0">
                    <div className="av w-7 h-7 rounded-full bg-cover bg-center shrink-0 border border-white/10" style={{ backgroundImage: `url('https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=80')` }}></div>
                    <div className="n flex-1 text-xs text-white/85">Hélène · binôme <em className="font-serif italic text-[#A8C4A2]">Islande</em></div>
                    <div className="t font-mono text-[10px] text-white/40">28 m</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </MobilePageShell>
      </div>

    </div>
  );
}
