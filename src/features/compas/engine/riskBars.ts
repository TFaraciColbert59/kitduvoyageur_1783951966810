/**
 * Compas — barres de risque par axe (onglet « Risques », fonction pure).
 *
 * Règle ferme (Tony) : PAS de score unique sur 100. Trois barres, une par axe de
 * `assessDanger` (physique, technique, conjoncturel), chacune à quatre niveaux qui
 * se lisent sans la couleur : faible · modéré · élevé · non évalué. Le niveau est celui
 * que le moteur a déjà décidé à partir de ses signaux (aucun seuil nouveau ici).
 *
 * - « non évalué » n'est jamais « faible » : barre vide, hachurée, aucune source ;
 * - chaque barre cite d'où vient son niveau, avec la date : « Source : MET Norway ·
 *   12 oct. 2026 ». Un niveau modéré ou élevé cite les sources des signaux qui le
 *   fixent ; un niveau faible cite ce qui a été lu (`evidence`) ;
 * - un axe évalué en partie le dit sous la barre (« Non vérifié : … »).
 */

import type { AxisLevel, DangerAssessment, DangerAxis, DangerSeverity } from './danger';

export type RiskLevel = 'faible' | 'modere' | 'eleve' | 'non_evalue';

export const RISK_LEVEL_TEXT: Record<RiskLevel, string> = {
  faible: 'faible',
  modere: 'modéré',
  eleve: 'élevé',
  non_evalue: 'non évalué',
};

/** Segments pleins sur trois : la barre se lit au nombre de segments, pas à la teinte. */
export const RISK_SEGMENTS: Record<RiskLevel, 0 | 1 | 2 | 3> = {
  non_evalue: 0,
  faible: 1,
  modere: 2,
  eleve: 3,
};

export const RISK_AXIS_LABEL: Record<DangerAxis, string> = {
  physique: 'Physique',
  technique: 'Technique',
  conjoncturel: 'Conjoncturel',
};

export const RISK_AXES: readonly DangerAxis[] = ['physique', 'technique', 'conjoncturel'];

/** Niveau d'un axe du moteur → niveau de la barre. */
export function riskLevelOfAxis(level: AxisLevel): RiskLevel {
  switch (level) {
    case 'bloque':
      return 'eleve';
    case 'vigilance':
      return 'modere';
    case 'ok':
      return 'faible';
    default:
      return 'non_evalue';
  }
}

const SEVERITY_RANK: Record<DangerSeverity, number> = { info: 0, warn: 1, block: 2 };

const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/** « 2026-10-11 » ou « 2026-10-11T16:00:00Z » → « 11 oct. 2026 » (le jour tel qu'écrit) ; illisible : null. */
export function formatRiskDate(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${day} ${MONTHS[month - 1]} ${m[1]}`;
}

/** « Source : MET Norway · 12 oct. 2026 » (ou « du 12 oct. 2026 au 14 oct. 2026 »). */
export function sourceLine(source: string, from: string | null, to: string | null): string {
  const a = formatRiskDate(from);
  const b = formatRiskDate(to);
  const when = a && b && a !== b ? `du ${a} au ${b}` : (a ?? b ?? 'date non précisée');
  return `Source : ${source} · ${when}`;
}

export interface RiskAxisBar {
  axis: DangerAxis;
  label: string;
  level: RiskLevel;
  levelText: string;
  segments: 0 | 1 | 2 | 3;
  /** Une ligne « Source : … · date » par source ; vide pour un axe non évalué. */
  sources: string[];
  /** Pourquoi « non évalué », ou ce qui n'a pas été vérifié pour un axe évalué en partie. */
  note: string | null;
  /** Axe évalué en partie : le niveau ne vaut que pour ce qui a été mesuré. */
  inPart: boolean;
  /** Nombre de signaux de vigilance ou bloquants de l'axe (le détail est dans « Signaux du verdict »). */
  signals: number;
  /** Phrase lue par un lecteur d'écran à la place du dessin : nom, niveau, nombre de segments. */
  summary: string;
}

/**
 * Les trois barres, dans l'ordre physique · technique · conjoncturel. Sources : celles des
 * signaux qui fixent le niveau (modéré, élevé), sinon tout ce que l'évaluation a lu.
 */
export function riskBars(danger: DangerAssessment): RiskAxisBar[] {
  return RISK_AXES.map((axis): RiskAxisBar => {
    const result = danger.axes[axis];
    const level = riskLevelOfAxis(result.level);
    const own = danger.signals.filter((s) => s.axis === axis);
    const worst = own.reduce<DangerSeverity | null>(
      (w, s) => (w == null || SEVERITY_RANK[s.severity] > SEVERITY_RANK[w] ? s.severity : w),
      null
    );

    // Source -> jours couverts, dans l'ordre où le moteur les a vus.
    const bySource = new Map<string, { from: string | null; to: string | null }>();
    const add = (source: string, from: string | null, to: string | null) => {
      const seen = bySource.get(source);
      if (!seen) return void bySource.set(source, { from, to });
      if (from && (!seen.from || from < seen.from)) seen.from = from;
      if (to && (!seen.to || to > seen.to)) seen.to = to;
    };
    if (level === 'modere' || level === 'eleve') {
      for (const s of own) {
        if (s.severity !== worst) continue;
        const day = /^\d{4}-\d{2}-\d{2}/.test(s.asOf) ? s.asOf.slice(0, 10) : null;
        add(s.source, day, day);
      }
    } else if (level === 'faible') {
      for (const e of result.evidence ?? []) add(e.source, e.from, e.to);
      if (bySource.size === 0)
        for (const s of own) {
          const day = /^\d{4}-\d{2}-\d{2}/.test(s.asOf) ? s.asOf.slice(0, 10) : null;
          add(s.source, day, day);
        }
    }

    const partial = level === 'non_evalue' ? null : result.partial;
    const note = level === 'non_evalue' ? result.note || 'Donnée manquante.' : partial;
    const segments = RISK_SEGMENTS[level];
    const levelText = RISK_LEVEL_TEXT[level];
    const label = RISK_AXIS_LABEL[axis];
    return {
      axis,
      label,
      level,
      levelText,
      segments,
      sources: [...bySource].map(([source, d]) => sourceLine(source, d.from, d.to)),
      note,
      inPart: partial != null,
      signals: own.filter((s) => s.severity !== 'info').length,
      summary:
        level === 'non_evalue'
          ? `${label} : niveau non évalué, aucun segment plein, donnée manquante`
          : `${label} : niveau ${levelText}, ${segments} segment${segments > 1 ? 's' : ''} sur 3${partial ? ', évalué en partie' : ''}`,
    };
  });
}
