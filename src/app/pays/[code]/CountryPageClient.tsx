'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import type { CountryDataV2 } from '@/types/country';

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getFlagEmoji(code: string): string {
  const codePoints = code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function formatPrice(eur: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eur);
}

// ─── STYLE MAPS ───────────────────────────────────────────────────────────

const niveauMeteo = {
  ideal: { dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Idéal' },
  bon: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', label: 'Bon' },
  moyen: { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', label: 'Moyen' },
  deconseille: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Déconseillé' },
};

const niveauSecurite = {
  sur: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Sûr', icon: '✅' },
  vigilance: { color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', label: 'Vigilance', icon: '⚠️' },
  deconseille_sauf_raison_imperative: { color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', label: 'Déconseillé sauf raison impérative', icon: '🔶' },
  formellement_deconseille: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Formellement déconseillé', icon: '🚫' },
};

const affluenceStyle = {
  faible: 'text-green-400 bg-green-500/10',
  moyenne: 'text-amber-400 bg-amber-400/10',
  forte: 'text-red-400 bg-red-500/10',
};

const prixVolStyle = {
  bas: { color: 'text-green-400', label: 'Prix bas' },
  moyen: { color: 'text-amber-400', label: 'Prix moyens' },
  haut: { color: 'text-red-400', label: 'Prix élevés' },
};

// ─── SKELETON ─────────────────────────────────────────────────────────────

function SkeletonCountry() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-6">
        <div className="w-20 h-20 bg-white/5 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-white/5 rounded w-24" />
          <div className="h-8 bg-white/5 rounded w-48" />
          <div className="h-4 bg-white/5 rounded w-64" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-white/5 rounded-xl" />)}
      </div>
      <div className="h-12 bg-white/5 rounded-xl" />
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────

type TabId = 'apercu' | 'meteo' | 'securite' | 'sante' | 'pratique' | 'vols' | 'lieux' | 'faq';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'apercu', label: 'Aperçu', icon: 'HomeIcon' },
  { id: 'meteo', label: 'Météo', icon: 'SunIcon' },
  { id: 'securite', label: 'Sécurité', icon: 'ShieldCheckIcon' },
  { id: 'sante', label: 'Santé', icon: 'HeartIcon' },
  { id: 'pratique', label: 'Pratique', icon: 'InformationCircleIcon' },
  { id: 'vols', label: 'Vols & CO₂', icon: 'PaperAirplaneIcon' },
  { id: 'lieux', label: 'Lieux', icon: 'MapPinIcon' },
  { id: 'faq', label: 'FAQ', icon: 'QuestionMarkCircleIcon' },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────

export default function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = React.use(params);
  const [country, setCountry] = useState<CountryDataV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('apercu');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const code = rawCode.toLowerCase();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pays/${code}?v=2`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        const data = json.data;
        // Validate that the response matches the v2 schema before setting state
        if (
          !data ||
          !data.pays ||
          !data.meteo ||
          !Array.isArray(data.meteo?.calendrier_12_mois) ||
          !data.securite ||
          !data.pratique
        ) {
          throw new Error('Format de données invalide. Veuillez réessayer.');
        }
        setCountry(data as CountryDataV2);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  const bestMonths = Array.isArray(country?.meteo?.calendrier_12_mois)
    ? (country!.meteo.calendrier_12_mois).filter((m) => m.niveau === 'ideal' || m.niveau === 'bon')
    : [];
  const worstSecZone = country?.securite?.zones && country.securite.zones.length > 0
    ? country.securite.zones.reduce((worst, z) => {
        const order = ['sur', 'vigilance', 'deconseille_sauf_raison_imperative', 'formellement_deconseille'];
        return order.indexOf(z.niveau) > order.indexOf(worst.niveau) ? z : worst;
      }, country.securite.zones[0])
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="pt-20">
        {/* Breadcrumb */}
        <nav aria-label="Fil d'Ariane" className="bg-dark-bg border-b border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <ol className="flex items-center gap-2 text-xs text-white/40">
              <li><Link href="/" className="hover:text-white/70 transition-colors">Accueil</Link></li>
              <li aria-hidden="true"><Icon name="ChevronRightIcon" size={12} variant="outline" /></li>
              <li><Link href="/pays" className="hover:text-white/70 transition-colors">Pays</Link></li>
              <li aria-hidden="true"><Icon name="ChevronRightIcon" size={12} variant="outline" /></li>
              <li className="text-white/70">{country?.pays.nom || code.toUpperCase()}</li>
            </ol>
          </div>
        </nav>

        {/* Hero */}
        <section className="bg-dark-bg border-b border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {loading ? (
              <SkeletonCountry />
            ) : error ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Icon name="ExclamationTriangleIcon" size={28} variant="outline" className="text-red-400" />
                </div>
                <p className="text-red-400 mb-2 font-semibold">Données indisponibles</p>
                <p className="text-white/40 text-sm mb-6">{error}</p>
                <button onClick={() => window.location.reload()} className="btn-primary">
                  Réessayer
                </button>
              </div>
            ) : country ? (
              <>
                {/* Country header */}
                <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <span className="text-7xl" role="img" aria-label={`Drapeau ${country.pays.nom}`}>
                      {getFlagEmoji(code)}
                    </span>
                    <div>
                      <p className="text-xs font-mono text-primary tracking-widest uppercase mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
                        {country.pays.continent}
                      </p>
                      <h1 className="font-bold text-4xl sm:text-5xl text-white tracking-tight mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                        {country.pays.nom}
                      </h1>
                      <div className="flex flex-wrap gap-3 text-sm text-white/50">
                        <span className="flex items-center gap-1">
                          <Icon name="CurrencyEuroIcon" size={12} variant="outline" />
                          {country.pratique.monnaie}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="ClockIcon" size={12} variant="outline" />
                          {country.pratique.decalage_horaire_utc}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="LanguageIcon" size={12} variant="outline" />
                          {country.pratique.langues.slice(0, 2).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Security badge */}
                  {worstSecZone && (
                    <div className="sm:ml-auto">
                      <p className="text-xs text-white/30 mb-1 font-mono text-right" style={{ fontFamily: 'var(--font-mono)' }}>Niveau sécurité</p>
                      <div className={`px-4 py-2 rounded-xl border text-sm font-semibold ${niveauSecurite[worstSecZone.niveau].bg} ${niveauSecurite[worstSecZone.niveau].color}`}>
                        {niveauSecurite[worstSecZone.niveau].icon} {niveauSecurite[worstSecZone.niveau].label}
                      </div>
                      <p className="text-[10px] text-white/30 mt-1 text-right font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                        Source : {country.securite.source_officielle.nom}
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">Visa ({country.pratique.visa.nationalite})</p>
                    <p className="text-sm font-semibold text-white truncate">{country.pratique.visa.duree_sejour_sans_visa || '—'}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">Meilleure période</p>
                    <p className="text-sm font-semibold text-green-400">
                      {bestMonths.length > 0
                        ? `${bestMonths[0].mois.slice(0, 3)}–${bestMonths[bestMonths.length - 1].mois.slice(0, 3)}`
                        : 'Variable'}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">CO₂ aller-retour</p>
                    <p className="text-sm font-semibold text-white">
                      ~{country.carbone.vol_paris_kg_co2_estime.toLocaleString('fr-FR')} kg
                      <span className="text-white/30 text-[10px] ml-1">est.</span>
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-xs text-white/40 mb-1">Budget/jour (moyen)</p>
                    <p className="text-sm font-semibold text-white">
                      {formatPrice(
                        country.pratique.budget_quotidien_repere_eur.moyen.logement +
                        country.pratique.budget_quotidien_repere_eur.moyen.nourriture +
                        country.pratique.budget_quotidien_repere_eur.moyen.transport
                      )}
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-white/10 overflow-x-auto" role="tablist" aria-label="Sections du pays">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        activeTab === tab.id
                          ? 'border-primary text-white' :'border-transparent text-white/40 hover:text-white/70'
                      }`}
                    >
                      <Icon name={tab.icon as never} size={14} variant="outline" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* Tab content */}
        {country && !loading && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* ── APERÇU ── */}
            {activeTab === 'apercu' && (
              <div className="space-y-8">
                {/* Security overview */}
                <div>
                  <h2 className="font-bold text-xl text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                    Sécurité par zone
                  </h2>
                  <div className="space-y-3">
                    {country.securite.zones.map((z) => (
                      <div key={z.nom_zone} className={`topo-card p-4 border ${niveauSecurite[z.niveau].bg}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <span>{niveauSecurite[z.niveau].icon}</span>
                            {z.nom_zone}
                          </p>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${niveauSecurite[z.niveau].color} ${niveauSecurite[z.niveau].bg}`} style={{ fontFamily: 'var(--font-mono)' }}>
                            {niveauSecurite[z.niveau].label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{z.description}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/30 mt-2 flex items-center gap-1">
                    <Icon name="ShieldCheckIcon" size={10} variant="outline" />
                    Source : <a href={country.securite.source_officielle.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50">{country.securite.source_officielle.nom}</a>
                    {' '}— statut : <span className={country.securite.statut === 'verifie' ? 'text-green-400' : 'text-amber-400'}>{country.securite.statut}</span>
                  </p>
                </div>

                {/* Events */}
                {country.evenements.length > 0 && (
                  <div>
                    <h2 className="font-bold text-xl text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                      Événements & saisons clés
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.evenements.map((ev) => (
                        <div key={ev.nom} className="topo-card p-4 flex gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-500/10 text-lg">🎉</div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{ev.periode}</p>
                            <p className="text-sm font-semibold text-foreground">{ev.nom}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top lieux preview */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Incontournables</h2>
                    <button onClick={() => setActiveTab('lieux')} className="text-xs text-primary hover:underline">Voir tous →</button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {country.lieux_incontournables.slice(0, 3).map((lieu, i) => (
                      <div key={lieu.nom} className="topo-card p-4 flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 font-mono text-primary font-bold text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                          {i + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>{lieu.nom}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">{lieu.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pays similaires */}
                {country.pays_similaires.length > 0 && (
                  <div>
                    <h2 className="font-bold text-xl text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                      Destinations similaires
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {country.pays_similaires.map((p) => (
                        <Link key={p.code_iso} href={`/pays/${p.code_iso.toLowerCase()}`} className="topo-card p-4 hover:border-primary/20 transition-colors flex items-center gap-3">
                          <span className="text-3xl">{getFlagEmoji(p.code_iso)}</span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{p.nom}</p>
                            <p className="text-xs text-muted-foreground">{p.raison}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coutumes */}
                {country.coutumes && (
                  <div className="topo-card p-5">
                    <h2 className="font-bold text-base text-foreground mb-2 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                      <span>🤝</span> Coutumes locales
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{country.coutumes}</p>
                  </div>
                )}

                {/* CTA */}
                <div className="topo-card p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                        Préparez votre voyage en {country.pays.nom}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Notre IA configure votre kit idéal selon la saison, les activités et votre budget.
                      </p>
                    </div>
                    <Link href="/ai-configurator" className="btn-primary flex items-center gap-2 whitespace-nowrap">
                      <Icon name="SparklesIcon" size={16} variant="outline" />
                      Configurer mon kit
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ── MÉTÉO ── */}
            {activeTab === 'meteo' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Calendrier météo</h2>
                  <p className="text-xs text-white/30 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Source : {country.meteo?.source}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Températures, précipitations et affluence touristique pour {country.pays.nom}.</p>

                {!Array.isArray(country.meteo?.calendrier_12_mois) || country.meteo!.calendrier_12_mois.length === 0 ? (
                  <div className="topo-card p-6 text-center text-white/40 text-sm">Données météo indisponibles pour ce pays.</div>
                ) : (
                  <>
                {/* Month cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                  {country.meteo.calendrier_12_mois.map((m) => {
                    const style = niveauMeteo[m.niveau];
                    return (
                      <div key={m.mois} className={`topo-card p-3 text-center border ${style.bg}`}>
                        <p className="text-xs font-mono text-muted-foreground mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{m.mois.slice(0, 3)}</p>
                        <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${style.dot}`} aria-hidden="true" />
                        <p className={`text-xs font-bold ${style.text}`}>{style.label}</p>
                        <p className="text-[11px] text-foreground font-semibold mt-1">{m.temp_min_c}° – {m.temp_max_c}°</p>
                        <p className="text-[10px] text-muted-foreground">{m.precipitations_mm}mm</p>
                        <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-mono ${affluenceStyle[m.affluence]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                          {m.affluence}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Temperature bar chart */}
                <div className="topo-card p-5 mb-6">
                  <h3 className="font-semibold text-sm text-foreground mb-4">Températures max (°C)</h3>
                  <div className="flex items-end gap-2 h-24">
                    {country.meteo.calendrier_12_mois.map((m) => {
                      const maxTemp = Math.max(...country.meteo.calendrier_12_mois.map((x) => x.temp_max_c));
                      const heightPct = maxTemp > 0 ? Math.max(10, (m.temp_max_c / maxTemp) * 100) : 20;
                      const style = niveauMeteo[m.niveau];
                      return (
                        <div key={m.mois} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-full rounded-t-sm ${style.dot} opacity-80`} style={{ height: `${heightPct}%` }} title={`${m.mois}: ${m.temp_min_c}°–${m.temp_max_c}°C`} />
                          <span className="text-[9px] text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{m.mois.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Precipitation bar chart */}
                <div className="topo-card p-5 mb-6">
                  <h3 className="font-semibold text-sm text-foreground mb-4">Précipitations (mm)</h3>
                  <div className="flex items-end gap-2 h-20">
                    {country.meteo.calendrier_12_mois.map((m) => {
                      const maxRain = Math.max(...country.meteo.calendrier_12_mois.map((x) => x.precipitations_mm));
                      const heightPct = maxRain > 0 ? Math.max(5, (m.precipitations_mm / maxRain) * 100) : 10;
                      return (
                        <div key={m.mois} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full rounded-t-sm bg-info/60" style={{ height: `${heightPct}%` }} title={`${m.mois}: ${m.precipitations_mm}mm`} />
                          <span className="text-[9px] text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{m.mois.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                  </>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-2">
                  {Object.entries(niveauMeteo).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className={`w-2.5 h-2.5 rounded-full ${val.dot}`} aria-hidden="true" />
                      {val.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SÉCURITÉ ── */}
            {activeTab === 'securite' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-bold text-xl text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>Sécurité</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Données basées sur <a href={country.securite.source_officielle.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{country.securite.source_officielle.nom}</a>.
                    Statut : <span className={country.securite.statut === 'verifie' ? 'text-green-400 font-semibold' : 'text-amber-400 font-semibold'}>{country.securite.statut}</span>
                  </p>
                  {country.securite.statut === 'non_verifie' && (
                    <div className="topo-card p-4 border border-amber-400/20 bg-amber-400/5 mb-4">
                      <p className="text-sm text-amber-400 flex items-center gap-2">
                        <Icon name="ExclamationTriangleIcon" size={16} variant="outline" />
                        Ces informations n'ont pas pu être vérifiées auprès d'une source officielle. Consultez directement <a href={country.securite.source_officielle.url} target="_blank" rel="noopener noreferrer" className="underline">France Diplomatie</a>.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {country.securite.zones.map((z) => (
                      <div key={z.nom_zone} className={`topo-card p-5 border ${niveauSecurite[z.niveau].bg}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-foreground flex items-center gap-2">
                            <span className="text-lg">{niveauSecurite[z.niveau].icon}</span>
                            {z.nom_zone}
                          </p>
                          <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${niveauSecurite[z.niveau].color} ${niveauSecurite[z.niveau].bg}`} style={{ fontFamily: 'var(--font-mono)' }}>
                            {niveauSecurite[z.niveau].label}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{z.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ambassade */}
                <div className="topo-card p-5">
                  <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                    <Icon name="BuildingLibraryIcon" size={16} variant="outline" className="text-primary" />
                    Ambassade / Consulat
                  </h3>
                  <p className="text-sm font-semibold text-foreground mb-1">{country.securite.ambassade_consulat.nom}</p>
                  {country.securite.ambassade_consulat.telephone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                      <Icon name="PhoneIcon" size={12} variant="outline" />
                      {country.securite.ambassade_consulat.telephone}
                    </p>
                  )}
                  {country.securite.ambassade_consulat.url && (
                    <a href={country.securite.ambassade_consulat.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                      Site officiel →
                    </a>
                  )}
                </div>

                <p className="text-[11px] text-white/30 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                  Dernière synchronisation : {country.securite.derniere_synchronisation}
                </p>
              </div>
            )}

            {/* ── SANTÉ ── */}
            {activeTab === 'sante' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-bold text-xl text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>Santé</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Source : {country.sante.source} — Statut : <span className={country.sante.statut === 'verifie' ? 'text-green-400 font-semibold' : 'text-amber-400 font-semibold'}>{country.sante.statut}</span>
                  </p>
                  {country.sante.statut === 'non_verifie' && (
                    <div className="topo-card p-4 border border-amber-400/20 bg-amber-400/5 mb-4">
                      <p className="text-sm text-amber-400 flex items-center gap-2">
                        <Icon name="ExclamationTriangleIcon" size={16} variant="outline" />
                        Consultez un médecin du voyage ou le site de l'Institut Pasteur avant votre départ.
                      </p>
                    </div>
                  )}
                </div>

                {/* Eau potable */}
                <div className={`topo-card p-4 border ${country.sante.eau_potable === 'oui' ? 'border-green-500/20 bg-green-500/5' : country.sante.eau_potable === 'non' ? 'border-red-500/20 bg-red-500/5' : 'border-amber-400/20 bg-amber-400/5'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{country.sante.eau_potable === 'oui' ? '💧' : country.sante.eau_potable === 'non' ? '🚱' : '⚠️'}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Eau du robinet</p>
                      <p className={`text-sm font-bold ${country.sante.eau_potable === 'oui' ? 'text-green-400' : country.sante.eau_potable === 'non' ? 'text-red-400' : 'text-amber-400'}`}>
                        {country.sante.eau_potable === 'oui' ? 'Potable' : country.sante.eau_potable === 'non' ? 'Non potable' : country.sante.eau_potable === 'a_traiter' ? 'À traiter avant consommation' : 'Non vérifié'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Risques */}
                {country.sante.risques.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Risques sanitaires</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {country.sante.risques.map((r) => (
                        <div key={r} className="topo-card p-3 flex items-center gap-2">
                          <Icon name="ExclamationCircleIcon" size={14} variant="outline" className="text-amber-400 flex-shrink-0" />
                          <p className="text-sm text-foreground">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vaccins recommandés */}
                {country.sante.vaccins_recommandes.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Vaccins recommandés</h3>
                    <div className="flex flex-wrap gap-2">
                      {country.sante.vaccins_recommandes.map((v) => (
                        <span key={v} className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-sm border border-blue-500/20 font-medium">
                          💉 {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vaccins obligatoires */}
                {country.sante.vaccins_obligatoires.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>Vaccins obligatoires</h3>
                    <div className="flex flex-wrap gap-2">
                      {country.sante.vaccins_obligatoires.map((v) => (
                        <span key={v} className="px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-sm border border-red-500/20 font-bold">
                          ⚠️ {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-white/30 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                  Dernière mise à jour : {country.sante.derniere_maj}
                </p>
              </div>
            )}

            {/* ── PRATIQUE ── */}
            {activeTab === 'pratique' && (
              <div className="space-y-8">
                <h2 className="font-bold text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Informations pratiques</h2>

                {/* Visa */}
                <div className="topo-card p-5">
                  <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                    <Icon name="IdentificationIcon" size={16} variant="outline" className="text-primary" />
                    Visa — {country.pratique.visa.nationalite}
                  </h3>
                  <p className="text-sm text-foreground mb-2">{country.pratique.visa.regle}</p>
                  <p className="text-sm font-semibold text-green-400">{country.pratique.visa.duree_sejour_sans_visa}</p>
                </div>

                {/* Grid infos */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="topo-card p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="CurrencyEuroIcon" size={18} variant="outline" className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Monnaie</p>
                      <p className="text-sm text-foreground">{country.pratique.monnaie}</p>
                    </div>
                  </div>
                  <div className="topo-card p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="BoltIcon" size={18} variant="outline" className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Prises électriques</p>
                      <p className="text-sm text-foreground">{country.pratique.prise_electrique.type} — {country.pratique.prise_electrique.voltage}</p>
                    </div>
                  </div>
                  <div className="topo-card p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="ClockIcon" size={18} variant="outline" className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Décalage horaire</p>
                      <p className="text-sm text-foreground">{country.pratique.decalage_horaire_utc}</p>
                    </div>
                  </div>
                  <div className="topo-card p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="SignalIcon" size={18} variant="outline" className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Connectivité</p>
                      <p className="text-sm text-foreground capitalize">{country.connectivite.couverture_mobile} — {country.connectivite.wifi_disponibilite}</p>
                    </div>
                  </div>
                </div>

                {/* Budget */}
                <div>
                  <h3 className="font-bold text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Budget quotidien de référence (EUR)</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {(['petit', 'moyen', 'gros'] as const).map((tier) => {
                      const b = country.pratique.budget_quotidien_repere_eur[tier];
                      const total = b.logement + b.nourriture + b.transport;
                      const tierLabel = { petit: '🎒 Petit budget', moyen: '🏨 Budget moyen', gros: '✨ Confort' }[tier];
                      const tierColor = { petit: 'text-green-400', moyen: 'text-amber-400', gros: 'text-purple-400' }[tier];
                      return (
                        <div key={tier} className="topo-card p-4">
                          <p className={`text-sm font-bold mb-3 ${tierColor}`}>{tierLabel}</p>
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex justify-between"><span>Logement</span><span className="text-foreground font-medium">{formatPrice(b.logement)}</span></div>
                            <div className="flex justify-between"><span>Nourriture</span><span className="text-foreground font-medium">{formatPrice(b.nourriture)}</span></div>
                            <div className="flex justify-between"><span>Transport</span><span className="text-foreground font-medium">{formatPrice(b.transport)}</span></div>
                          </div>
                          <div className="border-t border-white/10 mt-3 pt-3 flex justify-between">
                            <span className="text-xs text-muted-foreground">Total/jour</span>
                            <span className={`text-base font-bold ${tierColor}`}>{formatPrice(total)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Phrases de survie */}
                {country.pratique.phrases_survie.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Phrases de survie</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.pratique.phrases_survie.map((p) => (
                        <div key={p.fr} className="topo-card p-3 flex items-center gap-3">
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">{p.fr}</p>
                            <p className="text-sm font-semibold text-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{p.locale}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gabarit poids */}
                <div className="topo-card p-5">
                  <h3 className="font-bold text-base text-foreground mb-2 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                    <Icon name="ScaleIcon" size={16} variant="outline" className="text-primary" />
                    Gabarit poids recommandé
                  </h3>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-3xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>
                      {country.gabarit_poids_recommande.poids_total_kg} kg
                    </span>
                    <WeightGauge weightG={country.gabarit_poids_recommande.poids_total_kg * 1000} maxG={20000} />
                  </div>
                  <p className="text-xs text-muted-foreground">{country.gabarit_poids_recommande.justification}</p>
                </div>
              </div>
            )}

            {/* ── VOLS & CO₂ ── */}
            {activeTab === 'vols' && (
              <div className="space-y-6">
                <h2 className="font-bold text-xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Vols & Empreinte carbone</h2>

                {/* Disclaimer vols */}
                <div className="topo-card p-4 border border-amber-400/20 bg-amber-400/5">
                  <p className="text-sm text-amber-400 flex items-start gap-2">
                    <Icon name="InformationCircleIcon" size={16} variant="outline" className="flex-shrink-0 mt-0.5" />
                    <span>Les tendances de prix sont <strong>indicatives</strong>. Les prix réels varient en continu. Utilisez un comparateur de vols en temps réel pour obtenir un prix précis.</span>
                  </p>
                </div>

                {/* Tendances par saison */}
                <div>
                  <h3 className="font-bold text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Tendances de prix par saison</h3>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {country.vols.tendance_par_saison.map((t) => {
                      const style = prixVolStyle[t.niveau_prix];
                      return (
                        <div key={t.periode} className="topo-card p-4 text-center">
                          <p className="text-xs text-muted-foreground mb-2">{t.periode}</p>
                          <p className={`text-lg font-bold ${style.color}`}>{style.label}</p>
                          <div className="flex justify-center gap-1 mt-2">
                            {['bas', 'moyen', 'haut'].map((level) => (
                              <div key={level} className={`w-6 h-2 rounded-full ${t.niveau_prix === level ? (level === 'bas' ? 'bg-green-400' : level === 'moyen' ? 'bg-amber-400' : 'bg-red-400') : 'bg-white/10'}`} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Carbone */}
                <div className="topo-card p-6">
                  <h3 className="font-bold text-base text-foreground mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                    🌱 Empreinte carbone — Paris ↔ {country.pays.nom}
                  </h3>
                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Aller-retour estimé</p>
                      <p className="text-4xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                        ~{country.carbone.vol_paris_kg_co2_estime.toLocaleString('fr-FR')}
                        <span className="text-lg text-muted-foreground ml-1">kg CO₂</span>
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green-400 to-red-400"
                          style={{ width: `${Math.min(100, (country.carbone.vol_paris_kg_co2_estime / 5000) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>0 kg</span><span>5 000 kg</span>
                      </div>
                    </div>
                  </div>
                  <div className="topo-card p-3 bg-white/3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Méthodologie :</span> {country.carbone.methodologie}
                    </p>
                    <p className="text-[10px] text-white/30 mt-1 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                      Statut : {country.carbone.statut} — Cette valeur est une estimation, pas une mesure exacte.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── LIEUX ── */}
            {activeTab === 'lieux' && (
              <div>
                <h2 className="font-bold text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>Lieux incontournables</h2>
                <p className="text-sm text-muted-foreground mb-6">Les sites et expériences à ne pas manquer en {country.pays.nom}.</p>
                <div className="space-y-4">
                  {country.lieux_incontournables.map((lieu, i) => (
                    <div key={lieu.nom} className="topo-card p-5 flex gap-4 hover:border-primary/20 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 font-mono text-primary font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>{lieu.nom}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{lieu.description}</p>
                        {lieu.lat !== 0 && lieu.lng !== 0 && (
                          <p className="text-[10px] text-white/30 mt-1 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                            {lieu.lat.toFixed(4)}°, {lieu.lng.toFixed(4)}°
                          </p>
                        )}
                      </div>
                      <Icon name="MapPinIcon" size={16} variant="outline" className="text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  ))}
                </div>

                {/* Events */}
                {country.evenements.length > 0 && (
                  <>
                    <h3 className="font-bold text-lg text-foreground mt-10 mb-4" style={{ fontFamily: 'var(--font-display)' }}>Événements & saisons</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.evenements.map((ev) => (
                        <div key={ev.nom} className="topo-card p-4 flex gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-500/10 text-lg">🎉</div>
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{ev.periode}</p>
                            <p className="text-sm font-semibold text-foreground">{ev.nom}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── FAQ ── */}
            {activeTab === 'faq' && (
              <div>
                <h2 className="font-bold text-xl text-foreground mb-2" style={{ fontFamily: 'var(--font-display)' }}>Questions fréquentes</h2>
                <p className="text-sm text-muted-foreground mb-6">Réponses basées sur les données réelles de cette fiche pays.</p>
                <div className="space-y-3">
                  {country.faq.map((item, i) => (
                    <div key={i} className="topo-card overflow-hidden">
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-white/3 transition-colors"
                        aria-expanded={openFaq === i}
                      >
                        <p className="text-sm font-semibold text-foreground">{item.question}</p>
                        <Icon
                          name={openFaq === i ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                          size={16}
                          variant="outline"
                          className="text-muted-foreground flex-shrink-0"
                        />
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.reponse}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8 topo-card p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                        Kit personnalisé pour {country.pays.nom}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Notre IA analyse la météo, les activités et votre budget pour créer votre kit sur mesure.
                      </p>
                    </div>
                    <Link href="/ai-configurator" className="btn-primary flex items-center gap-2 whitespace-nowrap">
                      <Icon name="SparklesIcon" size={16} variant="outline" />
                      Configurer mon kit IA
                    </Link>
                  </div>
                </div>
              </div>
            )}

          </section>
        )}

        <TopoSeparator />
      </main>
      <Footer />
    </div>
  );
}
