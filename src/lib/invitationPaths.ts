/**
 * Chemins publics d'une invitation à un profil privé.
 *
 * Le jeton est opaque (base64url) : il ne doit jamais être confondu avec le
 * lien d'invitation à un voyage (`/invitation/<token>`), qui a sa propre page.
 */

export function profileInvitationPath(token: string): string {
  return `/invitation/profil/${encodeURIComponent(token)}`;
}

export function profileInvitationLoginPath(token: string): string {
  return `/connexion?next=${encodeURIComponent(profileInvitationPath(token))}`;
}
