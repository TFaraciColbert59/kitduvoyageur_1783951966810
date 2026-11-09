import { describe, expect, it } from 'vitest';
import { COMMANDS, POLES, type CommandDef } from './catalog';
import { ROLE_RANK, agentCanValidate, canRun, canSelfValidate, rank } from './rbac';
import type { Role } from './rpc';

/**
 * Couche 2 : miroir de `admin.can()` en base (02_ARCHITECTURE § 5) et des règles
 * d'élévation / mode solo (EX-ROLE-07) / « un agent ne valide jamais » (EX-AGT-02).
 * L'interface n'est qu'un miroir : ces tests verrouillent la règle, pas l'écran.
 */

type Actor = { role: Role | null; poles: { code: string; role: Role }[]; elevates?: string[] };

const superAdmin = (): Actor => ({ role: 'super_admin', poles: [] });
const poleActor = (code: string, role: Role): Actor => ({ role, poles: [{ code, role }] });
const noRole = (): Actor => ({ role: null, poles: [] });

const commandsOf = (pole: string): CommandDef[] => COMMANDS.filter((c) => c.pole === pole);

describe('rbac — règle unique de droits', () => {
  it('accorde au super admin les 144 actions, même sans appartenance à un pôle', () => {
    const actor = superAdmin();
    const refusals = COMMANDS.filter((c) => !canRun(actor, c)).map((c) => c.id);
    expect(refusals).toEqual([]);
  });

  it('accorde au responsable tout son pôle à son niveau et en dessous, jamais au-dessus', () => {
    for (const pole of POLES) {
      const actor = poleActor(pole.code, 'responsable');
      for (const c of commandsOf(pole.code)) {
        const expected = c.roleMin !== 'super_admin';
        expect(canRun(actor, c), `${c.id} (${c.roleMin}) pour un responsable ${pole.code}`).toBe(expected);
      }
    }
  });

  it('limite le membre de pôle aux actions de niveau membre', () => {
    for (const pole of POLES) {
      const actor = poleActor(pole.code, 'membre');
      for (const c of commandsOf(pole.code)) {
        const expected = c.roleMin === 'membre';
        expect(canRun(actor, c), `${c.id} (${c.roleMin}) pour un membre ${pole.code}`).toBe(expected);
      }
      const outsider = COMMANDS.find((c) => c.pole !== pole.code)!;
      expect(canRun(actor, outsider), `${outsider.id} hors pôle ${pole.code}`).toBe(false);
    }
  });

  it('refuse tout à un acteur sans rôle ni pôle (agent, système, session expirée)', () => {
    const actor = noRole();
    const grants = COMMANDS.filter((c) => canRun(actor, c)).map((c) => c.id);
    expect(grants).toEqual([]);
  });

  it('élève commande par commande, sans élargir le reste', () => {
    const actor: Actor = { role: 'membre', poles: [{ code: 'CONF', role: 'membre' }], elevates: ['order_refund'] };
    const refund = COMMANDS.find((c) => c.command === 'order_refund')!;
    const otherCommerce = COMMANDS.find((c) => c.pole === 'COMM' && c.command !== 'order_refund')!;
    expect(actor.poles[0]!.code).not.toBe(refund.pole);
    expect(canRun(actor, refund)).toBe(true);
    expect(canRun(actor, otherCommerce)).toBe(false);
    expect(canRun(actor, COMMANDS.find((c) => c.command === 'staff_manage')!)).toBe(false);
  });

  it('lit l’élévation dans une liste explicite, jamais dans un joker', () => {
    const actor: Actor = { role: 'membre', poles: [{ code: 'CONF', role: 'membre' }], elevates: ['order_refund'] };
    expect(canRun(actor, COMMANDS.find((c) => c.command === 'order_refund')!)).toBe(true);
    for (const joker of ['*', 'all', 'order_*']) {
      const wildcardActor: Actor = { ...actor, elevates: [joker] };
      expect(canRun(wildcardActor, COMMANDS.find((c) => c.command === 'order_refund')!)).toBe(false);
    }
    const emptyElevation: Actor = { ...actor, elevates: [] };
    expect(canRun(emptyElevation, COMMANDS.find((c) => c.command === 'order_refund')!)).toBe(false);
  });

  it('ordonne les rôles membre < responsable < super_admin, rien avant', () => {
    expect(rank(null)).toBe(0);
    expect(rank(undefined)).toBe(0);
    expect(rank('membre')).toBe(ROLE_RANK.membre);
    expect(rank('responsable')).toBeGreaterThan(rank('membre'));
    expect(rank('super_admin')).toBeGreaterThan(rank('responsable'));
  });

  it('interdit à un agent et au système de valider une demande', () => {
    expect(agentCanValidate('humain')).toBe(true);
    expect(agentCanValidate('agent')).toBe(false);
    expect(agentCanValidate('systeme')).toBe(false);
  });

  it('n’autorise l’auto-validation qu’en mode solo réellement seul', () => {
    expect(canSelfValidate(true, false)).toBe(true);
    expect(canSelfValidate(true, true)).toBe(false);
    expect(canSelfValidate(false, false)).toBe(false);
    expect(canSelfValidate(false, true)).toBe(false);
  });

  it('ne donne à chaque pôle au moins une action exécutable par son responsable', () => {
    for (const pole of POLES) {
      const runnable = commandsOf(pole.code).filter((c) => canRun(poleActor(pole.code, 'responsable'), c));
      expect(runnable.length, `pôle ${pole.code}`).toBeGreaterThan(0);
    }
  });
});
