import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** /materiel/depart — accès au prochain départ sans id : redirige vers le cockpit. */
export default function DepartIndexPage() {
  redirect('/materiel/depart/none');
}