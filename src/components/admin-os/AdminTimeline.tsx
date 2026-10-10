/** Timeline d'événements (audit, incident, commande) — stable, keyboard-navigable. */
export interface TimelineItem {
  id: string;
  at: string;
  label: string;
  detail?: string;
}

export function AdminTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="os-timeline">
      {items.map((i) => (
        <li key={i.id} className="os-timeline-item">
          <time dateTime={i.at}>{i.at}</time>
          <p>{i.label}</p>
          {i.detail ? <p className="os-timeline-detail">{i.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
