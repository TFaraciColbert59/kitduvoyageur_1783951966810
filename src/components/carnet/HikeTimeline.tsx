'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface CarnetMoment {
  id: string;
  citation: string | null;
  heure: string | null;
  lieu: string | null;
  image_url: string | null;
  moment_timestamp: string | null;
  source: 'manuel' | 'auto' | null;
  hike_session_id: string | null;
  jour_numero: number | null;
  created_at: string;
}

interface HikeSession {
  id: string;
  started_at: string;
  ended_at: string;
  distance_km: number;
  duration_seconds: number;
  elevation_gain_m: number | null;
  poi_events: { poiName: string; reachedAt: string; lat: number; lon: number }[];
  narratives: {
    journal: string;
    aventure: string;
    sportive: string;
    generated_at: string;
  } | null;
}

interface Props {
  carnetId: string;
  moments: CarnetMoment[];
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function sortKey(m: CarnetMoment): number {
  if (m.moment_timestamp) return new Date(m.moment_timestamp).getTime();
  return new Date(m.created_at).getTime();
}

function MomentIcon({ source }: { source: 'manuel' | 'auto' | null }) {
  if (source === 'auto') {
    return (
      <div className="w-8 h-8 rounded-full bg-[#EDF7F0] border-2 border-[#2D6A4F] flex items-center justify-center flex-shrink-0 text-sm">
        📍
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-[#F5F2EA] border-2 border-[#C8C0A8] flex items-center justify-center flex-shrink-0 text-sm">
      ✏️
    </div>
  );
}

type NarrativeTab = 'journal' | 'aventure' | 'sportive';

function NarrativePanel({ session, carnetId }: { session: HikeSession; carnetId: string }) {
  const [tab, setTab] = useState<NarrativeTab>('journal');
  const [narratives, setNarratives] = useState(session.narratives);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/hike-sessions/${session.id}/narrative`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setNarratives(data);
      }
    } catch (err) {
      console.error('[NarrativePanel] generate error:', err);
    } finally {
      setGenerating(false);
    }
  }, [session.id]);

  const addToCarnet = useCallback(async () => {
    if (!narratives) return;
    const text = narratives[tab];
    try {
      await fetch('/api/carnet/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carnetId,
          citation: text,
          source: 'auto',
          hike_session_id: session.id,
          moment_timestamp: session.ended_at,
        }),
      });
    } catch (err) {
      console.error('[NarrativePanel] addToCarnet error:', err);
    }
  }, [narratives, tab, carnetId, session.id, session.ended_at]);

  const copyText = useCallback(() => {
    if (!narratives) return;
    navigator.clipboard.writeText(narratives[tab]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [narratives, tab]);

  if (!narratives) {
    return (
      <button
        id={`generate-narrative-${session.id}`}
        onClick={generate}
        disabled={generating}
        className="w-full mt-3 py-2.5 bg-[#1C2620] text-white text-xs font-semibold rounded-xl hover:bg-[#2D3F35] transition-colors flex items-center justify-center gap-2"
      >
        {generating ? (
          <><span className="animate-spin">⏳</span> Génération en cours…</>
        ) : (
          <><span>✨</span> Générer le récit IA</>
        )}
      </button>
    );
  }

  const TABS: { key: NarrativeTab; label: string; icon: string }[] = [
    { key: 'journal', label: 'Journal', icon: '📖' },
    { key: 'aventure', label: 'Aventure', icon: '⛰️' },
    { key: 'sportive', label: 'Sportif', icon: '🏃' },
  ];

  return (
    <div className="mt-3">
      {/* Onglets */}
      <div className="flex gap-1 mb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === t.key
                ? 'bg-[#1C2620] text-white'
                : 'bg-[#F5F2EA] text-[#5A6A5D] hover:bg-[#EAE6D8]'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <p className="text-sm text-[#5A6A5D] leading-relaxed bg-[#FAFAF7] rounded-xl p-3 border border-[#E8E4D8]">
        {narratives[tab]}
      </p>

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={copyText}
          className="flex-1 py-1.5 text-xs font-medium bg-[#F5F2EA] text-[#3A4A3D] rounded-lg hover:bg-[#EAE6D8] transition-colors"
        >
          {copied ? '✅ Copié !' : '📋 Copier'}
        </button>
        <button
          onClick={addToCarnet}
          className="flex-1 py-1.5 text-xs font-medium bg-[#EDF7F0] text-[#2D5A27] rounded-lg hover:bg-[#D8F0E0] transition-colors"
        >
          📝 Ajouter au carnet
        </button>
        <button
          onClick={generate}
          disabled={generating}
          className="flex-1 py-1.5 text-xs font-medium bg-[#F5F2EA] text-[#7A8A7D] rounded-lg hover:bg-[#EAE6D8] transition-colors disabled:opacity-50"
        >
          {generating ? '⏳' : '🔄'} Regénérer
        </button>
      </div>
    </div>
  );
}

export default function HikeTimeline({ carnetId, moments }: Props) {
  const [sessions, setSessions] = useState<HikeSession[]>([]);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/hike-sessions?carnetId=${carnetId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSessions(data);
      })
      .catch(() => {});
  }, [carnetId]);

  const toggleSession = useCallback((id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Trier les moments
  const sorted = [...moments].sort((a, b) => sortKey(a) - sortKey(b));

  if (sorted.length === 0 && sessions.length === 0) {
    return (
      <div className="py-8 text-center text-[#A0A89D] text-sm">
        <p className="text-2xl mb-2">📭</p>
        <p>Aucun moment dans ce carnet.</p>
        <p className="text-xs mt-1">Démarre une randonnée ou ajoute des notes manuellement.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Ligne verticale */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-[#E8E4D8]" />

      <div className="space-y-6 pl-12">
        {/* Sessions de randonnée (cards collapsibles) */}
        {sessions.map((session) => {
          const sessionMoments = sorted.filter(
            (m) => m.hike_session_id === session.id
          );
          const isExpanded = expandedSessions.has(session.id);

          return (
            <div key={session.id} className="relative">
              {/* Dot */}
              <div className="absolute -left-9 top-1 w-4 h-4 rounded-full bg-[#2D6A4F] border-2 border-white shadow-sm" />

              <div className="bg-white rounded-2xl border border-[#E8E4D8] overflow-hidden">
                {/* Header session */}
                <button
                  onClick={() => toggleSession(session.id)}
                  className="w-full p-4 text-left hover:bg-[#FAFAF7] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#2D6A4F] uppercase tracking-widest mb-0.5">
                        🥾 Randonnée
                      </p>
                      <p className="text-sm font-semibold text-[#1C2620]">
                        {formatDate(session.started_at)}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-xs text-[#7A8A7D]">
                          📏 {Number(session.distance_km).toFixed(1)} km
                        </span>
                        <span className="text-xs text-[#7A8A7D]">
                          ⏱ {formatDuration(session.duration_seconds)}
                        </span>
                        {session.elevation_gain_m && (
                          <span className="text-xs text-[#7A8A7D]">
                            ↑ {Math.round(session.elevation_gain_m)} m
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[#C8C0A8] text-lg">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Contenu déroulé */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#F0EDE5]">
                    {/* Moments auto liés */}
                    {sessionMoments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {sessionMoments.map((m) => (
                          <div key={m.id} className="flex items-start gap-2.5">
                            <MomentIcon source={m.source} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#1C2620] leading-tight">
                                {m.citation}
                              </p>
                              {m.heure && (
                                <p className="text-[11px] text-[#A0A89D] mt-0.5">{m.heure}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* IA rédactrice */}
                    <NarrativePanel session={session} carnetId={carnetId} />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Moments manuels (hors session) */}
        {sorted
          .filter((m) => !m.hike_session_id || m.source === 'manuel')
          .map((m) => (
            <div key={m.id} className="relative">
              {/* Dot */}
              <div className="absolute -left-9 top-1 w-4 h-4 rounded-full bg-white border-2 border-[#C8C0A8] shadow-sm" />

              <div className="bg-white rounded-2xl border border-[#E8E4D8] p-4">
                <div className="flex items-start gap-2.5">
                  <MomentIcon source={m.source} />
                  <div className="flex-1 min-w-0">
                    {m.image_url && (
                      <img
                        src={m.image_url}
                        alt={m.citation || 'Photo'}
                        className="w-full h-32 object-cover rounded-xl mb-2"
                      />
                    )}
                    {m.citation && (
                      <p className="text-sm text-[#1C2620] leading-relaxed">{m.citation}</p>
                    )}
                    <div className="flex gap-3 mt-1">
                      {m.heure && (
                        <span className="text-[11px] text-[#A0A89D]">🕐 {m.heure}</span>
                      )}
                      {m.lieu && (
                        <span className="text-[11px] text-[#A0A89D]">📍 {m.lieu}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
