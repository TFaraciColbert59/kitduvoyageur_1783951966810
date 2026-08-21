'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { useToast } from '@/contexts/ToastContext';

export interface Participant {
  name: string;
  initial: string;
  color: string;
}

const AVATAR_COLORS = ['#5B7F55', '#4B6B7C', '#C89A3B', '#7A7365', '#A8443A'];

/** W-D-7 ParticipantsEmergency — avatars empilés + contact d'urgence + ajout (connecté Supabase). */
export function ParticipantsEmergency({
  participants, emergencyContact, kitId,
}: { participants: Participant[]; emergencyContact?: string | null; kitId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const shown = participants.slice(0, 5);
  const extra = Math.max(0, participants.length - 5);

  const addParticipant = async () => {
    if (!kitId || !name.trim()) { toast('Nom requis', 'error'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/materiel/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId, name: name.trim(), contact: contact.trim() || null }),
      });
      if (!res.ok) throw new Error('Erreur');
      toast('Participant ajouté', 'success');
      setName(''); setContact('');
      router.refresh();
    } catch {
      toast('Erreur', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <GlassCard as="article" ariaLabelledBy="participants-title" className="p-4">
      <Eyebrow>Participants & urgence</Eyebrow>
      <h3 id="participants-title" className="sr-only">Participants et contact d'urgence</h3>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex -space-x-2">
          {shown.map((p, i) => (
            <span
              key={p.name}
              title={p.name}
              className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white ring-2 ring-stone-50"
              style={{ backgroundColor: p.color || AVATAR_COLORS[i % AVATAR_COLORS.length] }}
            >
              {p.initial}
            </span>
          ))}
          {extra > 0 && (
            <span className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-[color:var(--label)] bg-stone-200 ring-2 ring-stone-50">
              +{extra}
            </span>
          )}
        </div>
        <span className="text-sm text-[color:var(--label-secondary)]">{participants.length} participant(s)</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[color:var(--label-tertiary)]">Contact d'urgence</span>
        {revealed && emergencyContact ? (
          <span className="text-sm font-medium text-[color:var(--label)]">{emergencyContact}</span>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="glass interactive h-8 px-3 rounded-full text-xs font-medium text-sage-600"
          >
            Révéler
          </button>
        )}
      </div>

      {kitId && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du participant" aria-label="Nom du participant" className="glass-input flex-1" />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (optionnel)" aria-label="Contact" className="glass-input flex-1" />
          </div>
          <button type="button" onClick={addParticipant} disabled={adding} className="glass interactive h-10 rounded-full text-sm font-medium text-white bg-sage-800 disabled:opacity-40">
            {adding ? 'Ajout…' : '+ Ajouter un participant'}
          </button>
        </div>
      )}
    </GlassCard>
  );
}
