import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_LKDV_URL: z.string().url().default('https://lekitduvoyageur.fr')
});

export type PublicEnv = z.infer<typeof publicSchema>;

let cached: PublicEnv | null = null;

/** Variables publiques : validées au premier usage (jamais au build). */
export function publicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_LKDV_URL: process.env.NEXT_PUBLIC_LKDV_URL
  });
  if (!parsed.success) {
    throw new Error(`Configuration publique incomplète : ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  cached = parsed.data;
  return cached;
}

export function sessionMaxHours(): number {
  return Number(process.env.CRM_SESSION_MAX_HOURS ?? 12);
}
export function idleMinutes(): number {
  return Number(process.env.CRM_IDLE_MINUTES ?? 30);
}

/** Briques optionnelles : présentes ou non. Ne révèle jamais de valeur. */
export type Brick = { id: string; label: string; ready: boolean; fallback: string };

export function brickStatus(): Brick[] {
  const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).length > 8);
  return [
    { id: 'service_role', label: 'Actions Auth d’administration (bannir, révoquer les sessions)', ready: has('SUPABASE_SERVICE_ROLE_KEY'), fallback: 'Les commandes de bannissement et de révocation restent proposées, l’exécution Auth est désactivée.' },
    { id: 'stripe_test', label: 'Remboursements Stripe', ready: has('STRIPE_SECRET_KEY'), fallback: 'Préparation et validation possibles ; l’appel Stripe reste désactivé.' },
    { id: 'stripe_webhook', label: 'Webhook Stripe', ready: has('STRIPE_WEBHOOK_SECRET_CRM'), fallback: 'Les événements Stripe ne sont pas reçus.' },
    { id: 'nvidia', label: 'Agents IA (NVIDIA NIM)', ready: has('NVIDIA_API_KEY'), fallback: 'Agents éteints ; la file humaine continue.' },
    { id: 'resend', label: 'Alertes e-mail (Resend)', ready: has('RESEND_API_KEY'), fallback: 'Alertes dans le CRM et notification navigateur seulement.' },
    { id: 'cron_secret', label: 'Tâches planifiées (CRON_SECRET)', ready: has('CRON_SECRET'), fallback: 'Aucun cron ne peut s’exécuter.' },
    { id: 'agent_signing', label: 'Jetons courts des agents', ready: has('AGENT_TOKEN_SIGNING'), fallback: 'Agents incapables de s’authentifier.' }
  ];
}
