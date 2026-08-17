'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CompteUserProfile } from '@/lib/supabase/queries-compte';

interface EditProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CompteUserProfile | null;
  onSave: (updated: Partial<CompteUserProfile>) => void;
}

export default function EditProfileDrawer({
  isOpen,
  onClose,
  profile,
  onSave,
}: EditProfileDrawerProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('selection');
    setSaving(true);

    try {
      const supabase = createClient();
      const fullName = `${firstName} ${lastName}`.trim();

      if (profile?.id) {
        await supabase
          .from('user_profiles')
          .update({
            full_name: fullName,
            bio,
            location,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      }

      onSave({
        first_name: firstName,
        last_name: lastName,
        bio,
        location,
      });

      triggerHaptic('success');
      onClose();
    } catch (err) {
      console.warn('Erreur sauvegarde profil:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity">
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-black/[0.06] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-black/[0.06]">
          <h3 className="text-base font-bold text-[#0B1F17]">Modifier mon profil</h3>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#F4F1EB] flex items-center justify-center text-xs text-[#5C6B63] hover:text-[#0B1F17]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5C6B63] mb-1">
                Prénom
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full bg-[#FBFAF6] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C6B63] mb-1">
                Nom
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-[#FBFAF6] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C6B63] mb-1">
              Localisation
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Chamonix, Annecy, Grenoble..."
              className="w-full bg-[#FBFAF6] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#5C6B63] mb-1">
              Bio / Présentation
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Partagez votre pratique de la randonnée, vos massifs préférés..."
              className="w-full bg-[#FBFAF6] border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#0B1F17] outline-none focus:border-[#17402C] resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-[#F4F1EB] hover:bg-[#EBE7DF] text-[#0B1F17] text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#17402C] text-white text-xs font-bold shadow-xs active:scale-95 transition-transform"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
