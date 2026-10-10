import { diffObjects } from '@/features/admin-os/audit/diff';

/** Diff avant/après : liste des champs modifiés (stable, pas de verre). */
export function AdminDiff({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const rows = diffObjects(before, after);
  if (rows.length === 0) return <p className="os-diff-empty">Aucune modification.</p>;
  return (
    <dl className="os-diff">
      {rows.map((r) => (
        <div key={r.field} className="os-diff-row">
          <dt>{r.field}</dt>
          <dd className="os-diff-before">{JSON.stringify(r.before)}</dd>
          <dd className="os-diff-after">{JSON.stringify(r.after)}</dd>
        </div>
      ))}
    </dl>
  );
}
