'use client';

import React, { useMemo, useState } from 'react';
import SunCalc from 'suncalc';
import {
  AlertTriangle,
  Copy,
  MessageSquareWarning,
  Mountain,
  Phone,
  Radio,
  Satellite,
  Send,
  ShieldAlert,
  Sunset,
} from 'lucide-react';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';
import type { HudContrastVariant } from '../primitives/ExplorerNonModalSheet';

export interface NearestRefugeInfo {
  name: string;
  distanceM: number;
  elevationM?: number | null;
}

export interface GpsSafetySosSubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coords?: [number, number] | null; // [lng, lat]
  altitudeM?: number | null;
  accuracyM?: number | null;
  beaconActive?: boolean;
  beaconShareUrl?: string | null;
  onToggleBeacon?: () => void;
  onOpenTerrainReport?: () => void;
  nearestRefuge?: NearestRefugeInfo | null;
  beraSummary?: string | null;
  emergencyNumber?: string;
  contrast?: HudContrastVariant;
  glovesMode?: boolean;
}

function toDms(value: number, pos: string, neg: string): string {
  const hemi = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const mf = (abs - d) * 60;
  const m = Math.floor(mf);
  const s = ((mf - m) * 60).toFixed(1);
  return `${d}°${String(m).padStart(2, '0')}'${s}"${hemi}`;
}

function toApproxUtmZone(lat: number, lng: number): string {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const band = lat >= 0 ? 'N' : 'S';
  return `UTM ${zone}${band} · WGS84`;
}

/**
 * Lot 07 — Sous-tiroir Sécurité, BERA, Sunset offline (`suncalc`) et Fiche Urgence SOS
 * (zéro appel automatique : boutons explicites `tel://112` et `sms:114` pré-rempli).
 */
export function GpsSafetySosSubDrawer({
  open,
  onOpenChange,
  coords = null,
  altitudeM = null,
  accuracyM = null,
  beaconActive = false,
  beaconShareUrl = null,
  onToggleBeacon,
  onOpenTerrainReport,
  nearestRefuge = null,
  beraSummary = null,
  emergencyNumber = '112',
  contrast = 'standard',
  glovesMode = false,
}: GpsSafetySosSubDrawerProps) {
  const [copied, setCopied] = useState<'beacon' | 'coords' | null>(null);

  const geo = useMemo(() => {
    if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) return null;
    const [lng, lat] = coords;
    const sunTimes = SunCalc.getTimes(new Date(), lat, lng);
    const sunsetStr = Number.isFinite(sunTimes.sunset?.getTime())
      ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(
          sunTimes.sunset,
        )
      : null;
    return {
      lat,
      lng,
      wgs84: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      dms: `${toDms(lat, 'N', 'S')}  ${toDms(lng, 'E', 'W')}`,
      utm: toApproxUtmZone(lat, lng),
      sunsetStr,
    };
  }, [coords]);

  const sms114Href = useMemo(() => {
    const parts = [`URGENCE SOS (${emergencyNumber})`];
    if (geo) parts.push(`Position WGS84: ${geo.wgs84} (${geo.dms})`);
    if (altitudeM !== null && Number.isFinite(altitudeM)) parts.push(`Alt: ${Math.round(altitudeM)}m`);
    if (accuracyM !== null && Number.isFinite(accuracyM)) parts.push(`±${Math.round(accuracyM)}m`);
    if (nearestRefuge) {
      parts.push(`Refuge proche: ${nearestRefuge.name} (${Math.round(nearestRefuge.distanceM)}m)`);
    }
    return `sms:114?body=${encodeURIComponent(parts.join(' · '))}`;
  }, [emergencyNumber, geo, altitudeM, accuracyM, nearestRefuge]);

  const copyText = (text: string, which: 'beacon' | 'coords') => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Sécurité & Fiche Urgence SOS"
      subtitle="Beacon Live · Météo/Nuit offline · Secours 112 / 114"
      contrast={contrast}
      glovesMode={glovesMode}
    >
      <div className="flex flex-col gap-3">
        {/* Fiche Urgence SOS */}
        <section
          data-testid="xp20-sos-card"
          className="flex flex-col gap-2.5 rounded-2xl p-3.5"
          style={{
            background: 'var(--lkv-surface-elevated, #ffffff)',
            border: '1.5px solid var(--xp-hud-danger, #a8443a)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex items-center gap-1.5 text-[13px] font-extrabold uppercase"
              style={{ color: 'var(--xp-hud-danger, #a8443a)' }}
            >
              <ShieldAlert size={16} aria-hidden="true" />
              Fiche Urgence Terrain
            </span>
            {geo ? (
              <button
                type="button"
                onClick={() => copyText(`${geo.wgs84} (${geo.dms})`, 'coords')}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
              >
                <Copy size={12} aria-hidden="true" />
                {copied === 'coords' ? 'Copié' : 'Copier GPS'}
              </button>
            ) : null}
          </div>

          <div
            className="rounded-xl p-2.5 text-[12px] font-bold"
            style={{
              background: 'var(--lkv-surface-muted, #edf1ea)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div>WGS84 : {geo ? geo.wgs84 : 'Acquisition GPS…'}</div>
            {geo ? <div>DMS : {geo.dms}</div> : null}
            {geo ? <div>Zone : {geo.utm}</div> : null}
            <div>
              Altitude : {altitudeM !== null ? `${Math.round(altitudeM)} m` : '0 m'} · Précision :{' '}
              {accuracyM !== null ? `±${Math.round(accuracyM)} m` : '0 m'}
            </div>
            {nearestRefuge ? (
              <div className="mt-1 inline-flex items-center gap-1">
                <Mountain size={12} aria-hidden="true" />
                Refuge proche : {nearestRefuge.name} ({(nearestRefuge.distanceM / 1000).toFixed(1)}{' '}
                km)
              </div>
            ) : null}
          </div>

          {/* Boutons secours explicites (zéro appel automatique) */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel://${emergencyNumber}`}
              className="xp20-hud-btn inline-flex items-center justify-center gap-2 text-[13px] font-extrabold no-underline"
              style={{
                background: 'var(--xp-hud-danger, #a8443a)',
                color: '#ffffff',
              }}
            >
              <Phone size={15} aria-hidden="true" />
              Appeler {emergencyNumber}
            </a>
            <a
              href={sms114Href}
              className="xp20-hud-btn inline-flex items-center justify-center gap-2 text-[13px] font-extrabold no-underline"
              style={{
                background: 'var(--xp-hud-accent)',
                color: 'var(--xp-hud-accent-fg)',
              }}
            >
              <Send size={15} aria-hidden="true" />
              SMS 114 pré-rempli
            </a>
          </div>

          <p
            className="flex items-start gap-1.5 text-[11px]"
            style={{ color: 'var(--xp-hud-ink-muted)' }}
          >
            <Satellite size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Hors réseau cellulaire sur iPhone 14/15/16 : composer le 112 active automatiquement
              l’assistant Apple SOS d’urgence par satellite avec vos coordonnées ci-dessus.
            </span>
          </p>
        </section>

        {/* Beacon Live */}
        <section
          className="flex flex-col gap-2 rounded-2xl p-3"
          style={{
            background: 'var(--lkv-surface-elevated, #ffffff)',
            border: '0.5px solid var(--xp-hud-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase">
              <Radio size={14} aria-hidden="true" />
              Beacon Live (Proches)
            </span>
            {onToggleBeacon ? (
              <button
                type="button"
                onClick={onToggleBeacon}
                className="xp20-hud-btn px-3 text-[12px] font-bold"
                style={{
                  background: beaconActive
                    ? 'var(--xp-hud-danger)'
                    : 'var(--xp-hud-accent)',
                  color: '#ffffff',
                }}
              >
                {beaconActive ? 'Couper Beacon' : 'Activer Beacon'}
              </button>
            ) : null}
          </div>
          {beaconShareUrl ? (
            <button
              type="button"
              onClick={() => copyText(beaconShareUrl, 'beacon')}
              className="xp20-hud-btn flex w-full items-center justify-between px-3 text-[12px] font-semibold"
              style={{ background: 'var(--lkv-surface-muted, #edf1ea)' }}
            >
              <span className="truncate">{beaconShareUrl}</span>
              <span className="ml-2 shrink-0 font-bold">
                {copied === 'beacon' ? 'Copié' : 'Copier'}
              </span>
            </button>
          ) : null}
        </section>

        {/* Lumière / BERA / Signalement */}
        <section
          className="flex flex-col gap-2 rounded-2xl p-3"
          style={{
            background: 'var(--lkv-surface-elevated, #ffffff)',
            border: '0.5px solid var(--xp-hud-border)',
          }}
        >
          <div className="flex items-center justify-between text-[12.5px] font-bold">
            <span className="inline-flex items-center gap-1.5">
              <Sunset size={14} aria-hidden="true" />
              Coucher du soleil (calcul offline)
            </span>
            <span>{geo?.sunsetStr ?? '—'}</span>
          </div>
          {beraSummary ? (
            <div className="flex items-center gap-1.5 text-[12px] font-semibold">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>{beraSummary}</span>
            </div>
          ) : null}
          {onOpenTerrainReport ? (
            <button
              type="button"
              onClick={onOpenTerrainReport}
              className="xp20-hud-btn flex w-full items-center justify-center gap-2 text-[13px] font-bold"
              style={{
                background: 'var(--lkv-surface-muted, #edf1ea)',
                color: 'var(--xp-hud-ink)',
              }}
            >
              <MessageSquareWarning size={15} aria-hidden="true" />
              <span>Signaler un danger terrain</span>
            </button>
          ) : null}
        </section>
      </div>
    </ExplorerNestedSubDrawer>
  );
}
