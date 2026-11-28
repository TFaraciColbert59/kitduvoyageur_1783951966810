'use client';

import React, { useState } from 'react';
import {
  Car,
  Download,
  Mountain,
  Scissors,
  ShieldCheck,
  Split,
} from 'lucide-react';
import { ExplorerNestedSubDrawer } from '../primitives/ExplorerNestedSubDrawer';

export interface SummaryPrivacyCropSubDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId?: string | null;
  totalPoints: number;
  vehicleDetectedIndex?: number | null;
  epzAppliedRadiusM?: number;
  onExportGpx?: () => void;
  onLifecycleMutated?: (action: 'crop' | 'split' | 'correction') => void;
}

/**
 * Lot 07 — Sous-tiroir Confidentialité (EPZ), Crop Auto-Voiture, Trim Manuel,
 * Split 1→2 activités et recalage altitude DEM reliés aux routes existantes
 * `/api/activities/lifecycle/[id]/{crop,split,correction}`.
 */
export function SummaryPrivacyCropSubDrawer({
  open,
  onOpenChange,
  sessionId = null,
  totalPoints,
  vehicleDetectedIndex = null,
  epzAppliedRadiusM = 500,
  onExportGpx,
  onLifecycleMutated,
}: SummaryPrivacyCropSubDrawerProps) {
  const safeMax = Math.max(2, totalPoints);
  const [trimStartIdx, setTrimStartIdx] = useState(0);
  const [trimEndIdx, setTrimEndIdx] = useState(safeMax - 1);
  const [splitIdx, setSplitIdx] = useState(Math.max(1, Math.floor(safeMax / 2)));
  const [busy, setBusy] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const callLifecycle = async (
    action: 'crop' | 'split' | 'correction',
    payload: Record<string, unknown>,
  ) => {
    if (!sessionId) {
      setStatusMsg('Synchronisez d’abord la sortie avant de la découper sur le serveur.');
      return;
    }
    setBusy(action);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/activities/lifecycle/${encodeURIComponent(sessionId)}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setStatusMsg(`Action ${action} indisponible (HTTP ${res.status}).`);
        return;
      }
      setStatusMsg(
        action === 'crop'
          ? 'Trace recadrée et métriques recalculées.'
          : action === 'split'
            ? 'Activité scindée en 2 sorties distinctes.'
            : 'Recalage altimétrique DEM appliqué.',
      );
      onLifecycleMutated?.(action);
    } catch {
      setStatusMsg('Erreur réseau pendant la mise à jour.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ExplorerNestedSubDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Confidentialité · Crop · Split"
      subtitle="Zone privée EPZ, découpage trace & recalage DEM"
    >
      <div className="flex flex-col gap-3">
        {/* EPZ preview */}
        <section
          className="rounded-2xl p-3"
          style={{
            background: 'var(--lkv-surface-elevated, #ffffff)',
            border: '0.5px solid var(--xp-hud-border)',
          }}
        >
          <div className="flex items-center justify-between text-[12px] font-extrabold uppercase">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={14} aria-hidden="true" />
              Zone de confidentialité (EPZ)
            </span>
            <span>{epzAppliedRadiusM > 0 ? `Rayon ${epzAppliedRadiusM} m` : 'Désactivée'}</span>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--xp-hud-ink-muted)' }}>
            Le départ et l’arrivée publics sont tronqués avec un centre décalé aléatoire
            anti-triangulation. Votre trace privée reste intacte.
          </p>
        </section>

        {/* Auto-crop voiture */}
        {vehicleDetectedIndex !== null && vehicleDetectedIndex > 0 ? (
          <section
            className="flex flex-col gap-2 rounded-2xl p-3"
            style={{
              background: 'var(--lkv-surface-elevated, #ffffff)',
              border: '1px solid var(--xp-hud-danger)',
            }}
          >
            <div className="flex items-center gap-2 text-[12.5px] font-extrabold">
              <Car size={15} aria-hidden="true" />
              <span>Trajet voiture détecté en fin de sortie</span>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void callLifecycle('crop', {
                  startIndex: 0,
                  endIndex: vehicleDetectedIndex,
                  reason: 'auto_crop_vehicle',
                })
              }
              className="xp20-hud-btn flex w-full items-center justify-center gap-2 text-[13px] font-bold"
              style={{
                background: 'var(--xp-hud-accent)',
                color: 'var(--xp-hud-accent-fg)',
              }}
            >
              <Scissors size={14} aria-hidden="true" />
              <span>Couper automatiquement au point #{vehicleDetectedIndex}</span>
            </button>
          </section>
        ) : null}

        {/* Trim manuel */}
        <section
          className="flex flex-col gap-2 rounded-2xl p-3"
          style={{
            background: 'var(--lkv-surface-elevated, #ffffff)',
            border: '0.5px solid var(--xp-hud-border)',
          }}
        >
          <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase">
            <Scissors size={14} aria-hidden="true" />
            Recadrage manuel (Trim)
          </span>
          <label className="flex flex-col gap-1 text-[12px] font-semibold">
            <span>Début : point #{trimStartIdx}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, trimEndIdx - 1)}
              value={trimStartIdx}
              onChange={(e) => setTrimStartIdx(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold">
            <span>Fin : point #{trimEndIdx} / {safeMax - 1}</span>
            <input
              type="range"
              min={Math.min(safeMax - 1, trimStartIdx + 1)}
              max={safeMax - 1}
              value={trimEndIdx}
              onChange={(e) => setTrimEndIdx(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              void callLifecycle('crop', {
                startIndex: trimStartIdx,
                endIndex: trimEndIdx,
                reason: 'manual_trim',
              })
            }
            className="xp20-hud-btn text-[13px] font-bold"
            style={{
              background: 'var(--lkv-surface-muted, #edf1ea)',
              color: 'var(--xp-hud-ink)',
            }}
          >
            {busy === 'crop' ? 'Recadrage…' : 'Appliquer le recadrage'}
          </button>
        </section>

        {/* Split 1 -> 2 */}
        <section
          className="flex flex-col gap-2 rounded-2xl p-3"
          style={{
            background: 'var(--lkv-surface-elevated, #ffffff)',
            border: '0.5px solid var(--xp-hud-border)',
          }}
        >
          <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase">
            <Split size={14} aria-hidden="true" />
            Scinder en 2 activités
          </span>
          <label className="flex flex-col gap-1 text-[12px] font-semibold">
            <span>Point de coupure : #{splitIdx}</span>
            <input
              type="range"
              min={1}
              max={Math.max(1, safeMax - 2)}
              value={splitIdx}
              onChange={(e) => setSplitIdx(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void callLifecycle('split', { splitIndex: splitIdx })}
            className="xp20-hud-btn text-[13px] font-bold"
            style={{
              background: 'var(--lkv-surface-muted, #edf1ea)',
              color: 'var(--xp-hud-ink)',
            }}
          >
            {busy === 'split' ? 'Découpage…' : 'Scinder en 2 sorties'}
          </button>
        </section>

        {/* Correction DEM & Exports */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void callLifecycle('correction', { mode: 'dem_recalibrate' })}
            className="xp20-hud-btn inline-flex items-center justify-center gap-1.5 text-[12.5px] font-bold"
            style={{
              background: 'var(--lkv-surface-muted, #edf1ea)',
              color: 'var(--xp-hud-ink)',
            }}
          >
            <Mountain size={14} aria-hidden="true" />
            <span>Recaler D+ (DEM)</span>
          </button>

          {onExportGpx ? (
            <button
              type="button"
              onClick={onExportGpx}
              className="xp20-hud-btn inline-flex items-center justify-center gap-1.5 text-[12.5px] font-bold"
              style={{
                background: 'var(--lkv-surface-muted, #edf1ea)',
                color: 'var(--xp-hud-ink)',
              }}
            >
              <Download size={14} aria-hidden="true" />
              <span>Export .GPX</span>
            </button>
          ) : null}
        </div>

        {statusMsg ? (
          <p
            role="status"
            className="rounded-xl px-3 py-2 text-[12px] font-bold"
            style={{
              background: 'var(--lkv-surface-muted, #edf1ea)',
              color: 'var(--xp-hud-ink)',
            }}
          >
            {statusMsg}
          </p>
        ) : null}
      </div>
    </ExplorerNestedSubDrawer>
  );
}
