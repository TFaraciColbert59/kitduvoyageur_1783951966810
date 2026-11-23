'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { fmtDuration, fmtKm, fmtMeters } from '../../../fmt';
import { cutOperation, previewCut, profileData, type CutPreview } from '../../../profileCuts';
import { useRouteViewMode } from '../expertMode';
import { Block, Note } from '../track/atoms';
import { useRouteWorkspace } from '../WorkspaceContext';
import { useGroupPace } from './usePace';

const W = 1000;
const H = 100;
const MAX_POINTS = 400;

interface Live {
  readonly stageId: string;
  readonly km: number;
  readonly preview: CutPreview;
}

/**
 * 6.2 : le profil du tracé avec une poignée par coupure de journée. On la glisse (souris, doigt) ou on la
 * déplace aux flèches ; pendant le geste, l'effet sur les deux journées voisines s'affiche tout de suite ; au
 * relâché, l'opération `cut_stage_at` pose la coupure sur le tracé (jamais hors du tracé, jamais sur un repos).
 */
export function ProfileCuts({ onlyStageId }: { onlyStageId?: string }) {
  const { workspace, runOperation, canEditStages } = useRouteWorkspace();
  const { expert } = useRouteViewMode();
  const { pace } = useGroupPace();
  const box = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const liveRef = useRef<Live | null>(null);
  const keyTimer = useRef<number | null>(null);
  const data = useMemo(() => profileData(workspace), [workspace]);
  const cuts = onlyStageId ? data.cuts.filter((c) => c.stageId === onlyStageId) : data.cuts;

  const series = useMemo(() => {
    const n = data.vertices.length;
    if (n < 2 || data.totalKm <= 0) return null;
    const step = Math.max(1, Math.floor(n / MAX_POINTS));
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    const known = data.elevations.filter((e): e is number => e != null);
    const lo = known.length ? Math.min(...known) : 0;
    const hi = known.length ? Math.max(...known) : 1;
    const span = Math.max(1, hi - lo);
    const xs = idx.map((i) => (data.vertices[i].km / data.totalKm) * W);
    // Altitude connue seulement : les trous sont sautés, jamais ramenés à 0.
    let path = '';
    let area = '';
    let first: number | null = null;
    let lastX = 0;
    idx.forEach((vi, k) => {
      const e = data.elevations[vi];
      if (e == null) return;
      const y = H - 6 - ((e - lo) / span) * (H - 16);
      path += `${path ? 'L' : 'M'}${xs[k].toFixed(1)} ${y.toFixed(1)}`;
      if (first == null) first = xs[k];
      lastX = xs[k];
      area += `${area ? 'L' : `M${xs[k].toFixed(1)} ${H} L`}${xs[k].toFixed(1)} ${y.toFixed(1)}`;
    });
    if (area && first != null) area += ` L${lastX.toFixed(1)} ${H} Z`;
    return { path, area, lo: Math.round(lo), hi: Math.round(hi), hasEle: known.length >= 2 };
  }, [data]);

  const kmAt = useCallback(
    (clientX: number): number | null => {
      const el = box.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0) return null;
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * data.totalKm;
    },
    [data.totalKm]
  );

  const update = useCallback(
    (stageId: string, km: number) => {
      const p = previewCut(workspace, stageId, km, pace.params, data);
      if (!p) return;
      const next = { stageId, km: p.km, preview: p };
      liveRef.current = next;
      setLive(next);
    },
    [workspace, pace.params, data]
  );

  const commit = useCallback(() => {
    const cur = liveRef.current;
    liveRef.current = null;
    setLive(null);
    if (!cur || !canEditStages) return;
    const stage = workspace.stages.find((s) => s.id === cur.stageId);
    const original = data.cuts.find((c) => c.stageId === cur.stageId);
    if (!stage || !original || Math.abs(original.km - cur.km) < 0.05) return;
    const op = cutOperation(workspace, cur.stageId, cur.km, `pt-cut-${Date.now().toString(36)}`, pace.params);
    if (!op) return;
    void runOperation(op, { [stage.id]: stage.entityVersion }, { gesture: `cut-${stage.id}` });
  }, [canEditStages, data.cuts, pace.params, runOperation, workspace]);

  if (!series || data.cuts.length === 0) {
    return onlyStageId ? null : (
      <Block title="Coupures sur le profil" testId="profile-cuts">
        <Note>Il faut au moins deux journées et un tracé pour déplacer une coupure sur le profil.</Note>
      </Block>
    );
  }

  const onDown = (e: PointerEvent<HTMLButtonElement>, stageId: string, movable: boolean) => {
    if (!canEditStages || !movable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const km = kmAt(e.clientX);
    if (km != null) update(stageId, km);
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>, stageId: string) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const km = kmAt(e.clientX);
    if (km != null) update(stageId, km);
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, stageId: string, current: number, movable: boolean) => {
    if (!canEditStages || !movable) return;
    const step = e.shiftKey ? 2 : 0.5;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1;
    update(stageId, (liveRef.current?.stageId === stageId ? liveRef.current.km : current) + dir * step);
    if (keyTimer.current != null) window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(commit, 600);
  };

  const days = workspace.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
  const dayOf = (stageId: string) => days.find((s) => s.id === stageId)?.dayNumber ?? 0;

  return (
    <Block title="Coupures sur le profil" right={fmtKm(data.totalKm)} testId="profile-cuts">
      <div className="rts-profile" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Profil d’altitude du tracé avec les coupures de journée">
          {series.hasEle ? (
            <>
              <path className="area" d={series.area} />
              <path className="line" d={series.path} />
            </>
          ) : (
            <line className="flat" x1="0" y1={H / 2} x2={W} y2={H / 2} />
          )}
          {data.cuts.map((c) => (
            <line key={c.stageId} className={`cut${c.movable ? '' : ' locked'}${live?.stageId === c.stageId ? ' live' : ''}`} x1={((live?.stageId === c.stageId ? live.km : c.km) / data.totalKm) * W} x2={((live?.stageId === c.stageId ? live.km : c.km) / data.totalKm) * W} y1="0" y2={H} />
          ))}
        </svg>
        {cuts.map((c) => {
          const km = live?.stageId === c.stageId ? live.km : c.km;
          return (
            <button
              key={c.stageId}
              type="button"
              className="rts-handle"
              role="slider"
              data-locked={c.movable && canEditStages ? 'false' : 'true'}
              data-testid={`cut-handle-${c.stageId}`}
              aria-label={`Coupure entre le jour ${dayOf(c.stageId)} et le jour ${dayOf(c.stageId) + 1}`}
              aria-valuemin={c.minKm}
              aria-valuemax={c.maxKm}
              aria-valuenow={Math.round(km * 10) / 10}
              aria-valuetext={`au kilomètre ${(Math.round(km * 10) / 10).toLocaleString('fr-FR')}`}
              aria-disabled={!c.movable || !canEditStages}
              title={c.lockedReason ?? undefined}
              style={{ left: `${(km / data.totalKm) * 100}%` }}
              onPointerDown={(e) => onDown(e, c.stageId, c.movable)}
              onPointerMove={(e) => onMove(e, c.stageId)}
              onPointerUp={commit}
              onPointerCancel={() => {
                liveRef.current = null;
                setLive(null);
              }}
              onKeyDown={(e) => onKey(e, c.stageId, c.km, c.movable)}
            />
          );
        })}
      </div>
      {live ? (
        <div className="rts-live" aria-live="polite" data-testid="cut-live">
          <div>
            <b>Jour {dayOf(live.stageId)}</b>
            {fmtKm(live.preview.before.distanceKm)} · {live.preview.before.durationMin != null ? `${live.preview.before.lowerBound ? '≥ ' : '≈ '}${fmtDuration(live.preview.before.durationMin)}` : 'durée inconnue'} ·{' '}
            {live.preview.before.ascentM != null ? `+${fmtMeters(live.preview.before.ascentM)}` : 'D+ inconnu'}
          </div>
          <div>
            <b>Jour {dayOf(live.stageId) + 1}</b>
            {fmtKm(live.preview.after.distanceKm)} · {live.preview.after.durationMin != null ? `${live.preview.after.lowerBound ? '≥ ' : '≈ '}${fmtDuration(live.preview.after.durationMin)}` : 'durée inconnue'} ·{' '}
            {live.preview.after.ascentM != null ? `+${fmtMeters(live.preview.after.ascentM)}` : 'D+ inconnu'}
          </div>
        </div>
      ) : null}
      <Note>
        {canEditStages ? 'Glissez une poignée (ou utilisez les flèches) : la coupure se pose sur le tracé et seules les deux journées voisines changent.' : 'Vous pouvez lire le profil ; seules les personnes qui modifient les étapes déplacent une coupure.'}
        {!series.hasEle ? ' Altitude inconnue sur ce tracé : le profil est à plat, les distances restent exactes.' : expert ? ` Altitude de ${fmtMeters(series.lo)} à ${fmtMeters(series.hi)} (échantillons du tracé).` : ''}
        {cuts.some((c) => !c.movable) ? ' Une coupure autour d’un jour de repos ou d’une étape courte ne se déplace pas.' : ''}
      </Note>
      <span className="xp-visually-hidden" role="status">
        {live ? `Coupure au kilomètre ${live.km}` : ''}
      </span>
    </Block>
  );
}

