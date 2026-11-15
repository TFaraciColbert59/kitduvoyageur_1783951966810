'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { CampaignParticipationMetrics } from '@/features/rankings/types';

interface CampaignItem {
  campaignId: string;
  sponsorId: string;
  sponsorName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allowedSports: string[];
  minDistanceMeters?: number;
  minElevationGainMeters?: number;
  requiresPublicVisibility: boolean;
  metrics: CampaignParticipationMetrics;
}

export default function PartnerCampaignsPanel() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [sport, setSport] = useState<'all' | 'hiking' | 'trail_running' | 'running' | 'cycling'>('all');
  const [minDistanceMeters, setMinDistanceMeters] = useState('5000');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/progression/campaigns', { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as {
        campaigns?: CampaignItem[];
        error?: string;
      } | null;
      if (!res.ok) {
        setError(json?.error || 'Impossible de charger les campagnes.');
        return;
      }
      setCampaigns(Array.isArray(json?.campaigns) ? json.campaigns : []);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sponsorName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const ends = new Date(now.getTime() + 30 * 86_400_000);
      const res = await fetch('/api/admin/progression/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          sponsorId: sponsorName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          sponsorName: sponsorName.trim(),
          startsAt: now.toISOString(),
          endsAt: ends.toISOString(),
          allowedSports: [sport],
          minDistanceMeters: Number(minDistanceMeters) > 0 ? Number(minDistanceMeters) : null,
          requiresPublicVisibility: true,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(json?.error || 'Création impossible.');
        return;
      }
      setTitle('');
      setSponsorName('');
      await load();
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label="Campagnes partenaires B2B"
      className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-widest text-white/40">
          Partenaires &amp; B2B · S6.26
        </p>
        <h2 className="text-lg font-semibold text-white">Campagnes sponsorisées &amp; agrégats</h2>
        <p className="text-sm text-white/60">
          Métriques agrégées uniquement : activités publiques validées, opt-outs et comptes bloqués
          exclus. Aucun export nominatif.
        </p>
      </header>

      <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de la campagne"
          className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/40"
        />
        <input
          type="text"
          required
          value={sponsorName}
          onChange={(e) => setSponsorName(e.target.value)}
          placeholder="Nom du partenaire"
          className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/40"
        />
        <select
          value={sport}
          onChange={(e) => setSport(e.target.value as typeof sport)}
          className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white"
        >
          <option value="all">Tous sports</option>
          <option value="hiking">Randonnée</option>
          <option value="trail_running">Trail</option>
          <option value="running">Course à pied</option>
          <option value="cycling">Vélo</option>
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            value={minDistanceMeters}
            onChange={(e) => setMinDistanceMeters(e.target.value)}
            placeholder="Distance min (m)"
            className="h-10 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white"
          />
          <button
            type="submit"
            disabled={saving}
            className="h-10 shrink-0 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-white/50">Chargement des campagnes…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-white/50">Aucune campagne partenaire enregistrée.</p>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((camp) => (
            <li
              key={camp.campaignId}
              className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{camp.title}</p>
                  <p className="text-xs text-white/50">Partenaire : {camp.sponsorName}</p>
                </div>
                <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-emerald-300">
                  {camp.metrics.uniqueParticipants} participant(s) uniques
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/70 sm:grid-cols-4">
                <span>Validées : {camp.metrics.validatedActivities}</span>
                <span>Rejetées : {camp.metrics.rejectedActivities}</span>
                <span>Distance : {Math.round(camp.metrics.totalDistanceMeters / 1000)} km</span>
                <span>D+ : {Math.round(camp.metrics.totalElevationGainMeters)} m</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
