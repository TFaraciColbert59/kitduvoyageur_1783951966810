/** Métrique KPI avec source + fraîcheur (jamais de valeur inventée). */
export function AdminMetric({
  label,
  value,
  source,
  updatedAt,
}: {
  label: string;
  value: string;
  source?: string;
  updatedAt?: string;
}) {
  return (
    <div className="os-metric">
      <span className="os-metric-label">{label}</span>
      <strong className="os-metric-value">{value}</strong>
      {source ? <span className="os-metric-source">Source : {source}</span> : null}
      {updatedAt ? (
        <time className="os-metric-fresh" dateTime={updatedAt}>
          MAJ {updatedAt}
        </time>
      ) : null}
    </div>
  );
}
