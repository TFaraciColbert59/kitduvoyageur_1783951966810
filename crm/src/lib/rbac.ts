import type { Role } from './rpc';

export const ROLE_RANK: Record<Role, number> = { membre: 1, responsable: 2, super_admin: 3 };

export function rank(role: Role | null | undefined): number {
  return role ? ROLE_RANK[role] : 0;
}

/** Règle unique de 02_ARCHITECTURE § 5, miroir de admin.can() en base. */
export function canRun(
  actor: { role: Role | null; poles: { code: string; role: Role }[]; elevates?: string[] },
  cmd: { command: string; pole: string; roleMin: Role; agent?: string }
): boolean {
  if (actor.role === 'super_admin') return true;
  if (actor.elevates?.includes(cmd.command)) return true;
  const membership = actor.poles.find((p) => p.code === cmd.pole);
  if (!membership) return false;
  return rank(membership.role) >= rank(cmd.roleMin);
}

/** Un agent ne valide jamais ; il propose (EX-AGT-02). */
export function agentCanValidate(actorKind: 'humain' | 'agent' | 'systeme'): boolean {
  return actorKind === 'humain';
}

/** Mode solo : l'auto-validation n'est possible que si un seul humain est actif (EX-ROLE-07). */
export function canSelfValidate(solo: boolean, hasSecondHuman: boolean): boolean {
  return solo && !hasSecondHuman;
}
