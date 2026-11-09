import { NextResponse } from 'next/server';
import { requireStaffSession } from '../../../../server/session';
import { apiError } from '../../../../lib/errors';

/**
 * Export CSV du journal d'audit (super admin / responsable).
 * Les colonnes sont celles du journal ; aucune donnée dérivée n'est ajoutée.
 */
export async function GET(request: Request) {
  try {
    const session = await requireStaffSession();
    if (session.role === 'membre') throw apiError('role_too_low');
    const url = new URL(request.url);
    const filters = {
      period: url.searchParams.get('periode') ?? 'aujourdhui',
      actor: url.searchParams.get('acteur') ?? 'tous',
      type: url.searchParams.get('type') ?? 'toutes'
    };
    const { data, error } = await session.client.rpc('audit_page' as never, {
      p_before: null,
      p_limit: 5000,
      p_filters: filters
    } as never);
    if (error) throw apiError('rpc_failed');
    const rows = ((data as { rows?: Record<string, unknown>[] } | null)?.rows ?? []) as Record<string, unknown>[];
    const columns = ['created_at', 'actor', 'actor_kind', 'role', 'command', 'target_kind', 'target_id', 'reason', 'request_id', 'solo', 'pii'];
    const escape = (value: unknown) => {
      const text = value === null || value === undefined ? '' : String(value);
      return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
    };
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
    return new NextResponse(`\ufeff${csv}`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="journal-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store'
      }
    });
  } catch (error) {
    const hint = (error as { hint?: string }).hint ?? 'not_allowed';
    return NextResponse.json({ error: hint === 'role_too_low' ? 'Réservé aux responsables et super admins.' : 'Export impossible.' }, { status: hint === 'role_too_low' ? 403 : 400 });
  }
}
