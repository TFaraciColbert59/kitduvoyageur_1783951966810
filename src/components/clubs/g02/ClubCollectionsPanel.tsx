'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Droplets,
  Home,
  Layers,
  MapPin,
  Mountain,
  Plus,
  ThumbsUp,
} from 'lucide-react';
import styles from './g02.module.css';

interface ClubCollection {
  id: string;
  title: string;
  description: string | null;
  discipline: string;
  difficulty: string;
  is_multi_day: boolean;
  created_at: string;
}

interface ClubCollectionRoute {
  id: string;
  collection_id: string;
  day_number: number;
  title: string;
  distance_km: number;
  elevation_gain_m: number;
  surface_breakdown?: Record<string, number>;
}

interface ClubHighlight {
  id: string;
  title: string;
  tip: string | null;
  category: 'panorama' | 'eau' | 'refuge' | 'danger' | 'singletrack';
  lat: number;
  lng: number;
  upvotes_count: number;
}

const HIGHLIGHT_META: Record<
  ClubHighlight['category'],
  { label: string; icon: React.ReactNode; color: string }
> = {
  panorama: { label: 'Panorama', icon: <Mountain size={14} />, color: '#0369a1' },
  eau: { label: 'Point d’eau', icon: <Droplets size={14} />, color: '#0284c7' },
  refuge: { label: 'Refuge', icon: <Home size={14} />, color: '#15803d' },
  danger: { label: 'Danger', icon: <AlertTriangle size={14} />, color: '#dc2626' },
  singletrack: { label: 'Singletrack', icon: <Compass size={14} />, color: '#7c3aed' },
};

export interface ClubCollectionsPanelProps {
  clubId: string;
  canWrite: boolean;
  defaultLat?: number;
  defaultLng?: number;
}

export function ClubCollectionsPanel({
  clubId,
  canWrite,
  defaultLat = 45.764,
  defaultLng = 4.835,
}: ClubCollectionsPanelProps) {
  const [collections, setCollections] = useState<ClubCollection[]>([]);
  const [routes, setRoutes] = useState<ClubCollectionRoute[]>([]);
  const [highlights, setHighlights] = useState<ClubHighlight[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'collections' | 'highlights'>('collections');
  const [showColForm, setShowColForm] = useState(false);
  const [showHlForm, setShowHlForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [colTitle, setColTitle] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colDiscipline, setColDiscipline] = useState('trail');
  const [colDifficulty, setColDifficulty] = useState<'facile' | 'intermediaire' | 'difficile' | 'expert'>('intermediaire');
  const [colRouteTitle, setColRouteTitle] = useState('');
  const [colKm, setColKm] = useState('14');
  const [colDplus, setColDplus] = useState('650');

  const [hlTitle, setHlTitle] = useState('');
  const [hlTip, setHlTip] = useState('');
  const [hlCat, setHlCat] = useState<ClubHighlight['category']>('panorama');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [colRes, hlRes] = await Promise.all([
        fetch(`/api/clubs/${clubId}/collections`),
        fetch(`/api/clubs/${clubId}/highlights`),
      ]);
      if (colRes.ok) {
        const cData = await colRes.json();
        setCollections(Array.isArray(cData.collections) ? cData.collections : []);
        setRoutes(Array.isArray(cData.routes) ? cData.routes : []);
      }
      if (hlRes.ok) {
        const hData = await hlRes.json();
        setHighlights(Array.isArray(hData.highlights) ? hData.highlights : []);
        setVotedIds(new Set(Array.isArray(hData.votedIds) ? hData.votedIds : []));
      }
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colTitle.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: colTitle.trim(),
          description: colDesc.trim() || null,
          discipline: colDiscipline,
          difficulty: colDifficulty,
          isMultiDay: false,
          route: colRouteTitle.trim()
            ? {
                title: colRouteTitle.trim(),
                distanceKm: Number(colKm) || 0,
                elevationGainM: Math.round(Number(colDplus) || 0),
                surfaceBreakdown: { trail: 80, gravel: 20 },
                startLat: defaultLat,
                startLng: defaultLng,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        setError('Impossible de créer la collection.');
        return;
      }
      setColTitle('');
      setColDesc('');
      setColRouteTitle('');
      setShowColForm(false);
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const handleCreateHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hlTitle.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/${clubId}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: hlTitle.trim(),
          tip: hlTip.trim() || null,
          category: hlCat,
          lat: defaultLat,
          lng: defaultLng,
        }),
      });
      if (!res.ok) {
        setError('Impossible d’ajouter ce Highlight.');
        return;
      }
      setHlTitle('');
      setHlTip('');
      setShowHlForm(false);
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const handleToggleVote = async (highlightId: string) => {
    const res = await fetch(`/api/clubs/${clubId}/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', highlightId }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setVotedIds((prev) => {
      const next = new Set(prev);
      if (data.voted) next.add(highlightId);
      else next.delete(highlightId);
      return next;
    });
    setHighlights((prev) =>
      prev.map((h) =>
        h.id === highlightId
          ? { ...h, upvotes_count: Math.max(0, h.upvotes_count + (data.voted ? 1 : -1)) }
          : h,
      ),
    );
  };

  return (
    <div className={styles.stack}>
      <div className={styles.rowBetween}>
        <div className={styles.tabs} role="tablist" aria-label="Collections et Highlights Komoot">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'collections'}
            className={styles.tab}
            onClick={() => setSubTab('collections')}
          >
            <Layers size={14} aria-hidden="true" /> Collections ({collections.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'highlights'}
            className={styles.tab}
            onClick={() => setSubTab('highlights')}
          >
            <MapPin size={14} aria-hidden="true" /> Highlights ({highlights.length})
          </button>
        </div>

        {canWrite ? (
          <button
            type="button"
            className={`${styles.button} ${styles.primary} ${styles.small}`}
            onClick={() => {
              if (subTab === 'collections') setShowColForm((v) => !v);
              else setShowHlForm((v) => !v);
            }}
          >
            <Plus size={14} aria-hidden="true" />{' '}
            {subTab === 'collections' ? 'Nouvelle collection' : 'Ajouter un Highlight'}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className={styles.card} style={{ borderColor: 'rgba(220,38,38,0.3)', color: '#b91c1c' }}>
          {error}
        </div>
      ) : null}

      {subTab === 'collections' && showColForm ? (
        <form onSubmit={handleCreateCollection} className={`${styles.card} ${styles.stack}`}>
          <b className={styles.cardTitle}>Créer une Collection Komoot du club</b>
          <input
            type="text"
            required
            placeholder="Titre (ex. Grands cols du Vercors)"
            value={colTitle}
            onChange={(e) => setColTitle(e.target.value)}
            className={styles.input}
          />
          <textarea
            rows={2}
            placeholder="Description de la collection…"
            value={colDesc}
            onChange={(e) => setColDesc(e.target.value)}
            className={styles.textarea}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <select
              value={colDiscipline}
              onChange={(e) => setColDiscipline(e.target.value)}
              className={styles.select}
              aria-label="Discipline"
            >
              <option value="trail">Trail</option>
              <option value="rando">Randonnée</option>
              <option value="gravel">Gravel</option>
              <option value="vtt">VTT</option>
            </select>
            <select
              value={colDifficulty}
              onChange={(e) => setColDifficulty(e.target.value as typeof colDifficulty)}
              className={styles.select}
              aria-label="Niveau"
            >
              <option value="facile">Facile</option>
              <option value="intermediaire">Intermédiaire</option>
              <option value="difficile">Difficile</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="1er itinéraire (optionnel)"
            value={colRouteTitle}
            onChange={(e) => setColRouteTitle(e.target.value)}
            className={styles.input}
          />
          {colRouteTitle.trim() ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input
                type="number"
                min={0}
                value={colKm}
                onChange={(e) => setColKm(e.target.value)}
                placeholder="Distance (km)"
                className={styles.input}
              />
              <input
                type="number"
                min={0}
                value={colDplus}
                onChange={(e) => setColDplus(e.target.value)}
                placeholder="D+ (m)"
                className={styles.input}
              />
            </div>
          ) : null}
          <button type="submit" disabled={busy} className={`${styles.button} ${styles.primary}`}>
            {busy ? 'Enregistrement…' : 'Enregistrer la collection'}
          </button>
        </form>
      ) : null}

      {subTab === 'highlights' && showHlForm ? (
        <form onSubmit={handleCreateHighlight} className={`${styles.card} ${styles.stack}`}>
          <b className={styles.cardTitle}>Ajouter un Highlight collaboratif</b>
          <input
            type="text"
            required
            placeholder="Nom du spot (ex. Source du Col Vert)"
            value={hlTitle}
            onChange={(e) => setHlTitle(e.target.value)}
            className={styles.input}
          />
          <select
            value={hlCat}
            onChange={(e) => setHlCat(e.target.value as ClubHighlight['category'])}
            className={styles.select}
            aria-label="Catégorie"
          >
            <option value="panorama">Panorama</option>
            <option value="eau">Point d’eau</option>
            <option value="refuge">Refuge</option>
            <option value="singletrack">Singletrack</option>
            <option value="danger">Danger / Vigilance</option>
          </select>
          <textarea
            rows={2}
            placeholder="Conseil terrain pour les membres…"
            value={hlTip}
            onChange={(e) => setHlTip(e.target.value)}
            className={styles.textarea}
          />
          <button type="submit" disabled={busy} className={`${styles.button} ${styles.primary}`}>
            {busy ? 'Publication…' : 'Publier le Highlight'}
          </button>
        </form>
      ) : null}

      {loading ? (
        <p className={styles.muted}>Chargement des parcours et points d’intérêt…</p>
      ) : subTab === 'collections' ? (
        collections.length === 0 ? (
          <div className={styles.cardFlat}>
            <b>Aucune collection pour le moment</b>
            <p className={styles.muted}>
              Regroupez les plus beaux itinéraires et topo-guides du club ici.
            </p>
          </div>
        ) : (
          collections.map((col) => {
            const colRoutes = routes.filter((r) => r.collection_id === col.id);
            const totalKm = colRoutes.reduce((acc, r) => acc + Number(r.distance_km || 0), 0);
            const totalDplus = colRoutes.reduce((acc, r) => acc + Number(r.elevation_gain_m || 0), 0);
            return (
              <div key={col.id} className={`${styles.card} ${styles.stack}`}>
                <div className={styles.rowBetween}>
                  <b className={styles.cardTitle}>{col.title}</b>
                  <span className={`${styles.badge} ${styles.badgeSage}`}>
                    {col.discipline} · {col.difficulty}
                  </span>
                </div>
                {col.description ? <p className={styles.muted}>{col.description}</p> : null}
                {colRoutes.length > 0 ? (
                  <div className={styles.cardMeta}>
                    {colRoutes.length} étape(s) · {totalKm.toFixed(1)} km · +{totalDplus} m D+
                  </div>
                ) : null}
              </div>
            );
          })
        )
      ) : highlights.length === 0 ? (
        <div className={styles.cardFlat}>
          <b>Aucun Highlight enregistré</b>
          <p className={styles.muted}>
            Partagez les points d’eau, panoramas, refuges et passages techniques du club.
          </p>
        </div>
      ) : (
        highlights.map((hl) => {
          const meta = HIGHLIGHT_META[hl.category] ?? HIGHLIGHT_META.panorama;
          const voted = votedIds.has(hl.id);
          return (
            <div key={hl.id} className={`${styles.card} ${styles.stack}`}>
              <div className={styles.rowBetween}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: meta.color,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {meta.icon}
                  <span>{meta.label}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleToggleVote(hl.id)}
                  className={`${styles.button} ${styles.small} ${voted ? styles.primary : styles.ghost}`}
                >
                  <ThumbsUp size={12} aria-hidden="true" /> {hl.upvotes_count}
                </button>
              </div>
              <b className={styles.cardTitle}>{hl.title}</b>
              {hl.tip ? <p className={styles.muted}>{hl.tip}</p> : null}
            </div>
          );
        })
      )}
    </div>
  );
}
