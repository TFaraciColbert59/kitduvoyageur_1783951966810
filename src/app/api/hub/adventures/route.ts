import { NextResponse } from 'next/server';
import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';

export const dynamic = 'force-dynamic';

/**
 * H2.2/H3.1 — Aventures de l'utilisateur pour le sélecteur (`AdventureSwitcher`).
 * Délègue à `getHubAdventureData` (source unique, partagée avec le layout /hub).
 * Payload : groupes, invitations, compteurs possession.
 * Non connecté → zéros/vides (jamais 401, miroir /api/voyages/mine).
 */
export async function GET() {
  try {
    const data = await getHubAdventureData();
    return NextResponse.json({
      groups: data.groups,
      pendingInvites: data.pendingInvites,
      possession: data.possession,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      groups: [],
      pendingInvites: 0,
      possession: { items: 0, loans: 0, alerts: 0 },
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
