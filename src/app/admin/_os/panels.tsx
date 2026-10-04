import Link from 'next/link';

import { Symbol } from './Symbol';
import type { InspectorContent, OsMetric, OsRow, PanelKind } from './routeConfig';

/** Hero de section : eyebrow + titre + sous-titre + actions. */
export function Hero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions: React.ReactNode;
}) {
  return (
    <section className="os-hero" aria-label={title}>
      <div className="hero-copy">
        <span className="os-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="hero-actions os-hero-actions">{actions}</div>
    </section>
  );
}

/** Pills de période (liens, état via searchParams côté page). */
export function PeriodPills({
  base,
  current,
  extra,
}: {
  base: string;
  current: string;
  extra?: string;
}) {
  const options = ["Aujourd'hui", '7 jours', '30 jours', 'Personnaliser'];
  return (
    <div className="os-period os-clear" role="group" aria-label="Période">
      {options.map((o) =>
        o === 'Personnaliser' ? (
          <Link
            key={o}
            href={`${base}?period=custom${extra ?? ''}`}
            className={current === 'custom' ? 'selected' : ''}
          >
            {o}
          </Link>
        ) : (
          <Link
            key={o}
            href={`${base}?period=${encodeURIComponent(o)}${extra ?? ''}`}
            className={current === o ? 'selected' : ''}
          >
            {o}
          </Link>
        )
      )}
    </div>
  );
}

/** Grille des 4 KPI. */
export function MetricGrid({ metrics }: { metrics: OsMetric[] }) {
  return (
    <section className="os-metrics" aria-label="Indicateurs">
      {metrics.map((m) => (
        <article className="os-metric os-clear" key={m.label}>
          <div className="os-metric-top">
            <span>{m.label}</span>
            <span className="os-metric-symbol">
              <Symbol name={m.icon} />
            </span>
          </div>
          <strong>{m.value}</strong>
          {m.delta ? <small className={m.tone === 'warn' || m.tone === 'danger' ? 'warning' : ''}>{m.delta}</small> : null}
        </article>
      ))}
    </section>
  );
}

/** Panneau de données générique (gauche : chart/table/services). */
export function DataPanel({
  label,
  title,
  chip,
  kind,
  rows,
  foot,
  series,
  children,
}: {
  label: string;
  title: string;
  chip: string;
  kind: PanelKind;
  rows: OsRow[];
  foot?: OsRow[];
  series?: { day: string; count: number }[];
  children?: React.ReactNode;
}) {
  return (
    <article className="os-panel" aria-label={title}>
      <div className="os-panel-head">
        <div>
          <span className="os-eyebrow">{label}</span>
          <h2>{title}</h2>
        </div>
        <span className="os-chip os-clear">{chip}</span>
      </div>
      {kind === 'chart' ? <BarChart series={series} foot={foot} /> : <DataRows rows={rows} />}
      {children}
    </article>
  );
}

/** Panneau droit filtrable (form GET côté page ou îlot client). */
export function FilterPanel({
  label,
  title,
  filter,
  rows,
  empty,
}: {
  label: string;
  title: string;
  filter: React.ReactNode;
  rows: { title: string; detail: string; value: string; tone: OsRow['tone']; href?: string }[];
  empty: string;
}) {
  return (
    <article className="os-panel" aria-label={title}>
      <div className="os-panel-head">
        <div>
          <span className="os-eyebrow">{label}</span>
          <h2>{title}</h2>
        </div>
        {filter}
      </div>
      {rows.length === 0 ? (
        <p className="os-row-copy"><small>{empty}</small></p>
      ) : (
        <div className="os-rows">
          {rows.map((r, i) => {
            const inner = (
              <>
                <span className={`os-row-status ${r.tone}`}>
                  <Symbol name={r.tone === 'good' ? 'check' : r.tone === 'danger' || r.tone === 'warn' ? 'warning' : 'eye'} size={13} />
                </span>
                <span className="os-row-copy">
                  <strong>{r.title}</strong>
                  <small>{r.detail}</small>
                </span>
                <span className={`os-row-value ${r.tone}`}>{r.value}</span>
                <Symbol name="chevron" size={12} />
              </>
            );
            return r.href ? (
              <Link key={i} href={r.href} className="os-row">
                {inner}
              </Link>
            ) : (
              <div key={i} className="os-row">
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function BarChart({ series, foot }: { series?: { day: string; count: number }[]; foot?: OsRow[] }) {
  const fallback = [34, 42, 38, 55, 49, 66, 60, 78, 70, 90, 82, 103, 95, 114, 107, 127, 119, 139, 132, 151, 143, 166, 157, 181, 172, 195, 186, 207, 199, 221];
  const values = series && series.length > 0 ? series.map((s) => s.count) : fallback;
  const max = Math.max(1, ...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return (
    <>
      <div className="os-chart" role="img" aria-label="Activité">
        {values.map((v, i) => (
          <span
            key={i}
            className={v > avg && v > 0 ? 'hot' : ''}
            style={{ height: Math.max(6, Math.round((v / max) * 170)) }}
            title={series?.[i] ? `${series[i].day} : ${v}` : undefined}
          />
        ))}
      </div>
      {foot && foot.length > 0 ? (
        <div className="os-chart-foot">
          {foot.map((row, i) => (
            <div key={i}>
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
              <em>{row.value}</em>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function DataRows({ rows }: { rows: OsRow[] }) {
  return (
    <div className="os-rows">
      {rows.map((row, i) => (
        <div className="os-row" key={i}>
          <span className={`os-row-status ${row.tone}`}>
            <Symbol name={row.tone === 'good' ? 'check' : row.tone === 'danger' || row.tone === 'warn' ? 'warning' : 'eye'} size={13} />
          </span>
          <span className="os-row-copy">
            <strong>{row.title}</strong>
            <small>{row.detail}</small>
          </span>
          <span className={`os-row-value ${row.tone}`}>{row.value}</span>
          <Symbol name="chevron" size={12} />
        </div>
      ))}
    </div>
  );
}

export type { InspectorContent };
