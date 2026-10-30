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
  const next = typeof params?.next === 'string' ? params.next : null;
  redirect(`/connexion?mode=inscription${next ? `&next=${encodeURIComponent(next)}` : ''}`);
}
