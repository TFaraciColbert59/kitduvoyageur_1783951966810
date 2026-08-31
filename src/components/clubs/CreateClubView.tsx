'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import CommunityHubNav from '@/components/social/CommunityHubNav';
import CompteBackground from '@/components/compte/CompteBackground';
import { createClient } from '@/lib/supabase/client';

export interface ClubRule {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export default function CreateClubView() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Form State
  const [form, setForm] = useState({
    title: 'Cimes partagées',
    slogan: 'Marcher ensemble en Chartreuse, sans se précipiter, avec le temps.',
    description: 'Un club ouvert aux marcheurs réguliers et curieux, autour du massif de la Chartreuse. Nos sorties sont mensuelles, en petit comité (max 12), avec toujours un temps de contemplation. Nous privilégions les jeunes membres qui débutent, sans négliger les journées d\'itinérance pour les plus expérimentés.',
    coverImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200',
    logoImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=200',
    location: 'Grenoble · Isère (38)',
    category: 'Randonnée & bivouac',
    level: 'Tous niveaux bienvenus',
    rhythm: 'Mensuel - 1 à 2 sorties',
    maxMembers: 50,
    zones: ['Chartreuse', 'Vercors', 'Belledonne'] as string[],
    rules: [
      { id: 'r1', title: 'Respecter l’esprit du groupe', description: 'Pas de chrono, nous prenons le temps d’apprécier.', icon: 'ShieldCheckIcon' },
      { id: 'r2', title: 'Prévenir 48h avant en cas d’annulation', description: 'Pour ne pas bloquer les réservations de refuges.', icon: 'ClockIcon' },
      { id: 'r3', title: 'L’Allure de tous', description: 'Le groupe s’adapte toujours au rythme commun.', icon: 'UserGroupIcon' },
      { id: 'r4', title: 'Accueillir les nouveaux', description: 'Un accompagnement bienveillant dès la première sortie.', icon: 'UserPlusIcon' }
    ] as ClubRule[],
    membershipType: 'validation', // 'open' | 'validation'
    feeType: 'gratuit', // 'gratuit' | 'annuel'
    feeAmount: 0,
    whatsappUrl: '',
    instagramUrl: '',
    stravaUrl: '',
    websiteUrl: '',
    visibility: 'public', // 'public' | 'invite'
  });

  const availableZones = ['Chartreuse', 'Vercors', 'Belledonne', 'Écrins', 'Mont-Blanc', 'Aravis', 'Beaufortain', 'Queyras', 'Bauges'];
  const availableLevels = ['Tous niveaux bienvenus', 'Débutant motivé', 'Intermédiaire régulier', 'Sportif & engagé', 'Expert haute montagne'];

  // Navigation sections à gauche
  const [activeSection, setActiveSection] = useState<'identite' | 'thematique' | 'regles' | 'adhesion' | 'reseaux'>('identite');
  const SECTIONS = [
    { id: 'identite' as const, label: 'Identité & Visuels', short: '01', desc: 'Nom, logo & couverture' },
    { id: 'thematique' as const, label: 'Thématique & Niveau', short: '02', desc: 'Discipline, massifs & rythme' },
    { id: 'regles' as const, label: 'Charte & Règles', short: '03', desc: `${form.rules.length} règles définies` },
    { id: 'adhesion' as const, label: 'Adhésion & Équipe', short: '04', desc: 'Droits & validation' },
    { id: 'reseaux' as const, label: 'Réseaux & Visibilité', short: '05', desc: 'WhatsApp, Strava & Accès' },
  ];

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
      description: 'Précisez l’esprit attendu pour les membres.',
      icon: 'ShieldCheckIcon'
    };
    setForm(prev => ({ ...prev, rules: [...prev.rules, newRule] }));
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name: form.title,
        description: form.description,
        cover_image: form.coverImage,
        category: form.category,
        location: form.location,
        is_private: form.visibility !== 'public',
        creator_id: user?.id,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from('clubs').insert([payload]).select().single();
      const clubId = data?.id || `club-${Date.now()}`;

      // Local storage backup
      const local = JSON.parse(localStorage.getItem('user_created_clubs') || '[]');
      const fullClub = { id: clubId, ...payload, ...form };
      localStorage.setItem('user_created_clubs', JSON.stringify([fullClub, ...local]));

      setSaveSuccess(true);
      setTimeout(() => {
        router.push(`/clubs/${clubId}`);
      }, 800);
    } catch (e) {
      console.error(e);
      router.push('/communaute?tab=clubs');
    } finally {
      setSaving(false);
    }
  };

  const checklistItems = [
    { label: 'Nom & Slogan', done: form.title.length >= 3 && form.slogan.length > 5 },
    { label: 'Couverture & Logo', done: !!form.coverImage && !!form.logoImage },
    { label: 'Description & Ville', done: form.description.length >= 20 && form.location.length > 2 },
    { label: 'Au moins 3 règles', done: form.rules.length >= 3 },
  ];
  const doneCount = checklistItems.filter(i => i.done).length;

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-transparent font-sans text-[#17402C] relative flex flex-col">
      <CompteBackground />
      <Header />

      <main className="flex-1 min-h-0 overflow-hidden w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-4 flex gap-5">
        {/* COLONNE GAUCHE (Nav & Stepper) - 230px */}
        <aside className="w-[230px] shrink-0 h-full max-h-full flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm select-none">
          {/* ── 1. ZONE HAUTE FIXE (Identité & Actions) ── */}
          <div className="shrink-0 space-y-2.5">
            <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/50">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 bg-white/80 border border-white shadow-xs">
                🎪
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-display font-bold text-xs sm:text-sm text-[#17402C] truncate leading-tight">
                  Création{' '}
                  <span className="font-serif italic font-normal text-[#5B7F55] text-xs">
                    Club
                  </span>
                </h4>
                <p className="text-[10px] font-mono text-[#5A7064] truncate mt-0.5">
                  Studio Collectif
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Link
                href="/clubs"
                className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
              >
                <Icon name="ArrowLeftIcon" size={12} />
                <span>Retour</span>
              </Link>

              <button
                type="button"
                onClick={() => window.print()}
                className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
              >
                <Icon name="PrinterIcon" size={12} />
                <span>Imprimer</span>
              </button>
            </div>
          </div>

          {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Stepper sans numéros/icônes) ── */}
          <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Étapes de création du club">
            <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1">
              Étapes de création
            </p>
            {SECTIONS.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                    isActive
                      ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                      : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
                  }`}
                >
                  <span className="truncate text-left">{sec.label}</span>
                  {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* ── 3. ZONE BASSE FIXE (Footer) ── */}
          <div className="shrink-0 pt-2 border-t border-[#17402C]/5 text-center">
            <span className="text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase">
              Le Kit du Voyageur · Studio Club
            </span>
          </div>
        </aside>

        {/* COLONNE CENTRALE (Formulaire dynamique) */}
        <div className="flex-1 min-w-0 h-full overflow-y-auto custom-scrollbar pr-2 space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-medium text-[#5C6B5E]">
            <Link href="/communaute" className="hover:text-[#17402C] transition-colors">Communauté</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
            <Link href="/communaute?tab=clubs" className="hover:text-[#17402C] transition-colors">Clubs</Link>
            <Icon name="ChevronRightIcon" size={12} className="text-[#5C6B5E]" />
            <span className="text-[#17402C] font-semibold">Créer un club</span>
          </div>

          {/* ÉTAPE 1: IDENTITÉ */}
          {activeSection === 'identite' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Identité, Visuels &amp; Ville</h2>
                  <p className="text-xs text-[#5C6B5E]">Définissez le nom, l’emblème, la couverture et le camp de base du club.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">01 · IDENTITÉ</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Nom du club *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                      placeholder="Ex : Les Cimes Sauvages"
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2.5 text-xs text-[#17402C] focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Ville / Camp de base *</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setField('location', e.target.value)}
                      placeholder="Ex : Grenoble · Isère"
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2.5 text-xs text-[#17402C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Slogan ou promesse en une phrase</label>
                  <input
                    type="text"
                    value={form.slogan}
                    onChange={(e) => setField('slogan', e.target.value)}
                    placeholder="Ex : Marcher ensemble en Chartreuse, sans se précipiter."
                    className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3.5 py-2.5 text-xs text-[#17402C]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Description détaillée &amp; Esprit du club</label>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="Décrivez les objectifs, le profil des membres, la philosophie des sorties..."
                    className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl p-3 text-xs text-[#17402C] focus:outline-none focus:ring-2 focus:ring-[#17402C]/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Photo de couverture (URL)</label>
                    <input
                      type="text"
                      value={form.coverImage}
                      onChange={(e) => setField('coverImage', e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Logo / Avatar du club (URL)</label>
                    <input
                      type="text"
                      value={form.logoImage}
                      onChange={(e) => setField('logoImage', e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('thematique')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold flex items-center gap-1"
                >
                  <span>Suivant : Thématique &amp; Niveau →</span>
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2: THÉMATIQUE */}
          {activeSection === 'thematique' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Pratique, Niveau &amp; Massifs</h2>
                  <p className="text-xs text-[#5C6B5E]">Précisez le cadre sportif, le rythme et les terrains explorés.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">02 · CADRE</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Discipline principale</label>
                    <select
                      value={form.category}
                      onChange={(e) => setField('category', e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    >
                      <option>Randonnée &amp; bivouac</option>
                      <option>Alpinisme &amp; haute montagne</option>
                      <option>Trail &amp; course nature</option>
                      <option>Bikepacking &amp; gravel</option>
                      <option>Ski de rando &amp; hivernale</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Niveau requis</label>
                    <select
                      value={form.level}
                      onChange={(e) => setField('level', e.target.value)}
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    >
                      {availableLevels.map(lvl => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Rythme des sorties</label>
                    <input
                      type="text"
                      value={form.rhythm}
                      onChange={(e) => setField('rhythm', e.target.value)}
                      placeholder="Ex : 1 à 2 sorties/mois"
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Massifs de prédilection</label>
                  <div className="flex flex-wrap gap-2">
                    {availableZones.map((z) => {
                      const isSelected = form.zones.includes(z);
                      return (
                        <button
                          key={z}
                          type="button"
                          onClick={() => toggleZone(z)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-[#17402C] text-white shadow-xs'
                              : 'bg-white/80 text-[#5C6B5E] border border-[#17402C]/10 hover:border-[#17402C]/30'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '} {z}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-[#17402C] mb-1">Capacité maximale du club</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={200}
                      step={10}
                      value={form.maxMembers}
                      onChange={(e) => setField('maxMembers', parseInt(e.target.value))}
                      className="flex-1 accent-[#17402C]"
                    />
                    <span className="font-mono text-xs font-bold text-[#17402C] w-24 text-right">
                      {form.maxMembers} membres
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('identite')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('regles')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Charte &amp; Règles →
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 3: RÈGLES */}
          {activeSection === 'regles' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Charte &amp; Règles du club</h2>
                  <p className="text-xs text-[#5C6B5E]">Chaque membre s’y engage à l’adhésion pour garantir l'esprit d'équipe.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">03 · CHARTE</span>
              </div>

              <div className="space-y-3">
                {form.rules.map((rule) => (
                  <div key={rule.id} className="p-3.5 glass-sub-card rounded-xl flex items-center gap-3 bg-white/90">
                    <span className="text-xl">🛡️</span>
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={rule.title}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          rules: prev.rules.map(r => r.id === rule.id ? { ...r, title: e.target.value } : r)
                        }))}
                        className="bg-transparent border-none text-xs font-bold text-[#17402C] focus:ring-0 p-0 w-full"
                      />
                      <input
                        type="text"
                        value={rule.description}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          rules: prev.rules.map(r => r.id === rule.id ? { ...r, description: e.target.value } : r)
                        }))}
                        className="bg-transparent border-none text-[11px] text-[#5C6B5E] focus:ring-0 p-0 w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRule(rule.id)}
                      className="text-[#5C6B5E] hover:text-red-600 p-1"
                    >
                      <Icon name="XMarkIcon" size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addRule}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#17402C]/20 hover:border-[#17402C] text-xs font-bold text-[#17402C] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Icon name="PlusIcon" size={14} /> Ajouter une règle à la charte
                </button>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('thematique')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('adhesion')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Adhésion &amp; Équipe →
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 4: ADHÉSION & ÉQUIPE */}
          {activeSection === 'adhesion' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Adhésion &amp; Cotisation</h2>
                  <p className="text-xs text-[#5C6B5E]">Paramétrez l’accès des membres et la gestion des sorties.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">04 · ADHÉSION</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Modalité d'inscription</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'validation', label: '🛡️ Sur validation', desc: 'Le fondateur ou les modérateurs valident chaque demande.' },
                      { id: 'open', label: '⚡ Inscription libre', desc: 'Tout membre de la communauté peut rejoindre directement.' },
                    ].map((m) => (
                      <label
                        key={m.id}
                        className={`p-3.5 rounded-xl cursor-pointer flex items-start gap-2.5 transition-all ${
                          form.membershipType === m.id
                            ? 'bg-white border-2 border-[#17402C] shadow-xs'
                            : 'bg-white/60 border border-[#17402C]/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name="membership_type"
                          value={m.id}
                          checked={form.membershipType === m.id}
                          onChange={() => setField('membershipType', m.id)}
                          className="mt-0.5 text-[#17402C]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#17402C] block">{m.label}</span>
                          <span className="text-[10.5px] text-[#5C6B5E] block">{m.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Cotisation</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`p-3 rounded-xl cursor-pointer flex items-center gap-2 ${form.feeType === 'gratuit' ? 'bg-white border-2 border-[#17402C]' : 'bg-white/60 border border-[#17402C]/10'}`}>
                      <input
                        type="radio"
                        name="fee_type"
                        checked={form.feeType === 'gratuit'}
                        onChange={() => setField('feeType', 'gratuit')}
                        className="text-[#17402C]"
                      />
                      <span className="text-xs font-bold text-[#17402C]">🎁 Gratuit (100% bénévole)</span>
                    </label>

                    <label className={`p-3 rounded-xl cursor-pointer flex items-center gap-2 ${form.feeType === 'annuel' ? 'bg-white border-2 border-[#17402C]' : 'bg-white/60 border border-[#17402C]/10'}`}>
                      <input
                        type="radio"
                        name="fee_type"
                        checked={form.feeType === 'annuel'}
                        onChange={() => setField('feeType', 'annuel')}
                        className="text-[#17402C]"
                      />
                      <span className="text-xs font-bold text-[#17402C]">💶 Adhésion annuelle club</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('regles')}
                  className="glass-capsule-btn py-2 px-4 text-xs font-bold"
                >
                  ← Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('reseaux')}
                  className="glass-capsule-btn primary py-2 px-5 text-xs font-bold"
                >
                  Suivant : Réseaux &amp; Visibilité →
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 5: RÉSEAUX & VISIBILITÉ */}
          {activeSection === 'reseaux' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                <div>
                  <h2 className="font-display font-bold text-lg text-[#17402C]">Réseaux &amp; Visibilité du Club</h2>
                  <p className="text-xs text-[#5C6B5E]">Liez vos canaux externes (WhatsApp, Strava, Instagram) et publiez le club.</p>
                </div>
                <span className="glass-pill text-[9px] font-mono font-bold">05 · RÉSEAUX</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Lien Groupe WhatsApp / Discord</label>
                    <input
                      type="text"
                      value={form.whatsappUrl}
                      onChange={(e) => setField('whatsappUrl', e.target.value)}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#17402C] mb-1">Compte Instagram / Strava</label>
                    <input
                      type="text"
                      value={form.instagramUrl}
                      onChange={(e) => setField('instagramUrl', e.target.value)}
                      placeholder="https://instagram.com/..."
                      className="w-full bg-white/90 border border-[#17402C]/15 rounded-xl px-3 py-2 text-xs text-[#17402C]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-bold text-[#17402C] mb-2">Visibilité du club</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'public', label: '🌍 Public LKDV', desc: 'Visible dans l’annuaire communautaire et sur la carte.' },
                      { id: 'invite', label: '🔗 Privé / Sur invitation', desc: 'Accessible uniquement via lien de parrainage.' },
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
                          name="club_visibility"
                          value={vis.id}
                          checked={form.visibility === vis.id}
                          onChange={() => setField('visibility', vis.id)}
                          className="mt-0.5 text-[#17402C]"
                        />
                        <div>
                          <span className="text-xs font-bold text-[#17402C] block">{vis.label}</span>
                          <span className="text-[10.5px] text-[#5C6B5E] block">{vis.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('adhesion')}
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
                  <span className="relative z-10">{saving ? 'Création...' : saveSuccess ? '✓ Créé !' : 'Fonder le club'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLONNE DROITE (Live Preview & Validation Checklist) - 300px */}
        <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 pb-8">
          {/* Live Preview Mini Card */}
          <div className="glass p-3.5 space-y-3 rounded-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs text-[#17402C]">Aperçu en direct</h3>
              <span className="glass-pill text-[9px] font-mono font-bold">Live</span>
            </div>

            <div className="rounded-xl overflow-hidden bg-white border border-[#17402C]/10 shadow-xs flex flex-col">
              <div className="h-28 relative bg-[#17402C]">
                {form.coverImage && (
                  <img src={form.coverImage} alt="Cover" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full text-[9px] font-mono text-white font-bold">
                  {form.category}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-sm text-[#17402C] leading-snug">
                    {form.title || 'Nom du club'}
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-semibold text-[#17402C] block">
                  📍 {form.location}
                </span>
                <p className="text-[10px] text-[#5C6B5E] line-clamp-2">
                  {form.slogan || form.description}
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-[#17402C]/10 text-[9px] font-mono text-[#5C6B5E]">
                  <span>{form.level}</span>
                  <span>{form.rules.length} règles</span>
                </div>
              </div>
            </div>
          </div>

          {/* Checklist avant publication */}
          <div className="glass p-3.5 space-y-2.5 rounded-2xl text-[#17402C]">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-xs text-[#17402C]">Checklist Club</h3>
              <span className="font-mono text-[9px] font-bold text-[#17402C]">{doneCount}/4</span>
            </div>

            <div className="space-y-1.5 text-xs">
              {checklistItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-[#17402C]">
                    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                      item.done ? 'bg-[#17402C] text-white' : 'bg-black/10 text-transparent'
                    }`}>
                      {item.done && '✓'}
                    </span>
                    {item.label}
                  </span>
                  <span className="font-mono text-[9px] text-[#5C6B5E]">
                    {item.done ? 'OK' : 'À faire'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#17402C]/10">
              <button
                type="button"
                onClick={handlePublish}
                disabled={saving || !form.title.trim()}
                className="w-full glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Icon name="PlusIcon" size={13} className="relative z-10" />
                <span className="relative z-10">{saving ? 'Création...' : 'Fonder le club'}</span>
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
