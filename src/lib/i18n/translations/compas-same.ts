/**
 * Valeurs identiques exprès entre une nouvelle langue (ES, DE, IT) et le français ou l'anglais
 * (PLAN-100 6.1) : noms propres, marques, sigles, mentions imposées, mots repris tels quels
 * dans la langue (« Trekking », « Bushcraft », « Budget »), abréviations et gabarits sans mot
 * (« {label}: {hint}. », « {hour}:00 »). Toute autre valeur identique est une traduction
 * oubliée : `tests/i18n/compas-locales.spec.ts` échoue, comme pour une entrée devenue fausse.
 */

type NewLocale = 'es' | 'de' | 'it';

/** Communs à toutes les langues : nom du site, mention Geoapify, abréviations neutres. */
const ALL_SAME = [
  'common.appTitle',
  'compas.credit.geoapify',
  'progression.territoryAroundMe',
  'auth.confirmationBodySuffix',
  'compas.activities.bikepacking',
  'compas.activities.bushcraft',
] as const;

export const COMPAS_SAME_AS_FR: Record<NewLocale, readonly string[]> = {
  es: [
    ...ALL_SAME,
    'progression.levelShort',
    'progression.pointsShort',
    'compas.start.auto',
    'compas.activities.trail',
    'compas.activities.kayak',
    'compas.understood.hours',
    'compas.ouPrefs.outdoorFree',
    'compas.cards.pct',
    'compas.engine.format.tickWeek',
    'compas.engine.format.weather.variable',
    'compas.engine.scale.raid',
  ],
  de: [
    ...ALL_SAME,
    'progression.season',
    'account.navigation',
    'compas.understood.budget',
    'compas.ouPrefs.level',
    'compas.cards.pct',
    'compas.members.level',
  ],
  it: [
    ...ALL_SAME,
    'compas.activities.kayak',
    'compas.understood.budget',
    'compas.understood.hours',
    'compas.engine.scale.raid',
  ],
};

export const COMPAS_SAME_AS_EN: Record<NewLocale, readonly string[]> = {
  es: [
    ...ALL_SAME,
    'progression.rhythmRegulier',
    'progression.pointsShort',
    'compas.sheets.common.personal',
    'compas.sheets.common.dayShort',
    'compas.start.auto',
    'compas.activities.trekking',
    'compas.activities.current',
    'compas.ouWhen.cellLabel',
    'compas.ouDay.dayShort',
    'compas.ouDay.hour',
    'compas.ouPrefs.tagAdded',
    'compas.passage.dayShort',
    'compas.server.autofill.plan.baseDays',
    'compas.engine.format.tickDay',
  ],
  de: [
    ...ALL_SAME,
    'nav.community',
    'navigation.crews',
    'navigation.community',
    'progression.territoryRegion',
    'account.navigation',
    'compas.sheets.common.name',
    'compas.sheets.common.team',
    'compas.sheets.common.partner',
    'compas.sheets.add.shop',
    'compas.sheets.budget.envelope',
    'compas.sheets.expense.state',
    'compas.sheets.season.optHiver',
    'compas.sheets.inventory.itemOf',
    'compas.activities.trekking',
    'compas.activities.current',
    'compas.understood.budget',
    'compas.ouRoute.partner',
    'compas.ouRoute.community',
    'compas.ouWhen.start',
    'compas.ouWhen.cellLabel',
    'compas.ouDay.hour',
    'compas.ouPrefs.tagAdded',
    'compas.screen.detailsNous',
    'compas.screen.prepBudget',
    'compas.cards.rowRoute',
    'compas.cards.team',
    'compas.flowTabs.parcours',
    'compas.flowTabs.equipe',
    'compas.flowTabs.etats',
    'compas.engine.scale.expedition',
  ],
  it: [
    ...ALL_SAME,
    'navigation.account',
    'auth.password',
    'auth.passwordPlaceholder',
    'compas.sheets.common.partner',
    'compas.sheets.budget.envelope',
    'compas.sheets.budget.alsoEnvelope',
    'compas.activities.trekking',
    'compas.activities.trail',
    'compas.activities.current',
    'compas.understood.budget',
    'compas.ouRoute.partner',
    'compas.ouWhen.cellLabel',
    'compas.ouDay.hour',
    'compas.ouPrefs.tagAdded',
    'compas.screen.prepBudget',
    'compas.cards.pct',
    'compas.server.stays.partner',
  ],
};
