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
          border: '1px solid rgba(28,38,32,0.06)',
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
    <div
      style={{
        background: 'linear-gradient(135deg, #EDF7F0, #F5F2EA)',
        border: '1px solid rgba(45,106,79,0.2)',
        borderRadius: '18px',
        padding: '16px',
        marginBottom: '8px',
      }}
    >
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#2D6A4F', fontFamily: 'var(--font-mono)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
        🥾 Ton profil randonneur
      </p>

      {/* Phrase naturelle */}
      <p style={{ fontSize: '14px', color: '#1C2620', lineHeight: 1.5, marginBottom: '12px' }}>
        {phrase}
      </p>

      {/* Stats compactes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { icon: '📏', value: `${Math.round(Number(stats.total_distance_km))} km`, label: 'Total' },
          { icon: '⏱', value: formatPace(Number(stats.avg_pace_min_per_km)), label: 'Allure moy.' },
          { icon: '↑', value: stats.avg_elevation_gain_m ? `${Math.round(Number(stats.avg_elevation_gain_m))} m` : '—', label: 'D+ moy.' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: 'rgba(255,255,255,0.7)',
              borderRadius: '12px',
              padding: '10px 8px',
              textAlign: 'center',
              border: '1px solid rgba(45,106,79,0.1)',
            }}
          >
            <div style={{ fontSize: '16px', marginBottom: '2px' }}>{s.icon}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1C2620' }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#9AAD9E', marginTop: '1px' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
