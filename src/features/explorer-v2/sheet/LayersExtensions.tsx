'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { XpEmpty, XpEyebrow, XpRow, XpRows } from './blocks';
import type { SheetContext } from './context';

const HEATMAP_SPORTS = [
  { id: 'all', label: 'Tous sports' },
  { id: 'hike', label: 'Rando' },
  { id: 'trail', label: 'Trail' },
  { id: 'mtb', label: 'VTT' },
  { id: 'road_cycling', label: 'Route' },
  { id: 'gravel', label: 'Gravel' },
] as const;

const COMMUNITY_WINDOWS = [
  { id: 'global', label: 'Globale' },
  { id: 'last_7_days', label: '7 derniers jours' },
  { id: 'nocturnal', label: 'Nocturne' },
] as const;

const PERSONAL_PERIODS = [
  { id: 'all_time', label: 'Tout temps' },
  { id: 'year', label: 'Année' },
  { id: 'season', label: 'Saison' },
  { id: 'month', label: 'Mois' },
] as const;

/**
 * Sous-tiroirs C02 (K3.07, K3.08, S3.16, S3.17, S3.18, S3.19) dans « Couches & fonds ».
 * C-UI : un niveau de pile avec retour direct vers les calques parents.
 */
export function HeatmapSubDrawer({
  mode,
  ctx,
}: {
  mode: 'community' | 'personal';
  ctx: SheetContext;
}) {
  const { state } = ctx;
  const heatmap = ctx.heatmap;
  const comm = state.communityHeatmap ?? { enabled: false, sport: 'all', window: 'global' as const };
  const pers = state.personalHeatmap ?? {
    enabled: false,
    sport: 'all',
    period: 'all_time' as const,
    comparePeriod: null,
  };

  return (
    <>
      <div className="xp-row" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="xp-chip"
          onClick={() => state.setHeatmapSubDrawer(null)}
        >
          ← Retour aux calques
        </button>
      </div>

      {mode === 'community' ? (
        <>
          <XpEyebrow>Fréquentation collective anonymisée (C02)</XpEyebrow>
          <XpRows>
            <XpRow
              icon="pulse"
              title={comm.enabled ? 'Masquer la heatmap collective' : 'Afficher sur la carte'}
              sub={
                heatmap?.communityStatus === 'loading'
                  ? 'Calcul de l’agrégat k-anonyme…'
                  : heatmap?.communityStatus === 'error'
                    ? 'Agrégat momentanément indisponible'
                    : comm.enabled
                      ? `${heatmap?.communityCount ?? 0} cellules publiables (${heatmap?.communitySuppressed ?? 0} masquées par k-anonymat)`
                      : 'Grille agrégée · aucune trace brute ni identité'
              }
              badge={{
                label: comm.enabled ? 'Actif' : 'Masqué',
                tone: comm.enabled ? 'good' : 'muted',
              }}
              onClick={() => state.setCommunityHeatmap({ enabled: !comm.enabled })}
            />
          </XpRows>

          <XpEyebrow>Sport</XpEyebrow>
          <div className="xp-chiprow" role="radiogroup" aria-label="Sport de la heatmap collective">
            {HEATMAP_SPORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="xp-chip"
                aria-pressed={comm.sport === item.id}
                onClick={() => state.setCommunityHeatmap({ sport: item.id, enabled: true })}
              >
                {item.label}
              </button>
            ))}
          </div>

          <XpEyebrow>Fenêtre temporelle (K3.07 / S3.17 / S3.18)</XpEyebrow>
          <div className="xp-chiprow" role="radiogroup" aria-label="Fenêtre temporelle">
            {COMMUNITY_WINDOWS.map((win) => (
              <button
                key={win.id}
                type="button"
                className="xp-chip"
                aria-pressed={comm.window === win.id}
                onClick={() => state.setCommunityHeatmap({ window: win.id, enabled: true })}
              >
                {win.label}
              </button>
            ))}
          </div>

          <p className="xp-layer-note">
            K-anonymat appliqué côté serveur : seules les cellules atteignant le seuil minimum de
            contributeurs distincts après retrait des zones privées (K7.05) et des personnes en
            opt-out (K7.06) sont dessinées. Activités éligibles : {heatmap?.communityEligible ?? 0}.
          </p>
        </>
      ) : (
        <>
          <XpEyebrow>Ma heatmap personnelle (K3.08 / S3.19)</XpEyebrow>
          <XpRows>
            <XpRow
              icon="map"
              title={pers.enabled ? 'Masquer ma heatmap' : 'Afficher mes traces agrégées'}
              sub={
                heatmap?.personalStatus === 'unauthorized'
                  ? 'Connexion requise · strictement réservée au propriétaire'
                  : heatmap?.personalStatus === 'loading'
                    ? 'Chargement de tes sorties…'
                    : heatmap?.personalStatus === 'error'
                      ? 'Impossible de charger ta heatmap'
                      : pers.enabled
                        ? `${heatmap?.personalCount ?? 0} cellules · ${heatmap?.personalActivities ?? 0} sorties`
                        : 'Visible uniquement par toi · sorties privées incluses'
              }
              badge={{
                label:
                  heatmap?.personalStatus === 'unauthorized'
                    ? 'Connexion requise'
                    : pers.enabled
                      ? 'Actif'
                      : 'Masqué',
                tone:
                  heatmap?.personalStatus === 'unauthorized'
                    ? 'warn'
                    : pers.enabled
                      ? 'good'
                      : 'muted',
              }}
              onClick={() => state.setPersonalHeatmap({ enabled: !pers.enabled })}
            />
          </XpRows>

          <XpEyebrow>Sport</XpEyebrow>
          <div className="xp-chiprow" role="radiogroup" aria-label="Sport personnel">
            {HEATMAP_SPORTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="xp-chip"
                aria-pressed={pers.sport === item.id}
                onClick={() => state.setPersonalHeatmap({ sport: item.id, enabled: true })}
              >
                {item.label}
              </button>
            ))}
          </div>

          <XpEyebrow>Période</XpEyebrow>
          <div className="xp-chiprow" role="radiogroup" aria-label="Période personnelle">
            {PERSONAL_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="xp-chip"
                aria-pressed={pers.period === p.id}
                onClick={() => state.setPersonalHeatmap({ period: p.id, enabled: true })}
              >
                {p.label}
              </button>
            ))}
          </div>

          <XpEyebrow>Comparaison entre périodes (S3.19)</XpEyebrow>
          <div className="xp-chiprow" role="radiogroup" aria-label="Comparer à">
            {[
              { id: null, label: 'Aucune' },
              { id: 'year' as const, label: 'Année' },
              { id: 'month' as const, label: 'Mois' },
            ].map((cmp) => (
              <button
                key={cmp.label}
                type="button"
                className="xp-chip"
                aria-pressed={pers.comparePeriod === cmp.id}
                onClick={() => state.setPersonalHeatmap({ comparePeriod: cmp.id, enabled: true })}
              >
                {cmp.label}
              </button>
            ))}
          </div>
          {heatmap?.comparisonDeltaCells !== null && heatmap?.comparisonDeltaCells !== undefined ? (
            <p className="xp-layer-note">
              Écart de couverture avec la période comparée :{' '}
              {heatmap.comparisonDeltaCells >= 0 ? '+' : ''}
              {heatmap.comparisonDeltaCells} cellules.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * K3.13 — Signalement rapide d'erreur carte ou d'accès (route fermée, balisage, obstacle).
 */
export function ReportMapErrorPanel({ ctx }: { ctx: SheetContext }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<'closure' | 'marking' | 'obstacle' | 'water' | 'danger'>('closure');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.access_token || !session.user?.id) {
        setFeedback('Connecte-toi pour envoyer un signalement carte ou accès.');
        setBusy(false);
        return;
      }
      const [lng, lat] = ctx.state.center;
      const res = await fetch('/api/explorer/v2/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reporterId: session.user.id,
          lat,
          lng,
          category,
          severity: category === 'danger' || category === 'closure' ? 'warning' : 'info',
          passability: category === 'closure' ? 'impassable' : 'difficult',
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setFeedback(err?.error ?? 'Envoi impossible pour le moment.');
      } else {
        setDescription('');
        setOpen(false);
        setFeedback('Signalement enregistré sur la zone.');
      }
    } catch {
      setFeedback('Réseau indisponible pour envoyer le signalement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <XpRows>
        <XpRow
          icon="alert"
          tone="warn"
          title="Signaler une erreur carte ou accès"
          sub="Sentier fermé, balisage manquant, obstacle ou point d’eau"
          badge={{ label: open ? 'Fermer' : 'Signaler', tone: 'warn' }}
          onClick={() => setOpen((v) => !v)}
        />
      </XpRows>
      {feedback ? <p className="xp-layer-note">{feedback}</p> : null}
      {open ? (
        <form onSubmit={submit} style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <div className="xp-chiprow">
            {[
              { id: 'closure' as const, label: 'Accès fermé' },
              { id: 'marking' as const, label: 'Balisage / carte' },
              { id: 'obstacle' as const, label: 'Obstacle' },
              { id: 'water' as const, label: 'Point d’eau' },
              { id: 'danger' as const, label: 'Danger' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className="xp-chip"
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Précision terrain (barrière, éboulement, nom erroné…)"
            rows={2}
            maxLength={400}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(23,43,36,0.18)',
              font: 'inherit',
            }}
          />
          <button type="submit" className="xp-chip" disabled={busy}>
            {busy ? 'Envoi…' : 'Envoyer au centre de la carte'}
          </button>
        </form>
      ) : null}
    </>
  );
}

/**
 * K3.11 — Liste et accès rapide aux lieux enregistrés localement.
 */
export function SavedPlacesPanel({ ctx }: { ctx: SheetContext }) {
  const places = ctx.state.savedPlaces ?? [];
  if (ctx.state.layerVisibility?.savedPlaces !== true) return null;

  return places.length === 0 ? (
    <XpEmpty
      title="Aucun lieu enregistré"
      hint="Ouvre un repère sur la carte et appuie sur « Enregistrer dans Mes lieux »."
    />
  ) : (
    <XpRows>
      {places.map((place) => (
        <XpRow
          key={place.id}
          icon="star"
          tone="good"
          title={place.name}
          sub={`${place.kind} · ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`}
          badge={{ label: 'Recentrer', tone: 'muted' }}
          onClick={() => {
            ctx.state.setCenter([place.lng, place.lat], Math.max(ctx.state.zoom, 13));
            ctx.state.setCamera({ type: 'reveal', center: [place.lng, place.lat] });
          }}
        />
      ))}
    </XpRows>
  );
}
