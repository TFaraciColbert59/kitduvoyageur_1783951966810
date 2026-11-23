/** Index « événement:révision » → version de l'espace d'itinéraire d'origine (10.5). Pur, testé. */
export function indexClubRouteSources(rows: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(rows)) return out;
  for (const row of rows as Array<{ event_id?: unknown; revision?: unknown; source_revision_no?: unknown }>) {
    if (typeof row?.event_id !== 'string' || row.source_revision_no == null) continue;
    const revision = Number(row.revision);
    const no = Number(row.source_revision_no);
    if (Number.isInteger(revision) && Number.isInteger(no) && no > 0) out.set(`${row.event_id}:${revision}`, no);
  }
  return out;
}
