'use client';
import Link from 'next/link';
export const FIELD =
  'w-full min-h-11 rounded-[var(--lkv-radius-control)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] px-3 py-2 text-[color:var(--glass-label)] [&_option]:bg-[#16251D] [&_option]:text-[#F1F5F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
export const money = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export function ManualNotice() {
  return (
    <p className="text-sm text-[color:var(--glass-label-secondary)]">
      Accords et remises suivis manuellement entre participants. Aucun paiement encaissé ou protégé
      par LKDV, aucune caution préautorisée. Assurance, vérification d’identité et transporteur ne
      sont pas activés.
    </p>
  );
}
export function SignIn({ next }: { next: string }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center underline"
      href={`/connexion?next=${encodeURIComponent(next)}`}
    >
      Se connecter pour continuer
    </Link>
  );
}
export async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body !== undefined
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'La demande n’a pas pu être enregistrée. Réessayez.'
    );
  if (!data) throw new Error('Réponse du serveur invalide.');
  return data as T;
}
export function Feedback({ error, message }: { error: string; message?: string }) {
  return (
    <>
      {error && (
        <p role="alert" className="text-[color:var(--lkv-danger)]">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
