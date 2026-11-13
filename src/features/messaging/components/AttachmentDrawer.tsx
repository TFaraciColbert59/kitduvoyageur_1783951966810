'use client';

// src/features/messaging/components/AttachmentDrawer.tsx
//
// Clic sur un partage (kit, GPX, randonnée, équipement, note vocale, fichier) :
// la pièce s'ouvre dans un drawer par-dessus la conversation. Un GPX est
// téléchargé puis dessiné sur une vraie carte ; les autres partages montrent
// leur contenu et mènent à leur fiche.

import React, { useEffect, useMemo, useState } from 'react';
import { AccountDrawerHost } from '@/design/account/AccountDrawerHost';
import { useResolvedAttachmentUrl } from '@/features/messaging/hooks/useAttachmentUrl';
import { TraceMap, type TraceGeometry } from './TraceMap';
import { TraceOverlay } from './TraceOverlay';
import type { Message, TrailMessageMeta } from '../types/messaging.types';
import { GPXEngine } from '@/features/hiking/gpx/GPXEngine';
import { toTraceGeometry } from '@/lib/geo/traceCoordinates';
import { GPX_TOO_LARGE_MESSAGE, GpxTooLargeError, readLimitedText } from '../lib/gpxFetch';
import { geometryDistanceKm, gpxStats, messageTraceStats } from '../lib/traceStats';
import { catalogLineForId, isIndicativeTrailId, parseRouteId, resolveTrailGeometry } from '../data/realTrailsData';

/** Même cadrage que l'aperçu avant envoi : pastilles en haut, attribution en bas. */
const DRAWER_TRACE_PADDING = { top: 64, right: 32, bottom: 40, left: 32 } as const;
const DRAWER_TRACE_HEIGHT = 340;

export interface AttachmentDrawerProps {
  message: Message | null;
  onClose: () => void;
}

function AttachmentGpx({ content, meta }: { content: string; meta: Record<string, unknown> | null | undefined }) {
  const url = useResolvedAttachmentUrl(content);
  const [xml, setXml] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? readLimitedText(r) : Promise.reject(new Error('http'))))
      .then((text) => {
        if (!cancelled) setXml(text);
      })
      .catch((error) => {
        if (!cancelled) setFailed(error instanceof GpxTooLargeError ? GPX_TOO_LARGE_MESSAGE : "Le fichier n'a pas pu être chargé.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const track = useMemo(() => (xml ? GPXEngine.extractTrack(xml) : null), [xml]);
  // Segments séparés : MultiLineString, jamais de droite entre deux segments.
  const geojson = useMemo<TraceGeometry | null>(
    () => (track ? toTraceGeometry(track.segments.map((segment) => segment.coordinates)) : null),
    [track],
  );
  // Mêmes chiffres que la bulle : ceux du message ; à défaut, ceux de la trace complète du fichier.
  const stats = useMemo(() => {
    const carried = messageTraceStats(meta);
    if (carried.distanceKm != null || !track) return carried;
    return gpxStats(track.segments.filter((segment) => segment.coordinates.length >= 2));
  }, [meta, track]);
  const points = track?.coordinates.length ?? 0;

  if (failed) return <p className="mattach-note">{failed}</p>;
  if (!xml) return <div className="mattach-skeleton" aria-hidden="true" />;
  if (!geojson) return <p className="mattach-note">Ce fichier ne contient pas de tracé exploitable.</p>;

  return (
    <>
      <div style={{ position: 'relative' }}>
        <TraceMap geojson={geojson} height={DRAWER_TRACE_HEIGHT} padding={DRAWER_TRACE_PADDING} />
        <TraceOverlay distanceKm={stats.distanceKm} elevationGainM={stats.elevationGainM} />
      </div>
      <div className="mattach-meta">
        <span>{points} points</span>
        <a className="mattach-link" href={url ?? '#'} download>
          Télécharger le GPX
        </a>
      </div>
    </>
  );
}

/**
 * Randonnée partagée : le tracé joint au message, sinon celui de
 * `hiking_routes` quand l'identifiant du message est une route connue, sinon
 * « Tracé indisponible » (jamais le tracé d'une autre randonnée).
 */
function AttachmentTrail({ meta }: { meta: TrailMessageMeta }) {
  // Tracé joint au message ; à défaut, le tracé schématique du catalogue pour un id exact du catalogue.
  const carried = useMemo(
    () => toTraceGeometry(meta.geojson ?? meta.coordinates) ?? catalogLineForId(meta.id),
    [meta.geojson, meta.coordinates, meta.id],
  );
  const routeId = useMemo(() => parseRouteId(meta.id), [meta.id]);
  const [resolved, setResolved] = useState<TraceGeometry | null>(null);
  const [looking, setLooking] = useState(() => !carried && routeId != null);

  useEffect(() => {
    if (carried || routeId == null) {
      setLooking(false);
      return undefined;
    }
    let cancelled = false;
    setLooking(true);
    void resolveTrailGeometry({ routeId }).then(({ geojson }) => {
      if (cancelled) return;
      setResolved(geojson);
      setLooking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [carried, routeId]);

  const line = carried ?? resolved;
  const indicative = meta.indicative === true || isIndicativeTrailId(meta.id);
  // Chiffres du message ; une distance n'est recalculée que sur une géométrie COMPLÈTE (route lue en base),
  // jamais sur le tracé simplifié joint au message.
  const carriedStats = messageTraceStats(meta as unknown as Record<string, unknown>);
  const distanceKm = carriedStats.distanceKm ?? (resolved ? geometryDistanceKm(resolved) : null);

  if (looking) return <div className="mattach-skeleton" aria-hidden="true" />;
  return (
    <div style={{ position: 'relative' }}>
      <TraceMap geojson={line} height={DRAWER_TRACE_HEIGHT} padding={DRAWER_TRACE_PADDING} />
      <TraceOverlay
        distanceKm={distanceKm}
        elevationGainM={carriedStats.elevationGainM}
        indicative={indicative && Boolean(line)}
      />
    </div>
  );
}

function AttachmentMedia({ message }: { message: Message }) {
  const url = useResolvedAttachmentUrl(message.content);
  if (message.message_type === 'audio') {
    return url ? <audio className="mattach-audio" src={url} controls /> : <div className="mattach-skeleton" aria-hidden="true" />;
  }
  if (message.message_type === 'video') {
    return url ? <video className="mattach-video" src={url} controls playsInline /> : <div className="mattach-skeleton" aria-hidden="true" />;
  }
  const name = message.content.split('/').pop() ?? 'Pièce jointe';
  return (
    <div className="mattach-file">
      <span>{name}</span>
      {url ? (
        <a className="mattach-link" href={url} target="_blank" rel="noreferrer">
          Ouvrir le fichier
        </a>
      ) : null}
    </div>
  );
}

function AttachmentSummary({ message }: { message: Message }) {
  const meta = message.metadata ?? {};
  const rows: Array<{ label: string; value: string }> = [];

  if (message.message_type === 'kit') {
    if (typeof meta.kit_name === 'string') rows.push({ label: 'Kit', value: meta.kit_name });
    if (typeof meta.items_count === 'number') rows.push({ label: 'Éléments', value: String(meta.items_count) });
  }
  if (message.message_type === 'trail') {
    // Distance et dénivelé sont déjà dans la pastille de la carte.
    if (typeof meta.region === 'string') rows.push({ label: 'Région', value: meta.region });
  }
  if (message.message_type === 'product') {
    if (typeof meta.category === 'string') rows.push({ label: 'Catégorie', value: meta.category });
    if (typeof meta.price_cents === 'number') {
      rows.push({ label: 'Prix', value: `${(meta.price_cents / 100).toFixed(2).replace('.', ',')} €` });
    }
  }

  if (rows.length === 0) return null;
  return (
    <dl className="mattach-rows">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function headingFor(message: Message): string {
  switch (message.message_type) {
    case 'gpx':
      return 'Trace GPX';
    case 'kit':
      return String(message.metadata?.kit_name || 'Kit partagé');
    case 'trail':
      return String(message.metadata?.name || 'Randonnée');
    case 'product':
      return String(message.metadata?.name || 'Équipement');
    case 'audio':
      return 'Note vocale';
    case 'video':
      return 'Vidéo';
    default:
      return 'Pièce jointe';
  }
}

export function AttachmentDrawer({ message, onClose }: AttachmentDrawerProps) {
  if (!message) {
    return (
      <AccountDrawerHost open={false} variant="card" title="" onClose={onClose}>
        <div />
      </AccountDrawerHost>
    );
  }

  const isGpx = message.message_type === 'gpx';
  const isMedia = message.message_type === 'audio' || message.message_type === 'video' || message.message_type === 'file';

  return (
    <AccountDrawerHost open variant="card" title={headingFor(message)} hideHeader onClose={onClose}>
      <div className="mattach-scroll">
        <h3 className="mattach-title">{headingFor(message)}</h3>
        {isGpx ? <AttachmentGpx content={message.content} meta={message.metadata} /> : null}
        {message.message_type === 'trail' && message.metadata ? (
          <AttachmentTrail meta={message.metadata as unknown as TrailMessageMeta} />
        ) : null}
        {isMedia ? <AttachmentMedia message={message} /> : null}
        {!isGpx && !isMedia ? <AttachmentSummary message={message} /> : null}
        {message.content && !isGpx && !isMedia && message.message_type === 'text' ? (
          <p className="mattach-note">{message.content}</p>
        ) : null}
      </div>
    </AccountDrawerHost>
  );
}
