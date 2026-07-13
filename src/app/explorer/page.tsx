'use client';

import React, { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

type Tab = 'pays' | 'guides' | 'outils' | 'carbone' | 'copilote';

const TABS: {id: Tab;label: string;icon: string;}[] = [
{ id: 'pays', label: 'Destinations', icon: 'GlobeAltIcon' },
{ id: 'guides', label: 'Guides terrain', icon: 'BookOpenIcon' },
{ id: 'outils', label: 'Outils', icon: 'WrenchScrewdriverIcon' },
{ id: 'carbone', label: 'Empreinte carbone', icon: 'LeafIcon' },
{ id: 'copilote', label: 'Copilote IA', icon: 'ChatBubbleLeftRightIcon' }];


// ─── Pays data ────────────────────────────────────────────────────────────────
const COUNTRIES = [
{ code: 'IS', nom: 'Islande', continent: 'Europe', meilleure_saison: 'Juin–Août', danger: 'low', image: 'https://images.unsplash.com/photo-1512426793469-f51e8a5c3674', alt: 'Paysage volcanique islandais avec cascade et aurores boréales', tags: ['Randonnée', 'Nature', 'Volcans'] },
{ code: 'NP', nom: 'Népal', continent: 'Asie', meilleure_saison: 'Oct–Nov', danger: 'medium', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e2f8eab4-1772668312120.png', alt: 'Vue sur sommets himalayens depuis sentier de trek au Népal', tags: ['Trekking', 'Himalaya', 'Altitude'] },
{ code: 'PE', nom: 'Pérou', continent: 'Amérique du Sud', meilleure_saison: 'Mai–Sep', danger: 'medium', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1aaabd3c9-1772251085820.png', alt: 'Ruines du Machu Picchu au lever du soleil avec brume matinale', tags: ['Randonnée', 'Culture', 'Altitude'] },
{ code: 'NO', nom: 'Norvège', continent: 'Europe', meilleure_saison: 'Juin–Sep', danger: 'low', image: 'https://images.unsplash.com/photo-1548098082-dbae6a9026e3', alt: 'Fjord norvégien avec montagnes enneigées et village coloré', tags: ['Fjords', 'Randonnée', 'Ski'] },
{ code: 'MA', nom: 'Maroc', continent: 'Afrique', meilleure_saison: 'Mar–Mai', danger: 'low', image: "https://images.unsplash.com/photo-1586012350366-1eea1beb846e", alt: 'Dunes de sable du Sahara marocain au coucher du soleil', tags: ['Désert', 'Trek', 'Culture'] },
{ code: 'NZ', nom: 'Nouvelle-Zélande', continent: 'Océanie', meilleure_saison: 'Nov–Mar', danger: 'low', image: 'https://images.unsplash.com/photo-1720414285378-955b9e0def0c', alt: 'Paysage verdoyant de Nouvelle-Zélande avec moutons et montagnes', tags: ['Randonnée', 'Nature', 'Aventure'] },
{ code: 'CL', nom: 'Chili', continent: 'Amérique du Sud', meilleure_saison: 'Nov–Mar', danger: 'low', image: 'https://img.rocket.new/generatedImages/rocket_gen_img_111dda823-1772161176360.png', alt: 'Torres del Paine au Chili avec lac turquoise et ciel dramatique', tags: ['Patagonie', 'Trek', 'Nature'] },
{ code: 'JP', nom: 'Japon', continent: 'Asie', meilleure_saison: 'Mar–Mai', danger: 'low', image: 'https://images.unsplash.com/photo-1713376051619-71aca5aaa2ac', alt: 'Mont Fuji enneigé avec cerisiers en fleurs au premier plan', tags: ['Culture', 'Randonnée', 'Montagne'] }];


const DANGER_CFG: Record<string, {label: string;color: string;}> = {
  low: { label: 'Sûr', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  medium: { label: 'Vigilance', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  high: { label: 'Risqué', color: 'text-red-600 bg-red-50 border-red-200' }
};

// ─── Guides data ──────────────────────────────────────────────────────────────
const GUIDES = [
{ id: 'g1', title: 'Préparer un trek en haute altitude', category: 'Santé', readTime: 8, image: "https://img.rocket.new/generatedImages/rocket_gen_img_154b5bc61-1768404553520.png", alt: 'Randonneur sur sentier himalayan avec vue Annapurna', excerpt: 'Acclimatation, mal des montagnes, médicaments essentiels et protocoles de descente d\'urgence.' },
{ id: 'g2', title: 'Choisir sa tente selon le terrain', category: 'Équipement', readTime: 6, image: "https://images.unsplash.com/photo-1722607731217-31b4aee4b2d4", alt: 'Tente de randonnée orange installée dans un pré alpin', excerpt: 'Tente 3 saisons vs 4 saisons, double toit, résistance au vent — guide complet.' },
{ id: 'g3', title: 'Filtration de l\'eau en randonnée', category: 'Survie', readTime: 5, image: "https://images.unsplash.com/photo-1686002747034-0a9b8cca2f5a", alt: 'Randonneur filtrant de l\'eau de rivière en forêt', excerpt: 'Filtres, purificateurs UV, pastilles — comparatif complet pour chaque situation.' },
{ id: 'g4', title: 'Vanlife : aménager son van en 30 jours', category: 'Vanlife', readTime: 12, image: "https://images.unsplash.com/photo-1666096075666-d1cf98f8aaf3", alt: 'Intérieur de van aménagé avec lit et cuisine compacte', excerpt: 'Isolation, électricité solaire, cuisine, stockage — le guide complet de l\'aménagement.' },
{ id: 'g5', title: 'Sécurité en solo : les règles d\'or', category: 'Sécurité', readTime: 7, image: "https://images.unsplash.com/photo-1701940825626-aa3a6f7a0a82", alt: 'Randonneur seul sur crête montagneuse au coucher du soleil', excerpt: 'Communication, check-in régulier, équipement de signalisation et protocoles d\'urgence.' },
{ id: 'g6', title: 'Réduire son empreinte carbone en voyage', category: 'Éco', readTime: 6, image: "https://img.rocket.new/generatedImages/rocket_gen_img_1f343a899-1783706310531.png", alt: 'Paysage naturel préservé avec randonneur respectueux', excerpt: 'Transport, hébergement, alimentation — calculer et compenser son impact.' }];


// ─── Outils data ──────────────────────────────────────────────────────────────
const TOOLS = [
{ slug: 'poids-sac', nom: 'Calculateur de poids', icon: '⚖️', categorie: 'Préparation', offline: true, desc: 'Pesez votre sac par catégorie avec jauge visuelle.' },
{ slug: 'budget-voyage', nom: 'Budget voyage', icon: '💰', categorie: 'Préparation', offline: true, desc: 'Planifiez votre budget par jour et par poste.' },
{ slug: 'convertisseur', nom: 'Convertisseur universel', icon: '🔄', categorie: 'Terrain', offline: true, desc: 'Distances, poids, températures et devises.' },
{ slug: 'checklist', nom: 'Checklist interactive', icon: '✅', categorie: 'Préparation', offline: false, desc: 'Créez et personnalisez vos listes de voyage.' },
{ slug: 'fuseaux', nom: 'Fuseaux horaires', icon: '🕐', categorie: 'Terrain', offline: true, desc: 'Comparez les heures entre destinations.' },
{ slug: 'boussole', nom: 'Boussole & Niveau', icon: '🧭', categorie: 'Terrain', offline: true, desc: 'Boussole digitale et niveau à bulle.' },
{ slug: 'tailles', nom: 'Convertisseur de tailles', icon: '👟', categorie: 'Shopping', offline: true, desc: 'Vêtements et chaussures FR/UK/US/EU.' },
{ slug: 'meteo', nom: 'Météo montagne', icon: '🌤️', categorie: 'Terrain', offline: false, desc: 'Prévisions spécialisées altitude et terrain.' }];


// ─── Carbone data ─────────────────────────────────────────────────────────────
const TRANSPORT_OPTIONS = [
{ id: 't1', label: 'Vol long-courrier (>6h)', icon: '✈️', kgCO2per100km: 25.5 },
{ id: 't2', label: 'Vol moyen-courrier (2-6h)', icon: '✈️', kgCO2per100km: 18.2 },
{ id: 't3', label: 'Train', icon: '🚂', kgCO2per100km: 0.4 },
{ id: 't4', label: 'Voiture solo', icon: '🚗', kgCO2per100km: 21.0 },
{ id: 't5', label: 'Bus longue distance', icon: '🚌', kgCO2per100km: 2.7 }];


// ─── Tab components ───────────────────────────────────────────────────────────
function PaysTab() {
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('Tous');
  const continents = ['Tous', 'Europe', 'Asie', 'Afrique', 'Amérique du Sud', 'Océanie'];
  const filtered = useMemo(() => COUNTRIES.filter((c) => {
    const ms = c.nom.toLowerCase().includes(search.toLowerCase()) || c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const mc = continent === 'Tous' || c.continent === continent;
    return ms && mc;
  }), [search, continent]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une destination..." className="w-full pl-9 pr-4 py-2.5 bg-[#EDEAE0] border border-[#C8C3B0] rounded-xl text-sm focus:outline-none focus:border-[#E4501C]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {continents.map((c) =>
          <button key={c} onClick={() => setContinent(c)} className={`px-3 py-2 rounded-xl text-xs font-600 whitespace-nowrap transition-all ${continent === c ? 'bg-[#1C2620] text-white' : 'bg-[#EDEAE0] border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30'}`}>{c}</button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered.map((c) => {
          const danger = DANGER_CFG[c.danger];
          return (
            <Link key={c.code} href={`/pays/${c.code.toLowerCase()}`} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden group hover:border-[#1C2620]/30 transition-all">
              <div className="relative h-32 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt={c.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="font-display font-700 text-white text-sm">{c.nom}</p>
                  <p className="text-white/70 text-[10px]">{c.continent}</p>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${danger.color}`}>{danger.label}</span>
                  <span className="text-[10px] text-[#5C6B5E]">{c.meilleure_saison}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.tags.slice(0, 2).map((t) => <span key={t} className="text-[9px] bg-[#E7E3D6] text-[#5C6B5E] px-1.5 py-0.5 rounded-full">{t}</span>)}
                </div>
              </div>
            </Link>);

        })}
      </div>
      <div className="text-center">
        <Link href="/pays" className="inline-flex items-center gap-2 px-6 py-3 border border-[#C8C3B0] rounded-xl text-sm font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all">
          Voir toutes les destinations <Icon name="ArrowRightIcon" size={14} />
        </Link>
      </div>
    </div>);

}

function GuidesTab() {
  const categories = ['Tous', 'Santé', 'Équipement', 'Survie', 'Sécurité', 'Vanlife', 'Éco'];
  const [cat, setCat] = useState('Tous');
  const filtered = GUIDES.filter((g) => cat === 'Tous' || g.category === cat);
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) =>
        <button key={c} onClick={() => setCat(c)} className={`px-3 py-2 rounded-xl text-xs font-600 whitespace-nowrap transition-all ${cat === c ? 'bg-[#1C2620] text-white' : 'bg-[#EDEAE0] border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30'}`}>{c}</button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((g) =>
        <div key={g.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden flex">
            <div className="w-28 flex-shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.image} alt={g.alt} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] bg-[#E4501C]/10 text-[#E4501C] border border-[#E4501C]/20 px-2 py-0.5 rounded-full font-600">{g.category}</span>
                <span className="text-[10px] text-[#5C6B5E]">{g.readTime} min</span>
              </div>
              <h3 className="font-600 text-sm text-[#1C2620] mb-1 line-clamp-2">{g.title}</h3>
              <p className="text-xs text-[#5C6B5E] line-clamp-2">{g.excerpt}</p>
              <Link href="/guides" className="text-xs text-[#E4501C] font-600 mt-2 inline-block hover:underline">Lire →</Link>
            </div>
          </div>
        )}
      </div>
    </div>);

}

function OutilsTab() {
  const categories = ['Tous', 'Préparation', 'Terrain', 'Shopping'];
  const [cat, setCat] = useState('Tous');
  const filtered = TOOLS.filter((t) => cat === 'Tous' || t.categorie === cat);
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) =>
        <button key={c} onClick={() => setCat(c)} className={`px-3 py-2 rounded-xl text-xs font-600 whitespace-nowrap transition-all ${cat === c ? 'bg-[#1C2620] text-white' : 'bg-[#EDEAE0] border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30'}`}>{c}</button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered.map((t) =>
        <Link key={t.slug} href={`/outils/${t.slug}`} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:border-[#1C2620]/30 transition-all group">
            <span className="text-3xl block mb-3">{t.icon}</span>
            <h3 className="font-600 text-sm text-[#1C2620] mb-1">{t.nom}</h3>
            <p className="text-xs text-[#5C6B5E] mb-3 line-clamp-2">{t.desc}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#E7E3D6] text-[#5C6B5E] px-2 py-0.5 rounded-full">{t.categorie}</span>
              {t.offline && <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">Hors ligne</span>}
            </div>
          </Link>
        )}
      </div>
    </div>);

}

function CarboneTab() {
  const [transport, setTransport] = useState('t1');
  const [distance, setDistance] = useState(5000);
  const [passengers, setPassengers] = useState(1);
  const selected = TRANSPORT_OPTIONS.find((t) => t.id === transport)!;
  const totalKg = selected ? selected.kgCO2per100km * distance / 100 / passengers : 0;
  const trees = Math.ceil(totalKg / 21);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Calculateur d&apos;empreinte carbone</h2>
        <p className="text-xs text-[#5C6B5E] mt-0.5">Estimez l&apos;impact de votre voyage et compensez</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-2">Mode de transport</label>
            <div className="space-y-2">
              {TRANSPORT_OPTIONS.map((t) =>
              <button key={t.id} onClick={() => setTransport(t.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${transport === t.id ? 'bg-[#1C2620] text-white' : 'bg-[#E7E3D6] text-[#5C6B5E] hover:text-[#1C2620]'}`}>
                  <span>{t.icon}</span>{t.label}
                  <span className="ml-auto text-xs opacity-60">{t.kgCO2per100km} kg/100km</span>
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-2">Distance (km) : {distance.toLocaleString()}</label>
            <input type="range" min={100} max={20000} step={100} value={distance} onChange={(e) => setDistance(Number(e.target.value))} className="w-full accent-[#E4501C]" />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-wider mb-2">Passagers : {passengers}</label>
            <input type="range" min={1} max={5} step={1} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="w-full accent-[#E4501C]" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-[#1C2620] rounded-2xl p-5">
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider mb-3">Votre empreinte</p>
            <p className="font-display font-800 text-white text-4xl">{totalKg.toFixed(0)} <span className="text-lg font-400 text-white/60">kg CO₂</span></p>
            <p className="text-white/40 text-xs mt-2">Équivalent à {trees} arbres à planter pour compenser</p>
          </div>
          <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
            <p className="font-600 text-sm text-[#1C2620] mb-3">Compenser votre impact</p>
            <div className="space-y-2">
              {[{ label: 'Reforestation Amazonie', price: Math.ceil(totalKg * 0.015), icon: '🌳' }, { label: 'Énergie solaire Afrique', price: Math.ceil(totalKg * 0.012), icon: '☀️' }, { label: 'Protection forêts tropicales', price: Math.ceil(totalKg * 0.018), icon: '🌿' }].map((opt) =>
              <div key={opt.label} className="flex items-center justify-between p-3 bg-[#E7E3D6] rounded-xl">
                  <span className="text-sm text-[#1C2620]">{opt.icon} {opt.label}</span>
                  <button className="btn-primary px-3 py-1.5 text-xs">{opt.price}€</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>);

}

function CopiloteTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Copilote IA</h2>
        <p className="text-xs text-[#5C6B5E] mt-0.5">Votre assistant voyage intelligent — planification, équipement, sécurité</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {[
        { icon: '🎒', title: 'Préparer mon kit', desc: 'Configurez votre équipement selon destination et activité' },
        { icon: '🗺️', title: 'Planifier mon itinéraire', desc: 'Suggestions d\'étapes, hébergements et points d\'intérêt' },
        { icon: '🛡️', title: 'Vérifier la sécurité', desc: 'Alertes, conseils aux voyageurs et contacts d\'urgence' }].
        map((s) =>
        <Link key={s.title} href="/copilote" className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-4 hover:border-[#1C2620]/30 transition-all">
            <span className="text-2xl block mb-2">{s.icon}</span>
            <p className="font-600 text-sm text-[#1C2620] mb-1">{s.title}</p>
            <p className="text-xs text-[#5C6B5E]">{s.desc}</p>
          </Link>
        )}
      </div>
      <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-[#E4501C]/20 flex items-center justify-center"><Icon name="SparklesIcon" size={16} className="text-[#E4501C]" /></div>
          <div>
            <p className="font-600 text-sm text-[#1C2620]">Copilote IA — Gemini</p>
            <p className="text-xs text-emerald-600">🟢 En ligne</p>
          </div>
        </div>
        <div className="bg-[#E7E3D6] rounded-xl p-4 mb-4 text-sm text-[#5C6B5E]">
          Bonjour ! Je suis votre copilote de voyage. Posez-moi une question sur votre prochain voyage, votre équipement ou une destination.
        </div>
        <div className="flex gap-2">
          <input className="flex-1 bg-[#E7E3D6] border border-[#C8C3B0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#E4501C]" placeholder="Ex: Que mettre dans mon sac pour le Népal en octobre ?" />
          <Link href="/copilote" className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1">
            <Icon name="PaperAirplaneIcon" size={14} /> Ouvrir
          </Link>
        </div>
      </div>
    </div>);

}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pays');

  const renderTab = () => {
    switch (activeTab) {
      case 'pays':return <PaysTab />;
      case 'guides':return <GuidesTab />;
      case 'outils':return <OutilsTab />;
      case 'carbone':return <CarboneTab />;
      case 'copilote':return <CopiloteTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#E7E3D6] text-[#1C2620]">
      <Header />

      <section className="bg-[#1C2620] pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-[10px] font-mono text-[#E4501C] tracking-[0.2em] uppercase mb-2">Explorer</p>
          <h1 className="font-display font-800 text-white text-2xl sm:text-3xl tracking-tight mb-2">
            Préparez votre prochain voyage
          </h1>
          <p className="text-white/50 text-sm max-w-xl mb-6">
            Destinations, guides terrain, outils de préparation, empreinte carbone et copilote IA — tout pour partir bien préparé.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/40 font-mono">
            <span>48 destinations</span>
            <span>·</span>
            <span>120+ guides</span>
            <span>·</span>
            <span>8 outils gratuits</span>
          </div>

          <div className="flex items-center gap-0.5 mt-8 overflow-x-auto pb-px scrollbar-hide">
            {TABS.map((tab) =>
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#E7E3D6] text-[#1C2620]' : 'text-white/50 hover:text-white hover:bg-white/8'}`}>
                <Icon name={tab.icon} size={14} variant="outline" />
                {tab.label}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTab()}
      </div>

      <Footer />
    </div>);

}