'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface SavedTrail {
  id: string;
  trail_id: string;
  trail_name: string;
  trail_data: {
    difficulty?: string;
    distance_km?: number;
    elevation_gain?: number;
    duration_hours?: number;
    country?: string;
    region?: string;
    trail_type?: string;
  };
  created_at: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  moderate: '#f59e0b',
  hard: '#ef4444',
  expert: '#7c3aed',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  moderate: 'Modéré',
  hard: 'Difficile',
  expert: 'Expert',
};

export default function MesAventuresPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [savedTrails, setSavedTrails] = useState<SavedTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from('saved_trails')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setSavedTrails([]); }
        else { setSavedTrails(data || []); }
        setLoading(false);
      })
      .then(undefined, (e: any) => { setError(e?.message || 'Erreur lors du chargement'); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const removeTrail = async (id: string) => {
    setRemoving(id);
    await supabase.from('saved_trails').delete().eq('id', id);
    setSavedTrails(prev => prev.filter(t => t.id !== id));
    setRemoving(null);
  };

  const desktopContent = (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-2xl flex items-center gap-3">
            <span className="text-3xl">⭐</span>
            Mes aventures enregistrées
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {savedTrails.length} sentier{savedTrails.length !== 1 ? 's' : ''} sauvegardé{savedTrails.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/carte-interactive"
          className="flex items-center gap-2 bg-[#17402C] text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Explorer la carte
        </Link>
      </div>

      {/* Not logged in */}
      {!user && !loading && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-white font-bold text-xl mb-2">Connexion requise</h2>
          <p className="text-white/50 text-sm mb-6">Connectez-vous pour voir vos aventures sauvegardées</p>
          <Link href="/connexion" className="bg-[#17402C] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity">
            Se connecter
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} className="bg-[#1a2420] border-white/8" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-white font-bold text-xl mb-2">Erreur de chargement</h2>
          <p className="text-white/50 text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-[#17402C] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity cursor-pointer">
            Réessayer
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && user && savedTrails.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🗺</div>
          <h2 className="text-white font-bold text-xl mb-2">Aucune aventure sauvegardée</h2>
          <p className="text-white/50 text-sm mb-6">
            Explorez la carte et cliquez sur ⭐ pour sauvegarder vos sentiers préférés
          </p>
          <Link href="/carte-interactive" className="bg-[#17402C] text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity">
            Explorer la carte
          </Link>
        </div>
      )}

      {/* Trail list */}
      {!loading && savedTrails.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {savedTrails.map(saved => {
            const d = saved.trail_data || {};
            const color = DIFFICULTY_COLORS[d.difficulty || ''] || '#6b7280';
            const diffLabel = DIFFICULTY_LABELS[d.difficulty || ''] || d.difficulty;
            return (
              <div key={saved.id} className="bg-[#1a2420] border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate mb-1">
                      🥾 {saved.trail_name || 'Sentier sans nom'}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {d.difficulty && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
                          {diffLabel}
                        </span>
                      )}
                      {d.trail_type && (
                        <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{d.trail_type}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTrail(saved.id)}
                    disabled={removing === saved.id}
                    className="text-white/20 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
                    title="Retirer des favoris"
                  >
                    {removing === saved.id ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { icon: '📏', val: d.distance_km ? `${d.distance_km} km` : '—' },
                    { icon: '⬆️', val: d.elevation_gain ? `${d.elevation_gain}m` : '—' },
                    { icon: '⏱', val: d.duration_hours ? `${d.duration_hours}h` : '—' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white/4 rounded-lg p-2 text-center">
                      <div className="text-sm">{s.icon}</div>
                      <div className="text-white text-xs font-bold mt-0.5">{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Location */}
                {(d.region || d.country) && (
                  <p className="text-white/35 text-xs mb-3">
                    📍 {[d.region, d.country].filter(Boolean).join(' · ')}
                  </p>
                )}

                {/* Saved date */}
                <p className="text-white/25 text-[10px] mb-3">
                  Sauvegardé le {new Date(saved.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>

                {/* Action */}
                <Link
                  href="/carte-interactive"
                  className="w-full flex items-center justify-center gap-2 bg-[#17402C]/15 border border-[#17402C]/25 text-[#17402C] text-xs font-medium py-2 rounded-xl hover:bg-[#17402C]/25 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Voir sur la carte
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const mobileContent = (
    <div style={{ padding: '16px', color: '#FFFFFF' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px 0' }}>
            Mes aventures
          </h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
            {savedTrails.length} sentier{savedTrails.length !== 1 ? 's' : ''} sauvegarde{savedTrails.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/carte-interactive"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#17402C', color: '#fff', fontSize: '12px', fontWeight: 600, padding: '8px 14px', borderRadius: '10px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
          Explorer
        </Link>
      </div>

      {/* Not logged in */}
      {!user && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Connexion requise</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>Connectez-vous pour voir vos aventures sauvegardees</p>
          <Link href="/connexion" style={{ background: '#17402C', color: '#fff', padding: '10px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>
            Se connecter
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="bg-[#1a2420] border-white/8" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Erreur de chargement</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ background: '#17402C', color: '#fff', padding: '10px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer', display: 'inline-block' }}>
            Reessayer
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && user && savedTrails.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Aucune aventure sauvegardee</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
            Explorez la carte et cliquez sur ⭐ pour sauvegarder vos sentiers preferes
          </p>
          <Link href="/carte-interactive" style={{ background: '#17402C', color: '#fff', padding: '10px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none', display: 'inline-block' }}>
            Explorer la carte
          </Link>
        </div>
      )}

      {/* Trail list */}
      {!loading && savedTrails.length > 0 && (
        <div>
          {savedTrails.map(saved => {
            const d = saved.trail_data || {};
            const color = DIFFICULTY_COLORS[d.difficulty || ''] || '#6b7280';
            const diffLabel = DIFFICULTY_LABELS[d.difficulty || ''] || d.difficulty;
            return (
              <div key={saved.id} style={{ background: '#1a2420', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ color: '#fff', fontWeight: 700, fontSize: '14px', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      🥾 {saved.trail_name || 'Sentier sans nom'}
                    </h3>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {d.difficulty && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: `${color}20`, color, border: `1px solid ${color}40` }}>
                          {diffLabel}
                        </span>
                      )}
                      {d.trail_type && (
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '20px' }}>{d.trail_type}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTrail(saved.id)}
                    disabled={removing === saved.id}
                    style={{ color: 'rgba(255,255,255,0.2)', border: 'none', background: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0 }}
                  >
                    {removing === saved.id ? (
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'transparent', animation: 'lkdv-spin 0.8s linear infinite' }} />
                    ) : (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    )}
                  </button>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  {[
                    { icon: '📏', val: d.distance_km ? `${d.distance_km} km` : '—' },
                    { icon: '⬆️', val: d.elevation_gain ? `${d.elevation_gain}m` : '—' },
                    { icon: '⏱', val: d.duration_hours ? `${d.duration_hours}h` : '—' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px' }}>{s.icon}</div>
                      <div style={{ color: '#fff', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Location */}
                {(d.region || d.country) && (
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '0 0 8px 0' }}>
                    📍 {[d.region, d.country].filter(Boolean).join(' · ')}
                  </p>
                )}

                {/* Saved date */}
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px', margin: '0 0 10px 0' }}>
                  Sauvegarde le {new Date(saved.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>

                {/* Action button */}
                <Link
                  href={`/preparer-randonnee?routeId=${saved.trail_id}`}
                  className="w-full relative overflow-hidden group flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#17402C] via-[#1E5238] to-[#17402C] text-white text-xs font-bold tracking-wide shadow-[0_4px_12px_rgba(23,64,44,0.3)] border border-white/15 active:scale-[0.98] transition-all no-underline"
                >
                  <span className="text-sm">🎒</span>
                  <span>Préparer ma randonnée</span>
                  <svg className="w-3.5 h-3.5 ml-0.5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-[#17402C]">
          <Header />
          {desktopContent}
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell background="#17402C">
          {mobileContent}
        </MobilePageShell>
        
      </div>
    </>
  );
}
