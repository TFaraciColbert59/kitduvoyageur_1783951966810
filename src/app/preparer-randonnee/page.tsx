import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** /preparer-randonnee — Page supprimée, redirige vers /materiel/depart */
export default async function PreparerRandonneePage({
  searchParams,
}: {
  searchParams: Promise<{ routeId?: string }>;
}) {
  const params = await searchParams;
  const routeId = params?.routeId;

  if (routeId) {
    redirect(`/materiel/depart/none?route=${routeId}`);
  }

  redirect('/materiel/depart');
}
