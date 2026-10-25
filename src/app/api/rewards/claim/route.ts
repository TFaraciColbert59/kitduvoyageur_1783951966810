import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/rewards/claim — FERMÉE (chantier Récompenses, 25 oct. 2026).
 *
 * Cette route relayait `action_type`, `target_id` et `metadata` fournis par le
 * client à `claim_reward_points` avec le rôle service : un message de groupe
 * (cible = le groupe, pas le message) ou un carnet suffisait à créditer des
 * points économiques sans que le fait soit vérifié en base. L'émission sociale
 * reste fermée tant que son financement et sa preuve ne sont pas démontrés
 * (docs/research/2026-10-25-recompenses-lkdv/AUDIT-RECONCILIATION.md).
 *
 * Les anciens clients reçoivent un refus explicite et sans effet ; aucun droit
 * déjà acquis n'est touché. Les nouveaux gains passent par
 * `rewards_award_points` (décision unique par fait, plafonds), fermé lui aussi.
 */
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'emission_closed', message: 'Les gains sociaux ne sont pas ouverts.' },
    { status: 410 }
  );
}
