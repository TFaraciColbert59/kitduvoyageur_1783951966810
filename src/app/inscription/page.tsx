import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * L'inscription vit dans la page unique d'authentification (/connexion,
 * onglet « Inscription ») : même formulaire, même captcha, même suite.
 */
export default async function InscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ mode: 'inscription' });
  if (typeof params?.next === 'string' && params.next) query.set('next', params.next);
  if (typeof params?.ref === 'string' && params.ref) query.set('ref', params.ref);
  if (typeof params?.carnet === 'string' && params.carnet) query.set('carnet', params.carnet);
  redirect(`/connexion?${query.toString()}`);
}
