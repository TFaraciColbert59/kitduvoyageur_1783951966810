'use client';

/**
 * ORIENTATION CARD — « comment tu marches ? » (ADR-010, Lot B)
 * ============================================================
 * Carte GlassCard avec 4 rangées de segments (terrain / autonomie / priorité /
 * expérience). POSÉE APRÈS la création du compte (configurateur au premier
 * passage), jamais dans le formulaire d'inscription. Modifiable depuis /compte.
 *
 * Contraintes dures :
 *  - 4 questions factuelles, aucun label d'identité (aucun rôle affiché).
 *  - Bouton « passer » TOUJOURS visible — l'orientation est facultative.
 *  - Écriture/lecture strictement RLS own (user_orientation).
 *  - Cibles tactiles ≥ 44px, aria-pressed, focus-visible sage,
 *    prefers-reduced-motion respecté.
 */

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  AUTONOMIES,
  EXPERIENCES,
  PRIORITIES,
  TERRAINS,
  type Autonomy,
  type Experience,
  type Orientation,
  type Priority,
  type Terrain,
} from '@/features/identity/orientation';

const SEGMENT_LABELS: Record<'terrain' | 'autonomy' | 'priority' | 'experience', Record<string, string>> = {
  terrain: {
    sentier: 'Sentier',
    montagne: 'Montagne',
    hors_sentier: 'Hors sentier',
    itinerance: 'Itinérance',
    urbain_transit: 'Urbain & transit',
  },
  autonomy: {
    journee: 'Journée',
    bivouac_1_2: 'Bivouac 1–2 nuits',
    itinerance_longue: 'Itinérance longue',
  },
  priority: {
    legerete: 'Légèreté',
    confort: 'Confort',
    budget: 'Budget',
    securite: 'Sécurité',
  },
  experience: {
    debut: 'Débutant·e',
    regulier: 'Régulier·ère',
    aguerri: 'Aguerri·e',
  },
};

const SECTION_QUESTIONS: Record<string, string> = {
  terrain: 'Comment tu marches ?',
  autonomy: 'Combien de nuits dehors ?',
  priority: 'Ta priorité dans le sac ?',
  experience: 'Ta pratique ?',
};

const SECTIONS = [
  { key: 'terrain', values: TERRAINS as readonly string[] },
  { key: 'autonomy', values: AUTONOMIES as readonly string[] },
  { key: 'priority', values: PRIORITIES as readonly string[] },
  { key: 'experience', values: EXPERIENCES as readonly string[] },
] as const;

interface OrientationCardProps {
  /** mode collecte (configurateur) ou édition (/compte) */
  mode?: 'collect' | 'edit';
  /** appelé après une sauvegarde réussie (valeurs persistées) */
  onSaved?: (o: Orientation) => void;
  /** appelé quand l'utilisateur « passe » */
  onPasser?: () => void;
}

export default function OrientationCard({ mode = 'collect', onSaved, onPasser }: OrientationCardProps) {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('user_orientation')
          .select('terrain, autonomy, priority, experience')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) {
          setValues({
            terrain: data?.terrain ?? '',
            autonomy: data?.autonomy ?? '',
            priority: data?.priority ?? '',
            experience: data?.experience ?? '',
          });
        }
      } catch {
        // silent — carte toujours utilisable
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  const toggle = (section: 'terrain' | 'autonomy' | 'priority' | 'experience', value: string) => {
    setValues((prev) => ({ ...prev, [section]: prev[section] === value ? '' : value }));
  };

  const persist = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: upsertError } = await supabase
        .from('user_orientation')
        .upsert({
          user_id: user.id,
          terrain: (values.terrain as Terrain) || null,
          autonomy: (values.autonomy as Autonomy) || null,
          priority: (values.priority as Priority) || null,
          experience: (values.experience as Experience) || null,
          source: 'declared',
          updated_at: new Date().toISOString(),
        });
      if (upsertError) throw upsertError;
      setSaved(mode === 'edit' ? 'Pratique enregistrée' : 'Merci — on pré-remplira tes prochains kits d’après ta pratique.');
      onSaved?.(values as unknown as Orientation);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d’enregistrer.');
    } finally {
      setSaving(false);
    }
  };

  const allAnswered = SECTIONS.every(({ key }) => Boolean(values[key]));

  return (
    <div className="glass glass-sub-card p-5 sm:p-6 rounded-2xl">
      <p className="glass-eyebrow mb-1">Ta pratique</p>
      <h3 className="font-display font-bold text-[#17402C] text-lg tracking-tight mb-1">
        Comment tu marches ?
      </h3>
      <p className="text-sm text-[#5A7064] mb-5">
        Quatre questions factuelles — privées, jamais affichées. Elles pré-remplissent tes
        prochains kits, tu restes libre de tout changer.
      </p>

      {loading ? (
        <div className="flex justify-center py-8" role="status" aria-live="polite">
          <div className="w-6 h-6 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map(({ key, values: sectionValues }) => (
            <div key={key} role="group" aria-label={SECTION_QUESTIONS[key]}>
              <p className="text-xs font-semibold text-[#17402C] mb-2">{SECTION_QUESTIONS[key]}</p>
              <div className="glass-capsule-bar flex flex-wrap gap-1 p-1">
                {sectionValues.map((v) => {
                  const isActive = values[key] === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggle(key, v)}
                      aria-pressed={isActive}
                      className={`glass-capsule-segment text-sm font-medium transition-colors ${isActive ? 'active' : ''}`}
                      style={{
                        minHeight: 44,
                        padding: '10px 14px',
                        borderRadius: 999,
                        color: isActive ? '#17402C' : '#365233',
                        background: isActive ? 'rgba(255,255,255,0.75)' : 'transparent',
                        border: isActive ? '1px solid rgba(23,64,44,0.25)' : '1px solid transparent',
                      }}
                    >
                      {SEGMENT_LABELS[key as keyof typeof SEGMENT_LABELS][v]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={persist}
              disabled={!user || saving || !allAnswered}
              className="glass-capsule-btn primary text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ minHeight: 44 }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer ma pratique'}
            </button>
            <button
              type="button"
              onClick={onPasser}
              className="glass-capsule-btn secondary text-sm font-medium"
              style={{ minHeight: 44 }}
            >
              Passer
            </button>
          </div>

          {saved && (
            <p className="text-sm text-[#365233] font-medium" role="status" aria-live="polite">
              ✓ {saved}
            </p>
          )}
          {error && (
            <p className="text-sm text-[#8A241B]" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}