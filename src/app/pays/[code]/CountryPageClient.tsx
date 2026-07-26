'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import WeightGauge from '@/components/WeightGauge';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import type { CountryDataV2 } from '@/types/country';

// ─── HELPERS ──────────────────────────────────────────────────────────────

function getFlagEmoji(code: string): string {
  const codePoints = code.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// ─── STATIC FALLBACK DATA ─────────────────────────────────────────────────

const COUNTRY_FALLBACKS: Record<string, Partial<CountryDataV2>> = {
  is: {
    pays: { nom: 'Islande', code_iso: 'IS', continent: 'Europe' },
    pratique: {
      visa: { nationalite: 'France', regle: 'Espace Schengen — aucun visa requis', duree_sejour_sans_visa: '90 jours' },
      monnaie: 'Couronne islandaise (ISK)',
      prise_electrique: { type: 'Type F', voltage: '230V 50Hz' },
      langues: ['Islandais', 'Anglais (très répandu)'],
      phrases_survie: [
        { fr: 'Bonjour', locale: 'Halló' },
        { fr: 'Merci', locale: 'Takk' },
        { fr: 'Au revoir', locale: 'Bless' },
      ],
      decalage_horaire_utc: 'UTC+0 (heure de Paris : -1h en hiver, -2h en été)',
      budget_quotidien_repere_eur: {
        petit: { logement: 40, nourriture: 25, transport: 15 },
        moyen: { logement: 100, nourriture: 50, transport: 30 },
        gros: { logement: 250, nourriture: 100, transport: 80 },
      },
    },
    securite: {
      zones: [{ nom_zone: 'Ensemble du territoire', niveau: 'sur', description: 'Pays très sûr, risques naturels (volcans, geysers) à surveiller' }],
      source_officielle: { nom: 'France Diplomatie', url: 'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/islande/' },
      derniere_synchronisation: '2026-07-20',
      statut: 'verifie',
      ambassade_consulat: { nom: 'Ambassade de France à Reykjavik', telephone: '+354 575 9600', url: 'https://is.ambafrance.org/' },
    },
    sante: {
      risques: ['Risques naturels (volcans, geysers)', 'Hypothermie en montagne'],
      vaccins_recommandes: ['Vaccins de routine à jour'],
      vaccins_obligatoires: [],
      eau_potable: 'oui',
      source: 'Institut Pasteur',
      derniere_maj: '2026-07-20',
      statut: 'verifie',
    },
    meteo: {
      calendrier_12_mois: [
        { mois: 'Janvier', temp_min_c: -3, temp_max_c: 2, precipitations_mm: 76, niveau: 'deconseille', affluence: 'faible' },
        { mois: 'Février', temp_min_c: -3, temp_max_c: 2, precipitations_mm: 72, niveau: 'deconseille', affluence: 'faible' },
        { mois: 'Mars', temp_min_c: -2, temp_max_c: 3, precipitations_mm: 82, niveau: 'moyen', affluence: 'faible' },
        { mois: 'Avril', temp_min_c: 1, temp_max_c: 7, precipitations_mm: 58, niveau: 'moyen', affluence: 'moyenne' },
        { mois: 'Mai', temp_min_c: 4, temp_max_c: 11, precipitations_mm: 44, niveau: 'bon', affluence: 'moyenne' },
        { mois: 'Juin', temp_min_c: 7, temp_max_c: 14, precipitations_mm: 50, niveau: 'ideal', affluence: 'forte' },
        { mois: 'Juillet', temp_min_c: 9, temp_max_c: 16, precipitations_mm: 52, niveau: 'ideal', affluence: 'forte' },
        { mois: 'Août', temp_min_c: 8, temp_max_c: 15, precipitations_mm: 62, niveau: 'ideal', affluence: 'forte' },
        { mois: 'Septembre', temp_min_c: 5, temp_max_c: 11, precipitations_mm: 67, niveau: 'bon', affluence: 'moyenne' },
        { mois: 'Octobre', temp_min_c: 2, temp_max_c: 7, precipitations_mm: 86, niveau: 'moyen', affluence: 'faible' },
        { mois: 'Novembre', temp_min_c: -1, temp_max_c: 4, precipitations_mm: 73, niveau: 'deconseille', affluence: 'faible' },
        { mois: 'Décembre', temp_min_c: -3, temp_max_c: 2, precipitations_mm: 79, niveau: 'deconseille', affluence: 'faible' },
      ],
      source: 'Données climatiques officielles',
      derniere_maj: '2026-07-20',
    },
    lieux_incontournables: [
      { nom: 'Cercle d\'Or (Golden Circle)', description: 'Circuit emblématique : Þingvellir, Geysir, Gullfoss', lat: 64.26, lng: -20.6 },
      { nom: 'Lagon Bleu (Blue Lagoon)', description: 'Sources géothermales à 39°C, à 40 min de Reykjavik', lat: 63.88, lng: -22.45 },
      { nom: 'Jökulsárlón', description: 'Lagune glaciaire avec icebergs bleus spectaculaires', lat: 64.08, lng: -16.18 },
      { nom: 'Landmannalaugar', description: 'Départ du trek Laugavegur, sources chaudes naturelles', lat: 63.98, lng: -19.07 },
      { nom: 'Snæfellsnes', description: 'Péninsule avec glacier et parc national, décor de Jules Verne', lat: 64.87, lng: -23.77 },
    ],
    faq: [
      { question: 'Faut-il un visa pour visiter l\'Islande depuis la France ?', reponse: 'Non, l\'Islande fait partie de l\'espace Schengen. Les ressortissants français peuvent y séjourner jusqu\'à 90 jours sans visa.' },
      { question: 'Quelle est la meilleure saison pour visiter l\'Islande ?', reponse: 'Juin à août pour les nuits blanches et le trekking. Novembre à mars pour les aurores boréales.' },
      { question: 'L\'eau du robinet est-elle potable en Islande ?', reponse: 'Oui, l\'eau du robinet islandaise est parmi les plus pures au monde, directement issue des glaciers.' },
      { question: 'Quel budget prévoir pour 10 jours en Islande ?', reponse: 'Comptez 150-200€/jour en mode économique (camping, cuisine maison). 300-400€/jour en confort moyen.' },
    ],
    evenements: [
      { nom: 'Þorrablót', periode: 'Janvier-Février', description: 'Festival traditionnel islandais avec plats ancestraux (requin fermenté, mouton fumé)' },
      { nom: 'Nuits blanches de Reykjavik', periode: 'Juin-Juillet', description: 'Soleil de minuit — fêtes en plein air toute la nuit' },
      { nom: 'Iceland Airwaves', periode: 'Novembre', description: 'Festival de musique international dans les rues de Reykjavik' },
    ],
    connectivite: {
      couverture_mobile: 'bonne',
      wifi_disponibilite: 'WiFi disponible dans la plupart des hébergements et cafés. Couverture 4G dans les zones habitées.',
      statut: 'verifie',
    },
    vols: {
      tendance_par_saison: [
        { periode: 'Haute saison (juin-août)', niveau_prix: 'haut' },
        { periode: 'Basse saison (nov-mars)', niveau_prix: 'bas' },
        { periode: 'Épaule (avr-mai, sept-oct)', niveau_prix: 'moyen' },
      ],
      statut: 'indicatif',
    },
    carbone: {
      vol_paris_kg_co2_estime: 580,
      methodologie: 'Distance Paris–Reykjavik × 2 × 0.255 kg CO2/km/passager',
      statut: 'estimation',
    },
    coutumes: 'En Islande, la ponctualité est appréciée. Il est courant de se déchausser en entrant dans une maison. Les Islandais sont directs et informels. Évitez de marcher sur la mousse — elle met des décennies à repousser.',
    kits_recommandes_tags_climat: ['imperméable', 'couches', 'vent', 'froid', 'terrain-volcanique'],
    gabarit_poids_recommande: { poids_total_kg: 11, justification: 'Terrain volcanique exigeant, météo imprévisible — kit complet mais optimisé' },
    pays_similaires: [
      { code_iso: 'NO', nom: 'Norvège', raison: 'Fjords, randonnée nordique, météo similaire' },
      { code_iso: 'SE', nom: 'Suède', raison: 'Paysages nordiques, activités outdoor' },
      { code_iso: 'NZ', nom: 'Nouvelle-Zélande', raison: 'Volcans, geysers, paysages sauvages' },
    ],
    meta: { genere_le: '2026-07-20T00:00:00Z', cache_valide_jusqu_au: '2026-08-20T00:00:00Z' },
  },
};

function buildFallbackCountry(code: string): CountryDataV2 {
  const known = COUNTRY_FALLBACKS[code.toLowerCase()];
  if (known) return known as CountryDataV2;

  return {
    pays: { nom: code.toUpperCase(), code_iso: code.toUpperCase(), continent: 'Monde' },
    meteo: {
      calendrier_12_mois: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'].map((mois) => ({
        mois, temp_min_c: 10, temp_max_c: 25, precipitations_mm: 60, niveau: 'bon' as const, affluence: 'moyenne' as const,
      })),
      source: 'Données indicatives',
      derniere_maj: '2026-07-20',
    },
    securite: {
      zones: [{ nom_zone: 'Ensemble du territoire', niveau: 'vigilance' as const, description: 'Consultez France Diplomatie pour les informations à jour' }],
      source_officielle: { nom: 'France Diplomatie', url: 'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/' },
      derniere_synchronisation: '2026-07-20',
      statut: 'non_verifie' as const,
      ambassade_consulat: { nom: 'Ambassade de France', telephone: '', url: 'https://www.diplomatie.gouv.fr/' },
    },
    sante: {
      risques: ['Consultez un médecin du voyage avant le départ'],
      vaccins_recommandes: ['Vaccins de routine à jour'],
      vaccins_obligatoires: [],
      eau_potable: 'non_verifie' as const,
      source: 'Institut Pasteur',
      derniere_maj: '2026-07-20',
      statut: 'non_verifie' as const,
    },
    connectivite: { couverture_mobile: 'non_verifie' as const, wifi_disponibilite: 'Variable selon les régions', statut: 'estimation' as const },
    pratique: {
      visa: { nationalite: 'France', regle: 'Vérifiez les conditions d\'entrée sur France Diplomatie', duree_sejour_sans_visa: 'Variable' },
      monnaie: 'Monnaie locale',
      prise_electrique: { type: 'Variable', voltage: '220V' },
      langues: ['Langue locale'],
      phrases_survie: [{ fr: 'Bonjour', locale: 'Hello' }, { fr: 'Merci', locale: 'Thank you' }],
      decalage_horaire_utc: 'UTC+0',
      budget_quotidien_repere_eur: {
        petit: { logement: 30, nourriture: 15, transport: 10 },
        moyen: { logement: 70, nourriture: 30, transport: 20 },
        gros: { logement: 150, nourriture: 60, transport: 50 },
      },
    },
    vols: { tendance_par_saison: [{ periode: 'Haute saison', niveau_prix: 'haut' as const }, { periode: 'Basse saison', niveau_prix: 'bas' as const }], statut: 'indicatif' as const },
    carbone: { vol_paris_kg_co2_estime: 500, methodologie: 'Estimation basée sur distance moyenne', statut: 'estimation' as const },
    evenements: [],
    lieux_incontournables: [],
    coutumes: 'Renseignez-vous sur les coutumes locales avant votre départ.',
    kits_recommandes_tags_climat: ['polyvalent'],
    gabarit_poids_recommande: { poids_total_kg: 10, justification: 'Kit polyvalent adapté à la destination' },
    pays_similaires: [],
    faq: [{ question: 'Comment préparer mon voyage ?', reponse: 'Consultez notre configurateur IA pour un kit personnalisé selon votre destination.' }],
    meta: { genere_le: new Date().toISOString(), cache_valide_jusqu_au: new Date(Date.now() + 86400000).toISOString() },
  } as CountryDataV2;
}

// ─── STYLE MAPS ───────────────────────────────────────────────────────────

const niveauMeteo = {
  ideal: { dot: '#059669', text: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.2)', label: 'Idéal' },
  bon: { dot: '#10b981', text: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', label: 'Bon' },
  moyen: { dot: '#D97706', text: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)', label: 'Moyen' },
  deconseille: { dot: '#DC2626', text: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)', label: 'Déconseillé' },
};

const niveauSecurite = {
  sur: { color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.2)', label: 'Sûr', icon: '✅' },
  vigilance: { color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)', label: 'Vigilance', icon: '⚠️' },
  deconseille_sauf_raison_imperative: { color: '#EA580C', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.2)', label: 'Déconseillé sauf raison impérative', icon: '🔶' },
  formellement_deconseille: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)', label: 'Formellement déconseillé', icon: '🚫' },
};

const affluenceStyle = {
  faible: { color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  moyenne: { color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
  forte: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
};

const prixVolStyle = {
  bas: { color: '#059669', label: 'Prix bas' },
  moyen: { color: '#D97706', label: 'Prix moyens' },
  haut: { color: '#DC2626', label: 'Prix élevés' },
};

function formatPrice(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} €`;
}

// ─── SKELETON ─────────────────────────────────────────────────────────────

function SkeletonCountry() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex gap-6">
        <div className="w-20 h-20 bg-[#E8E4DA] rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-[#E8E4DA] rounded w-24" />
          <div className="h-8 bg-[#E8E4DA] rounded w-48" />
          <div className="h-4 bg-[#E8E4DA] rounded w-64" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-[#E8E4DA] rounded-xl" />)}
      </div>
      <div className="h-12 bg-[#E8E4DA] rounded-xl" />
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

export default function CountryPage({ code: rawCode }: { code: string }) {
  const code = rawCode.toLowerCase();
  const [country, setCountry] = useState<CountryDataV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('apercu');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/pays/${code}?v=2`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        const data = json.data;
        if (!data || !data.pays || !data.meteo || !Array.isArray(data.meteo?.calendrier_12_mois) || !data.securite || !data.pratique) {
          throw new Error('Format de données invalide. Veuillez réessayer.');
        }
        setCountry(data as CountryDataV2);
      })
      .catch(() => {
        setCountry(buildFallbackCountry(code));
      })
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
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />
      <main id="main-content">

        {/* ── HERO — fond vert foncé ── */}
        <section style={{ background: '#1C2620', paddingTop: '80px', paddingBottom: '0' }} className="relative overflow-hidden">
          {/* Grain */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '128px' }} />

          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 pt-8">
            {/* Breadcrumb */}
            <nav aria-label="Fil d'Ariane" className="mb-8">
              <ol className="flex items-center gap-2" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'rgba(231,227,214,0.35)', letterSpacing: '0.08em' }}>
                <li><Link href="/" className="hover:text-white/70 transition-colors">Accueil</Link></li>
                <li style={{ color: 'rgba(231,227,214,0.15)' }}>›</li>
                <li><Link href="/pays" className="hover:text-white/70 transition-colors">Pays</Link></li>
                <li style={{ color: 'rgba(231,227,214,0.15)' }}>›</li>
                <li style={{ color: 'rgba(231,227,214,0.6)' }}>{country?.pays.nom || code.toUpperCase()}</li>
              </ol>
            </nav>

            {loading ? (
              <div className="pb-10"><SkeletonCountry /></div>
            ) : error ? (
              <div className="text-center py-16 pb-10">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Icon name="ExclamationTriangleIcon" size={28} variant="outline" className="text-red-400" />
                </div>
                <p className="text-red-400 mb-2 font-semibold">Données indisponibles</p>
                <p className="text-white/40 text-sm mb-6">{error}</p>
              </div>
            ) : country ? (
              <>
                {/* Eyebrow */}
                <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#E4501C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '16px' }}>
                  · {country.pays.continent}
                </p>

                {/* Country header */}
                <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <span className="text-7xl" role="img" aria-label={`Drapeau ${country.pays.nom}`}>
                      {getFlagEmoji(code)}
                    </span>
                    <div>
                      <h1 className="font-bold text-4xl sm:text-5xl text-white tracking-tight mb-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                        {country.pays.nom}
                      </h1>
                      <div className="flex flex-wrap gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                      <p className="text-xs mb-1 font-mono text-right" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>Niveau sécurité</p>
                      <div
                        className="px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{
                          background: niveauSecurite[worstSecZone.niveau].bg,
                          border: `1px solid ${niveauSecurite[worstSecZone.niveau].border}`,
                          color: niveauSecurite[worstSecZone.niveau].color,
                        }}
                      >
                        {niveauSecurite[worstSecZone.niveau].icon} {niveauSecurite[worstSecZone.niveau].label}
                      </div>
                      <p className="text-[10px] mt-1 text-right font-mono" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)' }}>
                        Source : {country.securite.source_officielle.nom}
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                  {[
                    { label: `Visa (${country.pratique.visa.nationalite})`, value: country.pratique.visa.duree_sejour_sans_visa || '—', color: 'rgba(255,255,255,0.9)' },
                    { label: 'Meilleure période', value: bestMonths.length > 0 ? `${bestMonths[0].mois.slice(0, 3)}–${bestMonths[bestMonths.length - 1].mois.slice(0, 3)}` : 'Variable', color: '#6B9B5E' },
                    { label: 'CO₂ aller-retour', value: `~${country.carbone.vol_paris_kg_co2_estime.toLocaleString('fr-FR')} kg`, color: 'rgba(255,255,255,0.9)' },
                    { label: 'Budget/jour (moyen)', value: formatPrice(country.pratique.budget_quotidien_repere_eur.moyen.logement + country.pratique.budget_quotidien_repere_eur.moyen.nourriture + country.pratique.budget_quotidien_repere_eur.moyen.transport), color: 'rgba(255,255,255,0.9)' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)' }}>{stat.label}</p>
                      <p className="text-sm font-semibold" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Tab navigation */}
                <div className="flex gap-0 overflow-x-auto -mx-5 sm:-mx-8 lg:-mx-12 xl:-mx-16 px-5 sm:px-8 lg:px-12 xl:px-16" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} role="tablist" aria-label="Sections du pays">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-all -mt-px focus-visible:outline-none"
                      style={{
                        borderTop: activeTab === tab.id ? '2px solid #E7E3D6' : '2px solid transparent',
                        color: activeTab === tab.id ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      <Icon name={tab.icon as never} size={13} variant={activeTab === tab.id ? 'solid' : 'outline'} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>

        {/* ── TAB CONTENT — fond crème ── */}
        {country && !loading && (
          <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 py-10">

            {/* ── APERÇU ── */}
            {activeTab === 'apercu' && (
              <div className="space-y-8">
                {/* Security overview */}
                <div>
                  <h2 className="font-bold text-xl text-[#1C2620] mb-4" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    Sécurité par zone
                  </h2>
                  <div className="space-y-3">
                    {country.securite.zones.map((z) => (
                      <Card key={z.nom_zone} style={{ padding: '16px', background: niveauSecurite[z.niveau].bg, border: `1px solid ${niveauSecurite[z.niveau].border}` }}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-[#1C2620] flex items-center gap-2">
                            <span>{niveauSecurite[z.niveau].icon}</span>
                            {z.nom_zone}
                          </p>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ color: niveauSecurite[z.niveau].color, background: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)' }}>
                            {niveauSecurite[z.niveau].label}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C6B5E]">{z.description}</p>
                      </Card>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#8A8578] mt-2 flex items-center gap-1">
                    <Icon name="ShieldCheckIcon" size={10} variant="outline" />
                    Source : <a href={country.securite.source_officielle.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#1C2620]">{country.securite.source_officielle.nom}</a>
                    {' '}— statut : <span className={country.securite.statut === 'verifie' ? 'text-emerald-600' : 'text-amber-600'}>{country.securite.statut}</span>
                  </p>
                </div>

                {/* Events */}
                {country.evenements.length > 0 && (
                  <div>
                    <h2 className="font-bold text-xl text-[#1C2620] mb-4" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                      Événements & saisons clés
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.evenements.map((ev) => (
                        <Card key={ev.nom} style={{ padding: '16px' }}>
                          <div className="flex gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-50 text-lg">🎉</div>
                            <div>
                              <p className="text-xs font-mono text-[#8A8578] mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{ev.periode}</p>
                              <p className="text-sm font-semibold text-[#1C2620]">{ev.nom}</p>
                              <p className="text-xs text-[#5C6B5E] mt-0.5">{ev.description}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top lieux preview */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-xl text-[#1C2620]" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Incontournables</h2>
                    <button onClick={() => setActiveTab('lieux')} className="text-xs text-[#E4501C] hover:underline">Voir tous →</button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {country.lieux_incontournables.slice(0, 3).map((lieu, i) => (
                      <Card key={lieu.nom} style={{ padding: '16px' }}>
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1C2620] flex items-center justify-center flex-shrink-0 font-mono text-white font-bold text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
                            {i + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-[#1C2620] mb-1" style={{ fontFamily: 'Georgia, serif' }}>{lieu.nom}</h3>
                            <p className="text-xs text-[#5C6B5E] line-clamp-2">{lieu.description}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Pays similaires */}
                {country.pays_similaires.length > 0 && (
                  <div>
                    <h2 className="font-bold text-xl text-[#1C2620] mb-4" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                      Destinations similaires
                    </h2>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {country.pays_similaires.map((p) => (
                        <Link key={p.code_iso} href={`/pays/${p.code_iso.toLowerCase()}`}>
                          <Card style={{ padding: '16px', transition: 'all 0.2s' }}>
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">{getFlagEmoji(p.code_iso)}</span>
                              <div>
                                <p className="text-sm font-semibold text-[#1C2620]">{p.nom}</p>
                                <p className="text-xs text-[#5C6B5E]">{p.raison}</p>
                              </div>
                            </div>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Coutumes */}
                {country.coutumes && (
                  <Card>
                    <h2 className="font-bold text-base text-[#1C2620] mb-2 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                      <span>🤝</span> Coutumes locales
                    </h2>
                    <p className="text-sm text-[#5C6B5E] leading-relaxed">{country.coutumes}</p>
                  </Card>
                )}

                {/* CTA */}
                <div style={{ background: '#1C2620', borderRadius: '16px', padding: '24px' }}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#E4501C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>· Kit sur mesure</p>
                      <h3 className="font-bold text-lg text-white mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                        Préparez votre voyage en {country.pays.nom}
                      </h3>
                      <p className="text-sm" style={{ color: 'rgba(231,227,214,0.5)' }}>
                        Notre IA configure votre kit idéal selon la saison, les activités et votre budget.
                      </p>
                    </div>
                    <Link href="/ai-configurator" className="flex-shrink-0 flex items-center gap-2 whitespace-nowrap font-semibold transition-all hover:opacity-90" style={{ background: '#E7E3D6', color: '#1C2620', borderRadius: '12px', padding: '12px 24px', fontSize: '14px' }}>
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
                  <h2 className="font-bold text-xl text-[#1C2620]" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Calendrier météo</h2>
                  <p className="text-xs text-[#8A8578] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Source : {country.meteo?.source}</p>
                </div>
                <p className="text-sm text-[#5C6B5E] mb-6">Températures, précipitations et affluence touristique pour {country.pays.nom}.</p>

                {!Array.isArray(country.meteo?.calendrier_12_mois) || country.meteo!.calendrier_12_mois.length === 0 ? (
                  <Card><p className="text-center text-[#8A8578] text-sm">Données météo indisponibles pour ce pays.</p></Card>
                ) : (
                  <>
                    {/* Month cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                      {country.meteo.calendrier_12_mois.map((m) => {
                        const style = niveauMeteo[m.niveau];
                        const aff = affluenceStyle[m.affluence];
                        return (
                          <div key={m.mois} className="rounded-xl p-3 text-center" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                            <p className="text-xs font-mono text-[#8A8578] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>{m.mois.slice(0, 3)}</p>
                            <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: style.dot }} aria-hidden="true" />
                            <p className="text-xs font-bold" style={{ color: style.text }}>{style.label}</p>
                            <p className="text-[11px] text-[#1C2620] font-semibold mt-1">{m.temp_min_c}° – {m.temp_max_c}°</p>
                            <p className="text-[10px] text-[#8A8578]">{m.precipitations_mm}mm</p>
                            <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full font-mono" style={{ color: aff.color, background: aff.bg, fontFamily: 'var(--font-mono)' }}>
                              {m.affluence}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Temperature bar chart */}
                    <Card style={{ marginBottom: '16px' }}>
                      <h3 className="font-semibold text-sm text-[#1C2620] mb-4">Températures max (°C)</h3>
                      <div className="flex items-end gap-2 h-24">
                        {country.meteo.calendrier_12_mois.map((m) => {
                          const maxTemp = Math.max(...country.meteo.calendrier_12_mois.map((x) => x.temp_max_c));
                          const heightPct = maxTemp > 0 ? Math.max(10, (m.temp_max_c / maxTemp) * 100) : 20;
                          const style = niveauMeteo[m.niveau];
                          return (
                            <div key={m.mois} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full rounded-t-sm" style={{ height: `${heightPct}%`, background: style.dot, opacity: 0.7 }} title={`${m.mois}: ${m.temp_min_c}°–${m.temp_max_c}°C`} />
                              <span className="text-[9px] text-[#8A8578] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{m.mois.slice(0, 3)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Precipitation bar chart */}
                    <Card style={{ marginBottom: '24px' }}>
                      <h3 className="font-semibold text-sm text-[#1C2620] mb-4">Précipitations (mm)</h3>
                      <div className="flex items-end gap-2 h-20">
                        {country.meteo.calendrier_12_mois.map((m) => {
                          const maxRain = Math.max(...country.meteo.calendrier_12_mois.map((x) => x.precipitations_mm));
                          const heightPct = maxRain > 0 ? Math.max(5, (m.precipitations_mm / maxRain) * 100) : 10;
                          return (
                            <div key={m.mois} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full rounded-t-sm" style={{ height: `${heightPct}%`, background: '#4A6741', opacity: 0.5 }} title={`${m.mois}: ${m.precipitations_mm}mm`} />
                              <span className="text-[9px] text-[#8A8578] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{m.mois.slice(0, 3)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-2">
                  {Object.entries(niveauMeteo).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-[#5C6B5E]">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: val.dot }} aria-hidden="true" />
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
                  <h2 className="font-bold text-xl text-[#1C2620] mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Sécurité</h2>
                  <p className="text-sm text-[#5C6B5E] mb-4">
                    Données basées sur <a href={country.securite.source_officielle.url} target="_blank" rel="noopener noreferrer" className="text-[#E4501C] underline">{country.securite.source_officielle.nom}</a>.
                    Statut : <span className={country.securite.statut === 'verifie' ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{country.securite.statut}</span>
                  </p>
                  {country.securite.statut === 'non_verifie' && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                      <p className="text-sm text-amber-600 flex items-center gap-2">
                        <Icon name="ExclamationTriangleIcon" size={16} variant="outline" />
                        Ces informations n&apos;ont pas pu être vérifiées. Consultez directement <a href={country.securite.source_officielle.url} target="_blank" rel="noopener noreferrer" className="underline">France Diplomatie</a>.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {country.securite.zones.map((z) => (
                      <Card key={z.nom_zone} style={{ padding: '20px', background: niveauSecurite[z.niveau].bg, border: `1px solid ${niveauSecurite[z.niveau].border}` }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-[#1C2620] flex items-center gap-2">
                            <span className="text-lg">{niveauSecurite[z.niveau].icon}</span>
                            {z.nom_zone}
                          </p>
                          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full" style={{ color: niveauSecurite[z.niveau].color, background: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>
                            {niveauSecurite[z.niveau].label}
                          </span>
                        </div>
                        <p className="text-sm text-[#5C6B5E] leading-relaxed">{z.description}</p>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Ambassade */}
                <Card>
                  <h3 className="font-bold text-base text-[#1C2620] mb-3 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    <Icon name="BuildingLibraryIcon" size={16} variant="outline" className="text-[#4A6741]" />
                    Ambassade / Consulat
                  </h3>
                  <p className="text-sm font-semibold text-[#1C2620] mb-1">{country.securite.ambassade_consulat.nom}</p>
                  {country.securite.ambassade_consulat.telephone && (
                    <p className="text-sm text-[#5C6B5E] flex items-center gap-2 mb-1">
                      <Icon name="PhoneIcon" size={12} variant="outline" />
                      {country.securite.ambassade_consulat.telephone}
                    </p>
                  )}
                  {country.securite.ambassade_consulat.url && (
                    <a href={country.securite.ambassade_consulat.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#E4501C] underline">
                      Site officiel →
                    </a>
                  )}
                </Card>

                <p className="text-[11px] text-[#8A8578] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                  Dernière synchronisation : {country.securite.derniere_synchronisation}
                </p>
              </div>
            )}

            {/* ── SANTÉ ── */}
            {activeTab === 'sante' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-bold text-xl text-[#1C2620] mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Santé</h2>
                  <p className="text-sm text-[#5C6B5E] mb-4">
                    Source : {country.sante.source} — Statut : <span className={country.sante.statut === 'verifie' ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>{country.sante.statut}</span>
                  </p>
                  {country.sante.statut === 'non_verifie' && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                      <p className="text-sm text-amber-600 flex items-center gap-2">
                        <Icon name="ExclamationTriangleIcon" size={16} variant="outline" />
                        Consultez un médecin du voyage ou le site de l&apos;Institut Pasteur avant votre départ.
                      </p>
                    </div>
                  )}
                </div>

                {/* Eau potable */}
                <Card style={{ padding: '16px', background: country.sante.eau_potable === 'oui' ? 'rgba(5,150,105,0.06)' : country.sante.eau_potable === 'non' ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)', border: `1px solid ${country.sante.eau_potable === 'oui' ? 'rgba(5,150,105,0.2)' : country.sante.eau_potable === 'non' ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)'}` }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{country.sante.eau_potable === 'oui' ? '💧' : country.sante.eau_potable === 'non' ? '🚱' : '⚠️'}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#1C2620]">Eau du robinet</p>
                      <p className="text-sm font-bold" style={{ color: country.sante.eau_potable === 'oui' ? '#059669' : country.sante.eau_potable === 'non' ? '#DC2626' : '#D97706' }}>
                        {country.sante.eau_potable === 'oui' ? 'Potable' : country.sante.eau_potable === 'non' ? 'Non potable' : country.sante.eau_potable === 'a_traiter' ? 'À traiter avant consommation' : 'Non vérifié'}
                      </p>
                    </div>
                  </div>
                </Card>

                {country.sante.risques.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-[#1C2620] mb-3" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Risques sanitaires</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {country.sante.risques.map((r) => (
                        <Card key={r} style={{ padding: '12px' }}>
                          <div className="flex items-center gap-2">
                            <Icon name="ExclamationCircleIcon" size={14} variant="outline" className="text-amber-500 flex-shrink-0" />
                            <p className="text-sm text-[#1C2620]">{r}</p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {country.sante.vaccins_recommandes.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-[#1C2620] mb-3" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Vaccins recommandés</h3>
                    <div className="flex flex-wrap gap-2">
                      {country.sante.vaccins_recommandes.map((v) => (
                        <span key={v} className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                          💉 {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {country.sante.vaccins_obligatoires.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-[#1C2620] mb-3" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Vaccins obligatoires</h3>
                    <div className="flex flex-wrap gap-2">
                      {country.sante.vaccins_obligatoires.map((v) => (
                        <span key={v} className="px-3 py-1.5 rounded-full text-sm font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
                          ⚠️ {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-[#8A8578] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                  Dernière mise à jour : {country.sante.derniere_maj}
                </p>
              </div>
            )}

            {/* ── PRATIQUE ── */}
            {activeTab === 'pratique' && (
              <div className="space-y-8">
                <h2 className="font-bold text-xl text-[#1C2620]" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Informations pratiques</h2>

                {/* Visa */}
                <Card>
                  <h3 className="font-bold text-base text-[#1C2620] mb-3 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    <Icon name="IdentificationIcon" size={16} variant="outline" className="text-[#4A6741]" />
                    Visa — {country.pratique.visa.nationalite}
                  </h3>
                  <p className="text-sm text-[#1C2620] mb-2">{country.pratique.visa.regle}</p>
                  <p className="text-sm font-semibold text-emerald-600">{country.pratique.visa.duree_sejour_sans_visa}</p>
                </Card>

                {/* Grid infos */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { icon: 'CurrencyEuroIcon', label: 'Monnaie', value: country.pratique.monnaie },
                    { icon: 'BoltIcon', label: 'Prises électriques', value: `${country.pratique.prise_electrique.type} — ${country.pratique.prise_electrique.voltage}` },
                    { icon: 'ClockIcon', label: 'Décalage horaire', value: country.pratique.decalage_horaire_utc },
                    { icon: 'SignalIcon', label: 'Connectivité', value: `${country.connectivite.couverture_mobile} — ${country.connectivite.wifi_disponibilite}` },
                  ].map(item => (
                    <Card key={item.label} style={{ padding: '16px' }}>
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F5F2EC] flex items-center justify-center flex-shrink-0">
                          <Icon name={item.icon} size={18} variant="outline" className="text-[#4A6741]" />
                        </div>
                        <div>
                          <p className="text-xs font-mono text-[#8A8578] mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{item.label}</p>
                          <p className="text-sm text-[#1C2620]">{item.value}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Budget */}
                <div>
                  <h3 className="font-bold text-base text-[#1C2620] mb-4" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Budget quotidien de référence (EUR)</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {(['petit', 'moyen', 'gros'] as const).map((tier) => {
                      const b = country.pratique.budget_quotidien_repere_eur[tier];
                      const total = b.logement + b.nourriture + b.transport;
                      const tierLabel = { petit: '🎒 Petit budget', moyen: '🏨 Budget moyen', gros: '✨ Confort' }[tier];
                      const tierColor = { petit: '#059669', moyen: '#D97706', gros: '#8B5CF6' }[tier];
                      return (
                        <Card key={tier}>
                          <p className="text-sm font-bold mb-3" style={{ color: tierColor }}>{tierLabel}</p>
                          <div className="space-y-2 text-xs text-[#5C6B5E]">
                            <div className="flex justify-between"><span>Logement</span><span className="text-[#1C2620] font-medium">{formatPrice(b.logement)}</span></div>
                            <div className="flex justify-between"><span>Nourriture</span><span className="text-[#1C2620] font-medium">{formatPrice(b.nourriture)}</span></div>
                            <div className="flex justify-between"><span>Transport</span><span className="text-[#1C2620] font-medium">{formatPrice(b.transport)}</span></div>
                          </div>
                          <div className="border-t border-[#E8E4DA] mt-3 pt-3 flex justify-between">
                            <span className="text-xs text-[#5C6B5E]">Total/jour</span>
                            <span className="text-base font-bold" style={{ color: tierColor }}>{formatPrice(total)}</span>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Phrases de survie */}
                {country.pratique.phrases_survie.length > 0 && (
                  <div>
                    <h3 className="font-bold text-base text-[#1C2620] mb-4" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Phrases de survie</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.pratique.phrases_survie.map((p) => (
                        <Card key={p.fr} style={{ padding: '12px' }}>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="text-xs text-[#8A8578]">{p.fr}</p>
                              <p className="text-sm font-semibold text-[#1C2620] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{p.locale}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gabarit poids */}
                <Card>
                  <h3 className="font-bold text-base text-[#1C2620] mb-2 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    <Icon name="ScaleIcon" size={16} variant="outline" className="text-[#4A6741]" />
                    Gabarit poids recommandé
                  </h3>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-3xl font-bold text-[#1C2620]" style={{ fontFamily: 'Georgia, serif' }}>
                      {country.gabarit_poids_recommande.poids_total_kg} kg
                    </span>
                    <WeightGauge weightG={country.gabarit_poids_recommande.poids_total_kg * 1000} maxG={20000} />
                  </div>
                  <p className="text-xs text-[#5C6B5E]">{country.gabarit_poids_recommande.justification}</p>
                </Card>
              </div>
            )}

            {/* ── VOLS & CO₂ ── */}
            {activeTab === 'vols' && (
              <div className="space-y-6">
                <h2 className="font-bold text-xl text-[#1C2620]" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Vols & Empreinte carbone</h2>

                <div className="rounded-xl p-4" style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <p className="text-sm text-amber-600 flex items-start gap-2">
                    <Icon name="InformationCircleIcon" size={16} variant="outline" className="flex-shrink-0 mt-0.5" />
                    <span>Les tendances de prix sont <strong>indicatives</strong>. Les prix réels varient en continu. Utilisez un comparateur de vols en temps réel pour obtenir un prix précis.</span>
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-base text-[#1C2620] mb-4" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Tendances de prix par saison</h3>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {country.vols.tendance_par_saison.map((t) => {
                      const style = prixVolStyle[t.niveau_prix];
                      return (
                        <Card key={t.periode} style={{ padding: '16px', textAlign: 'center' }}>
                          <p className="text-xs text-[#8A8578] mb-2">{t.periode}</p>
                          <p className="text-lg font-bold" style={{ color: style.color }}>{style.label}</p>
                          <div className="flex justify-center gap-1 mt-2">
                            {['bas', 'moyen', 'haut'].map((level) => (
                              <div key={level} className="w-6 h-2 rounded-full" style={{ background: t.niveau_prix === level ? (level === 'bas' ? '#059669' : level === 'moyen' ? '#D97706' : '#DC2626') : '#E8E4DA' }} />
                            ))}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <Card>
                  <h3 className="font-bold text-base text-[#1C2620] mb-4 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    🌱 Empreinte carbone — Paris ↔ {country.pays.nom}
                  </h3>
                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      <p className="text-xs text-[#8A8578] mb-1">Aller-retour estimé</p>
                      <p className="text-4xl font-bold text-[#1C2620]" style={{ fontFamily: 'Georgia, serif' }}>
                        ~{country.carbone.vol_paris_kg_co2_estime.toLocaleString('fr-FR')}
                        <span className="text-lg text-[#8A8578] ml-1">kg CO₂</span>
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 bg-[#F5F2EC] rounded-full overflow-hidden border border-[#E8E4DA]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, (country.carbone.vol_paris_kg_co2_estime / 5000) * 100)}%`, background: 'linear-gradient(90deg, #059669, #DC2626)' }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#8A8578] mt-1">
                        <span>0 kg</span><span>5 000 kg</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: '#F5F2EC', border: '1px solid #E8E4DA' }}>
                    <p className="text-xs text-[#5C6B5E]">
                      <span className="font-semibold text-[#1C2620]">Méthodologie :</span> {country.carbone.methodologie}
                    </p>
                    <p className="text-[10px] text-[#8A8578] mt-1 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                      Statut : {country.carbone.statut} — Cette valeur est une estimation, pas une mesure exacte.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {/* ── LIEUX ── */}
            {activeTab === 'lieux' && (
              <div>
                <h2 className="font-bold text-xl text-[#1C2620] mb-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Lieux incontournables</h2>
                <p className="text-sm text-[#5C6B5E] mb-6">Les sites et expériences à ne pas manquer en {country.pays.nom}.</p>
                <div className="space-y-4">
                  {country.lieux_incontournables.map((lieu, i) => (
                    <Card key={lieu.nom} style={{ padding: '20px' }}>
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#1C2620] flex items-center justify-center flex-shrink-0 font-mono text-white font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-[#1C2620] mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>{lieu.nom}</h3>
                          <p className="text-sm text-[#5C6B5E] leading-relaxed">{lieu.description}</p>
                          {lieu.lat !== 0 && lieu.lng !== 0 && (
                            <p className="text-[10px] text-[#8A8578] mt-1 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                              {lieu.lat.toFixed(4)}°, {lieu.lng.toFixed(4)}°
                            </p>
                          )}
                        </div>
                        <Icon name="MapPinIcon" size={16} variant="outline" className="text-[#8A8578] flex-shrink-0 mt-1" />
                      </div>
                    </Card>
                  ))}
                </div>

                {country.evenements.length > 0 && (
                  <>
                    <h3 className="font-bold text-lg text-[#1C2620] mt-10 mb-4" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Événements & saisons</h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {country.evenements.map((ev) => (
                        <Card key={ev.nom} style={{ padding: '16px' }}>
                          <div className="flex gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-50 text-lg">🎉</div>
                            <div>
                              <p className="text-xs font-mono text-[#8A8578] mb-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{ev.periode}</p>
                              <p className="text-sm font-semibold text-[#1C2620]">{ev.nom}</p>
                              <p className="text-xs text-[#5C6B5E] mt-0.5">{ev.description}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── FAQ ── */}
            {activeTab === 'faq' && (
              <div>
                <h2 className="font-bold text-xl text-[#1C2620] mb-2" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>Questions fréquentes</h2>
                <p className="text-sm text-[#5C6B5E] mb-6">Réponses basées sur les données réelles de cette fiche pays.</p>
                <div className="space-y-3">
                  {country.faq.map((item, i) => (
                    <Card key={i} style={{ padding: '0', overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-[#F5F2EC] transition-colors"
                        aria-expanded={openFaq === i}
                      >
                        <p className="text-sm font-semibold text-[#1C2620]">{item.question}</p>
                        <Icon
                          name={openFaq === i ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                          size={16}
                          variant="outline"
                          className="text-[#8A8578] flex-shrink-0"
                        />
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4 border-t border-[#E8E4DA]">
                          <p className="text-sm text-[#5C6B5E] leading-relaxed pt-3">{item.reponse}</p>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8" style={{ background: '#1C2620', borderRadius: '16px', padding: '24px' }}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <p style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#E4501C', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px' }}>· Kit sur mesure</p>
                      <h3 className="font-bold text-lg text-white mb-1" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                        Kit personnalisé pour {country.pays.nom}
                      </h3>
                      <p className="text-sm" style={{ color: 'rgba(231,227,214,0.5)' }}>
                        Notre IA analyse la météo, les activités et votre budget pour créer votre kit sur mesure.
                      </p>
                    </div>
                    <Link href="/ai-configurator" className="flex-shrink-0 flex items-center gap-2 whitespace-nowrap font-semibold transition-all hover:opacity-90" style={{ background: '#E7E3D6', color: '#1C2620', borderRadius: '12px', padding: '12px 24px', fontSize: '14px' }}>
                      <Icon name="SparklesIcon" size={16} variant="outline" />
                      Configurer mon kit IA
                    </Link>
                  </div>
                </div>
              </div>
            )}

          </section>
        )}

      </main>
      <NewFooterSection />
    </div>
  );
}
