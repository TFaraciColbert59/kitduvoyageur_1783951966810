/**
 * « Où · Parcours » : parcours du catalogue et activités partenaires dans une
 * seule liste, sans rubrique séparée. Les parcours gardent leur ordre (du plus
 * proche au plus loin) ; une activité partenaire s'insère après chaque groupe
 * de `every` parcours, puis le reste suit.
 */
export type ParcoursItem<R, A> = { kind: 'route'; item: R } | { kind: 'activity'; item: A };

export function mixParcours<R, A>(routes: R[], activities: A[], every = 2): ParcoursItem<R, A>[] {
  const step = Math.max(1, Math.floor(every));
  const out: ParcoursItem<R, A>[] = [];
  let a = 0;
  routes.forEach((r, i) => {
    out.push({ kind: 'route', item: r });
    if ((i + 1) % step === 0 && a < activities.length)
      out.push({ kind: 'activity', item: activities[a++] });
  });
  while (a < activities.length) out.push({ kind: 'activity', item: activities[a++] });
  return out;
}
