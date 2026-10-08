/**
 * hCaptcha invisible (plan 2.2, offre gratuite) : un jeton à joindre à chaque
 * appel d'authentification Supabase (connexion, inscription, essai sans
 * compte, mot de passe oublié). Supabase le vérifie dès que la protection est
 * allumée dans Authentication → Bot and Abuse Protection.
 *
 * Sans clé de site (`NEXT_PUBLIC_HCAPTCHA_SITE_KEY`), ou côté serveur : aucun
 * jeton, rien ne change. Le script officiel est chargé à la première demande
 * seulement (aucun tiers contacté avant un geste d'authentification).
 */

const SCRIPT_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off';
const LOAD_TIMEOUT_MS = 10_000;

interface HCaptchaApi {
  render(container: HTMLElement, params: { sitekey: string; size: 'invisible' }): string;
  execute(widgetId: string, opts: { async: true }): Promise<{ response: string }>;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

export function hcaptchaSiteKey(): string | null {
  const k = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();
  return k ? k : null;
}

let loading: Promise<HCaptchaApi> | null = null;
let widgetId: string | null = null;

function loadApi(): Promise<HCaptchaApi> {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
  if (loading) return loading;
  loading = new Promise<HCaptchaApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    const timer = window.setTimeout(() => reject(new Error('hcaptcha_timeout')), LOAD_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.hcaptcha) resolve(window.hcaptcha);
      else reject(new Error('hcaptcha_absent'));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('hcaptcha_injoignable'));
    };
    document.head.appendChild(script);
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/**
 * Un jeton hCaptcha à usage unique, ou `undefined` (pas de clé, serveur, ou
 * hCaptcha injoignable : l'appel part sans jeton et Supabase dit lui-même s'il
 * en exigeait un).
 */
export async function getCaptchaToken(siteKey: string | null = hcaptchaSiteKey()): Promise<string | undefined> {
  if (!siteKey || typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  try {
    const api = await loadApi();
    if (widgetId == null) {
      const container = document.createElement('div');
      container.setAttribute('data-hcaptcha', 'invisible');
      container.style.display = 'none';
      document.body.appendChild(container);
      widgetId = api.render(container, { sitekey: siteKey, size: 'invisible' });
    } else {
      api.reset(widgetId);
    }
    const { response } = await api.execute(widgetId, { async: true });
    return response || undefined;
  } catch (err) {
    console.warn('[captcha] jeton indisponible', err instanceof Error ? err.message : 'erreur');
    return undefined;
  }
}

/** Tests : oublie le script et le widget. */
export function resetCaptchaForTests(): void {
  loading = null;
  widgetId = null;
}
