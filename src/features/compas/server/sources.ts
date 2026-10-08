import 'server-only';

/**
 * Quelles sources gratuites le serveur peut-il appeler ? (plan 1.3 à 1.7)
 * Présence de chaque clé seulement (vrai/faux) : jamais une valeur ni un extrait.
 */
const present = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0;

export interface CompasSources {
  geoapify: boolean;
  locationiq: boolean;
  arcgis: boolean;
  hcaptcha: boolean;
  /** Captcha demandé aux visiteurs (`NEXT_PUBLIC_AUTH_CAPTCHA=on`). */
  captcha: boolean;
  nvidia: boolean;
  database: boolean;
}

export function compasSources(env: Record<string, string | undefined> = process.env): CompasSources {
  return {
    geoapify: present(env.GEOAPIFY_API_KEY),
    locationiq: present(env.LOCATIONIQ_API_KEY),
    arcgis: present(env.NEXT_PUBLIC_ARCGIS_API_KEY),
    hcaptcha: present(env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY),
    captcha: env.NEXT_PUBLIC_AUTH_CAPTCHA?.trim() === 'on' && present(env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY),
    nvidia: present(env.NVIDIA_API_KEY),
    database: present(env.NEXT_PUBLIC_SUPABASE_URL) && present(env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
