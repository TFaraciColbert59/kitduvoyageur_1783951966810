import { activePoints, computeRoutingFingerprint } from './engine';
import type {
  CollaborativePointKind,
  CollaborativeRoutePoint,
  CollaborativeRouteSection,
  RouteOperationInput,
  RouteWorkspaceState,
} from './types';

/**
 * « Annuler » (amélioration 3.4) : l'opération inverse est soumise comme une NOUVELLE opération, jamais en
 * rejouant un ancien état. Le journal partagé reste donc linéaire (les autres participants voient « annulé »
 * comme un changement de plus) et l'historique n'est pas réécrit.
 *
 * Module pur : à partir d'une opération et de l'état qui la précédait, il calcule les opérations qui
 * rétablissent le tracé, sans rien envoyer. Ce qui ne peut pas être rétabli proprement est dit (`ok: false`),
 * jamais approximé en silence.
 */

/** Une opération soumise, avec l'état local qui la précédait (et l'état rendu par le serveur). */
export interface JournalEntry {
  readonly operation: RouteOperationInput;
  readonly before: RouteWorkspaceState;
  /** État après application ; utile pour retrouver les points créés par une forme (boucle, aller-retour). */
  readonly after?: RouteWorkspaceState;
  /** Horodatage (ms), pour savoir si l'annonce « Annuler » est encore fraîche. */
  readonly at: number;
  /** Opération dérivée d'un geste précédent (recollage au réseau après un ajout ou un déplacement). */
  readonly derived?: boolean;
  /** Identifiant d'un geste qui enchaîne plusieurs opérations (« Dis-le », découpage en jours). */
  readonly gesture?: string;
}

export interface UndoStep {
  readonly operation: RouteOperationInput;
  readonly expectedVersions: Readonly<Record<string, number>>;
}

export type UndoPlan =
  | { readonly ok: true; readonly label: string; readonly steps: readonly UndoStep[] }
  | { readonly ok: false; readonly reason: string };

export interface UndoContext {
  /** Fabrique un identifiant de point neuf (un point supprimé ne reprend jamais son ancien identifiant). */
  readonly newPointId: () => string;
}

type Blocked = { readonly blocked: string };
type Inverse = { readonly steps: UndoStep[] } | Blocked;

const step = (
  operation: RouteOperationInput,
  expectedVersions: Record<string, number> = {}
): UndoStep => ({ operation, expectedVersions });

function pointOf(ws: RouteWorkspaceState, id: string): CollaborativeRoutePoint | undefined {
  return ws.points.find((p) => p.id === id && !p.deletedAt);
}

function sectionByPair(
  ws: RouteWorkspaceState,
  fromId: string,
  toId: string
): CollaborativeRouteSection | undefined {
  return ws.sections.find((s) => s.fromPointId === fromId && s.toPointId === toId);
}

function isPlaceholder(sec: CollaborativeRouteSection): boolean {
  return (
    sec.mode === 'routed' && sec.provenance.provider == null && sec.provenance.calculatedAt == null
  );
}

/**
 * Remet un tronçon dans l'état qu'il avait : un tronçon calculé repasse par `apply_routing_result`
 * (empreinte courante, donc jamais « périmé »), un tronçon à la main ou importé par `set_section_mode`.
 * Un simple segment direct en attente de calcul n'a rien à rétablir : le moteur le recrée seul.
 */
function restoreSection(
  sec: CollaborativeRouteSection,
  target: { sectionId: string; fingerprint: string }
): UndoStep[] {
  if (isPlaceholder(sec)) return [];
  if (sec.mode === 'routed') {
    return [
      step({
        type: 'apply_routing_result',
        sectionId: target.sectionId,
        routingInputHash: target.fingerprint,
        geometry: sec.geometry,
        distanceKm: sec.distanceKm,
        durationMin: sec.durationMin,
        ascentM: sec.ascentM,
        descentM: sec.descentM,
        elevationSamples: sec.elevationSamples,
        surfaceSegments: sec.surfaceSegments,
        provenance: sec.provenance,
      }),
    ];
  }
  return [
    step({
      type: 'set_section_mode',
      sectionId: target.sectionId,
      mode: sec.mode,
      geometry: sec.geometry,
    }),
  ];
}

function fingerprintBetween(
  ws: RouteWorkspaceState,
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): string {
  return computeRoutingFingerprint({
    from,
    to,
    sport: ws.sport,
    options: ws.routingOptions,
  });
}

/** Identifiant que le moteur donne à un tronçon recréé entre deux points. */
const rebuiltSectionId = (fromId: string, toId: string) => `sec-${fromId}-${toId}`;

function neighbours(ws: RouteWorkspaceState, afterPointId: string | null) {
  const ordered = activePoints(ws);
  const idx = afterPointId ? ordered.findIndex((p) => p.id === afterPointId) : ordered.length - 1;
  return { pred: idx >= 0 ? ordered[idx] : undefined, succ: idx >= 0 ? ordered[idx + 1] : undefined };
}

function inverseOf(entry: JournalEntry, ctx: UndoContext): Inverse {
  const { operation: op, before } = entry;
  switch (op.type) {
    case 'insert_point': {
      const { pred, succ } = neighbours(before, op.afterPointId);
      const steps: UndoStep[] = [step({ type: 'delete_point', pointId: op.pointId }, { [op.pointId]: 1 })];
      if (pred && succ) {
        const old = sectionByPair(before, pred.id, succ.id);
        if (old) {
          steps.push(
            ...restoreSection(old, {
              sectionId: rebuiltSectionId(pred.id, succ.id),
              fingerprint: fingerprintBetween(before, pred, succ),
            })
          );
        }
      }
      return { steps };
    }

    case 'delete_point': {
      const ordered = activePoints(before);
      const idx = ordered.findIndex((p) => p.id === op.pointId);
      if (idx < 0) return { blocked: 'Ce point n’existait pas : rien à rétablir.' };
      if (idx === 0) {
        return {
          blocked:
            'Le premier point supprimé ne peut pas être rétabli automatiquement : replacez-le depuis la carte.',
        };
      }
      const pt = ordered[idx];
      const pred = ordered[idx - 1];
      const succ = ordered[idx + 1];
      const newId = ctx.newPointId();
      const restored = { ...pt, id: newId };
      const steps: UndoStep[] = [
        step({
          type: 'insert_point',
          pointId: newId,
          afterPointId: pred.id,
          lat: pt.lat,
          lon: pt.lon,
          kind: pt.kind as CollaborativePointKind,
          name: pt.name ?? null,
          semanticKind: pt.semanticKind,
        }),
      ];
      const incoming = sectionByPair(before, pred.id, pt.id);
      if (incoming) {
        steps.push(
          ...restoreSection(incoming, {
            sectionId: rebuiltSectionId(pred.id, newId),
            fingerprint: fingerprintBetween(before, pred, restored),
          })
        );
      }
      if (succ) {
        const outgoing = sectionByPair(before, pt.id, succ.id);
        if (outgoing) {
          steps.push(
            ...restoreSection(outgoing, {
              sectionId: rebuiltSectionId(newId, succ.id),
              fingerprint: fingerprintBetween(before, restored, succ),
            })
          );
        }
      }
      return { steps };
    }

    case 'move_point': {
      const pt = pointOf(before, op.pointId);
      if (!pt) return { blocked: 'Ce point n’existait pas : rien à rétablir.' };
      const steps: UndoStep[] = [
        step(
          {
            type: 'move_point',
            pointId: pt.id,
            lat: pt.lat,
            lon: pt.lon,
            ...(op.eleM !== undefined ? { eleM: pt.eleM ?? null } : {}),
          },
          { [pt.id]: pt.entityVersion + 1 }
        ),
      ];
      // Le moteur redessine en ligne droite les tronçons voisins : on leur rend leur tracé.
      for (const sec of before.sections) {
        if (sec.fromPointId !== pt.id && sec.toPointId !== pt.id) continue;
        const from = pointOf(before, sec.fromPointId);
        const to = pointOf(before, sec.toPointId);
        if (!from || !to) continue;
        steps.push(
          ...restoreSection(sec, { sectionId: sec.id, fingerprint: fingerprintBetween(before, from, to) })
        );
      }
      return { steps };
    }

    case 'reverse_route': {
      const steps: UndoStep[] = [step({ type: 'reverse_route' })];
      // Le moteur recrée tous les tronçons en ligne droite : on rend leur tracé à ceux qui en avaient un.
      for (const sec of before.sections) {
        const from = pointOf(before, sec.fromPointId);
        const to = pointOf(before, sec.toPointId);
        if (!from || !to) continue;
        steps.push(
          ...restoreSection(sec, {
            sectionId: rebuiltSectionId(sec.fromPointId, sec.toPointId),
            fingerprint: fingerprintBetween(before, from, to),
          })
        );
      }
      return { steps };
    }

    case 'set_shape_mode': {
      const beforeIds = new Set(before.points.map((p) => p.id));
      const added = (entry.after?.points ?? []).filter(
        (p) => !beforeIds.has(p.id) && !p.deletedAt && /^pt-(loop-close|ret)-/.test(p.id)
      );
      const steps: UndoStep[] = added.map((p) => step({ type: 'delete_point', pointId: p.id }, { [p.id]: p.entityVersion }));
      steps.push(step({ type: 'set_shape_mode', shapeMode: before.shapeMode ?? 'one_way' }));
      return { steps };
    }

    case 'set_section_mode': {
      const sec = before.sections.find((s) => s.id === op.sectionId);
      if (!sec) return { blocked: 'Ce tronçon n’existait pas : rien à rétablir.' };
      return {
        steps: [step({ type: 'set_section_mode', sectionId: sec.id, mode: sec.mode, geometry: sec.geometry })],
      };
    }

    case 'apply_routing_result': {
      const sec = before.sections.find((s) => s.id === op.sectionId);
      if (!sec) return { blocked: 'Ce tronçon n’existait pas : rien à rétablir.' };
      if (sec.mode === 'routed') {
        return {
          steps: [
            step({
              type: 'apply_routing_result',
              sectionId: sec.id,
              routingInputHash: op.routingInputHash,
              geometry: sec.geometry,
              distanceKm: sec.distanceKm,
              durationMin: sec.durationMin,
              ascentM: sec.ascentM,
              descentM: sec.descentM,
              elevationSamples: sec.elevationSamples,
              surfaceSegments: sec.surfaceSegments,
              provenance: sec.provenance,
            }),
          ],
        };
      }
      return {
        steps: [step({ type: 'set_section_mode', sectionId: sec.id, mode: sec.mode, geometry: sec.geometry })],
      };
    }

    case 'split_days': {
      const stages = before.stages.slice().sort((a, b) => a.dayNumber - b.dayNumber);
      if (stages.length === 0) {
        return { blocked: 'Aucune journée n’existait avant le découpage : il ne peut pas être défait.' };
      }
      const live = new Set(activePoints(before).map((p) => p.id));
      const steps: UndoStep[] = [
        step({ type: 'split_days', targetDays: stages.length, timezone: stages[0].timezone }),
      ];
      stages.slice(0, -1).forEach((st) => {
        if (live.has(st.endPointId)) {
          steps.push(step({ type: 'move_day_boundary', stageId: st.id, newEndPointId: st.endPointId }));
        }
      });
      return { steps };
    }

    case 'move_day_boundary': {
      const st = before.stages.find((s) => s.id === op.stageId);
      if (!st) return { blocked: 'Cette journée n’existait pas : rien à rétablir.' };
      return {
        steps: [step({ type: 'move_day_boundary', stageId: st.id, newEndPointId: st.endPointId })],
      };
    }

    case 'update_stage_note': {
      const st = before.stages.find((s) => s.id === op.stageId);
      if (!st) return { blocked: 'Cette journée n’existait pas : rien à rétablir.' };
      return { steps: [step({ type: 'update_stage_note', stageId: st.id, notes: st.notes })] };
    }

    case 'set_overnight': {
      const st = before.stages.find((s) => s.id === op.stageId);
      if (!st) return { blocked: 'Cette journée n’existait pas : rien à rétablir.' };
      return {
        steps: [step({ type: 'set_overnight', stageId: st.id, overnightPlace: st.overnightPlace })],
      };
    }

    case 'set_stage_transports': {
      const st = before.stages.find((s) => s.id === op.stageId);
      if (!st) return { blocked: 'Cette journée n’existait pas : rien à rétablir.' };
      return { steps: [step({ type: 'set_stage_transports', stageId: st.id, transports: st.transports ?? [] })] };
    }

    case 'set_sport_profile':
      return {
        steps: [
          step({ type: 'set_sport_profile', sport: before.sport, routingOptions: before.routingOptions }),
        ],
      };

    case 'apply_variant': {
      const variant = before.variants.find((v) => v.id === op.variantId);
      if (!variant) return { blocked: 'Cette variante n’existait pas : rien à rétablir.' };
      const steps: UndoStep[] = [];
      for (const rep of variant.replacements) {
        const sec = before.sections.find((s) => s.id === rep.sectionId);
        if (!sec) continue;
        steps.push(
          ...restoreSection(sec, {
            sectionId: sec.id,
            fingerprint: sec.pendingFingerprint ?? sec.routingInputHash ?? '',
          })
        );
      }
      return { steps };
    }

    case 'add_variant':
      return { blocked: 'Une variante ajoutée se retire depuis le tiroir Variantes.' };

    case 'revert_to_seq':
      return { blocked: 'Un retour à une version ne s’annule pas : revenez à la version suivante depuis l’historique.' };

    default:
      return { blocked: 'Cette opération ne peut pas être annulée.' };
  }
}

/** Libellé court (« ajout d’un point ») d'une opération, pour « Annuler : … » et pour le journal. */
export function describeOperation(op: RouteOperationInput, before?: RouteWorkspaceState): string {
  switch (op.type) {
    case 'insert_point':
      return 'ajout d’un point';
    case 'delete_point':
      return 'suppression d’un point';
    case 'move_point':
      return 'déplacement d’un point';
    case 'reverse_route':
      return 'inversion du sens';
    case 'set_shape_mode':
      return op.shapeMode === 'loop'
        ? 'forme en boucle'
        : op.shapeMode === 'out_and_back'
          ? 'forme en aller-retour'
          : 'forme en aller simple';
    case 'set_section_mode':
      return 'changement de mode d’un tronçon';
    case 'apply_routing_result':
      return 'recalcul d’un tronçon';
    case 'split_days': {
      const n = Math.max(1, Math.round(op.targetDays));
      return `découpage en ${n} ${n > 1 ? 'jours' : 'jour'}`;
    }
    case 'move_day_boundary':
      return 'déplacement d’une coupure';
    case 'update_stage_note':
      return 'note de journée';
    case 'set_overnight':
      return op.overnightPlace ? 'choix de la nuit' : 'retrait de la nuit';
    case 'set_stage_transports':
      return 'transports de la journée';
    case 'set_sport_profile':
      return 'changement de profil de routage';
    case 'add_variant':
      return 'ajout d’une variante';
    case 'apply_variant':
      return 'application d’une variante';
    case 'revert_to_seq':
      return before ? 'retour à une version' : 'retour à une version';
    default:
      return 'modification';
  }
}

/**
 * Plan d'annulation d'un geste (une ou plusieurs opérations enchaînées). Les inverses sont rendus dans l'ordre
 * d'exécution (du plus récent au plus ancien) ; un tronçon rétabli par une étape plus tardive n'est pas
 * rétabli deux fois.
 */
export function planUndo(entries: readonly JournalEntry[], ctx: UndoContext): UndoPlan {
  if (entries.length === 0) return { ok: false, reason: 'Rien à annuler.' };
  const steps: UndoStep[] = [];
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const inv = inverseOf(entries[i], ctx);
    if ('blocked' in inv) return { ok: false, reason: inv.blocked };
    steps.push(...inv.steps);
  }
  const restoredLater = new Set<string>();
  const pruned: UndoStep[] = [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const op = steps[i].operation;
    if (op.type === 'apply_routing_result' || op.type === 'set_section_mode') {
      if (restoredLater.has(op.sectionId)) continue;
      restoredLater.add(op.sectionId);
    }
    pruned.unshift(steps[i]);
  }
  if (pruned.length === 0) return { ok: false, reason: 'Rien à rétablir : le tracé est déjà dans cet état.' };
  return {
    ok: true,
    label: describeOperation(entries[0].operation, entries[0].before),
    steps: pruned,
  };
}

/**
 * Le dernier geste annulable : la dernière opération, avec ce qui en découle (recollage au réseau) et ce qui
 * porte le même identifiant de geste. Deux gestes de l'utilisateur ne sont jamais fusionnés, même rapprochés.
 */
export function groupGesture(entries: readonly JournalEntry[]): JournalEntry[] {
  if (entries.length === 0) return [];
  const out: JournalEntry[] = [entries[entries.length - 1]];
  for (let i = entries.length - 2; i >= 0; i -= 1) {
    const next = out[0];
    const sameGesture = next.gesture !== undefined && next.gesture === entries[i].gesture;
    if (!next.derived && !sameGesture) break;
    out.unshift(entries[i]);
  }
  return out;
}
