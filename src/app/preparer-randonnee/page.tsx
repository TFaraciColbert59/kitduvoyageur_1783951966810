import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** /preparer-randonnee — Redirection directe vers le cockpit départ du hub (307, sans chaîne). */
export default async function PreparerRandonneePage({
  searchParams,
}: {
  searchParams: Promise<{ routeId?: string }>;
}) {
  const params = await searchParams;
  const routeId = params?.routeId;

  if (routeId) {
    redirect(`/hub/depart?id=none&route=${routeId}`);
  }

  redirect('/hub/depart');
}
