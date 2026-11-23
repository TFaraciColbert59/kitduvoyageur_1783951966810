import {
  normalizeRoutingOptions,
  type RouteSport,
  type SurfacePreference,
} from '@/features/adventure-prep/routeProfiles';
import { activePoints, applyWorkspaceOperation, workspaceTotals } from './engine';
import type { RouteOperationInput, RouteShapeMode, RouteWorkspaceState } from './types';

/**
 * « Dis-le » de l'itinéraire (amélioration 3.9) : une phrase courte devient des opérations d'itinéraire, avec un
 * aperçu AVANT d'appliquer. Même principe que le « Dis-le » du Compas v5 (la phrase est lue, ce qui est compris
 * est montré, ce qui ne l'est pas est dit, jamais deviné), mais traduit vers les opérations de l'itinéraire par
 * de simples règles : aucune IA n'est requise ni appelée.
 *
 * Module pur : `parseSayCommand` lit la phrase, `planSayCommands` calcule les opérations et l'aperçu en
 * rejouant le moteur sur une copie de l'itinéraire (rien n'est envoyé).
 */

export type SayCommand =
  | { readonly kind: 'split'; readonly days: number }
  | { readonly kind: 'reverse' }
  | { readonly kind: 'shape'; readonly shape: RouteShapeMode }
  | { readonly kind: 'surface'; readonly pref: SurfacePreference }
  | { readonly kind: 'avoid'; readonly what: 'steps' | 'ferries' }
  | { readonly kind: 'sport'; readonly sport: RouteSport }
  | { readonly kind: 'remove_last' };

export interface SayParse {
  readonly commands: readonly SayCommand[];
  /** Morceaux de la phrase qui n'ont pas été compris (dits, jamais devinés). */
  readonly unknown: readonly string[];
  /** Questions de précision (« vélo » : route, gravel ou VTT ?). */
  readonly clarify: readonly string[];
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
};

export const MAX_SAY_DAYS = 20;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysIn(clause: string): number | null {
  const m = clause.match(/\b(\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:jours?|journees?|etapes?)\b/);
  if (!m) return null;
  const n = /^\d/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]];
  return Number.isFinite(n) ? n : null;
}

function parseClause(clause: string): { command?: SayCommand; clarify?: string } {
  const c = clause.trim();
  if (!c) return {};

  // Découpage : « coupe en 3 jours », « fais-le sur 4 jours », « 3 jours ».
  const days = daysIn(c);
  if (days !== null && /\b(coupe|decoupe|divise|separe|partage|repartis|fais|fait|en|sur|etale)\b|^\d/.test(c)) {
    return { command: { kind: 'split', days } };
  }

  if (/\b(inverse|inverser|retourne|retourner|renverse|renverser)\b.*\b(sens|trace|parcours|itineraire|trajet)\b/.test(c)
    || /\b(sens inverse|sens contraire|a l'envers|dans l'autre sens|en sens inverse)\b/.test(c)
    || /^inverse( le sens)?$/.test(c)) {
    return { command: { kind: 'reverse' } };
  }

  if (/\baller[- ]?retour\b/.test(c)) return { command: { kind: 'shape', shape: 'out_and_back' } };
  if (/\bboucle\b|\brevenir? au depart\b|\breviens au depart\b/.test(c)) return { command: { kind: 'shape', shape: 'loop' } };
  if (/\baller[- ]?simple\b|\bsens unique\b|\bpas de boucle\b/.test(c)) return { command: { kind: 'shape', shape: 'one_way' } };

  if (/\b(evite|eviter|evitons|sans|pas de|loin des|fuis|ni)\b.*\b(routes?|bitume|goudron|asphalte|voitures?)\b/.test(c)
    || /\b(prefere|preferer|privilegie|privilegier|favorise|plutot|par les|suis les)\b.*\b(sentiers?|chemins?|pistes?|traces?)\b/.test(c)) {
    return { command: { kind: 'surface', pref: 'prefer_trails' } };
  }
  if (/\b(prefere|preferer|privilegie|privilegier|favorise|plutot|par les)\b.*\b(routes?|bitume|goudron|asphalte)\b/.test(c)) {
    return { command: { kind: 'surface', pref: 'prefer_paved' } };
  }
  if (/\b(evite|eviter|sans|pas d')\b.*\b(escaliers?|marches)\b/.test(c)) return { command: { kind: 'avoid', what: 'steps' } };
  if (/\b(evite|eviter|sans|pas de)\b.*\b(ferries|ferry|bacs?|bateaux?)\b/.test(c)) return { command: { kind: 'avoid', what: 'ferries' } };

  if (/\bvelo de route\b|\broute\b.*\bvelo\b|\bvelo\b.*\bde route\b/.test(c)) return { command: { kind: 'sport', sport: 'route' } };
  if (/\bgravel\b/.test(c)) return { command: { kind: 'sport', sport: 'gravel' } };
  if (/\benduro\b/.test(c)) return { command: { kind: 'sport', sport: 'enduro' } };
  if (/\bvtt\b|\bvelo tout terrain\b/.test(c)) return { command: { kind: 'sport', sport: 'vtt' } };
  if (/\b(a|en) pied\b|\bmarche\b|\brando(nnee)?\b|\ba pied\b|\bsentier a pied\b/.test(c) && /\b(passe|mets|met|change|en|a)\b/.test(c)) {
    return { command: { kind: 'sport', sport: 'marche' } };
  }
  if (/\bvelo\b/.test(c)) return { clarify: 'Quel vélo : route, gravel ou VTT ?' };

  if (/\b(supprime|enleve|retire|efface)\b.*\b(dernier point|derniere etape|dernier)\b/.test(c)) {
    return { command: { kind: 'remove_last' } };
  }
  return {};
}

/** Lit une phrase (éventuellement plusieurs demandes liées par « et », « puis », une virgule). */
export function parseSayCommand(text: string): SayParse {
  const norm = normalize(text);
  if (!norm) return { commands: [], unknown: [], clarify: [] };
  const commands: SayCommand[] = [];
  const unknown: string[] = [];
  const clarify: string[] = [];
  const whole = parseClause(norm);
  // Une phrase entière d'abord (« coupe en 3 jours et inverse le sens » est lue clause par clause ensuite).
  const clauses = norm.split(/\s*(?:,|;|\bpuis\b|\bensuite\b|\bet\b(?! demi))\s*/).filter(Boolean);
  if (clauses.length <= 1) {
    if (whole.command) commands.push(whole.command);
    else if (whole.clarify) clarify.push(whole.clarify);
    else unknown.push(text.trim());
  } else {
    for (const clause of clauses) {
      const parsed = parseClause(clause);
      if (parsed.command) commands.push(parsed.command);
      else if (parsed.clarify) clarify.push(parsed.clarify);
      else unknown.push(clause);
    }
  }
  // Doublons exacts (« inverse le sens et inverse ») : une seule fois.
  const seen = new Set<string>();
  const unique = commands.filter((c) => {
    const key = JSON.stringify(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { commands: unique, unknown, clarify };
}

/* ---------- Plan et aperçu ---------- */

export interface SayStep {
  readonly operation: RouteOperationInput;
  readonly expectedVersions: Readonly<Record<string, number>>;
}

export interface SayPlan {
  readonly ok: boolean;
  readonly steps: readonly SayStep[];
  /** Lignes d'aperçu (ce qui va changer) ; les chiffres viennent du moteur, rien n'est estimé à la main. */
  readonly preview: readonly string[];
  /** Raisons pour lesquelles tout ou partie ne peut pas être appliqué. */
  readonly blocked: readonly string[];
  /** Tronçons à recalculer après application : les nouveaux seulement, ou tous les tronçons calculés. */
  readonly recalc: 'none' | 'placeholders' | 'all';
  readonly summary: { readonly before: string; readonly after: string };
  /** Itinéraire obtenu en rejouant les opérations sur la copie (pour savoir quels tronçons recalculer). */
  readonly after: RouteWorkspaceState;
}

export interface SayPlanContext {
  readonly actorId: string;
  readonly actorName: string;
  /** Suffixe d'identifiants de points créés (injecté : le plan reste déterministe et testable). */
  readonly stamp: string;
  readonly nowIso?: string;
}

const SURFACE_LABELS: Record<SurfacePreference, string> = {
  balanced: 'équilibré',
  prefer_paved: 'routes revêtues',
  prefer_unpaved: 'pistes',
  prefer_trails: 'sentiers',
};

const SPORT_LABELS: Record<RouteSport, string> = {
  marche: 'marche',
  route: 'vélo de route',
  gravel: 'gravel',
  vtt: 'VTT',
  enduro: 'enduro',
};

function fmtKm(n: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n)} km`;
}

function shortLine(ws: RouteWorkspaceState): string {
  const t = workspaceTotals(ws);
  const days = ws.stages.length;
  return `${days > 0 ? `${days} j` : '? j'} · ${fmtKm(t.distanceKm)} · D+ ${t.ascentM != null ? `${t.ascentM} m` : 'inconnu'}`;
}

/** Points à ajouter pour qu'un découpage en `days` jours soit possible (même règle que l'onglet Étapes). */
function splitInserts(ws: RouteWorkspaceState, days: number, stamp: string): RouteOperationInput[] {
  const pts = activePoints(ws);
  if (days <= pts.length - 1) return [];
  const needed = days - (pts.length - 1);
  const flat = ws.sections.flatMap((s) => s.geometry.coordinates);
  const track = flat.length >= 2 ? flat : pts.map((p) => [p.lon, p.lat] as [number, number]);
  const start = track[0];
  const end = track[track.length - 1];
  const ops: RouteOperationInput[] = [];
  let afterId = pts[0].id;
  for (let i = 1; i <= needed; i += 1) {
    const ratio = i / (needed + 1);
    const [lon, lat] =
      track.length > days
        ? track[Math.min(track.length - 1, Math.max(0, Math.floor(ratio * (track.length - 1))))]
        : [
            Number((start[0] + (end[0] - start[0]) * ratio).toFixed(5)),
            Number((start[1] + (end[1] - start[1]) * ratio).toFixed(5)),
          ];
    const pointId = `pt-split-${stamp}-${i}`;
    ops.push({ type: 'insert_point', pointId, afterPointId: afterId, lat, lon, name: `Étape ${i + 1}` });
    afterId = pointId;
  }
  return ops;
}

function opsFor(command: SayCommand, ws: RouteWorkspaceState, stamp: string): { ops: RouteOperationInput[]; blocked?: string; recalc: SayPlan['recalc'] } {
  const pts = activePoints(ws);
  switch (command.kind) {
    case 'split': {
      if (pts.length < 2) return { ops: [], blocked: 'Ajoutez au moins deux points pour découper en journées.', recalc: 'none' };
      const days = Math.max(1, Math.min(MAX_SAY_DAYS, Math.round(command.days)));
      return {
        ops: [...splitInserts(ws, days, stamp), { type: 'split_days', targetDays: days }],
        recalc: 'placeholders',
      };
    }
    case 'reverse':
      if (pts.length < 2) return { ops: [], blocked: 'Aucun tracé à inverser.', recalc: 'none' };
      return { ops: [{ type: 'reverse_route' }], recalc: 'all' };
    case 'shape':
      if (pts.length < 2) return { ops: [], blocked: 'Aucun tracé dont changer la forme.', recalc: 'none' };
      if ((ws.shapeMode ?? 'one_way') === command.shape) {
        return { ops: [], blocked: 'La forme du tracé est déjà celle-ci.', recalc: 'none' };
      }
      return { ops: [{ type: 'set_shape_mode', shapeMode: command.shape }], recalc: 'placeholders' };
    case 'surface': {
      if (ws.routingOptions.surfacePref === command.pref) {
        return { ops: [], blocked: `La préférence « ${SURFACE_LABELS[command.pref]} » est déjà active.`, recalc: 'none' };
      }
      return {
        ops: [
          {
            type: 'set_sport_profile',
            sport: ws.sport,
            routingOptions: normalizeRoutingOptions(ws.sport, { ...ws.routingOptions, surfacePref: command.pref }),
          },
        ],
        recalc: 'all',
      };
    }
    case 'avoid': {
      const key = command.what === 'steps' ? 'avoidSteps' : 'avoidFerries';
      if (ws.routingOptions[key]) {
        return { ops: [], blocked: command.what === 'steps' ? 'Les escaliers sont déjà évités.' : 'Les bacs sont déjà évités.', recalc: 'none' };
      }
      return {
        ops: [
          {
            type: 'set_sport_profile',
            sport: ws.sport,
            routingOptions: normalizeRoutingOptions(ws.sport, { ...ws.routingOptions, [key]: true }),
          },
        ],
        recalc: 'all',
      };
    }
    case 'sport':
      if (ws.sport === command.sport) return { ops: [], blocked: `Le profil est déjà « ${SPORT_LABELS[command.sport]} ».`, recalc: 'none' };
      return {
        ops: [
          {
            type: 'set_sport_profile',
            sport: command.sport,
            routingOptions: normalizeRoutingOptions(command.sport, ws.routingOptions),
          },
        ],
        recalc: 'all',
      };
    case 'remove_last': {
      if (pts.length <= 2) return { ops: [], blocked: 'Un itinéraire garde au moins deux points.', recalc: 'none' };
      const last = pts[pts.length - 1];
      return { ops: [{ type: 'delete_point', pointId: last.id }], recalc: 'placeholders' };
    }
  }
}

function previewOf(command: SayCommand, before: RouteWorkspaceState, after: RouteWorkspaceState): string[] {
  const out: string[] = [];
  const b = workspaceTotals(before);
  const a = workspaceTotals(after);
  const pts = activePoints(after);
  switch (command.kind) {
    case 'split': {
      const n = after.stages.length;
      out.push(`Découpe en ${n} ${n > 1 ? 'jours' : 'jour'}${a.distanceKm > 0 && n > 0 ? ` · environ ${fmtKm(a.distanceKm / n)} par jour` : ''}`);
      const added = activePoints(after).length - activePoints(before).length;
      if (added > 0) out.push(`${added} ${added > 1 ? 'points d’étape ajoutés' : 'point d’étape ajouté'} le long du tracé`);
      break;
    }
    case 'reverse': {
      const first = pts[0]?.name ?? 'départ';
      const last = pts[pts.length - 1]?.name ?? 'arrivée';
      out.push(`Sens inversé : on part de « ${first} » et on arrive à « ${last} »`);
      out.push('Les tronçons sont recalculés dans le nouveau sens (horaires et nuits à revoir)');
      break;
    }
    case 'shape': {
      const label = command.shape === 'loop' ? 'Boucle' : command.shape === 'out_and_back' ? 'Aller-retour' : 'Aller simple';
      const delta = Number((a.distanceKm - b.distanceKm).toFixed(1));
      out.push(`${label}${delta !== 0 ? ` · ${delta > 0 ? '+' : '−'}${fmtKm(Math.abs(delta))} (ligne droite avant recalcul)` : ''}`);
      break;
    }
    case 'surface':
      out.push(
        command.pref === 'prefer_trails'
          ? 'Préférer les sentiers : préférence souple, le routeur évite les routes quand le réseau le permet (pas une garantie)'
          : `Préférence de surface : ${SURFACE_LABELS[command.pref]}`
      );
      break;
    case 'avoid':
      out.push(command.what === 'steps' ? 'Éviter les escaliers au calcul' : 'Éviter les bacs au calcul');
      break;
    case 'sport':
      out.push(`Profil de routage : ${SPORT_LABELS[command.sport]}`);
      break;
    case 'remove_last':
      out.push(`Retire le dernier point (« ${activePoints(before).at(-1)?.name ?? 'Arrivée'} »)`);
      break;
  }
  return out;
}

/** Calcule les opérations d'une suite de demandes et un aperçu, en les rejouant sur une copie. */
export function planSayCommands(
  commands: readonly SayCommand[],
  workspace: RouteWorkspaceState,
  ctx: SayPlanContext
): SayPlan {
  const nowIso = ctx.nowIso ?? new Date().toISOString();
  let working = workspace;
  let log: Parameters<typeof applyWorkspaceOperation>[1] = [];
  const steps: SayStep[] = [];
  const preview: string[] = [];
  const blocked: string[] = [];
  let recalc: SayPlan['recalc'] = 'none';
  const rank = { none: 0, placeholders: 1, all: 2 } as const;
  let counter = 0;

  commands.forEach((command, ci) => {
    const planned = opsFor(command, working, `${ctx.stamp}${ci}`);
    if (planned.blocked) {
      blocked.push(planned.blocked);
      return;
    }
    const startWs = working;
    let failed: string | null = null;
    let next = working;
    const applied: SayStep[] = [];
    for (const operation of planned.ops) {
      counter += 1;
      const { result, nextOpLog } = applyWorkspaceOperation(
        next,
        log,
        {
          opId: `say-${ctx.stamp}-${counter}`,
          baseSeq: next.headSeq,
          actorId: ctx.actorId,
          actorName: ctx.actorName,
          operation,
        },
        nowIso
      );
      if (result.status !== 'accepted') {
        failed =
          result.status === 'denied'
            ? 'Vous n’avez pas le droit de modifier le tracé.'
            : 'Cette demande ne peut pas être appliquée à l’état actuel du tracé.';
        break;
      }
      next = result.workspace;
      log = nextOpLog;
      applied.push({ operation, expectedVersions: {} });
    }
    if (failed) {
      blocked.push(failed);
      return;
    }
    working = next;
    steps.push(...applied);
    preview.push(...previewOf(command, startWs, working));
    if (rank[planned.recalc] > rank[recalc]) recalc = planned.recalc;
  });

  return {
    ok: steps.length > 0,
    steps,
    preview,
    blocked,
    recalc,
    summary: { before: shortLine(workspace), after: shortLine(working) },
    after: working,
  };
}

/**
 * Tronçons à recalculer sur le réseau après l'application d'un plan : les tronçons recréés en simple segment
 * (`placeholders`) ou tous les tronçons calculés (`all`). Les tronçons tracés à la main ou importés ne sont
 * jamais recalculés sans qu'on le demande.
 */
export function sectionsToRecalc(plan: Pick<SayPlan, 'recalc' | 'after'>): string[] {
  if (plan.recalc === 'none') return [];
  return plan.after.sections
    .filter((s) => {
      if (s.mode !== 'routed') return false;
      if (plan.recalc === 'all') return true;
      return s.provenance.provider == null && s.provenance.calculatedAt == null;
    })
    .map((s) => s.id);
}
