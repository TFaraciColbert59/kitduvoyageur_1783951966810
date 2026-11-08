import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  closeByEscape,
  freezeClock,
  gotoCommunity,
  installCommunityV2Mock,
  isServerReady,
  longPress,
  openCreate,
  openExplorer,
  type CommunityV2Mock,
} from '../../../../tests/e2e/communaute-v2.fixtures';

/**
 * Captures exhaustives — tiroirs Explorer/Création v2, sous-tiroirs et formulaires.
 * Sortie : `docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-v2/*.png`
 * (390×844, données simulées @ui-mock, zéro réseau, zéro base).
 *
 * Chaque capture est 390×844 pour une comparaison directe avec les 58 références
 * `recette/captures-maquette/`. Un manifeste est écrit à la fin (succès/échecs).
 */

const OUT = join(
  process.cwd(),
  'docs/audit/communaute-v2-2026-11-08/ecarts-maquette/captures-v2',
);
mkdirSync(OUT, { recursive: true });

const results: Array<{ shot: string; ok: boolean; error?: string }> = [];
let serverReady = false;

test.beforeAll(async ({ baseURL, request }) => {
  serverReady = await isServerReady(request, baseURL);
  mkdirSync(OUT, { recursive: true });
});

test.afterAll(() => {
  writeFileSync(
    join(OUT, 'MANIFEST.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        viewport: '390x844',
        base: process.env.PW_BASE_URL ?? 'http://127.0.0.1:4028',
        total: results.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok),
        shots: results,
      },
      null,
      2,
    ),
  );
});

test.beforeEach(() => {
  test.skip(!serverReady, 'serveur 4028 absent (lancer le build V2 puis next start)');
});

async function shot(page: Page, name: string): Promise<void> {
  try {
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(OUT, `${name}.png`), animations: 'disabled' });
    results.push({ shot: name, ok: true });
    console.log(`📸 ${name}.png`);
  } catch (error) {
    results.push({ shot: name, ok: false, error: String(error).slice(0, 300) });
    console.log(`✗ ${name}: ${String(error).slice(0, 200)}`);
  }
}

async function scenario(
  page: Page,
  name: string,
  prepare: () => Promise<void>,
): Promise<void> {
  try {
    await prepare();
    await shot(page, name);
  } catch (error) {
    results.push({ shot: name, ok: false, error: String(error).slice(0, 300) });
    console.log(`✗ scénario ${name}: ${String(error).slice(0, 300)}`);
    await shot(page, `${name}-ECHEC`).catch(() => undefined);
  }
}

function tab(page: Page, listName: string | RegExp, name: string) {
  return page.getByRole('tablist', { name: listName }).getByRole('tab', { name });
}

async function prepareExplorer(
  page: Page,
  options: Parameters<typeof installCommunityV2Mock>[1] = {},
  trigger: 'explorer' | 'search' = 'explorer',
): Promise<CommunityV2Mock> {
  const mock = await installCommunityV2Mock(page, options);
  await freezeClock(page);
  await gotoCommunity(page);
  const opened = await openExplorer(page, trigger);
  test.skip(!opened, 'build sans NEXT_PUBLIC_COMMUNAUTE_V2=true');
  return mock;
}

async function prepareCreate(
  page: Page,
  kind: 'post' | 'story' = 'post',
): Promise<CommunityV2Mock> {
  const mock = await installCommunityV2Mock(page);
  await freezeClock(page);
  await gotoCommunity(page);
  const opened = await openCreate(page, kind);
  test.skip(!opened, 'build sans NEXT_PUBLIC_COMMUNAUTE_V2=true');
  return mock;
}

/** Champ moteur `cv2-field-<name>` ou champ custom `#cv2c-<name>`. */
async function fillField(page: Page, name: string, value: string): Promise<void> {
  const engine = page.getByTestId(`cv2-field-${name}`).locator('input, textarea').first();
  if (await engine.count()) {
    await engine.fill(value);
    return;
  }
  await page.locator(`#cv2c-${name}`).fill(value);
}

async function selectType(page: Page, label: string): Promise<void> {
  await page.getByRole('tablist', { name: 'Type de création' }).getByRole('tab', { name: label }).click();
  await page.waitForTimeout(500);
}

async function currentStep(page: Page, kind: string): Promise<string | null> {
  return page.getByTestId(`cv2-form-${kind}`).getAttribute('data-step');
}

async function next(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(700);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLORER — les 4 volets, sous-tiroirs (détails, peek, tri, demandes), états
// ═══════════════════════════════════════════════════════════════════════════

test('captures Explorer — recherche (accueil, résultats, carte, erreur, états)', async ({ page }) => {
  await prepareExplorer(page, {}, 'search');
  await scenario(page, 'explorer-recherche', async () => {});

  await scenario(page, 'explorer-recherche-resultats', async () => {
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('ecrins');
    await page.getByTestId('cv2-tile-carnet').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(700);
  });

  await scenario(page, 'explorer-recherche-sur-la-carte', async () => {
    // Recouvrement CSS connu (.lkdv-cv2x-cover-fallback) : clic DOM forcé.
    await page.getByRole('button', { name: 'Sur la carte' }).click({ force: true });
    await page.waitForTimeout(1200);
  });
});

test('captures Explorer — recherche en erreur et chargement lent', async ({ page }) => {
  await prepareExplorer(page, { failRpcs: ['community_search'] }, 'search');
  await scenario(page, 'explorer-recherche-erreur', async () => {
    const input = page.getByRole('searchbox', { name: 'Rechercher dans toute la communauté' });
    await input.fill('vercors');
    await page.locator('.lkdv-cv2-error-state').waitFor({ state: 'visible', timeout: 15_000 });
  });
});

test('captures Explorer — états squelette et vide', async ({ page }) => {
  await prepareExplorer(page, { latencyMs: 2_500 });
  await scenario(page, 'explorer-etat-chargement', async () => {});
});

test('captures Explorer — état vide des carnets', async ({ page }) => {
  const mock = await prepareExplorer(page);
  mock.setState('empty');
  await tab(page, 'Filtres des carnets', 'Mes carnets').click().catch(() => undefined);
  await scenario(page, 'explorer-etat-vide', async () => {
    await page.waitForTimeout(900);
  });
});

test('captures Explorer — carnets : volet, tri, peek, détail', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Carnets').click();
  await scenario(page, 'explorer-carnets', async () => {});

  await scenario(page, 'explorer-carnets-tri-menu', async () => {
    await page.getByTestId('cv2-sort-button').click();
    await page.getByTestId('cv2-sort-menu').waitFor({ state: 'visible' });
  });
});

test('captures Explorer — peek carnet', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Carnets').click();
  await scenario(page, 'explorer-carnets-peek', async () => {
    const tile = page.getByTestId('cv2-tile-carnet').first();
    await tile.waitFor({ state: 'visible', timeout: 15_000 });
    await longPress(page, tile);
    await page.getByRole('dialog', { name: /Aperçu :/ }).waitFor({ state: 'visible', timeout: 8_000 });
  });
});

test('captures Explorer — carnet : la tuile ouvre la fiche existante (exception 01 § 6)', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Carnets').click();
  await scenario(page, 'explorer-carnets-fiche-existante', async () => {
    await page.getByTestId('cv2-tile-carnet').first().click();
    // La maquette prévoit un détail empilé ; la V2 ouvre la fiche /carnets/[id]
    // existante (exception documentée 01 § 6 / Carnets#13). On capture la page
    // atteinte telle quelle, sans la juger.
    await page.waitForTimeout(2_500);
  });
});

test('captures Explorer — clubs : volet, filtre, détail, demandes, île', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Clubs').click();
  await scenario(page, 'explorer-clubs', async () => {});

  await scenario(page, 'explorer-clubs-filtre-activite', async () => {
    const chips = page.getByRole('group', { name: 'Activité du club' });
    await chips.getByRole('button', { name: 'Escalade' }).click();
    await page.waitForTimeout(700);
  });
});

test('captures Explorer — peek club (référence clubs-peek)', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Clubs').click();
  await scenario(page, 'explorer-clubs-peek', async () => {
    const tile = page.getByTestId('cv2-tile-club').first();
    await tile.waitFor({ state: 'visible', timeout: 15_000 });
    await longPress(page, tile);
    await page.getByRole('dialog', { name: /Aperçu :/ }).waitFor({ state: 'visible', timeout: 8_000 });
  });
});

test('captures Explorer — détail club', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Clubs').click();
  await scenario(page, 'explorer-clubs-detail', async () => {
    await page.getByTestId('cv2-tile-club').first().click();
    await page.getByTestId('cv2-detail').waitFor({ state: 'visible', timeout: 10_000 });
  });
});

test('captures Explorer — demandes d’adhésion (pile admin)', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Clubs').click();
  await scenario(page, 'explorer-clubs-demandes', async () => {
    const closedTile = page.getByTestId('cv2-tile-club').filter({ hasText: 'Ski de rando Belledonne' }).first();
    await closedTile.getByTestId('cv2-club-join').click();
    await page.waitForTimeout(900);
    await page.getByTestId('cv2-tile-club').filter({ hasText: 'Vercors Alpin' }).first().click();
    await page.getByRole('region', { name: /Demandes d’adhésion/ }).waitFor({ state: 'visible', timeout: 10_000 });
  });
});

test('captures Explorer — île après adhésion', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Clubs').click();
  await scenario(page, 'explorer-ile', async () => {
    const openTile = page.getByTestId('cv2-tile-club').filter({ hasText: 'Cordée des Écrins' }).first();
    await openTile.getByTestId('cv2-club-join').click();
    await page.locator('.lkdv-island-pill').waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(500);
  });
});

test('captures Explorer — sorties : volet, agenda, détail', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Sorties').click();
  await scenario(page, 'explorer-sorties', async () => {});

  await scenario(page, 'explorer-agenda-jour', async () => {
    const agenda = page.getByRole('group', { name: 'Agenda des prochains jours' });
    const dayButton = agenda.getByRole('button', { name: /[1-9] sortie/ }).first();
    await dayButton.waitFor({ state: 'visible', timeout: 15_000 });
    await dayButton.click();
    await page.waitForTimeout(900);
  });
});

test('captures Explorer — détail sortie', async ({ page }) => {
  await prepareExplorer(page);
  await tab(page, 'Volets de l’explorateur', 'Sorties').click();
  await scenario(page, 'explorer-sorties-detail', async () => {
    await page.getByTestId('cv2-tile-sortie').first().click();
    await page.getByTestId('cv2-detail').waitFor({ state: 'visible', timeout: 10_000 });
  });
});

test('captures Explorer — invité (lecture seule)', async ({ page }) => {
  await prepareExplorer(page, { role: 'anonymous' });
  await scenario(page, 'explorer-invite', async () => {});
});

// ═══════════════════════════════════════════════════════════════════════════
// CRÉATION — Publication (3 étapes, erreurs, brouillon, confirmation, succès)
// ═══════════════════════════════════════════════════════════════════════════

test('captures Création — publication étapes 1-3', async ({ page }) => {
  await prepareCreate(page);
  await scenario(page, 'creation-publication-etape1', async () => {});

  await scenario(page, 'creation-publication-etape2', async () => {
    // Étape 2 « Contenu » : média réel + légende.
    await next(page);
    const media = page.getByTestId('cv2-field-media').locator('input[type="file"]').first();
    await media.setInputFiles(join(process.cwd(), 'public/assets/images/adventure-bivouac.jpg'));
    await page.waitForTimeout(2_500);
    await fillField(page, 'content', 'Bivouac au-dessus du Vercors, trois jours sur les crêtes.');
    await page.waitForTimeout(700);
  });

  await scenario(page, 'creation-publication-etape3', async () => {
    await next(page);
    await page.waitForTimeout(700);
  });
});

test('captures Création — publication variante Billet', async ({ page }) => {
  await prepareCreate(page);
  await scenario(page, 'creation-publication-billet', async () => {
    await page.getByRole('radio', { name: /Billet/ }).click();
    await next(page);
    await fillField(page, 'title', 'Bivouac au Vercors');
    await fillField(page, 'content', 'Trois jours sur les crêtes.');
    await page.waitForTimeout(700);
  });
});

test('captures Création — story sans média : erreur inline', async ({ page }) => {
  await prepareCreate(page, 'story');
  await scenario(page, 'creation-story-erreur-media', async () => {
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.waitForTimeout(900);
  });
});

test('captures Création — erreurs de champ (compteur + inline)', async ({ page }) => {
  await prepareCreate(page);
  await scenario(page, 'creation-publication-erreurs', async () => {
    await page.getByRole('radio', { name: /Billet/ }).click();
    await next(page);
    await page.getByRole('button', { name: 'Suivant' }).click();
    await page.getByTestId('cv2-error-summary').waitFor({ state: 'visible', timeout: 8_000 });
  });
});

test('captures Création — confirmation de fermeture', async ({ page }) => {
  await prepareCreate(page);
  await scenario(page, 'creation-fermeture-confirmation', async () => {
    await page.getByRole('radio', { name: /Billet/ }).click();
    await next(page);
    await fillField(page, 'title', 'Bivouac au Vercors');
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog', { name: 'Fermer sans publier ?' }).waitFor({ state: 'visible', timeout: 8_000 });
  });
});

test('captures Création — brouillon restauré', async ({ page }) => {
  await prepareCreate(page);
  await scenario(page, 'creation-brouillon', async () => {
    await page.getByRole('radio', { name: /Billet/ }).click();
    await next(page);
    await fillField(page, 'title', 'Bivouac au Vercors');
    await page.waitForTimeout(750);
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Fermer' }).click();
    await page.getByTestId('communaute-v2-create').waitFor({ state: 'detached', timeout: 8_000 });
    await openCreate(page, 'post');
    await page.getByTestId('cv2-draft-banner').waitFor({ state: 'visible', timeout: 8_000 });
  });
});

test('captures Création — île de succès (publication simulée)', async ({ page }) => {
  await prepareCreate(page);
  await scenario(page, 'creation-succes-ile', async () => {
    await page.getByRole('radio', { name: /Billet/ }).click();
    await next(page);
    await fillField(page, 'title', 'Bivouac au Vercors');
    await fillField(page, 'content', 'Trois jours sur les crêtes.');
    await next(page);
    await page.getByRole('button', { name: 'Publier' }).click();
    await page.getByTestId('cv2-island').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(600);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRÉATION — Story (média → édition → diffusion)
// ═══════════════════════════════════════════════════════════════════════════

test('captures Création — story étapes 1-3', async ({ page }) => {
  await prepareCreate(page, 'story');
  await scenario(page, 'creation-story-etape1', async () => {});

  await scenario(page, 'creation-story-etape2', async () => {
    const input = page.getByTestId('cv2-field-media').locator('input[type="file"]').first();
    await input.setInputFiles(join(process.cwd(), 'public/assets/images/adventure-hiking.jpg'));
    await page.waitForTimeout(2_200);
    await next(page);
    await page.waitForTimeout(800);
  });

  await scenario(page, 'creation-story-etape3', async () => {
    await next(page);
    await page.waitForTimeout(800);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRÉATION — Carnet (Infos → Tracé → Jours → Partage)
// ═══════════════════════════════════════════════════════════════════════════

test('captures Création — carnet étapes 1-4', async ({ page }) => {
  await prepareCreate(page);
  await selectType(page, 'Carnet');
  await scenario(page, 'creation-carnet-etape1', async () => {});
  await scenario(page, 'creation-carnet-etape2', async () => {
    await fillField(page, 'title', 'Traversée des Écrins');
    await page.locator('#cv2c-destination').fill('Écrins');
    await page.waitForTimeout(500);
    await next(page);
  });
  await scenario(page, 'creation-carnet-etape3', async () => {
    await next(page);
  });
  await scenario(page, 'creation-carnet-etape4', async () => {
    await next(page);
    await page.waitForTimeout(600);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRÉATION — Sortie (Activité/lieu → Itinéraire → Participants → Sécurité)
// ═══════════════════════════════════════════════════════════════════════════

test('captures Création — sortie étapes 1-4', async ({ page }) => {
  await prepareCreate(page);
  await selectType(page, 'Sortie');
  await scenario(page, 'creation-sortie-etape1', async () => {
    await fillField(page, 'title', 'Tour du Vercors');
    await page.locator('#cv2c-location').fill('Vercors');
    await page.waitForTimeout(400);
    await page.getByTestId('cv2-field-date').locator('input').fill('2026-11-21');
    await page.getByTestId('cv2-field-startTime').locator('input').fill('08:30');
    await page.waitForTimeout(600);
  });
  await scenario(page, 'creation-sortie-etape2', async () => {
    await next(page);
  });
  await scenario(page, 'creation-sortie-etape3', async () => {
    await next(page);
  });
  await scenario(page, 'creation-sortie-etape4', async () => {
    await next(page);
    await page.waitForTimeout(600);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRÉATION — Kit (sous-tiroir sélecteur produit → Inventaire → Compléter → Partager)
// ═══════════════════════════════════════════════════════════════════════════

test('captures Création — kit, sélecteur produit et étapes 1-3', async ({ page }) => {
  await prepareCreate(page);
  await selectType(page, 'Kit');
  await scenario(page, 'creation-kit-picker', async () => {
    await page.getByTestId('cv2-field-items').getByRole('button', { name: /Ajouter un produit/ }).first().click();
    const picker = page.getByRole('dialog').filter({ hasText: 'Choisir un produit' });
    await picker.waitFor({ state: 'visible', timeout: 10_000 });
    // Onglet Boutique : l'inventaire du compte simulé est vide.
    await picker.getByRole('button', { name: 'Boutique' }).click();
    await page.waitForTimeout(1_200);
  });
  await scenario(page, 'creation-kit-etape1', async () => {
    // Inventaire et boutique simulés vides : on revient au formulaire et on
    // ajoute un objet personnalisé (parcours réel de premier kit).
    const picker = page.getByRole('dialog').filter({ hasText: 'Choisir un produit' });
    await picker.getByTestId('cv2-back').click();
    await picker.waitFor({ state: 'detached', timeout: 8_000 }).catch(() => undefined);
    await page.waitForTimeout(700);
    await page.getByTestId('cv2-field-items').getByRole('button', { name: /Objet personnalisé/ }).click();
    await page.getByRole('textbox', { name: 'Nom de l’objet personnalisé' }).fill('Sac de couchage');
    await page.getByRole('spinbutton', { name: 'Poids de l’objet en grammes' }).fill('900');
    await page.getByRole('button', { name: 'Ajouter l’objet personnalisé' }).click();
    await page.waitForTimeout(1_200);
  });
  await scenario(page, 'creation-kit-etape2', async () => {
    await next(page);
  });
  await scenario(page, 'creation-kit-etape3', async () => {
    await next(page);
    await page.waitForTimeout(600);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRÉATION — Club (Identité → Univers → Adhésion → Publication)
// ═══════════════════════════════════════════════════════════════════════════

test('captures Création — club étapes 1-4', async ({ page }) => {
  await prepareCreate(page);
  await selectType(page, 'Club');
  await scenario(page, 'creation-club-etape1', async () => {
    await fillField(page, 'name', 'Club des Crêtes');
    await page.waitForTimeout(600);
  });
  await scenario(page, 'creation-club-etape2', async () => {
    await next(page);
  });
  await scenario(page, 'creation-club-etape3', async () => {
    await next(page);
  });
  await scenario(page, 'creation-club-etape4', async () => {
    await next(page);
    await page.waitForTimeout(600);
  });
});
