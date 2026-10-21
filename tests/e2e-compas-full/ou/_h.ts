import { expect, type Locator, type Page } from '@playwright/test';
import type { Cover } from '../_lib/coverage';
import { sheet } from '../_lib/compas';

/**
 * Aides des lots Où et Résa : identifiants d'inventaire (rattachement explicite, jamais
 * par ressemblance) et gestes communs. Aucun contrôle n'est crédité ici : seuls les
 * `cover.*` des scénarios créditent.
 */
const F = 'src/features/compas/components/';
export const ID = {
  // Carte Où
  say: `${F}CompasCards.tsx::CardSay::input::compas.cards.say`,
  clearOrigin: `${F}CompasCards.tsx::OriginLine::button::compas.cards.clearOrigin`,
  undoPrep: `${F}CompasCards.tsx::AutofillLine::button::compas.cards.undoPrep`,
  prepareAll: `${F}CompasCards.tsx::AutofillLine::button::compas.cards.prepareAll`,
  // Carte Résa
  noOffer: `${F}CompasCards.tsx::ResaCard::button::compas.cards.noOffer`,
  cardDay: `${F}CompasCards.tsx::ResaCard::button::compas.cards.day`,
  // Règle de durée
  rulerCancel: `${F}CompasRuler.tsx::DurationRuler::button::compas.ruler.cancel`,
  rulerApply: `${F}CompasRuler.tsx::DurationRuler::button::compas.ruler.applyHours`,
  rulerSlider: `${F}CompasRuler.tsx::DurationRuler::div::compas.ruler.slider`,
  rulerDrag: `${F}CompasRuler.tsx::DurationRuler::geste::geste:glisser:cp-ruler__track`,
  // Préparation visible
  prepView: `${F}CompasPrep.tsx::CompasPrep::button::compas.prep.viewAdventure`,
  prepEdit: `${F}CompasPrep.tsx::CompasPrep::button::compas.prep.editRequest`,
  prepRetry: `${F}CompasPrep.tsx::CompasPrep::button::compas.prep.retry`,
  prepStop: `${F}CompasPrep.tsx::CompasPrep::button::compas.prep.stop`,
  // Capsule d'étapes
  stepOu: `${F}CompasScreen.tsx::CompasScreen::button::COMPAS_STEPS:ou`,
  stepResa: `${F}CompasScreen.tsx::CompasScreen::button::COMPAS_STEPS:resa`,
  // Parcours
  routeSearch: `${F}CompasOuFlows.tsx::ParcoursFlow::input::compas.ouRoute.searchLabel`,
  routeSearchBtn: `${F}CompasOuFlows.tsx::ParcoursFlow::button::compas.ouRoute.searchButton`,
  routeMode: `${F}CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill`,
  routeWish: `${F}CompasOuFlows.tsx::ParcoursFlow::button::cls:cp-pill#2`,
  routePartner: `${F}CompasOuFlows.tsx::ParcoursFlow::a::cls:cp-row`,
  routeRow: `${F}CompasOuFlows.tsx::ParcoursFlow::button::compas.ouRoute.doneTimes`,
  dayLess: `${F}CompasOuFlows.tsx::RouteConfirm::button::compas.ouRoute.oneDayLess`,
  dayMore: `${F}CompasOuFlows.tsx::RouteConfirm::button::compas.ouRoute.oneDayMore`,
  routeBack: `${F}CompasOuFlows.tsx::RouteConfirm::button::compas.ouRoute.back`,
  routeChoose: `${F}CompasOuFlows.tsx::RouteConfirm::button::compas.ouRoute.choose`,
  // Quand
  whenStart: `${F}CompasOuFlows.tsx::QuandFlow::input::compas.ouWhen.start`,
  whenUnit: `${F}CompasOuFlows.tsx::QuandFlow::select::compas.ouWhen.unitLabel`,
  whenDays: `${F}CompasOuFlows.tsx::QuandFlow::input::compas.ouRoute.numberOfDays`,
  whenHours: `${F}CompasOuFlows.tsx::QuandFlow::input::compas.ouWhen.numberOfHours`,
  whenSave: `${F}CompasOuFlows.tsx::QuandFlow::button::compas.ouWhen.save`,
  whenDayPill: `${F}CompasOuFlows.tsx::QuandFlow::button::compas.ouDay.dayShort`,
  calCell: `${F}CompasOuFlows.tsx::CalendarCell::button::cls:cp-cal__d`,
  // Préférences
  pace: `${F}CompasOuFlows.tsx::PreferencesFlow::button::compas.ouPrefs.pace:options`,
  nights: `${F}CompasOuFlows.tsx::PreferencesFlow::button::cls:cp-pill`,
  seeGroup: `${F}CompasOuFlows.tsx::PreferencesFlow::button::compas.ouPrefs.seeGroup`,
  level: `${F}CompasOuFlows.tsx::ProjectBlock::button::cls:cp-pill`,
  terrain: `${F}CompasOuFlows.tsx::ProjectBlock::button::cls:cp-pill#2`,
  carFree: `${F}CompasOuFlows.tsx::ProjectBlock::button::compas.ouPrefs.carFree`,
  outdoor: `${F}CompasOuFlows.tsx::ProjectBlock::button::compas.ouPrefs.outdoorFree`,
  maxPack: `${F}CompasOuFlows.tsx::ProjectBlock::input::compas.ouPrefs.noLimit`,
  tagRemove: `${F}CompasOuFlows.tsx::TagEditor::button::compas.ouPrefs.removeTag`,
  tagSuggest: `${F}CompasOuFlows.tsx::TagEditor::button::cls:cp-pill`,
  tagInput: `${F}CompasOuFlows.tsx::TagEditor::input::compas.ouPrefs.addLabel`,
  tagAdd: `${F}CompasOuFlows.tsx::TagEditor::button::compas.ouPrefs.addButton`,
  // Sur place
  traceAll: `${F}CompasSheets.tsx::TraceFlow::button::compas.sheets.common.category:all`,
  // Résa
  stayFor: `${F}CompasSheets.tsx::StaySearch::select::compas.sheets.stay.for`,
  staySearch: `${F}CompasSheets.tsx::StaySearch::button::compas.sheets.common.search`,
  stayDouble: `${F}CompasSheets.tsx::StaySearch::geste::geste:double-touche:cp-row`,
  stayNote: `${F}CompasSheets.tsx::StaySearch::button::compas.sheets.stay.note`,
  staySee: `${F}CompasSheets.tsx::StaySearch::a::compas.sheets.stay.seeOffer`,
  nightStay: `${F}CompasSheets.tsx::NuitsFlow::input::compas.sheets.nights.stayOf`,
  nightOk: `${F}CompasSheets.tsx::NuitsFlow::button::ok`,
  nightPartner: `${F}CompasSheets.tsx::NuitsFlow::a::compas.sheets.common.partner`,
  offerCat: `${F}CompasSheets.tsx::OffresFlow::button::compas.sheets.common.category:options`,
  offerNightly: `${F}CompasSheets.tsx::OffresFlow::button::compas.sheets.offers.nightly`,
  offerPartner: `${F}CompasSheets.tsx::OffresFlow::a::compas.sheets.common.partner`,
  liveFrom: `${F}CompasSheets.tsx::LiveSearch::input::compas.sheets.live.from`,
  liveTo: `${F}CompasSheets.tsx::LiveSearch::input::compas.sheets.live.carTo`,
  liveGo: `${F}CompasSheets.tsx::LiveSearch::button::compas.sheets.live.searching`,
  liveRow: `${F}CompasSheets.tsx::LiveSearch::a::cls:cp-row`,
} as const;

/** Onglet de tiroir : clé d'inventaire `flows:<étape>.<parcours>`. */
export const tabId = (step: 'ou' | 'resa', flow: string) =>
  `${F}CompasSheets.tsx::StepSheet::button::compas.sheets.step.flows:${step}.${flow}`;
/** Tuile d'activité : clé d'inventaire `ACTIVITY_ORDER:<activité>`. */
export const tileId = (activity: string) => `${F}CompasOuFlows.tsx::ActiviteFlow::button::ACTIVITY_ORDER:${activity}`;

/** L'annonce (îlot) qui suit un geste : « Annuler » y est proposé quand le geste se défait. */
export const island = (page: Page) => page.locator('.cp-island');

/** Défait le dernier geste par « Annuler » de l'îlot (sans le créditer : c'est le rangement du scénario). */
export async function undoLast(page: Page) {
  const btn = island(page).getByRole('button', { name: 'Annuler', exact: true });
  await btn.click();
}

/** Ferme le tiroir courant s'il est ouvert. */
export async function closeSheet(page: Page) {
  if (await sheet(page).isVisible().catch(() => false)) {
    await sheet(page).getByRole('button', { name: 'Fermer', exact: true }).click();
    await page.locator('.cp-sheet[role="dialog"]').waitFor({ state: 'detached' });
  }
}

/** Amène le tiroir en grand (sans cover : réglage de la scène). */
export async function sheetLarge(page: Page) {
  if ((await sheet(page).getAttribute('data-detent')) !== 'large') {
    const full = sheet(page).getByRole('button', { name: 'Plein écran' });
    if (await full.count()) await full.click();
  }
}

export const field = (loc: Locator) => loc;

/** Attend que l'îlot d'annonces (préremplissage, réadaptation) soit retombé : il intercepte les touchers. */
export async function settle(page: Page, timeout = 120_000) {
  await page.locator('.cp-island').waitFor({ state: 'detached', timeout }).catch(() => undefined);
}

/**
 * Attend le calme de l'écran : aucune annonce, et le contrôle `ready` actif et stable
 * (le serveur finit de réadapter l'aventure après un changement : les contrôles se
 * désactivent le temps de l'action). Deux relevés à 1,2 s d'écart.
 */
export async function quiet(page: Page, ready: Locator, timeout = 120_000) {
  const t0 = Date.now();
  let calm = 0;
  while (Date.now() - t0 < timeout) {
    const ok = (await page.locator('.cp-island').count()) === 0 && (await ready.isEnabled().catch(() => false));
    calm = ok ? calm + 1 : 0;
    if (calm >= 2) return;
    await page.waitForTimeout(1200);
  }
}

/** Pastille (`.cp-pill`) du tiroir par son texte (le nom accessible porte aussi le glyphe de l'icône). */
export const pill = (page: Page, text: RegExp) => sheet(page).locator('.cp-pill').filter({ hasText: text });

/**
 * Lien partenaire : jamais suivi pour de bon. La cible (nouvel onglet) est interceptée au
 * niveau du contexte AVANT le geste, si bien que ni le site partenaire ni notre redirection
 * `/go/…` (qui enregistre un clic d'affiliation) ne reçoivent la requête. Vérifie le balisage
 * (`sponsored nofollow`, nouvel onglet) puis l'ouverture de la cible.
 */
export async function openLink(page: Page, link: Locator, control: string, cover: Cover, effet: string) {
  const href = await link.getAttribute('href');
  expect(href, 'le lien partenaire a une adresse').toBeTruthy();
  const target = new URL(href as string, page.url()).toString();
  await page.context().route((u) => u.toString() === target, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>cible interceptée par le banc</title>' }));
  const popup = page.context().waitForEvent('page');
  await cover.click(link, effet, async () => {
    await expect(link).toHaveAttribute('rel', /sponsored/);
    await expect(link).toHaveAttribute('rel', /nofollow/);
    await expect(link).toHaveAttribute('target', '_blank');
    const p = await popup;
    expect(p.url()).toBe(target);
    await p.close();
  }, { control });
}

/**
 * Constat O-01 : après « Annuler la préparation », /compas affiche « Quelle aventure préparer ? »
 * (aucune aventure active) au lieu de l'aventure. Le banc la rouvre par le choix de voyage pour
 * poursuivre ; l'écart est consigné par le scénario qui le rencontre.
 */
export async function reopenIfPicker(page: Page): Promise<boolean> {
  const picker = page.getByText('Quelle aventure préparer ?');
  if (!(await picker.isVisible().catch(() => false))) return false;
  await page.locator('.cp-row').filter({ hasText: /Vercors/ }).first().click();
  await expect(page.locator('.cp-steps')).toBeVisible({ timeout: 60_000 });
  await page.locator('.cp-steps').getByRole('button', { name: /^Où/ }).click();
  return true;
}
