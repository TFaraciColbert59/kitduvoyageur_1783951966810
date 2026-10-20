import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Réservations (PLAN-100 phase 8) : le Compas cherche et envoie chez le partenaire ; il ne
 * paie jamais. Verrou de contrat : lecture seule, mode test dit, liens sponsorisés.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('réservations en lecture seule', () => {
  const actions = read('src/features/compas/server/resaActions.ts');
  const sheets = read('src/features/compas/components/CompasSheets.tsx');
  const provider = read('src/features/booking/server/bookingProviderTypes.ts');

  it('les actions de réservation du Compas ne créent ni commande ni paiement', () => {
    expect(actions).not.toMatch(/checkoutUrl\(|stripe|paymentIntent|createOrder|bookOffer/i);
    expect(actions).toMatch(/provider\.search\(/);
  });
  it('la recherche passe par la limite de débit et l’authentification', () => {
    expect(actions).toMatch(/enforceRateLimit/);
    expect(actions).toMatch(/failMode: 'closed'/);
  });
  it('le mode test du partenaire est dit à l’écran (hôtels et activités)', () => {
    expect(sheets.match(/state\.mode === 'sandbox'/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it('chaque lien sortant du parcours est sponsorisé, sans suivi de référent', () => {
    const rels = sheets.match(/rel="[^"]*"/g) ?? [];
    expect(rels.length).toBeGreaterThanOrEqual(4);
    for (const r of rels) expect(r).toMatch(/sponsored nofollow noopener/);
  });
  it('la sortie chez le partenaire est un lien (deeplink), pas un paiement intégré', () => {
    expect(provider).toMatch(/CheckoutMode = 'deeplink' \| 'acp' \| 'external'/);
  });
});
