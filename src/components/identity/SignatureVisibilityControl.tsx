'use client';

/**
 * CONSENTEMENT D'AFFICHAGE (ADR-010, Lot C.2)
 * ===========================================
 * Contrôle `signature_visibility` du profil : private (DÉFAUT) / communaute /
 * public. Une donnée dérivée de déplacements géographiques ne devient publique
 * que sur acte POSITIF, avec un texte qui explique ce qui sera visible et par
 * qui. Réversible en un geste. Cibles ≥ 44px, aria-pressed, focus-visible sage.
 */

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SignatureVisibility } from '@/features/identity/fieldSignature';

const OPTIONS: { value: SignatureVisibility; title: string; desc: string }[] = [
  { value: 'private', title: 'Privé', desc: 'Réservé à toi.' },
  { value: 'communaute', title: 'Communauté', desc: 'Visible par les membres connectés.' },
  { value: 'public', title: 'Public', desc: 'Visible par tout le monde.' },
];

export default function SignatureVisibilityControl() {
  const { user } = useAuth();
  const [value, setValue] = useState<SignatureVisibility>('private');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('signature_visibility')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data?.signature_visibility) {
        setValue(data.signature_visibility as SignatureVisibility);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const choose = async (v: SignatureVisibility) => {
    if (!user) return;
    setValue(v);
    setSaved(false);
    setError(null);
    const supabase = createClient();
    const { error: upErr } = await supabase
      .from('user_profiles')
      .update({ signature_visibility: v })
      .eq('id', user.id);
    if (upErr) {
      setError(upErr.message);
    } else {
      setSaved(true);
    }
  };

  return (
    <div className="glass glass-sub-card p-5 rounded-2xl">
      <p className="glass-eyebrow mb-1">Ton empreinte</p>
      <h3 className="font-display font-bold text-[#17402C] text-lg tracking-tight mb-2">
        Qui peut voir ta trace ?
      </h3>
      <p className="text-sm text-[#5A7064] mb-4">
        Ton empreinte est dérivée de tes sorties (nombre, saisons, régions). Aucune coordonnée,
        aucun nom — mais c’est ta donnée : choisis qui la voit. Réversible à tout moment.
      </p>

      {!loaded ? (
        <div className="flex justify-center py-6" role="status" aria-live="polite">
          <div className="w-6 h-6 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-capsule-bar flex flex-wrap gap-1 p-1">
          {OPTIONS.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                aria-pressed={active}
                aria-label={`${opt.title} — ${opt.desc}`}
                className="glass-capsule-segment text-sm font-medium transition-colors"
                style={{
                  minHeight: 44,
                  padding: '10px 14px',
                  borderRadius: 999,
                  color: active ? '#17402C' : '#365233',
                  background: active ? 'rgba(255,255,255,0.75)' : 'transparent',
                  border: active ? '1px solid rgba(23,64,44,0.25)' : '1px solid transparent',
                }}
              >
                {opt.title}
              </button>
            );
          })}
        </div>
      )}

      {loaded && (
        <p className="text-xs text-[#5A7064] mt-3">
          {OPTIONS.find((o) => o.value === value)?.desc}
        </p>
      )}
      {saved && (
        <p className="text-xs text-[#365233] font-medium mt-2" role="status" aria-live="polite">
          ✓ Préférence enregistrée
        </p>
      )}
      {error && (
        <p className="text-xs text-[#8A241B] mt-2" role="alert">{error}</p>
      )}
    </div>
  );
}