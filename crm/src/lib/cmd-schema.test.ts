import { describe, expect, it } from 'vitest';
import { COMMANDS, commandByCommand } from './catalog';
import {
  agentExposedCommands,
  commandInputJsonSchema,
  commandParamsSchema,
  isAgentExposedCommand,
  parseCommandParams
} from './cmd';
import { ApiError } from './errors';

/**
 * Couche 4 — schémas zod des routes (`/api/cmd`, outils MCP).
 * Règles du CONTRACT : validation zod de toute entrée, refus des champs inconnus,
 * motif exigé quand le catalogue le dit, aucun code brut dans la réponse.
 */

describe('commandParamsSchema — un schéma strict par commande', () => {
  it('fournit un schéma à chacune des 144 commandes du catalogue', () => {
    const failures: string[] = [];
    for (const command of COMMANDS) {
      try {
        const schema = commandParamsSchema(command.command);
        expect(typeof schema.safeParse).toBe('function');
      } catch (error) {
        failures.push(`${command.id} ${command.command} : ${(error as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('refuse un champ inconnu (additionalProperties: false)', () => {
    const result = commandParamsSchema('post_hide').safeParse({ post_id: 'p-1', champ_inconnu: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('exige un motif pour les commandes marquées « motif obligatoire »', () => {
    const withReason = COMMANDS.filter((command) => command.reasonRequired);
    expect(withReason.length).toBeGreaterThan(20);
    const failures: string[] = [];
    for (const command of withReason) {
      const schema = commandParamsSchema(command.command);
      const withoutReason = schema.safeParse({});
      if (withoutReason.success) failures.push(`${command.id} ${command.command} : accepté sans motif`);
      const withReasonable = schema.safeParse({ reason_code: 'spam' });
      if (!withReasonable.success) failures.push(`${command.id} ${command.command} : refusé avec un motif`);
    }
    expect(failures).toEqual([]);
  });

  it('accepte un objet vide pour les commandes sans cible ni motif', () => {
    const failures: string[] = [];
    for (const command of COMMANDS.filter((item) => !item.reasonRequired)) {
      const result = commandParamsSchema(command.command).safeParse({});
      if (!result.success) failures.push(`${command.id} ${command.command}`);
    }
    expect(failures).toEqual([]);
  });
});

describe('parseCommandParams — validation d’appel', () => {
  it('refuse une commande inconnue avec une phrase métier et le statut 400', () => {
    try {
      parseCommandParams('commande_inexistante', {});
      throw new Error('aurait dû lever');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('unknown_command');
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).message).toBe('Cette commande n’existe pas.');
    }
  });

  it('traite `null` et `undefined` comme « aucun paramètre », refuse les tableaux', () => {
    expect(parseCommandParams('sos_board', null)).toEqual({});
    expect(parseCommandParams('sos_board', undefined)).toEqual({});
    expect(() => parseCommandParams('sos_board', [1, 2])).toThrow(ApiError);
  });

  it('valide un remboursement : montant entier positif obligatoire, type vérifié', () => {
    // Un remboursement exige aussi un motif (catalogue : motif obligatoire).
    const reason_code = 'defaut_produit';
    const ok = parseCommandParams('order_refund', { order_id: 'o-1', amount_cents: 1200, reason_code });
    expect(ok.order_id).toBe('o-1');
    expect(ok.amount_cents).toBe(1200);
    expect(ok.reason_code).toBe(reason_code);

    const invalid = [
      { order_id: 'o-1', amount_cents: 0, reason_code },
      { order_id: 'o-1', amount_cents: -100, reason_code },
      { order_id: 'o-1', amount_cents: 12.5, reason_code },
      { order_id: 'o-1', amount_cents: '1200', reason_code },
      { order_id: '', amount_cents: 1200, reason_code },
      { order_id: 'o-1', amount_cents: 1200, reason_code, champ_inconnu: 'x' },
      { order_id: 'o-1', amount_cents: 1200 }
    ];
    const accepted: string[] = [];
    for (const params of invalid) {
      try {
        parseCommandParams('order_refund', params);
        accepted.push(JSON.stringify(params));
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).code).toBe('invalid_params');
        expect((error as ApiError).status).toBe(422);
        expect((error as ApiError).issues?.length).toBeGreaterThan(0);
        for (const issue of (error as ApiError).issues ?? []) {
          expect(issue.path.length).toBeGreaterThan(0);
          expect(issue.message).not.toMatch(/ZodError|invalid_type|Expected/i);
        }
      }
    }
    expect(accepted).toEqual([]);
  });

  it('nettoie les espaces autour des identifiants et borne leur longueur', () => {
    const parsed = parseCommandParams('post_hide', { post_id: '  p-1  ', reason_code: 'spam' });
    expect(parsed.post_id).toBe('p-1');
    expect(() => parseCommandParams('post_hide', { post_id: 'x'.repeat(129), reason_code: 'spam' })).toThrow(ApiError);
  });

  it('refuse une raison vide et accepte un code de motif fourni', () => {
    expect(() => parseCommandParams('post_hide', { post_id: 'p-1', reason_code: '   ' })).toThrow(ApiError);
    expect(parseCommandParams('post_hide', { post_id: 'p-1', reason_code: 'harcelement' }).reason_code).toBe('harcelement');
  });
});

describe('exposition des commandes aux agents (MCP)', () => {
  it('n’expose jamais une commande marquée « jamais » aux outils d’agent', () => {
    const exposed = agentExposedCommands().map((command) => command.command);
    const never = COMMANDS.filter((command) => command.agent === 'never').map((command) => command.command);
    expect(never.length).toBeGreaterThan(0);
    for (const command of never) {
      expect(exposed).not.toContain(command);
      expect(isAgentExposedCommand(command)).toBe(false);
    }
    expect(isAgentExposedCommand('commande_inexistante')).toBe(false);
    expect(exposed.length).toBeGreaterThan(0);
  });

  it('publie un JSON Schema utilisable par tools/list, sans $schema', () => {
    const schema = commandInputJsonSchema('order_refund') as {
      type?: string;
      properties?: Record<string, unknown>;
      additionalProperties?: boolean;
      $schema?: string;
    };
    expect(schema.$schema).toBeUndefined();
    expect(schema.type).toBe('object');
    expect(Object.keys(schema.properties ?? {})).toContain('order_id');
    expect(Object.keys(schema.properties ?? {})).toContain('amount_cents');
  });

  it('n’expose aucun outil pour une commande inconnue', () => {
    expect(() => commandInputJsonSchema('commande_inexistante')).toThrow(ApiError);
    expect(commandByCommand('commande_inexistante')).toBeUndefined();
  });
});
