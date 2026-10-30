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
import { TraceMap, type TraceLineString } from './TraceMap';
import type { Message } from '../types/messaging.types';

export interface AttachmentDrawerProps {
  message: Message | null;
  onClose: () => void;
}

/** Extrait les points lat/lon d'un fichier GPX (trkpt ou rtept). */
export function parseGpxPoints(xml: string): [number, number][] {
  const points: [number, number][] = [];
  const re = /<(?:trkpt|rtept|wpt)\b[^>]*\blat="(-?\d+(?:\.\d+)?)"[^>]*\blon="(-?\d+(?:\.\d+)?)"/g;
  let match = re.exec(xml);
  while (match) {
    const lat = Number.parseFloat(match[1]);
    const lon = Number.parseFloat(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lon, lat]);
    match = re.exec(xml);
  }
  return points;
}

function AttachmentGpx({ content }: { content: string }) {
  const url = useResolvedAttachmentUrl(content);
  const [xml, setXml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('http'))))
      .then((text) => {
        if (!cancelled) setXml(text);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const geojson = useMemo<TraceLineString | null>(() => {
    if (!xml) return null;
    const coords = parseGpxPoints(xml);
    return coords.length > 1 ? { type: 'LineString', coordinates: coords } : null;
  }, [xml]);

  const points = geojson?.coordinates.length ?? 0;

  if (failed) return <p className="mattach-note">Le fichier n'a pas pu être chargé.</p>;
  if (!xml) return <div className="mattach-skeleton" aria-hidden="true" />;
  if (!geojson) return <p className="mattach-note">Ce fichier ne contient pas de tracé exploitable.</p>;

  return (
    <>
      <TraceMap geojson={geojson} height={280} />
      <div className="mattach-meta">
        <span>{points} points</span>
        <a className="mattach-link" href={url ?? '#'} download>
          Télécharger le GPX
        </a>
      </div>
    </>
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
    if (typeof meta.distance_km === 'number') rows.push({ label: 'Distance', value: `${meta.distance_km.toFixed(1)} km` });
    if (typeof meta.elevation_gain_m === 'number') rows.push({ label: 'Dénivelé', value: `+${Math.round(meta.elevation_gain_m)} m` });
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
        {isGpx ? <AttachmentGpx content={message.content} /> : null}
        {isMedia ? <AttachmentMedia message={message} /> : null}
        {!isGpx && !isMedia ? <AttachmentSummary message={message} /> : null}
        {message.content && !isGpx && !isMedia && message.message_type === 'text' ? (
          <p className="mattach-note">{message.content}</p>
        ) : null}
      </div>
    </AccountDrawerHost>
  );
}
