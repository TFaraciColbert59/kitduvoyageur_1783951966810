"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { getCompleteCountryDetail, CountryDetail } from '@/lib/countryDetails';
import { ALL_COUNTRIES } from '@/lib/countries';
import '../styles/country.css';

// VRAI GLOBE 3D — composant officiel de l'application
const CountryGlobe = dynamic(
  () => import('@/components/pays/CountryGlobe'),
  { ssr: false }
);

import PaysCarnetsList from '@/components/pays/PaysCarnetsList';
import PaysClubsList from '@/components/pays/PaysClubsList';
import BouteilleALaMer from '@/components/pays/BouteilleALaMer';

function getFlagEmoji(code: string): string {
  if (!code) return '🌐';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = React.use(params);
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('presentation');
  const [activeCat, setActiveCat] = useState<'all' | 'nature' | 'aqua' | 'rand' | 'cult'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const country: CountryDetail = useMemo(() => {
    return getCompleteCountryDetail(code);
  }, [code]);

  // Reveal animations on scroll
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));

    return () => io.disconnect();
  }, [country]);

  // Scrollspy for Anchor Bar
  useEffect(() => {
    const sections = ['presentation', 'destinations', 'activites', 'culture', 'gastronomie', 'pratique', 'globe-select'];
    const handleScroll = () => {
      const scrollY = window.scrollY + 220;
      let current = sections[0];
      for (const id of sections) {
        const el = document.getElementById(id) || document.getElementById(`m-${id}`);
        if (el && el.offsetTop <= scrollY) {
          current = id;
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const desktopEl = document.getElementById(id);
    const mobileEl = document.getElementById(`m-${id}`);
    const el = window.innerWidth < 768 ? (mobileEl || desktopEl) : desktopEl;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 70;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  const handleCountryGlobeClick = useCallback((targetCode: string) => {
    if (targetCode && targetCode.toLowerCase() !== country.code.toLowerCase()) {
      router.push(`/pays/${targetCode.toLowerCase()}`);
    }
  }, [country.code, router]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    if (activeCat === 'all') return country.activites;
    return country.activites.filter((a) => a.categorie === activeCat);
  }, [country, activeCat]);

  // Filtered country chips for Explore section
  const exploreChips = useMemo(() => {
    if (!searchQuery.trim()) {
      return [
        { code: 'IS', name: 'Islande', flag: '🇮🇸', sub: 'IS' },
        { code: 'JP', name: 'Japon', flag: '🇯🇵', sub: 'JP' },
        { code: 'FR', name: 'France', flag: '🇫🇷', sub: 'FR' },
        { code: 'NO', name: 'Norvège', flag: '🇳🇴', sub: 'NO' },
        { code: 'PE', name: 'Pérou', flag: '🇵🇪', sub: 'PE' },
        { code: 'CL', name: 'Chili', flag: '🇨🇱', sub: 'CL' },
        { code: 'NZ', name: 'Nouv.-Zélande', flag: '🇳🇿', sub: 'NZ' },
        { code: 'MA', name: 'Maroc', flag: '🇲🇦', sub: 'MA' },
        { code: 'CA', name: 'Canada', flag: '🇨🇦', sub: 'CA' },
        { code: 'GR', name: 'Grèce', flag: '🇬🇷', sub: 'GR' },
      ];
    }
    const q = searchQuery.toLowerCase();
    return ALL_COUNTRIES.filter((c) => c.nom.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 12)
      .map((c) => ({
        code: c.code,
        name: c.nom,
        flag: getFlagEmoji(c.code),
        sub: c.code,
      }));
  }, [searchQuery]);

  const flagEmoji = getFlagEmoji(country.code);

  return (
    <div className="country-page-wrapper">
      {/* ══════════════════════════════════════════════════════════════════════
          1. VERSION DESKTOP (md+)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block">
        {/* Global Site Header */}
        <Header />

        {/* Hero Section */}
        <section className="p-hero pt-20">
          <div className="bg"></div>
          <div className="aurora">
            <span className="a1"></span>
            <span className="a2"></span>
            <span className="a3"></span>
          </div>

          {/* Breadcrumb */}
          <div className="breadcrumb">
            <Link href="/">Aventures</Link>
            <span className="sep">/</span>
            <Link href="/pays">Earth</Link>
            <span className="sep">/</span>
            <span>{country.continent}</span>
            <span className="sep">/</span>
            <span>{country.nom}</span>
          </div>

          {/* Hero Body */}
          <div className="hero-body">
            <div className="hero-left reveal">
              <div className="hero-eye-row">
                <div className="flag-circle">{flagEmoji}</div>
                <span className="lkv-eye on-dark">
                  <span className="dot"></span>
                  {country.region}
                </span>
                <span className="lkv-eye on-dark">
                  Saison recommandée · {country.saison_recommandee}
                </span>
              </div>
              <h1>
                {country.nom}
                <br />
                — <em>{country.slogan}</em>
              </h1>
              <p className="lead">{country.subtitle}</p>
              <div className="cta">
                <Link href={`/ai-configurator?country=${country.code}`} className="lkv-btn lkv-btn-light lkv-btn-lg">
                  Créer mon kit pour {country.nom}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
                <button onClick={() => scrollToSection('presentation')} className="lkv-btn lkv-btn-ghost-light lkv-btn-lg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 3v9l6 3" />
                  </svg>
                  Voir le carnet
                </button>
              </div>
            </div>

            <div className="hero-globe-wrapper reveal">
              <div className="hero-globe-badge-top">
                <span className="hero-globe-pill">
                  {flagEmoji} {country.nom} · {country.continent}
                </span>
                <span className="hero-globe-pill mono">
                  {country.latitude} · {country.longitude}
                </span>
              </div>

              <CountryGlobe
                countries={ALL_COUNTRIES}
                onCountryClick={handleCountryGlobeClick}
                focusCode={country.code}
                fullscreen={false}
              />

              <div className="hero-globe-badge-bot">
                <span className="hero-globe-pill mono">
                  {country.capitale} · {country.fuseau}
                </span>
                <span className="hero-globe-pill">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#A8C4A2] animate-pulse"></span>
                  3D Interactif
                </span>
              </div>
            </div>
          </div>

          {/* Stats Strip */}
          <div className="stats-strip reveal">
            <div className="s">
              <div className="l">Superficie</div>
              <div className="n">{country.superficie_court}<em>km²</em></div>
              <div className="u">{country.superficie_detail}</div>
            </div>
            <div className="s">
              <div className="l">Population</div>
              <div className="n">{country.population_court}</div>
              <div className="u">{country.population_detail}</div>
            </div>
            <div className="s">
              <div className="l">Capitale</div>
              <div className="n">{country.capitale}</div>
              <div className="u">{country.capitale_pop}</div>
            </div>
            <div className="s">
              <div className="l">Langue</div>
              <div className="n">{country.langue}</div>
              <div className="u">{country.langue_sub}</div>
            </div>
            <div className="s">
              <div className="l">Monnaie</div>
              <div className="n">{country.monnaie_code} <em>{country.monnaie_nom}</em></div>
              <div className="u">{country.taux_change}</div>
            </div>
          </div>
        </section>

        {/* Sticky Anchor Navigation */}
        <div className="anchor-bar">
          <nav className="anchor-nav">
            <a onClick={() => scrollToSection('presentation')} className={activeSection === 'presentation' ? 'on' : ''}><span className="n">01</span>Présentation</a>
            <a onClick={() => scrollToSection('destinations')} className={activeSection === 'destinations' ? 'on' : ''}><span className="n">02</span>Destinations</a>
            <a onClick={() => scrollToSection('activites')} className={activeSection === 'activites' ? 'on' : ''}><span className="n">03</span>Activités</a>
            <a onClick={() => scrollToSection('culture')} className={activeSection === 'culture' ? 'on' : ''}><span className="n">04</span>Culture</a>
            <a onClick={() => scrollToSection('gastronomie')} className={activeSection === 'gastronomie' ? 'on' : ''}><span className="n">05</span>Gastronomie</a>
            <a onClick={() => scrollToSection('pratique')} className={activeSection === 'pratique' ? 'on' : ''}><span className="n">06</span>Pratique</a>
            <a onClick={() => scrollToSection('globe-select')} className={activeSection === 'globe-select' ? 'on' : ''}><span className="n">07</span>Globe 3D</a>
          </nav>
          <div className="anchor-actions">
            <span>Dernière mise à jour · <strong style={{ color: 'var(--lkv-ink-900)', fontWeight: 500 }}>Août 2026</strong></span>
            <button className="lkv-btn lkv-btn-ghost lkv-btn-sm" onClick={() => window.print()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Guide PDF
            </button>
          </div>
        </div>

        {/* Section 01 : Présentation */}
        <section id="presentation" className="section">
          <div className="section-head">
            <div>
              <span className="kicker"><span className="dot"></span>Présentation</span>
              <h2>{country.presentation_titre}</h2>
            </div>
            <div className="side">{country.presentation_lead}</div>
          </div>

          <div className="pres-grid">
            <div className="pres-copy reveal">
              {country.presentation_paragraphes.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <div className="quote">
                {country.citation_texte}
                <cite>{country.citation_auteur}</cite>
              </div>
            </div>

            <div className="pres-map reveal" aria-hidden="true">
              <svg viewBox="0 0 400 400">
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(11,31,23,0.05)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="400" height="400" fill="url(#grid)" />
                <path
                  d="M80 200 C 80 160, 120 130, 170 130 C 210 128, 240 140, 260 138 C 290 135, 320 155, 335 190 C 342 210, 335 235, 315 250 C 300 262, 280 265, 255 258 C 235 253, 218 265, 200 268 C 175 272, 150 265, 130 250 C 105 232, 80 225, 80 200 Z"
                  fill="rgba(31,74,58,0.12)"
                  stroke="var(--lkv-forest-800)"
                  strokeWidth="1.6"
                />
                <path d="M85 195 L100 210 M110 175 L125 190 M330 195 L315 210" stroke="var(--lkv-forest-800)" strokeWidth="1.2" opacity="0.5" />
                <text x="10" y="20" fontFamily="ui-monospace,monospace" fontSize="9" fill="#8E9A91">{country.latitude}</text>
                <text x="340" y="395" fontFamily="ui-monospace,monospace" fontSize="9" fill="#8E9A91">{country.longitude}</text>
              </svg>
              {country.points_interet_carte.map((pt, idx) => (
                <div
                  key={idx}
                  className={`pin ${pt.isCapital ? 'capital' : ''}`}
                  data-l={pt.nom}
                  style={{ top: pt.top, left: pt.left }}
                ></div>
              ))}
              <div className="cap">
                <div><div className="k">Repère</div><div className="v">{country.carte_repere}</div></div>
                <div style={{ textAlign: 'right' }}><div className="k">Échelle</div><div className="v">{country.carte_echelle}</div></div>
              </div>
            </div>
          </div>

          <div className="high-row">
            {country.highlights.map((h, i) => (
              <div className="high-card reveal" key={i}>
                <div className="ic">
                  {h.icon === 'calendar' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3M16 3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /></svg>
                  ) : h.icon === 'plane' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6M4.93 10.93l4.24 4.24M2 18h6M4.93 25.07l4.24-4.24" /><circle cx="12" cy="12" r="4" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-8-4.5-8-11a8 8 0 0 1 16 0c0 6.5-8 11-8 11z" /><circle cx="12" cy="11" r="3" /></svg>
                  )}
                </div>
                <h4>{h.titre} <em>{h.sous_titre}</em></h4>
                <p>{h.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 02 : Destinations (Bento Grid) */}
        <section id="destinations" className="section">
          <div className="section-head">
            <div>
              <span className="kicker"><span className="dot"></span>Destinations</span>
              <h2>Les sites majeurs, un <em>tour complet</em>.</h2>
            </div>
            <div className="side">
              Sélection éditoriale du Kit. Chaque destination est associée à un carnet de terrain, une carte offline et les guides partenaires.
              <a onClick={() => scrollToSection('globe-select')} className="see-all cursor-pointer">
                Explorer sur le Globe 3D
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </a>
            </div>
          </div>

          <div className="dest-grid">
            {country.destinations.map((d, i) => (
              <div key={i} className={`dest-card ${d.isBig ? 'big' : ''} reveal`} onClick={() => scrollToSection('activites')}>
                <div className="im" style={{ backgroundImage: `url('${d.image_url}')` }}></div>
                <div className="body">
                  <div className="t">
                    <div className="cat"><span className="dot"></span>{d.categorie}</div>
                    <h3>{d.titre} {d.titre_em ? <em>{d.titre_em}</em> : ''}</h3>
                    <div className="meta">
                      <span>{d.meta_1}</span><span className="sep">·</span>
                      <span>{d.meta_2}</span><span className="sep">·</span>
                      <span>{d.meta_3}</span>
                    </div>
                  </div>
                  <div className="arr">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 17L17 7M7 7h10v10" /></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 03 : Activités */}
        <section id="activites" className="section">
          <div className="section-head">
            <div>
              <span className="kicker"><span className="dot"></span>Activités</span>
              <h2>Ce qu’on <em>vient chercher</em> ici.</h2>
            </div>
            <div className="side">
              Activités classées par saison, difficulté et durée. Guides certifiés et matériel pré-configuré dans la boutique.
            </div>
          </div>

          <div className="act-cats" role="tablist">
            <button className={activeCat === 'all' ? 'on' : ''} onClick={() => setActiveCat('all')}>
              Toutes <span className="n">{country.activites.length}</span>
            </button>
            <button className={activeCat === 'nature' ? 'on' : ''} onClick={() => setActiveCat('nature')}>
              Nature <span className="n">{country.activites.filter(a => a.categorie === 'nature').length}</span>
            </button>
            <button className={activeCat === 'aqua' ? 'on' : ''} onClick={() => setActiveCat('aqua')}>
              Eau &amp; bains <span className="n">{country.activites.filter(a => a.categorie === 'aqua').length}</span>
            </button>
            <button className={activeCat === 'rand' ? 'on' : ''} onClick={() => setActiveCat('rand')}>
              Randonnée <span className="n">{country.activites.filter(a => a.categorie === 'rand').length}</span>
            </button>
            <button className={activeCat === 'cult' ? 'on' : ''} onClick={() => setActiveCat('cult')}>
              Culture <span className="n">{country.activites.filter(a => a.categorie === 'cult').length}</span>
            </button>
          </div>

          <div className="act-grid">
            {filteredActivities.map((act, i) => (
              <article key={i} className="act-card reveal">
                <div className="cover" style={{ backgroundImage: `url('${act.image_url}')` }}>
                  <span className={`diff ${act.difficulte_type === 'hard' ? 'hard' : act.difficulte_type === 'med' ? 'med' : ''}`}>
                    {act.difficulte}
                  </span>
                  <span className="season">{act.saison}</span>
                </div>
                <div className="b">
                  <div className="cat">{act.tag}</div>
                  <h3>{act.titre} <em>{act.titre_em}</em></h3>
                  <p>{act.description}</p>
                  <div className="meta">
                    <span className="m">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <strong>{act.duree}</strong>
                    </span>
                    <span className="m">à partir de <strong>{act.prix}</strong></span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Section 04 : Culture */}
        <section id="culture" className="section">
          <div className="section-head">
            <div>
              <span className="kicker"><span className="dot"></span>Culture</span>
              <h2>Une <em>identité unique</em> à l’imaginaire immense.</h2>
            </div>
            <div className="side">
              Traditions séculaires, hospitalité sincère et récits transmis au fil des générations.
            </div>
          </div>

          <div className="cult-grid">
            <div className="cult-quote reveal">
              <div className="txt">{country.culture.citation}</div>
              <div className="att">{country.culture.citation_auteur}</div>
            </div>

            <div className="cult-facts reveal">
              {country.culture.faits.map((f, i) => (
                <div className="cult-fact" key={i}>
                  <div className="k">{f.cle}</div>
                  <div className="v">{f.valeur} <em>{f.valeur_em}</em></div>
                  <div className="d">{f.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="cult-cal reveal">
            <h4>Calendrier <em>des fêtes</em> et grands rendez-vous</h4>
            <div className="cal-months">
              {country.culture.fetes.map((m, i) => (
                <div key={i} className={`cal-month ${m.nom ? `event ${m.isWarm ? 'warm' : ''}` : ''}`}>
                  {m.mois}
                  {m.nom && <span className="lbl">{m.nom}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 05 : Gastronomie */}
        <section id="gastronomie" className="section">
          <div className="section-head">
            <div>
              <span className="kicker"><span className="dot"></span>Gastronomie</span>
              <h2>Une cuisine du <em>terroir</em> et du partage.</h2>
            </div>
            <div className="side">
              Plats emblématiques, spécialités réconfortantes et savoir-faire culinaire à goûter absolument.
            </div>
          </div>

          <div className="gast-grid">
            {country.gastronomie.map((g, i) => (
              <div className="gast-card reveal" key={i}>
                <div className="im" style={{ backgroundImage: `url('${g.image_url}')` }}>
                  <span className="num">{g.numero}</span>
                </div>
                <div className="b">
                  <div className="cat">{g.categorie}</div>
                  <h3>{g.nom} <em>{g.nom_em}</em></h3>
                  <p>{g.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 06 : Infos Pratiques (Météo + Sécurité) */}
        <section id="pratique" className="section">
          <div className="section-head">
            <div>
              <span className="kicker"><span className="dot"></span>Pratique</span>
              <h2>Ce qu’il faut <em>savoir avant</em> de partir.</h2>
            </div>
            <div className="side">
              Formalités, transport, climat mois par mois, sécurité et budget de terrain.
            </div>
          </div>

          <div className="prat-grid">
            <div className="prat-main">
              <div className="prat-card reveal">
                <div className="h">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></svg>
                  </div>
                  <div className="t">Formalités</div>
                </div>
                {country.pratique.formalites.map((r, i) => (
                  <div className="row" key={i}>
                    <span className="k">{r.cle}</span>
                    <span className={`v ${r.isMono ? 'mono' : ''}`}>{r.val}</span>
                  </div>
                ))}
              </div>

              <div className="prat-card reveal">
                <div className="h">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0z" /><path d="M3 17V7a2 2 0 0 1 2-2h10l4 5v7" /></svg>
                  </div>
                  <div className="t">Transport</div>
                </div>
                {country.pratique.transport.map((r, i) => (
                  <div className="row" key={i}>
                    <span className="k">{r.cle}</span>
                    <span className={`v ${r.isMono ? 'mono' : ''}`}>{r.val}</span>
                  </div>
                ))}
              </div>

              <div className="prat-card reveal">
                <div className="h">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v20M18 6l-6-4-6 4v12l6 4 6-4V6z" /></svg>
                  </div>
                  <div className="t">Budget</div>
                </div>
                {country.pratique.budget.map((r, i) => (
                  <div className="row" key={i}>
                    <span className="k">{r.cle}</span>
                    <span className={`v ${r.isMono ? 'mono' : ''}`}>{r.val}</span>
                  </div>
                ))}
              </div>

              <div className="prat-card reveal">
                <div className="h">
                  <div className="ic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2 4 7v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-5z" /></svg>
                  </div>
                  <div className="t">Santé</div>
                </div>
                {country.pratique.sante.map((r, i) => (
                  <div className="row" key={i}>
                    <span className="k">{r.cle}</span>
                    <span className={`v ${r.isMono ? 'mono' : ''}`}>{r.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Weather & Safety Cards */}
            <div>
              <div className="weather-card reveal">
                <div className="h">
                  <div className="k">Météo · {country.meteo.ville}</div>
                  <div className="live"><span className="dot"></span>En direct</div>
                </div>
                <div className="now">
                  <div className="t">{country.meteo.temperature_actuelle}<em>°C</em></div>
                  <svg className="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.5 19a4.5 4.5 0 1 0 0-9c-.05 0-.1 0-.14.01A6 6 0 0 0 6 12" />
                    <path d="M6 12a4 4 0 1 0 0 8h11.5" />
                    <path d="M12 5v-2M18 6l1.5-1.5M6 6l-1.5-1.5" />
                  </svg>
                </div>
                <div className="cond">
                  <span>{country.meteo.conditions}</span> — {country.meteo.details}
                </div>
                <div className="weather-year">
                  {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => {
                    const val = country.meteo.mois_temperatures[i] || 25;
                    const isCurrent = i === new Date().getMonth();
                    return (
                      <div key={i} className={`m ${isCurrent ? 'now-m' : ''}`}>
                        <span className="bar" style={{ height: `${val}px` }}></span>
                        {m}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="safe-card reveal">
                <div className="h">
                  <div className="t">Sécurité · conseils</div>
                  <span className={`level ${country.securite.niveau_score <= 2 ? 'high' : country.securite.niveau_score <= 3 ? 'med' : ''}`}>
                    <span className="dot"></span>{country.securite.niveau_label}
                  </span>
                </div>
                <div className="scale" aria-label={`Niveau de sécurité ${country.securite.niveau_score}/5`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className={`b ${s <= country.securite.niveau_score ? 'on' : ''}`}></div>
                  ))}
                </div>
                <ul>
                  {country.securite.conseils.map((c, i) => (
                    <li key={i}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M12 2 4 7v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-5z" />
                      </svg>
                      <div><strong>{c.titre}</strong> {c.description}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 06-B : Communauté (Groupes, Carnets, Clubs) */}
        <section id="communaute" className="section" style={{ background: 'var(--lkv-paper, #FBFAF6)' }}>
          <div className="section-head" style={{ marginBottom: '0' }}>
            <div>
              <span className="kicker"><span className="dot"></span>Communauté</span>
              <h2>Rejoignez l'<em>aventure</em>.</h2>
            </div>
          </div>
          
          <BouteilleALaMer countryIso={country.code} countryName={country.nom} />
          <PaysClubsList countryIso={country.code} countryName={country.nom} />
          <PaysCarnetsList countryIso={country.code} countryName={country.nom} />
        </section>

        {/* Section 07 : VRAI GLOBE 3D INTERACTIF & RECHERCHE */}
        <section id="globe-select">
          <div className="section-head">
            <div>
              <span className="kicker"><span className="dot"></span>Explorer</span>
              <h2>Le globe terrestre en <em>3D interactif</em>.</h2>
            </div>
            <div className="side">
              Faites tourner la planète au doigt ou à la souris, cliquez sur un pays pour ouvrir sa fiche destination complète.
            </div>
          </div>

          <div className="globe-wrap">
            {/* VRAI GLOBE 3D INTEGRÉ */}
            <div className="globe-3d-stage reveal">
              <CountryGlobe
                countries={ALL_COUNTRIES}
                onCountryClick={handleCountryGlobeClick}
                focusCode={country.code}
                fullscreen={false}
              />
            </div>

            <div className="globe-list">
              <h3>Naviguer vers une <em>autre destination</em>.</h3>
              <p>137 pays cartographiés par nos guides et notre communauté outdoor. Cliquez sur le globe ou filtrez ci-dessous :</p>
              <div className="globe-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3-3" />
                </svg>
                <input
                  type="text"
                  placeholder="Chercher un pays, un continent, un massif…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <span className="k">⌘K</span>
              </div>
              <div className="globe-chips">
                {exploreChips.map((c) => (
                  <Link
                    key={c.code}
                    href={`/pays/${c.code.toLowerCase()}`}
                    className={`globe-chip ${c.code.toUpperCase() === country.code.toUpperCase() ? 'on' : ''}`}
                  >
                    <span className="flag">{c.flag}</span>
                    {c.name}
                    <span className="k">{c.sub}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Global Site Footer */}
        <Footer />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. VERSION MOBILE NATIVE (sm & md:hidden)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="block md:hidden">
        <MobilePageShell background="#0B1F17">
          <div className="m-country-shell">
            {/* Mobile Sticky Topbar */}
            <div className="m-country-topbar">
              <Link href="/pays" className="back-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                Atlas Earth
              </Link>
              <div className="actions">
                <button className="icon-btn" onClick={() => router.push(`/ai-configurator?country=${country.code}`)} title="Créer un kit">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2 4 7v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-5z"/><path d="M9 12l2 2 4-4"/></svg>
                </button>
              </div>
            </div>

            {/* Mobile Hero */}
            <div className="m-country-hero">
              <div className="aurora"><span className="a1"></span><span className="a2"></span></div>
              <div className="flag-tag">{flagEmoji} {country.continent} · {country.saison_recommandee}</div>
              <h1>{country.nom}<br/>— <em>{country.slogan}</em></h1>
              <p>{country.subtitle}</p>
            </div>

            {/* Mobile Quick Stats */}
            <div className="m-stats-card">
              <div className="s">
                <div className="k">Superficie</div>
                <div className="v">{country.superficie_court}<em> km²</em></div>
              </div>
              <div className="s">
                <div className="k">Capitale</div>
                <div className="v">{country.capitale}</div>
              </div>
              <div className="s">
                <div className="k">Monnaie</div>
                <div className="v">{country.monnaie_code}</div>
              </div>
            </div>

            {/* Mobile Sticky Tab Strip */}
            <div className="m-tabs-nav">
              <button className={activeSection === 'presentation' ? 'on' : ''} onClick={() => scrollToSection('presentation')}>Présentation</button>
              <button className={activeSection === 'destinations' ? 'on' : ''} onClick={() => scrollToSection('destinations')}>Destinations</button>
              <button className={activeSection === 'activites' ? 'on' : ''} onClick={() => scrollToSection('activites')}>Activités</button>
              <button className={activeSection === 'culture' ? 'on' : ''} onClick={() => scrollToSection('culture')}>Culture</button>
              <button className={activeSection === 'pratique' ? 'on' : ''} onClick={() => scrollToSection('pratique')}>Pratique &amp; Météo</button>
            </div>

            {/* Mobile Section : Présentation */}
            <div id="m-presentation" className="m-section-block">
              <div className="m-kicker">01 · Présentation</div>
              <h2>{country.presentation_titre}</h2>
              <p>{country.presentation_paragraphes[0]}</p>
              <p>{country.presentation_paragraphes[1] || ''}</p>
            </div>

            {/* Mobile Section : Destinations (Horizontal Snap Scroll) */}
            <div id="m-destinations" className="m-section-block" style={{ paddingBottom: '6px' }}>
              <div className="m-kicker">02 · Destinations incontournables</div>
              <h2>À ne pas <em>manquer</em></h2>
            </div>
            <div className="m-dest-scroll">
              {country.destinations.map((d, i) => (
                <div key={i} className="m-dest-card">
                  <div className="im" style={{ backgroundImage: `url('${d.image_url}')` }}></div>
                  <div className="b">
                    <div className="cat">{d.categorie}</div>
                    <h4>{d.titre} {d.titre_em ? <em>{d.titre_em}</em> : ''}</h4>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Section : Activités */}
            <div id="m-activites" className="m-section-block">
              <div className="m-kicker">03 · Activités de terrain</div>
              <h2>Expériences <em>phares</em></h2>
              <div className="flex flex-col gap-3 mt-3">
                {country.activites.slice(0, 4).map((act, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-white/5 border border-white/10 flex gap-3 items-center">
                    <div className="w-16 h-16 rounded-xl bg-cover bg-center shrink-0" style={{ backgroundImage: `url('${act.image_url}')` }}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-[#A8C4A2] font-semibold uppercase">{act.tag}</div>
                      <div className="text-sm font-semibold text-white truncate">{act.titre} {act.titre_em}</div>
                      <div className="text-xs text-white/60 mt-0.5">{act.duree} · dès {act.prix}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Section : Infos Pratiques & Météo */}
            <div id="m-pratique" className="m-section-block">
              <div className="m-kicker">04 · Infos Pratiques</div>
              <h2>Météo &amp; <em>Sécurité</em></h2>
            </div>
            <div className="m-prat-grid">
              <div className="m-prat-card">
                <div className="k">Météo · {country.meteo.ville}</div>
                <div className="v">{country.meteo.temperature_actuelle}<em>°C</em></div>
              </div>
              <div className="m-prat-card">
                <div className="k">Sécurité</div>
                <div className="v">{country.securite.niveau_label}</div>
              </div>
              <div className="m-prat-card">
                <div className="k">Formalités</div>
                <div className="v">{country.pratique.formalites[0]?.val || 'Requis'}</div>
              </div>
              <div className="m-prat-card">
                <div className="k">Urgences</div>
                <div className="v" style={{ fontFamily: 'monospace' }}>112</div>
              </div>
            </div>

            {/* Mobile Section : Communauté (Groupes, Carnets, Clubs) */}
            <div id="m-communaute" className="m-section-block m-community-block">
              <div className="m-kicker">05 · Communauté</div>
              <h2>Rejoignez l'<em>aventure</em>.</h2>
              <BouteilleALaMer countryIso={country.code} countryName={country.nom} />
              <PaysClubsList countryIso={country.code} countryName={country.nom} />
              <PaysCarnetsList countryIso={country.code} countryName={country.nom} />
            </div>

            {/* Mobile Action CTA Banner */}
            <div className="m-cta-banner">
              <h4>Composer votre <em>aventure {country.nom}</em></h4>
              <p>Kit recommandé, check-list matériel et itinéraires pré-remplis.</p>
              <Link href="/ai-configurator">
                Lancer le configurateur →
              </Link>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </div>
  );
}
