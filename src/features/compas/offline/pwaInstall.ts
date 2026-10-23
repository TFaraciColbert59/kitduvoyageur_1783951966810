/**
 * Application web installable (PWA) à la place des stores payants (PLAN-100 phase 8, ⚖️).
 * Pur : décide quoi proposer selon le navigateur. Rien n'est installé sans geste de la personne.
 */
export type InstallMode = 'installed' | 'prompt' | 'ios-manual' | 'none';

export interface InstallEnv {
  userAgent: string;
  standalone: boolean;
  hasPromptEvent: boolean;
}

export function installMode(env: InstallEnv): InstallMode {
  if (env.standalone) return 'installed';
  if (env.hasPromptEvent) return 'prompt';
  const ios =
    /iPhone|iPad|iPod/i.test(env.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(env.userAgent);
  return ios ? 'ios-manual' : 'none';
}

/** Champs que le manifeste doit porter pour que les navigateurs proposent l'installation. */
export function manifestProblems(m: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color']) {
    if (!m[k]) out.push(`champ « ${k} » absent`);
  }
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(String(m.display))) {
    out.push('display non installable');
  }
  const icons = Array.isArray(m.icons) ? (m.icons as Array<{ sizes?: string }>) : [];
  const sizes = icons.map((i) => i.sizes);
  if (!sizes.includes('192x192')) out.push('icône 192x192 absente');
  if (!sizes.includes('512x512')) out.push('icône 512x512 absente');
  return out;
}
