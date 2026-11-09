import 'server-only';
import { logServer, redact } from '../lib/errors';

/**
 * Resend — alertes d’équipe uniquement.
 *
 * Interdits (08_GARDE_FOUS § 1.14) : jamais un membre de la communauté, jamais
 * une adresse libre. Les destinataires viennent de `TEAM_ALERT_EMAILS`
 * (adresses d’équipe) et, hors production, de `delivered@resend.dev`.
 * Clé absente → l’appelant continue sans e-mail et l’écrit dans le CRM.
 */
const RESEND_URL = 'https://api.resend.com/emails';
const SANDBOX_RECIPIENT = 'delivered@resend.dev';

export type AlertEmail = {
  subject: string;
  text: string;
  idempotencyKey?: string;
  to?: string[];
};

export type AlertSendResult = {
  sent: boolean;
  skipped?: 'email_unavailable' | 'no_team_recipient' | 'not_production_safe';
  id?: string;
};

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && String(process.env.RESEND_API_KEY).length > 8);
}

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

function allowedDomains(): string[] {
  const raw = process.env.TEAM_ALERT_DOMAINS ?? 'lekitduvoyageur.fr';
  return raw
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/** Adresse d’équipe attendue : bac à sable Resend ou domaine de l’équipe. */
export function isTeamRecipient(address: string): boolean {
  const value = address.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return false;
  if (value.endsWith('@resend.dev')) return true;
  const domain = value.split('@')[1] ?? '';
  return allowedDomains().some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

/** Destinataires autorisés : liste d’équipe + bac à sable hors production. */
export function teamRecipients(extra?: string[]): string[] {
  const configured = (process.env.TEAM_ALERT_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const candidates = [...configured, ...(extra ?? []), ...(isProduction() ? [] : [SANDBOX_RECIPIENT])];
  return [...new Set(candidates)].filter(isTeamRecipient);
}

function fromAddress(): string | null {
  const configured = process.env.ALERT_FROM_EMAIL?.trim();
  if (configured) return configured;
  return isProduction() ? null : 'LKDV Control <onboarding@resend.dev>';
}

/** Envoi best-effort : ne lève jamais, retourne un statut lisible. */
export async function sendTeamAlert(input: AlertEmail): Promise<AlertSendResult> {
  if (!resendConfigured()) return { sent: false, skipped: 'email_unavailable' };

  const recipients = teamRecipients(input.to);
  if (recipients.length === 0) return { sent: false, skipped: 'no_team_recipient' };

  const from = fromAddress();
  if (!from) return { sent: false, skipped: 'not_production_safe' };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (input.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey.slice(0, 200);

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { ...headers, Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: redact(input.subject).slice(0, 150),
        text: input.text.slice(0, 10_000)
      }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      logServer({ level: 'warn', scope: 'crm', event: 'resend_refused', message: `HTTP ${response.status}` });
      return { sent: false };
    }
    const body = (await response.json().catch(() => ({}))) as { id?: string };
    return { sent: true, ...(body.id ? { id: body.id } : {}) };
  } catch (error) {
    logServer({
      level: 'warn',
      scope: 'crm',
      event: 'resend_unreachable',
      message: error instanceof Error ? error.message : 'réseau'
    });
    return { sent: false };
  }
}
