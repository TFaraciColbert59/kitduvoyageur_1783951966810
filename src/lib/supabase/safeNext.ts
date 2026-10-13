/**
 * Destination interne après un retour d'e-mail (`/auth/callback?next=…`). Seul un chemin du
 * site passe : `//autre.site`, `/\autre.site`, `https://…` ou un caractère de contrôle
 * (`new URL('//x.fr', origin)` sortirait du site) retombent sur `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/compte'): string {
  if (typeof next !== 'string' || next.length === 0 || next.length > 300) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(next)) return fallback;
  return next;
}
