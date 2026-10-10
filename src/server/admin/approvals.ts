import 'server-only';

/**
 * Approval Engine — SERVEUR UNIQUEMENT.
 * Second approbateur obligatoire pour Tier4 + commandes à approbation
 * (refund.approve, trust.case.decide, ai.prompt.promote, role.grant).
 * Séparation des devoirs : l'initiateur ne peut jamais approuver
 * sa propre commande — vérifié applicativement ET par contrainte
 * d'usage (les décisions sont comparées à requested_by au moment du vote).
 */

export const SOD_RULE =
  'initiator !== approver: le demandeur (requested_by) ne peut pas approuver sa propre commande';

export function isSelfApproval(requestedBy: string, approverId: string): boolean {
  return requestedBy === approverId;
}

export type ApprovalDecision = 'approve' | 'reject';

export async function requestApproval(
  _commandId: string,
  _reason: string
): Promise<{ approval_id: string }> {
  // /** @internal P1 — stub intentionnel : utiliser persistApprovalRequest(). */
  throw new Error('not_wired_yet: brancher la persistance en P1 (file approvals)');
}

export async function decideApproval(
  _approvalId: string,
  _decision: ApprovalDecision,
  _reason: string
): Promise<{ status: 'approved' | 'rejected' }> {
  if (!_reason?.trim()) throw new Error('reason_required');
  throw new Error('not_wired_yet: brancher la persistance en P1 (file approvals)');
}

export interface ApprovalDb {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<{ data: ApprovalRequestRow | null; error: { code: string } | null }>;
      };
    };
    insert(row: Record<string, unknown>): {
      select(): {
        single(): Promise<{ data: { id: string } | null; error: { code: string } | null }>;
      };
    };
    update(patch: Record<string, unknown>): {
      eq(col: string, val: string): Promise<{ error: { code: string } | null }>;
    };
  };
}

export interface ApprovalRequestRow {
  id: string;
  command_id: string;
  requested_by: string;
  status: string;
}

/** Crée une demande d'approbation liée à une commande (reason ≥ 10). */
export async function persistApprovalRequest(
  db: ApprovalDb,
  commandId: string,
  requestedBy: string,
  reason: string
): Promise<{ approval_id: string }> {
  if (!reason?.trim() || reason.trim().length < 10) throw new Error('reason_required');
  const { data, error } = await db
    .from('admin_approval_requests')
    .insert({ command_id: commandId, requested_by: requestedBy, reason: reason.trim() })
    .select()
    .single();
  if (error || !data) throw new Error('approval_insert_failed');
  return { approval_id: data.id };
}

/**
 * Vote SoD : refuse si l'approbateur est l'initiateur, exige une reason,
 * enregistre la décision puis propage le statut (request + command).
 *
 * NOTE PROD : la voie d'exécution réelle est `public.decide_approval()`
 * (SECURITY DEFINER, atomique : SoD + has_permission + statut en une
 * transaction, décision unique). Cette fonction TypeScript en est le miroir
 * logique testé ; les handlers serveur appelleront le RPC, pas ces requêtes.
 */
export async function persistApprovalDecision(
  db: ApprovalDb,
  approvalId: string,
  approverId: string,
  decision: ApprovalDecision,
  reason: string
): Promise<{ status: 'approved' | 'rejected' }> {
  if (!reason?.trim() || reason.trim().length < 10) throw new Error('reason_required');
  const { data: req, error: lookupError } = await db
    .from('admin_approval_requests')
    .select('id, command_id, requested_by, status')
    .eq('id', approvalId)
    .maybeSingle();
  if (lookupError || !req) throw new Error('approval_not_found');
  if (req.status !== 'pending') throw new Error('approval_not_pending');
  if (isSelfApproval(req.requested_by, approverId)) throw new Error('sod_violation');

  const { error: decisionError } = await db
    .from('admin_approval_decisions')
    .insert({ approval_id: approvalId, approver_id: approverId, decision, reason: reason.trim() })
    .select()
    .single();
  if (decisionError) throw new Error('decision_insert_failed');

  const status = decision === 'approve' ? 'approved' : 'rejected';
  const { error: reqError } = await db
    .from('admin_approval_requests')
    .update({ status })
    .eq('id', approvalId);
  if (reqError) throw new Error('approval_update_failed');
  const { error: cmdError } = await db
    .from('admin_commands')
    .update({ status: decision === 'approve' ? 'approved' : 'cancelled' })
    .eq('id', req.command_id);
  if (cmdError) throw new Error('command_update_failed');
  return { status };
}
