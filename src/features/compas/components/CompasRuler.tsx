'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import Icon from '@/components/ui/Icon';
import type { CompasModel } from '../engine/compasModel';
import {
  RULER_TICKS,
  durationZone,
  formatHours,
  hoursFromPosition,
  rulerPosition,
  snapHours,
  stepHours,
} from '../engine/format';
import { planApplication } from '../engine/intent';
import { applyCurrent, runOps } from './compasApply';
import type { CompasCtl } from './compasTypes';

/** Durée affichée : choisie (dates ou heures), sinon temps de marche du parcours. */
export function tripHours(model: CompasModel): number | null {
  if (model.dates.hours != null) return model.dates.hours;
  if (model.route.durationMin) return model.route.durationMin / 60;
  return null;
}

/**
 * Règle de durée (maquette v8) : de 15 min à 1 mois, logarithmique.
 * Glisser propose une durée ; rien n'est écrit avant ✓. Avec un parcours du
 * catalogue, changer le nombre de jours le redécoupe (sans rien perdre).
 * Sans date de départ, ✓ ouvre « Quand » avec la durée choisie.
 */
export function DurationRuler({ ctl }: { ctl: CompasCtl }) {
  const m = ctl.data.model;
  const current = tripHours(m);
  const editable = ctl.data.canEdit;
  const [draft, setDraft] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Données fraîches : la proposition en cours est soit appliquée, soit caduque.
  useEffect(() => setDraft(null), [current]);

  const shown = draft ?? current;
  const pos = shown == null ? null : rulerPosition(shown);
  const pending = draft != null && (current == null || snapHours(current) !== draft);

  const at = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || r.width <= 30) return null;
    return snapHours(hoursFromPosition((clientX - r.left - 15) / (r.width - 30)));
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const h = at(e.clientX);
    if (h != null) setDraft(h);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const h = at(e.clientX);
    if (h != null) setDraft(h);
  };
  const onUp = () => {
    dragging.current = false;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const base = draft ?? current ?? 24;
    const map: Record<string, [1 | -1, boolean]> = {
      ArrowRight: [1, false],
      ArrowUp: [1, false],
      ArrowLeft: [-1, false],
      ArrowDown: [-1, false],
      PageUp: [1, true],
      PageDown: [-1, true],
    };
    const k = map[e.key];
    if (k) {
      e.preventDefault();
      setDraft(stepHours(base, k[0], k[1]));
    } else if (e.key === 'Enter' && pending) {
      e.preventDefault();
      void apply();
    } else if (e.key === 'Escape' && draft != null) {
      e.preventDefault();
      setDraft(null);
    }
  };

  const apply = async () => {
    if (draft == null) return;
    if (!m.dates.start) {
      ctl.open({ kind: 'step', step: 'ou', flow: 'quand', hint: { hours: draft } });
      setDraft(null);
      return;
    }
    const ops = planApplication(
      [
        {
          type: 'set_duration',
          days: draft >= 24 ? draft / 24 : null,
          hours: draft < 24 ? draft : null,
        },
      ],
      applyCurrent(ctl)
    );
    const resplit = ops.some((o) => o.op === 'dates' && o.resplit);
    const ok = await ctl.run(
      `Durée : ${formatHours(draft)}${resplit ? ' · parcours redécoupé' : ''}`,
      () => runOps(ctl, ops)
    );
    if (!ok) setDraft(null);
  };

  const label =
    shown == null ? 'Durée à définir' : `Durée ${formatHours(shown)}, ${durationZone(shown)}`;

  return (
    <div className="cp-ruler cp-glass" data-edit={editable ? '1' : undefined}>
      <div className="cp-ruler__h">
        <span>Durée{shown != null && <span className="cp-zone">{durationZone(shown)}</span>}</span>
        {pending ? (
          <span className="cp-ruler__ask">
            <b>{formatHours(draft)}</b>
            <button
              type="button"
              className="cp-ibtn cp-ibtn--sm"
              aria-label="Annuler"
              onClick={() => setDraft(null)}
            >
              <Icon name="x" size={14} />
            </button>
            <button
              type="button"
              className="cp-ibtn cp-ibtn--sm cp-ibtn--pg"
              aria-label={
                m.dates.start ? `Appliquer : ${formatHours(draft)}` : 'Choisir le jour de départ'
              }
              disabled={ctl.busy}
              onClick={() => void apply()}
            >
              <Icon name={m.dates.start ? 'check' : 'calendar'} size={14} />
            </button>
          </span>
        ) : (
          <b>{shown == null ? 'À définir' : formatHours(shown)}</b>
        )}
      </div>
      <div
        ref={track}
        className="cp-ruler__track"
        role={editable ? 'slider' : 'img'}
        tabIndex={editable ? 0 : undefined}
        aria-label={editable ? 'Durée de la sortie' : label}
        aria-valuemin={editable ? 0.25 : undefined}
        aria-valuemax={editable ? 720 : undefined}
        aria-valuenow={editable && shown != null ? shown : undefined}
        aria-valuetext={editable ? (shown == null ? 'À définir' : formatHours(shown)) : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={editable ? onKey : undefined}
      >
        {pos != null && (
          <>
            <i className="cp-ruler__fill" style={{ width: `calc((100% - 30px) * ${pos})` }} />
            <i
              className="cp-ruler__thumb"
              style={{ left: `calc(15px + (100% - 30px) * ${pos})` }}
            />
          </>
        )}
      </div>
      <div className="cp-ticks cp-hide-sm" aria-hidden="true">
        {RULER_TICKS.map(([h, tick]) => (
          <span key={tick} style={{ left: `calc(15px + (100% - 30px) * ${rulerPosition(h)})` }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
