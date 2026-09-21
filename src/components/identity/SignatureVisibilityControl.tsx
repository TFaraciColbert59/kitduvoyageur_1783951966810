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
import { Card, Chip, LoadingState } from '@/components/ui';
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
    <Card variant="featured" className="p-5">
      <p className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.18em] text-[color:var(--lkv-text-muted)] mb-1">Ton empreinte</p>
      <h3 className="font-display font-bold text-[color:var(--lkv-primary)] text-lg tracking-tight mb-2">
        Qui peut voir ta trace ?
      </h3>
      <p className="text-sm text-[color:var(--lkv-text-muted)] mb-4">
        Ton empreinte est dérivée de tes sorties (nombre, saisons, régions). Aucune coordonnée,
        aucun nom — mais c’est ta donnée : choisis qui la voit. Réversible à tout moment.
      </p>

      {!loaded ? (
        <LoadingState compact label="" />
      ) : (
        <div className="flex flex-wrap gap-[var(--space-1)]">
          {OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              selected={value === opt.value}
              onClick={() => choose(opt.value)}
              aria-label={`${opt.title} — ${opt.desc}`}
            >
              {opt.title}
            </Chip>
          ))}
        </div>
      )}

      {loaded && (
        <p className="text-xs text-[color:var(--lkv-text-muted)] mt-3">
          {OPTIONS.find((o) => o.value === value)?.desc}
        </p>
      )}
      {saved && (
        <p className="text-xs text-[color:var(--lkv-forest-600)] font-medium mt-2" role="status" aria-live="polite">
          ✓ Préférence enregistrée
        </p>
      )}
      {error && (
        <p className="text-xs text-[color:var(--lkv-danger-dark)] mt-2" role="alert">{error}</p>
      )}
    </Card>
  );
}