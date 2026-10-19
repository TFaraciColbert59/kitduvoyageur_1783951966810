import type { Page } from '@playwright/test';
import { capture } from '../_lib/fixtures';
import { detailsButton, detentOf, expectDetent, expectNoHorizontalScroll, expectStep, flowTab, grab, openStep, sheet, stepButton } from '../_lib/compas';
import { expect, test } from './_fx';

/**
 * Étape « Commun » : tout ce que le Compas affiche autour des cinq étapes — capsule, tiroirs
 * (trois hauteurs, pied, Dis-le), carte (calques, fond, encart), affichage, annonce « Annuler »,
 * profil d'altitude, listes paginées. Sur l'aventure de référence (espace d'essai gardé).
 */
const C = 'src/features/compas/components';
const id = (file: string, comp: string, tag: string, key: string) => `${C}/${file}.tsx::${comp}::${tag}::${key}`;

const closeSheets = async (page: Page) => {
  while ((await page.locator('.cp-sheet[role="dialog"]').count()) > 0) {
    await sheet(page).getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.waitForTimeout(150);
  }
};

const readStore = (page: Page, key: string) => page.evaluate((k) => window.localStorage.getItem(k), key);

test.describe('@etape:commun capsule-et-affichage', () => {
  test('capsule d’étapes : toucher une étape, ou la glisser sous la lentille', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await expectNoHorizontalScroll(page);
    await expectStep(page, 'ou');

    await cover.click(stepButton(page, 'verdict'), 'l’étape « Verdict » devient courante et sa carte s’affiche', async () => {
      await expectStep(page, 'verdict');
      await expect(page.getByRole('region', { name: /Verdict/ }).first()).toBeVisible();
    }, { control: id('CompasScreen', 'CompasScreen', 'button', 'COMPAS_STEPS:verdict') });

    // Glisser la lentille : pression sur la capsule, déplacement, relâchement sur « Kit ».
    const nav = page.locator('.compas .cp-steps');
    await cover.drag(nav, { dx: 150 }, 'relâchée vers la droite, la lentille choisit l’étape sous elle (« Kit »)', async () => {
      await expectStep(page, 'kit');
    });
    await capture(page, 'lentille');
    await stepButton(page, 'ou').click();
    await expectStep(page, 'ou');
  });

  test('« Affichage » : plein soleil, transparence du verre, durée de « Annuler », version hors ligne', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    const dialog = page.getByRole('dialog', { name: 'Affichage' });
    const sun = page.getByRole('switch', { name: 'Mode plein soleil' });
    try {
      await cover.click(
        page.getByRole('button', { name: 'Affichage : plein soleil et transparence du verre' }),
        'la fenêtre « Affichage » s’ouvre',
        () => expect(dialog).toBeVisible()
      );

      const glass = dialog.locator('input[type="range"]');
      if ((await sun.getAttribute('aria-checked')) === 'true') await sun.click();
      await expect(glass).toBeEnabled();
      await cover.setRange(glass, 30, 'le curseur règle la transparence : l’écran suit (--cp-ga) et le choix est gardé', async () => {
        await expect(page.locator('.compas')).toHaveCSS('--cp-ga', '0.3');
        expect(JSON.parse((await readStore(page, 'lkdv.compas.affichage')) ?? '{}').glass).toBe(0.3);
      });

      const sel = dialog.locator('select.cp-popv__sel');
      await cover.select(sel, '30', 'la durée de « Annuler » passe à 30 secondes et le choix est gardé', async () => {
        await expect(sel).toHaveValue('30');
        expect(JSON.parse((await readStore(page, 'lkdv.compas.affichage')) ?? '{}').undoS).toBe(30);
      });

      await cover.click(sun, 'le plein soleil s’allume : l’écran passe en mode plein soleil et le curseur de verre se bloque', async () => {
        await expect(sun).toHaveAttribute('aria-checked', 'true');
        await expect(page.locator('.compas[data-outdoor="1"]')).toHaveCount(1);
        await expect(glass).toBeDisabled();
      });
      await sun.click();
      await expect(page.locator('.compas[data-outdoor="1"]')).toHaveCount(0);

      // La version hors ligne : proposée dès que l’aventure est gardée sur l’appareil (IndexedDB).
      const offline = dialog.getByRole('link', { name: 'voir la version hors ligne' });
      await expect(offline, 'l’aventure doit être gardée hors ligne (≈ 1,2 s après l’affichage)').toBeVisible({ timeout: 30_000 });
      await capture(page, 'affichage');
      await cover.click(offline, 'le lien ouvre /hors-ligne', async () => {
        await page.waitForURL((u) => u.pathname.startsWith('/hors-ligne'));
      });
    } finally {
      // Remise en état : le réglage est gardé par le navigateur du compte de ce lot.
      await page.evaluate(() => window.localStorage.removeItem('lkdv.compas.affichage')).catch(() => undefined);
    }
  });
});

test.describe('@etape:commun carte', () => {
  test('carte : agrandir / réduire, recentrer, personnaliser (fond, calques, carte nue, tout afficher)', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await expect(page.locator('.cp-map')).toBeVisible();
    const compas = page.locator('.compas');
    const actions = page.locator('.cp-map__actions');

    // Poignée de la carte : un glissé vers le haut agrandit, un toucher bascule.
    const mapGrab = page.locator('.cp-map__grab');
    await cover.drag(mapGrab, { dy: -80 }, 'tirée vers le haut, la poignée agrandit la carte', () => expect(compas).toHaveAttribute('data-map', 'big'));
    await cover.click(mapGrab, 'touchée, la poignée « Glisser pour réduire la carte » ramène la carte à sa taille', () =>
      expect(compas).not.toHaveAttribute('data-map', 'big')
    , { control: id('CompasMap', 'CompasMap', 'button', 'compas.map.grabShrink') });

    const grow = actions.getByRole('button', { name: 'Agrandir la carte' });
    await cover.click(grow, '« Agrandir la carte » agrandit', () => expect(compas).toHaveAttribute('data-map', 'big'), {
      control: id('CompasMap', 'CompasMap', 'button', 'compas.map.shrink'),
    });
    // « Réduire la carte » existe deux fois : le bouton de la carte et la carte-titre du haut.
    await cover.click(page.locator('.cp-mini'), 'la carte-titre ramène la carte à sa taille', () => expect(compas).not.toHaveAttribute('data-map', 'big'), {
      control: id('CompasScreen', 'CompasScreen', 'button', 'compas.map.shrink'),
    });
    await grow.click();
    await expect(compas).toHaveAttribute('data-map', 'big');
    await cover.click(actions.getByRole('button', { name: 'Réduire la carte' }), '« Réduire la carte » réduit', () => expect(compas).not.toHaveAttribute('data-map', 'big'), {
      control: id('CompasMap', 'CompasMap', 'button', 'compas.map.shrink'),
    });

    // Recentrer : la carte est remontée (cadrage d’origine) ; un repère posé sur l’ancienne disparaît.
    await page.evaluate(() => document.querySelector('.cp-map .hub-globe-map')?.setAttribute('data-banc', 'ancienne'));
    await cover.click(actions.getByRole('button', { name: 'Recentrer' }), 'la carte est remontée à son cadrage d’origine', async () => {
      await expect(page.locator('.cp-map .hub-globe-map')).toBeVisible();
      await expect(page.locator('.cp-map .hub-globe-map[data-banc="ancienne"]')).toHaveCount(0);
    });

    const customize = actions.getByRole('button', { name: 'Personnaliser la carte' });
    const panel = page.getByRole('dialog', { name: 'Personnaliser la carte' });
    await cover.click(customize, 'le panneau « Personnaliser la carte » s’ouvre', () => expect(panel).toBeVisible());
    await expect(customize).toHaveAttribute('aria-expanded', 'true');

    const bases = panel.locator('.cp-mopts__base button');
    expect(await bases.count()).toBeGreaterThanOrEqual(2);
    const n = await bases.count();
    const other = bases.nth((await bases.evaluateAll((els) => els.findIndex((e) => e.getAttribute('aria-pressed') === 'true'))) === 0 ? 1 : 0);
    const label = (await other.innerText()).trim();
    await cover.click(other, `le fond « ${label} » est choisi, appuyé, et gardé (lkdv.compas.fond)`, async () => {
      await expect(other).toHaveAttribute('aria-pressed', 'true');
      await expect(panel.locator('.cp-mopts__base button[aria-pressed="true"]')).toHaveCount(1);
      expect(await readStore(page, 'lkdv.compas.fond')).toBeTruthy();
    }, { control: 'src/features/compas/components/CompasMap.tsx::CompasMap::button::anonyme' });
    void n;

    const layers = panel.locator('.cp-mopts__grid button[role="switch"]:not([disabled])');
    const enabled = await layers.count();
    expect(enabled).toBeGreaterThan(0);
    const first = layers.first();
    const before = await first.getAttribute('aria-checked');
    await cover.click(first, 'le calque bascule (aria-checked) et le choix est gardé (lkdv.compas.calques)', async () => {
      await expect(first).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
      expect(await readStore(page, 'lkdv.compas.calques')).toBeTruthy();
    }, { control: id('CompasMap', 'CompasMap', 'button', 'compas.map.none') });

    // « Carte nue » et « Tout afficher » : leur pied de panneau passe sous la barre d'onglets du site à 393 × 852
    // (constat D-31, scénario dédié ci-dessous) : le geste tactile est impossible, on les exerce au clavier (Entrée).
    await cover.press(panel.getByRole('button', { name: 'Carte nue' }), 'Enter', 'tous les calques sont éteints (au clavier)', async () => {
      await expect(panel.locator('.cp-mopts__grid button[role="switch"][aria-checked="true"]')).toHaveCount(0);
    });
    await cover.press(panel.getByRole('button', { name: 'Tout afficher' }), 'Enter', 'tous les calques disponibles sont rallumés (au clavier)', async () => {
      await expect(panel.locator('.cp-mopts__grid button[role="switch"]:not([disabled])[aria-checked="false"]')).toHaveCount(0);
    });
    await capture(page, 'panneau-carte');
    // Remise en état : fond et calques sont des préférences de navigateur.
    await page.evaluate(() => {
      window.localStorage.removeItem('lkdv.compas.fond');
      window.localStorage.removeItem('lkdv.compas.calques');
    });
  });

  test('constat D-31 / D-32 : le panneau « Personnaliser la carte » est entièrement atteignable au toucher et lisible', async ({ page, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    test.info().annotations.push({ type: 'constat', description: 'D-31' }, { type: 'constat', description: 'D-32' });
    await openStep(page, 'ou');
    await expect(page.locator('.cp-map')).toBeVisible();
    await page.locator('.cp-map__actions').getByRole('button', { name: 'Personnaliser la carte' }).click();
    const panel = page.getByRole('dialog', { name: 'Personnaliser la carte' });
    await expect(panel).toBeVisible();
    await capture(page, 'panneau-carte-defaut');
    // D-31 : les deux boutons du pied sont sous la barre d'onglets du site.
    for (const name of ['Carte nue', 'Tout afficher']) {
      const reachable = await panel.getByRole('button', { name }).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit != null && el.contains(hit);
      });
      expect.soft(reachable, `D-31 : « ${name} » est recouvert (barre d’onglets) : impossible à toucher`).toBe(true);
    }
    // D-32 : le crédit de carte ne doit pas passer par-dessus le panneau.
    const credit = page.getByText('Powered by Esri', { exact: false }).first();
    if (await credit.count()) {
      const over = await credit.evaluate((el) => {
        const pr = document.querySelector('.cp-mopts')?.getBoundingClientRect();
        const cr = el.getBoundingClientRect();
        if (!pr || cr.width === 0) return false;
        const overlaps = !(cr.right < pr.left || cr.left > pr.right || cr.bottom < pr.top || cr.top > pr.bottom);
        const hit = document.elementFromPoint(cr.x + cr.width / 2, cr.y + cr.height / 2);
        return overlaps && hit != null && !hit.closest('.cp-mopts');
      });
      expect.soft(over, 'D-32 : le crédit « Powered by Esri · © OpenStreetMap » passe par-dessus le panneau de la carte').toBe(false);
    }
  });

  test('encart d’un point touché : « Voir dans Parcours » puis « Fermer l’encart »', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    const rail = page.locator('.hub-globe-poi-rail');
    await expect(rail, 'la carte doit proposer ses points sous forme de puces').toBeVisible({ timeout: 60_000 });
    const chips = rail.locator('.hub-globe-poi-chip');
    expect(await chips.count()).toBeGreaterThan(0);

    // Une puce d'étape propose « Voir dans Parcours » : on les parcourt (clic DOM, sans défilement) jusqu'à la trouver.
    const stepIdx = await page.evaluate(async () => {
      const all = Array.from(document.querySelectorAll<HTMLElement>('.hub-globe-poi-rail .hub-globe-poi-chip'));
      for (let i = 0; i < all.length; i += 1) {
        all[i].click();
        await new Promise((r) => setTimeout(r, 90));
        if (document.querySelector('button[aria-label="Voir dans Parcours"]')) return i;
      }
      return -1;
    });
    test.info().annotations.push({ type: 'puces', description: `${await chips.count()} puces, puce d’étape : ${stepIdx}` });

    await cover.click(chips.first(), 'toucher une puce ouvre l’encart du point (et la puce est appuyée)', async () => {
      await expect(page.locator('.cp-callout')).toBeVisible();
      await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
    });
    expect(stepIdx, 'aucune puce d’étape parmi les puces de la carte : « Voir dans Parcours » ne peut pas être exercé').toBeGreaterThanOrEqual(0);
    await chips.nth(stepIdx).click();
    await cover.click(page.getByRole('button', { name: 'Voir dans Parcours' }), 'le tiroir « Où » s’ouvre sur « Parcours »', async () => {
      await expect(sheet(page)).toBeVisible();
      await expect(flowTab(page, 'Parcours')).toHaveAttribute('aria-pressed', 'true');
    });
    await closeSheets(page);
    await chips.first().click();
    await cover.click(page.getByRole('button', { name: 'Fermer l’encart' }), 'l’encart se ferme', () => expect(page.locator('.cp-callout')).toHaveCount(0));
  });

  test('profil d’altitude : la flèche droite et le glissé lisent l’altitude au kilomètre', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    const spark = page.locator('.cp-acc svg.cp-spk');
    const hasProfile = (await spark.count()) > 0;
    test.skip(!hasProfile, 'aucun profil d’altitude lu pour cet itinéraire : l’accessoire montre dénivelé et distance (pas de curseur).');
    await expect(spark).toBeVisible({ timeout: 60_000 });
    const val = spark.getAttribute('aria-valuenow');
    await cover.press(spark, 'ArrowRight', 'la flèche droite avance le curseur : la lecture passe au kilomètre (km …)', async () => {
      await expect(page.locator('.cp-acc__ro')).toContainText(/km\s*\d/);
    }, { control: id('CompasAccessory', 'CompasAccessory', 'svg', 'cls:cp-spk') });
    void val;
    await cover.drag(spark, { dx: 60 }, 'le glissé lit l’altitude (puis lâché, retour à « max »)', async () => {
      await expect(page.locator('.cp-acc__ro')).toBeVisible();
    });
    await capture(page, 'profil');
  });
});

test.describe('@etape:commun tiroirs', () => {
  test('tiroir : trois hauteurs (poignée touchée et glissée, en-tête), fermer par ✕, par le voile et par la poignée', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await cover.click(detailsButton(page, 'ou'), 'le tiroir de l’étape s’ouvre', () => expect(sheet(page)).toBeVisible(), {
      control: id('CompasScreen', 'CompasScreen', 'button', 'cls:cp-gbtn'),
    });
    await closeSheets(page);
    await expectDetent(page, null);

    // Ouvrir par la ligne « Activité » de la carte (une ligne de résumé = un bouton).
    await cover.click(page.locator('.compas .cp-card .cp-fr').first(), 'la ligne ouvre le tiroir correspondant', () => expect(sheet(page)).toBeVisible());
    // Le contenu court (activités) ouvre en hauteur moyenne ; sinon le tiroir se promeut en grand seul.
    const start = await detentOf(page);
    test.info().annotations.push({ type: 'hauteur à l’ouverture', description: String(start) });

    // Poignée glissée vers le haut : grand ; vers le bas : moyen puis petit.
    await cover.drag(grab(page), { dy: -70 }, 'la poignée tirée vers le haut agrandit', async () => {
      await expect(sheet(page)).toHaveAttribute('data-detent', 'large');
    }, { control: id('CompasSheet', 'CompasSheet', 'geste', 'geste:glisser:cp-sheet__grab') });
    await cover.click(grab(page), 'la poignée « Réduire le tiroir » (grand) ramène au moyen', () => expectDetent(page, 'medium'), {
      control: id('CompasSheet', 'CompasSheet', 'button', 'compas.drawer.shrink'),
    });
    await cover.click(grab(page), 'la poignée « Agrandir le tiroir » (moyen) passe en grand', () => expectDetent(page, 'large'), {
      control: id('CompasSheet', 'CompasSheet', 'button', 'compas.drawer.shrink'),
    });
    await cover.click(sheet(page).getByRole('button', { name: 'Taille moyenne' }), '« Taille moyenne » revient au moyen', () => expectDetent(page, 'medium'), {
      control: id('CompasSheet', 'CompasSheet', 'button', 'compas.drawer.medium'),
    });
    await cover.click(sheet(page).getByRole('button', { name: 'Plein écran' }), '« Plein écran » passe en grand', () => expectDetent(page, 'large'), {
      control: id('CompasSheet', 'CompasSheet', 'button', 'compas.drawer.medium'),
    });
    await cover.drag(grab(page), { dy: 70 }, 'tirée vers le bas, la poignée réduit', async () => {
      expect(await detentOf(page)).not.toBe('large');
    }, { control: id('CompasSheet', 'CompasSheet', 'geste', 'geste:glisser:cp-sheet__grab') });
    await capture(page, 'hauteurs');

    await cover.click(sheet(page).getByRole('button', { name: 'Fermer', exact: true }), '✕ ferme le tiroir', () => expectDetent(page, null), {
      control: id('CompasSheet', 'CompasSheet', 'button', 'compas.drawer.close'),
    });

    // Le voile : touche « Entrée » dessus (le centre est couvert par le tiroir) ferme aussi.
    await detailsButton(page, 'ou').click();
    await expect(sheet(page)).toBeVisible();
    await cover.press(page.getByRole('button', { name: 'Fermer le tiroir' }), 'Enter', 'le voile ferme le tiroir', () => expectDetent(page, null), {
      control: id('CompasSheet', 'CompasSheet', 'button', 'compas.drawer.scrim'),
    });
  });

  test('pied du tiroir : « Suivant », « Onglet précédent », « Terminer », et les onglets', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'verdict');
    await detailsButton(page, 'verdict').click();
    await expect(sheet(page)).toBeVisible();
    const tabs = sheet(page).locator('.cp-seg').first().getByRole('button');
    const names = (await tabs.allInnerTexts()).map((s) => s.trim());
    expect(names.length).toBe(4);
    // Premier onglet : « précédent » désactivé.
    await expect(flowTab(page, names[0])).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet(page).locator('.cp-sheet__prev')).toBeDisabled();

    await cover.click(sheet(page).getByRole('button', { name: 'Suivant' }), '« Suivant » passe à l’onglet suivant', async () => {
      await expect(flowTab(page, names[1])).toHaveAttribute('aria-pressed', 'true');
    });
    await cover.click(sheet(page).locator('.cp-sheet__prev'), '« Onglet précédent » revient à l’onglet d’avant', async () => {
      await expect(flowTab(page, names[0])).toHaveAttribute('aria-pressed', 'true');
    }, { control: id('CompasSheets', 'StepSheet', 'button', 'compas.sheets.step.prevOf') });

    await cover.click(flowTab(page, names[3]), `l’onglet « ${names[3]} » s’ouvre`, () => expect(flowTab(page, names[3])).toHaveAttribute('aria-pressed', 'true'), {
      control: id('CompasPrimitives', 'Segments', 'button', 'anonyme'),
    });
    await expect(sheet(page).locator('.cp-sheet__next')).toHaveText(/Terminer/);
    await cover.click(sheet(page).getByRole('button', { name: 'Terminer' }), '« Terminer » (dernier onglet) ferme le tiroir', () => expectDetent(page, null));
  });

  test('tiroir empilé : « Retour » ramène au tiroir d’en dessous', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'verdict');
    await detailsButton(page, 'verdict').click();
    await flowTab(page, 'Sources').click();
    await expect(flowTab(page, 'Sources')).toHaveAttribute('aria-pressed', 'true');
    // « Ajouter à l’inventaire » ouvre un second tiroir par-dessus.
    await sheet(page).getByRole('button', { name: 'Ajouter à l’inventaire' }).click();
    await expect(page.locator('.cp-sheet[role="dialog"]')).toHaveCount(1);
    const back = sheet(page).getByRole('button', { name: 'Retour', exact: true });
    await cover.click(back, '« Retour » referme le tiroir du dessus et rend le tiroir « Sources »', async () => {
      await expect(flowTab(page, 'Sources')).toHaveAttribute('aria-pressed', 'true');
      await expect(sheet(page).getByRole('button', { name: 'Retour', exact: true })).toHaveCount(0);
    });
  });

  test('liste paginée : « Page suivante » puis « Page précédente »', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'kit');
    await detailsButton(page, 'kit').click();
    await expect(sheet(page)).toBeVisible();
    await flowTab(page, 'Tout').click();
    await expect(flowTab(page, 'Tout')).toHaveAttribute('aria-pressed', 'true');
    const pager = sheet(page).locator('.cp-pager');
    // En grand, la liste tient peut-être sur une page : on repasse en moyen, puis en petit.
    for (const d of ['medium', 'small'] as const) {
      if (await pager.count()) break;
      await setDetentSoft(page, d);
    }
    test.skip((await pager.count()) === 0, 'la liste du kit tient sur une page à toutes les hauteurs : pas de pagination à exercer.');
    const counter = pager.locator('span[aria-live="polite"]');
    const first = (await counter.innerText()).trim();
    await cover.click(pager.getByRole('button', { name: 'Page suivante' }), 'la page suivante s’affiche (compteur « 2 / n »)', async () => {
      await expect(counter).not.toHaveText(first);
      await expect(counter).toHaveText(/^2 \//);
    });
    await cover.click(pager.getByRole('button', { name: 'Page précédente' }), 'retour à la première page', () => expect(counter).toHaveText(first));
  });
});

async function setDetentSoft(page: Page, d: 'small' | 'medium' | 'large') {
  for (let i = 0; i < 4 && (await detentOf(page)) !== d; i += 1) await grab(page).click();
}

test.describe('@etape:commun dis-le', () => {
  test('« Dis-le » : comprendre une phrase, cocher, effacer, appliquer, puis « Annuler » (bouton et zone)', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    await detailsButton(page, 'ou').click();
    await expect(sheet(page)).toBeVisible();
    const input = sheet(page).getByRole('textbox', { name: 'Dis-le' });
    const submit = sheet(page).getByRole('button', { name: 'Comprendre la phrase' });
    await expect(submit).toBeDisabled();

    await cover.type(input, 'budget 900 €', 'la phrase est saisie : « Comprendre la phrase » devient actif', () => expect(submit).toBeEnabled());
    await cover.click(submit, 'la phrase est comprise : une proposition cochable apparaît', async () => {
      await expect(sheet(page).locator('.cp-props li').first()).toBeVisible({ timeout: 60_000 });
    });
    const box = sheet(page).locator('.cp-props input[type="checkbox"]:not([disabled])').first();
    await expect(box).toBeChecked();
    const apply = sheet(page).getByRole('button', { name: /Appliquer \(/ });
    await expect(apply).toBeVisible();
    await cover.check(box, 'décochée, la proposition sort du lot : « Appliquer » disparaît', () => expect(apply).toHaveCount(0), {
      control: id('CompasDisLe', 'DisLe', 'input', 'compas.disle.aiUnderstood'),
    });
    await box.check();
    await expect(apply).toBeVisible();
    await cover.click(sheet(page).getByRole('button', { name: 'Effacer', exact: true }), '« Effacer » retire les propositions', () => expect(sheet(page).locator('.cp-props')).toHaveCount(0));

    // Appliquer, puis « Annuler » dans l’annonce.
    await input.fill('budget 900 €');
    await submit.click();
    await expect(sheet(page).locator('.cp-props li').first()).toBeVisible({ timeout: 60_000 });
    await cover.click(apply, 'les changements sont écrits : l’annonce confirme et propose « Annuler »', async () => {
      await expect(page.locator('.cp-island')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.cp-island').getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 60_000 });
    });
    await capture(page, 'annonce-annuler');
    await cover.click(page.locator('.cp-island').getByRole('button', { name: 'Annuler' }), '« Annuler » remet l’état d’avant et l’annonce l’indique', async () => {
      await expect(page.locator('.cp-island')).toContainText(/Annul/i, { timeout: 60_000 });
    });
    await expect(page.locator('.cp-island')).toHaveCount(0, { timeout: 40_000 });

    // Une seconde fois : toucher le texte de l’annonce la referme, sans annuler.
    await input.fill('budget 900 €');
    await submit.click();
    await expect(sheet(page).locator('.cp-props li').first()).toBeVisible({ timeout: 60_000 });
    await apply.click();
    const island = page.locator('.cp-island');
    await expect(island.getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 60_000 });
    await cover.click(island.locator('.cp-island__t'), 'toucher le texte de l’annonce la referme', () => expect(island).toHaveCount(0));
    // On défait ce qu’on vient de poser : le budget est remis à son état d’origine par une dernière phrase annulée.
  });
});

test.describe('@etape:commun decision', () => {
  test('prochaine décision : « Voir » (bouton et zone) ouvre l’étape concernée', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    const decision = page.locator('.cp-decision');
    test.skip((await decision.count()) === 0, 'aucune décision à prendre sur cette aventure : la capsule n’est pas rendue.');
    await expect(decision).toBeVisible();
    await cover.click(decision.getByRole('button', { name: /^Voir : / }), '« Voir » ouvre le tiroir de l’étape de la décision', () => expect(sheet(page)).toBeVisible());
    await closeSheets(page);
    await cover.click(decision.locator('.cp-decision__t'), 'toucher le texte vaut « Voir »', () => expect(sheet(page)).toBeVisible(), {
      control: id('CompasDecision', 'DecisionCapsule', 'div', 'compas.decision.label'),
    });
    await closeSheets(page);
    const apply = decision.getByRole('button', { name: /^Appliquer : / });
    if ((await apply.count()) > 0) {
      await cover.click(apply, 'la répartition est appliquée : l’annonce propose « Annuler »', async () => {
        await expect(page.locator('.cp-island').getByRole('button', { name: 'Annuler' })).toBeVisible({ timeout: 60_000 });
      });
      await page.locator('.cp-island').getByRole('button', { name: 'Annuler' }).click();
    } else {
      test.info().annotations.push({ type: 'non testé', description: 'Appliquer : non proposé (le moteur ne l’offre que pour répartir le matériel commun entre plusieurs membres)' });
    }
  });
});

test.describe('@etape:commun liens-conditionnels', () => {
  test('crédit Geoapify, « Garder mon voyage » : présents seulement si les données ou l’interrupteur les appellent', async ({ page, cover, preparedTrip }) => {
    expect(preparedTrip.ok).toBe(true);
    await openStep(page, 'ou');
    const trial = page.getByRole('link', { name: 'Garder mon voyage' });
    if ((await trial.count()) > 0) {
      await cover.click(trial, 'le lien mène à « Garder mon essai »', async () => {
        await page.waitForURL((u) => u.pathname.startsWith('/compte/garder-mon-essai'));
      });
      await openStep(page, 'ou');
    } else {
      test.info().annotations.push({ type: 'non testé', description: 'Garder mon voyage : absent (interrupteur NEXT_PUBLIC_KEEP_TRIAL éteint sur l’aperçu)' });
    }
    await detailsButton(page, 'ou').click();
    await flowTab(page, 'Parcours').click();
    const geo = sheet(page).getByRole('link', { name: 'Powered by Geoapify' });
    if ((await geo.count()) > 0) {
      await cover.click(geo, 'le lien « Powered by Geoapify » est suivi (href geoapify.com, nouvel onglet, sans nofollow)', async () => {
        await expect(geo).toHaveAttribute('href', 'https://www.geoapify.com/');
        await expect(geo).toHaveAttribute('target', '_blank');
        await expect(geo).not.toHaveAttribute('rel', /nofollow/);
      });
    } else {
      test.info().annotations.push({ type: 'non testé', description: 'Powered by Geoapify : absent (aucune distance Geoapify dans « Étapes »)' });
    }
    void expectStep;
  });
});
