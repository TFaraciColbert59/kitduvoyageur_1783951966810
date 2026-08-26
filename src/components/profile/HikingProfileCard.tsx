'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
      <div
        style={{
          background: '#EDEAE0',
          border: '1px solid rgba(23,64,44,0.06)',
          borderRadius: '18px',
          padding: '16px',
          marginBottom: '8px',
        }}
      >
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#9AAD9E', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px' }}>
          🥾 Profil Randonneur
        </p>
        <p style={{ fontSize: '13px', color: '#5C6B5E' }}>
          Fais encore quelques randonnées pour débloquer ton profil.{' '}
          <span style={{ color: '#9AAD9E' }}>({stats.total_sessions}/3 sorties)</span>
        </p>
      </div>
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
    <div className="glass rounded-3xl p-4.5 border border-white/80 bg-white/85 backdrop-blur-xl shadow-xs mb-3">
      <p className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#17402C] mb-2">
        🥾 Ton profil randonneur
      </p>

      {/* Phrase naturelle */}
      <p className="text-sm font-serif italic leading-relaxed text-[#17402C] mb-3">
        {phrase}
      </p>

      {/* Stats compactes */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: '📏', value: `${Math.round(Number(stats.total_distance_km))} km`, label: 'Total' },
          { icon: '⏱', value: formatPace(Number(stats.avg_pace_min_per_km)), label: 'Allure moy.' },
          { icon: '↑', value: stats.avg_elevation_gain_m ? `${Math.round(Number(stats.avg_elevation_gain_m))} m` : '—', label: 'D+ moy.' },
        ].map((s) => (
          <div
            key={s.label}
            className="p-2.5 rounded-2xl text-center bg-white/80 border border-white shadow-2xs"
          >
            <div className="text-base mb-0.5">{s.icon}</div>
            <div className="text-xs font-bold text-[#17402C]">{s.value}</div>
            <div className="text-[10px] text-[#5A7064] mt-0.5 font-medium">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
