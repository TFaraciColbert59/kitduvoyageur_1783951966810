/**
 * SSO externe (OAuth / OIDC / SAML via Supabase Auth).
 * Les fournisseurs se déclarent dans `NEXT_PUBLIC_SSO_PROVIDERS`
 * (ex. "azure,google") ET dans le dashboard Supabase (Auth > Providers,
 * clés + redirect `https://<projet>.supabase.co/auth/v1/callback`).
 * Vide par défaut : aucun bouton, comportement inchangé.
 */

const KNOWN_PROVIDERS = [
  'apple',
  'azure',
  'bitbucket',
  'discord',
  'facebook',
  'figma',
  'github',
  'gitlab',
  'google',
  'kakao',
  'keycloak',
  'linkedin_oidc',
  'notion',
  'slack_oidc',
  'spotify',
  'twitch',
  'twitter',
  'workos',
  'zoom',
] as const;

export type SsoProviderId = (typeof KNOWN_PROVIDERS)[number];

const LABELS: Record<SsoProviderId, string> = {
  apple: 'Apple',
  azure: 'Microsoft',
  bitbucket: 'Bitbucket',
  discord: 'Discord',
  facebook: 'Facebook',
  figma: 'Figma',
  github: 'GitHub',
  gitlab: 'GitLab',
  google: 'Google',
  kakao: 'Kakao',
  keycloak: 'Keycloak',
  linkedin_oidc: 'LinkedIn',
  notion: 'Notion',
  slack_oidc: 'Slack',
  spotify: 'Spotify',
  twitch: 'Twitch',
  twitter: 'X',
  workos: 'WorkOS',
  zoom: 'Zoom',
};

function isKnown(id: string): id is SsoProviderId {
  return (KNOWN_PROVIDERS as readonly string[]).includes(id);
}

/** Fournisseurs SSO activés (allowlist stricte, jamais d'arbitraire). */
export function getSsoProviders(): { id: SsoProviderId; label: string }[] {
  const raw = process.env.NEXT_PUBLIC_SSO_PROVIDERS ?? '';
  const seen = new Set<string>();
  const out: { id: SsoProviderId; label: string }[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim().toLowerCase();
    if (id && isKnown(id) && !seen.has(id)) {
      seen.add(id);
      out.push({ id, label: LABELS[id] });
    }
  }
  return out;
}
