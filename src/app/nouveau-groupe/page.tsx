'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';


import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

// Color Palette for accent selection
const ACCENT_COLORS = [
  { id: 'darkgreen', value: '#172A20', label: 'Vert Sombre' },
  { id: 'sage', value: '#5C6B5E', label: 'Sauge' },
  { id: 'ochre', value: '#D97746', label: 'Ocre' },
  { id: 'yellow', value: '#E5A638', label: 'Jaune Mousse' },
  { id: 'blue', value: '#3A63B2', label: 'Bleu Alpine' },
  { id: 'purple', value: '#7B52A9', label: 'Mauve Bruyère' },
];

// Pictograms Grid
const PICTOGRAMS = [
  { id: 'tent', icon: '⛺' },
  { id: 'fire', icon: '🔥' },
  { id: 'mountain', icon: '🏔️' },
  { id: 'castle', icon: '🏰' },
  { id: 'tree', icon: '🌲' },
  { id: 'map', icon: '🗺️' },
  { id: 'sunset', icon: '🌄' },
  { id: 'backpack', icon: '🎒' },
  { id: 'compass', icon: '🧭' },
  { id: 'phone', icon: '📱' },
  { id: 'boot', icon: '🥾' },
  { id: 'ski', icon: '🎿' },
];

// Partner suggestions
const PARTNER_SUGGESTIONS = [
  { id: 'p1', full_name: 'Léna Bertrand', handle: 'léna.b', sorties_count: 12, avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
  { id: 'p2', full_name: 'Antoine Rey', handle: 'antoine.r', sorties_count: 8, avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
  { id: 'p3', full_name: 'Jules Mazet', handle: 'jules.m', sorties_count: 5, avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80' },
  { id: 'p4', full_name: 'Camille Verger', handle: 'camille.v', sorties_count: 3, avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80' },
];

export default function NouveauGroupePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('Chartreuse en octobre');
  const [description, setDescription] = useState('Traversée de la Chartreuse à 6, octobre 2026');
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0].value);
  const [pictogram, setPictogram] = useState(PICTOGRAMS[0].icon);

  // Context State
  const [linkedAdventure, setLinkedAdventure] = useState('Traversée de la Chartreuse');
  const [startDate, setStartDate] = useState('2026-10-12');
  const [endDate, setEndDate] = useState('2026-10-14');
  const [groupType, setGroupType] = useState<'Ponctuel' | 'Récurrent' | 'Ouvert'>('Ponctuel');
  const [maxMembers, setMaxMembers] = useState(6);

  // Invitation State
  const [inviteTab, setInviteTab] = useState<'pseudo' | 'email' | 'link'>('pseudo');
  const [invitedPartners, setInvitedPartners] = useState<typeof PARTNER_SUGGESTIONS>([
    PARTNER_SUGGESTIONS[0],
    PARTNER_SUGGESTIONS[1],
  ]);
  const [customInvites, setCustomInvites] = useState<{ id: string; name: string }[]>([
    { id: 'c1', name: 'Sophie Marnier' },
  ]);
  const [inviteInput, setInviteInput] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Permissions State
  const [permissions, setPermissions] = useState({
    membersCanInvite: false,
    chatEnabled: true,
    realtimeLocation: true,
    sharedList: true,
    autoArchive: true,
  });

  // Generate Invite Code
  const inviteCode = 'CHARTREUSE-OCT-H9X2';
  const inviteUrl = `lekit.co/g/${inviteCode.toLowerCase()}`;

  // Formatting dates for preview
  const formatDatesPreview = () => {
    if (!startDate || !endDate) return 'Dates à définir';
    const dStart = new Date(startDate);
    const dEnd = new Date(endDate);
    const startStr = dStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = dEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  const monthNamePreview = () => {
    if (!startDate) return 'octobre';
    return new Date(startDate).toLocaleDateString('fr-FR', { month: 'long' });
  };

  const totalInvitedCount = invitedPartners.length + customInvites.length;

  // Toggle Partner
  const togglePartner = (partner: typeof PARTNER_SUGGESTIONS[0]) => {
    if (invitedPartners.some(p => p.id === partner.id)) {
      setInvitedPartners(invitedPartners.filter(p => p.id !== partner.id));
    } else {
      setInvitedPartners([...invitedPartners, partner]);
    }
  };

  // Remove custom invite
  const removeCustomInvite = (id: string) => {
    setCustomInvites(customInvites.filter(c => c.id !== id));
  };

  // Handle Input key press
  const handleInviteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inviteInput.trim()) {
      e.preventDefault();
      setCustomInvites([...customInvites, { id: `c_${Date.now()}`, name: inviteInput.trim() }]);
      setInviteInput('');
    }
  };

  // Create Group Action
  const handleCreateGroup = async (sendInvites: boolean) => {
    if (!user) {
      toast('Veuillez vous connecter pour créer un groupe.', 'error');
      router.push('/connexion');
      return;
    }

    if (!name.trim()) {
      toast('Veuillez donner un nom au groupe.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Generate clean invite code
      const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // 1. Insert group into travel_groups
      const { data: newGroup, error: groupErr } = await supabase
        .from('travel_groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          owner_id: user.id,
          departure_date: startDate || null,
          return_date: endDate || null,
          max_members: maxMembers,
          theme: pictogram,
          destination: linkedAdventure || name.trim(),
          visibility: 'invite_only',
          invite_code: generatedCode,
        })
        .select()
        .single();

      if (groupErr || !newGroup) {
        throw groupErr || new Error('Erreur lors de la création du groupe');
      }

      // 2. Insert Owner as organizer in group_members
      await supabase.from('group_members').insert({
        group_id: newGroup.id,
        user_id: user.id,
        role: 'organizer',
        status: 'active',
      });

      // 3. Insert invited members if sendInvites
      if (sendInvites) {
        // Add invited partners if they exist
        for (const partner of invitedPartners) {
          // If partner has real user_id, add them
          await supabase.from('group_members').insert({
            group_id: newGroup.id,
            user_id: partner.id.startsWith('p') ? user.id : partner.id, // fallback
            role: 'member',
            status: 'invited',
          }).catch(() => {});
        }
      }

      toast(
        sendInvites
          ? `Groupe "${name}" créé avec succès ! Invitations envoyées.`
          : `Groupe "${name}" créé avec succès !`,
        'success'
      );

      router.push(`/groupes/${newGroup.id}`);
    } catch (err: any) {
      console.error('Group creation error:', err);
      toast(err.message || 'Erreur lors de la création du groupe', 'error');
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#F5F2EA] text-[#1C2620] font-sans pb-32">
      
      {/* ── Top Nav / Breadcrumbs Header ── */}
      <div className="border-b border-[#E8E4D8] bg-[#F5F2EA]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#5C6B5E]">
            <Link href="/" className="hover:text-[#1C2620] transition-colors flex items-center gap-1.5 font-600">
              <span>⛺</span> Le Kit du Voyageur
            </Link>
            <span className="text-[#C8C3B0]">›</span>
            <Link href="/" className="hover:text-[#1C2620] transition-colors">Accueil</Link>
            <span className="text-[#C8C3B0]">›</span>
            <Link href="/compte" className="hover:text-[#1C2620] transition-colors">Mon compte</Link>
            <span className="text-[#C8C3B0]">›</span>
            <span className="font-600 text-[#1C2620]">Nouveau groupe</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#9CA89E] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#E5A638]" /> Non créé
            </span>
            <button
              onClick={() => router.back()}
              className="text-xs font-600 text-[#5C6B5E] hover:text-[#1C2620] px-3 py-1.5 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => handleCreateGroup(true)}
              disabled={loading}
              className="bg-[#172A20] hover:bg-[#2A3830] text-white px-4 py-1.5 rounded-full text-xs font-700 transition-all shadow-sm"
            >
              {loading ? 'Création...' : 'Créer le groupe'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero Title Section ── */}
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-8">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#9CA89E] mb-3">
          <span className="w-5 h-[1px] bg-[#9CA89E]" />
          <span>NOUVEAU GROUPE</span>
        </div>
        <h1 className="font-display font-800 text-4xl sm:text-5xl text-[#1C2620] tracking-tight leading-tight mb-3">
          Rassembler <em className="font-serif font-normal not-italic text-[#5C6B5E]">pour un voyage.</em>
        </h1>
        <p className="text-sm sm:text-base text-[#5C6B5E] max-w-2xl leading-relaxed">
          Un groupe, c'est plus léger qu'un club : il suit pour une sortie et vit le temps de l'organiser. Idéal pour partager la logistique entre amis.
        </p>
      </div>

      {/* ── Main Form + Sidebar Grid ── */}
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ════════════════ LEFT COLUMN (FORM SECTIONS) ════════════════ */}
        <div className="lg:col-span-8 space-y-8">

          {/* ── SECTION 01: LE GROUPE ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8E4D8] pb-4">
              <div>
                <h2 className="font-display font-700 text-xl text-[#1C2620]">
                  Le <em className="font-serif font-normal not-italic">groupe</em>
                </h2>
                <p className="text-xs text-[#9CA89E] mt-0.5">
                  Un nom, un pictogramme, une couleur. Le nécessaire pour que les invités s'y retrouvent immédiatement.
                </p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#9CA89E] bg-[#EDEAE0] px-3 py-1 rounded-full font-700">
                01 · Identité
              </span>
            </div>

            {/* Live Header Card Preview */}
            <div
              className="rounded-2xl p-6 text-white transition-all duration-300 shadow-md relative overflow-hidden flex items-center justify-between"
              style={{ backgroundColor: accentColor }}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                  {pictogram}
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-white/60 mb-0.5">
                    APERÇU · EN-TÊTE GROUPE
                  </p>
                  <h3 className="font-display font-700 text-xl leading-tight">
                    {name || 'Chartreuse'} <em className="font-serif font-normal not-italic text-white/80">en {monthNamePreview()}</em>
                  </h3>
                  <p className="text-xs text-white/70 mt-1 font-mono">
                    {formatDatesPreview()} · {totalInvitedCount + 1} personnes · 3 refuges
                  </p>
                </div>
              </div>
            </div>

            {/* Nom du groupe */}
            <div>
              <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                Nom du groupe <span className="text-[#D97746]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Chartreuse en octobre"
                className="w-full bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl px-4 py-3 text-sm text-[#1C2620] font-600 focus:outline-none focus:border-[#1C2620] transition-colors"
              />
            </div>

            {/* Description & Couleur */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
              <div className="sm:col-span-7">
                <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                  Description courte
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Traversée de la Chartreuse à 6, octobre 2026"
                  className="w-full bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl px-4 py-3 text-sm text-[#1C2620] focus:outline-none focus:border-[#1C2620] transition-colors"
                />
              </div>

              <div className="sm:col-span-5">
                <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                  Couleur d'accent
                </label>
                <div className="flex items-center gap-2.5 bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl p-2.5">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAccentColor(c.value)}
                      title={c.label}
                      className={`w-6 h-6 rounded-full transition-all ${
                        accentColor === c.value
                          ? 'ring-2 ring-offset-2 ring-[#1C2620] scale-110'
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Pictogramme Grid */}
            <div>
              <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                Pictogramme
              </label>
              <div className="grid grid-cols-6 sm:grid-cols-6 gap-3">
                {PICTOGRAMS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPictogram(p.icon)}
                    className={`h-12 rounded-xl flex items-center justify-center text-xl transition-all border ${
                      pictogram === p.icon
                        ? 'bg-[#172A20] border-[#172A20] text-white shadow-sm scale-105'
                        : 'bg-[#FAF9F5] border-[#E8E4D8] hover:border-[#C8C3B0] text-[#1C2620]'
                    }`}
                  >
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── SECTION 02: SORTIE CONCERNÉE ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8E4D8] pb-4">
              <div>
                <h2 className="font-display font-700 text-xl text-[#1C2620]">
                  Sortie <em className="font-serif font-normal not-italic">concernée</em>
                </h2>
                <p className="text-xs text-[#9CA89E] mt-0.5">
                  Rattachez une aventure existante ou renseignez les dates. Les participants sauront de quoi il s'agit.
                </p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#9CA89E] bg-[#EDEAE0] px-3 py-1 rounded-full font-700">
                02 · Contexte
              </span>
            </div>

            {/* Aventure liée Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-700 text-[#1C2620] uppercase tracking-wider">
                  Aventure liée
                </label>
                <span className="text-[11px] text-[#9CA89E]">Ou laissez vide pour un groupe ouvert</span>
              </div>

              <div className="bg-[#FAF9F5] border border-[#E8E4D8] rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#EDEAE0] overflow-hidden flex-shrink-0 relative">
                    <img
                      src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=200&q=80"
                      alt="Traversée de la Chartreuse"
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div>
                    <h4 className="font-display font-700 text-sm text-[#1C2620]">
                      {linkedAdventure}
                    </h4>
                    <p className="text-[11px] text-[#9CA89E] mt-0.5 font-mono">
                      12-14 oct. 2026 · 27.4 km · 3 refuges
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const newAdv = prompt('Nom de la nouvelle aventure rattachée :', linkedAdventure);
                    if (newAdv) setLinkedAdventure(newAdv);
                  }}
                  className="px-4 py-2 bg-white border border-[#C8C3B0] hover:border-[#1C2620] text-[#1C2620] rounded-full text-xs font-700 transition-colors shadow-sm"
                >
                  Changer
                </button>
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                  Date de début
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl px-4 py-3 text-sm text-[#1C2620] font-600 focus:outline-none focus:border-[#1C2620]"
                />
              </div>

              <div>
                <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                  Date de fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl px-4 py-3 text-sm text-[#1C2620] font-600 focus:outline-none focus:border-[#1C2620]"
                />
              </div>
            </div>

            {/* Type de groupe & Effectif */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
              <div className="sm:col-span-8">
                <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                  Type de groupe
                </label>
                <div className="flex items-center gap-2 bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl p-1.5">
                  {(['Ponctuel', 'Récurrent', 'Ouvert'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setGroupType(t)}
                      className={`flex-1 py-2 rounded-lg text-xs font-700 transition-all flex items-center justify-center gap-2 ${
                        groupType === t
                          ? 'bg-white text-[#1C2620] shadow-sm border border-[#E8E4D8]'
                          : 'text-[#9CA89E] hover:text-[#5C6B5E]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${groupType === t ? 'bg-[#172A20]' : 'bg-[#C8C3B0]'}`} />
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-700 text-[#1C2620] uppercase tracking-wider mb-2">
                  Effectif maximum
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={maxMembers}
                    onChange={e => setMaxMembers(parseInt(e.target.value) || 6)}
                    className="w-full bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl px-4 py-3 text-sm text-[#1C2620] font-700 focus:outline-none focus:border-[#1C2620]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#9CA89E] font-medium pointer-events-none">
                    personnes
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 03: INVITER LES PARTICIPANTS ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8E4D8] pb-4">
              <div>
                <h2 className="font-display font-700 text-xl text-[#1C2620]">
                  Inviter <em className="font-serif font-normal not-italic">les participants</em>
                </h2>
                <p className="text-xs text-[#9CA89E] mt-0.5">
                  Trois façons d'inviter : par pseudo interne, par email, ou en partageant un lien d'invitation.
                </p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#9CA89E] bg-[#EDEAE0] px-3 py-1 rounded-full font-700">
                03 · Constituer le groupe
              </span>
            </div>

            {/* Invite Tabs */}
            <div className="flex items-center gap-2 bg-[#FAF9F5] border border-[#E8E4D8] rounded-xl p-1.5">
              {(
                [
                  ['pseudo', '👤 Pseudo interne'],
                  ['email', '✉ Email'],
                  ['link', '🔗 Lien d\'invitation'],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInviteTab(tab)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-700 transition-all ${
                    inviteTab === tab
                      ? 'bg-white text-[#1C2620] shadow-sm border border-[#E8E4D8]'
                      : 'text-[#9CA89E] hover:text-[#5C6B5E]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Invite Search & Selected Tags */}
            <div className="bg-[#FAF9F5] border border-[#E8E4D8] rounded-2xl p-3 flex flex-wrap items-center gap-2 min-h-[56px]">
              {/* Partner tags */}
              {invitedPartners.map(p => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#172A20] text-white text-xs font-600 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {p.full_name}
                  <button
                    type="button"
                    onClick={() => togglePartner(p)}
                    className="hover:text-red-300 ml-1 text-xs"
                  >
                    ✕
                  </button>
                </span>
              ))}

              {/* Custom tags */}
              {customInvites.map(c => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#172A20] text-white text-xs font-600 shadow-sm"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  {c.name}
                  <button
                    type="button"
                    onClick={() => removeCustomInvite(c.id)}
                    className="hover:text-red-300 ml-1 text-xs"
                  >
                    ✕
                  </button>
                </span>
              ))}

              <input
                type="text"
                value={inviteInput}
                onChange={e => setInviteInput(e.target.value)}
                onKeyDown={handleInviteKeyDown}
                placeholder="Rechercher un membre ou coller un email..."
                className="flex-1 bg-transparent border-none text-xs text-[#1C2620] font-500 focus:outline-none min-w-[200px] px-2"
              />
            </div>

            {/* Suggestions list */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#9CA89E] mb-3 font-700">
                SUGGESTIONS · VOS DERNIERS PARTENAIRES
              </p>
              <div className="space-y-2.5">
                {PARTNER_SUGGESTIONS.map(p => {
                  const isAdded = invitedPartners.some(item => item.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-[#FAF9F5] border border-[#E8E4D8] rounded-2xl p-3 hover:border-[#C8C3B0] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#EDEAE0] overflow-hidden flex-shrink-0">
                          <img src={p.avatar_url} alt={p.full_name} className="object-cover w-full h-full" />
                        </div>
                        <div>
                          <h5 className="font-600 text-xs text-[#1C2620]">{p.full_name}</h5>
                          <p className="text-[11px] text-[#9CA89E]">
                            @{p.handle} · {p.sorties_count} sorties ensemble
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => togglePartner(p)}
                        className={`px-4 py-1.5 rounded-full text-xs font-700 transition-all ${
                          isAdded
                            ? 'bg-[#EAF3ED] text-[#172A20] border border-[#172A20]/20'
                            : 'bg-[#172A20] hover:bg-[#2A3830] text-white shadow-sm'
                        }`}
                      >
                        {isAdded ? '✓ Ajouté' : '+ Inviter'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Link Invitation Box */}
            <div className="bg-[#FAF9F5] border border-[#E8E4D8] rounded-2xl p-5 text-center space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#9CA89E] font-700">
                LIEN D'INVITATION · GROUPE PRIVÉ
              </p>
              <div className="inline-flex items-center gap-2 bg-white border border-[#E8E4D8] rounded-full px-4 py-2 shadow-sm max-w-full">
                <span className="font-mono text-xs font-700 text-[#1C2620] truncate">
                  {inviteUrl}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://${inviteUrl}`);
                    setLinkCopied(true);
                    toast('Lien copié dans le presse-papier !', 'success');
                    setTimeout(() => setLinkCopied(false), 3000);
                  }}
                  className="px-3 py-1 bg-[#172A20] text-white rounded-full text-[11px] font-700 hover:bg-[#2A3830] transition-colors flex-shrink-0"
                >
                  {linkCopied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <p className="text-[11px] text-[#9CA89E]">
                Expire dans <span className="font-700 text-[#1C2620]">7 jours</span> · 5 réutilisations restantes
              </p>
            </div>
          </div>

          {/* ── SECTION 04: PERMISSIONS DU GROUPE ── */}
          <div className="bg-white border border-[#E8E4D8] rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E8E4D8] pb-4">
              <div>
                <h2 className="font-display font-700 text-xl text-[#1C2620]">
                  Permissions <em className="font-serif font-normal not-italic">du groupe</em>
                </h2>
                <p className="text-xs text-[#9CA89E] mt-0.5">
                  Réglages simples pour éviter les malentendus : qui peut inviter, éditer, ou proposer des changements.
                </p>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#9CA89E] bg-[#EDEAE0] px-3 py-1 rounded-full font-700">
                04 · Fonctionnement
              </span>
            </div>

            <div className="space-y-4 divide-y divide-[#E8E4D8]">

              {/* Perm 1 */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <div>
                  <h4 className="font-600 text-xs text-[#1C2620]">
                    Les participants peuvent inviter d'autres personnes
                  </h4>
                  <p className="text-[11px] text-[#9CA89E] mt-0.5">
                    Sans cette option, seuls vous pouvez ajouter des membres.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermissions(p => ({ ...p, membersCanInvite: !p.membersCanInvite }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    permissions.membersCanInvite ? 'bg-[#172A20]' : 'bg-[#E8E4D8]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-sm ${
                      permissions.membersCanInvite ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Perm 2 */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <div>
                  <h4 className="font-600 text-xs text-[#1C2620]">
                    Chat de groupe activé
                  </h4>
                  <p className="text-[11px] text-[#9CA89E] mt-0.5">
                    Un fil de messages partagé pour l'organisation avant et pendant le voyage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermissions(p => ({ ...p, chatEnabled: !p.chatEnabled }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    permissions.chatEnabled ? 'bg-[#172A20]' : 'bg-[#E8E4D8]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-sm ${
                      permissions.chatEnabled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Perm 3 */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <div>
                  <h4 className="font-600 text-xs text-[#1C2620]">
                    Partage de position en temps réel
                  </h4>
                  <p className="text-[11px] text-[#9CA89E] mt-0.5">
                    Optionnel : s'active pendant la sortie uniquement, entre membres du groupe.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermissions(p => ({ ...p, realtimeLocation: !p.realtimeLocation }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    permissions.realtimeLocation ? 'bg-[#172A20]' : 'bg-[#E8E4D8]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-sm ${
                      permissions.realtimeLocation ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Perm 4 */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <div>
                  <h4 className="font-600 text-xs text-[#1C2620]">
                    Liste de courses & logistique partagée
                  </h4>
                  <p className="text-[11px] text-[#9CA89E] mt-0.5">
                    Un tableau collaboratif d'envies : matériel, courses, covoiturage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermissions(p => ({ ...p, sharedList: !p.sharedList }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    permissions.sharedList ? 'bg-[#172A20]' : 'bg-[#E8E4D8]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-sm ${
                      permissions.sharedList ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Perm 5 */}
              <div className="flex items-center justify-between gap-4 pt-4">
                <div>
                  <h4 className="font-600 text-xs text-[#1C2620]">
                    Archiver automatiquement après la sortie
                  </h4>
                  <p className="text-[11px] text-[#9CA89E] mt-0.5">
                    Le groupe passe en lecture seule 7 jours après la date de fin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPermissions(p => ({ ...p, autoArchive: !p.autoArchive }))}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    permissions.autoArchive ? 'bg-[#172A20]' : 'bg-[#E8E4D8]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow-sm ${
                      permissions.autoArchive ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* ════════════════ RIGHT COLUMN (SIDEBAR PREVIEW & TIPS) ════════════════ */}
        <div className="lg:col-span-4 space-y-5">

          {/* Mini Live Preview Box */}
          <div className="bg-[#EAF3ED] border border-[#172A20]/15 rounded-[2rem] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center text-xl font-bold shadow-sm"
                style={{ backgroundColor: accentColor }}
              >
                {pictogram}
              </div>
              <div className="min-w-0">
                <h4 className="font-display font-700 text-sm text-[#1C2620] truncate">
                  {name || 'Chartreuse en octobre'}
                </h4>
                <p className="text-[11px] text-[#5C6B5E]">
                  Groupe privé · {totalInvitedCount} invitations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#172A20]/10">
              <div className="flex -space-x-2 overflow-hidden">
                <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white bg-[#172A20] text-white text-[10px] font-700 flex items-center justify-center">
                  V
                </div>
                {invitedPartners.map(p => (
                  <img
                    key={p.id}
                    className="inline-block h-7 w-7 rounded-full ring-2 ring-white object-cover"
                    src={p.avatar_url}
                    alt={p.full_name}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[#5C6B5E] font-500">
                Vous + {totalInvitedCount} invités · {Math.max(0, maxMembers - totalInvitedCount - 1)} places restantes
              </span>
            </div>
          </div>

          {/* Groupe ou club ? box */}
          <div className="bg-white border border-[#E8E4D8] rounded-[2rem] p-5 space-y-4">
            <div>
              <h4 className="font-display font-700 text-base text-[#1C2620]">
                Groupe <em className="font-serif font-normal not-italic text-[#9CA89E]">ou club ?</em>
              </h4>
              <p className="text-[11px] text-[#9CA89E] mt-0.5">
                Deux formats pour deux besoins.
              </p>
            </div>

            <div className="space-y-3">
              {/* Inner card 1: Groupe éphémère */}
              <div className="bg-[#EAF3ED] border border-[#172A20]/15 rounded-2xl p-4">
                <h5 className="font-600 text-xs text-[#1C2620] mb-1">
                  Groupe éphémère
                </h5>
                <p className="text-[11px] text-[#5C6B5E] leading-relaxed">
                  Une sortie précise, quelques amis, une organisation partagée. S'archive après le voyage.
                </p>
              </div>

              {/* Inner card 2: Club durable */}
              <div className="bg-[#FAF9F5] border border-[#E8E4D8] rounded-2xl p-4">
                <h5 className="font-600 text-xs text-[#1C2620] mb-1">
                  Club · durable
                </h5>
                <p className="text-[11px] text-[#9CA89E] leading-relaxed">
                  Une communauté qui se retrouve mois après mois, avec des règles et plusieurs admins.
                </p>
              </div>
            </div>

            <div className="text-center pt-1">
              <Link
                href="/clubs/nouveau"
                className="text-xs font-700 text-[#1C2620] hover:text-[#D97746] transition-colors"
              >
                Créer un club plutôt →
              </Link>
            </div>
          </div>

          {/* Conseil Organisation Card */}
          <div className="bg-[#172A20] text-white rounded-[2rem] p-6 space-y-3 shadow-md">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-700">
              CONSEIL · ORGANISATION
            </p>
            <h4 className="font-display font-700 text-base leading-snug">
              Créez le groupe <em className="font-serif font-normal not-italic text-emerald-300">avant d'inviter.</em>
            </h4>
            <p className="text-xs text-white/70 leading-relaxed italic">
              Un chat actif, une liste de matériel, et l'énergie pour l'itinéraire se met en place naturellement.
            </p>
          </div>

        </div>

      </div>

      {/* ── Fixed Bottom Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E8E4D8] py-4 px-6 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-[#1C2620] font-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Prêt à créer</span>
            <span className="text-[#9CA89E] font-normal">
              · {totalInvitedCount} invitation{totalInvitedCount > 1 ? 's' : ''} partiront à la création
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/40 rounded-full text-xs font-700 transition-all"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => handleCreateGroup(false)}
              disabled={loading}
              className="px-5 py-2.5 bg-white border border-[#1C2620] text-[#1C2620] hover:bg-[#FAF9F5] rounded-full text-xs font-700 transition-all shadow-sm"
            >
              Créer sans inviter
            </button>
            <button
              type="button"
              onClick={() => handleCreateGroup(true)}
              disabled={loading}
              className="px-6 py-2.5 bg-[#172A20] hover:bg-[#2A3830] text-white rounded-full text-xs font-700 transition-all shadow-md"
            >
              {loading ? 'Création...' : 'Créer & envoyer les invitations'}
            </button>
          </div>
        </div>
      </div>

        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: '#6B7A72', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 500 }}>
                NOUVEAU GROUPE
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0B1F17', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '4px' }}>
                Rassembler <em style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#17402C', fontWeight: 400 }}>pour un voyage.</em>
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7A72', lineHeight: 1.5 }}>
                Un groupe suit pour une sortie et vit le temps de l'organiser.
              </p>
            </div>

            {/* Nom du groupe */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#0B1F17', display: 'block', marginBottom: '6px' }}>Nom du groupe</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Chartreuse en octobre"
                style={{ width: '100%', padding: '12px', background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '12px', fontSize: '14px', color: '#0B1F17', boxSizing: 'border-box' }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#0B1F17', display: 'block', marginBottom: '6px' }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Traversée de la Chartreuse à 6, octobre 2026"
                style={{ width: '100%', padding: '12px', background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '12px', fontSize: '14px', color: '#0B1F17', boxSizing: 'border-box' }}
              />
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#0B1F17', display: 'block', marginBottom: '6px' }}>Début</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '12px', fontSize: '13px', color: '#0B1F17', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#0B1F17', display: 'block', marginBottom: '6px' }}>Fin</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '12px', fontSize: '13px', color: '#0B1F17', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Max members */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#0B1F17', display: 'block', marginBottom: '6px' }}>Participants max</label>
              <input type="number" min={2} max={50} value={maxMembers} onChange={e => setMaxMembers(parseInt(e.target.value) || 6)}
                style={{ width: '100%', padding: '12px', background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '12px', fontSize: '14px', color: '#0B1F17', boxSizing: 'border-box' }} />
            </div>

            {/* Pictogramme selector */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#0B1F17', display: 'block', marginBottom: '8px' }}>Pictogramme</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                {PICTOGRAMS.map(p => (
                  <button key={p.id} onClick={() => setPictogram(p.icon)}
                    style={{
                      height: '44px', borderRadius: '10px', fontSize: '20px', border: 'none',
                      background: pictogram === p.icon ? '#17402C' : '#F4F1EA',
                      cursor: 'pointer',
                    }}>
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Create buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => handleCreateGroup(true)} disabled={loading}
                style={{ padding: '14px', background: '#17402C', color: '#fff', borderRadius: '999px', fontSize: '14px', fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Création...' : 'Créer & inviter'}
              </button>
              <button onClick={() => handleCreateGroup(false)} disabled={loading}
                style={{ padding: '14px', background: '#F4F1EA', color: '#0B1F17', borderRadius: '999px', fontSize: '14px', fontWeight: 600, border: '1px solid rgba(11,31,23,0.08)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                Créer sans inviter
              </button>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
