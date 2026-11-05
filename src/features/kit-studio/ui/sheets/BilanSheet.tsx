'use client';
import type { CSSProperties } from 'react';
import { cog, cogState, dayWeights } from '../../domain/balance';
import { blockers, readiness, readinessGain, tips } from '../../domain/blockers';
import type { Blocker } from '../../domain/blockers';
import { ZONE_NAMES } from '../../domain/catalog';
import type { PackZoneId } from '../../domain/catalog';
import { formatEuro, formatKg } from '../../domain/format';
import { currentKit } from '../../domain/state';
import { totals } from '../../domain/totals';
import type { KitState } from '../../domain/types';
import { Capsule } from '../Drawer/Capsule';
import { Pager } from '../Drawer/Pager';
import { Strip } from '../Drawer/Strip';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { S } from '../strings';
import { BalanceChart } from './BalanceChart';
import { glyphOf } from './ItemSheet';
import './bilan.css';

const NB = ' ';

/** Intentions du Bilan que l'état seul ne peut exprimer. */
export type BilanIntent =
  | { type: 'blocker'; blocker: Blocker }
  | { type: 'deck'; deck: 'fill' | 'debrief' };

interface BilanSheetProps {
  state: KitState;
  page: number;
  onPage: (page: number) => void;
  onAction: (next: KitState | BilanIntent) => void;
  /** Bouton grille : retour à l'inventaire. */
  onBack: () => void;
}

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Bilan du sac : poids et répartition, équilibre, journée par journée, « Prêt à N % ». Contrôlé. */
export function BilanSheet({ state, page, onPage, onAction, onBack }: BilanSheetProps) {
  const k = currentKit(state);
  const t = totals(state);
  const c = cog(state);
  const cs = cogState(c);
  const bl = blockers(state);
  const pct = Math.round((t.onBack / (k.body * 1000)) * 100);
  const zb = (Object.entries(t.weightByZone) as [PackZoneId, number][]).filter(([z, g]) => z !== 'worn' && g > 0);
  const mx = Math.max(1, ...zb.map(([, g]) => g));
  const ids: string[] = [];
  const pages: React.ReactNode[] = [];
  const items: { id: string; label: string; icon: IconName }[] = [];
  const add = (id: string, label: string, icon: IconName, node: React.ReactNode) => {
    ids.push(id);
    pages.push(node);
    items.push({ id, label, icon });
  };

  add(
    'poids',
    'Poids',
    'weight',
    <>
      <div className="ks-bl-hero">
        <span className="ks-bl-big">{formatKg(t.onBack)}</span>
        <span className="ks-bl-t13">{`sur le dos${k.food ? ` · jour ${state.day}` : ''}`}</span>
      </div>
      <div className="ks-bl-stack" aria-hidden="true">
        <i className="ks-bl-base" style={{ flex: t.baseWeight }} />
        <i className="ks-bl-cons" style={{ flex: Math.max(t.consumables, 1) }} />
      </div>
      <div className="ks-bl-legend">
        <span>
          <i data-k="base" />
          {S.bilan.base}
          <b>{formatKg(t.baseWeight)}</b>
        </span>
        <span>
          <i data-k="cons" />
          {S.bilan.consumables}
          <b>{formatKg(t.consumables)}</b>
        </span>
        <span>
          <i data-k="worn" />
          {S.bilan.worn}
          <b>{formatKg(t.worn)}</b>
        </span>
      </div>
      <p className="ks-bl-t13">{`${pct}${NB}% de ton poids (${k.body}${NB}kg). ${S.bilan.limit}`}</p>
      <div className="ks-bl-zbars">
        {zb.map(([z, g]) => (
          <div key={z}>
            <span>{ZONE_NAMES[z]}</span>
            <i style={{ '--p': `${((g / mx) * 100).toFixed(1)}%` } as CSSProperties} />
            <b>{formatKg(g)}</b>
          </div>
        ))}
      </div>
    </>,
  );

  add('equilibre', 'Équilibre', 'target', <BalanceChart cog={c} verdict={cs} />);

  if (k.food) {
    const w = dayWeights(state);
    const mn = Math.min(...w) * 0.97;
    const mxw = Math.max(...w) * 1.02;
    const X = (i: number) => 18 + (i / Math.max(1, k.days - 1)) * 284;
    const Y = (g: number) => 98 - ((g - mn) / Math.max(1, mxw - mn)) * 78;
    const pts = w.map((g, i) => `${X(i).toFixed(1)},${Y(g).toFixed(1)}`).join(' ');
    const rs = [...Array(k.days).keys()].filter((i) => i > 0 && i % k.food!.carry === 0);
    const d = Math.min(Math.max(1, state.day), k.days);
    add(
      'jours',
      'Journée par journée',
      'cal',
      <>
        <div className="ks-bl-hero">
          <span className="ks-bl-big">{formatKg(w[d - 1])}</span>
          <span className="ks-bl-t13">{`jour ${d} sur ${k.days}`}</span>
        </div>
        <svg className="ks-bl-chart" viewBox="0 0 320 112" aria-hidden="true">
          <polygon points={`${X(0)},106 ${pts} ${X(k.days - 1)},106`} className="ks-bl-area" />
          <polyline points={pts} className="ks-bl-line" />
          {rs.map((i) => (
            <g key={i}>
              <line x1={X(i)} y1="14" x2={X(i)} y2="106" className="ks-bl-rs" />
              <text x={X(i)} y="10" textAnchor="middle" className="ks-bl-ct">
                ravitaillement
              </text>
            </g>
          ))}
          {w.map((g, i) => (
            <circle key={i} cx={X(i)} cy={Y(g)} r={i === d - 1 ? 5.5 : 3.2} className="ks-bl-cdot" data-cur={i === d - 1} />
          ))}
        </svg>
        <input
          className="ks-bl-day"
          type="range"
          min={1}
          max={k.days}
          step={1}
          value={d}
          aria-label="Jour de la sortie"
          style={{ '--v': `${(((d - 1) / Math.max(1, k.days - 1)) * 100).toFixed(0)}%` } as CSSProperties}
          onChange={(e) => onAction({ ...state, day: Number(e.target.value) })}
        />
        <p className="ks-bl-t13">{`Vivres pour ${k.food.carry}${NB}jours, puis ravitaillement en refuge. Eau rechargée chaque jour.`}</p>
      </>,
    );
  }

  const pc = readiness(bl, cs);
  const circ = 2 * Math.PI * 26;
  const list: Blocker[] = [...bl];
  if (!cs.ok) list.push({ kind: 'cog', zone: 'main', gl: 'bag', t: cs.t, s: S.bag.stowAuto });
  const tone = (b: Blocker) => (b.kind === 'cap' ? 'info' : b.kind === 'ghost' || b.kind === 'cog' ? 'warn' : 'ok');
  const tp = tips(state).slice(0, 2);
  const rest = list.length - 3;
  add(
    'pret',
    'Prêt',
    'check',
    <>
      <div className="ks-bl-ready">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" className="ks-bl-rbg" />
          <circle
            cx="32"
            cy="32"
            r="26"
            className={`ks-bl-rfg ${pc >= 90 ? 'ks-bl-ok' : 'ks-bl-warn'}`}
            style={{ strokeDasharray: `${((pc / 100) * circ).toFixed(1)} ${circ.toFixed(1)}` }}
          />
        </svg>
        <div>
          <span className="ks-bl-t17">{`Prêt à ${pc}${NB}%`}</span>
          <span className="ks-bl-t13">{list.length ? `${S.bilan.toFull}${NB}:` : S.bilan.nothingMissing}</span>
        </div>
      </div>
      <div className="ks-bl-rows">
        {list.slice(0, 3).map((b, i) => (
          <button key={`${b.kind}-${i}`} type="button" className="ks-bl-row" onClick={() => onAction({ type: 'blocker', blocker: b })}>
            <span className="ks-bl-rg" data-tone={tone(b)}>
              <Icon name={glyphOf(b.gl)} />
            </span>
            <span>
              <b>{b.t}</b>
              <small>{b.s}</small>
            </span>
            <em className="ks-bl-gain">{`+${b.kind === 'cog' ? 7 : readinessGain(state, b)}${NB}%`}</em>
          </button>
        ))}
      </div>
      {rest > 0 && <p className="ks-bl-t13">{`Et ${plural(rest, 'autre')} ${rest > 1 ? 'points' : 'point'}.`}</p>}
      {tp.map((x) => (
        <p key={x.id + x.t} className="ks-bl-t13 ks-bl-tip">{`${x.t}${NB}: ${x.s}`}</p>
      ))}
      {(t.buy > 0 || t.rent > 0) && (
        <p className="ks-bl-t13">
          {[
            t.buy ? `${S.bilan.bought}${NB}: ${formatEuro(t.buy * 100)}` : '',
            t.rent ? `${S.bilan.rented}${NB}: ${formatEuro(t.rent * 100)} pour ${k.days}${NB}jours` : '',
            t.unknown ? `${t.unknown} poids inconnu${t.unknown > 1 ? 's' : ''}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <div className="ks-bl-acts">
        <button type="button" className="ks-bl-btn" onClick={() => onAction({ type: 'deck', deck: 'fill' })}>
          {S.bilan.fill}
        </button>
        <button type="button" className="ks-bl-btn" onClick={() => onAction({ type: 'deck', deck: 'debrief' })}>
          {S.bilan.debrief}
        </button>
      </div>
    </>,
  );

  const cur = Math.min(Math.max(0, page), pages.length - 1);
  return (
    <>
      <Pager pages={pages} page={cur} onPageChange={onPage} label={S.bilan.title} />
      <Strip>
        <button type="button" className="ks-bl-back-btn" aria-label={S.item.back} onClick={onBack}>
          <Icon name="grid" />
        </button>
        <Capsule
          kind="tablist"
          label={S.a11y.pages}
          items={items.map((i) => ({ id: i.id, label: i.label, icon: <Icon name={i.icon} /> }))}
          value={ids[cur]}
          onChange={(id) => onPage(Math.max(0, ids.indexOf(id)))}
        />
      </Strip>
    </>
  );
}
