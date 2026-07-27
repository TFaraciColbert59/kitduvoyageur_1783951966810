'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';

interface CreateGroupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: string) => void;
}

const THEMES = [
  { id: 'Trek', label: 'Trek & Rando', emoji: '🏔️', color: 'from-amber-700/20 to-amber-900/40' },
  { id: 'Van Life', label: 'Van Life & Roadtrip', emoji: '🚐', color: 'from-blue-700/20 to-blue-900/40' },
  { id: 'Expédition', label: 'Expédition sauvage', emoji: '🧭', color: 'from-emerald-700/20 to-emerald-900/40' },
  { id: 'Tour du monde', label: 'Tour du monde', emoji: '🌍', color: 'from-teal-700/20 to-teal-900/40' },
  { id: 'Vélo', label: 'Bikepacking & Vélo', emoji: '🚴', color: 'from-purple-700/20 to-purple-900/40' },
  { id: 'Ski', label: 'Ski & Hiver', emoji: '⛷️', color: 'from-cyan-700/20 to-cyan-900/40' },
  { id: 'Plage', label: 'Bord de mer & Surf', emoji: '🏖️', color: 'from-amber-600/20 to-orange-800/40' },
  { id: 'Autre', label: 'Autre Aventure', emoji: '🎒', color: 'from-stone-700/20 to-stone-900/40' },
];

const PRESET_ACTIVITIES = [
  'Bivouac', 'High-Tech', 'Photographie', 'Bushcraft', 
  'Ultra-Light', 'Gastronomie locale', 'Alpinisme', 
  'Trail', 'Orientation', 'Faune & Flore', 'Autonomie complète'
];

const COVER_PRESETS = [
  { label: 'Montagne Dorée', url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=1200' },
  { label: 'Fjords & Brume', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200' },
  { label: 'Campin Van Sun', url: 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?q=80&w=1200' },
  { label: 'Forêt Émeraude', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1200' },
];

export default function CreateGroupWizardModal({ isOpen, onClose, onSuccess }: CreateGroupWizardModalProps) {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Infos
    name: '',
    description: '',
    emoji: '🏔️',
    theme: 'Trek',
    activities: ['Bivouac', 'Photographie'] as string[],
    
    // Step 2: Paramètres
    visibility: 'public' as 'public' | 'private' | 'invite_only',
    joinPolicy: 'free' as 'free' | 'approval' | 'invite',
    allowMemberInvite: true,
    maxMembers: 12,
    budgetTarget: 500,
    departureDate: '',
    returnDate: '',

    // Step 3: Personnalisation
    coverUrl: COVER_PRESETS[0].url,
    badgeColor: 'emerald' as 'emerald' | 'amber' | 'terracotta' | 'indigo',
    tags: ['#Trek', '#Aventure'],
    newTagInput: '',
    destination: 'Massif des Écrins, France',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleNextStep = () => {
    // Validate current step
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Le nom du groupe est obligatoire.';
      if (!formData.description.trim()) newErrors.description = 'Veuillez ajouter une courte description.';
    } else if (step === 2) {
      if (!formData.destination.trim()) newErrors.destination = 'Précisez une destination principale.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (step < 4) setStep((prev) => (prev + 1) as any);
  };

  const handlePrevStep = () => {
    if (step > 1) setStep((prev) => (prev - 1) as any);
  };

  const toggleActivity = (act: string) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.includes(act)
        ? prev.activities.filter(a => a !== act)
        : [...prev.activities, act]
    }));
  };

  const handleAddTag = () => {
    if (!formData.newTagInput.trim()) return;
    const tag = formData.newTagInput.startsWith('#') ? formData.newTagInput.trim() : `#${formData.newTagInput.trim()}`;
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
        newTagInput: ''
      }));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }));
  };

  const handleFinalCreate = async () => {
    if (!user) {
      toast('Connectez-vous pour créer un groupe', 'error');
      router.push('/connexion');
      return;
    }

    setStep(5);
    setLoading(true);

    try {
      // 1. Insert into Supabase
      const { data: newGroup, error: groupErr } = await supabase
        .from('travel_groups')
        .insert({
          name: formData.name.trim(),
          description: formData.description.trim(),
          destination: formData.destination.trim(),
          theme: formData.theme,
          visibility: formData.visibility,
          cover_url: formData.coverUrl,
          departure_date: formData.departureDate || null,
          return_date: formData.returnDate || null,
          budget_target: Number(formData.budgetTarget) || 0,
          max_members: Number(formData.maxMembers) || 12,
          owner_id: user.id,
          optimization_score: 85,
          group_level: 1,
        })
        .select()
        .single();

      let createdGroupId = newGroup?.id;

      if (groupErr || !createdGroupId) {
        console.error('Group creation error:', groupErr);
        setLoading(false);
        toast('Erreur lors de la création : ' + (groupErr?.message || 'inconnue'), 'error');
        setStep(4);
        return;
      }

      // 2. Add owner as member
      await supabase.from('group_members').upsert({
        group_id: createdGroupId,
        user_id: user.id,
        role: 'organizer',
        status: 'active',
      }, { onConflict: 'group_id,user_id' });

      setLoading(false);
      setSuccess(true);

      toast('Votre espace groupe est prêt !', 'success');

      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess(createdGroupId);
        } else {
          router.push(`/groupes/${createdGroupId}`);
        }
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setLoading(false);
      toast('Une erreur est survenue lors de la création', 'error');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#1C2620]/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-[#F5F2E8] border border-[#C8C3B0] rounded-[2.5rem] shadow-2xl overflow-hidden z-[101] my-auto flex flex-col max-h-[92vh]"
        >
          {/* Top Bar / Header */}
          <div className="bg-[#1C2620] px-6 py-5 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E4501C] flex items-center justify-center text-white font-bold text-lg shadow-md">
                {formData.emoji}
              </div>
              <div>
                <h3 className="font-display font-800 text-lg leading-tight text-white">
                  Créer un espace groupe
                </h3>
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#E4501C]">
                  Étape {step} sur 4 — {step === 1 ? 'Informations' : step === 2 ? 'Paramètres' : step === 3 ? 'Personnalisation' : step === 4 ? 'Aperçu' : 'Finalisation'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#1C2620]/10 h-1.5 flex-shrink-0">
            <motion.div
              className="h-full bg-[#E4501C]"
              initial={{ width: '25%' }}
              animate={{ width: `${(step / 4) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8 overflow-y-auto flex-1 custom-scrollbar space-y-6">
            {/* STEP 1: INFORMATIONS DU GROUPE */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h4 className="font-display font-800 text-xl text-[#1C2620] mb-1">
                    Identité de votre voyage
                  </h4>
                  <p className="text-xs text-[#5C6B5E]">
                    Définissez les bases de votre expédition pour donner envie aux autres voyageurs de vous rejoindre.
                  </p>
                </div>

                {/* Nom du groupe */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                    Nom du groupe *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Traversée de la Vanoise & Bivouac"
                    className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-3 text-sm text-[#1C2620] font-semibold focus:outline-none focus:ring-2 focus:ring-[#E4501C]/40 focus:border-[#E4501C]"
                  />
                  {errors.name && <p className="text-xs text-red-600 mt-1 font-medium">{errors.name}</p>}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                    Description & Ambiance *
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Expliquez l'objectif du voyage, le niveau d'autonomie requis, le rythme de marche..."
                    className="w-full bg-white border border-[#C8C3B0] rounded-xl p-4 text-sm text-[#1C2620] focus:outline-none focus:ring-2 focus:ring-[#E4501C]/40 focus:border-[#E4501C] resize-none"
                  />
                  {errors.description && <p className="text-xs text-red-600 mt-1 font-medium">{errors.description}</p>}
                </div>

                {/* Thème & Emoji Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                      Thème principal
                    </label>
                    <select
                      value={formData.theme}
                      onChange={(e) => {
                        const selected = THEMES.find(t => t.id === e.target.value);
                        setFormData({
                          ...formData,
                          theme: e.target.value,
                          emoji: selected ? selected.emoji : formData.emoji
                        });
                      }}
                      className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-3 text-sm text-[#1C2620] font-medium focus:outline-none focus:ring-2 focus:ring-[#E4501C]/40"
                    >
                      {THEMES.map(t => (
                        <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                      Avatar / Icône
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {['🏔️', '🚐', '🥾', '🧭', '🌍', '🏖️', '⛷️', '🚴', '⛺'].map(emoji => (
                        <button
                          type="button"
                          key={emoji}
                          onClick={() => setFormData({ ...formData, emoji })}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all border ${formData.emoji === emoji ? 'bg-[#1C2620] border-[#1C2620] text-white scale-110 shadow' : 'bg-white border-[#C8C3B0] hover:border-[#1C2620]/40'}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Activités / Centres d'intérêt */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-2 font-bold">
                    Activités & Esprit du groupe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_ACTIVITIES.map(act => {
                      const isSelected = formData.activities.includes(act);
                      return (
                        <button
                          type="button"
                          key={act}
                          onClick={() => toggleActivity(act)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${isSelected ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white shadow-sm' : 'bg-white border-[#C8C3B0] text-[#5C6B5E] hover:border-[#2D5A3D]/50'}`}
                        >
                          {isSelected ? '✓ ' : '+ '}{act}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: PARAMÈTRES */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h4 className="font-display font-800 text-xl text-[#1C2620] mb-1">
                    Paramètres & Règles d'accès
                  </h4>
                  <p className="text-xs text-[#5C6B5E]">
                    Choisissez qui peut vous rejoindre et comment s'organise l'accès à votre groupe.
                  </p>
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                    Destination ou Zone Principale *
                  </label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="Ex: Alpes du Nord - Vanoise"
                    className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-3 text-sm text-[#1C2620] font-semibold focus:outline-none focus:ring-2 focus:ring-[#E4501C]/40"
                  />
                  {errors.destination && <p className="text-xs text-red-600 mt-1 font-medium">{errors.destination}</p>}
                </div>

                {/* Visibilité */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-2 font-bold">
                    Visibilité du groupe
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'public', label: '🌍 Public', desc: 'Visible dans le hub pour tous' },
                      { id: 'private', label: '🔒 Privé', desc: 'Accès réservé aux membres' },
                      { id: 'invite_only', label: '🔗 Sur invitation', desc: 'Rejoindre via code secret' },
                    ].map(v => (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setFormData({ ...formData, visibility: v.id as any })}
                        className={`p-3 rounded-2xl text-left border transition-all ${formData.visibility === v.id ? 'bg-[#1C2620] border-[#1C2620] text-white shadow-md' : 'bg-white border-[#C8C3B0] text-[#1C2620] hover:border-[#1C2620]/40'}`}
                      >
                        <div className="font-bold text-xs mb-1">{v.label}</div>
                        <div className={`text-[10px] ${formData.visibility === v.id ? 'text-white/60' : 'text-[#5C6B5E]'}`}>{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Politique de recrutement */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-2 font-bold">
                    Mode d'adhésion
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'free', label: '⚡ Accès libre', desc: 'Inscriptions automatiques' },
                      { id: 'approval', label: '🛡️ Validation par l\'hôte', desc: 'L\'admin approuve chaque membre' },
                      { id: 'invite', label: '✉️ Uniquement invité', desc: 'Réservé aux proches' },
                    ].map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setFormData({ ...formData, joinPolicy: p.id as any })}
                        className={`p-3 rounded-2xl text-left border transition-all ${formData.joinPolicy === p.id ? 'bg-[#2D5A3D] border-[#2D5A3D] text-white shadow-md' : 'bg-white border-[#C8C3B0] text-[#1C2620] hover:border-[#2D5A3D]/40'}`}
                      >
                        <div className="font-bold text-xs mb-1">{p.label}</div>
                        <div className={`text-[10px] ${formData.joinPolicy === p.id ? 'text-white/70' : 'text-[#5C6B5E]'}`}>{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider Max membres & Budget */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-[#C8C3B0]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest font-bold">Taille max du groupe</span>
                      <span className="font-mono font-bold text-sm text-[#E4501C]">{formData.maxMembers} voyageurs</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={40}
                      value={formData.maxMembers}
                      onChange={(e) => setFormData({ ...formData, maxMembers: parseInt(e.target.value) })}
                      className="w-full accent-[#E4501C]"
                    />
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-[#C8C3B0]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest font-bold">Budget estimé par pers.</span>
                      <span className="font-mono font-bold text-sm text-[#2D5A3D]">{formData.budgetTarget} €</span>
                    </div>
                    <input
                      type="number"
                      value={formData.budgetTarget}
                      onChange={(e) => setFormData({ ...formData, budgetTarget: parseInt(e.target.value) || 0 })}
                      className="w-full bg-[#F5F2E8] border border-[#C8C3B0] rounded-xl px-3 py-1 text-sm font-semibold text-[#1C2620]"
                    />
                  </div>
                </div>

                {/* Toggle Invitations */}
                <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-[#C8C3B0]">
                  <div>
                    <div className="font-bold text-xs text-[#1C2620]">Autoriser l'invitation par les membres</div>
                    <div className="text-[10px] text-[#5C6B5E]">Permet à tous les participants de générer un lien d'invitation</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, allowMemberInvite: !prev.allowMemberInvite }))}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${formData.allowMemberInvite ? 'bg-[#2D5A3D]' : 'bg-[#C8C3B0]'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.allowMemberInvite ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: PERSONNALISATION */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h4 className="font-display font-800 text-xl text-[#1C2620] mb-1">
                    Personnalisation Visuelle
                  </h4>
                  <p className="text-xs text-[#5C6B5E]">
                    Habillez la page de votre groupe avec une couverture immersive et des mots-clés accrocheurs.
                  </p>
                </div>

                {/* Image de couverture Preset */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-2 font-bold">
                    Image de couverture
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {COVER_PRESETS.map((preset, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setFormData({ ...formData, coverUrl: preset.url })}
                        className={`relative h-24 rounded-2xl overflow-hidden border-2 transition-all ${formData.coverUrl === preset.url ? 'border-[#E4501C] scale-[1.02] shadow-md' : 'border-transparent opacity-80 hover:opacity-100'}`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex items-end">
                          <span className="text-[10px] font-bold text-white truncate">{preset.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags du groupe */}
                <div>
                  <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                    Tags & Mots-Clés
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={formData.newTagInput}
                      onChange={(e) => setFormData({ ...formData, newTagInput: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="Ajouter un tag (ex: #Bivouac Sauvage)..."
                      className="flex-1 bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-xs text-[#1C2620]"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-4 py-2.5 bg-[#1C2620] text-white rounded-xl text-xs font-bold hover:bg-[#1C2620]/80 transition-colors"
                    >
                      Ajouter
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-[#E7E3D6] text-[#1C2620] px-3 py-1 rounded-full text-xs font-mono font-semibold flex items-center gap-1.5"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-[#1C2620]/50 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dates optionnelles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                      Date de départ (optionnel)
                    </label>
                    <input
                      type="date"
                      value={formData.departureDate}
                      onChange={(e) => setFormData({ ...formData, departureDate: e.target.value })}
                      className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-xs text-[#1C2620]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest mb-1.5 font-bold">
                      Date de retour (optionnel)
                    </label>
                    <input
                      type="date"
                      value={formData.returnDate}
                      onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                      className="w-full bg-white border border-[#C8C3B0] rounded-xl px-4 py-2.5 text-xs text-[#1C2620]"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 4: APERÇU COMPLET */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h4 className="font-display font-800 text-xl text-[#1C2620] mb-1">
                    Aperçu de votre page de groupe
                  </h4>
                  <p className="text-xs text-[#5C6B5E]">
                    Voici la fiche telle qu'elle sera vue par la communauté. Vous pouvez modifier chaque bloc si besoin.
                  </p>
                </div>

                {/* Preview Card */}
                <div className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-[2rem] overflow-hidden shadow-lg">
                  {/* Hero banner preview */}
                  <div className="relative h-44 w-full bg-[#1C2620] overflow-hidden">
                    <img src={formData.coverUrl} alt="Cover preview" className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1C2620] via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl border border-white/30 text-white shadow">
                          {formData.emoji}
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[#E4501C] bg-[#1C2620]/80 px-2 py-0.5 rounded">
                            {formData.theme}
                          </span>
                          <h3 className="font-display font-800 text-white text-xl leading-tight">
                            {formData.name || 'Nom de votre voyage'}
                          </h3>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-full">
                        {formData.visibility === 'public' ? '🌍 Public' : formData.visibility === 'private' ? '🔒 Privé' : '🔗 Invitation'}
                      </span>
                    </div>
                  </div>

                  {/* Body preview */}
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-[#1C2620] flex items-center gap-1.5 mb-2">
                          <Icon name="MapPinIcon" size={14} className="text-[#E4501C]" />
                          {formData.destination}
                        </p>
                        <p className="text-xs text-[#5C6B5E] leading-relaxed">
                          {formData.description}
                        </p>
                      </div>
                      <button
                        onClick={() => setStep(1)}
                        className="text-[10px] font-bold text-[#E4501C] hover:underline flex items-center gap-1 flex-shrink-0"
                      >
                        <Icon name="PencilIcon" size={12} /> Modifier infos
                      </button>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#C8C3B0]/50">
                      <div className="text-center">
                        <div className="font-mono font-bold text-sm text-[#1C2620]">1 / {formData.maxMembers}</div>
                        <div className="text-[9px] text-[#5C6B5E] uppercase tracking-wider">Membres</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono font-bold text-sm text-[#2D5A3D]">{formData.budgetTarget} €</div>
                        <div className="text-[9px] text-[#5C6B5E] uppercase tracking-wider">Budget vise</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono font-bold text-sm text-[#E4501C]">85/100</div>
                        <div className="text-[9px] text-[#5C6B5E] uppercase tracking-wider">Score Prep</div>
                      </div>
                    </div>

                    {/* Tags preview */}
                    <div className="flex flex-wrap gap-1.5 items-center justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        {formData.tags.map(t => (
                          <span key={t} className="text-[10px] font-mono bg-white px-2.5 py-1 rounded-full text-[#1C2620]">
                            {t}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => setStep(3)}
                        className="text-[10px] font-bold text-[#E4501C] hover:underline flex items-center gap-1"
                      >
                        <Icon name="PencilIcon" size={12} /> Modifier style
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 5: ÉTAT DE CRÉATION & CONFIRMATION */}
            {step === 5 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 text-center space-y-6"
              >
                {loading ? (
                  <>
                    <div className="w-16 h-16 border-4 border-[#E4501C] border-t-transparent rounded-full animate-spin mx-auto" />
                    <div>
                      <h4 className="font-display font-800 text-2xl text-[#1C2620] mb-2">
                        Création de votre espace en cours...
                      </h4>
                      <p className="text-xs text-[#5C6B5E]">
                        Initialisation du cockpit, préparation du chat et configuration des rôles...
                      </p>
                    </div>
                  </>
                ) : success ? (
                  <>
                    <div className="w-20 h-20 bg-[#2D5A3D] text-white rounded-full flex items-center justify-center text-3xl mx-auto shadow-xl animate-bounce">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-display font-800 text-2xl text-[#1C2620] mb-2">
                        Félicitations, votre groupe est ouvert ! 🎉
                      </h4>
                      <p className="text-xs text-[#5C6B5E]">
                        Redirection automatique vers votre nouveau cockpit de voyage...
                      </p>
                    </div>
                  </>
                ) : null}
              </motion.div>
            )}
          </div>

          {/* Footer Controls */}
          {step <= 4 && (
            <div className="bg-white border-t border-[#C8C3B0] px-6 py-4 flex items-center justify-between flex-shrink-0">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-5 py-2.5 rounded-xl border border-[#C8C3B0] text-[#5C6B5E] hover:text-[#1C2620] font-semibold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Icon name="ChevronLeftIcon" size={14} /> Retour
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl bg-[#1C2620] hover:bg-[#2A3830] text-white font-bold text-xs transition-colors flex items-center gap-2 shadow-md"
                >
                  Continuer <Icon name="ChevronRightIcon" size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalCreate}
                  className="px-8 py-3 rounded-xl bg-[#E4501C] hover:bg-[#cc3d10] text-white font-bold text-sm transition-all shadow-lg flex items-center gap-2"
                >
                  <Icon name="SparklesIcon" size={16} /> Créer le groupe
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
