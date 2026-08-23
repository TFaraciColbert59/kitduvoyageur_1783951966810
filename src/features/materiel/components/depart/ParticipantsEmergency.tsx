'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/contexts/ToastContext';

export interface Participant {
  name: string;
  initial: string;
  color: string;
  profileId?: string | null;
}

/** W-D-7 ParticipantsEmergency — sans icône titre, typo vert foncé (#17402C). */
export function ParticipantsEmergency({
  participants,
  emergencyContact,
  kitId,
}: {
  participants: Participant[];
  emergencyContact?: string | null;
  kitId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');

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
      setShowAdd(false);
      router.refresh();
    } catch {
      toast('Erreur', 'error');
    } finally {
      setAdding(false);
    }
  };

  return (
    <GlassCard as="article" tone="sage" ariaLabelledBy="participants-title" className="p-3 md:p-4">
      {kitId && (
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          aria-label="Ajouter un participant"
          className="!absolute top-1.5 right-8 md:top-2 md:right-11 z-10 glass interactive h-6 w-6 md:h-8 md:w-8 !rounded-full flex items-center justify-center text-[#365233]"
        >
          <Plus size={12} className="md:hidden" aria-hidden="true" />
          <Plus size={15} className="hidden md:block" aria-hidden="true" />
        </button>
      )}
      <div className="flex items-center gap-1.5 md:gap-2 pr-14 md:pr-20">
        <p className="truncate text-[10px] md:text-sm font-semibold text-[#17402C] font-body">Participants</p>
      </div>
      <h3 id="participants-title" className="sr-only">Participants et contact d'urgence</h3>

      {showAdd && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" aria-label="Nom du participant" className="glass-input flex-1 text-sm text-[#17402C]" />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact" aria-label="Contact" className="glass-input flex-1 text-sm text-[#17402C]" />
          <button type="button" onClick={addParticipant} disabled={adding} className="glass interactive h-7 rounded-full px-3 text-[11px] font-semibold text-[#17402C] disabled:opacity-40">
            {adding ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      )}

      <ul className="mt-1.5 flex-1 min-h-0 flex flex-col justify-start gap-1 overflow-y-auto no-scrollbar">
        {participants.map((p) => (
          <li key={p.name} className="block">
            {p.profileId ? (
              <Link
                href={`/profil/${p.profileId}`}
                className="glass-sub-card px-2 py-1 md:px-2.5 md:py-1.5 flex items-center gap-2 hover:opacity-90 transition-opacity"
                aria-label={`Voir le profil de ${p.name}`}
              >
                <span
                  className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white/70 flex items-center justify-center text-[8px] md:text-[9px] font-bold flex-shrink-0"
                  style={{ color: p.color || '#17402C' }}
                  aria-hidden="true"
                >
                  {p.initial}
                </span>
                <span className="truncate text-[10px] md:text-[11px] font-semibold text-[#17402C]">{p.name}</span>
              </Link>
            ) : (
              <div className="glass-sub-card px-2 py-1 md:px-2.5 md:py-1.5 flex items-center gap-2">
                <span
                  className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-white/70 flex items-center justify-center text-[8px] md:text-[9px] font-bold flex-shrink-0"
                  style={{ color: p.color || '#17402C' }}
                  aria-hidden="true"
                >
                  {p.initial}
                </span>
                <span className="truncate text-[10px] md:text-[11px] font-semibold text-[#17402C]">{p.name}</span>
              </div>
            )}
          </li>
        ))}
        {participants.length === 0 && <li className="text-xs text-[#486944]">Aucun participant.</li>}
      </ul>

      <div className="mt-1.5 glass-sub-card shrink-0 px-2.5 py-1.5 max-[359px]:hidden md:px-3 md:py-2 flex items-center justify-between text-xs">
        <span className="text-[8px] md:text-[10px] font-semibold uppercase tracking-wider text-[#365233]">Contact d'urgence</span>
        <span className="font-mono font-bold text-[11px] md:text-[12px] text-[#17402C]">{emergencyContact ?? '—'}</span>
      </div>
    </GlassCard>
  );
}