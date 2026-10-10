/**
 * Compas — la table des flux Meteoalarm (plan 4.9). C'est la SEULE liste de pays
 * des alertes officielles : un pays qui n'y figure pas est « non couvert ».
 *
 * CONDITIONS D'USAGE, lues le 2026-10-10 sur la page officielle
 * https://meteoalarm.org/en/live/page/terms-and-conditions (mise à jour du
 * 15/03/2024), § 5 « Use and Redistribution of Information » :
 *   « All Information on the MeteoAlarm Website may be used and redistributed
 *   under terms equivalent to the Creative Commons Attribution 4.0
 *   International License (CC BY 4.0), along with the following additional
 *   requirements »
 * donc l'usage commercial est permis, à ces conditions :
 * - une alerte modifiée est redonnée AVEC l'information officielle sans
 *   changement : le texte officiel (`headline`) et le lien vers la page du
 *   service accompagnent la mise en forme du Compas ;
 * - pour un seul pays, le NOM DU SERVICE NATIONAL (`providers`) est toujours
 *   affiché ;
 * - l'heure d'émission (`sent`) est toujours affichée ;
 * - un lien vers meteoalarm.org (`METEOALARM_HOME`) accompagne l'information ;
 * - l'information est rendue en temps réel : en moyenne moins de 5 minutes de
 *   retard, jamais plus de 10 (cache du serveur : 5 minutes au plus) ;
 * - l'avertissement `METEOALARM_DISCLAIMER` est publié mot pour mot.
 * Aucune fréquence d'appel n'est chiffrée par Meteoalarm (« Redistribution
 * Hub », page lue le même jour) ; le cache de 5 minutes par instance est donc
 * aussi la limite de nos appels.
 *
 * Noms des services : page « Our Warning Providers »
 * https://meteoalarm.org/en/live/page/warning-providers (lue le 2026-10-10).
 *
 * Flux : `https://feeds.meteoalarm.org/api/v1/warnings/feeds-<slug>`, l'adresse
 * que les flux Atom officiels (https://feeds.meteoalarm.org) donnent en lien
 * `application/cap+xml` pour chaque alerte. Ne figurent ici que les pays dont
 * le flux portait des alertes à la lecture du 10 octobre 2026. Royaume-Uni,
 * Luxembourg, Malte, Moldavie, Macédoine du Nord et Slovaquie rendaient un flux
 * vide : on ne sait pas s'il est calme ou à l'arrêt, donc « non couvert » plutôt
 * qu'un faux « aucune alerte ».
 */

export const METEOALARM_HOME = 'https://meteoalarm.org/en/live/';
export const METEOALARM_TERMS = 'https://meteoalarm.org/en/live/page/terms-and-conditions';

/** Avertissement que tout redistributeur doit publier (conditions, § 5), texte officiel en anglais. */
export const METEOALARM_DISCLAIMER =
  'Time delays between this website and the www.meteoalarm.org website are possible. For the most up-to-date awareness information as published by the participating National Meteorological and Hydrological Services, please refer to www.meteoalarm.org.';

/** Le même avertissement en français, donné avec l'original. */
export const METEOALARM_DISCLAIMER_FR =
  'Des décalages entre ce site et meteoalarm.org sont possibles. Pour l’information la plus à jour publiée par les services météorologiques et hydrologiques nationaux, rends-toi sur meteoalarm.org.';

/** « <service national> via Meteoalarm » : la source affichée d'une alerte. */
const VIA = ' via Meteoalarm';
export const meteoalarmSource = (provider: string) => `${provider}${VIA}`;
export const isMeteoalarmSource = (source: string) => source.endsWith(VIA);

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * L'heure d'émission d'une alerte, en UTC et sans dépendre de la machine :
 * « 10 oct. 2026, 16 h 00 UTC ». Une date sans heure ou illisible : null (rien
 * d'inventé). Meteoalarm l'exige avec toute alerte redistribuée (conditions, § 5).
 */
export function formatIssuedUtc(iso: string | null | undefined): string | null {
  if (typeof iso !== 'string' || !/T\d{2}:\d{2}/.test(iso)) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${d.getUTCHours()} h ${mm} UTC`;
}

export interface MeteoalarmProvider {
  /** Nom du service tel que Meteoalarm le publie. */
  name: string;
  /** Reconnaît ce service dans l'expéditeur (`senderName`) d'une alerte, quand le pays en a plusieurs. */
  sender?: RegExp;
}

export interface MeteoalarmFeed {
  /** Fin de l'adresse du flux : `feeds-<slug>`. */
  slug: string;
  providers: MeteoalarmProvider[];
  /**
   * Les zones du flux sont les départements, nommés comme la carte : un
   * département absent du flux n'a pas d'alerte (vérifié le 2026-10-01, flux de
   * Météo-France). Faux ailleurs : un nom absent peut être un nom que la carte
   * ne donne pas pareil, jamais la preuve d'une zone calme.
   */
  namesAreComplete?: boolean;
}

const one = (slug: string, name: string): MeteoalarmFeed => ({ slug, providers: [{ name }] });

/** Clé : code pays ISO 3166-1 alpha-2 en minuscules (celui que rend la carte). */
export const METEOALARM_FEEDS: Record<string, MeteoalarmFeed> = {
  ad: one('andorra', 'Servei Meteorològic Nacional (SMN)'),
  at: one('austria', 'GeoSphere Austria'),
  ba: {
    slug: 'bosnia-herzegovina',
    providers: [
      { name: 'Federalni Hidrometeorološki Zavod BiH (FHMZ)', sender: /federal|federation/i },
      { name: 'Republički Hidrometeorološki Zavod Republike Srpske (RHMZ RS)', sender: /srpske|republi[cč]ki/i },
    ],
  },
  be: one('belgium', 'Institut Royal Météorologique/Koninklijk Meteorologisch Instituut (IRM/KMI)'),
  bg: one('bulgaria', 'National Institute of Meteorology and Hydrology (NIMH)'),
  ch: one('switzerland', 'Federal Office of Meteorology and Climatology MeteoSwiss'),
  cy: one('cyprus', 'Cyprus Department of Meteorology (CYMET)'),
  cz: one('czechia', 'Czech Hydrometeorological Institute (CHMI)'),
  de: one('germany', 'Deutscher Wetterdienst (DWD)'),
  dk: one('denmark', 'Danmarks Meteorologiske Institut (DMI)'),
  ee: one('estonia', 'Estonian Environment Agency (ESTEA)'),
  es: one('spain', 'Agencia Estatal de Meteorología (AEMET)'),
  fi: one('finland', 'Finnish Meteorological Institute (FMI)'),
  fr: { slug: 'france', providers: [{ name: 'Météo-France' }], namesAreComplete: true },
  gr: one('greece', 'Hellenic National Meteorological Service (HNMS)'),
  hr: one('croatia', 'Državni Hidrometeorološki Zavod (DHMZ)'),
  hu: one('hungary', 'HungaroMet'),
  ie: one('ireland', 'Met Éireann'),
  il: one('israel', 'Israel Meteorological Service (IMS)'),
  is: one('iceland', 'Icelandic Meteorological Office (IMO)'),
  it: one('italy', 'Servizio Meteorologico dell’Aeronautica Militare (MeteoAM)'),
  lt: one('lithuania', 'Lietuvos Hidrometeorologijos Tarnyba (LHMT)'),
  lv: one('latvia', 'Latvijas Vides, Ģeoloģijas un Meteoroloģijas Centrs (LVĢMC)'),
  me: one('montenegro', 'Zavod za Hidrometeorologiju i Seizmologiju (ZHMS)'),
  nl: one('netherlands', 'Koninklijk Nederlands Meteorologisch Instituut (KNMI)'),
  no: {
    slug: 'norway',
    providers: [
      { name: 'Meteorologisk Institutt (MET Norway)', sender: /met norway|meteorolog/i },
      { name: 'Norges Vassdrags- og Energidirektorat (NVE)', sender: /vassdrags|water resources|\bnve\b/i },
    ],
  },
  pl: one('poland', 'Instytut Meteorologii i Gospodarki Wodnej - Państwowy Instytut Badawczy (IMGW-PIB)'),
  pt: one('portugal', 'Instituto Português do Mar e da Atmosfera (IPMA)'),
  ro: one('romania', 'Administrația Națională de Meteorologie (ANM)'),
  rs: one('serbia', 'Republički Hidrometeorološki Zavod Srbije (RHMZ)'),
  se: one('sweden', 'Sveriges Meteorologiska och Hydrologiska Institut (SMHI)'),
  si: one('slovenia', 'Agencija Republike Slovenije za Okolje (ARSO)'),
  ua: one('ukraine', 'Ukrainian Hydrometeorological Center (UHMC)'),
};

export function feedUrl(feed: MeteoalarmFeed): string {
  return `https://feeds.meteoalarm.org/api/v1/warnings/feeds-${feed.slug}`;
}

/**
 * Le service national à nommer pour une alerte. Un seul service dans le pays :
 * son nom officiel (jamais l'expéditeur brut, qui peut être une personne).
 * Plusieurs : celui que l'expéditeur désigne, sinon TOUS, sans en choisir un.
 */
export function providerLabel(feed: MeteoalarmFeed, senders: string[]): string {
  if (feed.providers.length === 1) return feed.providers[0].name;
  const hit = feed.providers.find((p) => p.sender && senders.some((s) => p.sender!.test(s)));
  return hit ? hit.name : feed.providers.map((p) => p.name).join(' / ');
}
