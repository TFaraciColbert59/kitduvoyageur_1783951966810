'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui';

interface HikingStats {
  total_sessions: number;
  total_distance_km: number;
  avg_distance_km: number;
  avg_pace_min_per_km: number;
  avg_elevation_gain_m: number;
  favorite_difficulty: string | null;
  most_active_weekday: string | null;
}

function formatPace(minPerKm: number): string {
  if (!minPerKm || minPerKm === 0) return '--:--';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')} min/km`;
}

function dayLabel(day: string | null): string {
  if (!day) return '';
  const map: Record<string, string> = {
    Monday: 'lundi', Tuesday: 'mardi', Wednesday: 'mercredi',
    Thursday: 'jeudi', Friday: 'vendredi', Saturday: 'samedi', Sunday: 'dimanche',
  };
  const trimmed = day.trim();
  return map[trimmed] || trimmed.toLowerCase();
}

function difficultyLabel(d: string | null): string {
  if (!d) return '';
  const map: Record<string, string> = {
    hiking: 'randonnées de montagne',
    demanding_alpine_hiking: 'randonnées alpines exigeantes',
    easy_hiking: 'balades faciles',
  };
  return map[d] || d;
}

/**
 * Carte "Ton profil randonneur" — affichée dans la page Profil.
 * Appelle la fonction SQL get_user_hiking_stats via supabase.rpc().
 * N'affiche rien de significatif si total_sessions < 3.
 */
export default function HikingProfileCard() {
  const [stats, setStats] = useState<HikingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data, error } = await supabase.rpc('get_user_hiking_stats', {
          p_user_id: user.id,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          setStats(data[0] as HikingStats);
        } else if (!error && data && typeof data === 'object') {
          setStats(data as HikingStats);
        }
      } catch (err) {
        console.error('[HikingProfileCard]', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return null;
  if (!stats) return null;

  // Seuil minimum : 3 sorties pour avoir du sens statistiquement
  if (stats.total_sessions < 3) {
    return (
      <Card className="p-4 mb-2">
        <p className="mb-[var(--space-2)] font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--lkv-text-subtle)]">
          🥾 Profil Randonneur
        </p>
        <p className="text-[13px] text-[color:var(--lkv-text-muted)]">
          Fais encore quelques randonnées pour débloquer ton profil.{' '}
          <span className="text-[color:var(--lkv-text-subtle)]">({stats.total_sessions}/3 sorties)</span>
        </p>
      </Card>
    );
  }

  const phrase = [
    `${stats.total_sessions} randonnée${stats.total_sessions > 1 ? 's' : ''} au compteur`,
    stats.total_distance_km > 0 && `${Math.round(Number(stats.total_distance_km))} km parcourus`,
    stats.avg_distance_km > 0 && `une moyenne de ${Number(stats.avg_distance_km).toFixed(1)} km par sortie`,
    stats.favorite_difficulty && `plutôt en ${difficultyLabel(stats.favorite_difficulty)}`,
    stats.most_active_weekday && `souvent en sortie le ${dayLabel(stats.most_active_weekday)}`,
  ].filter(Boolean).join(', ') + '.';

  return (
    <Card className="p-4.5 mb-3">
      <p className="text-[11px] font-mono uppercase tracking-wider font-bold text-[color:var(--lkv-primary)] mb-2">
        🥾 Ton profil randonneur
      </p>

      {/* Phrase naturelle */}
      <p className="text-sm font-serif italic leading-relaxed text-[color:var(--lkv-primary)] mb-3">
        {phrase}
      </p>

      {/* Stats compactes */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: '📏', value: `${Math.round(Number(stats.total_distance_km))} km`, label: 'Total' },
          { icon: '⏱', value: formatPace(Number(stats.avg_pace_min_per_km)), label: 'Allure moy.' },
          { icon: '↑', value: stats.avg_elevation_gain_m ? `${Math.round(Number(stats.avg_elevation_gain_m))} m` : '—', label: 'D+ moy.' },
        ].map((s) => (
          <Card key={s.label} variant="compact" className="p-2.5 text-center">
            <div className="text-base mb-0.5">{s.icon}</div>
            <div className="text-xs font-bold text-[color:var(--lkv-primary)]">{s.value}</div>
            <div className="text-[10px] text-[color:var(--lkv-text-muted)] mt-0.5 font-medium">{s.label}</div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
