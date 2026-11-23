'use client';

import type { PointerEvent, ReactNode } from 'react';
import { Bar, Cap, Chip } from '@/features/compas/v5/ui/primitives';
import type { Analysis, DayWater } from '../../../analyse/analysis';
import { ALERT_KIND_LABEL } from '../../../analyse/alerts';
import { formatProvenanceDate, UNKNOWN_DATE, type Provenance } from '../../../analyse/provenance';
import { SLOPE_BAND_LABEL, type SlopeBand } from '../../../analyse/segments';
import { fmtDuration, fmtKm, fmtMeters } from '../../../fmt';
import { RouteRow, RouteRows } from '../ui/RouteRow';
import { V5Scope } from '../ui/V5Scope';
import type { AnalyseRemote } from './analyseClient';
import { Sourced } from './Sourced';
import './analyse.css';

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function when(iso: string | null): string {
  return iso && Number.isFinite(Date.parse(iso)) ? dateTime.format(new Date(iso)) : UNKNOWN_DATE;
}

const unknownAt = (source: string): Provenance => ({ source, at: null });

/* ---------- 7.10 Synthèse en trois lignes ---------- */

export function SynthesisBlock({ analysis, expert }: { analysis: Analysis; expert: boolean }) {
  const s = analysis.synthesis;
  const lines: { id: string; label: string; tone: 'good' | 'warn' | 'bad'; items: readonly string[]; empty: string }[] = [
    { id: 'ok', label: 'Ce qui va', tone: 'good', items: s.ok, empty: 'Rien de confirmé pour l’instant' },
    { id: 'toCheck', label: 'Ce qui reste à vérifier', tone: 'warn', items: s.toCheck, empty: 'Rien à vérifier parmi les données connues' },
    { id: 'blocking', label: 'Ce qui peut bloquer', tone: 'bad', items: s.blocking, empty: 'Aucun blocage relevé dans les données connues' },
  ];
  return (
    <Sourced id="synthesis" provenance={analysis.synthesisProvenance} expert={expert} className="rcw-synth">
      <div role="group" aria-label="Synthèse en trois lignes" data-testid="synthesis">
        {lines.map((l) => (
          <div key={l.id} className="rcw-synth-line" data-tone={l.tone} data-line={l.id}>
            <b>{l.label}</b>
            <span>{l.items.length > 0 ? l.items.join(' · ') : l.empty}</span>
          </div>
        ))}
      </div>
    </Sourced>
  );
}

/* ---------- 7.1 Effort ---------- */

export function EffortBlock({ analysis, expert, onFocusKm }: { analysis: Analysis; expert: boolean; onFocusKm: (km: number) => void }) {
  const e = analysis.effort;
  const prov = analysis.effortProvenance;
  if (e.scorePct == null) {
    return (
      <Sourced id="effort" provenance={prov} expert={expert}>
        <div className="rcw-block" data-testid="effort-unknown">
          <Cap>Effort et temps</Cap>
          <p className="rcw-sub-note">{e.reason ?? 'Effort non calculé.'}</p>
        </div>
      </Sourced>
    );
  }
  const g = e.group;
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="effort-block">
        <Sourced id="effort" provenance={prov} expert={expert}>
          <Cap right={`v. ${e.version}`}>Effort et temps</Cap>
          <div className="rcw-effort-head">
            <b className="v5-num rcw-effort-score" data-testid="effort-score">{e.scorePct} %</b>
            <span>
              {e.p50Min != null ? `${fmtDuration(e.p50Min)} de marche` : 'Durée inconnue'}
              {e.p90Min != null && e.p50Min != null && e.p90Min > e.p50Min ? ` (jusqu’à ${fmtDuration(e.p90Min)})` : ''}
              {e.fatiguePct != null ? ` · fatigue maximale ${e.fatiguePct} %` : ''}
            </span>
          </div>
          <Bar pct={e.scorePct} over={e.scorePct >= 85} />
          {e.reason ? <p className="rcw-sub-note">{e.reason}</p> : null}
          <p className="rcw-sub-note" data-testid="effort-time-basis" data-basis={e.timeBasis.kind}>
            {e.timeBasis.kind === 'profile'
              ? `Temps d’après tes sorties (${e.timeBasis.sampleCount} sortie${e.timeBasis.sampleCount > 1 ? 's' : ''}) : ton allure, pas celle du groupe.`
              : `Temps à l’allure standard : ${e.timeBasis.reason}.`}
          </p>
        </Sourced>
        <RouteRows testId="effort-days">
          {e.days.map((d) => (
            <RouteRow
              key={d.stageId}
              icon="hike"
              title={`Jour ${d.day}`}
              subtitle={`${d.p50Min != null ? fmtDuration(d.p50Min) : 'durée inconnue'}${d.p90Min != null && d.p90Min !== d.p50Min ? ` à ${fmtDuration(d.p90Min)}` : ''}${d.fatiguePct != null ? ` · fatigue ${d.fatiguePct} %` : ''}${d.critical.length > 0 ? ` · ${d.critical.length} passage${d.critical.length > 1 ? 's' : ''} difficile${d.critical.length > 1 ? 's' : ''}` : ''}`}
              value={d.scorePct != null ? `${d.scorePct} %` : null}
              state={d.scorePct == null ? 'unknown' : d.critical.length > 0 ? 'to_check' : undefined}
              provenance={prov}
              valueId={`effort-day-${d.day}`}
              testId={`effort-day-${d.day}`}
            />
          ))}
        </RouteRows>
        {g ? (
          <Sourced id="effort-group" provenance={prov} expert={expert} className="rcw-group-note">
            <p className="rcw-sub-note" data-testid="effort-group">
              Groupe de {g.memberCount} · allure retenue {nf1.format(g.paceKmh)} km/h
              {g.limitingName ? ` (${g.limitingName}, le plus lent)` : ''}
              {g.declaredCount === 0 ? ' · allures non renseignées : allure standard du moteur' : g.declaredCount < g.memberCount ? ` · ${g.memberCount - g.declaredCount} allure(s) non renseignée(s)` : ''}
              {g.profileCount > 0 ? ` · ${g.profileCount} allure${g.profileCount > 1 ? 's' : ''} d’après les sorties` : ''}
              {` · pause toutes les ${g.pauseEveryMin} min`}
            </p>
          </Sourced>
        ) : null}
        {expert ? (
          <div className="rcw-expert-note" data-testid="effort-method">
            <small>{e.method}</small>
            <ul>
              {e.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            {e.critical.length > 0 ? (
              <ul data-testid="effort-critical">
                {e.critical.map((c) => (
                  <li key={c.segmentId}>
                    <button type="button" className="rcw-link" onClick={() => onFocusKm(c.fromKm)}>
                      Jour {c.day ?? '?'} · km {nf1.format(c.fromKm)} à {nf1.format(c.toKm)} · {SLOPE_BAND_LABEL[c.band].toLowerCase()} ({nf1.format(c.gradePct)} %)
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </V5Scope>
  );
}

/* ---------- 7.2 Difficulté et « Pourquoi ? » ---------- */

export function DifficultyBlock({ analysis, expert }: { analysis: Analysis; expert: boolean }) {
  const d = analysis.difficulty;
  const prov = analysis.difficultyProvenance;
  if (d.status === 'unknown') {
    return (
      <V5Scope>
        <RouteRows testId="difficulty">
          <RouteRow icon="climb" title="Difficulté" subtitle={d.reason} value="Inconnue" state="unknown" provenance={prov} valueId="difficulty" testId="difficulty-unknown" />
        </RouteRows>
      </V5Scope>
    );
  }
  return (
    <V5Scope>
      <RouteRows testId="difficulty">
        <RouteRow
          icon="climb"
          title="Difficulté"
          subtitle={d.levelLabel}
          value={`${d.level} / 5`}
          provenance={prov}
          valueId="difficulty"
          testId="difficulty-level"
        />
      </RouteRows>
      <details className="rcw-why" data-testid="difficulty-why">
        <summary>Pourquoi ?</summary>
        <Sourced id="difficulty-why" provenance={prov} expert={expert}>
          <p className="rcw-sub-note">{d.why}</p>
          <ol className="rcw-factors">
            {d.top3.map((f) => (
              <li key={f.id} data-factor={f.id}>
                <span>{f.label}</span>
                <b className="v5-num">{f.valueText}</b>
                <small>{f.sharePct} % du temps</small>
              </li>
            ))}
          </ol>
          {expert ? <small className="rcw-expert-note">{d.method}</small> : null}
          {d.notes.length > 0 ? (
            <ul className="rcw-sub-note">
              {d.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </Sourced>
      </details>
    </V5Scope>
  );
}

/* ---------- 7.3 Profil : pentes colorées, montées classées, altitude absente dite ---------- */

const BAND_ORDER: SlopeBand[] = ['plat', 'modere', 'soutenu', 'raide', 'inconnu'];

export function ProfileBlock({
  analysis,
  expert,
  onHoverKm,
  onFocusKm,
}: {
  analysis: Analysis;
  expert: boolean;
  onHoverKm: (km: number | null) => void;
  onFocusKm: (km: number) => void;
}) {
  const { slopes, slopeShares, gaps, climbs, profileProvenance } = analysis;
  const total = slopes.length > 0 ? slopes[slopes.length - 1].toKm : 0;
  const moveOver = (ev: PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    if (r.width <= 0 || total <= 0) return;
    onHoverKm(Math.max(0, Math.min(total, ((ev.clientX - r.left) / r.width) * total)));
  };
  const shownClimbs = expert ? climbs.climbs : climbs.climbs.slice(0, 3);
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="profile-block">
        {total > 0 ? (
          <Sourced id="slopes" provenance={profileProvenance} expert={expert}>
            <Cap>Pentes</Cap>
            <div
              className="rcw-slopes"
              role="img"
              aria-label="Pentes le long du tracé, du plus plat au plus raide ; survol pour situer le point sur la carte"
              data-testid="slope-strip"
              onPointerMove={moveOver}
              onPointerLeave={() => onHoverKm(null)}
            >
              {slopes.map((s, i) => (
                <i key={i} data-band={s.band} style={{ width: `${((s.toKm - s.fromKm) / total) * 100}%` }} />
              ))}
            </div>
            <ul className="rcw-legend" data-testid="slope-legend">
              {BAND_ORDER.filter((b) => slopeShares[b] > 0).map((b) => (
                <li key={b} data-band={b}>
                  <i aria-hidden="true" data-band={b} />
                  {SLOPE_BAND_LABEL[b]} · {slopeShares[b]} %
                </li>
              ))}
            </ul>
          </Sourced>
        ) : null}

        {gaps.length > 0 ? (
          <Sourced id="elevation-gaps" provenance={profileProvenance} expert={expert}>
            <ul className="rcw-gaps" data-testid="elevation-gaps">
              {gaps.map((g, i) => (
                <li key={i}>
                  <button type="button" className="rcw-link" onClick={() => onFocusKm(g.fromKm)}>
                    Altitude inconnue du km {nf1.format(g.fromKm)} au km {nf1.format(g.toKm)}
                    {g.day != null ? ` (jour ${g.day})` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </Sourced>
        ) : null}

        <Cap right={climbs.climbs.length > 0 ? `${climbs.climbs.length}` : undefined}>Montées classées</Cap>
        {shownClimbs.length === 0 ? (
          <Sourced id="climbs-none" provenance={profileProvenance} expert={expert}>
            <p className="rcw-sub-note" data-testid="climbs-none">{climbs.message ?? 'Aucune montée notable relevée.'}</p>
          </Sourced>
        ) : (
          <RouteRows testId="climbs">
            {shownClimbs.map((c) => (
              <RouteRow
                key={c.id}
                icon="peak"
                title={`${c.rank}. ${c.categoryLabel}`}
                subtitle={`km ${nf1.format(c.fromKm)} à ${nf1.format(c.toKm)}${c.day != null ? ` · jour ${c.day}` : ''} · pente moyenne ${nf1.format(c.avgGradePct)} % (max ${nf1.format(c.maxGradePct)} %)`}
                value={`+${fmtMeters(c.gainM)}`}
                provenance={profileProvenance}
                valueId={`climb-${c.rank}`}
                testId={`climb-${c.rank}`}
                onClick={() => onFocusKm(c.fromKm)}
                ariaLabel={`Montée ${c.rank}, voir sur la carte`}
              />
            ))}
          </RouteRows>
        )}
        {!expert && climbs.climbs.length > shownClimbs.length ? (
          <p className="rcw-sub-note">Les {climbs.climbs.length - shownClimbs.length} autres montées sont en vue experte.</p>
        ) : null}
      </div>
    </V5Scope>
  );
}

/* ---------- 7.7 Surfaces en pourcentage (expert) ---------- */

const SURFACE_LABEL = { goudron: 'Goudron', piste: 'Piste', sentier: 'Sentier', inconnu: 'Inconnu' } as const;

export function SurfacesBlock({ analysis, expert }: { analysis: Analysis; expert: boolean }) {
  const o = analysis.surfaces.overall;
  if (!expert) return null;
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="surfaces-block">
        <Cap>Surfaces</Cap>
        {o.pct == null ? (
          <Sourced id="surfaces" provenance={analysis.surfaceProvenance} expert={expert}>
            <p className="rcw-sub-note">Tracé absent : aucune surface à lire.</p>
          </Sourced>
        ) : (
          <>
            <Sourced id="surfaces" provenance={analysis.surfaceProvenance} expert={expert}>
              <div className="rcw-slopes" role="img" aria-label="Part de chaque surface sur le tracé" data-testid="surface-strip">
                {(Object.keys(SURFACE_LABEL) as (keyof typeof SURFACE_LABEL)[]).map((k) => (
                  <i key={k} data-surface={k} style={{ width: `${o.pct?.[k] ?? 0}%` }} />
                ))}
              </div>
              <small className="rcw-expert-note">{o.method}</small>
            </Sourced>
            <RouteRows testId="surface-rows">
              {(Object.keys(SURFACE_LABEL) as (keyof typeof SURFACE_LABEL)[]).map((k) => (
                <RouteRow
                  key={k}
                  icon="route"
                  title={SURFACE_LABEL[k]}
                  subtitle={fmtKm(o.km[k])}
                  value={`${nf1.format(o.pct?.[k] ?? 0)} %`}
                  state={k === 'inconnu' && (o.pct?.inconnu ?? 0) > 0 ? 'unknown' : undefined}
                  provenance={analysis.surfaceProvenance}
                  valueId={`surface-${k}`}
                  testId={`surface-${k}`}
                />
              ))}
            </RouteRows>
          </>
        )}
      </div>
    </V5Scope>
  );
}

/* ---------- 7.4 Météo au point et à l'heure de passage ---------- */

function weatherLine(w: Analysis['weather'][number]): string {
  if (w.status !== 'ok') return 'Inconnue';
  const parts = [
    w.tempC != null ? `${Math.round(w.tempC)} °C` : null,
    w.windKmh != null ? `vent ${Math.round(w.windKmh)} km/h` : null,
    w.precipPct != null ? `pluie ${Math.round(w.precipPct)} %` : w.precipMm != null ? `${nf1.format(w.precipMm)} mm` : null,
  ].filter((p): p is string => p != null);
  return parts.length > 0 ? parts.join(' · ') : 'Inconnue';
}

export function WeatherBlock({
  analysis,
  remote,
  expert,
  dayLabel,
  onReload,
}: {
  analysis: Analysis;
  remote: AnalyseRemote;
  expert: boolean;
  dayLabel: (day: number) => string;
  onReload: () => void;
}) {
  const rows = analysis.weather;
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="weather-block">
        <Cap
          right={
            <Chip onClick={onReload} disabled={remote.status === 'loading'} aria-label="Actualiser la météo">
              {remote.status === 'loading' ? 'Lecture…' : 'Actualiser'}
            </Chip>
          }
        >
          Météo au passage
        </Cap>
        {remote.fetchedAt ? (
          <p className="rcw-sub-note" data-testid="weather-meta">
            Relevé MET Norway le {when(remote.fetchedAt)}
            {remote.horizon ? ` · prévision jusqu’au ${formatProvenanceDate(`${remote.horizon}T00:00:00Z`)}` : ''}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="rcw-sub-note" data-testid="weather-empty">
            {remote.status === 'error'
              ? 'Météo indisponible : la source n’a pas répondu.'
              : remote.status === 'loading'
                ? 'Lecture de la météo…'
                : 'Aucune journée datée : renseignez la date de chaque étape pour lire la météo à l’heure de passage.'}
          </p>
        ) : (
          <RouteRows testId="weather-rows">
            {rows.map((w) => (
              <RouteRow
                key={w.day}
                icon={w.status === 'ok' && (w.precipPct ?? 0) >= 50 ? 'rain' : 'cloudsun'}
                title={dayLabel(w.day)}
                subtitle={
                  w.status === 'ok'
                    ? `à ${w.passageLocal}, ${w.basis === 'midday' ? 'milieu de journée' : 'heure de départ'}${w.approximate ? ` · créneau voisin (±${Math.round((w.deltaMin ?? 0) / 60)} h)` : ''}${expert && w.hourLocal ? ` · prévision de ${w.hourLocal.slice(11, 16)}` : ''}`
                    : (w.reason ?? 'Aucune prévision')
                }
                value={weatherLine(w)}
                state={w.status === 'ok' ? undefined : 'unknown'}
                provenance={w.provenance}
                valueId={`weather-day-${w.day}`}
                testId={`weather-day-${w.day}`}
              />
            ))}
          </RouteRows>
        )}
        {expert ? <small className="rcw-expert-note">Heure choisie : la prévision la plus proche de l’heure de passage ; MET Norway passe au pas de 6 h au-delà de 2,5 jours. Licence CC BY 4.0.</small> : null}
      </div>
    </V5Scope>
  );
}

/* ---------- 7.8 Lumière du jour ---------- */

export function DaylightBlock({ analysis, expert, dayLabel }: { analysis: Analysis; expert: boolean; dayLabel: (day: number) => string }) {
  if (analysis.daylight.length === 0) return null;
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="daylight-block">
        <Cap>Lumière du jour</Cap>
        <RouteRows testId="daylight-rows">
          {analysis.daylight.map((d) => {
            const known = d.marginMin != null;
            return (
              <RouteRow
                key={d.stageId}
                icon="sun"
                title={dayLabel(d.day)}
                subtitle={
                  d.sunriseLocal || d.sunsetLocal
                    ? `lever ${d.sunriseLocal ?? '?'} · coucher ${d.sunsetLocal ?? '?'}${d.arrivalLocal ? ` · arrivée ${d.arrivalLocal}` : ''}${expert ? ' · NOAA, sans relief' : ''}`
                    : (d.reason ?? 'Lever et coucher inconnus')
                }
                value={known ? (d.late ? `${fmtDuration(Math.abs(d.marginMin as number))} après le coucher` : `marge ${fmtDuration(d.marginMin as number)}`) : (d.reason ?? 'Inconnue')}
                state={d.late ? 'to_check' : known ? undefined : 'unknown'}
                provenance={d.provenance}
                valueId={`daylight-day-${d.day}`}
                testId={`daylight-day-${d.day}`}
              />
            );
          })}
        </RouteRows>
      </div>
    </V5Scope>
  );
}

/* ---------- 7.5 Eau en trois niveaux ---------- */

function waterSubtitle(w: DayWater): string {
  const { mapped, potability_declared: declared, confirmed_recent: confirmed } = w.counts;
  if (w.rows.length === 0) return 'Aucun point d’eau relevé ou déclaré';
  return `${mapped} cartographié${mapped > 1 ? 's' : ''} · ${declared} potabilité déclarée · ${confirmed} confirmé${confirmed > 1 ? 's' : ''} récemment`;
}

export function WaterBlock({
  analysis,
  expert,
  dayLabel,
  anyLoaded,
  onLoad,
}: {
  analysis: Analysis;
  expert: boolean;
  dayLabel: (day: number) => string;
  anyLoaded: boolean;
  onLoad: () => void;
}) {
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="water-block">
        <Cap right={!anyLoaded ? <Chip onClick={onLoad}>Relever l’eau</Chip> : undefined}>Eau</Cap>
        <p className="rcw-sub-note">Une fontaine cartographiée ne prouve pas que l’eau coule : seuls les niveaux « potabilité déclarée » et « confirmée récemment » vont plus loin.</p>
        {analysis.water.length === 0 ? (
          <p className="rcw-sub-note">Aucune étape à lire.</p>
        ) : (
          <RouteRows testId="water-rows">
            {analysis.water.map((w) => (
              <RouteRow
                key={w.stageId}
                icon="drop"
                title={dayLabel(w.day)}
                subtitle={`${waterSubtitle(w)}${w.gap.status === 'known' && w.gap.fromLabel ? ` · le plus long tronçon sec : ${w.gap.fromLabel} → ${w.gap.toLabel}` : ''}`}
                value={w.gap.status === 'known' && w.gap.gapKm != null ? `${nf1.format(w.gap.gapKm)} km sans eau` : 'Inconnue'}
                state={w.gap.status === 'known' ? undefined : 'unknown'}
                provenance={w.provenance}
                valueId={`water-day-${w.day}`}
                testId={`water-day-${w.day}`}
              />
            ))}
          </RouteRows>
        )}
        {expert
          ? analysis.water.flatMap((w) =>
              w.rows.map((r) => (
                <Sourced key={`${w.stageId}-${r.observation.id}`} id={`water-obs-${r.observation.id}`} provenance={{ source: r.observation.source === 'osm' ? 'OpenStreetMap' : 'Déclaré', at: r.observation.observedAt }} expert={expert}>
                  <small className="rcw-water-row" data-level={r.evidence.level}>
                    Jour {w.day} · {r.observation.name} · {r.evidence.label}
                    {r.evidence.reportedDry ? ' · signalée à sec' : ''}
                    {r.evidence.ageDays != null ? ` · il y a ${r.evidence.ageDays} j` : ''}
                  </small>
                </Sourced>
              )),
            )
          : null}
      </div>
    </V5Scope>
  );
}

/* ---------- 7.6 Alertes officielles datées ---------- */

export function AlertsBlock({ analysis, expert, fireStatus }: { analysis: Analysis; expert: boolean; fireStatus: AnalyseRemote['status'] }) {
  const a = analysis.alerts;
  return (
    <V5Scope>
      <div className="rcw-block" data-testid="alerts-block">
        <Cap right={a.active.length > 0 ? `${a.active.length}` : undefined}>Alertes</Cap>
        {a.alerts.length === 0 ? (
          <Sourced id="alerts-none" provenance={unknownAt('Alertes déclarées sur les étapes')} expert={expert}>
            <p className="rcw-sub-note" data-testid="alerts-none">
              {fireStatus === 'loading' ? 'Lecture des alertes…' : 'Aucune alerte déclarée sur les étapes.'}
            </p>
          </Sourced>
        ) : (
          <RouteRows testId="alerts-rows">
            {a.alerts.map((x) => (
              <RouteRow
                key={x.id}
                icon={x.kind === 'fire' ? 'spark' : x.kind === 'vigilance' ? 'wind' : 'bell'}
                title={x.title}
                subtitle={`${ALERT_KIND_LABEL[x.kind]}${x.day != null ? ` · jour ${x.day}` : ''} · ${x.source} · relevé ${x.observedAt ? formatProvenanceDate(x.observedAt) : UNKNOWN_DATE}${x.detail && expert ? ` · ${x.detail}` : ''}`}
                value={x.expired ? 'Expirée' : x.validUntil ? `valide jusqu’au ${formatProvenanceDate(x.validUntil)}` : 'fin de validité inconnue'}
                state={x.expired ? undefined : 'to_check'}
                provenance={{ source: x.source, at: x.observedAt }}
                valueId={`alert-${x.id}`}
                testId={`alert-${x.id}`}
              />
            ))}
          </RouteRows>
        )}
        {a.gaps.map((g) => (
          <p key={g} className="rcw-sub-note" data-testid="alerts-gap">{g}</p>
        ))}
      </div>
    </V5Scope>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rcw-analyse-section" aria-label={title}>
      {children}
    </section>
  );
}
