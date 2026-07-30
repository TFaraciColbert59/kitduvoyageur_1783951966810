'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';

export default function ClubFormModal({
  isOpen,
  onClose,
  onSave,
  saving
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (form: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name: '',
    type: 'activité',
    emoji: '🏕️',
    description: '',
    category: 'Randonnée',
    rules: '',
    privacy: 'open'
  });

  if (!isOpen) return null;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white border border-[#E8E4D8] shadow-2xl rounded-[2.5rem] w-full max-w-lg my-4 overflow-hidden flex flex-col p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#F5F2E8]">
          <div>
            <h3 className="font-display font-800 text-2xl text-[#1C2620]">Créer un nouveau club</h3>
            <p className="text-xs text-[#5C6B5E] mt-0.5">Rassemblez les voyageurs autour d'une passion commune.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-[#F5F2E8] hover:bg-[#E8E4D8] rounded-full text-[#1C2620] transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
          <div className="flex gap-3">
            <div className="w-20">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Emoji</label>
              <input type="text" className="w-full bg-[#F5F2E8] border-none rounded-2xl p-3 text-center text-2xl" value={form.emoji} onChange={e => set('emoji', e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Nom du club *</label>
              <input type="text" placeholder="Ex: Club Trek Alpes" className="w-full bg-[#F5F2E8] border-none rounded-2xl px-4 py-3 text-sm text-[#1C2620] focus:ring-1 focus:ring-[#2D5A3D]" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Type</label>
              <select className="w-full bg-[#F5F2E8] border-none rounded-2xl px-3 py-3 text-xs text-[#1C2620]" value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="activité">🎯 Activité</option>
                <option value="pays">🌍 Destination</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Catégorie</label>
              <input type="text" placeholder="Ex: Randonnée, Kayak..." className="w-full bg-[#F5F2E8] border-none rounded-2xl px-3 py-3 text-xs text-[#1C2620]" value={form.category} onChange={e => set('category', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Description</label>
            <textarea rows={3} placeholder="Présentez l'objectif et l'esprit du club..." className="w-full bg-[#F5F2E8] border-none rounded-2xl p-3 text-xs text-[#1C2620] resize-none" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div>
            <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-1">Règles (optionnel)</label>
            <textarea rows={2} placeholder="Règles de bonne conduite..." className="w-full bg-[#F5F2E8] border-none rounded-2xl p-3 text-xs text-[#1C2620] resize-none" value={form.rules} onChange={e => set('rules', e.target.value)} />
          </div>

          <div>
            <label className="text-[10px] font-mono tracking-widest uppercase text-[#5C6B5E] block mb-2">Confidentialité</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: 'open', l: '🌍 Ouvert', d: 'Libre accès' },
                { v: 'closed', l: '🔒 Fermé', d: 'Sur demande' },
                { v: 'secret', l: '🕵️ Secret', d: 'Sur invitation' },
              ].map(opt => (
                <button type="button" key={opt.v} onClick={() => set('privacy', opt.v)} className={`p-3 rounded-2xl border text-left transition-all ${form.privacy === opt.v ? 'border-[#2D5A3D] bg-[#2D5A3D]/10 text-[#2D5A3D]' : 'border-[#E8E4D8] bg-[#F5F2E8] text-[#5C6B5E]'}`}>
                  <div className="font-bold text-xs">{opt.l}</div>
                  <div className="text-[9px] opacity-75">{opt.d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#F5F2E8]">
          <button onClick={onClose} className="px-5 py-3 rounded-full text-xs font-semibold text-[#5C6B5E] hover:bg-[#F5F2E8] transition-colors">Annuler</button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()} className="flex-1 py-3 bg-[#2D5A3D] text-white rounded-full text-xs font-bold hover:bg-[#1C2620] transition-colors disabled:opacity-50 shadow-md">
            {saving ? 'Création...' : 'Créer le club'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
