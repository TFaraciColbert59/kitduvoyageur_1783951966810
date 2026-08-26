'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import CompteBackground from '@/components/compte/CompteBackground';
import { createClient } from '@/lib/supabase/client';
import { CarnetKitItem, CarnetMoment } from '@/types/carnet';

export interface ChapterItem {
  id: string;
  num: string;
  title: string;
  lieu_depart?: string;
  lieu_arrivee?: string;
  distance_km?: number;
  denivele_m?: number;
  meteo?: string;
  hebergement_nom?: string;
  hebergement_type?: string;
  content: string;
}

export default function CreateCarnetView({ onCloseModal }: { onCloseModal?: () => void } = {}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Stepper state
  const [activeStep, setActiveStep] = useState<'general' | 'etapes' | 'moments' | 'sac' | 'tags'>('general');

  // Form State
  const [form, setForm] = useState({
    // 1. Général
    title: 'Trois jours sur les crêtes',
    subtitle: 'Chartreuse · 27 km à deux',
    destination: 'Massif de la Chartreuse',
    chapeau: '« On était deux, un thermos à moitié rempli, et la brume s’est levée au col de la Charmette. »',
    coverImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200',
    startDate: '2026-10-12',
    endDate: '2026-10-14',
    voyageurs: 2,
    difficulty: 'Modéré',
    weather: 'Ensoleillé & brumes matinales',
    avgTemp: '12',
    routeRating: 9,
    distance_km: 27.4,
    elevation_m: 1620,

    // 2. Étapes / Chapitres
    chapters: [
      {
        id: 'ch-1',
        num: 'I',
        title: 'Saint-Pierre → Charmant Som',
        lieu_depart: 'Saint-Pierre-de-Chartreuse',
        lieu_arrivee: 'Charmant Som',
        distance_km: 10.4,
        denivele_m: 620,
        meteo: 'Ciel bas · 12°C',
        hebergement_nom: 'Refuge du Charmant Som',
        hebergement_type: 'Refuge gardé',
        content: 'On a rangé la voiture derrière l’église à 9h40. Léna marchait devant sur les 5 premiers kilomètres. À midi, casse-croûte contre un mur de pierre sèche.'
      },
      {
        id: 'ch-2',
        num: 'II',
        title: 'La traversée du Balcon Est',
        lieu_depart: 'Charmant Som',
        lieu_arrivee: 'Cabane du Grand Vaneau',
        distance_km: 12.8,
        denivele_m: 720,
        meteo: 'Brouillard · 6°C',
        hebergement_nom: 'Cabane du Grand Vaneau',
        hebergement_type: 'Cabane non gardée',
        content: 'Départ à 7h20, thé chaud dans les thermos. Le passage du col Vert au petit matin restera gravé. Rien ne bougeait sauf le brouillard qui remontait la vallée.'
      },
      {
        id: 'ch-3',
        num: 'III',
        title: 'Descente sur la Charmette',
        lieu_depart: 'Grand Vaneau',
        lieu_arrivee: 'Col de la Charmette',
        distance_km: 4.2,
        denivele_m: 280,
        meteo: 'Ensoleillé · 14°C',
        hebergement_nom: 'Retour vallée',
        hebergement_type: 'Fin de boucle',
        content: 'Réveil tôt, ciel parfaitement dégagé. On a longé la crête pendant deux heures presque sans vent avant la descente technique vers la voiture.'
      }
    ] as ChapterItem[],

    // 3. Moments forts & Citations
    moments: [
      {
        id: 'm-1',
        label: 'JOUR 1 · 18H30',
        citation: '« Marie a servi la soupe sans dire un mot. On l’a bue debout, appuyés contre la porte du refuge. »',
        author: 'Marceline',
        location: 'Charmant Som',
        imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800'
      },
      {
        id: 'm-2',
        label: 'JOUR 2 · 07H50',
        citation: '« Le brouillard remontait la vallée par vagues. Antoine s’est arrêté : « c’est pour ça qu’on marche ». »',
        author: 'Antoine',
        location: 'Col Vert',
        imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800'
      }
    ] as CarnetMoment[],

    // 4. Sac & Matériel
    kitIntro: 'Sac 45L configuré pour l’autonomie en Chartreuse — chargement léger de 4.8 kg.',
    kitItems: [
      { id: 'k1', name: 'Duvet plumes 800 cuin', detail: 'Confort -5°C', weight: '920 g', color: '#3A6EA5' },
      { id: 'k2', name: 'Veste 3 couches Hardshell', detail: 'Portée sous la pluie', weight: '400 g', color: '#33463C' },
      { id: 'k3', name: 'Réchaud gaz ultra-léger', detail: 'Avec popote titane 800ml', weight: '260 g', color: '#B5652D' },
      { id: 'k4', name: 'Gourde inox filtrante 1L', detail: 'Remplie à la source', weight: '188 g', color: '#17402C' },
    ] as CarnetKitItem[],

    // 5. Thématiques & Visibilité
    selectedThemes: ['Bivouac', 'Chartreuse', 'Automne', 'Refuge gardé'],
    customTags: ['Crêtes', 'Alpes'],
    visibility: 'public', // 'public' | 'private'
  });

  const availableThemes = ['Bivouac', 'Chartreuse', 'Solo', 'Refuge gardé', 'Automne', 'Été', 'Alpinisme', 'Traversée', 'Van Life', 'Haute Montagne'];

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error("Error loading user:", err);
      }
    }
    loadUser();
  }, []);

  const setField = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleTheme = (theme: string) => {
    setForm(prev => {
      const exists = prev.selectedThemes.includes(theme);
      return {
        ...prev,
        selectedThemes: exists ? prev.selectedThemes.filter(t => t !== theme) : [...prev.selectedThemes, theme]
      };
    });
  };

  // Chapter Handlers
  const addChapter = () => {
    const nextNum = form.chapters.length + 1;
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][nextNum - 1] || `${nextNum}`;
    const newCh: ChapterItem = {
      id: `ch-${Date.now()}`,
      num: roman,
      title: `Étape ${nextNum}`,
      lieu_depart: '',
      lieu_arrivee: '',
      distance_km: 10,
      denivele_m: 500,
      meteo: 'Ensoleillé · 15°C',
      hebergement_nom: '',
      hebergement_type: 'Bivouac',
      content: ''
    };
    setForm(prev => ({ ...prev, chapters: [...prev.chapters, newCh] }));
  };

  const removeChapter = (id: string) => {
    if (form.chapters.length <= 1) return;
    setForm(prev => ({ ...prev, chapters: prev.chapters.filter(c => c.id !== id) }));
  };

  // Moment Handlers
  const addMoment = () => {
    const newMoment: CarnetMoment = {
      id: `m-${Date.now()}`,
      label: `JOUR ${form.moments.length + 1} · 14H00`,
      citation: '« Un instant suspendu face aux crêtes... »',
      author: user?.user_metadata?.full_name?.split(' ')[0] || 'Voyageur',
      location: form.destination || 'Massif',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800'
    };
    setForm(prev => ({ ...prev, moments: [...prev.moments, newMoment] }));
  };

  const removeMoment = (id: string) => {
    setForm(prev => ({ ...prev, moments: prev.moments.filter(m => m.id !== id) }));
  };

  // Kit Items Handlers
  const addKitItem = () => {
    const newItem: CarnetKitItem = {
      id: `k-${Date.now()}`,
      name: 'Nouvel équipement',
      detail: 'Détail technique',
      weight: '300 g',
      color: '#17402C'
    };
    setForm(prev => ({ ...prev, kitItems: [...prev.kitItems, newItem] }));
  };

  const removeKitItem = (id: string) => {
    setForm(prev => ({ ...prev, kitItems: prev.kitItems.filter(k => k.id !== id) }));
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        title: form.title,
        destination: form.destination,
        description: form.chapeau,
        cover_image: form.coverImage,
        distance_km: form.distance_km,
        elevation_m: form.elevation_m,
        tags: [...form.selectedThemes, ...form.customTags],
        author_id: user?.id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('carnets').insert([payload]).select().single();
      const carnetId = data?.id || `carnet-${Date.now()}`;

      // Local storage backup
      const local = JSON.parse(localStorage.getItem('user_carnets_data') || '[]');
      const fullCarnet = {
        id: carnetId,
        ...payload,
        jours: form.chapters.map((c, i) => ({
          id: c.id,
          dayNumber: i + 1,
          label: `JOUR ${i + 1}`,
          title: c.title,
          titleItalic: c.lieu_arrivee || '',
          recit: c.content,
          stats: [
            { icon: '📏', label: `${c.distance_km || 10} km` },
            { icon: '⛰', label: `${c.denivele_m || 500} m D+` },
            { icon: '☀️', label: c.meteo || '' }
          ]
        })),
        moments: form.moments,
        kit: {
          intro: form.kitIntro,
          totalWeight: '4.8 kg',
          items: form.kitItems
        }
      };
      localStorage.setItem('user_carnets_data', JSON.stringify([fullCarnet, ...local]));

      setSaveSuccess(true);
      setTimeout(() => {
        router.push(`/carnets/${carnetId}`);
      }, 800);
    } catch (e) {
      console.error(e);
      router.push('/carnets');
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { id: 'general' as const, label: 'Général & Métriques', short: '01', desc: 'Titre, dates & stats' },
    { id: 'etapes' as const, label: 'Étapes & Récit', short: '02', desc: `${form.chapters.length} étapes rédigées` },
    { id: 'moments' as const, label: 'Moments & Photos', short: '03', desc: `${form.moments.length} anecdotes` },
    { id: 'sac' as const, label: 'Dans le sac', short: '04', desc: `${form.kitItems.length} indispensables` },
    { id: 'tags' as const, label: 'Thèmes & Publication', short: '05', desc: 'Mots-clés & Visibilité' },
  ];

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[#17402C] relative flex flex-col">
      <CompteBackground />
      <Header />

      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-5">
        {/* COLONNE GAUCHE (Nav & Stepper) - 230px */}
        <aside className="w-[230px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3">
          <CommunityHubNav layoutVariant="vertical" activeTab="carnets" />

          <nav className="w-full glass p-1.5 rounded-2xl flex flex-col gap-1">
            <div className="px-2 py-0.5 flex items-center justify-between border-b border-[#17402C]/10 mb-0.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#5C6B5E]">Création Carnet</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {STEPS.map((st) => {
              const isActive = activeStep === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setActiveStep(st.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold select-none transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-white/95 to-white/75 text-[#17402C] font-bold border border-white/80'
                      : 'text-[#5C6B5E] hover:bg-white/40 hover:text-[#17402C]'
                  }`}
                >
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-[#17402C] text-white' : 'bg-black/5 text-[#5C6B5E]'}`}>
                    {st.short}
                  </span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate font-bold">{st.label}</div>
                    <div className="text-[9px] text-[#5C6B5E]/80 truncate">{st.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* COLONNE CENTRALE (Formulaire dynamique par étape) */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#5C6B5E]">
            <Link href="/communaute" className="hover:text-[#17402C] transition-colors">Communauté</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
            <Link href="/carnets" className="hover:text-[#17402C] transition-colors">Carnets</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
            <span className="text-[#17402C] font-semibold">Publier un carnet de voyage</span>
          </div>

          {/* ÉTAPE 1: GÉNÉRAL & MÉTRIQUES */}
          {activeStep === 'general' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Informations Générales &amp; Métriques</h2>
                  <p className="text-xs text-[#5C6B5E]">Posez les bases de votre expédition : destination, dates, météo et statistiques.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">01 · INFOS</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Titre du carnet *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="Ex : Traversée des crêtes en Chartreuse"
                    className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2.5 text-sm font-bold text-[#17402C] focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Massif / Destination *</label>
                    <input
                      type="text"
                      value={form.destination}
                      onChange={(e) => setField('destination', e.target.value)}
                      placeholder="Ex : Chartreuse · Alpes"
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Photo de couverture (URL)</label>
                    <input
                      type="text"
                      value={form.coverImage}
                      onChange={(e) => setField('coverImage', e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Chapeau d’accroche / Citation de départ</label>
                  <textarea
                    rows={2}
                    value={form.chapeau}
                    onChange={(e) => setField('chapeau', e.target.value)}
                    placeholder="Une phrase pour résumer l’ambiance et l’esprit..."
                    className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl p-3 text-xs text-[#17402C] font-serif italic"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Distance totale</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        value={form.distance_km}
                        onChange={(e) => setField('distance_km', parseFloat(e.target.value))}
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C] font-mono font-bold"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-[#5C6B5E] font-mono">km</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Dénivelé +</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={form.elevation_m}
                        onChange={(e) => setField('elevation_m', parseInt(e.target.value))}
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C] font-mono font-bold"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-[#5C6B5E] font-mono">m</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Voyageurs</label>
                    <input
                      type="number"
                      min={1}
                      value={form.voyageurs}
                      onChange={(e) => setField('voyageurs', parseInt(e.target.value))}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C] font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Note globale</label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={form.routeRating}
                        onChange={(e) => setField('routeRating', parseInt(e.target.value))}
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C] font-mono font-bold"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-amber-600 font-bold">/10</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Période du voyage</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setField('startDate', e.target.value)}
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-2.5 py-1.5 text-xs text-[#17402C]"
                      />
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setField('endDate', e.target.value)}
                        className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-2.5 py-1.5 text-xs text-[#17402C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Météo &amp; Température</label>
                    <input
                      type="text"
                      value={form.weather}
                      onChange={(e) => setField('weather', e.target.value)}
                      placeholder="Ex : Grand soleil en journée, 4°C la nuit"
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-1.5 text-xs text-[#17402C]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('etapes')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold flex items-center gap-1"
                >
                  <span>Suivant : Étapes &amp; Récit →</span>
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2: ÉTAPES & RÉCIT */}
          {activeStep === 'etapes' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Étapes &amp; Récit de marche</h2>
                  <p className="text-xs text-[#5C6B5E]">Détaillez le déroulé jour par jour avec les anecdotes, le bivouac et les refuges.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">02 · ÉTAPES</span>
              </div>

              <div className="space-y-5">
                {form.chapters.map((ch, idx) => (
                  <div key={ch.id} className="p-4 glass-sub-card rounded-2xl space-y-3 relative border border-white/60 bg-white/90">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#17402C] text-white flex items-center justify-center text-xs font-mono font-bold">
                          {ch.num}
                        </span>
                        <input
                          type="text"
                          value={ch.title}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].title = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder={`Titre du Jour ${idx + 1}`}
                          className="bg-transparent border-none text-sm font-bold text-[#17402C] focus:ring-0 p-0"
                        />
                      </div>

                      {form.chapters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeChapter(ch.id)}
                          className="text-[#5C6B5E] hover:text-red-600 text-xs font-semibold"
                        >
                          Supprimer l'étape
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-[#5C6B5E] block font-bold">Départ</label>
                        <input
                          type="text"
                          value={ch.lieu_depart || ''}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].lieu_depart = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder="Lieu de départ"
                          className="w-full bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs text-[#17402C]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#5C6B5E] block font-bold">Arrivée</label>
                        <input
                          type="text"
                          value={ch.lieu_arrivee || ''}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].lieu_arrivee = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder="Lieu d'arrivée"
                          className="w-full bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs text-[#17402C]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#5C6B5E] block font-bold">Distance &amp; D+</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={ch.distance_km || 10}
                            onChange={(e) => {
                              const updated = [...form.chapters];
                              updated[idx].distance_km = parseFloat(e.target.value);
                              setField('chapters', updated);
                            }}
                            className="w-1/2 bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs font-mono"
                          />
                          <input
                            type="number"
                            value={ch.denivele_m || 500}
                            onChange={(e) => {
                              const updated = [...form.chapters];
                              updated[idx].denivele_m = parseInt(e.target.value);
                              setField('chapters', updated);
                            }}
                            className="w-1/2 bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#5C6B5E] block font-bold">Hébergement</label>
                        <input
                          type="text"
                          value={ch.hebergement_nom || ''}
                          onChange={(e) => {
                            const updated = [...form.chapters];
                            updated[idx].hebergement_nom = e.target.value;
                            setField('chapters', updated);
                          }}
                          placeholder="Nom du refuge/bivouac"
                          className="w-full bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs text-[#17402C]"
                        />
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={ch.content}
                        onChange={(e) => {
                          const updated = [...form.chapters];
                          updated[idx].content = e.target.value;
                          setField('chapters', updated);
                        }}
                        placeholder="Récit de l’étape : sensations, rencontres, météo..."
                        className="w-full bg-white border border-[#17402C]/10 rounded-xl p-3 text-xs text-[#17402C] leading-relaxed"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addChapter}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#17402C]/20 hover:border-[#17402C] text-xs font-bold text-[#17402C] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Icon name="PlusIcon" size={14} /> Ajouter une journée de marche
                </button>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('general')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('moments')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Moments &amp; Photos →
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3: MOMENTS & PHOTOS */}
          {activeStep === 'moments' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Moments &amp; Photos Phares</h2>
                  <p className="text-xs text-[#5C6B5E]">Archivage des citations, des panoramas et des anecdotes marquantes.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">03 · SOUVENIRS</span>
              </div>

              <div className="space-y-4">
                {form.moments.map((m, idx) => (
                  <div key={m.id} className="p-4 glass-sub-card rounded-2xl space-y-3 bg-white/90 border border-white/60">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#17402C]">Moment #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeMoment(m.id)}
                        className="text-[#5C6B5E] hover:text-red-600 text-xs font-semibold"
                      >
                        Retirer
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-[#5C6B5E] block font-bold">Horodatage / Label</label>
                        <input
                          type="text"
                          value={m.label}
                          onChange={(e) => {
                            const updated = [...form.moments];
                            updated[idx].label = e.target.value;
                            setField('moments', updated);
                          }}
                          placeholder="Ex : JOUR 1 · 18H30"
                          className="w-full bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#5C6B5E] block font-bold">Lieu précis</label>
                        <input
                          type="text"
                          value={m.location}
                          onChange={(e) => {
                            const updated = [...form.moments];
                            updated[idx].location = e.target.value;
                            setField('moments', updated);
                          }}
                          placeholder="Ex : Charmant Som"
                          className="w-full bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#5C6B5E] block font-bold">Auteur</label>
                        <input
                          type="text"
                          value={m.author}
                          onChange={(e) => {
                            const updated = [...form.moments];
                            updated[idx].author = e.target.value;
                            setField('moments', updated);
                          }}
                          placeholder="Ex : Marceline"
                          className="w-full bg-white border border-[#17402C]/10 rounded-lg p-1.5 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#5C6B5E] block font-bold mb-0.5">Citation / Anecdote</label>
                      <input
                        type="text"
                        value={m.citation}
                        onChange={(e) => {
                          const updated = [...form.moments];
                          updated[idx].citation = e.target.value;
                          setField('moments', updated);
                        }}
                        placeholder="« Phrase mémorable prononcée ou pensée... »"
                        className="w-full bg-white border border-[#17402C]/10 rounded-lg p-2 text-xs font-serif italic"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addMoment}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#17402C]/20 hover:border-[#17402C] text-xs font-bold text-[#17402C] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Icon name="PlusIcon" size={14} /> Ajouter un souvenir / photo
                </button>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('etapes')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('sac')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Dans le sac →
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4: DANS LE SAC */}
          {activeStep === 'sac' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Ce que vous aviez dans le sac</h2>
                  <p className="text-xs text-[#5C6B5E]">Partagez le matériel testé pour aider la communauté à préparer leur sac.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">04 · MATÉRIEL</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Commentaire global sur le portage</label>
                  <input
                    type="text"
                    value={form.kitIntro}
                    onChange={(e) => setField('kitIntro', e.target.value)}
                    placeholder="Ex : Sac 45L configuré pour 3 jours d'autonomie complète."
                    className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2 text-xs text-[#17402C]"
                  />
                </div>

                <div className="space-y-2">
                  {form.kitItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 p-2.5 glass-sub-card rounded-xl bg-white/90">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color || '#17402C' }} />
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...form.kitItems];
                          updated[idx].name = e.target.value;
                          setField('kitItems', updated);
                        }}
                        placeholder="Nom de l'équipement"
                        className="flex-1 bg-transparent border-none text-xs font-bold text-[#17402C] p-0 focus:ring-0"
                      />
                      <input
                        type="text"
                        value={item.detail}
                        onChange={(e) => {
                          const updated = [...form.kitItems];
                          updated[idx].detail = e.target.value;
                          setField('kitItems', updated);
                        }}
                        placeholder="Détail / Marque"
                        className="w-1/3 bg-transparent border-none text-[11px] text-[#5C6B5E] p-0 focus:ring-0"
                      />
                      <input
                        type="text"
                        value={item.weight}
                        onChange={(e) => {
                          const updated = [...form.kitItems];
                          updated[idx].weight = e.target.value;
                          setField('kitItems', updated);
                        }}
                        placeholder="Poids"
                        className="w-16 bg-white border border-[#17402C]/10 rounded px-1.5 py-0.5 text-[10.5px] font-mono text-center font-bold text-[#17402C]"
                      />
                      <button
                        type="button"
                        onClick={() => removeKitItem(item.id)}
                        className="text-[#5C6B5E] hover:text-red-600 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addKitItem}
                    className="w-full py-2 rounded-xl border border-dashed border-[#17402C]/20 hover:border-[#17402C] text-xs font-bold text-[#17402C] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Icon name="PlusIcon" size={14} /> Ajouter un équipement
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('moments')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep('tags')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Thématiques →
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 5: THÈMES & PUBLICATION */}
          {activeStep === 'tags' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Thématiques &amp; Visibilité</h2>
                  <p className="text-xs text-[#5C6B5E]">Choisissez les étiquettes de référencement et les droits d'accès.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">05 · PUBLICATION</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Thématiques de l’expédition</label>
                  <div className="flex flex-wrap gap-2">
                    {availableThemes.map((th) => {
                      const isSelected = form.selectedThemes.includes(th);
                      return (
                        <button
                          key={th}
                          type="button"
                          onClick={() => toggleTheme(th)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-[#17402C] text-white shadow-xs'
                              : 'bg-white/80 text-[#5C6B5E] border border-[#17402C]/10 hover:border-[#17402C]/30'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '} {th}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Visibilité du carnet</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'public', label: '🌍 Public', desc: 'Visible par toute la communauté LKDV et indexé dans le hub.' },
                      { id: 'private', label: '🔒 Privé', desc: 'Accessible uniquement par vous et vos proches via lien secret.' },
                    ].map((vis) => (
                      <label
                        key={vis.id}
                        className={`p-3.5 rounded-xl cursor-pointer flex items-start gap-2.5 transition-all ${
                          form.visibility === vis.id
                            ? 'bg-white border-2 border-[#17402C] shadow-xs'
                            : 'bg-white/60 border border-[#17402C]/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="carnet_visibility"
                          value={vis.id}
                          checked={form.visibility === vis.id}
                          onChange={() => setField('visibility', vis.id)}
                          className="mt-0.5 text-[#17402C]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#17402C] block">{vis.label}</span>
                          <span className="text-[10.5px] text-[#5C6B5E] leading-tight block">{vis.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('sac')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={saving || !form.title.trim()}
                  className="glass-capsule-btn primary py-2.5 px-6 text-xs font-bold flex items-center gap-1.5"
                >
                  <Icon name="CheckIcon" size={14} className="relative z-10" />
                  <span className="relative z-10">{saving ? 'Publication...' : saveSuccess ? '✓ Publié !' : 'Publier le carnet'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLONNE DROITE (Live Carnet Preview & Actions) - 300px */}
        <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 pb-8">
          {/* Live Preview Card */}
          <div className="glass p-3.5 space-y-3 rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs text-[#17402C]">Aperçu du carnet</h3>
              <span className="glass-pill text-[9px] font-mono font-bold">Live</span>
            </div>

            <div className="rounded-xl overflow-hidden bg-white border border-[#17402C]/10 shadow-xs flex flex-col">
              <div className="h-28 relative bg-[#17402C]">
                {form.coverImage && (
                  <img src={form.coverImage} alt="Cover" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full text-[9px] font-mono text-white font-bold">
                  {form.destination}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                <h4 className="font-display font-bold text-sm text-[#17402C] leading-snug">
                  {form.title || 'Titre du carnet'}
                </h4>
                <p className="text-[10px] text-[#5C6B5E] font-serif italic line-clamp-2">
                  {form.chapeau}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-[#17402C]/10 text-[10px] font-mono text-[#5C6B5E]">
                  <span>📏 {form.distance_km} km</span>
                  <span>⛰️ +{form.elevation_m} m</span>
                  <span>★ {form.routeRating}/10</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Publication */}
          <div className="glass tone-sand p-3.5 space-y-2 rounded-2xl text-[#17402C]">
            <span className="glass-pill text-[9px] font-mono font-bold text-[#8C6418]">
              🌟 CERTIFICATION LKDV
            </span>
            <h3 className="font-display font-bold text-xs text-[#17402C]">
              Prêt à inspirer la communauté ?
            </h3>
            <p className="text-[11px] text-[#5C6B5E] leading-relaxed">
              Vos étapes, photos et conseils de sac seront instantanément archivés et partageables.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handlePublish}
                disabled={saving || !form.title.trim()}
                className="w-full glass-capsule-btn primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Icon name="CheckIcon" size={14} className="relative z-10" />
                <span className="relative z-10">{saving ? 'Publication...' : saveSuccess ? '✓ Publié !' : 'Publier le carnet'}</span>
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
