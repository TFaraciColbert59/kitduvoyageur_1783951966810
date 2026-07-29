'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export default function EditProfileView({ onCloseModal, onSave }: { onCloseModal?: () => void; onSave?: (updatedProfile: any) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Form State
  const [form, setForm] = useState({
    firstName: 'Marceline',
    lastName: 'Chevrier',
    publicName: 'Marceline Chevrier',
    username: 'mchevrier',
    shortBio: 'Randonneuse babillarde & Cannelle. Je marche pour retrouver le silence.',
    bio: 'Passioinée de montagne, Chartreuse et Belledonne. J\'aime partir souvent avec mon sac de bivouac et échanger avec d\'autres passionnés de randonnée.',
    city: 'Grenoble, Isère',
    country: 'France',
    timezone: 'Europe/Paris (UTC+01:00)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
    heroUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200',
    selectedMassifs: ['Chartreuse', 'Belledonne', 'Vercors', 'Écrins'],
    languages: ['Français', 'Anglais', 'Italien'],
    disciplines: ['Randonnée', 'Bivouac', 'Alpinisme', 'Ski de rando', 'Trail'],
    experienceLevel: 'III',
    avgDistance: '18 km',
    avgElevation: '1200 m D+',
    pace: '3.5 à 4 km/h',
    stravaConnected: true,
    garminConnected: true,
    komootConnected: false,
    wikilocConnected: false,
    directoryVisible: true,
    showLocation: true,
    allowTripRequests: true,
    publicStats: false,
    allowPrivateMessages: true
  });

  const availableMassifs = [
    'Chartreuse', 'Belledonne', 'Vercors', 'Écrins', 'Mont-Blanc', 
    'Aravis', 'Mercantour', 'Pyrénées', 'Corse', 'Cévennes', 'Vosges', 'Jura'
  ];

  const availableDisciplines = [
    { id: 'Randonnée', label: '🏔️ Randonnée' },
    { id: 'Bivouac', label: '🏕️ Bivouac' },
    { id: 'Alpinisme', label: '🚵 Alpinisme' },
    { id: 'Ski de rando', label: '⛷️ Ski de rando' },
    { id: 'Trail', label: '🚣 Trail' },
    { id: 'VTT', label: '🚴 VTT' },
    { id: 'Escalade', label: '🧭 Escalade' },
    { id: 'Haute montagne', label: '❄️ Haute montagne' }
  ];

  // Fetch Saved Profile from localStorage / Supabase on Mount
  useEffect(() => {
    async function loadUserProfile() {
      try {
        // First check localStorage for immediate persistence
        const saved = localStorage.getItem('user_profile_data');
        if (saved) {
          const p = JSON.parse(saved);
          setForm(prev => ({
            ...prev,
            firstName: p.first_name || prev.firstName,
            lastName: p.last_name || prev.lastName,
            publicName: p.full_name || prev.publicName,
            username: p.username || prev.username,
            shortBio: p.short_bio || prev.shortBio,
            bio: p.bio || prev.bio,
            city: p.location || prev.city,
            avatarUrl: p.avatar_url || prev.avatarUrl,
            heroUrl: p.hero_image_url || prev.heroUrl,
            country: p.country || prev.country,
            selectedMassifs: p.selected_massifs || prev.selectedMassifs,
            disciplines: p.disciplines || prev.disciplines
          }));
        }

        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          setUser(currentUser);
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (profileData) {
            const nameParts = (profileData.full_name || '').split(' ');
            setForm(prev => ({
              ...prev,
              firstName: nameParts[0] || prev.firstName,
              lastName: nameParts.slice(1).join(' ') || prev.lastName,
              publicName: profileData.full_name || prev.publicName,
              avatarUrl: profileData.avatar_url || currentUser.user_metadata?.avatar_url || prev.avatarUrl,
              bio: profileData.bio || prev.bio,
              city: profileData.location || prev.city,
            }));
          }
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserProfile();
  }, []);

  // Update Field Handler
  const setField = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayItem = (key: string, item: string) => {
    setForm(prev => {
      const arr = (prev as any)[key] as string[];
      const exists = arr.includes(item);
      return {
        ...prev,
        [key]: exists ? arr.filter(i => i !== item) : [...arr, item]
      };
    });
  };

  // Calculate Profile Completion Rate
  const completionScore = React.useMemo(() => {
    let score = 0;
    if (form.avatarUrl) score += 20;
    if (form.bio) score += 20;
    if (form.selectedMassifs.length >= 3) score += 15;
    if (form.disciplines.length >= 1) score += 15;
    if (form.experienceLevel) score += 15;
    if (form.stravaConnected || form.garminConnected) score += 15;
    return Math.min(100, score);
  }, [form]);

  // Save Handler to LocalStorage & Supabase
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const updatedProfileData = {
        first_name: form.firstName,
        last_name: form.lastName.endsWith('.') ? form.lastName : `${form.lastName}.`,
        full_name: fullName,
        username: form.username,
        bio: form.bio,
        short_bio: form.shortBio,
        location: form.city,
        country: form.country,
        avatar_url: form.avatarUrl,
        hero_image_url: form.heroUrl,
        selected_massifs: form.selectedMassifs,
        disciplines: form.disciplines,
        experience_level: form.experienceLevel,
      };

      // 1. Save to LocalStorage for instant persistence
      localStorage.setItem('user_profile_data', JSON.stringify(updatedProfileData));

      // 2. Dispatch global profile_updated event
      window.dispatchEvent(new CustomEvent('profile_updated', { detail: updatedProfileData }));

      // 3. Call onSave callback if passed
      if (onSave) {
        onSave(updatedProfileData);
      }

      // 4. Save to Supabase user_profiles table
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (currentUser) {
        const { error } = await supabase.from('user_profiles').upsert({
          id: currentUser.id,
          full_name: fullName,
          avatar_url: form.avatarUrl,
          bio: form.bio,
          location: form.city,
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) {
          console.warn("Supabase upsert warning:", error);
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (onCloseModal) {
        setTimeout(onCloseModal, 500);
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2E8] font-sans text-[#1C2620] pb-28">
      {/* 1. TOP STICKY NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E8E4D8] px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/compte" className="flex items-center gap-2 text-xs font-semibold text-[#5C6B5E] hover:text-[#1C2620] transition-colors">
            <Icon name="ArrowLeftIcon" size={16} />
            <span>Mon compte</span>
          </Link>
          <span className="text-[#E8E4D8]">|</span>
          <span className="text-xs font-bold text-[#1C2620] uppercase tracking-wider">Modifier mon profil</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF0EB] text-[#2D5A3D] text-[10px] font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-[#2D5A3D] animate-pulse"></span>
            ⚡ Modifications enregistrées
          </span>

          <Link
            href="/compte"
            className="px-4 py-2 rounded-full text-xs font-semibold text-[#5C6B5E] border border-[#E8E4D8] hover:bg-[#F5F2E8] hover:text-[#1C2620] transition-colors flex items-center gap-1.5"
          >
            <Icon name="EyeIcon" size={14} />
            <span>Aperçu public</span>
          </Link>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#2D5A3D] hover:bg-[#1C2620] text-white rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </header>

      {/* 2. HERO TITLE SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase font-bold mb-2">
          — ÉDITION PROFIL · {form.firstName} {form.lastName}
        </div>
        <h1 className="font-display font-800 text-3xl sm:text-5xl text-[#1C2620] tracking-tight mb-3">
          Racontez qui vous êtes, <br className="hidden sm:inline" />
          <em className="font-serif italic font-normal text-[#2D5A3D]">et où vous allez.</em>
        </h1>
        <p className="text-xs sm:text-sm text-[#5C6B5E] max-w-2xl leading-relaxed">
          Votre profil apparaît sur vos carnets, dans les clubs et à côté de vos aventures. Prenez le temps — les meilleures histoires ont de bons auteurs.
        </p>
      </div>

      {/* 3. MAIN FORM & SIDEBAR GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: FORM SECTIONS (8 COLS) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* ─── SECTION 01: IDENTITÉ PUBLIQUE ──────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Identité publique</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Nom, avatar, couverture. Ce que la communauté voit en premier.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                01 · VISIBILITÉ
              </span>
            </div>

            {/* Cover Photo Header */}
            <div className="relative rounded-2xl overflow-hidden h-44 sm:h-52 bg-gradient-to-r from-emerald-900 to-teal-800 shadow-inner group">
              <img src={form.heroUrl} alt="Photo de couverture" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              <div className="absolute top-4 right-4 flex gap-2">
                <label className="px-3 py-1.5 bg-white/90 hover:bg-white text-[#1C2620] text-xs font-bold rounded-full shadow-md cursor-pointer transition-colors flex items-center gap-1">
                  <Icon name="CameraIcon" size={14} /> Changer
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setField('heroUrl', URL.createObjectURL(e.target.files[0]));
                    }
                  }} />
                </label>
                <button 
                  onClick={() => setField('heroUrl', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200')}
                  className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-semibold rounded-full backdrop-blur-md transition-colors"
                >
                  Reinitialiser
                </button>
              </div>
            </div>

            {/* Avatar & Subtitle Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 relative z-10 px-4">
              <div className="flex items-end gap-4">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white shrink-0">
                  <img src={form.avatarUrl} alt={form.publicName} className="w-full h-full object-cover" />
                  <label className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold cursor-pointer">
                    <Icon name="CameraIcon" size={20} />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setField('avatarUrl', URL.createObjectURL(e.target.files[0]));
                      }
                    }} />
                  </label>
                </div>
                <div className="mb-2">
                  <h3 className="font-display font-800 text-xl text-[#1C2620]">{form.firstName} {form.lastName}</h3>
                  <p className="text-xs text-[#5C6B5E] font-mono">Membre depuis mars 2023 · 12 carnets publiés</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <label className="px-3 py-1.5 bg-[#F5F2E8] hover:bg-[#E8E4D8] text-[#1C2620] text-xs font-semibold rounded-full cursor-pointer transition-colors">
                  Changer photo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setField('avatarUrl', URL.createObjectURL(e.target.files[0]));
                    }
                  }} />
                </label>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={e => {
                      setField('firstName', e.target.value);
                      setField('publicName', `${e.target.value} ${form.lastName}`);
                    }}
                    className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-sm text-[#1C2620] font-semibold focus:ring-1 focus:ring-[#2D5A3D]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nom *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => {
                      setField('lastName', e.target.value);
                      setField('publicName', `${form.firstName} ${e.target.value}`);
                    }}
                    className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-sm text-[#1C2620] font-semibold focus:ring-1 focus:ring-[#2D5A3D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nom d'usage public</label>
                  <input
                    type="text"
                    value={form.publicName}
                    onChange={e => setField('publicName', e.target.value)}
                    className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-sm text-[#1C2620] font-semibold focus:ring-1 focus:ring-[#2D5A3D]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block">Nom d'utilisateur *</label>
                    <span className="text-[10px] font-mono text-[#2D5A3D] font-bold">✓ Disponible</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#5C6B5E]">@</span>
                    <input
                      type="text"
                      value={form.username}
                      onChange={e => setField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full bg-[#F5F2E8] border-none rounded-2xl pl-8 pr-4 py-3 text-sm text-[#1C2620] font-semibold focus:ring-1 focus:ring-[#2D5A3D]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block">Bio courte (Signature - Une ligne)</label>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{form.shortBio.length} / 120</span>
                </div>
                <input
                  type="text"
                  maxLength={120}
                  value={form.shortBio}
                  onChange={e => setField('shortBio', e.target.value)}
                  placeholder="Randonneuse babillarde & Cannelle. Je marche pour retrouver le silence..."
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-sm text-[#1C2620] font-serif italic focus:ring-1 focus:ring-[#2D5A3D]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block">À propos (Description complète)</label>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{form.bio.length} / 500</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={form.bio}
                  onChange={e => setField('bio', e.target.value)}
                  placeholder="Racontez vos expéditions, vos massifs favoris et votre approche de la randonnée..."
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl p-4 text-xs text-[#1C2620] leading-relaxed resize-none focus:ring-1 focus:ring-[#2D5A3D]"
                />
              </div>
            </div>
          </div>


          {/* ─── SECTION 02: ANCRAGE GÉOGRAPHIQUE ───────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Ancrage géographique</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Pour proposer les bons refuges, les clubs proches et suggérer votre profil aux voyageurs.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                02 · OÙ VOUS ÊTES
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Ville de résidence</label>
                <div className="relative">
                  <Icon name="MapPinIcon" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setField('city', e.target.value)}
                    placeholder="Ex: Grenoble, Isère"
                    className="w-full bg-[#F5F2E8] border-none rounded-2xl pl-9 pr-4 py-3 text-xs text-[#1C2620] font-semibold focus:ring-1 focus:ring-[#2D5A3D]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Pays</label>
                <select
                  value={form.country}
                  onChange={e => setField('country', e.target.value)}
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs text-[#1C2620] font-semibold focus:ring-1 focus:ring-[#2D5A3D]"
                >
                  <option value="France">France</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Belgique">Belgique</option>
                  <option value="Canada">Canada</option>
                  <option value="Italie">Italie</option>
                  <option value="Espagne">Espagne</option>
                </select>
              </div>
            </div>

            {/* Massifs De Prédilection Tags */}
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Massifs de prédilection (Sélection multiple)</label>
              <div className="flex flex-wrap gap-2">
                {availableMassifs.map(massif => {
                  const isSelected = form.selectedMassifs.includes(massif);
                  return (
                    <button
                      key={massif}
                      type="button"
                      onClick={() => toggleArrayItem('selectedMassifs', massif)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        isSelected 
                          ? 'bg-[#2D5A3D] text-white shadow-sm' 
                          : 'bg-[#F5F2E8] text-[#5C6B5E] hover:bg-[#E8E4D8] hover:text-[#1C2620]'
                      }`}
                    >
                      {isSelected ? `✓ ${massif}` : massif}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timezone & Languages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Fuseau horaire</label>
                <select
                  value={form.timezone}
                  onChange={e => setField('timezone', e.target.value)}
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs text-[#1C2620] font-semibold"
                >
                  <option value="Europe/Paris (UTC+01:00)">Europe / Paris (UTC+01:00)</option>
                  <option value="Europe/London (UTC+00:00)">Europe / London (UTC+00:00)</option>
                  <option value="America/Montreal (UTC-05:00)">America / Montreal (UTC-05:00)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Langues parlées</label>
                <div className="flex flex-wrap gap-2">
                  {form.languages.map(lang => (
                    <span key={lang} className="bg-[#EAF0EB] text-[#2D5A3D] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <span>✓ {lang}</span>
                      <button type="button" onClick={() => toggleArrayItem('languages', lang)} className="hover:text-red-500 ml-1">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>


          {/* ─── SECTION 03: PRATIQUE & NIVEAU ──────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Pratique & niveau</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Ces informations aident à me mettre en relation avec des personnes d'expérience compatible.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                03 · VOS COMPÉTENCES
              </span>
            </div>

            {/* Disciplines Selection Grid */}
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-3">Disciplines pratiquées</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {availableDisciplines.map(d => {
                  const isSelected = form.disciplines.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleArrayItem('disciplines', d.id)}
                      className={`p-3 rounded-2xl text-xs font-bold transition-all text-center border ${
                        isSelected 
                          ? 'bg-[#EAF0EB] border-[#2D5A3D] text-[#2D5A3D] shadow-sm' 
                          : 'bg-[#F5F2E8] border-transparent text-[#5C6B5E] hover:bg-[#E8E4D8]'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Niveau d'expérience selector */}
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-3">Niveau d'expérience globale</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'I', label: 'I · Débutant', sub: '1-2 ans' },
                  { id: 'II', label: 'II · Régulier', sub: '3-5 ans' },
                  { id: 'III', label: 'III · Expérimenté', sub: '6-10 ans' },
                  { id: 'IV', label: 'IV · Guide', sub: '>10 ans' }
                ].map(lvl => {
                  const isActive = form.experienceLevel === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setField('experienceLevel', lvl.id)}
                      className={`p-3.5 rounded-2xl text-center transition-all border ${
                        isActive 
                          ? 'bg-[#1C2620] border-[#1C2620] text-white shadow-md' 
                          : 'bg-[#F5F2E8] border-transparent text-[#5C6B5E] hover:bg-[#E8E4D8] hover:text-[#1C2620]'
                      }`}
                    >
                      <div className="font-bold text-xs">{lvl.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white/70' : 'text-[#5C6B5E]'}`}>{lvl.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metric Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Distance moyenne / sortie</label>
                <input
                  type="text"
                  value={form.avgDistance}
                  onChange={e => setField('avgDistance', e.target.value)}
                  placeholder="18 km"
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs text-[#1C2620] font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Dénivelé moyen / sortie</label>
                <input
                  type="text"
                  value={form.avgElevation}
                  onChange={e => setField('avgElevation', e.target.value)}
                  placeholder="1200 m D+"
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs text-[#1C2620] font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Rythme en effort</label>
                <input
                  type="text"
                  value={form.pace}
                  onChange={e => setField('pace', e.target.value)}
                  placeholder="3.5 à 4 km/h"
                  className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-xs text-[#1C2620] font-semibold"
                />
              </div>
            </div>
          </div>


          {/* ─── SECTION 04: COMPTES LIÉS ───────────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Comptes liés</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Importez vos traces depuis les plateformes que vous utilisez déjà.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                04 · IMPORT & PARTAGE
              </span>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Strava', handle: '@mchevrier · 124 sorties synchro', connected: form.stravaConnected, key: 'stravaConnected', icon: '🧡' },
                { name: 'Garmin Connect', handle: '@mchevrier_trek · Traces synchro', connected: form.garminConnected, key: 'garminConnected', icon: '🟦' },
                { name: 'Komoot', handle: 'Non connecté', connected: form.komootConnected, key: 'komootConnected', icon: '💚' },
                { name: 'Wikiloc', handle: 'Non connecté', connected: form.wikilocConnected, key: 'wikilocConnected', icon: '🟢' }
              ].map(app => (
                <div key={app.name} className="bg-[#F5F2E8] p-4 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{app.icon}</span>
                    <div>
                      <div className="font-bold text-xs text-[#1C2620]">{app.name}</div>
                      <div className="text-[10px] text-[#5C6B5E] font-mono mt-0.5">{app.handle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {app.connected ? (
                      <>
                        <span className="bg-[#EAF0EB] text-[#2D5A3D] text-[10px] font-mono font-bold px-2.5 py-1 rounded-full">Connecté</span>
                        <button 
                          type="button" 
                          onClick={() => setField(app.key, false)} 
                          className="px-3 py-1.5 rounded-full text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Déconnecter
                        </button>
                      </>
                    ) : (
                      <button 
                        type="button" 
                        onClick={() => setField(app.key, true)} 
                        className="px-4 py-1.5 bg-[#1C2620] text-white hover:bg-[#2D5A3D] text-xs font-bold rounded-full transition-colors"
                      >
                        Connecter
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* ─── SECTION 05: CONFIDENTIALITÉ ────────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Qui peut voir quoi</h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Et avec qui vous partagez vos traces. Vos carnets peuvent être publics, tout en gardant vos sorties privées.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                05 · CONFIDENTIALITÉ
              </span>
            </div>

            <div className="space-y-4">
              {[
                { key: 'directoryVisible', title: 'Profil visible dans l\'annuaire', desc: 'Les autres voyageurs pourront vous trouver dans la communauté.' },
                { key: 'showLocation', title: 'Afficher ma localisation', desc: 'Permet de faire apparaître votre ville sur vos fiches d\'aventures.' },
                { key: 'allowTripRequests', title: 'Autoriser les demandes de sortie', desc: 'D\'autres membres peuvent vous inviter à leurs sorties de bivouac.' },
                { key: 'publicStats', title: 'Statistiques publiques', desc: 'Vos km et vos dénivelés cumulés sont visibles sur votre profil.' },
                { key: 'allowPrivateMessages', title: 'Recevoir des messages privés', desc: 'Seuls les membres de vos clubs peuvent vous envoyer un message.' }
              ].map(item => {
                const val = (form as any)[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-2 border-b border-[#F5F2E8] last:border-none">
                    <div>
                      <h4 className="font-bold text-xs text-[#1C2620]">{item.title}</h4>
                      <p className="text-[11px] text-[#5C6B5E] mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setField(item.key, !val)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-1 shrink-0 ${
                        val ? 'bg-[#2D5A3D]' : 'bg-[#E8E4D8]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        val ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>


        {/* RIGHT COLUMN: SIDEBAR WIDGETS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          
          {/* WIDGET 1: APERÇU PROFIL PUBLIC (Live Card) */}
          <div className="bg-[#1C2620] rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden space-y-4">
            <div className="text-[9px] font-mono tracking-widest text-[#17402C] uppercase font-bold">APERÇU · PROFIL PUBLIC</div>

            <div className="flex items-center gap-4">
              <img src={form.avatarUrl} alt={form.publicName} className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
              <div>
                <h3 className="font-display font-800 text-lg leading-tight">{form.publicName}</h3>
                <p className="text-[11px] text-white/70 font-mono">@{form.username} · {form.city}</p>
              </div>
            </div>

            <p className="text-xs text-white/80 font-serif italic leading-relaxed bg-white/10 p-3 rounded-2xl">
              "{form.shortBio || form.bio}"
            </p>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {form.selectedMassifs.slice(0, 3).map(m => (
                <span key={m} className="bg-white/15 text-white text-[10px] font-mono px-2.5 py-1 rounded-full">
                  {m}
                </span>
              ))}
              <span className="bg-[#17402C] text-white text-[10px] font-mono px-2.5 py-1 rounded-full font-bold">
                Niveau {form.experienceLevel}
              </span>
            </div>
          </div>


          {/* WIDGET 2: PROFIL COMPLÉTÉ À X% */}
          <div className="bg-white rounded-[2.5rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-800 text-sm text-[#1C2620]">Profil complété à {completionScore}%</h3>
              <span className="text-xs font-mono font-bold text-[#2D5A3D]">{completionScore}/100</span>
            </div>

            <div className="w-full bg-[#F5F2E8] h-2.5 rounded-full overflow-hidden">
              <div className="bg-[#2D5A3D] h-full transition-all duration-500 rounded-full" style={{ width: `${completionScore}%` }} />
            </div>

            <div className="space-y-2 pt-2">
              {[
                { label: 'Photo de profil', done: !!form.avatarUrl },
                { label: 'Bio renseignée', done: !!form.bio },
                { label: '3 massifs favoris', done: form.selectedMassifs.length >= 3 },
                { label: 'Discipline (s)', done: form.disciplines.length >= 1 },
                { label: 'Pratique & statistiques', done: !!form.experienceLevel },
                { label: 'Strava / Garmin connecté', done: form.stravaConnected || form.garminConnected }
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className={item.done ? 'text-[#1C2620] font-medium' : 'text-[#5C6B5E]'}>
                    {item.done ? '✓ ' : '⭕ '}{item.label}
                  </span>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{item.done ? 'Fait' : 'À faire'}</span>
                </div>
              ))}
            </div>
          </div>


          {/* WIDGET 3: ASTUCES & CONSEILS */}
          <div className="bg-[#EAF0EB] rounded-[2.5rem] p-6 text-[#1C2620] space-y-2 border border-[#2D5A3D]/20">
            <div className="text-[10px] font-mono tracking-widest text-[#2D5A3D] uppercase font-bold">CONSEIL DE LA COMMUNAUTÉ</div>
            <h4 className="font-display font-800 text-sm">Une bio qui inspire.</h4>
            <p className="text-xs text-[#4A574C] leading-relaxed">
              Faites des liens entre vos massifs de prédilection et vos disciplines favorites. C'est plus facile pour vous contacter et partir ensemble !
            </p>
          </div>

        </div>

      </div>

      {/* 4. FLOATING BOTTOM BAR */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1C2620]/95 backdrop-blur-md text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-6 border border-[#2D5A3D] max-w-xl w-11/12 justify-between">
        <div className="text-xs text-white/80 hidden sm:flex items-center gap-2">
          <span>⚡</span>
          <span>Brouillon enregistré automatiquement</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Link href="/compte" className="px-4 py-2 text-xs font-semibold text-white/70 hover:text-white transition-colors">
            Annuler
          </Link>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#2D5A3D] hover:bg-[#17402C] text-white rounded-full text-xs font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : saveSuccess ? '✓ Enregistré !' : 'Enregistrer les changements'}
          </button>
        </div>
      </div>
    </div>
  );
}
