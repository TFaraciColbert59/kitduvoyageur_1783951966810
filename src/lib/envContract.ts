/**
 * Contrat déclaratif des variables d'environnement du HUB LKDV (P00-06).
 *
 * - Aucun secret ni valeur n'est jamais retourné ou journalisé (redacted only).
 * - Chaque module reçoit un statut explicite : 'configured' | 'missing_optional' | 'missing_required'.
 * - Une variable optionnelle absente ne bloque jamais les autres widgets.
 */

export type EnvScope = 'public' | 'server';
export type EnvFeatureStatus = 'configured' | 'missing_optional' | 'missing_required';

export interface EnvVarSpec {
  name: string;
  aliases?: string[];
  scope: EnvScope;
  required: boolean;
  feature: string;
}

export const HUB_ENV_CONTRACT: readonly EnvVarSpec[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', scope: 'public', required: true, feature: 'supabase_core' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', scope: 'public', required: true, feature: 'supabase_core' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', scope: 'server', required: false, feature: 'supabase_admin' },
  { name: 'LKDV_HUB_LAYOUT', scope: 'server', required: false, feature: 'hub_rollback_flag' },
  { name: 'LKDV_HUB_RECETTE', scope: 'server', required: false, feature: 'hub_recette_preview' },
  { name: 'NEXT_PUBLIC_MAPTILER_KEY', aliases: ['MAPTILER_API_KEY'], scope: 'public', required: false, feature: 'map_tiles' },
  { name: 'NASA_FIRMS_MAP_KEY', scope: 'server', required: false, feature: 'wildfire_firms' },
  { name: 'METEO_FRANCE_API_KEY', scope: 'server', required: false, feature: 'weather_official_alerts' },
  { name: 'OPENROUTESERVICE_API_KEY', scope: 'server', required: false, feature: 'routing_external' },
  { name: 'GEMINI_API_KEY', scope: 'server', required: false, feature: 'ai_assistant' },
  { name: 'STRIPE_SECRET_KEY', scope: 'server', required: false, feature: 'payments' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', scope: 'public', required: false, feature: 'payments' },
] as const;

export interface RedactedEnvFeatureReport {
  feature: string;
  status: EnvFeatureStatus;
  scope: EnvScope;
  configuredKeys: string[];
  missingKeys: string[];
}

export interface RedactedEnvAudit {
  environment: 'local' | 'preview' | 'production' | 'unknown';
  isValid: boolean;
  targetHost: string | null;
  features: RedactedEnvFeatureReport[];
}

function isConfiguredValue(raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^(your[-_]|changeme|placeholder|todo|xxx)/i.test(trimmed)) return false;
  return true;
}

function resolveEnvValue(env: Record<string, string | undefined>, spec: EnvVarSpec): boolean {
  if (isConfiguredValue(env[spec.name])) return true;
  if (spec.aliases?.some((alias) => isConfiguredValue(env[alias]))) return true;
  return false;
}

export function auditEnvContract(
  env: Record<string, string | undefined> = process.env,
): RedactedEnvAudit {
  const byFeature = new Map<string, { scope: EnvScope; configured: string[]; missingReq: string[]; missingOpt: string[] }>();

  for (const spec of HUB_ENV_CONTRACT) {
    const entry = byFeature.get(spec.feature) ?? {
      scope: spec.scope,
      configured: [],
      missingReq: [],
      missingOpt: [],
    };
    if (spec.scope === 'server') entry.scope = 'server';

    if (resolveEnvValue(env, spec)) {
      entry.configured.push(spec.name);
    } else if (spec.required) {
      entry.missingReq.push(spec.name);
    } else {
      entry.missingOpt.push(spec.name);
    }
    byFeature.set(spec.feature, entry);
  }

  const features: RedactedEnvFeatureReport[] = [];
  let isValid = true;
  for (const [feature, data] of byFeature.entries()) {
    const status: EnvFeatureStatus = data.missingReq.length > 0
      ? 'missing_required'
      : data.configured.length > 0
        ? 'configured'
        : 'missing_optional';
    if (status === 'missing_required') isValid = false;
    features.push({
      feature,
      status,
      scope: data.scope,
      configuredKeys: data.configured,
      missingKeys: [...data.missingReq, ...data.missingOpt],
    });
  }

  let targetHost: string | null = null;
  const urlRaw = env.NEXT_PUBLIC_SUPABASE_URL;
  if (urlRaw) {
    try {
      targetHost = new URL(urlRaw).hostname;
    } catch {
      targetHost = null;
    }
  }

  const vercelEnv = env.VERCEL_ENV;
  const environment = vercelEnv === 'production'
    ? 'production'
    : vercelEnv === 'preview'
      ? 'preview'
      : targetHost === '127.0.0.1' || targetHost === 'localhost'
        ? 'local'
        : 'unknown';

  return { environment, isValid, targetHost, features };
}
