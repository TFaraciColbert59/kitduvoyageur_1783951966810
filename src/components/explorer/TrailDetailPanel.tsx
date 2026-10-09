'use client';

import Icon from '@/components/ui/Icon';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TrendingUpIcon as TrendingUp } from '@/components/icons/trending-up';
import { CompassIcon as Compass } from '@/components/icons/compass';
import { MountainIcon as Mountain } from '@/components/icons/mountain';
import { Share2Icon as Share2 } from '@/components/icons/share-2';
import { DownloadIcon as Download } from '@/components/icons/download';
import { ClockIcon as Clock } from '@/components/icons/clock';
import type { MapTrail } from './types';
import { useOfflineDownload } from '@/hooks/useOfflineDownload';
import { listOfflineRoutes } from '@/lib/offlineStorage';
import { Badge, Button, Card, IconButton, Sheet } from '@/components/ui';
import { buildTrailAiFallback } from '@/lib/ai/features/trailAiEnrichment';
import type { ElevationProfilePoint, TrailAiEnrichment } from '@/features/explorer-osm/domain/types';
import {
  getTrailImage,
  getDifficultyColor,
  getDifficultyLabel,
  formatDistance,
  formatDuration,
  estimateHikingDurationHours,
} from './types';

interface Props {
  trail: MapTrail;
  onClose: () => void;
  /** Permet l'animation de sortie Radix avant démontage. */
  open?: boolean;
}

const SCORE_LABELS: { key: keyof MapTrail; label: string; icon: string }[] = [
  { key: 'adventure_score', label: 'Aventure', icon: '⛰️' },
  { key: 'nature_score', label: 'Immersion Nature', icon: '🌿' },
  { key: 'panorama_score', label: 'Points de vue', icon: '🔭' },
];

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="glass-progress w-full">
      <div
        className="glass-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card variant="compact" className="flex flex-col items-center justify-center gap-0.5 text-center">
      <div className="text-[color:var(--lkv-text-primary)]">{icon}</div>
      <span className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
        {label}
      </span>
      <span className="font-mono text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
        {value}
      </span>
    </Card>
  );
}

function ElevationProfileChart({
  profile,
  minElevation,
  maxElevation,
}: {
  profile: ElevationProfilePoint[];
  minElevation?: number | null;
  maxElevation?: number | null;
}) {
  if (!profile || profile.length < 2) return null;

  const minAlt = minElevation ?? Math.min(...profile.map((p) => p.elevationM));
  const maxAlt = maxElevation ?? Math.max(...profile.map((p) => p.elevationM));
  const range = Math.max(1, maxAlt - minAlt);
  const maxDist = profile[profile.length - 1].distanceKm || 1;

  const width = 320;
  const height = 65;
  const padY = 8;
  const innerH = height - padY * 2;

  const points = profile.map((p) => {
    const x = Math.min(width, Math.max(0, (p.distanceKm / maxDist) * width));
    const y = padY + innerH - ((p.elevationM - minAlt) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

  return (
    <div className="flex flex-col gap-1 w-full mt-1">
      <div className="relative w-full h-[65px] overflow-hidden rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-subtle)] border border-[color:var(--glass-border-subtle)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lkv-accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--lkv-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaD} fill="url(#elevGrad)" />
          <path
            d={pathD}
            fill="none"
            stroke="var(--lkv-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex items-center justify-between text-[length:var(--lkv-text-caption-2)] font-mono text-[color:var(--lkv-text-muted)] px-0.5">
        <span>0 km · {minAlt} m</span>
        <span>{maxDist.toFixed(1)} km · {maxAlt} m</span>
      </div>
    </div>
  );
}

/**
 * TrailDetailPanel — fiche détail d'un sentier, en feuille canonique
 * (poignée, scroll interne, safe-area, fermeture par glissement).
 */
export default function TrailDetailPanel({ trail, onClose, open = true }: Props) {
  const router = useRouter();
  const imgUrl = trail.image_url || getTrailImage(trail.id, trail.name);
  const diffColor = getDifficultyColor(trail.difficulty);
  const diffLabel = getDifficultyLabel(trail.difficulty);

  const [description, setDescription] = useState<string | null>(trail.description || trail.ai_description || null);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState<boolean>(false);
  const offline = useOfflineDownload();

  const [checkedGear, setCheckedGear] = useState<Set<number>>(new Set());
  const toggleGear = useCallback((index: number) => {
    setCheckedGear((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  useEffect(() => {
    setCheckedGear(new Set());
  }, [trail.id]);

  const aiEnrichment: TrailAiEnrichment = useMemo(() => {
    if (trail.ai_enrichment) return trail.ai_enrichment;
    return buildTrailAiFallback({
      name: trail.name,
      ref: trail.ref,
      network: trail.network,
      distanceKm: trail.distance_km,
      elevationGainM: trail.elevation_gain,
      minElevationM: trail.min_elevation,
      maxElevationM: trail.max_elevation,
      difficulty: trail.difficulty,
      roundtrip: trail.roundtrip,
      surface: trail.surface,
      trailVisibility: trail.trail_visibility,
      dogFriendly: trail.dog_friendly,
      from: trail.from,
      to: trail.to,
      description: trail.description,
    });
  }, [trail]);

  useEffect(() => {
    setDescription(trail.description || trail.ai_description || null);
  }, [trail.description, trail.ai_description]);

  const effectiveDuration =
    trail.duration_hours ||
    estimateHikingDurationHours(trail.distance_km, trail.elevation_gain);

  // Check offline status
  useEffect(() => {
    listOfflineRoutes()
      .then((routes) => {
        setIsOfflineAvailable(routes.some((r) => r.routeId === String(trail.id)));
      })
      .catch(() => {});
  }, [trail.id]);

  const handleOfflineToggle = useCallback(async () => {
    if (isOfflineAvailable) {
      await offline.deleteOffline(String(trail.id));
      setIsOfflineAvailable(false);
      offline.reset();
    } else {
      await offline.downloadForOffline(trail);
      setIsOfflineAvailable(true);
    }
  }, [isOfflineAvailable, offline, trail]);

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: trail.name,
          text: `Découvre ce sentier de randonnée sur Le Kit du Voyageur : ${trail.name}`,
          url: window.location.href,
        })
        .catch(() => {});
    }
  };

  const [isMaterializing, setIsMaterializing] = useState(false);
  const isOsm = String(trail.id).startsWith('osm:relation:') || (trail as any).source === 'openstreetmap';
  const rawGeomStatus = (trail as any).geometryStatus;
  const hasGeom = Boolean((trail as any).geom || (trail as any).geojson);
  const isUnavailableGeometry =
    rawGeomStatus === 'unavailable' ||
    (!hasGeom && !isOsm) ||
    (!hasGeom && (trail as any).detail !== undefined);
  const isPartialGeometry = rawGeomStatus === 'partial';

  const getCanonicalId = useCallback(async (): Promise<string | number | null> => {
    if (!String(trail.id).startsWith('osm:relation:')) {
      return trail.id;
    }
    const osmRelationId = parseInt(String(trail.id).replace('osm:relation:', ''), 10);
    setIsMaterializing(true);
    try {
      const res = await fetch('/api/explorer/osm/materialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          osmRelationId,
        }),
      });
      if (res.status === 401) {
        // Préparer ou démarrer un sentier se fait connecté : on revient ici après.
        router.push(`/connexion?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return null;
      }
      if (!res.ok) throw new Error('Échec de la matérialisation');
      const data = await res.json();
      return data.canonicalId;
    } catch (err) {
      console.error('Erreur matérialisation:', err);
      return null;
    } finally {
      setIsMaterializing(false);
    }
  }, [trail, router]);

  const handlePrepare = async () => {
    const canonicalId = await getCanonicalId();
    if (canonicalId) {
      router.push(`/preparer-sentier/${canonicalId}`);
    }
  };

  const handleStart = async () => {
    if (isUnavailableGeometry) return;
    const canonicalId = await getCanonicalId();
    if (canonicalId) {
      router.push(`/randonnee-active?routeId=${canonicalId}`);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={trail.name}
      hideTitle
      detent="large"
      dragToDismiss
      footer={
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Button
            variant="secondary"
            className="h-12 flex-1"
            disabled={isMaterializing}
            onClick={handlePrepare}
          >
            <span>{isMaterializing ? 'Préparation LKDV…' : 'Préparer le matériel'}</span>
          </Button>

          <Button
            variant="primary"
            className="h-12 flex-1"
            disabled={isMaterializing || isUnavailableGeometry}
            onClick={handleStart}
            title={isUnavailableGeometry ? 'Tracé GPS non disponible pour la navigation' : 'Commencer tout de suite'}
          >
            <span>
              {isUnavailableGeometry
                ? 'Tracé non disponible'
                : isMaterializing
                ? 'Initialisation…'
                : 'Commencer tout de suite'}
            </span>
          </Button>
        </div>
      }
    >
      <div className="-mx-[var(--space-5)] -mt-[var(--space-1)] flex flex-col gap-3.5">
        {/* Header Hero Image */}
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-[color:var(--glass-bg-medium)] sm:h-56">
          <img src={imgUrl} alt={trail.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

          <div className="absolute left-3.5 right-3.5 top-3.5 z-10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Badge className="border-transparent text-white" style={{ backgroundColor: diffColor }}>
                {diffLabel}
              </Badge>
              {isUnavailableGeometry && (
                <Badge tone="warn" className="backdrop-blur-sm text-[length:var(--lkv-text-caption-2)]">
                  Tracé indisponible
                </Badge>
              )}
              {!isUnavailableGeometry && isOsm && (
                <>
                  <Badge tone="stone" className="border-white/30 bg-black/40 text-white backdrop-blur-sm text-[length:var(--lkv-text-caption-2)]">
                    OSM · ODbL
                  </Badge>
                  <Badge
                    tone={isPartialGeometry ? 'warn' : 'sage'}
                    className="backdrop-blur-sm text-[length:var(--lkv-text-caption-2)]"
                  >
                    {isPartialGeometry ? 'Tracé partiel' : 'Tracé complet'}
                  </Badge>
                </>
              )}
            </div>

            <IconButton
              variant="glass"
              size="sm"
              onClick={handleShare}
              aria-label="Partager le sentier"
              title="Partager"
            >
              <Share2 size={15} />
            </IconButton>
          </div>

          <div className="absolute bottom-3 left-3.5 right-3.5">
            <Card className="rounded-[var(--lkv-radius-md)] px-3.5 py-2.5 shadow-xs">
              <p className="mb-0.5 flex items-center gap-1 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-secondary)]">
                <Icon name="map-pin" size={11} className="text-[color:var(--lkv-text-primary)]" />
                <span>{trail.network || trail.terrain_type || 'Massif Alpin'}</span>
              </p>
              <h2 className="font-display text-[length:var(--lkv-text-title-sm)] font-bold leading-tight text-[color:var(--lkv-text-primary)] line-clamp-2">
                {trail.name}
              </h2>
            </Card>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex flex-col gap-3.5 px-[var(--space-5)]">
          {/* Key Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill
              icon={<TrendingUp size={16} />}
              label="Distance"
              value={formatDistance(trail.distance_km)}
            />
            <StatPill
              icon={<Mountain size={16} />}
              label="Dénivelé +"
              value={
                trail.elevation_gain !== null && trail.elevation_gain !== undefined
                  ? `+${Math.round(trail.elevation_gain)} m`
                  : 'Non renseigné'
              }
            />
            <StatPill
              icon={<Clock size={16} />}
              label="Durée estimée"
              value={formatDuration(effectiveDuration)}
            />
          </div>

          {/* Topographie & Profil Altimétrique */}
          {(trail.min_elevation != null || trail.max_elevation != null || (trail.elevation_profile && trail.elevation_profile.length > 1)) && (
            <Card variant="compact" className="flex flex-col gap-2.5 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                  <Icon name="mountain" size={13} className="text-[color:var(--lkv-text-primary)]" />
                  <span>Topographie & Profil altimétrique</span>
                </div>
                {(trail.avg_slope != null || trail.max_slope != null) && (
                  <Badge tone="stone" className="text-[length:var(--lkv-text-caption-2)] font-mono">
                    {trail.avg_slope != null ? `Pente moy. ${trail.avg_slope}%` : ''}
                    {trail.max_slope != null ? ` · Max ${trail.max_slope}%` : ''}
                  </Badge>
                )}
              </div>

              {trail.elevation_profile && trail.elevation_profile.length > 1 && (
                <ElevationProfileChart
                  profile={trail.elevation_profile}
                  minElevation={trail.min_elevation}
                  maxElevation={trail.max_elevation}
                />
              )}

              <div className="grid grid-cols-2 gap-2 text-[length:var(--lkv-text-caption)]">
                {trail.min_elevation != null && (
                  <div className="flex flex-col">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Altitude min</span>
                    <span className="font-semibold font-mono text-[color:var(--lkv-text-primary)]">
                      {trail.min_elevation} m
                    </span>
                  </div>
                )}
                {trail.max_elevation != null && (
                  <div className="flex flex-col">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Point culminant</span>
                    <span className="font-semibold font-mono text-[color:var(--lkv-text-primary)]">
                      {trail.max_elevation} m
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Terrain & Praticabilité */}
          {(trail.surface || trail.trail_visibility || trail.dog_friendly) && (
            <Card variant="compact" className="flex flex-col gap-2 p-3.5">
              <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                <Compass size={13} className="text-[color:var(--lkv-text-primary)]" />
                <span>Terrain & Praticabilité</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[length:var(--lkv-text-caption)]">
                {trail.surface && (
                  <div className="flex flex-col">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Surface</span>
                    <span className="font-semibold capitalize text-[color:var(--lkv-text-primary)] truncate" title={trail.surface}>{trail.surface}</span>
                  </div>
                )}
                {trail.trail_visibility && (
                  <div className="flex flex-col">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Balisage</span>
                    <span className="font-semibold capitalize text-[color:var(--lkv-text-primary)] truncate" title={trail.trail_visibility}>{trail.trail_visibility}</span>
                  </div>
                )}
                {trail.dog_friendly && (
                  <div className="flex flex-col">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Chiens</span>
                    <span className="font-semibold capitalize text-[color:var(--lkv-text-primary)] truncate">
                      {trail.dog_friendly === 'yes' ? 'Autorisés' : trail.dog_friendly === 'leashed' ? 'En laisse' : trail.dog_friendly === 'no' ? 'Interdits' : trail.dog_friendly}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Adventure Intelligence (LKDV IA) */}
          {aiEnrichment && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-0.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <Icon name="sparkles" size={14} className="text-[color:var(--lkv-accent)]" />
                  <span className="text-[length:var(--lkv-text-caption-2)] font-bold tracking-wider uppercase text-[color:var(--lkv-accent)]">
                    Adventure Intelligence
                  </span>
                </div>
                <Badge tone="sage" className="text-[length:var(--lkv-text-caption-2)] font-mono">
                  LKDV IA · {aiEnrichment.confidence}%
                </Badge>
              </div>

              {/* Storyline / Récit immersif */}
              <Card variant="compact" className="flex flex-col gap-2 p-3.5 border-l-2 border-l-[color:var(--lkv-accent)]">
                <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                  <Compass size={13} className="text-[color:var(--lkv-text-primary)]" />
                  <span>Ce qui vous attend</span>
                </div>
                <p className="text-[length:var(--lkv-text-body-sm)] font-normal leading-relaxed text-[color:var(--lkv-text-primary)]">
                  {aiEnrichment.storyline}
                </p>
              </Card>

              {/* Période idéale & Météo */}
              {aiEnrichment.idealSeason && (
                <Card variant="compact" className="flex flex-col gap-2 p-3.5">
                  <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                    <Icon name="calendar" size={13} className="text-[color:var(--lkv-text-primary)]" />
                    <span>Saisonnalité & Période idéale</span>
                  </div>
                  {aiEnrichment.idealSeason.bestMonths && aiEnrichment.idealSeason.bestMonths.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 py-0.5">
                      {aiEnrichment.idealSeason.bestMonths.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 rounded-full text-[length:var(--lkv-text-caption-2)] font-semibold bg-[color:var(--btn-tint)] text-[color:var(--lkv-accent)] border border-[color:var(--btn-glass-border)]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  {aiEnrichment.idealSeason.advice && (
                    <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)] leading-relaxed">
                      {aiEnrichment.idealSeason.advice}
                    </p>
                  )}
                </Card>
              )}

              {/* Points de vigilance & Sécurité */}
              {aiEnrichment.safetyTips && aiEnrichment.safetyTips.length > 0 && (
                <Card variant="compact" className="flex flex-col gap-2.5 p-3.5 border-l-2 border-l-[color:var(--lkv-warning)]">
                  <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-warning)]">
                    <Icon name="shield" size={13} className="text-[color:var(--lkv-warning)]" />
                    <span>Points de vigilance & Sécurité</span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {aiEnrichment.safetyTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)] leading-snug">
                        <span className="shrink-0 mt-0.5 text-[color:var(--lkv-warning)] font-bold">⚠️</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Équipement recommandé (Checklist interactive) */}
              {aiEnrichment.gearChecklist && aiEnrichment.gearChecklist.length > 0 && (
                <Card variant="compact" className="flex flex-col gap-2.5 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                      <Icon name="check" size={13} className="text-[color:var(--lkv-text-primary)]" />
                      <span>Équipement recommandé</span>
                    </div>
                    <span className="text-[length:var(--lkv-text-caption-2)] font-mono text-[color:var(--lkv-text-muted)]">
                      {checkedGear.size}/{aiEnrichment.gearChecklist.length} emporté{checkedGear.size > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {aiEnrichment.gearChecklist.map((item, idx) => {
                      const isChecked = checkedGear.has(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleGear(idx)}
                          className={`flex items-center gap-2.5 p-2 rounded-[var(--lkv-radius-sm)] text-left transition-colors min-h-[44px] ${
                            isChecked
                              ? 'bg-[color:var(--btn-tint)] text-[color:var(--lkv-text-muted)] line-through'
                              : 'bg-[color:var(--glass-bg-subtle)] text-[color:var(--lkv-text-primary)] hover:bg-[color:var(--glass-bg-medium)]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border transition-colors ${
                              isChecked
                                ? 'bg-[color:var(--lkv-accent)] border-[color:var(--lkv-accent)] text-white'
                                : 'border-[color:var(--glass-border-medium)]'
                            }`}
                          >
                            {isChecked && <Icon name="check" size={12} className="text-white" />}
                          </div>
                          <span className="text-[length:var(--lkv-text-caption)] leading-tight">{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Profil d'effort & Rythme */}
              {aiEnrichment.effortPacing && (
                <Card variant="compact" className="flex flex-col gap-2 p-3.5">
                  <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                    <Clock size={13} className="text-[color:var(--lkv-text-primary)]" />
                    <span>Gestion de l'effort & Rythme</span>
                  </div>
                  <div className="flex flex-col gap-2 text-[length:var(--lkv-text-caption)]">
                    {aiEnrichment.effortPacing.paceAdvice && (
                      <div className="flex items-start gap-2 text-[color:var(--lkv-text-secondary)]">
                        <span className="font-semibold text-[color:var(--lkv-text-primary)] shrink-0">Cadence :</span>
                        <span>{aiEnrichment.effortPacing.paceAdvice}</span>
                      </div>
                    )}
                    {aiEnrichment.effortPacing.breakAdvice && (
                      <div className="flex items-start gap-2 text-[color:var(--lkv-text-secondary)]">
                        <span className="font-semibold text-[color:var(--lkv-text-primary)] shrink-0">Pauses :</span>
                        <span>{aiEnrichment.effortPacing.breakAdvice}</span>
                      </div>
                    )}
                    {aiEnrichment.effortPacing.recommendedStartTime && (
                      <div className="flex items-start gap-2 text-[color:var(--lkv-text-secondary)]">
                        <span className="font-semibold text-[color:var(--lkv-text-primary)] shrink-0">Départ conseillé :</span>
                        <span className="text-[color:var(--lkv-accent)] font-semibold">{aiEnrichment.effortPacing.recommendedStartTime}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Faune, Flore & Biodiversité */}
              {aiEnrichment.biodiversity && (
                <Card variant="compact" className="flex flex-col gap-2 p-3.5">
                  <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                    <span>🌿</span>
                    <span>Faune, Flore & Écosystème</span>
                  </div>
                  <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)] leading-relaxed">
                    {aiEnrichment.biodiversity}
                  </p>
                </Card>
              )}
            </div>
          )}

          {/* Scores Breakdown */}
          <Card variant="compact" className="flex flex-col gap-2.5 p-3.5">
            <h3 className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              Indicateurs d'expérience
            </h3>
            {SCORE_LABELS.map(({ key, label, icon }) => {
              const val = typeof trail[key] === 'number' ? (trail[key] as number) : 75;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true">{icon}</span>
                      <span className="text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider">
                        {label}
                      </span>
                    </span>
                    <span className="font-mono text-[color:var(--lkv-text-primary)]">{Math.round(val)}/100</span>
                  </div>
                  <ScoreBar value={val} />
                </div>
              );
            })}
          </Card>

          {/* Guide & Description source */}
          <Card variant="compact" className="flex flex-col gap-2 p-3.5">
            <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
              <Icon name="info" size={13} className="text-[color:var(--lkv-text-primary)]" />
              <span>Description & Contexte</span>
            </div>
            <p className="text-[length:var(--lkv-text-body-sm)] font-normal leading-relaxed text-[color:var(--lkv-text-secondary)]">
              {description ||
                `Cet itinéraire de ${formatDistance(trail.distance_km)} offre une immersion complète au cœur de panoramas remarquables. Idéal pour les randonneurs en quête d'air pur et de sentiers balisés.`}
            </p>
          </Card>

          {/* Caractéristiques du parcours */}
          {(trail.roundtrip != null || trail.operator || trail.from || trail.to || trail.ref) && (
            <Card variant="compact" className="flex flex-col gap-2.5 p-3.5">
              <div className="flex items-center gap-1.5 text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
                <Icon name="info" size={13} className="text-[color:var(--lkv-text-primary)]" />
                <span>Caractéristiques du parcours</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[length:var(--lkv-text-caption)]">
                {trail.roundtrip != null && (
                  <div className="flex flex-col">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Type de tracé</span>
                    <span className="font-semibold text-[color:var(--lkv-text-primary)]">
                      {trail.roundtrip ? '🔄 Boucle' : '➡️ Aller simple'}
                    </span>
                  </div>
                )}
                {trail.ref && (
                  <div className="flex flex-col">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Référence</span>
                    <span className="font-semibold text-[color:var(--lkv-text-primary)] font-mono">{trail.ref}</span>
                  </div>
                )}
                {trail.from && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Départ</span>
                    <span className="font-semibold text-[color:var(--lkv-text-primary)]">{trail.from}</span>
                  </div>
                )}
                {trail.to && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Arrivée</span>
                    <span className="font-semibold text-[color:var(--lkv-text-primary)]">{trail.to}</span>
                  </div>
                )}
                {trail.operator && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Gestionnaire</span>
                    <span className="font-semibold text-[color:var(--lkv-text-primary)]">{trail.operator}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Offline Storage Card */}
          <Card variant="compact" className="flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
                {isOfflineAvailable ? <Icon name="check" size={16} /> : <Download size={16} />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-text-primary)]">
                  {isOfflineAvailable ? 'Disponible hors-ligne' : 'Mode hors-ligne'}
                </p>
                <p className="truncate text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
                  {isOfflineAvailable
                    ? 'Tracé GPS gardé sur l’appareil (fond de carte en ligne)'
                    : 'Garder le tracé GPS sur l’appareil'}
                </p>
              </div>
            </div>

            <Button variant="secondary" size="sm" onClick={handleOfflineToggle} className="shrink-0">
              {isOfflineAvailable ? 'Supprimer' : 'Télécharger'}
            </Button>
          </Card>
        </div>
      </div>
    </Sheet>
  );
}
