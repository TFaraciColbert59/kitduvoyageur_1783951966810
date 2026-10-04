import { DEFAULT_LKDV_SYSTEM } from '@/lib/ai/requestMode';

export interface PaysChatInput {
  countryCode: string;
  /** Optionnel : repli sur le code ISO quand le nom est inconnu (route API). */
  countryName?: string;
  question: string;
  seasonMd?: string;
}

export interface PaysChatRequest {
  provider: 'nemotron';
  task: 'fast';
  system: string;
  messages: Array<{ role: 'user'; content: string }>;
  stream: false;
}

const MAX_SYSTEM = 8000;
const MAX_SEASON = 1500;

export function buildPaysChatRequest(input: PaysChatInput): PaysChatRequest {
  const code = input.countryCode.trim().toUpperCase();
  const name = input.countryName?.trim() || code;
  const season = (input.seasonMd ?? '').slice(0, MAX_SEASON);
  const anchor =
    `Pays concerné : ${name} (${code}). ` +
    (season ? `Contexte vérifié du guide pays : ${season} ` : '') +
    `Réponds en t'appuyant en priorité sur ce contexte. ` +
    `Si la demande porte sur un kit de voyage, réponds par une liste à puces d'articles concrets. ` +
    `Si elle porte sur la période idéale, donne les mois et pourquoi. ` +
    `Cite les sources du guide quand elles existent. N'invente aucune donnée factuelle hors contexte.`;
  const system = `${DEFAULT_LKDV_SYSTEM} ${anchor}`.slice(0, MAX_SYSTEM);
  return {
    provider: 'nemotron',
    task: 'fast',
    system,
    messages: [{ role: 'user', content: input.question }],
    stream: false,
  };
}

export function extractKitItems(markdown: string): string[] {
  const items: string[] = [];
  for (const line of markdown.split('\n')) {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/);
    if (m && m[1] && !items.includes(m[1]) && items.length < 50) items.push(m[1]);
  }
  return items;
}
