/**
 * Phase 6 TRIBU — actions des modèles de checklist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  publishTaskTemplate,
  listGroupTaskTemplates,
  applyTaskTemplate,
} from '@/features/tribu/actions/taskTemplates';

const ME = '11111111-1111-4111-8111-111111111111';
const CLUB = '22222222-2222-4222-8222-222222222222';
const GROUP = '33333333-3333-4333-8333-333333333333';
const TEMPLATE = '44444444-4444-4444-8444-444444444444';

interface MockOptions {
  user?: { id: string } | null;
  membership?: unknown;
  templateInsert?: { data: unknown; error: { message: string } | null };
  templates?: unknown[];
  items?: unknown[];
  itemsError?: { message: string } | null;
  taskInsertError?: { message: string } | null;
}

function createSession(options: MockOptions) {
  const calls: Array<{ table: string; op: string; payload?: unknown; args?: unknown }> = [];
  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {};
    let mode: 'select' | 'insert' | 'in' = 'select';
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.order = () => builder;
    builder.limit = () => builder;
    builder.maybeSingle = async () => ({ data: table === 'club_members' ? options.membership ?? null : null, error: null });
    builder.single = async () => options.templateInsert ?? { data: { id: TEMPLATE }, error: null };
    builder.or = (expression: string) => {
      calls.push({ table, op: 'or', args: [expression] });
      return builder;
    };
    builder.is = (column: string, value: unknown) => {
      calls.push({ table, op: 'is', args: [column, value] });
      return builder;
    };
    builder.in = (column: string, values: unknown) => {
      mode = 'in';
      calls.push({ table, op: 'in', args: [column, values] });
      return builder;
    };
    builder.insert = (payload: unknown) => {
      mode = 'insert';
      calls.push({ table, op: 'insert', payload });
      if (table === 'group_task_templates') {
        return { select: () => ({ single: async () => options.templateInsert ?? { data: { id: TEMPLATE }, error: null } }) };
      }
      return Promise.resolve({
        data: null,
        error: table === 'group_tasks' ? options.taskInsertError ?? null : null,
      });
    };
    builder.then = (resolve: (value: unknown) => unknown) => {
      if (table === 'group_task_templates') {
        return resolve({ data: options.templates ?? [], error: null });
      }
      if (table === 'group_task_template_items') {
        return resolve({
          data: options.itemsError ? null : options.items ?? [],
          error: options.itemsError ?? null,
        });
      }
      return resolve({ data: null, error: null });
    };
    return builder;
  }
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: options.user ?? null } }) },
    from: (table: string) => makeBuilder(table),
  };
}

const mockedCreateClient = vi.mocked(createClient);

describe('taskTemplates — actions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('(a) publication : refuse les entrées invalides sans requête', async () => {
    const result = await publishTaskTemplate({ clubId: CLUB, title: '', items: [] });
    expect(result).toEqual({ ok: false, error: 'Modèle invalide (titre + au moins un élément).' });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('(b) publication : session absente ou non-membre refusée', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }) as never);
    expect(await publishTaskTemplate({ clubId: CLUB, title: 'T', items: ['a'] })).toEqual({
      ok: false,
      error: 'Connexion requise.',
    });

    const session = createSession({ user: { id: ME }, membership: null });
    mockedCreateClient.mockResolvedValue(session as never);
    expect(await publishTaskTemplate({ clubId: CLUB, title: 'T', items: ['a'] })).toEqual({
      ok: false,
      error: 'Réservé aux membres du club.',
    });
    expect(session.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('(c) publication : template + items positionnés', async () => {
    const session = createSession({
      user: { id: ME },
      membership: { id: 'm1' },
      templateInsert: { data: { id: TEMPLATE }, error: null },
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await publishTaskTemplate({
      clubId: CLUB,
      title: 'Checklist club',
      items: ['Réserver', 'Vérifier météo'],
    });

    expect(result).toEqual({ ok: true, templateId: TEMPLATE });
    const templateInsert = session.calls.find(
      (c) => c.table === 'group_task_templates' && c.op === 'insert'
    );
    expect(templateInsert?.payload).toMatchObject({
      club_id: CLUB,
      title: 'Checklist club',
      source: 'club',
      created_by: ME,
    });
    const itemsInsert = session.calls.find(
      (c) => c.table === 'group_task_template_items' && c.op === 'insert'
    );
    expect(itemsInsert?.payload).toEqual([
      { template_id: TEMPLATE, title: 'Réserver', position: 0 },
      { template_id: TEMPLATE, title: 'Vérifier météo', position: 1 },
    ]);
  });

  it('(d) liste : filtres club + officiels et items groupés', async () => {
    const session = createSession({
      user: { id: ME },
      templates: [
        { id: TEMPLATE, title: 'Checklist club', source: 'club', club_id: CLUB },
        { id: 'other', title: 'Officielle', source: 'official', club_id: null },
      ],
      items: [
        { template_id: TEMPLATE, title: 'Un', position: 0 },
        { template_id: TEMPLATE, title: 'Deux', position: 1 },
      ],
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await listGroupTaskTemplates(CLUB);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.templates[0]).toMatchObject({
      id: TEMPLATE,
      items: ['Un', 'Deux'],
    });
    expect(
      session.calls.some(
        (c) => c.op === 'or' && String((c.args as unknown[])[0]).includes(`club_id.eq.${CLUB}`)
      )
    ).toBe(true);
  });

  it('(e) application : refuse vide/absence puis insère les tâches', async () => {
    mockedCreateClient.mockResolvedValue(createSession({ user: null }) as never);
    expect(await applyTaskTemplate({ groupId: GROUP, templateId: TEMPLATE })).toEqual({
      ok: false,
      error: 'Connexion requise.',
    });

    const session = createSession({
      user: { id: ME },
      items: [
        { title: 'Réserver', position: 0 },
        { title: 'Météo', position: 1 },
      ],
    });
    mockedCreateClient.mockResolvedValue(session as never);

    const result = await applyTaskTemplate({ groupId: GROUP, templateId: TEMPLATE });

    expect(result).toEqual({ ok: true, count: 2 });
    const insert = session.calls.find((c) => c.table === 'group_tasks' && c.op === 'insert');
    expect(insert?.payload).toEqual([
      { group_id: GROUP, created_by: ME, title: 'Réserver', status: 'todo' },
      { group_id: GROUP, created_by: ME, title: 'Météo', status: 'todo' },
    ]);
  });
});
