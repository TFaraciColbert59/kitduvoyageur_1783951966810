'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

export interface ClubRule {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export default function CreateClubView() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [inviteSlug, setInviteSlug] = useState('cimes-partagees-vdK');

  // Form State
  const [form, setForm] = useState({
    title: 'Cimes partagées',
    slogan: 'Marcher ensemble en Chartreuse, sans se précipiter, avec le temps.',
    description: 'Un club ouvert aux marcheurs réguliers et curieux, autour du massif de la Chartreuse. Nos sorties sont mensuelles, en petit comité (max 12), avec toujours un temps de contemplation. Nous privilégions les jeunes membres qui débutent, sans négliger les journées d\'itinérance pour les plus expérimentés.',
    coverImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200',
    logoImage: '',
    category: 'Randonnée & bivouac',
    rhythm: 'Mensuel - 1 à 2 sorties',
    zones: ['Chartreuse', 'Vercors', 'Belledonne'] as string[],
    newZoneInput: '',
    location: 'Grenoble, Isère',
    maxMembers: 50,
    rules: [
      { id: 'r1', title: 'Respecter l\'esprit du groupe', description: 'Pas de chrono, nous prenons le temps d\'apprécier.', icon: 'ShieldCheckIcon' },
      { id: 'r2', title: 'Prévenir 48h avant en cas d\'annulation', description: 'Pour ne pas laisser tomber le groupe ou les refuges réservés.', icon: 'ClockIcon' },
      { id: 'r3', title: 'L\'Allure de tous', description: 'Aucun chrono, tout le monde l\'attendra en haut.', icon: 'UserGroupIcon' },
      { id: 'r4', title: 'Accueillir les nouveaux', description: 'Un accompagnement bi-annuel pour la première sortie.', icon: 'UserPlusIcon' }
    ] as ClubRule[],
    manualValidation: true,
    membersCanCreateOutings: false,
    openDiscussionThread: true,
    visibility: 'public', // 'public' | 'invite' | 'private'
  });

  const availableZones = ['Chartreuse', 'Vercors', 'Belledonne', 'Écrins', 'Mont-Blanc', 'Aravis', 'Beaufortain', 'Queyras', 'Bauges'];

  // Load User Profile on Mount
  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', currentUser.id).single();
          setUser({ ...currentUser, profile });
        }
      } catch (err) {
        console.error("Error loading user:", err);
      }
    }
    loadUser();
  }, []);

  // Field Setters
  const setField = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const toggleZone = (zone: string) => {
    setForm(prev => {
      const exists = prev.zones.includes(zone);
      return {
        ...prev,
        zones: exists ? prev.zones.filter(z => z !== zone) : [...prev.zones, zone]
      };
    });
  };

  const removeRule = (id: string) => {
    setForm(prev => ({ ...prev, rules: prev.rules.filter(r => r.id !== id) }));
  };

  const addRule = () => {
    const newRule: ClubRule = {
      id: `r-${Date.now()}`,
      title: 'Nouvelle règle',
      description: 'Description de la règle...',
      icon: 'InformationCircleIcon'
    };
    setForm(prev => ({ ...prev, rules: [...prev.rules, newRule] }));
  };

  // Progress Score Calculation
  const isReadyToPublish = React.useMemo(() => {
    return form.title.length >= 3 && form.coverImage && form.description.length >= 20 && form.rules.length >= 3;
  }, [form]);

  // Submit Club to Supabase
  const handlePublish = async (isDraft = false) => {
    if (!form.title.trim()) {
      alert("Veuillez indiquer au moins un nom pour votre club.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const supabase = createClient();
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const authorId = currentUser?.id;
      const slug = `c-${form.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`;

      const payload = {
        name: form.title,
        slug,
        type: 'activite',
        emoji: '🏕️',
        description: form.description,
        cover_color: 'from-emerald-600 to-teal-700',
        cover_image: form.coverImage,
        category: form.category,
        rules: JSON.stringify(form.rules),
        privacy: form.visibility === 'public' ? 'open' : form.visibility === 'private' ? 'secret' : 'closed',
        members_count: 1,
        active_this_month: 0,
        created_by: authorId,
      };

      const { data: newClub, error } = await supabase
        .from('clubs')
        .insert(payload)
        .select()
        .single();

      if (error) {
        alert("Impossible de créer le club : " + (error.message || 'erreur serveur'));
        setSaving(false);
        return;
      }

      // Auto-join the creator as admin
      if (newClub?.id && authorId) {
        await supabase.from('club_members').insert({
          club_id: newClub.id,
          user_id: authorId,
          role: 'admin',
          status: 'active',
        }).then(undefined, () => {});
      }

      setSaveSuccess(true);

      // Persist to localStorage for instant local reflection
      try {
        const localClubs = JSON.parse(localStorage.getItem('user_clubs_data') || '[]');
        localClubs.push({ ...payload, id: newClub?.id || `local-${Date.now()}`, members_count: 1 });
        localStorage.setItem('user_clubs_data', JSON.stringify(localClubs));
        window.dispatchEvent(new Event('club_created'));
      } catch (e) {
        console.error(e);
      }

      setTimeout(() => {
        setSaveSuccess(false);
        if (newClub?.slug) {
          router.push(`/clubs/${newClub.slug}`);
        } else {
          router.push('/clubs');
        }
      }, 800);
    } catch (err) {
      console.error("Error creating club:", err);
      alert("Une erreur est survenue lors de la création du club.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => {
    try {
      const drafts = JSON.parse(localStorage.getItem('club_draft') || '[]');
      drafts.push({ ...form, slug: inviteSlug, savedAt: new Date().toISOString() });
      localStorage.setItem('club_draft', JSON.stringify(drafts.slice(-5)));
      alert('Brouillon enregistré localement !');
    } catch (e) {
      console.error(e);
      alert('Impossible d\'enregistrer le brouillon.');
    }
  };

  const handleRegenerateSlug = () => {
    setInviteSlug(`club-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString(36).slice(-4)}`);
  };

  return (
    <div className="min-h-screen bg-[#F5F2E8] font-sans text-[#1C2620] pb-28">
      
      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E8E4D8] px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/clubs" className="flex items-center gap-2 text-xs font-semibold text-[#5C6B5E] hover:text-[#1C2620] transition-colors">
            <Icon name="ArrowLeftIcon" size={16} />
            <span>Clubs</span>
          </Link>
          <span className="text-[#E8E4D8]">|</span>
          <span className="text-xs font-bold text-[#1C2620] uppercase tracking-wider">Créer un club</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-[#17402C] font-bold bg-[#17402C]/10 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#17402C]"></span>
            non publié
          </span>

          <button onClick={() => alert("Aperçu non disponible pour le moment.")} className="px-4 py-2 rounded-full text-xs font-bold text-[#2D5A3D] bg-[#EAF0EB] border border-[#2D5A3D]/20 hover:bg-[#2D5A3D] hover:text-white transition-colors">
            Aperçu
          </button>

          <button
            onClick={() => handlePublish(false)}
            disabled={saving || !form.title.trim()}
            className="px-5 py-2 bg-[#2D5A3D] hover:bg-[#1C2620] text-white rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>{saving ? 'Création...' : saveSuccess ? '✓ Créé !' : 'Créer le club'}</span>
          </button>
        </div>
      </header>

      {/* 2. HERO TITLE SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <div className="text-[10px] font-mono tracking-widest text-[#5C6B5E] uppercase font-bold mb-3 flex items-center gap-2">
          <span className="w-4 h-[1px] bg-[#5C6B5E]"></span>
          NOUVEAU CLUB
        </div>
        <h1 className="font-display font-800 text-4xl sm:text-5xl text-[#1C2620] tracking-tight mb-3">
          Une communauté <br className="hidden sm:inline" />
          <em className="font-serif italic font-normal text-[#2D5A3D]">qui marche ensemble.</em>
        </h1>
        <p className="text-xs sm:text-sm text-[#5C6B5E] max-w-2xl leading-relaxed font-serif italic">
          Un club rassemble des voyageurs autour d'une pratique ou d'un esprit. Il vit dans le temps, contrairement aux groupes d'une sortie.
        </p>
      </div>

      {/* 3. MAIN FORM & SIDEBAR GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: FORM SECTIONS (8 COLS) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* ─── SECTION 01: L'IDENTITÉ DU CLUB ──────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">L'identité du <em className="font-serif italic text-[#2D5A3D] font-normal">club</em></h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Le nom, la couverture, le logo. C'est ce que verront les voyageurs qui parcourent l'annuaire.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                01 · VISUELS
              </span>
            </div>

            {/* Cover Image Live Showcase Card */}
            <div className="relative rounded-2xl overflow-hidden min-h-[200px] sm:min-h-[250px] bg-[#1C2620] text-white flex flex-col justify-end group shadow-md border border-[#E8E4D8]">
              <img src={form.coverImage} alt="Couverture" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
              
              <div className="absolute top-4 left-4">
                <span className="bg-white/90 px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest text-[#1C2620] shadow-sm font-bold flex items-center gap-1.5">
                  <Icon name="EyeIcon" size={10} /> APERÇU SUR VOTRE CLUB
                </span>
              </div>

              <div className="absolute top-4 right-4 flex gap-2">
                <label className="px-3 py-1.5 bg-[#1C2620]/60 hover:bg-[#1C2620]/80 text-white text-[10px] font-bold rounded-full backdrop-blur-md cursor-pointer transition-colors flex items-center gap-1.5 border border-white/20">
                  <Icon name="CameraIcon" size={12} /> Couverture
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    if (e.target.files?.[0]) setField('coverImage', URL.createObjectURL(e.target.files[0]));
                  }} />
                </label>
              </div>

              <div className="relative z-10 p-5 sm:p-6 flex items-end justify-between w-full">
                <div className="flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0 border border-white overflow-hidden group cursor-pointer">
                    {form.logoImage ? (
                      <img src={form.logoImage} className="w-full h-full object-cover" />
                    ) : (
                      <Icon name="PhotoIcon" size={24} className="text-[#C8C3B0]" />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Icon name="CameraIcon" size={16} className="text-white" />
                    </div>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      if (e.target.files?.[0]) setField('logoImage', URL.createObjectURL(e.target.files[0]));
                    }} />
                  </div>
                  <div>
                    <h3 className="font-display font-800 text-2xl sm:text-3xl text-white tracking-tight leading-tight">
                      {form.title.split(' ')[0]} <em className="font-serif italic text-white/80">{form.title.split(' ').slice(1).join(' ')}</em>
                    </h3>
                    <p className="text-[10px] text-white/90 font-mono mt-0.5">
                      {form.location.split(',')[0]} • {form.category.split(' ')[0]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-center">
                  <div>
                    <div className="font-display font-800 text-xl">0</div>
                    <div className="text-[9px] font-mono tracking-widest uppercase text-white/70">MEMBRES</div>
                  </div>
                  <div className="w-[1px] h-6 bg-white/20"></div>
                  <div>
                    <div className="font-display font-800 text-xl">1</div>
                    <div className="text-[9px] font-mono tracking-widest uppercase text-white/70">ADMIN</div>
                  </div>
                  <div className="w-[1px] h-6 bg-white/20"></div>
                  <div>
                    <div className="font-display font-800 text-xl">--</div>
                    <div className="text-[9px] font-mono tracking-widest uppercase text-white/70">SORTIES</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nom du club *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  className="w-full bg-[#F5F2E8] border border-transparent rounded-2xl px-4 py-3 text-sm text-[#1C2620] font-bold focus:border-[#2D5A3D] focus:ring-1 focus:ring-[#2D5A3D] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block">Slogan / mantra en 1 phrase (recommandé)</label>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{form.slogan.length} / 60</span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  value={form.slogan}
                  onChange={e => setField('slogan', e.target.value)}
                  className="w-full bg-[#F5F2E8] border border-transparent rounded-2xl px-4 py-3 text-xs text-[#1C2620] font-serif italic focus:border-[#2D5A3D] focus:ring-1 focus:ring-[#2D5A3D] transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block">Description longue</label>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">{form.description.length} / 600</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={600}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  className="w-full bg-[#F5F2E8] border border-transparent rounded-2xl p-4 text-xs text-[#1C2620] leading-relaxed resize-none focus:border-[#2D5A3D] focus:ring-1 focus:ring-[#2D5A3D] transition-colors"
                />
              </div>
            </div>
          </div>


          {/* ─── SECTION 02: THÉMATIQUE & TERRAIN ─────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Thématique <em className="font-serif italic text-[#2D5A3D] font-normal">& terrain</em></h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Ce qui rassemble les voyageurs autour d'une pratique ou d'une région, et vos rythmes.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                02 · CADRE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Catégorie principale *</label>
                <div className="relative">
                  <input
                    list="categories-list"
                    value={form.category}
                    onChange={e => setField('category', e.target.value)}
                    placeholder="Saisissez ou choisissez une catégorie..."
                    className="w-full bg-[#F5F2E8] border border-transparent rounded-2xl px-4 py-3.5 text-xs text-[#1C2620] font-bold focus:border-[#2D5A3D] focus:ring-1 focus:ring-[#2D5A3D]"
                  />
                  <datalist id="categories-list">
                    <option value="Randonnée & bivouac" />
                    <option value="Alpinisme & glace" />
                    <option value="Vélo & cyclotourisme" />
                    <option value="Trail & running" />
                  </datalist>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Rythme des sorties</label>
                <div className="relative">
                  <select
                    value={form.rhythm}
                    onChange={e => setField('rhythm', e.target.value)}
                    className="w-full bg-[#F5F2E8] border border-transparent rounded-2xl px-4 py-3.5 text-xs text-[#1C2620] font-bold appearance-none cursor-pointer focus:border-[#2D5A3D] focus:ring-1 focus:ring-[#2D5A3D]"
                  >
                    <option value="Mensuel - 1 à 2 sorties">Mensuel - 1 à 2 sorties</option>
                    <option value="Hebdomadaire - 1 sortie par semaine">Hebdomadaire - 1 sortie par semaine</option>
                    <option value="Annuel - Quelques grandes expés">Annuel - Quelques grandes expés</option>
                  </select>
                  <Icon name="ChevronDownIcon" size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C6B5E] pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Zones géographiques couvertes *</label>
              <div className="flex flex-wrap gap-2">
                {availableZones.map(zone => {
                  const isSelected = form.zones.includes(zone);
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => toggleZone(zone)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isSelected 
                          ? 'bg-[#EAF0EB] text-[#2D5A3D] border border-[#2D5A3D]/30' 
                          : 'bg-white text-[#5C6B5E] border border-[#E8E4D8] hover:bg-[#F5F2E8]'
                      }`}
                    >
                      {isSelected && <Icon name="CheckIcon" size={10} className="text-[#2D5A3D]" />}
                      {zone}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Ville d'ancrage</label>
                <div className="relative">
                  <Icon name="MapPinIcon" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setField('location', e.target.value)}
                    className="w-full bg-[#F5F2E8] border border-transparent rounded-2xl pl-10 pr-4 py-3 text-xs text-[#1C2620] font-semibold focus:border-[#2D5A3D] focus:ring-1 focus:ring-[#2D5A3D]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nombre max de membres</label>
                <div className="relative flex items-center bg-[#F5F2E8] rounded-2xl overflow-hidden focus-within:ring-1 focus-within:ring-[#2D5A3D]">
                  <input
                    type="number"
                    value={form.maxMembers}
                    onChange={e => setField('maxMembers', parseInt(e.target.value) || 0)}
                    className="w-full bg-transparent border-none px-4 py-3 text-xs text-[#1C2620] font-semibold focus:ring-0"
                  />
                  <span className="text-[10px] text-[#5C6B5E] pr-4 whitespace-nowrap font-mono tracking-tight">Membres (Laissez vide pour infini)</span>
                </div>
              </div>
            </div>
          </div>


          {/* ─── SECTION 03: LES RÈGLES DU CLUB ───────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Les règles <em className="font-serif italic text-[#2D5A3D] font-normal">du club</em></h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Chaque membre s'y engage à l'inscription. 3 à 5 règles suffisent — visuelles, proactives, sans être infantilisantes.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                03 · CHARTE · CODE DE CONDUITE
              </span>
            </div>

            <div className="space-y-3">
              {form.rules.map((rule) => (
                <div key={rule.id} className="p-4 bg-white rounded-2xl border border-[#E8E4D8] flex gap-4 relative group items-center">
                    <button type="button" onClick={() => {
                        const newIcon = prompt("Nouvel icone SVG ou Emoji :", rule.icon);
                        if (newIcon) {
                          setForm(prev => ({ ...prev, rules: prev.rules.map(r => r.id === rule.id ? { ...r, icon: newIcon } : r) }));
                        }
                      }} className="w-10 h-10 bg-[#F5F2E8] rounded-full flex items-center justify-center shrink-0 cursor-pointer hover:bg-[#E8E4D8] transition-colors">
                      {rule.icon.length > 2 && !rule.icon.startsWith('<') ? <Icon name={rule.icon} size={18} className="text-[#1C2620]" /> : (rule.icon.startsWith('<') ? <span dangerouslySetInnerHTML={{__html: rule.icon}} /> : <span className="text-lg">{rule.icon}</span>)}
                    </button>
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={rule.title}
                        onChange={e => setForm(prev => ({ ...prev, rules: prev.rules.map(r => r.id === rule.id ? { ...r, title: e.target.value } : r) }))}
                        className="bg-transparent border-none text-sm font-bold text-[#1C2620] focus:ring-0 p-0 w-full mb-0.5"
                      />
                      <input
                        type="text"
                        value={rule.description}
                        onChange={e => setForm(prev => ({ ...prev, rules: prev.rules.map(r => r.id === rule.id ? { ...r, description: e.target.value } : r) }))}
                        className="bg-transparent border-none text-xs text-[#5C6B5E] focus:ring-0 p-0 w-full"
                      />
                    </div>
                  <button type="button" onClick={() => removeRule(rule.id)} className="p-2 text-[#C8C3B0] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Icon name="XMarkIcon" size={16} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addRule}
                className="w-full py-3 rounded-2xl border border-dashed border-[#E8E4D8] hover:border-[#2D5A3D] text-xs font-semibold text-[#5C6B5E] hover:text-[#1C2620] transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="PlusIcon" size={14} /> Ajouter une règle
              </button>
            </div>
          </div>


          {/* ─── SECTION 04: ADMINS & PERMISSIONS ────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Admins <em className="font-serif italic text-[#2D5A3D] font-normal">& permissions</em></h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Les admins organisent les sorties, valident les nouveaux membres et modèrent les échanges.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                04 · ÉQUIPE & DROITS
              </span>
            </div>

            <div className="space-y-3">
              {/* Admin list mock */}
              <div className="flex items-center justify-between bg-white border border-[#E8E4D8] p-3 rounded-2xl">
                <div className="flex items-center gap-3">
                  <img src={user?.profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200"} className="w-10 h-10 rounded-full object-cover" alt="Admin" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#1C2620]">{user?.profile?.full_name || 'Marceline Chevrier'}</span>
                      <span className="bg-[#2D5A3D] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">VOUS</span>
                    </div>
                    <p className="text-[10px] text-[#5C6B5E] font-mono">PROPRIÉTAIRE · Fondatrice</p>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-[#F5F2E8] rounded-lg text-xs font-semibold text-[#1C2620] flex items-center gap-1.5 cursor-pointer">
                          <select className="bg-transparent text-[10px] font-bold text-[#1C2620] border-none pr-6 cursor-pointer focus:ring-0">
                            <option>Fondatrice</option>
                            <option>Co-admin</option>
                            <option>Modératrice</option>
                          </select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white border border-[#E8E4D8] p-3 rounded-2xl">
                <div className="flex items-center gap-3">
                  <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200" className="w-10 h-10 rounded-full object-cover" alt="Co-admin" />
                  <div>
                    <span className="text-xs font-bold text-[#1C2620]">Laila Berrani</span>
                    <p className="text-[10px] text-[#5C6B5E] font-mono">ADMINISTRATRICE · Membre depuis : 2 ans</p>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-[#F5F2E8] rounded-lg text-xs font-semibold text-[#1C2620] flex items-center gap-1.5 cursor-pointer">
                  Co-admin <Icon name="ChevronDownIcon" size={12} />
                </div>
              </div>

              <div className="relative">
                      <div className="flex gap-2">
                        <input type="text" placeholder="Ajouter un membre par son nom..." className="flex-1 bg-[#F5F2E8] border-none rounded-xl text-xs px-4 py-3 focus:ring-0" />
                        <button type="button" onClick={() => alert('Invitation envoyée !')} className="bg-[#1C2620] text-white rounded-xl px-4 text-xs font-bold hover:bg-[#2D5A3D] transition-colors">Inviter</button>
                      </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[#F5F2E8]">
              {[
                { key: 'manualValidation', title: 'Validation manuelle des nouveaux membres', desc: 'Un admin valide chaque demande d\'adhésion.' },
                { key: 'membersCanCreateOutings', title: 'Les membres peuvent créer des sorties', desc: 'Sans cette option, seuls les admins organisent des sorties.' },
                { key: 'openDiscussionThread', title: 'Fil de discussion ouvert', desc: 'Les membres peuvent publier des messages libres dans le club.' }
              ].map(item => {
                const val = (form as any)[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-xs text-[#1C2620]">{item.title}</h4>
                      <p className="text-[10px] text-[#5C6B5E] mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setField(item.key, !val)}
                      className={`w-10 h-5 rounded-full transition-colors relative p-0.5 shrink-0 ${
                        val ? 'bg-[#2D5A3D]' : 'bg-[#E8E4D8]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        val ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>


          {/* ─── SECTION 05: VISIBILITÉ & ADHÉSION ────────────────────── */}
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#E8E4D8] shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
              <div>
                <h2 className="font-display font-800 text-xl text-[#1C2620]">Visibilité <em className="font-serif italic text-[#2D5A3D] font-normal">& adhésion</em></h2>
                <p className="text-xs text-[#5C6B5E] mt-0.5">Choisissez si votre club est ouvert à tous, sur invitation, ou entièrement caché de l'annuaire public.</p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase bg-[#F5F2E8] px-2.5 py-1 rounded-full text-[#5C6B5E]">
                05 · DROIT D'ACCÈS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'public', title: 'Public', desc: 'Visible dans l\'annuaire, ouvert aux demandes', icon: 'GlobeAltIcon' },
                { id: 'invite', title: 'Sur invitation', desc: 'Visible mais uniquement rejoignable via un lien', icon: 'EnvelopeOpenIcon' },
                { id: 'private', title: 'Privé', desc: 'Invisible de l\'annuaire, uniquement par lien secret', icon: 'LockClosedIcon' }
              ].map(item => {
                const isActive = form.visibility === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setField('visibility', item.id)}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                      isActive 
                        ? 'bg-[#EAF0EB] border-[#2D5A3D] shadow-sm ring-1 ring-[#2D5A3D]' 
                        : 'bg-[#F5F2E8] border-transparent hover:border-[#E8E4D8]'
                    }`}
                  >
                    <Icon name={item.icon} size={16} className={`mt-0.5 ${isActive ? 'text-[#2D5A3D]' : 'text-[#5C6B5E]'}`} />
                    <div>
                      <div className="font-bold text-xs text-[#1C2620]">{item.title}</div>
                      <div className="text-[10px] text-[#5C6B5E] mt-1 leading-snug">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Lien d'invitation</label>
              <div className="flex items-center gap-2 bg-[#F5F2E8] p-1.5 rounded-2xl border border-[#E8E4D8]">
                <span className="text-[10px] font-mono text-[#5C6B5E] pl-3 uppercase tracking-wider">LIEN SÉCURISÉ :</span>
                <input
                  type="text"
                  readOnly
                  value={inviteSlug}
                  className="bg-transparent border-none text-xs font-bold text-[#1C2620] focus:ring-0 p-1 flex-1 font-mono"
                />
                <button 
                  type="button" 
                  onClick={() => {
                    navigator.clipboard.writeText(inviteSlug);
                    alert("Lien copié dans le presse-papier !");
                  }}
                  className="px-4 py-2 bg-[#1C2620] text-white text-[10px] font-bold rounded-xl hover:bg-[#2D5A3D] transition-colors"
                >
                  Copier
                </button>
              </div>
              <div className="flex justify-between items-center mt-2 px-2">
                <span className="text-[10px] text-[#5C6B5E]">À partager en privé</span>
                <button type="button" onClick={handleRegenerateSlug} className="text-[10px] text-[#2D5A3D] font-bold underline">
                  Régénérer le lien
                </button>
              </div>
            </div>
          </div>

        </div>


        {/* RIGHT COLUMN: SIDEBAR WIDGETS (4 COLS) */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          
          {/* WIDGET 1: Info Box */}
          <div className="bg-white rounded-[2.5rem] p-6 border border-[#E8E4D8] shadow-sm space-y-3">
            <h3 className="font-display font-800 text-sm text-[#1C2620]">Créer un club</h3>
            <p className="text-xs text-[#5C6B5E] leading-relaxed">
              Un club rassemble des voyageurs autour d'une pratique ou d'un esprit, dans la durée. Après sa création, vous pourrez inviter les premiers membres et planifier une première sortie.
            </p>
          </div>

          {/* WIDGET 2: Checklist */}
          <div className="bg-white rounded-[2.5rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4">
            <h3 className="font-display font-800 text-sm text-[#1C2620]">À vérifier <em className="font-serif italic text-[#2D5A3D] font-normal">avant publication</em></h3>
            <p className="text-xs text-[#5C6B5E] leading-relaxed">
              6 éléments essentiels avant de rendre le club public. Les clubs sans description ou sans règles sont refusés par la modération.
            </p>

            <div className="space-y-3 pt-2">
              {[
                { label: 'Nom du club', done: form.title.length >= 3 },
                { label: 'Couverture majeure', done: !!form.coverImage },
                { label: 'Description longue', done: form.description.length >= 20 },
                { label: 'Au moins 3 règles', done: form.rules.length >= 3 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[#1C2620] font-medium">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? 'bg-[#2D5A3D] text-white' : 'bg-[#E8E4D8] text-transparent'}`}>
                      {item.done && <Icon name="CheckIcon" size={10} />}
                    </span>
                    {item.label}
                  </span>
                  <span className="text-[10px] font-mono text-[#5C6B5E]">FAIT</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[#C8C3B0] font-medium">
                    <span className="w-4 h-4 rounded-full border border-[#E8E4D8] flex items-center justify-center bg-[#F5F2E8]">
                    </span>
                    Inviter un premier membre
                  </span>
                  <span className="text-[9px] font-mono text-[#17402C] uppercase font-bold bg-[#17402C]/10 px-1.5 py-0.5 rounded">RECOMMANDÉ</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[#C8C3B0] font-medium">
                    <span className="w-4 h-4 rounded-full border border-[#E8E4D8] flex items-center justify-center bg-[#F5F2E8]">
                    </span>
                    Créer une première sortie
                  </span>
                  <span className="text-[9px] font-mono text-[#5C6B5E] uppercase tracking-wider">APRÈS CRÉATION</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F5F2E8]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold text-[#2D5A3D]">4 sur 6</span>
                <span className="text-[10px] font-mono text-[#5C6B5E]">Prêt à publier</span>
              </div>
              <div className="w-full bg-[#F5F2E8] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#2D5A3D] h-full transition-all duration-500 rounded-full" style={{ width: `66%` }} />
              </div>
            </div>
          </div>


          {/* WIDGET 3: Promo / Tip Box */}
          <div className="bg-[#1C2620] rounded-[2.5rem] p-6 text-white space-y-3 relative overflow-hidden shadow-lg border border-[#2D5A3D]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2D5A3D]/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="text-[10px] font-mono tracking-widest text-[#2D5A3D] uppercase font-bold relative z-10">AVIS DE VOYAGEUR</div>
            <h4 className="font-display font-800 text-sm relative z-10">Un club vit dans la durée.</h4>
            <p className="text-xs text-white/70 leading-relaxed relative z-10">
              Pour une sortie ponctuelle avec 5 amis, mieux vaut créer un groupe. Ce club est fait pour des mois d'aventures partagées.
            </p>
            <button type="button" onClick={() => router.push('/nouveau-groupe')} className="text-[10px] text-white font-bold underline decoration-white/30 hover:decoration-white transition-all pt-2 relative z-10">
              Créer un groupe/sortie →
            </button>
          </div>

        </div>

      </div>

      {/* 4. FLOATING BOTTOM BAR */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md text-[#1C2620] px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-6 border border-[#E8E4D8] max-w-2xl w-11/12 justify-between">
        <div className="text-xs text-[#5C6B5E] hidden sm:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2D5A3D]"></span>
          <strong>Prêt à publier :</strong> Les infos essentielles sont remplies
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2 text-xs font-semibold text-[#5C6B5E] hover:text-[#1C2620] transition-colors"
          >
            Enregistrer en brouillon
          </button>
          <button 
            type="button" 
            onClick={() => alert("Aperçu non disponible pour le moment.")}
            className="px-6 py-2 rounded-xl text-[#5C6B5E] text-sm font-bold hover:bg-[#F5F2E8] transition-colors"
          >
            Aperçu public
          </button>
          
          <button
            onClick={() => handlePublish(false)}
            disabled={saving || !form.title.trim()}
            className="px-6 py-2.5 bg-[#1C2620] hover:bg-[#2D5A3D] text-white rounded-full text-xs font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? 'Création...' : saveSuccess ? '✓ Créé !' : 'Créer le club'}
          </button>
        </div>
      </div>

    </div>
  );
}
