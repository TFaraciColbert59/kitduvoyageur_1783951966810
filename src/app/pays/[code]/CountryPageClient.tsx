'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import type { CountryDataV2 } from '@/types/country';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getFlagEmoji(code: string): string {
  if (!code) return '🌐';
  const codePoints = code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const niveauSecurite = {
  sur: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Très sûr', icon: '🛡️', score: 5 },
  vigilance: { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', label: 'Vigilance renforcée', icon: '⚠️', score: 3 },
  deconseille_sauf_raison_imperative: { color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', label: 'Déconseillé sauf raison impérative', icon: '🔶', score: 2 },
  formellement_deconseille: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'Formellement déconseillé', icon: '🚫', score: 1 },
};

const niveauMeteo = {
  ideal: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Idéal' },
  bon: { dot: 'bg-teal-400', text: 'text-teal-400', bg: 'bg-teal-400/10 border-teal-400/20', label: 'Bon' },
  moyen: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', label: 'Moyen' },
  deconseille: { dot: 'bg-rose-400', text: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'Déconseillé' },
};

const affluenceStyle = {
  faible: 'text-emerald-400 bg-emerald-500/10',
  moyenne: 'text-amber-400 bg-amber-400/10',
  forte: 'text-rose-400 bg-rose-500/10',
};

function formatPrice(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} €`;
}

// Image placeholders per country category
const DEST_IMAGES: Record<string, string[]> = {
  default: [
    'https://images.unsplash.com/photo-1504893524553-b855bce32c67?q=80&w=1200&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop'
  ]
};

// ─── ANCHOR NAVIGATION TABS ───────────────────────────────────────────────

type SectionId = 'presentation' | 'destinations' | 'activites' | 'culture' | 'gastronomie' | 'pratique' | 'meteo-securite' | 'faq';

const ANCHORS: { id: SectionId; num: string; label: string }[] = [
  { id: 'presentation', num: '01', label: 'Présentation' },
  { id: 'destinations', num: '02', label: 'Destinations' },
  { id: 'activites', num: '03', label: 'Activités' },
  { id: 'culture', num: '04', label: 'Culture' },
  { id: 'gastronomie', num: '05', label: 'Gastronomie' },
  { id: 'pratique', num: '06', label: 'Pratique' },
  { id: 'meteo-securite', num: '07', label: 'Météo & Sécurité' },
  { id: 'faq', num: '08', label: 'FAQ' },
];

// ─── CARD COMPONENT ───────────────────────────────────────────────────────

function Card({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8E4DA',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(28,38,32,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────

export default function CountryPageClient({ code: rawCode }: { code: string }) {
  const code = rawCode.toLowerCase();
  const [country, setCountry] = useState<CountryDataV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('presentation');
  const [activeActivityCat, setActiveActivityCat] = useState<string>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Fetch Country Data
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pays/${code}?v=2`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        const data = json.data;
        if (!data || !data.pays || !data.meteo || !Array.isArray(data.meteo?.calendrier_12_mois)) {
          throw new Error('Format de données invalide.');
        }
        setCountry(data as CountryDataV2);
      })
      .catch(() => {
        setError('Impossible de charger les données pour ce pays. Veuillez réessayer.');
      })
      .finally(() => setLoading(false));
  }, [code]);

  // Handle smooth scroll & active section observer
  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -80;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const bestMonths = Array.isArray(country?.meteo?.calendrier_12_mois)
    ? country!.meteo.calendrier_12_mois.filter((m) => m.niveau === 'ideal' || m.niveau === 'bon')
    : [];

  const worstSecZone = country?.securite?.zones && country.securite.zones.length > 0
    ? country.securite.zones.reduce((worst, z) => {
        const order = ['sur', 'vigilance', 'deconseille_sauf_raison_imperative', 'formellement_deconseille'];
        return order.indexOf(z.niveau) > order.indexOf(worst.niveau) ? z : worst;
      }, country.securite.zones[0])
    : undefined;

  const secMeta = worstSecZone ? (niveauSecurite[worstSecZone.niveau] || niveauSecurite.sur) : niveauSecurite.sur;

  // ── ERROR STATE FULLSCREEN ──
  if (!loading && error) {
    return (
      <>
        <div className="hidden md:block">
          <div className="min-h-screen bg-[#0B1F17] text-[#FBFAF6]">
            <Header />
            <main className="pt-28 max-w-4xl mx-auto px-6 py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6 text-3xl">
                ⚠️
              </div>
              <h1 className="text-3xl font-bold mb-3 font-sans">Destination non disponible</h1>
              <p className="text-[#A3C4A3] mb-8 max-w-md mx-auto">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3.5 bg-[#17402C] hover:bg-[#2D6B4A] text-[#FBFAF6] rounded-full font-semibold transition-all shadow-lg"
              >
                Réessayer
              </button>
            </main>
            <Footer />
          </div>
        </div>
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '80px 20px', textAlign: 'center', background: '#0B1F17', color: '#FBFAF6', minHeight: '100vh' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</p>
              <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Destination indisponible</h1>
              <p style={{ fontSize: '14px', color: '#A3C4A3', marginBottom: '24px' }}>{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ padding: '12px 28px', background: '#17402C', color: '#FBFAF6', borderRadius: '999px', fontSize: '14px', fontWeight: 700, border: 'none' }}
              >
                Réessayer
              </button>
            </div>
          </MobilePageShell>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ── DESKTOP VIEW ──                                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="hidden md:block bg-[#FBFAF6] text-[#0B1F17]">
        <Header />

        <main className="min-h-screen pt-20">
          {/* ── HERO SECTION ── */}
          <section className="relative min-h-[720px] bg-gradient-to-b from-[#0F2A20] via-[#0B1F17] to-[#08150F] text-[#FBFAF6] overflow-hidden">
            {/* Aurora Ambient Animation */}
            <div className="absolute inset-0 pointer-events-none opacity-40 blur-3xl">
              <div className="absolute -top-10 -left-10 w-2/3 h-1/2 bg-[#7FA97A]/30 rounded-full animate-pulse" />
              <div className="absolute top-1/4 -right-10 w-1/2 h-2/3 bg-[#A8C4A2]/20 rounded-full animate-pulse delay-1000" />
              <div className="absolute bottom-0 left-1/3 w-1/2 h-1/2 bg-[#1B4332]/60 rounded-full" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-8 pt-8 pb-16">
              {/* Breadcrumb */}
              <nav aria-label="Fil d'Ariane" className="mb-8">
                <ol className="flex items-center gap-2 text-xs text-[#A8C4A2]/70 font-mono">
                  <li><Link href="/" className="hover:text-white transition-colors">Accueil</Link></li>
                  <li>/</li>
                  <li><Link href="/pays" className="hover:text-white transition-colors">Aventures</Link></li>
                  <li>/</li>
                  <li><span className="text-white/50">{country?.pays?.continent || 'Destination'}</span></li>
                  <li>/</li>
                  <li className="text-[#A8C4A2] font-semibold">{country?.pays?.nom || code.toUpperCase()}</li>
                </ol>
              </nav>

              {/* Hero Body Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end pt-4">
                {/* Left Column: Title & Description */}
                <div className="lg:col-span-8">
                  {/* Eye Row Pills */}
                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-2xl shadow-inner">
                      {getFlagEmoji(code)}
                    </div>
                    <span className="px-3.5 py-1.5 rounded-full bg-[#17402C]/80 border border-[#A8C4A2]/30 text-xs font-mono tracking-wider uppercase text-[#A8C4A2] backdrop-blur-sm">
                      {country?.pays?.continent || 'Destination'}
                    </span>
                    {bestMonths.length > 0 && (
                      <span className="px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/90 backdrop-blur-sm">
                        Saison conseillée · {bestMonths[0]?.mois?.slice(0, 3)} → {bestMonths[bestMonths.length - 1]?.mois?.slice(0, 3)}
                      </span>
                    )}
                  </div>

                  {/* Main Title */}
                  <h1 className="text-6xl lg:text-7xl font-sans font-medium tracking-tight text-white leading-[0.95] mb-6">
                    {country?.pays?.nom || code.toUpperCase()}
                    <br />
                    <span className="text-4xl lg:text-5xl font-serif italic font-normal text-[#A8C4A2] ml-2">
                      — terre d&apos;exploration
                    </span>
                  </h1>

                  {/* Lead Text */}
                  <p className="font-serif text-xl lg:text-2xl text-white/85 leading-relaxed max-w-2xl mb-8">
                    {country?.coutumes
                      ? `${country.coutumes.slice(0, 160)}...`
                      : `Découvrez la nature sauvage, la culture séculaire et les plus beaux itinéraires de randonnée en ${country?.pays?.nom || 'cette destination'}.`}
                  </p>

                  {/* Hero CTAs */}
                  <div className="flex flex-wrap gap-4">
                    <Link
                      href="/ai-configurator"
                      className="px-7 py-3.5 bg-[#FBFAF6] hover:bg-white text-[#0B1F17] rounded-full font-semibold transition-all flex items-center gap-2 shadow-xl hover:translate-y-[-2px]"
                    >
                      <span>Composer mon kit IA</span>
                      <Icon name="SparklesIcon" size={16} variant="outline" className="text-[#17402C]" />
                    </Link>
                    <button
                      onClick={() => scrollToSection('destinations')}
                      className="px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full font-semibold transition-all backdrop-blur-md flex items-center gap-2"
                    >
                      <span>Explorer les lieux</span>
                      <Icon name="ArrowRightIcon" size={16} variant="outline" />
                    </button>
                  </div>
                </div>

                {/* Right Column: Key Details Card & Mini Map */}
                <div className="lg:col-span-4">
                  <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-6 text-white shadow-2xl">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/15">
                      <div>
                        <p className="text-[10px] font-mono tracking-widest text-white/60 uppercase">Fiche Destination</p>
                        <h2 className="text-xl font-semibold text-white mt-0.5">{country?.pays?.nom}</h2>
                      </div>
                      <span className="text-3xl">{getFlagEmoji(code)}</span>
                    </div>

                    <div className="space-y-3 font-mono text-xs text-white/80">
                      <div className="flex justify-between py-1 border-b border-white/10 border-dashed">
                        <span className="text-white/50">Capitale</span>
                        <span className="text-white font-medium">{country?.securite?.ambassade_consulat?.nom ? 'Capitale officielle' : 'Capitale'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/10 border-dashed">
                        <span className="text-white/50">Monnaie</span>
                        <span className="text-white font-medium">{country?.pratique?.monnaie || '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/10 border-dashed">
                        <span className="text-white/50">Fuseau</span>
                        <span className="text-white font-medium">{country?.pratique?.decalage_horaire_utc || 'UTC'}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-white/50">Visa (EU)</span>
                        <span className="text-emerald-400 font-medium">{country?.pratique?.visa?.duree_sejour_sans_visa || 'Non requis'}</span>
                      </div>
                    </div>

                    {/* Styled Mini Map Container */}
                    <div className="mt-5 h-28 rounded-2xl bg-gradient-to-br from-[#17402C]/60 to-[#0B1F17] border border-white/15 relative overflow-hidden flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 200 100" fill="none">
                        <path d="M20 50 Q50 20 100 45 T180 50 T200 80" stroke="#A8C4A2" strokeWidth="1" strokeDasharray="3 3" />
                        <circle cx="100" cy="45" r="4" fill="#A8C4A2" />
                      </svg>
                      <div className="relative z-10 text-center">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 mx-auto mb-1 animate-ping" />
                        <span className="text-[11px] font-mono text-[#A8C4A2] bg-[#0B1F17]/80 px-2.5 py-1 rounded-full border border-[#A8C4A2]/30">
                          {country?.pays?.nom} GPS Connected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Strip */}
              <div className="mt-12 grid grid-cols-2 md:grid-cols-5 gap-4 bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl p-5 text-white shadow-xl">
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-white/60 uppercase mb-1">Meilleure période</p>
                  <p className="text-xl font-semibold text-[#A8C4A2]">
                    {bestMonths.length > 0 ? `${bestMonths[0]?.mois?.slice(0, 3)} – ${bestMonths[bestMonths.length - 1]?.mois?.slice(0, 3)}` : 'Toute l\'année'}
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">Climat favorable</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-white/60 uppercase mb-1">Sécurité</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{secMeta.icon}</span>
                    <p className={`text-lg font-semibold ${secMeta.color}`}>{secMeta.label}</p>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5">Statut officiel</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-white/60 uppercase mb-1">Budget / jour</p>
                  <p className="text-xl font-semibold text-white">
                    {country?.pratique?.budget_quotidien_repere_eur?.moyen
                      ? formatPrice(country.pratique.budget_quotidien_repere_eur.moyen.logement + country.pratique.budget_quotidien_repere_eur.moyen.nourriture + country.pratique.budget_quotidien_repere_eur.moyen.transport)
                      : '80 - 150 €'}
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">Moyenne repère</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-white/60 uppercase mb-1">Empreinte Vol</p>
                  <p className="text-xl font-semibold text-white">
                    ~{country?.carbone?.vol_paris_kg_co2_estime ? country.carbone.vol_paris_kg_co2_estime.toLocaleString('fr-FR') : '1 200'} <span className="text-xs text-white/60">kg CO₂</span>
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">Paris A/R estimé</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-white/60 uppercase mb-1">Sac Recommandé</p>
                  <p className="text-xl font-semibold text-[#A8C4A2]">
                    {country?.gabarit_poids_recommande?.poids_total_kg || 12} kg
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">Gabarit léger</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── STICKY ANCHOR NAVIGATION BAR ── */}
          <nav className="sticky top-[64px] z-40 bg-[#FBFAF6]/90 backdrop-blur-md border-b border-[#0B1F17]/10 px-8 py-3 transition-all">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {ANCHORS.map((anchor) => (
                  <button
                    key={anchor.id}
                    onClick={() => scrollToSection(anchor.id)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                      activeSection === anchor.id
                        ? 'bg-[#17402C] text-[#FBFAF6] shadow-md'
                        : 'text-[#0B1F17]/70 hover:text-[#0B1F17] hover:bg-[#0B1F17]/5'
                    }`}
                  >
                    <span className="font-mono text-[10px] opacity-60">{anchor.num}</span>
                    <span>{anchor.label}</span>
                  </button>
                ))}
              </div>

              <div className="hidden lg:flex items-center gap-3">
                <Link
                  href="/ai-configurator"
                  className="px-4 py-2 bg-[#17402C] hover:bg-[#2D6B4A] text-[#FBFAF6] rounded-full text-xs font-semibold transition-all flex items-center gap-1.5"
                >
                  <Icon name="SparklesIcon" size={14} variant="outline" />
                  <span>Kit IA</span>
                </Link>
              </div>
            </div>
          </nav>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 01: PRÉSENTATION ──                                  */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="presentation" className="py-20 px-8 max-w-7xl mx-auto scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-mono text-[#17402C] uppercase tracking-widest mb-3">
              <span className="w-2 h-2 rounded-full bg-[#17402C]" />
              <span>Présentation générale</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-sans font-medium tracking-tight text-[#0B1F17] mb-12">
              Une destination où la <em className="font-serif italic text-[#17402C]">terre &amp; les éléments</em> dialoguent.
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* Copy editorial */}
              <div className="lg:col-span-7 space-y-6 text-lg text-[#0B1F17]/80 leading-relaxed font-serif">
                <p className="first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-[#17402C]">
                  {country?.coutumes || `${country?.pays?.nom} est un territoire d'exception offrant un relief unique et une richesse culturelle passionnante.`}
                </p>
                <p>
                  Des paysages somptueux s&apos;étendent à perte de vue, des vallées encaissées aux sommets alpins, en passant par des rivages sculptés par les marées et les vents. Les randonneurs y trouvent un terrain d&apos;aventure idéal pour déconnecter du quotidien.
                </p>

                {/* Quote Box */}
                <div className="my-8 p-6 bg-[#EDF3ED] border-l-4 border-[#17402C] rounded-r-2xl font-serif italic text-[#0B1F17]">
                  « Explorer {country?.pays?.nom}, c&apos;est réapprendre le rythme silencieux de la nature sauvage et des grands espaces. »
                  <cite className="block mt-3 text-xs font-sans not-italic font-semibold tracking-widest text-[#17402C] uppercase">
                    — Carnet d&apos;expédition LKDV
                  </cite>
                </div>
              </div>

              {/* Highlights 3 Cards Grid */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-6 bg-white rounded-2xl border border-[#0B1F17]/10 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-[#EDF3ED] text-[#17402C] flex items-center justify-center mb-4">
                    <Icon name="SunIcon" size={20} variant="outline" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0B1F17] mb-1 font-sans">
                    Meilleure <em className="font-serif italic text-[#17402C]">période</em>
                  </h3>
                  <p className="text-sm text-[#0B1F17]/70">
                    {bestMonths.length > 0
                      ? `Privilégiez les mois de ${bestMonths.map((m) => m.mois).join(', ')} pour profiter des meilleures conditions météo.`
                      : 'Conditions clémentes d\'avril à septembre selon les régions.'}
                  </p>
                </div>

                <div className="p-6 bg-white rounded-2xl border border-[#0B1F17]/10 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-[#EDF3ED] text-[#17402C] flex items-center justify-center mb-4">
                    <Icon name="PaperAirplaneIcon" size={20} variant="outline" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0B1F17] mb-1 font-sans">
                    Accès &amp; <em className="font-serif italic text-[#17402C]">Vols</em>
                  </h3>
                  <p className="text-sm text-[#0B1F17]/70">
                    Vols directs réguliers depuis Paris et les grandes capitales européennes. Transport local en 4x4 ou réseau de bus recommandé.
                  </p>
                </div>

                <div className="p-6 bg-white rounded-2xl border border-[#0B1F17]/10 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-[#EDF3ED] text-[#17402C] flex items-center justify-center mb-4">
                    <Icon name="ShieldCheckIcon" size={20} variant="outline" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0B1F17] mb-1 font-sans">
                    Sérénité &amp; <em className="font-serif italic text-[#17402C]">Sécurité</em>
                  </h3>
                  <p className="text-sm text-[#0B1F17]/70">
                    Statut de sécurité : <span className={`font-semibold ${secMeta.color}`}>{secMeta.label}</span>. Suivre les consignes locales et la météo de montagne.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <TopoSeparator />

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 02: DESTINATIONS & LIEUX ──                           */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="destinations" className="py-20 px-8 max-w-7xl mx-auto scroll-mt-24">
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-[#17402C] uppercase tracking-widest mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#17402C]" />
                  <span>Lieux d&apos;exception</span>
                </div>
                <h2 className="text-4xl font-sans font-medium tracking-tight text-[#0B1F17]">
                  Incontournables en <em className="font-serif italic text-[#17402C]">{country?.pays?.nom}</em>
                </h2>
              </div>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {country?.lieux_incontournables && country.lieux_incontournables.length > 0 ? (
                country.lieux_incontournables.map((lieu, idx) => {
                  const isFeatured = idx === 0;
                  const imgUrl = DEST_IMAGES.default[idx % DEST_IMAGES.default.length];
                  return (
                    <div
                      key={lieu.nom}
                      className={`group relative rounded-3xl overflow-hidden shadow-lg border border-[#0B1F17]/10 flex flex-col justify-end p-7 transition-all duration-300 hover:-translate-y-1.5 ${
                        isFeatured ? 'md:col-span-2 md:row-span-2 min-h-[420px]' : 'min-h-[280px]'
                      }`}
                    >
                      {/* Background Image */}
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                        style={{ backgroundImage: `url(${imgUrl})` }}
                      />
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F17] via-[#0B1F17]/40 to-transparent" />

                      <div className="relative z-10 text-white">
                        <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-mono uppercase tracking-widest text-[#A8C4A2] mb-3">
                          Lieu #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <h3 className={`font-sans font-medium tracking-tight mb-2 ${isFeatured ? 'text-3xl lg:text-4xl' : 'text-xl'}`}>
                          {lieu.nom}
                        </h3>
                        <p className={`text-white/80 font-serif leading-relaxed line-clamp-2 ${isFeatured ? 'text-base mb-4 max-w-xl' : 'text-xs mb-3'}`}>
                          {lieu.description}
                        </p>
                        {lieu.lat !== 0 && (
                          <span className="text-[10px] font-mono text-white/50 block">
                            📍 {lieu.lat.toFixed(4)}°, {lieu.lng.toFixed(4)}°
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-3 text-center py-12 text-[#0B1F17]/60">Aucun lieu répertorié.</div>
              )}
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 03: ACTIVITÉS ──                                      */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="activites" className="py-20 px-8 bg-[#EDF3ED]/40 border-y border-[#0B1F17]/10 scroll-mt-24">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#17402C] uppercase tracking-widest mb-2">
                    <span className="w-2 h-2 rounded-full bg-[#17402C]" />
                    <span>Expériences &amp; Terrains</span>
                  </div>
                  <h2 className="text-4xl font-sans font-medium tracking-tight text-[#0B1F17]">
                    Que faire en <em className="font-serif italic text-[#17402C]">{country?.pays?.nom}</em> ?
                  </h2>
                </div>

                {/* Activity Category Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {['all', 'nature', 'randonnee', 'culture'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveActivityCat(cat)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all ${
                        activeActivityCat === cat
                          ? 'bg-[#17402C] text-[#FBFAF6]'
                          : 'bg-white text-[#0B1F17]/70 border border-[#0B1F17]/10 hover:bg-[#0B1F17]/5'
                      }`}
                    >
                      {cat === 'all' ? 'Toutes les activités' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activities Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: 'Randonnée & Trekking alpin',
                    cat: 'randonnee',
                    diff: 'Modéré à Difficile',
                    duration: '1 à 5 jours',
                    desc: `Parcourez les sentiers sauvages de ${country?.pays?.nom}, entre montagnes abruptes, cols panoramiques et vallées préservées.`,
                    img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop'
                  },
                  {
                    title: 'Observation de la Faune & Flore',
                    cat: 'nature',
                    diff: 'Facile',
                    duration: 'Demi-journée',
                    desc: 'Observez les espèces emblématiques de la région dans leur habitat naturel protégé.',
                    img: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=800&auto=format&fit=crop'
                  },
                  {
                    title: 'Immersion Culturelle & Villages',
                    cat: 'culture',
                    diff: 'Facile',
                    duration: 'Journée',
                    desc: 'Découvrez l\'artisanat local, la gastronomie du terroir et les traditions régionales ancestrales.',
                    img: 'https://images.unsplash.com/photo-1529963183134-61a90db47eaf?q=80&w=800&auto=format&fit=crop'
                  }
                ]
                  .filter((item) => activeActivityCat === 'all' || item.cat === activeActivityCat)
                  .map((act) => (
                    <div key={act.title} className="bg-white rounded-3xl overflow-hidden border border-[#0B1F17]/10 shadow-sm hover:shadow-lg transition-all group flex flex-col">
                      <div className="h-48 bg-cover bg-center relative overflow-hidden" style={{ backgroundImage: `url(${act.img})` }}>
                        <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-mono font-semibold uppercase text-[#0B1F17]">
                          {act.diff}
                        </span>
                        <span className="absolute top-4 right-4 px-3 py-1 bg-[#0B1F17]/70 backdrop-blur-md rounded-full text-[10px] font-mono text-white">
                          ⏱ {act.duration}
                        </span>
                      </div>
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-mono tracking-widest text-[#17402C] uppercase mb-1">{act.cat}</p>
                          <h3 className="text-xl font-semibold text-[#0B1F17] mb-2 font-sans group-hover:text-[#17402C] transition-colors">
                            {act.title}
                          </h3>
                          <p className="text-sm text-[#0B1F17]/70 font-serif leading-relaxed mb-4">{act.desc}</p>
                        </div>
                        <Link
                          href="/ai-configurator"
                          className="inline-flex items-center gap-2 text-xs font-semibold text-[#17402C] hover:underline"
                        >
                          <span>Voir le matériel adapté</span>
                          <Icon name="ArrowRightIcon" size={12} variant="outline" />
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 04: CULTURE & HISTOIRE (DARK THEME) ──               */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="culture" className="py-24 bg-[#0F2A20] text-[#FBFAF6] relative overflow-hidden scroll-mt-24">
            <div className="max-w-7xl mx-auto px-8 relative z-10">
              <div className="flex items-center gap-2 text-xs font-mono text-[#A8C4A2] uppercase tracking-widest mb-3">
                <span className="w-2 h-2 rounded-full bg-[#A8C4A2]" />
                <span>Culture &amp; Patrimoine</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-sans font-medium tracking-tight text-white mb-12">
                Un imaginaire façonné par <em className="font-serif italic text-[#A8C4A2]">l&apos;histoire</em>
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-16">
                {/* Large Quote Box */}
                <div className="lg:col-span-6 p-8 bg-white/5 border border-white/10 rounded-3xl relative backdrop-blur-md">
                  <span className="text-7xl font-serif text-[#A8C4A2]/30 absolute top-4 left-6">«</span>
                  <p className="text-2xl font-serif italic text-white leading-relaxed pt-6 mb-6 relative z-10">
                    Chaque colline, chaque tradition porte le récit des anciens explorateurs et des générations qui ont vécu en harmonie avec la nature.
                  </p>
                  <p className="text-xs font-mono tracking-widest text-[#A8C4A2] uppercase">— Patrimoine &amp; Récits</p>
                </div>

                {/* Cultural Facts Grid */}
                <div className="lg:col-span-6 grid grid-cols-2 gap-4">
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] font-mono tracking-widest text-[#A8C4A2] uppercase mb-1">Langue &amp; Mots</p>
                    <p className="text-lg font-semibold text-white mb-1">{country?.pratique?.langues?.join(', ') || 'Langue locale'}</p>
                    <p className="text-xs text-white/60 font-serif">Une langue riche en vocabulaire lié à la montagne et la météo.</p>
                  </div>
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] font-mono tracking-widest text-[#A8C4A2] uppercase mb-1">Coutumes</p>
                    <p className="text-lg font-semibold text-white mb-1">Hospitalité</p>
                    <p className="text-xs text-white/60 font-serif">Respect strict de la nature et bienveillance chaleureuse envers les visiteurs.</p>
                  </div>
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] font-mono tracking-widest text-[#A8C4A2] uppercase mb-1">Gastronomie</p>
                    <p className="text-lg font-semibold text-white mb-1">Produits Frais</p>
                    <p className="text-xs text-white/60 font-serif">Spécialités régionales authentiques préparées avec des ingrédients locaux.</p>
                  </div>
                  <div className="p-5 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] font-mono tracking-widest text-[#A8C4A2] uppercase mb-1">Événements</p>
                    <p className="text-lg font-semibold text-white mb-1">{country?.evenements?.length || 4} Temps forts</p>
                    <p className="text-xs text-white/60 font-serif">Festivals, fêtes traditionnelles et rassemblements saisonniers.</p>
                  </div>
                </div>
              </div>

              {/* Events Calendar */}
              {country?.evenements && country.evenements.length > 0 && (
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md">
                  <h3 className="text-xl font-sans font-medium text-white mb-6">
                    Événements &amp; grands <em className="font-serif italic text-[#A8C4A2]">rendez-vous</em>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {country.evenements.map((ev) => (
                      <div key={ev.nom} className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-[10px] font-mono text-[#A8C4A2] block mb-1">{ev.periode}</span>
                        <h4 className="text-sm font-semibold text-white mb-1">{ev.nom}</h4>
                        <p className="text-xs text-white/70 font-serif leading-relaxed">{ev.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 05: GASTRONOMIE ──                                    */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="gastronomie" className="py-20 px-8 max-w-7xl mx-auto scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-mono text-[#17402C] uppercase tracking-widest mb-2">
              <span className="w-2 h-2 rounded-full bg-[#17402C]" />
              <span>Gastronomie &amp; Saveurs</span>
            </div>
            <h2 className="text-4xl font-sans font-medium tracking-tight text-[#0B1F17] mb-12">
              Une cuisine de <em className="font-serif italic text-[#17402C]">terroir &amp; d&apos;authenticité</em>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { num: '1', cat: 'Spécialité principale', title: 'Cuisine traditionnelle', desc: 'Des plats mijotés savoureux réconfortants après une journée en montagne.' },
                { num: '2', cat: 'Produit phare', title: 'Ingrédients de saison', desc: 'Fruits, légumes et herbes aromatiques récoltés localement dans le respect de la terre.' },
                { num: '3', cat: 'Boissons', title: 'Spécialités artisanales', desc: 'Infusions de plantes sauvages, bières locales et boissons typiques.' },
                { num: '4', cat: 'Desserts', title: 'Douceurs régionales', desc: 'Pâtisseries et spécialités sucrées réputées de la région.' }
              ].map((item) => (
                <div key={item.num} className="bg-white p-6 rounded-3xl border border-[#0B1F17]/10 shadow-sm hover:shadow-md transition-all">
                  <span className="w-8 h-8 rounded-full bg-[#EDF3ED] text-[#17402C] font-serif italic text-sm font-bold flex items-center justify-center mb-4">
                    {item.num}
                  </span>
                  <p className="text-[10px] font-mono tracking-widest text-[#17402C] uppercase mb-1">{item.cat}</p>
                  <h3 className="text-lg font-semibold text-[#0B1F17] mb-2 font-sans">{item.title}</h3>
                  <p className="text-xs text-[#0B1F17]/70 font-serif leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <TopoSeparator />

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 06: INFORMATIONS PRATIQUES ──                       */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="pratique" className="py-20 px-8 max-w-7xl mx-auto scroll-mt-24">
            <div className="flex items-center gap-2 text-xs font-mono text-[#17402C] uppercase tracking-widest mb-2">
              <span className="w-2 h-2 rounded-full bg-[#17402C]" />
              <span>Informations Pratiques</span>
            </div>
            <h2 className="text-4xl font-sans font-medium tracking-tight text-[#0B1F17] mb-12">
              Tout préparer avant votre <em className="font-serif italic text-[#17402C]">départ</em>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Formalités */}
              <div className="bg-white p-6 rounded-3xl border border-[#0B1F17]/10 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#EDF3ED] text-[#17402C] flex items-center justify-center mb-4">
                  <Icon name="IdentificationIcon" size={20} variant="outline" />
                </div>
                <h3 className="text-base font-semibold text-[#0B1F17] mb-3">Formalités &amp; Visa</h3>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-[#0B1F17]/5">
                    <span className="text-[#0B1F17]/60">Visiteur</span>
                    <span className="text-[#0B1F17] font-semibold">{country?.pratique?.visa?.nationalite || 'UE'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#0B1F17]/5">
                    <span className="text-[#0B1F17]/60">Règle</span>
                    <span className="text-[#17402C] font-semibold">{country?.pratique?.visa?.duree_sejour_sans_visa || 'Sans visa 90j'}</span>
                  </div>
                </div>
              </div>

              {/* Monnaie & Budget */}
              <div className="bg-white p-6 rounded-3xl border border-[#0B1F17]/10 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#EDF3ED] text-[#17402C] flex items-center justify-center mb-4">
                  <Icon name="CurrencyEuroIcon" size={20} variant="outline" />
                </div>
                <h3 className="text-base font-semibold text-[#0B1F17] mb-3">Monnaie &amp; Budget</h3>
                <p className="text-xs font-mono text-[#0B1F17] mb-2">{country?.pratique?.monnaie || 'Euro (EUR)'}</p>
                <p className="text-xs text-[#0B1F17]/70 font-serif">Paiement par carte bancaire très largement accepté dans l&apos;ensemble du pays.</p>
              </div>

              {/* Prises & Réseau */}
              <div className="bg-white p-6 rounded-3xl border border-[#0B1F17]/10 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#EDF3ED] text-[#17402C] flex items-center justify-center mb-4">
                  <Icon name="BoltIcon" size={20} variant="outline" />
                </div>
                <h3 className="text-base font-semibold text-[#0B1F17] mb-3">Prises &amp; Réseau</h3>
                <p className="text-xs font-mono text-[#0B1F17] mb-1">{country?.pratique?.prise_electrique?.type || 'Type C / F (230 V)'}</p>
                <p className="text-xs text-[#0B1F17]/70 font-serif">4G/5G excellente dans les zones urbaines et axes principaux.</p>
              </div>

              {/* Santé & Urgences */}
              <div className="bg-white p-6 rounded-3xl border border-[#0B1F17]/10 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#EDF3ED] text-[#17402C] flex items-center justify-center mb-4">
                  <Icon name="HeartIcon" size={20} variant="outline" />
                </div>
                <h3 className="text-base font-semibold text-[#0B1F17] mb-3">Santé &amp; Eau</h3>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs">💧</span>
                  <span className="text-xs font-semibold text-emerald-600">
                    Eau du robinet : {country?.sante?.eau_potable === 'oui' ? 'Potable' : 'À vérifier'}
                  </span>
                </div>
                <p className="text-xs text-[#0B1F17]/70 font-serif">Numéro d&apos;urgence unique : 112.</p>
              </div>
            </div>

            {/* Phrases de survie */}
            {country?.pratique?.phrases_survie && country.pratique.phrases_survie.length > 0 && (
              <div className="mt-8 p-6 bg-white rounded-3xl border border-[#0B1F17]/10 shadow-sm">
                <h3 className="text-lg font-semibold text-[#0B1F17] mb-4 font-sans">Phrases de survie utiles</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {country.pratique.phrases_survie.map((p) => (
                    <div key={p.fr} className="p-3 bg-[#EDF3ED]/50 rounded-2xl text-center">
                      <p className="text-xs text-[#0B1F17]/60 mb-0.5">{p.fr}</p>
                      <p className="text-sm font-semibold font-mono text-[#17402C]">{p.locale}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 07: MÉTÉO & SÉCURITÉ ──                               */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="meteo-securite" className="py-20 px-8 bg-[#EDF3ED]/40 border-t border-[#0B1F17]/10 scroll-mt-24">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-mono text-[#17402C] uppercase tracking-widest mb-2">
                <span className="w-2 h-2 rounded-full bg-[#17402C]" />
                <span>Conditions &amp; Météo</span>
              </div>
              <h2 className="text-4xl font-sans font-medium tracking-tight text-[#0B1F17] mb-12">
                Calendrier climatique &amp; <em className="font-serif italic text-[#17402C]">Sécurité</em>
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* 12 Month Weather Grid */}
                <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-[#0B1F17]/10 shadow-sm">
                  <h3 className="text-xl font-semibold text-[#0B1F17] mb-2 font-sans">Météo mois par mois</h3>
                  <p className="text-sm text-[#0B1F17]/70 font-serif mb-6">Températures minimales/maximales et précipitations moyennes.</p>

                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {country?.meteo?.calendrier_12_mois?.map((m) => {
                      const style = niveauMeteo[m.niveau] || niveauMeteo.moyen;
                      return (
                        <div key={m.mois} className={`p-3 rounded-2xl text-center border ${style.bg}`}>
                          <p className="text-[10px] font-mono text-[#0B1F17]/60 mb-1 uppercase">{m.mois.slice(0, 3)}</p>
                          <div className={`w-2.5 h-2.5 rounded-full mx-auto mb-2 ${style.dot}`} />
                          <p className="text-xs font-bold text-[#0B1F17]">{m.temp_min_c}° / {m.temp_max_c}°</p>
                          <p className="text-[10px] text-[#0B1F17]/60 mt-0.5">{m.precipitations_mm}mm</p>
                          <span className={`inline-block mt-2 text-[9px] font-mono px-2 py-0.5 rounded-full ${affluenceStyle[m.affluence] || 'bg-gray-100'}`}>
                            {m.affluence}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Security Widget */}
                <div className="lg:col-span-4 bg-white p-8 rounded-3xl border border-[#0B1F17]/10 shadow-sm">
                  <h3 className="text-xl font-semibold text-[#0B1F17] mb-2 font-sans">Conseils Sécurité</h3>
                  <div className={`px-4 py-2.5 rounded-2xl border text-sm font-semibold flex items-center gap-2 mb-4 ${secMeta.bg} ${secMeta.color}`}>
                    <span>{secMeta.icon}</span>
                    <span>{secMeta.label}</span>
                  </div>

                  <div className="space-y-3">
                    {country?.securite?.zones?.map((z) => (
                      <div key={z.nom_zone} className="p-3.5 bg-[#FBFAF6] rounded-2xl border border-[#0B1F17]/5 text-xs">
                        <p className="font-semibold text-[#0B1F17] mb-1">{z.nom_zone}</p>
                        <p className="text-[#0B1F17]/70 font-serif leading-relaxed">{z.description}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#0B1F17]/10 text-[11px] text-[#0B1F17]/50 font-mono">
                    Source officielle : {country?.securite?.source_officielle?.nom || 'Ministère des Affaires Étrangères'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* ── SECTION 08: FAQ & PAYS SIMILAIRES ──                          */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <section id="faq" className="py-20 px-8 max-w-7xl mx-auto scroll-mt-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              {/* FAQ Accordion */}
              <div className="lg:col-span-7">
                <div className="flex items-center gap-2 text-xs font-mono text-[#17402C] uppercase tracking-widest mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#17402C]" />
                  <span>Questions fréquentes</span>
                </div>
                <h2 className="text-4xl font-sans font-medium tracking-tight text-[#0B1F17] mb-8">
                  Questions sur le <em className="font-serif italic text-[#17402C]">voyage</em>
                </h2>

                <div className="space-y-3">
                  {country?.faq && country.faq.length > 0 ? (
                    country.faq.map((item, i) => (
                      <div key={i} className="bg-white rounded-2xl border border-[#0B1F17]/10 overflow-hidden shadow-sm">
                        <button
                          onClick={() => setOpenFaq(openFaq === i ? null : i)}
                          className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[#0B1F17] hover:bg-[#0B1F17]/5 transition-colors"
                        >
                          <span>{item.question}</span>
                          <Icon name={openFaq === i ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} variant="outline" className="text-[#17402C]" />
                        </button>
                        {openFaq === i && (
                          <div className="px-5 pb-5 text-xs text-[#0B1F17]/70 font-serif leading-relaxed border-t border-[#0B1F17]/5 pt-3">
                            {item.reponse}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#0B1F17]/60 font-serif">Aucune question répertoriée.</p>
                  )}
                </div>
              </div>

              {/* Similar Countries Column */}
              <div className="lg:col-span-5">
                <div className="bg-[#17402C] text-[#FBFAF6] p-8 rounded-3xl shadow-xl">
                  <span className="text-[10px] font-mono tracking-widest text-[#A8C4A2] uppercase block mb-2">Inspirations</span>
                  <h3 className="text-2xl font-sans font-medium text-white mb-6">
                    Destinations <em className="font-serif italic text-[#A8C4A2]">similaires</em>
                  </h3>

                  <div className="space-y-4">
                    {country?.pays_similaires?.map((p) => (
                      <Link
                        key={p.code_iso}
                        href={`/pays/${p.code_iso.toLowerCase()}`}
                        className="p-4 bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl transition-all flex items-center gap-4 group"
                      >
                        <span className="text-3xl">{getFlagEmoji(p.code_iso)}</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-white text-sm group-hover:text-[#A8C4A2] transition-colors">{p.nom}</h4>
                          <p className="text-xs text-white/70 font-serif">{p.raison}</p>
                        </div>
                        <Icon name="ArrowRightIcon" size={16} variant="outline" className="text-[#A8C4A2]" />
                      </Link>
                    ))}
                  </div>

                  {/* AI Configurator Banner CTA */}
                  <div className="mt-8 pt-6 border-t border-white/15 text-center">
                    <p className="text-xs text-white/80 font-serif mb-4">Besoin d&apos;un équipement sur-mesure pour votre voyage ?</p>
                    <Link
                      href="/ai-configurator"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FBFAF6] hover:bg-white text-[#0B1F17] rounded-full text-xs font-semibold transition-all shadow-md"
                    >
                      <Icon name="SparklesIcon" size={14} variant="outline" className="text-[#17402C]" />
                      <span>Configurer mon Kit IA</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <TopoSeparator />
        </main>

        <Footer />
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* ── MOBILE VIEW ──                                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="block md:hidden bg-[#FBFAF6]">
        <MobilePageShell>
          <div style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
            {/* Mobile Hero Header */}
            <div style={{ background: 'linear-gradient(160deg, #0F2A20 0%, #0B1F17 100%)', padding: '24px 16px', color: '#FBFAF6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: '36px' }}>{getFlagEmoji(code)}</span>
                <div>
                  <p style={{ fontSize: '10px', fontFamily: 'monospace', color: '#A8C4A2', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>
                    {country?.pays?.continent || 'Destination'}
                  </p>
                  <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0, color: '#FBFAF6' }}>
                    {country?.pays?.nom}
                  </h1>
                </div>
              </div>

              {/* Quick Info Chips Mobile */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: '#FBFAF6' }}>
                  🛂 {country?.pratique?.visa?.duree_sejour_sans_visa || 'Sans visa'}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: '#FBFAF6' }}>
                  💶 {country?.pratique?.monnaie || 'Monnaie'}
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', color: '#FBFAF6' }}>
                  🕒 {country?.pratique?.decalage_horaire_utc || 'UTC'}
                </div>
              </div>
            </div>

            {/* Mobile Stats Card Bar */}
            <div style={{ margin: '-16px 12px 16px', padding: '14px', background: '#ffffff', borderRadius: '16px', border: '1px solid rgba(11,31,23,0.1)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div>
                <p style={{ fontSize: '9px', color: '#63736C', textTransform: 'uppercase', margin: 0 }}>Saison</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#17402C', margin: 0 }}>
                  {bestMonths.length > 0 ? `${bestMonths[0]?.mois?.slice(0, 3)}` : 'Idéale'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '9px', color: '#63736C', textTransform: 'uppercase', margin: 0 }}>Sécurité</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#17402C', margin: 0 }}>{secMeta.label.split(' ')[0]}</p>
              </div>
              <div>
                <p style={{ fontSize: '9px', color: '#63736C', textTransform: 'uppercase', margin: 0 }}>Sac IA</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#17402C', margin: 0 }}>{country?.gabarit_poids_recommande?.poids_total_kg || 12} kg</p>
              </div>
            </div>

            {/* Scrollable Tab Pills */}
            <div style={{ padding: '0 12px 12px', overflowX: 'auto', display: 'flex', gap: '8px' }}>
              {ANCHORS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => scrollToSection(a.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: activeSection === a.id ? 700 : 500,
                    background: activeSection === a.id ? '#17402C' : '#EDF3ED',
                    color: activeSection === a.id ? '#FBFAF6' : '#0B1F17',
                    whiteSpace: 'nowrap',
                    border: 'none'
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Mobile Section: Presentation */}
            <div style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0B1F17', marginBottom: '8px' }}>Présentation</h3>
              <p style={{ fontSize: '13px', color: '#2B3E36', lineHeight: 1.5, marginBottom: '16px' }}>
                {country?.coutumes || `Découvrez les panoramas d'exception et la richesse culturelle de ${country?.pays?.nom}.`}
              </p>

              {/* Mobile Destinations */}
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0B1F17', marginBottom: '8px', marginTop: '24px' }}>Incontournables</h3>
              <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
                {country?.lieux_incontournables?.map((lieu, i) => (
                  <div key={lieu.nom} style={{ minWidth: '220px', padding: '14px', background: '#ffffff', borderRadius: '16px', border: '1px solid rgba(11,31,23,0.1)' }}>
                    <span style={{ fontSize: '10px', color: '#17402C', fontWeight: 700 }}>#{i + 1}</span>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0B1F17', margin: '4px 0' }}>{lieu.nom}</h4>
                    <p style={{ fontSize: '11px', color: '#63736C', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {lieu.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Mobile CTA */}
              <div style={{ marginTop: '24px', padding: '18px', background: '#0F2A20', borderRadius: '20px', color: '#FBFAF6', textAlign: 'center' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>Voyagez en {country?.pays?.nom}</p>
                <p style={{ fontSize: '12px', color: '#A8C4A2', margin: '0 0 14px' }}>Configurez votre équipement sur-mesure grâce à notre IA.</p>
                <Link
                  href="/ai-configurator"
                  style={{ display: 'inline-block', width: '100%', padding: '12px', background: '#FBFAF6', color: '#0B1F17', borderRadius: '999px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}
                >
                  Configurer mon Kit IA
                </Link>
              </div>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
