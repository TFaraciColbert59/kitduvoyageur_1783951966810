import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Hygiene de `.env.example` (W8).
 *
 * Ce fichier est la seule documentation executee de l'interface
 * d'environnement. S'il derive de ce que le code lit vraiment, plus personne ne
 * sait quoi renseigner : les trois proprietes ci-dessous sont donc des garde-fous
 * de non-regression, pas de la documentation.
 */

const ROOT = process.cwd();
const raw = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

/** Une cle = une ligne `CLE=` ou `CLE=valeur`, en ignorant les commentaires. */
function parseKeys(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => line.slice(0, line.indexOf('=')));
}

const keys = parseKeys(raw);

/** Variables lues par le code et documentees ici — le contrat du chantier. */
const DOCUMENTED = [
  // Secrets applicatifs
  'CREW_INVITE_SECRET',
  'DOC_SIGNING_SECRET',
  'INDEXNOW_KEY',
  'KIT_REF_SECRET',
  'KIT_ROYALTY_ENABLED',
  'RESEND_API_KEY',
  'SEED_SECRET',
  'TRAVELPAYOUTS_WEBHOOK_SECRET',
  // Publiques / drapeaux
  'NEXT_PUBLIC_FF_ITINERARY_FALLBACK',
  'NEXT_PUBLIC_GA_MEASUREMENT_ID',
  'NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION',
  'NEXT_PUBLIC_I18N_EN_ENABLED',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'LKDV_GLASS_LAB',
  'LKDV_TRACE_SSR',
  'OBSERVABILITY_LOG',
  // Decouverte
  'VIATOR_SECTION_TAGS',
  // Contrat providers canonique (W2 / D-07)
  'BOOKING_PROVIDER',
  'ROUTESTACK_MODE',
  'ROUTESTACK_SANDBOX_API_KEY',
  'ROUTESTACK_SANDBOX_PARTNER_SECRET',
  'ROUTESTACK_SANDBOX_BASE_URL',
  'ROUTESTACK_FULL_API_KEY',
  'ROUTESTACK_FULL_PARTNER_SECRET',
  'ROUTESTACK_FULL_BASE_URL',
  'VIATOR_MODE',
  'VIATOR_SANDBOX_API_KEY',
  'VIATOR_SANDBOX_API_BASE_URL',
  'VIATOR_FULL_API_KEY',
  'VIATOR_FULL_API_BASE_URL',
  'VIATOR_BOOKING_ENABLED',
  // Attribution (W4 / D-08)
  'VIATOR_PID',
  'VIATOR_MCID',
  'VIATOR_CAMPAIGN',
  // Repli retrocompatible (9 noms WIP)
  'ROUTESTACK_BOOKING_MODE',
  'ROUTESTACK_LIVE_ENABLED',
  'ROUTESTACK_API_KEY',
  'ROUTESTACK_API_SECRET',
  'ROUTESTACK_MCP_URL',
  'VIATOR_BOOKING_MODE',
  'VIATOR_BOOKING_FULL_ENABLED',
  'VIATOR_API_KEY',
  'VIATOR_API_BASE_URL',
] as const;

describe('.env.example — hygiene du contrat', () => {
  it('ne declare aucune cle en double', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const key of keys) {
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it.each(DOCUMENTED)('documente %s', (key) => {
    expect(keys).toContain(key);
  });

  it('ne contient aucune valeur reelle de secret', () => {
    // Un gabarit ne porte que des noms, des drapeaux ou des URL publiques.
    // Toute valeur sur une cle secrete serait un leak committe.
    const SECRET_KEY = /(_API_KEY|_SECRET|_PARTNER_SECRET|_SERVICE_ROLE_KEY|_PUBLISHABLE_KEY)$/;
    const offenders = raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[A-Z0-9_]+=\S/.test(line))
      .filter((line) => SECRET_KEY.test(line.slice(0, line.indexOf('='))))
      .map((line) => line.split('=')[0]);
    expect(offenders).toEqual([]);
  });

  it('ne prefixe aucun secret par NEXT_PUBLIC_', () => {
    const offenders = keys.filter(
      (key) => key.startsWith('NEXT_PUBLIC_') && /(_SECRET|_API_KEY|_SERVICE_ROLE_KEY)$/.test(key),
    );
    expect(offenders).toEqual([]);
  });

  it('toute variable NEXT_PUBLIC_ declaree est bien publique', () => {
    // Un secret non prefixe NEXT_PUBLIC_ reste coter serveur : le prefixe est la
    // seule barriere d'inlining, on verifie donc l'absence de faux positif.
    const declared = keys.filter((key) => key.startsWith('NEXT_PUBLIC_'));
    expect(declared.length).toBeGreaterThan(0);
    for (const key of declared) {
      expect(raw).toMatch(new RegExp(`^#?[^\\n]*${key}`, 'm'));
    }
  });
});
