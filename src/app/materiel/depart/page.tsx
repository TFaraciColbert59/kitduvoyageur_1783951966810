import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** /materiel/depart — accès au prochain départ sans id : redirige vers le cockpit. */
export default async function DepartIndexPage({
  searchParams,
}: {
  searchParams?: Promise<{ route?: string; routeId?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const route = sp.route || sp.routeId;
  redirect(route ? `/materiel/depart/none?route=${encodeURIComponent(route)}` : '/materiel/depart/none');
}