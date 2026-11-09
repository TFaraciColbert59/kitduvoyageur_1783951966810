import 'server-only';
import type { ServiceDb } from '@/server/db';

/**
 * Ressources MCP en lecture : file du pôle de l'agent.
 * Toute donnée personnelle est masquée avant sortie (jamais d'e-mail, de
 * téléphone, d'adresse ni de contenu de message privé).
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?\d[\s.-]?){9,15}/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:[\s-]?[A-Z0-9]{4}){3,7}\b/g;
const LONG_ID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Masque les données personnelles d'un texte libre, tronque à 240 caractères. */
export function maskText(value: unknown, max = 240): string {
  if (typeof value !== 'string') return '';
  const clean = value
    .replace(EMAIL, '[e-mail masqué]')
    .replace(IBAN, '[iban masqué]')
    .replace(PHONE, '[téléphone masqué]')
    .replace(LONG_ID, '[identifiant masqué]')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export type MaskedInboxItem = {
  key: string;
  source: string;
  id: string;
  group: string;
  title: string;
  subtitle: string;
  pole: string;
  urgency: 'haute' | 'normale';
  due_at: string | null;
  created_at: string;
  badges: string[];
};

export type PoleInboxPayload = {
  pole: string;
  items: MaskedInboxItem[];
  count: number;
  unavailable: boolean;
  note?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function maskItem(raw: unknown, pole: string): MaskedInboxItem | null {
  const item = asRecord(raw);
  if (item.pole !== pole) return null;
  const id = typeof item.id === 'string' ? item.id : null;
  const source = typeof item.source === 'string' ? item.source : null;
  const key = typeof item.key === 'string' ? item.key : id;
  if (!id || !source || !key) return null;
  return {
    key,
    source,
    id,
    group: typeof item.group === 'string' ? item.group : 'signalements',
    title: maskText(item.title) || 'Sans titre',
    subtitle: maskText(item.subtitle),
    pole,
    urgency: item.urgency === 'haute' ? 'haute' : 'normale',
    due_at: typeof item.due_at === 'string' ? item.due_at : null,
    created_at: typeof item.created_at === 'string' ? item.created_at : '',
    badges: Array.isArray(item.badges)
      ? item.badges.filter((badge): badge is string => typeof badge === 'string').slice(0, 6).map((badge) => maskText(badge, 40))
      : []
  };
}

/**
 * File du pôle. On essaie les RPC prévues (`admin.inbox`, puis
 * `admin.agent_inbox`), toujours avec `service_role` ; en cas d'absence on
 * renvoie un payload vide marqué indisponible — jamais une erreur brute.
 */
export async function readPoleInbox(db: ServiceDb, pole: string, limit = 25): Promise<PoleInboxPayload> {
  const attempts: { rpc: string; args: Record<string, unknown> }[] = [
    { rpc: 'inbox', args: {} },
    { rpc: 'agent_inbox', args: { p_pole: pole } }
  ];

  for (const attempt of attempts) {
    const { data, error } = await db.schema('admin').rpc(attempt.rpc, attempt.args);
    if (error) continue;
    const payload = asRecord(data);
    const rows = Array.isArray(payload.items) ? payload.items : Array.isArray(data) ? data : [];
    const items = rows
      .map((row) => maskItem(row, pole))
      .filter((row): row is MaskedInboxItem => row !== null)
      .slice(0, limit);
    return { pole, items, count: items.length, unavailable: false };
  }

  return {
    pole,
    items: [],
    count: 0,
    unavailable: true,
    note: 'File indisponible pour ce jeton. Utilise les outils de lecture autorisés.'
  };
}

export const TEN_MINUTES_MS = 10 * 60_000;
