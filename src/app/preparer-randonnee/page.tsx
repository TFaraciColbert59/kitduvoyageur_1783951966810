import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** /preparer-randonnee — Redirection héritée vers la route serveur de préparation (307, sans chaîne). */
export default async function PreparerRandonneePage({
  searchParams,
}: {
  searchParams: Promise<{ routeId?: string }>;
}) {
  const params = await searchParams;
  const routeId = params?.routeId;

  if (routeId) {
    redirect(`/preparer-sentier/${routeId}`);
  }

  redirect('/hub');
}
