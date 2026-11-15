'use client';

import React, { useEffect, useState } from 'react';
import {
  Crosshair,
  Eye,
  EyeOff,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import { OverlaySheet } from '@/components/compte/overlay/OverlaySheet';
import { fetchJson } from '../shared/fetch';

export interface PrivacyZoneItem {
  id: string;
  label: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  isActive: boolean;
  updatedAt: string;
}

const PRESET_LABELS = ['Domicile', 'Travail', 'Départ habituel', 'Refuge proche'];

export function PrivacyZonesSheet({ onClose }: { onClose: () => void }) {
  const [zones, setZones] = useState<PrivacyZoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [label, setLabel] = useState('Domicile');
  const [latStr, setLatStr] = useState('45.8992');
  const [lngStr, setLngStr] = useState('6.1294');
  const [radiusM, setRadiusM] = useState(500);
  const [locating, setLocating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<{ zones: PrivacyZoneItem[] }>(
        '/api/compte/privacy-zones'
      );
      setZones(payload.zones ?? []);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Impossible de charger tes zones privées.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const captureGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Géolocalisation indisponible sur cet appareil.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatStr(pos.coords.latitude.toFixed(5));
        setLngStr(pos.coords.longitude.toFixed(5));
        setLocating(false);
        setNotice('Position capturée (visible uniquement pour toi).');
      },
      () => {
        setLocating(false);
        setError('Position refusée ou indisponible.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const centerLat = Number(latStr.replace(',', '.'));
    const centerLng = Number(lngStr.replace(',', '.'));
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      setError('Saisis des coordonnées valides.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await fetchJson<{ zone: PrivacyZoneItem }>(
        '/api/compte/privacy-zones',
        {
          method: 'POST',
          body: JSON.stringify({
            label: label.trim() || 'Zone privée',
            centerLat,
            centerLng,
            radiusM,
            isActive: true,
          }),
        }
      );
      setZones((current) => [...current, payload.zone]);
      setNotice(
        `Zone « ${payload.zone.label} » enregistrée (${payload.zone.radiusM} m). Masquage appliqué rétroactivement à tes sorties et segments publics.`
      );
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Impossible d’enregistrer cette zone.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (zone: PrivacyZoneItem) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await fetchJson<{ zone: PrivacyZoneItem }>(
        `/api/compte/privacy-zones/${encodeURIComponent(zone.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !zone.isActive }),
        }
      );
      setZones((current) =>
        current.map((item) => (item.id === zone.id ? payload.zone : item))
      );
      setNotice(
        payload.zone.isActive
          ? `Zone « ${payload.zone.label} » activée.`
          : `Zone « ${payload.zone.label} » suspendue.`
      );
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Modification impossible.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRadiusStep = async (zone: PrivacyZoneItem, nextRadiusM: number) => {
    if (busy) return;
    const clamped = Math.max(200, Math.min(5000, nextRadiusM));
    setBusy(true);
    setError(null);
    try {
      const payload = await fetchJson<{ zone: PrivacyZoneItem }>(
        `/api/compte/privacy-zones/${encodeURIComponent(zone.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ radiusM: clamped }),
        }
      );
      setZones((current) =>
        current.map((item) => (item.id === zone.id ? payload.zone : item))
      );
      setNotice(`Rayon ajusté à ${payload.zone.radiusM} m.`);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Impossible d’ajuster le rayon.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (zone: PrivacyZoneItem) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fetchJson<{ status: string }>(
        `/api/compte/privacy-zones/${encodeURIComponent(zone.id)}`,
        { method: 'DELETE' }
      );
      setZones((current) => current.filter((item) => item.id !== zone.id));
      setNotice(`Zone « ${zone.label} » supprimée.`);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Suppression impossible.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlaySheet
      title="Zones privées"
      subtitle="Domicile, travail et départs habituels masqués côté serveur"
      onClose={onClose}
      nested
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2.5 rounded-[var(--lkv-radius-md)] bg-[color:var(--card-tint-strong)] px-3 py-2.5">
          <ShieldCheck
            size={18}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[color:var(--lkv-primary)]"
          />
          <p className="m-0 text-[12px] leading-snug text-[color:var(--label2)]">
            Tout point de tracé dans un cercle actif (rayon 200 m à 5 km) est
            coupé côté serveur pour les tiers, exports GPX, heatmaps et segments
            publics, sans jamais exposer le centre de ta zone.
          </p>
        </div>

        {notice ? (
          <p
            role="status"
            className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-primary)]/10 px-3 py-2 text-[12px] text-[color:var(--label)]"
          >
            {notice}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--lkv-danger-bg)] px-3 py-2 text-[12px] text-[color:var(--lkv-danger)]"
          >
            {error}
          </p>
        ) : null}

        <section aria-label="Zones enregistrées" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <b className="text-[12.5px] text-[color:var(--label)]">
              Mes zones ({zones.length}/10)
            </b>
            {loading ? (
              <span className="text-[11px] text-[color:var(--label3)]">
                Chargement…
              </span>
            ) : null}
          </div>

          {!loading && zones.length === 0 ? (
            <p className="m-0 rounded-[var(--lkv-radius-sm)] bg-[color:var(--card-tint-strong)] px-3 py-2.5 text-[12px] text-[color:var(--label2)]">
              Aucune zone privée configurée. Ajoute ton domicile ou ton lieu de
              travail ci-dessous.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {zones.map((zone) => (
                <li
                  key={zone.id}
                  className="flex flex-col gap-2 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <MapPin
                        size={15}
                        aria-hidden="true"
                        className="shrink-0 text-[color:var(--lkv-primary)]"
                      />
                      <div className="min-w-0">
                        <b className="block truncate text-[13px] text-[color:var(--label)]">
                          {zone.label}
                        </b>
                        <small className="block text-[11px] text-[color:var(--label2)]">
                          Rayon {zone.radiusM} m ·{' '}
                          {zone.isActive ? 'Masquage actif' : 'Suspendue'}
                        </small>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleToggle(zone)}
                        disabled={busy}
                        aria-label={
                          zone.isActive
                            ? `Suspendre ${zone.label}`
                            : `Activer ${zone.label}`
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-white/75 px-2.5 text-[11px] font-semibold text-[color:var(--label)]"
                      >
                        {zone.isActive ? (
                          <>
                            <EyeOff size={13} aria-hidden="true" /> Active
                          </>
                        ) : (
                          <>
                            <Eye size={13} aria-hidden="true" /> Inactive
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(zone)}
                        disabled={busy}
                        aria-label={`Supprimer ${zone.label}`}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white/75 text-[color:var(--lkv-danger)]"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[color:var(--label2)]">
                      Rayon :
                    </span>
                    {[250, 500, 1000, 2000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRadiusStep(zone, preset)}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          zone.radiusM === preset
                            ? 'bg-[color:var(--lkv-primary)] text-white'
                            : 'bg-white/70 text-[color:var(--label2)]'
                        }`}
                      >
                        {preset >= 1000 ? `${preset / 1000} km` : `${preset} m`}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form
          onSubmit={(event) => void handleCreate(event)}
          className="flex flex-col gap-2.5 rounded-[var(--lkv-radius-md)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-3"
        >
          <b className="text-[13px] text-[color:var(--label)]">
            Ajouter une zone privée
          </b>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_LABELS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLabel(preset)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  label === preset
                    ? 'bg-[color:var(--lkv-primary)] text-white'
                    : 'bg-white/75 text-[color:var(--label2)]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1 text-[11.5px] text-[color:var(--label2)]">
            <span>Nom de la zone</span>
            <input
              type="text"
              value={label}
              maxLength={60}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex. Domicile"
              className="h-9 rounded-[10px] border border-[color:var(--glass-border)] bg-white/80 px-2.5 text-[13px] text-[color:var(--label)]"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11.5px] text-[color:var(--label2)]">
              <span>Latitude</span>
              <input
                type="text"
                value={latStr}
                onChange={(event) => setLatStr(event.target.value)}
                className="h-9 rounded-[10px] border border-[color:var(--glass-border)] bg-white/80 px-2.5 text-[12.5px] text-[color:var(--label)]"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] text-[color:var(--label2)]">
              <span>Longitude</span>
              <input
                type="text"
                value={lngStr}
                onChange={(event) => setLngStr(event.target.value)}
                className="h-9 rounded-[10px] border border-[color:var(--glass-border)] bg-white/80 px-2.5 text-[12.5px] text-[color:var(--label)]"
                required
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-2">
            <ActionPill
              label="Utiliser ma position actuelle"
              icon={<Crosshair />}
              text={locating ? 'Localisation…' : 'Ma position'}
              onClick={captureGps}
              disabled={locating || busy}
            />
            <span className="text-[11.5px] font-semibold text-[color:var(--label)]">
              Rayon : {radiusM >= 1000 ? `${(radiusM / 1000).toFixed(1)} km` : `${radiusM} m`}
            </span>
          </div>

          <label className="flex flex-col gap-1 text-[11.5px] text-[color:var(--label2)]">
            <span>Rayon de masquage (200 m à 5 000 m)</span>
            <input
              type="range"
              min={200}
              max={5000}
              step={100}
              value={radiusM}
              onChange={(event) => setRadiusM(Number(event.target.value))}
            />
          </label>

          <div className="flex justify-end">
            <ActionPill
              type="submit"
              tone="primary"
              label="Enregistrer la zone privée"
              icon={<Plus />}
              text={busy ? 'Enregistrement…' : 'Ajouter la zone'}
              disabled={busy || zones.length >= 10}
            />
          </div>
        </form>
      </div>
    </OverlaySheet>
  );
}

export default PrivacyZonesSheet;
