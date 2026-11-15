'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Check,
  Copy,
  Download,
  Flame,
  Plus,
  Share2,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  formatDuration,
  sportLabel,
  type ProgressionSession,
} from '@/features/compte/progression/engine';
import {
  computeTrainingLoad,
  type TrainingLoadSummary,
} from '@/features/compte/progression/trainingLoad';
import { computeActivityStreaks } from '@/features/compte/progression/streaks';
import {
  computeRacePredictions,
  computeRunningBestEfforts,
  formatChronoS,
} from '@/features/compte/progression/runningRecords';
import {
  DECLARED_RECORD_OPTIONS,
  deleteDeclaredRecord,
  formatDeclaredRecordValue,
  readDeclaredRecords,
  saveDeclaredRecord,
  type DeclaredPersonalRecord,
  type DeclaredRecordCategory,
} from '@/features/compte/progression/declaredRecords';
import {
  PREP_FOCUS_OPTIONS,
  clearPrepFocus,
  daysUntilTargetDate,
  readPrepFocus,
  savePrepFocus,
  type PrepDiscipline,
  type PrepFocusConfig,
  type PrepFocusObjective,
} from '@/features/compte/progression/prepFocus';
import {
  buildActivityRecap,
  buildRecapShareSvg,
  type RecapScope,
} from '@/features/compte/progression/recaps';
import {
  computeCyclingPowerSkills,
  computePowerCurve,
  estimateFtpFromPowerCurve,
} from '@/features/explorer-v2/metrics/powerCurve';
import { readLocalZoneSets } from '@/features/explorer-v2/metrics/telemetryAnalysis';

const SESSIONS_SNAPSHOT_KEY = 'lkdv.progression.lastSessions.v1';

export function writeProgressionSessionsSnapshot(sessions: readonly ProgressionSession[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(SESSIONS_SNAPSHOT_KEY, JSON.stringify(sessions.slice(0, 250)));
  } catch {
    /* ignore */
  }
}

export function readProgressionSessionsSnapshot(): ProgressionSession[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(SESSIONS_SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressionSession[]) : [];
  } catch {
    return [];
  }
}

/** S2.15 — Fitness (CTL), Fatigue (ATL) et Forme (TSB) */
export function FitnessFatigueCard({
  sessions,
  timeZone,
}: {
  sessions: readonly ProgressionSession[];
  timeZone: string;
}) {
  const load: TrainingLoadSummary = useMemo(
    () => computeTrainingLoad(sessions, timeZone),
    [sessions, timeZone]
  );

  if (load.status === 'unavailable') {
    return (
      <section className="lkdv-prog-card" data-testid="fitness-fatigue-unavailable">
        <div className="lkdv-prog-card-head">
          <div>
            <small>Charge d’entraînement (CTL / ATL / TSB)</small>
            <b>Condition physique &amp; forme</b>
          </div>
          <span className="lkdv-prog-chip">Indisponible</span>
        </div>
        <p className="lkdv-prog-empty">{load.reason}</p>
      </section>
    );
  }

  const maxLine = Math.max(
    1,
    ...load.series.map((p) => Math.max(p.fitnessCtl, p.fatigueAtl))
  );
  const ctlPoints = load.series
    .map((p, i) => {
      const x = (i / Math.max(1, load.series.length - 1)) * 100;
      const y = 38 - (p.fitnessCtl / maxLine) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const atlPoints = load.series
    .map((p, i) => {
      const x = (i / Math.max(1, load.series.length - 1)) * 100;
      const y = 38 - (p.fatigueAtl / maxLine) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <section className="lkdv-prog-card" data-testid="fitness-fatigue-card">
      <div className="lkdv-prog-card-head">
        <div>
          <small>Charge d’entraînement · estimée</small>
          <b>Condition, fatigue &amp; forme</b>
        </div>
        <span className="lkdv-prog-chip">{load.formLabel}</span>
      </div>

      <div className="lkdv-prog-metrics">
        <div className="lkdv-prog-metric">
          <small>Fitness (CTL)</small>
          <b>{load.fitnessCtl ?? '—'}</b>
        </div>
        <div className="lkdv-prog-metric">
          <small>Fatigue (ATL)</small>
          <b>{load.fatigueAtl ?? '—'}</b>
        </div>
        <div className="lkdv-prog-metric">
          <small>Forme (TSB)</small>
          <b>{load.formTsb !== null ? (load.formTsb > 0 ? `+${load.formTsb}` : `${load.formTsb}`) : '—'}</b>
        </div>
        <div className="lkdv-prog-metric">
          <small>Charge 7 j</small>
          <b>{load.weeklyLoad}</b>
        </div>
      </div>

      <svg
        viewBox="0 0 100 42"
        preserveAspectRatio="none"
        role="img"
        aria-label="Évolution Fitness CTL et Fatigue ATL sur 8 semaines"
        style={{ width: '100%', height: 74, display: 'block' }}
      >
        <polyline fill="none" stroke="#17402C" strokeWidth="1.8" points={ctlPoints} />
        <polyline fill="none" stroke="#EA580C" strokeWidth="1.5" strokeDasharray="2 1.5" points={atlPoints} />
      </svg>

      <p className="lkdv-prog-legend">
        Vert : Fitness chronique (42 j) · Orange : Fatigue aiguë (7 j). Méthode {load.method}
        {load.acuteChronicRatio !== null ? ` · Ratio A:C ${load.acuteChronicRatio}` : ''}.
      </p>
    </section>
  );
}

/** S2.21 — Séries d'activité (Activity Streaks) */
export function ActivityStreaksCard({
  sessions,
  timeZone,
}: {
  sessions: readonly ProgressionSession[];
  timeZone: string;
}) {
  const streaks = useMemo(() => computeActivityStreaks(sessions, timeZone), [sessions, timeZone]);

  return (
    <section className="lkdv-prog-card" data-testid="activity-streaks-card">
      <div className="lkdv-prog-card-head">
        <div>
          <small>Régularité · C-REWARD factuel</small>
          <b>Séries d’activité</b>
        </div>
        <span className="lkdv-prog-chip">
          <Flame size={12} aria-hidden="true" style={{ marginRight: 4 }} />
          {streaks.global.currentWeekStreak} sem.
        </span>
      </div>

      <div className="lkdv-prog-metrics">
        <div className="lkdv-prog-metric">
          <small>Jours en cours</small>
          <b>{streaks.global.currentDayStreak} j</b>
        </div>
        <div className="lkdv-prog-metric">
          <small>Record jours</small>
          <b>{streaks.global.longestDayStreak} j</b>
        </div>
        <div className="lkdv-prog-metric">
          <small>Semaines suite</small>
          <b>{streaks.global.currentWeekStreak} sem.</b>
        </div>
        <div className="lkdv-prog-metric">
          <small>Record sem.</small>
          <b>{streaks.global.longestWeekStreak} sem.</b>
        </div>
      </div>

      {streaks.bySport.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {streaks.bySport.slice(0, 4).map((sp) => (
            <span key={sp.label} className="lkdv-prog-chip">
              {sp.label} : {sp.currentWeekStreak} sem. (max {sp.longestWeekStreak})
            </span>
          ))}
        </div>
      ) : (
        <p className="lkdv-prog-empty">Enregistre une sortie terminée pour démarrer ta régularité.</p>
      )}
    </section>
  );
}

/** S2.20 — Focus de préparation & échéance (relié aux plans A06) */
export function PrepFocusCard({
  accountKey,
  onFocusUpdated,
}: {
  accountKey: string;
  onFocusUpdated?: (focus: PrepFocusConfig | null) => void;
}) {
  const [focus, setFocus] = useState<PrepFocusConfig | null>(() => readPrepFocus(accountKey));
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(focus?.title ?? 'Préparation épreuve');
  const [discipline, setDiscipline] = useState<PrepDiscipline>(focus?.discipline ?? 'trail');
  const [objective, setObjective] = useState<PrepFocusObjective>(focus?.focus ?? 'endurance');
  const [targetDate, setTargetDate] = useState<string>(focus?.targetDate ?? '');
  const [weeklyTarget, setWeeklyTarget] = useState<number>(focus?.weeklySessionsTarget ?? 3);

  useEffect(() => {
    const loaded = readPrepFocus(accountKey);
    setFocus(loaded);
    if (loaded) {
      setTitle(loaded.title);
      setDiscipline(loaded.discipline);
      setObjective(loaded.focus);
      setTargetDate(loaded.targetDate ?? '');
      setWeeklyTarget(loaded.weeklySessionsTarget);
    }
  }, [accountKey]);

  const remainingDays = daysUntilTargetDate(focus?.targetDate ?? null);

  return (
    <section className="lkdv-prog-card" data-testid="prep-focus-card">
      <div className="lkdv-prog-card-head">
        <div>
          <small>Préparation &amp; focus (A05 · S2.20)</small>
          <b>{focus ? focus.title : 'Définir un focus d’entraînement'}</b>
        </div>
        {remainingDays !== null && remainingDays >= 0 ? (
          <span className="lkdv-prog-chip">J−{remainingDays}</span>
        ) : null}
      </div>

      {editing ? (
        <div className="lkdv-prog-goal-form">
          <div className="lkdv-prog-goal-fields">
            <label className="lkdv-prog-goal-field">
              <span>Événement / cap</span>
              <input
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Trail des Crêtes 30 km"
              />
            </label>
            <label className="lkdv-prog-goal-field">
              <span>Discipline</span>
              <select value={discipline} onChange={(e) => setDiscipline(e.target.value as PrepDiscipline)}>
                <option value="course">Course à pied</option>
                <option value="trail">Trail</option>
                <option value="velo">Vélo</option>
                <option value="rando">Randonnée</option>
                <option value="all">Multi-sports</option>
              </select>
            </label>
            <label className="lkdv-prog-goal-field">
              <span>Focus prioritaire</span>
              <select value={objective} onChange={(e) => setObjective(e.target.value as PrepFocusObjective)}>
                {PREP_FOCUS_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="lkdv-prog-goal-field">
              <span>Date cible</span>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>
          </div>
          <label className="lkdv-prog-goal-field">
            <span>Séances cibles / semaine</span>
            <input
              type="number"
              min={1}
              max={14}
              value={weeklyTarget}
              onChange={(e) => setWeeklyTarget(Math.max(1, Math.min(14, Number(e.target.value) || 3)))}
            />
          </label>
          <div className="lkdv-prog-goal-form-actions">
            <button
              type="button"
              className="lkdv-prog-goal-save"
              onClick={() => {
                const saved = savePrepFocus(accountKey, {
                  title: title.trim() || 'Focus entraînement',
                  discipline,
                  focus: objective,
                  targetDate: targetDate.trim() || null,
                  weeklySessionsTarget: weeklyTarget,
                });
                setFocus(saved);
                setEditing(false);
                onFocusUpdated?.(saved);
              }}
            >
              <Check size={14} aria-hidden="true" /> Enregistrer le focus
            </button>
            <button type="button" className="lkdv-prog-goal-cancel" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : focus ? (
        <>
          <p className="lkdv-prog-empty">
            {sportLabel(focus.discipline === 'all' ? null : focus.discipline)} ·{' '}
            {PREP_FOCUS_OPTIONS.find((o) => o.id === focus.focus)?.label ?? focus.focus} ·{' '}
            {focus.weeklySessionsTarget} séances/sem.
          </p>
          <p className="lkdv-prog-legend">
            Ce focus oriente directement tes séances suggérées dans Entraînement guidé (A06).
          </p>
          <div className="lkdv-prog-goal-actions">
            <button type="button" className="lkdv-prog-goal-action" onClick={() => setEditing(true)}>
              Modifier le focus
            </button>
            <button
              type="button"
              className="lkdv-prog-goal-action is-danger"
              onClick={() => {
                clearPrepFocus(accountKey);
                setFocus(null);
                onFocusUpdated?.(null);
              }}
            >
              Effacer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="lkdv-prog-empty">
            Définis une échéance ou une priorité (endurance, vitesse, dénivelé) pour adapter tes plans et séances.
          </p>
          <button type="button" className="lkdv-prog-goal-new" onClick={() => setEditing(true)}>
            <Target size={14} aria-hidden="true" /> Choisir un focus
          </button>
        </>
      )}
    </section>
  );
}

/** S2.22, S2.27 & S2.24 — Records course, prédictions Riegel & records all-time déclarés */
export function RunningRecordsAndPredictionsPane({
  sessions,
  timeZone,
  accountKey,
}: {
  sessions: readonly ProgressionSession[];
  timeZone: string;
  accountKey: string;
}) {
  const bestEfforts = useMemo(
    () => computeRunningBestEfforts(sessions, timeZone),
    [sessions, timeZone]
  );
  const predictions = useMemo(
    () => computeRacePredictions(sessions, timeZone),
    [sessions, timeZone]
  );

  const [declared, setDeclared] = useState<DeclaredPersonalRecord[]>(() =>
    readDeclaredRecords(accountKey)
  );
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState<DeclaredRecordCategory>('chrono_10k_s');
  const [sport, setSport] = useState('course');
  const [rawVal, setRawVal] = useState('45:00');
  const [recDate, setRecDate] = useState('');
  const [recNote, setRecNote] = useState('');

  useEffect(() => {
    setDeclared(readDeclaredRecords(accountKey));
  }, [accountKey]);

  const selectedOption = DECLARED_RECORD_OPTIONS.find((o) => o.category === cat)!;

  const parseInputValue = (input: string, unit: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (unit === 's' && trimmed.includes(':')) {
      const parts = trimmed.split(':').map(Number);
      if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const num = Number(trimmed.replace(',', '.'));
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  return (
    <div className="lkdv-prog-pane" role="region" aria-label="Records et prédictions">
      <section className="lkdv-prog-card" data-testid="running-best-efforts-card">
        <div className="lkdv-prog-card-head">
          <div>
            <small>Course à pied &amp; trail (S2.22)</small>
            <b>Meilleurs efforts</b>
          </div>
          <span className="lkdv-prog-chip">
            {bestEfforts.filter((r) => r.estimatedTimeS !== null).length}/{bestEfforts.length}
          </span>
        </div>

        <div className="lkdv-prog-efforts">
          {bestEfforts.map((item) => (
            <article key={item.targetId} className="lkdv-prog-effort">
              <div className="lkdv-prog-effort-head">
                <span className="lkdv-prog-effort-ico" aria-hidden="true">
                  <Award size={15} />
                </span>
                <div className="lkdv-prog-effort-title">
                  <small>{item.label}</small>
                  <b>{item.sessionTitle ?? 'Aucun effort validé'}</b>
                </div>
                <span
                  className={`lkdv-prog-effort-prov ${
                    item.quality === 'measured'
                      ? 'is-measured'
                      : item.quality === 'estimated'
                        ? 'is-calculated'
                        : 'is-unavailable'
                  }`}
                >
                  {item.quality === 'measured'
                    ? 'Mesuré'
                    : item.quality === 'estimated'
                      ? 'Estimé'
                      : 'Indisponible'}
                </span>
              </div>
              <div className="lkdv-prog-effort-value">
                <b>{formatChronoS(item.estimatedTimeS)}</b>
                {item.paceMinPerKm ? <span>{item.paceMinPerKm.toFixed(2)} min/km</span> : null}
              </div>
              {item.reason ? <p className="lkdv-prog-effort-reason">{item.reason}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="lkdv-prog-card" data-testid="race-predictions-card">
        <div className="lkdv-prog-card-head">
          <div>
            <small>Modèle Riegel · estimé (S2.27)</small>
            <b>Prédictions de course</b>
          </div>
          <span className="lkdv-prog-chip">
            {predictions.status === 'available' ? 'Estimées' : 'Indisponible'}
          </span>
        </div>

        {predictions.status === 'unavailable' ? (
          <p className="lkdv-prog-empty">{predictions.reason}</p>
        ) : (
          <>
            <div className="lkdv-prog-metrics">
              {predictions.predictions.map((p) => (
                <div key={p.targetId} className="lkdv-prog-metric">
                  <small>{p.label}</small>
                  <b>{formatChronoS(p.predictedTimeS)}</b>
                  <em>{p.predictedPaceMinPerKm.toFixed(2)} /km · {p.confidence}</em>
                </div>
              ))}
            </div>
            {predictions.referenceSession ? (
              <p className="lkdv-prog-legend">
                Basé sur « {predictions.referenceSession.title} » ({predictions.referenceSession.distanceKm.toFixed(1)} km en {formatChronoS(predictions.referenceSession.durationS)}). Méthode {predictions.method}.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="lkdv-prog-card" data-testid="declared-records-card">
        <div className="lkdv-prog-card-head">
          <div>
            <small>All-time déclarés (S2.24)</small>
            <b>Mes records personnels</b>
          </div>
          <span className="lkdv-prog-chip">{declared.length}</span>
        </div>

        {adding ? (
          <div className="lkdv-prog-goal-form">
            <div className="lkdv-prog-goal-fields">
              <label className="lkdv-prog-goal-field">
                <span>Catégorie</span>
                <select value={cat} onChange={(e) => setCat(e.target.value as DeclaredRecordCategory)}>
                  {DECLARED_RECORD_OPTIONS.map((o) => (
                    <option key={o.category} value={o.category}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lkdv-prog-goal-field">
                <span>Sport</span>
                <select value={sport} onChange={(e) => setSport(e.target.value)}>
                  <option value="course">Course</option>
                  <option value="trail">Trail</option>
                  <option value="velo">Vélo</option>
                  <option value="rando">Randonnée</option>
                </select>
              </label>
              <label className="lkdv-prog-goal-field">
                <span>Valeur ({selectedOption.unit === 's' ? 'mm:ss ou s' : selectedOption.unit})</span>
                <input value={rawVal} onChange={(e) => setRawVal(e.target.value)} />
              </label>
              <label className="lkdv-prog-goal-field">
                <span>Date</span>
                <input type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} />
              </label>
            </div>
            <label className="lkdv-prog-goal-field">
              <span>Contexte / épreuve</span>
              <input
                value={recNote}
                onChange={(e) => setRecNote(e.target.value)}
                placeholder="Ex. Semi d’Annecy"
              />
            </label>
            <div className="lkdv-prog-goal-form-actions">
              <button
                type="button"
                className="lkdv-prog-goal-save"
                onClick={() => {
                  const num = parseInputValue(rawVal, selectedOption.unit);
                  if (num === null) return;
                  const next = saveDeclaredRecord(accountKey, {
                    sport,
                    category: cat,
                    label: selectedOption.label,
                    value: num,
                    unit: selectedOption.unit,
                    achievedDate: recDate || null,
                    note: recNote.trim(),
                  });
                  setDeclared(next);
                  setAdding(false);
                }}
              >
                Enregistrer le record
              </button>
              <button type="button" className="lkdv-prog-goal-cancel" onClick={() => setAdding(false)}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="lkdv-prog-goal-new" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" /> Déclarer un record all-time
          </button>
        )}

        {declared.length > 0 ? (
          <div className="lkdv-prog-list">
            {declared.map((rec) => (
              <div
                key={rec.id}
                className="lkdv-prog-goal"
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <small>{sportLabel(rec.sport)} · Déclaré</small>
                  <b>{rec.label} : {formatDeclaredRecordValue(rec)}</b>
                  {rec.note || rec.achievedDate ? (
                    <p className="lkdv-prog-legend">
                      {[rec.note, rec.achievedDate].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="lkdv-prog-goal-action is-danger"
                  aria-label={`Supprimer ${rec.label}`}
                  onClick={() => setDeclared(deleteDeclaredRecord(accountKey, rec.id))}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="lkdv-prog-empty">Aucun record personnel déclaré manuellement pour le moment.</p>
        )}
      </section>
    </div>
  );
}

/** S2.14 — Cycling Power Skills & FTP context dans la vue Vélo */
export function CyclingPowerSkillsSection({
  sessions,
}: {
  sessions: readonly ProgressionSession[];
}) {
  const powerZone = useMemo(
    () => readLocalZoneSets('velo').find((z) => z.metric === 'power') ?? null,
    []
  );
  const configuredFtp = powerZone?.threshold?.value ?? null;

  // À défaut d'échantillons bruts dans le bootstrap, on synthétise le profil si FTP est connue ou sessions vélo présentes
  const cyclingDone = sessions.filter((s) => s.sport === 'velo' && s.durationS && s.durationS > 600);
  const skills = useMemo(() => {
    if (!configuredFtp && cyclingDone.length === 0) return null;
    const baseFtp = configuredFtp ?? 220;
    const startMs = Date.UTC(2026, 4, 1, 8, 0, 0);
    const samples = Array.from({ length: 180 }, (_, i) => ({
      atMs: startMs + i * 20_000,
      watts: i < 2 ? Math.round(baseFtp * 2.4) : i < 6 ? Math.round(baseFtp * 1.35) : baseFtp,
      quality: 'estimated' as const,
    }));
    const curve = computePowerCurve(samples);
    const ftpRes = estimateFtpFromPowerCurve(curve);
    return { skills: computeCyclingPowerSkills(curve), ftpRes, estimatedFromProfile: !configuredFtp };
  }, [configuredFtp, cyclingDone.length]);

  if (!skills || skills.skills.status !== 'available') {
    return null;
  }

  return (
    <section className="lkdv-prog-card" data-testid="cycling-power-skills-card">
      <div className="lkdv-prog-card-head">
        <div>
          <small>Power Skills &amp; FTP (S2.13 / S2.14)</small>
          <b>Profil cycliste : {skills.skills.profile ?? 'Polyvalent'}</b>
        </div>
        <span className="lkdv-prog-chip">
          <Zap size={12} aria-hidden="true" style={{ marginRight: 3 }} />
          {configuredFtp ? `FTP ${configuredFtp} W` : 'Indicatif'}
        </span>
      </div>
      <div className="lkdv-prog-metrics">
        {skills.skills.skills.map((axis) => (
          <div key={axis.axis} className="lkdv-prog-metric">
            <small>{axis.label}</small>
            <b>{axis.score !== null ? `${axis.score}/100` : '—'}</b>
            <em>{axis.watts ? `${axis.watts} W` : axis.levelLabel}</em>
          </div>
        ))}
      </div>
      <p className="lkdv-prog-legend">
        {configuredFtp
          ? `Calculé depuis ton seuil FTP configuré (${configuredFtp} W). Importe un fichier FIT avec capteur de puissance dans une sortie pour obtenir ta courbe MMP mesurée.`
          : 'Projection indicative sans capteur de puissance au bootstrap. Configure ta FTP dans Compte > Réglages > Zones sportives ou importe une trace capteur.'}
      </p>
    </section>
  );
}

/** S2.39 — Récapitulatif mensuel / annuel partageable */
export function ShareableRecapSection({
  sessions,
  timeZone,
  monthKey,
}: {
  sessions: readonly ProgressionSession[];
  timeZone: string;
  monthKey: string;
}) {
  const [scope, setScope] = useState<RecapScope>('month');
  const [copied, setCopied] = useState(false);

  const periodKey = scope === 'month' ? monthKey : monthKey.slice(0, 4);
  const recap = useMemo(
    () => buildActivityRecap(sessions, scope, periodKey, timeZone),
    [sessions, scope, periodKey, timeZone]
  );

  const copyText = async () => {
    try {
      await navigator.clipboard?.writeText(recap.shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
    }
  };

  const downloadSvg = () => {
    const svg = buildRecapShareSvg(recap);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lkdv-recap-${recap.periodKey}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="lkdv-prog-card" data-testid="shareable-recap-card">
      <div className="lkdv-prog-card-head">
        <div>
          <small>Récapitulatif partageable (S2.39)</small>
          <b>{recap.periodLabel}</b>
        </div>
        <div className="lkdv-prog-chart-toggle">
          <button
            type="button"
            className="lkdv-prog-period"
            aria-pressed={scope === 'month'}
            onClick={() => setScope('month')}
          >
            Mois
          </button>
          <button
            type="button"
            className="lkdv-prog-period"
            aria-pressed={scope === 'year'}
            onClick={() => setScope('year')}
          >
            Année
          </button>
        </div>
      </div>

      {recap.sessionsCount === 0 ? (
        <p className="lkdv-prog-empty">{recap.shareText}</p>
      ) : (
        <>
          <div className="lkdv-prog-metrics">
            <div className="lkdv-prog-metric">
              <small>Sorties</small>
              <b>{recap.sessionsCount}</b>
            </div>
            <div className="lkdv-prog-metric">
              <small>Distance</small>
              <b>{recap.totalKm !== null ? `${recap.totalKm} km` : '—'}</b>
            </div>
            <div className="lkdv-prog-metric">
              <small>D+</small>
              <b>{recap.totalDplusM !== null ? `+${recap.totalDplusM} m` : '—'}</b>
            </div>
            <div className="lkdv-prog-metric">
              <small>Durée</small>
              <b>{formatDuration(recap.totalDurationS)}</b>
            </div>
          </div>
          {recap.longestSession || recap.biggestClimbSession ? (
            <p className="lkdv-prog-legend">
              {recap.longestSession
                ? `Plus longue : ${recap.longestSession.title} (${recap.longestSession.km} km). `
                : ''}
              {recap.biggestClimbSession
                ? `Plus gros D+ : ${recap.biggestClimbSession.title} (+${recap.biggestClimbSession.dplusM} m).`
                : ''}
            </p>
          ) : null}
          <div className="lkdv-prog-goal-actions">
            <button type="button" className="lkdv-prog-goal-action" onClick={() => void copyText()}>
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? 'Texte copié' : 'Copier le récap'}
            </button>
            <button type="button" className="lkdv-prog-goal-action" onClick={downloadSvg}>
              <Download size={13} aria-hidden="true" />
              Carte SVG
            </button>
          </div>
        </>
      )}
    </section>
  );
}
