/**
 * Compas — péages et vignettes (PLAN-100 4.6). Module PUR : des tables datées, sourcées, et des choix.
 *
 * RIEN N'EST INVENTÉ. Chaque ligne des tables porte l'adresse de la source officielle lue (`source`,
 * https), le jour de la lecture (`readOn`) et ce que le tarif couvre (durée ou période). Une valeur
 * qu'aucune source officielle accessible n'a donnée n'est pas écrite : le pays reste « non chiffré »
 * (`PER_KM_UNQUANTIFIED`) et le Compas le dit.
 *
 * Deux choses différentes :
 * - une VIGNETTE est un forfait par voiture et par période (Suisse, Autriche, Tchéquie, Slovaquie,
 *   Slovénie, Hongrie) : chiffrée, une fois par voyage et par voiture, pour le pays de DESTINATION
 *   seulement (le moteur ne connaît pas les pays traversés, et le domicile du profil ne se nomme
 *   jamais sur le voyage) ;
 * - un PÉAGE AU KILOMÈTRE (France, Italie…) se paie sur les kilomètres d'autoroute à péage, que la
 *   route mesurée (`routingService`) ne détaille pas : jamais ajouté au budget, seulement DIT avec
 *   son barème moyen quand une source officielle en donne un.
 *
 * Aucune heure du système : la date de référence (début du voyage, sinon « aujourd'hui ») est donnée
 * par l'appelant. Une table dont le tarif ne couvre plus la date du voyage ne chiffre plus rien.
 */

import { convertBetween, type FxRate } from './currency';
import { frenchDay } from './entry';
import { formatMoney } from './format';

/** Une page officielle lue : son nom et son adresse (https). */
export interface SourceRef {
  name: string;
  url: string;
}

/* ---------- Vignettes ---------- */

export interface VignetteProduct {
  /** « 10 jours », « annuelle » : dit dans le titre de la ligne de budget. */
  label: string;
  /** Ce que la source dit de la période couverte. */
  period: string;
  /**
   * Durée garantie en jours à partir du départ (la plus courte quand le tarif parle de mois) ; null
   * quand la vignette vaut pour une période fixée du calendrier (`until`).
   */
  minDays: number | null;
  /** Dernier jour couvert, pour une vignette de période fixée (annuelle) ; null sinon. */
  until: string | null;
  /** Prix par voiture, dans la devise de la ligne, TTC. */
  amount: number;
}

export interface VignetteRow {
  /** ISO 3166-1 alpha-2. */
  country: string;
  name: string;
  /** « suisse » : « Vignette suisse ». */
  adjective: string;
  currency: 'CHF' | 'CZK' | 'EUR' | 'HUF';
  /** Le véhicule du tarif lu. */
  vehicle: string;
  products: VignetteProduct[];
  /** Ce que la source dit de la date du tarif. */
  tariff: string;
  /** Début du tarif quand la source le donne. */
  tariffFrom: string | null;
  /** Dernier jour de départ que ce tarif couvre, quand la source le dit ; null sinon. */
  lastStart: string | null;
  /** Adresse de la source officielle lue (https). */
  source: string;
  sourceName: string;
  /** Autres pages officielles lues qui confirment ou complètent (durées, questions fréquentes). */
  corroboratedBy: SourceRef[];
  /** Jour de la lecture (AAAA-MM-JJ). */
  readOn: string;
  /** Ce que le voyageur doit savoir de ce tarif (dit dans la base de la ligne de budget). */
  caveat: string;
  /** Remarque de lecture pour qui maintient la table (pas dite au voyageur) : hôte refusé, piège rencontré. */
  readingNote: string;
}

const READ_ON = '2026-10-12';

export const VIGNETTES: VignetteRow[] = [
  {
    country: 'CH',
    name: 'Suisse',
    adjective: 'suisse',
    currency: 'CHF',
    vehicle: 'voiture',
    tariff: 'vignette 2026, valable du 1er décembre 2025 au 31 janvier 2027',
    tariffFrom: '2025-12-01',
    lastStart: '2027-01-31',
    products: [
      {
        label: 'annuelle',
        period: 'du 1er décembre 2025 au 31 janvier 2027 (14 mois)',
        minDays: null,
        until: '2027-01-31',
        amount: 40,
      },
    ],
    source:
      'https://www.ch.ch/en/vehicles-and-traffic/how-to-behave-in-road-traffic/motorway-vignette/',
    sourceName: 'ch.ch, portail des autorités suisses',
    corroboratedBy: [
      {
        name: 'Office fédéral de la douane et de la sécurité des frontières (OFDF), portail Via',
        url: 'https://www.bazg.admin.ch/fr/vignette-electronique-achat-portal-via',
      },
    ],
    readOn: READ_ON,
    caveat:
      'ni vignette journalière, ni hebdomadaire, ni mensuelle : une seule vignette, au même prix, autocollante ou électronique',
    readingNote:
      'ch.ch : « There are no daily, weekly or monthly vignettes. » ; l’OFDF confirme les 40 francs et la période.',
  },
  {
    country: 'AT',
    name: 'Autriche',
    adjective: 'autrichienne',
    currency: 'EUR',
    vehicle: 'voiture (3,5 t au plus)',
    tariff: 'tarif 2026, en vigueur depuis le 1er décembre 2025',
    tariffFrom: '2025-12-01',
    lastStart: '2026-11-30',
    products: [
      {
        label: '1 jour',
        period: '1 jour (vignette numérique)',
        minDays: 1,
        until: null,
        amount: 9.6,
      },
      { label: '10 jours', period: '10 jours', minDays: 10, until: null, amount: 12.8 },
      {
        label: '2 mois',
        period: '2 mois (au moins 59 jours)',
        minDays: 59,
        until: null,
        amount: 32,
      },
      {
        label: 'annuelle',
        period: 'vignette 2026, du 1er décembre 2025 au 31 janvier 2027',
        minDays: null,
        until: '2027-01-31',
        amount: 106.8,
      },
    ],
    source:
      'https://www.oesterreich.gv.at/en/themen/mobilitaet/kfz/10/Vignette-und-Maut/Vignette-fuer-Fahrzeuge-bis-3,5-t',
    sourceName:
      'oesterreich.gv.at, portail officiel de l’Autriche (ASFINAG), page mise à jour le 1er janvier 2026',
    corroboratedBy: [],
    readOn: READ_ON,
    caveat:
      'vignette numérique liée à la plaque : achetées en ligne, l’annuelle et celle de 2 mois ne valent qu’à partir du 18e jour après l’achat (droit de rétractation), celles de 1 et 10 jours valent tout de suite ; péages spéciaux (tunnels, cols) non comptés',
    readingNote:
      'La page de l’ASFINAG a refusé la lecture depuis ce poste (403) : prix lus sur le portail officiel de l’État (oesterreich.gv.at), page mise à jour le 1er janvier 2026. « 2 mois » = au moins 59 jours (calcul du Compas).',
  },
  {
    country: 'CZ',
    name: 'Tchéquie',
    adjective: 'tchèque',
    currency: 'CZK',
    vehicle:
      'voiture à carburant standard (tarifs écologiques gaz et hybride rechargeable non appliqués)',
    tariff: 'tarif en vigueur depuis le 1er janvier 2026',
    tariffFrom: '2026-01-01',
    lastStart: null,
    products: [
      { label: '1 jour', period: '1 jour (jusqu’à minuit)', minDays: 1, until: null, amount: 230 },
      { label: '10 jours', period: '10 jours', minDays: 10, until: null, amount: 300 },
      { label: '30 jours', period: '30 jours', minDays: 30, until: null, amount: 480 },
      {
        label: '1 an',
        period: '1 an à partir du jour choisi',
        minDays: 365,
        until: null,
        amount: 2570,
      },
    ],
    source: 'https://edalnice.gov.cz/en/price-list',
    sourceName: 'eDalnice, e-shop officiel de l’État tchèque',
    corroboratedBy: [
      {
        name: 'eDalnice, questions fréquentes (durées de validité)',
        url: 'https://edalnice.gov.cz/en/faq',
      },
    ],
    readOn: READ_ON,
    caveat: 'vignette électronique liée à la plaque, achetable jusqu’à 30 jours à l’avance',
    readingNote:
      'Piège : les textes d’accueil de la page des questions fréquentes portent encore les prix de 2025 (210, 290, 460 et 2 440 CZK) ; la liste des prix « depuis le 1er janvier 2026 » fait foi.',
  },
  {
    country: 'SK',
    name: 'Slovaquie',
    adjective: 'slovaque',
    currency: 'EUR',
    vehicle: 'voiture (3,5 t au plus)',
    tariff:
      'nariadenie vlády n° 232/2024 Z. z., tarif affiché le 12 octobre 2026 sans date de début',
    tariffFrom: null,
    lastStart: null,
    products: [
      {
        label: '1 jour',
        period: '1 jour (jusqu’à 23 h 59 min 59 s)',
        minDays: 1,
        until: null,
        amount: 8.1,
      },
      {
        label: '10 jours',
        period: '10 jours, jour choisi compris',
        minDays: 10,
        until: null,
        amount: 10.8,
      },
      {
        label: '30 jours',
        period: '30 jours, jour choisi compris',
        minDays: 30,
        until: null,
        amount: 17.1,
      },
      {
        label: '365 jours',
        period: '365 jours, jour choisi compris',
        minDays: 365,
        until: null,
        amount: 90,
      },
    ],
    source: 'https://eznamka.sk/sk/dialnicne-znamky/typy-a-ceny',
    sourceName: 'Národná diaľničná spoločnosť, eznamka.sk (vignette électronique slovaque)',
    corroboratedBy: [],
    readOn: READ_ON,
    caveat: 'prix TTC ; la page ne donne pas la date de début du tarif',
    readingNote:
      'Prix lus sur la page de l’opérateur, qui cite le règlement n° 232/2024 Z. z. (non relu) ; aucune autre source officielle lue.',
  },
  {
    country: 'SI',
    name: 'Slovénie',
    adjective: 'slovène',
    currency: 'EUR',
    vehicle:
      'voiture, classe 2A (3,5 t au plus, hauteur au-dessus de l’essieu avant jusqu’à 1,30 m)',
    tariff: 'décret du gouvernement slovène, en vigueur depuis le 1er juillet 2025',
    tariffFrom: '2025-07-01',
    lastStart: null,
    products: [
      {
        label: '7 jours',
        period: 'vignette hebdomadaire : 7 jours consécutifs, jour choisi compris',
        minDays: 7,
        until: null,
        amount: 16,
      },
      {
        label: '1 mois',
        period: 'vignette mensuelle : jusqu’au même quantième du mois suivant (au moins 28 jours)',
        minDays: 28,
        until: null,
        amount: 32,
      },
    ],
    source: 'https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/2025-01-1893',
    sourceName:
      'Uradni list RS n° 46/2025 (décret sur les routes à péage et le péage), Journal officiel de la Slovénie',
    corroboratedBy: [
      {
        name: 'Uradni list RS n° 24/2015 (loi sur le péage, durées des vignettes)',
        url: 'https://www.uradni-list.si/glasilo-uradni-list-rs/vsebina/2015-01-0991',
      },
    ],
    readOn: READ_ON,
    caveat: 'prix TTC ; vignette annuelle écartée (sa période n’a pas pu être confirmée)',
    readingNote:
      'La page de vente de DARS était illisible depuis ce poste (connexion refusée) : prix du décret en vigueur (UL RS 46/2025), durées de la loi de 2015 (UL RS 24/2015), la loi de 2024 n’a pas été relue ; « 1 mois » = au moins 28 jours (calcul du Compas).',
  },
  {
    country: 'HU',
    name: 'Hongrie',
    adjective: 'hongroise',
    currency: 'HUF',
    vehicle: 'voiture, catégorie D1 (3,5 t au plus)',
    tariff: 'tarif valable à partir du 1er janvier 2026',
    tariffFrom: '2026-01-01',
    lastStart: null,
    products: [
      {
        label: '1 jour',
        period: 'vignette quotidienne (« Napi »)',
        minDays: 1,
        until: null,
        amount: 5550,
      },
      {
        label: '10 jours',
        period: 'vignette « Heti (10 napos) » : 10 jours',
        minDays: 10,
        until: null,
        amount: 6900,
      },
      {
        label: '1 mois',
        period: 'vignette mensuelle (« Havi »), au moins 28 jours',
        minDays: 28,
        until: null,
        amount: 11170,
      },
    ],
    source: 'https://nemzetiutdij.hu/api/uploads/e_matrica_arak_2026_pdf_611db0ecc1.pdf',
    sourceName:
      'Nemzeti Útdíjfizetési Szolgáltató Zrt. (opérateur public), « E-matrica rendszerben alkalmazott díjak »',
    corroboratedBy: [],
    readOn: READ_ON,
    caveat:
      'prix TTC en forints ; vignette annuelle (61 760 Ft) écartée : le tarif lu ne dit pas sa période de validité',
    readingNote:
      'PDF officiel de l’opérateur public, valable à partir du 1er janvier 2026 (ITM 45/2020) ; « 1 mois » = au moins 28 jours (calcul du Compas).',
  },
];

/* ---------- Péages au kilomètre ---------- */

export interface PerKmRate {
  label: string;
  /** Euros par kilomètre, voiture légère (classe 1 / A). */
  eurPerKm: number;
}

export interface PerKmToll {
  country: string;
  name: string;
  network: string;
  vehicle: string;
  /** Le véhicule en deux mots, pour la phrase de la base (« véhicules légers », « classe A »). */
  vehicleShort: string;
  rates: PerKmRate[];
  /** TVA à ajouter quand la source donne un prix hors taxes (0,2) ; null quand le prix est déjà TTC. */
  vatRate: number | null;
  /** Pages officielles qui disent le taux de TVA appliqué, obligatoires si `vatRate` est posé. */
  vatSources: SourceRef[];
  /** Jour auquel valent les tarifs lus. */
  asOf: string;
  /** Période ou barème que le chiffre couvre. */
  period: string;
  /** Ce que le chiffre ne couvre pas. */
  scope: string;
  source: string;
  sourceName: string;
  /** La source en deux mots, pour la phrase de la base (« ART »). */
  sourceShort: string;
  readOn: string;
}

export const PER_KM_TOLLS: PerKmToll[] = [
  {
    country: 'FR',
    name: 'France',
    network: 'les autoroutes concédées',
    vehicle: 'véhicules légers (classe 1)',
    vehicleShort: 'véhicules légers',
    rates: [{ label: 'moyenne pondérée par les trafics', eurPerKm: 0.0927 }],
    vatRate: 0.2,
    vatSources: [
      {
        name: 'Direction générale des douanes, « Les taux de TVA » (taux normal de 20 %)',
        url: 'https://www.douane.gouv.fr/fiche/les-taux-de-tva',
      },
      {
        name: 'BOFiP-Impôts (péages perçus par le concessionnaire, taux normal)',
        url: 'https://bofip.impots.gouv.fr/bofip/1402-PGP.html/identifiant=BOI-TVA-LIQ-20-20-20240807',
      },
    ],
    asOf: '2024-02-01',
    period:
      'tarif moyen par kilomètre parcouru au 1er février 2024, hors taxes (rapport de décembre 2025)',
    scope:
      'moyenne de tout le réseau concédé : un axe peut coûter bien plus ou moins ; les hausses des 1er février 2025 et 2026 ne sont pas lues',
    source:
      'https://www.autorite-transports.fr/wp-content/uploads/2025/12/synthese_des_comptes_sca_2024.pdf',
    sourceName:
      'Autorité de régulation des transports, synthèse des comptes des sociétés concessionnaires d’autoroutes, exercice 2024',
    sourceShort: 'source : ART',
    readOn: READ_ON,
  },
  {
    country: 'IT',
    name: 'Italie',
    network: 'le réseau Autostrade per l’Italia',
    vehicle: 'classe A (deux essieux, hauteur au-dessus de l’essieu avant jusqu’à 1,30 m)',
    vehicleShort: 'classe A',
    rates: [
      { label: 'plaine', eurPerKm: 0.07869 },
      { label: 'montagne', eurPerKm: 0.09315 },
    ],
    vatRate: null,
    vatSources: [],
    asOf: '2026-01-01',
    period: 'tarif unitaire TTC (TVA de 22 % comprise) mis à jour le 1er janvier 2026',
    scope:
      'le réseau Autostrade per l’Italia seulement : chaque autre concessionnaire a son propre tarif au km, non lu',
    source: 'https://www.autostrade.it/en/servizi-al-cliente/pedaggio/come-si-calcola-il-pedaggio',
    sourceName: 'Autostrade per l’Italia, « Come si calcola il pedaggio »',
    sourceShort: 'source : l’opérateur',
    readOn: READ_ON,
  },
  {
    country: 'ES',
    name: 'Espagne',
    network: 'les autoroutes d’État gérées par la SEITT (R-2, R-3/R-5, R-4, M-12, AP-7 Carthagène–Vera, AP-36 Ocaña–La Roda, AP-41 Madrid–Tolède)',
    vehicle: 'véhicules légers (motos, voitures avec ou sans remorque sans roues jumelées, fourgonnettes à deux essieux)',
    vehicleShort: 'véhicules légers',
    rates: [
      { label: 'tarif avec badge (TAG)', eurPerKm: 0.0827 },
      { label: 'tarif sans badge', eurPerKm: 0.0927 },
    ],
    vatRate: 0.21,
    vatSources: [
      {
        name: 'BOE, loi 37/1992 du 28 décembre 1992 sur la TVA, article 90 (taux général de 21 %, sauf les taux réduits de l’article 91, où les péages ne figurent pas)',
        url: 'https://www.boe.es/buscar/act.php?id=BOE-A-1992-28740',
      },
    ],
    asOf: '2025-01-01',
    period:
      'tarifs maximaux de 2025 hors TVA, en euros par kilomètre (accord du Conseil des ministres du 3 décembre 2024, modifié le 9 décembre 2025) ; à partir de 2026 la hausse annuelle est plafonnée à 2 % et le tarif de 2026 n’a pas été lu',
    scope:
      'seulement les autoroutes gérées par la SEITT ; les autoroutes concédées (AP-7 Méditerranée, AP-6, AP-9, AP-68…) ont chacune leur tarif, non lu',
    source: 'https://www.boe.es/buscar/doc.php?id=BOE-A-2025-25961',
    sourceName:
      'Boletín Oficial del Estado, résolution du 10 décembre 2025 publiant l’accord du Conseil des ministres du 9 décembre 2025 (tarifs des autoroutes de l’État)',
    sourceShort: 'source : BOE',
    readOn: READ_ON,
  },
];

/** Pays cherchés sans barème moyen au kilomètre lisible à une source officielle : non chiffrés, dit. */
export interface PerKmUnquantified {
  country: string;
  name: string;
  reason: string;
  checkedOn: string;
}

export const PER_KM_UNQUANTIFIED: PerKmUnquantified[] = [
  {
    country: 'PT',
    name: 'Portugal',
    reason:
      'l’IMT publie la taxe de classe 1 de chaque sous-lanço avec sa longueur et Brisa une matrice origine-destination, mais aucune moyenne au kilomètre ; elle varie selon l’axe, et Brisa date son tableau du 26 août 2026 sans que celui de l’IMT (« taxes de 2026 ») dise s’il en tient compte',
    checkedOn: READ_ON,
  },
  {
    country: 'HR',
    name: 'Croatie',
    reason:
      'HAC publie en euros une matrice de tarifs entre deux péages pour chaque autoroute (en vigueur depuis le 1er janvier 2023), pas le prix unitaire au kilomètre dont elle part (annoncé en kunas seulement) ni de barème moyen ; majoration de 10 % de la catégorie I du 1er juillet au 30 septembre',
    checkedOn: READ_ON,
  },
  {
    country: 'GR',
    name: 'Grèce',
    reason:
      'péages par station ; le barème de l’Egnatia Odos a changé le 1er janvier 2026 et son barème officiel n’a pas été lu',
    checkedOn: READ_ON,
  },
];

/* ---------- Contrôle des tables (utilisé par les tests : une ligne sans source ne passe pas) ---------- */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\/[^\s/]+\.[^\s/]+\S*$/;

function realDay(iso: unknown): iso is string {
  if (typeof iso !== 'string' || !ISO_DAY.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

const blank = (v: unknown) => typeof v !== 'string' || v.trim().length === 0;

/** Ce qui manque à une ligne de vignette : vide = la ligne est complète. */
export function vignetteProblems(row: VignetteRow): string[] {
  const out: string[] = [];
  const who = row.country || '??';
  if (!/^[A-Z]{2}$/.test(row.country ?? '')) out.push(`${who} : pays illisible`);
  if (typeof row.source !== 'string' || !HTTPS.test(row.source))
    out.push(`${who} : source absente ou pas en https`);
  for (const c of row.corroboratedBy ?? [])
    if (typeof c?.url !== 'string' || !HTTPS.test(c.url) || blank(c.name))
      out.push(`${who} : page de confirmation sans nom ou pas en https`);
  if (blank(row.sourceName)) out.push(`${who} : nom de la source absent`);
  if (!realDay(row.readOn)) out.push(`${who} : date de lecture absente ou fausse`);
  if (!['CHF', 'CZK', 'EUR', 'HUF'].includes(row.currency)) out.push(`${who} : devise absente`);
  if (blank(row.vehicle) || blank(row.tariff) || blank(row.caveat))
    out.push(`${who} : véhicule, tarif ou précision absent`);
  if (typeof row.readingNote !== 'string') out.push(`${who} : remarque de lecture absente`);
  if (row.tariffFrom != null && !realDay(row.tariffFrom)) out.push(`${who} : début du tarif faux`);
  if (row.lastStart != null && !realDay(row.lastStart)) out.push(`${who} : dernier départ faux`);
  if (!row.products?.length) out.push(`${who} : aucun produit`);
  for (const p of row.products ?? []) {
    const id = `${who} ${p.label || '??'}`;
    if (blank(p.label) || blank(p.period)) out.push(`${id} : libellé ou période absent`);
    if (!(typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount > 0))
      out.push(`${id} : montant absent`);
    if (p.minDays == null && p.until == null) out.push(`${id} : ni durée ni période fixée`);
    if (p.minDays != null && !(Number.isInteger(p.minDays) && p.minDays > 0))
      out.push(`${id} : durée fausse`);
    if (p.until != null && !realDay(p.until)) out.push(`${id} : fin de période fausse`);
  }
  return out;
}

export function perKmProblems(row: PerKmToll): string[] {
  const out: string[] = [];
  const who = row.country || '??';
  if (typeof row.source !== 'string' || !HTTPS.test(row.source))
    out.push(`${who} : source absente ou pas en https`);
  if (blank(row.sourceName)) out.push(`${who} : nom de la source absent`);
  if (!realDay(row.readOn)) out.push(`${who} : date de lecture absente ou fausse`);
  if (!realDay(row.asOf)) out.push(`${who} : date des tarifs absente ou fausse`);
  if (
    blank(row.period) ||
    blank(row.scope) ||
    blank(row.network) ||
    blank(row.vehicle) ||
    blank(row.vehicleShort) ||
    blank(row.sourceShort)
  )
    out.push(`${who} : période, portée, réseau, véhicule ou source abrégée absent`);
  if (!row.rates?.length) out.push(`${who} : aucun tarif`);
  for (const r of row.rates ?? []) {
    if (blank(r.label) || !(typeof r.eurPerKm === 'number' && r.eurPerKm > 0 && r.eurPerKm < 1))
      out.push(`${who} ${r.label || '??'} : tarif au km faux`);
  }
  if (row.vatRate != null) {
    if (!(row.vatRate > 0 && row.vatRate < 0.5)) out.push(`${who} : TVA fausse`);
    if (
      !row.vatSources?.length ||
      row.vatSources.some((u) => typeof u?.url !== 'string' || !HTTPS.test(u.url) || blank(u.name))
    )
      out.push(`${who} : TVA sans source https`);
  }
  return out;
}

export function unquantifiedProblems(row: PerKmUnquantified): string[] {
  const out: string[] = [];
  if (blank(row.reason)) out.push(`${row.country} : raison absente`);
  if (!realDay(row.checkedOn)) out.push(`${row.country} : date de vérification absente ou fausse`);
  return out;
}

/** Les sources lues, par pays (la principale d'abord, puis celles qui confirment), pour le crédit des mentions légales. */
export function tollSources(): Array<{
  country: string;
  name: string;
  refs: SourceRef[];
  readOn: string;
}> {
  return [
    ...VIGNETTES.map((r) => ({
      country: r.country,
      name: r.name,
      refs: [{ name: r.sourceName, url: r.source }, ...r.corroboratedBy],
      readOn: r.readOn,
    })),
    ...PER_KM_TOLLS.map((r) => ({
      country: r.country,
      name: r.name,
      refs: [{ name: r.sourceName, url: r.source }, ...r.vatSources],
      readOn: r.readOn,
    })),
  ];
}

/* ---------- Dates (sans heure du système) ---------- */

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const day = (iso: string) => frenchDay(iso) ?? iso;
const normal = (cc: string | null | undefined) => (cc ?? '').trim().toUpperCase();

/* ---------- Vignette d'un voyage ---------- */

export function vignetteRow(country: string | null | undefined): VignetteRow | null {
  const cc = normal(country);
  return VIGNETTES.find((r) => r.country === cc) ?? null;
}

/** La devise de la vignette du pays (pour chercher le taux de change), ou null sans vignette. */
export function tollCurrency(country: string | null | undefined): VignetteRow['currency'] | null {
  return vignetteRow(country)?.currency ?? null;
}

export type VignetteMiss = 'no-row' | 'bad-date' | 'before-tariff' | 'after-tariff' | 'too-long';

export type VignetteChoice =
  | { ok: true; row: VignetteRow; product: VignetteProduct; days: number; from: string; to: string }
  | { ok: false; reason: VignetteMiss; row: VignetteRow | null; days: number; from: string | null };

/**
 * La vignette la moins chère qui couvre le voyage : `days` jours à partir de `from` (AAAA-MM-JJ).
 * Rien n'est choisi quand le tarif lu ne vaut plus à cette date, ni quand aucune vignette lue ne
 * couvre la durée (on ne combine pas, on n'extrapole pas).
 */
export function chooseVignette(
  country: string | null | undefined,
  input: { days: number; from: string }
): VignetteChoice {
  const row = vignetteRow(country);
  const days = Math.min(365, Math.max(1, Math.floor(Number.isFinite(input.days) ? input.days : 1)));
  if (!row) return { ok: false, reason: 'no-row', row: null, days, from: null };
  if (!realDay(input.from)) return { ok: false, reason: 'bad-date', row, days, from: null };
  // Le tarif lu ne vaut ni avant son entrée en vigueur (un tarif plus récent n'est pas celui d'alors), ni après sa fin.
  if (row.tariffFrom && input.from < row.tariffFrom)
    return { ok: false, reason: 'before-tariff', row, days, from: input.from };
  if (row.lastStart && input.from > row.lastStart)
    return { ok: false, reason: 'after-tariff', row, days, from: input.from };
  const to = addDays(input.from, days - 1);
  const covering = row.products.filter(
    (p) => (p.minDays == null || p.minDays >= days) && (p.until == null || to <= p.until)
  );
  if (!covering.length) return { ok: false, reason: 'too-long', row, days, from: input.from };
  const product = covering.reduce((best, p) => (p.amount < best.amount ? p : best));
  return { ok: true, row, product, days, from: input.from, to };
}

/**
 * Une vignette est une dépense DU VOYAGE seulement si une voiture roule (trajet d'approche ou kilomètres
 * sur place) et que le voyage passe une frontière : dans son propre pays, la vignette du résident n'est
 * pas une dépense du voyage. Départ inconnu (`abroad` null) : on ne sait pas, la vignette est chiffrée
 * et la base dit qu'elle l'est pour le pays de destination.
 */
export function needsVignette(input: { drives: boolean; abroad: boolean | null }): boolean {
  return input.drives && input.abroad !== false;
}

/**
 * VIE PRIVÉE : la ligne « Vignette » est rangée sur le voyage (lisible par les collaborateurs). Si elle
 * n'existait que pour un voyage « à l'étranger » tiré du domicile du profil ou de la position de l'appareil,
 * son absence dirait où habite le lanceur. Pour ces deux départs, `abroad` est donc traité comme inconnu :
 * la vignette est chiffrée, la base dit que le résident en a peut-être déjà une. Un départ DIT dans la
 * demande (« depuis Lyon ») est un fait du voyage : il compte.
 */
export function abroadForVignette(
  abroad: boolean | null,
  originSource: 'dit' | 'domicile' | 'gps' | null | undefined
): boolean | null {
  return originSource === 'domicile' || originSource === 'gps' ? null : abroad;
}

export interface TripTollsInput {
  /** Pays de destination (ISO alpha-2). */
  country: string | null | undefined;
  /** Jours du voyage (la lecture unique de `tripContext`). */
  days: number;
  /** Voitures du voyage : une vignette par voiture. */
  cars: number;
  /** Premier jour du voyage (AAAA-MM-JJ) ; sans lui, `today`. */
  start: string | null | undefined;
  /** Aujourd'hui (AAAA-MM-JJ), donné par l'appelant. */
  today: string;
  /** Taux EUR → devise de la vignette ; un taux absent n'est jamais deviné. */
  rates: Partial<Record<string, FxRate | null>>;
}

export interface TripTolls {
  /** La ligne de budget en euros, ou null quand rien n'est chiffré. */
  line: { title: string; amount: number; basis: string } | null;
  /** Ce qui n'est pas compté et pourquoi (une phrase chacune). */
  notes: string[];
}

const rateNumber = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 4 });
const rateWhole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/**
 * Les péages forfaitaires (vignette) d'un voyage en voiture : le pays de destination seulement, une
 * vignette par voiture. Le pays de départ et les pays traversés ne sont jamais comptés, et la base le dit.
 * Un pays sans vignette lue : ni ligne ni note (rien à dire). Une vignette qui existe mais ne peut pas
 * être chiffrée (tarif échu, durée trop longue, taux de change introuvable) : pas de ligne, une note.
 */
export function tripTolls(input: TripTollsInput): TripTolls {
  const row = vignetteRow(input.country);
  if (!row) return { line: null, notes: [] };
  const usedToday = !(typeof input.start === 'string' && realDay(input.start));
  const from = usedToday ? input.today : (input.start as string);
  const choice = chooseVignette(input.country, { days: input.days, from });
  const label = `Vignette ${row.adjective}`;
  if (!choice.ok) {
    const why =
      choice.reason === 'before-tariff'
        ? `le tarif lu le ${day(row.readOn)} vaut à partir du ${day(row.tariffFrom ?? row.readOn)} et le voyage commence avant`
        : choice.reason === 'after-tariff'
          ? `le tarif lu le ${day(row.readOn)} vaut jusqu’au ${day(row.lastStart ?? row.readOn)} et le voyage commence après`
          : choice.reason === 'too-long'
            ? `aucune vignette lue ne couvre ${choice.days} jour${choice.days > 1 ? 's' : ''}`
            : 'la date du voyage est illisible';
    return {
      line: null,
      notes: [
        `${label} non comptée : ${why}. Vérifie son prix avant de partir (${row.sourceName}).`,
      ],
    };
  }
  const { product } = choice;
  const cars = Math.max(1, Math.floor(input.cars) || 1);
  const price = formatMoney(product.amount, row.currency);
  let eurEach = product.amount;
  let conversion = '';
  if (row.currency !== 'EUR') {
    const conv = convertBetween(product.amount, row.currency, 'EUR', input.rates);
    if (!conv) {
      return {
        line: null,
        notes: [
          `${label} non comptée : ${price} par voiture (${product.label}), conversion en euros indisponible (taux de change non joignable). Vérifie son prix avant de partir.`,
        ],
      };
    }
    eurEach = conv.amount;
    const perEur = 1 / conv.rate;
    conversion = ` · soit environ ${formatMoney(conv.amount, 'EUR')} (1 € = ${perEur >= 1000 ? rateWhole.format(perEur) : rateNumber.format(perEur)} ${row.currency}, taux du ${frenchDay(conv.date) ?? conv.date}, ${conv.source})`;
  }
  const basis = [
    `tarif officiel lu le ${day(row.readOn)} (${row.sourceName})`,
    `${row.vehicle} : vignette ${product.label} à ${price} par voiture, ${row.tariff}${conversion}`,
    `${choice.days} jour${choice.days > 1 ? 's' : ''} de voyage du ${day(choice.from)} au ${day(choice.to)}${usedToday ? ' (dates non fixées : date de la préparation)' : ''}`,
    `${cars} voiture${cars > 1 ? 's' : ''}, une vignette chacune`,
    'pays de destination seulement : pays de départ et pays traversés non comptés',
    row.caveat,
  ].join(' · ');
  return {
    line: {
      title: `${label} · ${product.label}${cars > 1 ? ` × ${cars} voitures` : ''}`.slice(0, 100),
      amount: eurEach * cars,
      basis,
    },
    notes: [],
  };
}

/* ---------- Péages « non comptés » : dire pourquoi ---------- */

/** Pourquoi les péages au kilomètre ne sont jamais ajoutés au budget. */
export const TOLLS_REASON = 'le trajet mesuré ne donne pas ses km d’autoroute à péage';

const cents = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Le barème moyen au kilomètre d'un pays, TTC, en centimes. */
export function perKmCents(row: PerKmToll): Array<{ label: string; cents: number }> {
  return row.rates.map((r) => ({
    label: r.label,
    cents: Math.round(r.eurPerKm * (1 + (row.vatRate ?? 0)) * 1000) / 10,
  }));
}

/**
 * Ce que le Compas peut dire d'un pays sur ses péages au kilomètre : le barème moyen quand une source
 * officielle en donne un (avec sa source, sa date et ce qu'il ne couvre pas), « aucun barème lu » pour
 * les pays cherchés sans résultat, rien ailleurs.
 */
export function perKmHint(country: string | null | undefined): string | null {
  const cc = normal(country);
  const row = PER_KM_TOLLS.find((r) => r.country === cc);
  if (row) {
    const rates = perKmCents(row);
    const text =
      rates.length === 1
        ? `${cents.format(rates[0].cents)} c€/km TTC en moyenne`
        : rates.map((r) => `${cents.format(r.cents)} c€/km TTC en ${r.label}`).join(' et ');
    const vat =
      row.vatRate != null
        ? `TVA de ${Math.round(row.vatRate * 100)} % ajoutée au prix hors taxes`
        : 'TVA comprise';
    return `${row.name} : ${text} sur ${row.network} (${row.vehicleShort}, tarifs du ${day(row.asOf)}, ${vat}, ${row.sourceShort}) ; ${row.scope}`;
  }
  const none = PER_KM_UNQUANTIFIED.find((r) => r.country === cc);
  return none ? `${none.name} : aucun barème moyen au km lu à une source officielle` : null;
}

/** La fin de la base d'une ligne de carburant : « péages non comptés (pourquoi) », avec le barème du pays s'il existe. */
export function tollsBasis(country?: string | null): string {
  const hint = perKmHint(country);
  return `péages non comptés (${TOLLS_REASON}${hint ? ` ; ${hint}` : ''})`;
}
