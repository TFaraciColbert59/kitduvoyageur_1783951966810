import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « compas-autofill » — le spécialiste senior de la préparation.
 *
 * Deux temps, deux appels :
 *  1. ÉTAPES : il propose un itinéraire jour par jour (lieux réels, moyen de
 *     déplacement, jours d'acclimatation). Chaque lieu est ensuite retrouvé
 *     sur la carte dans le pays du voyage, ou écarté (`sanitizeStages`).
 *  2. CHIFFRAGE : sur les faits calculés (nuits, trajet mesuré, matériel,
 *     prix en base), il chiffre ce que la base ne connaît pas — repas,
 *     hébergement, vol, transports sur place, visa et permis, assurance —
 *     borné par `sanitizeAdvice` et toujours affiché comme une estimation.
 *
 * tier `heavy` (raisonnement utile), cache 0 : chaque voyage est unique.
 */

export const COMPAS_AUTOFILL_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 2000,
  cacheTtlSeconds: 0,
  maxPerUserPerDay: 20,
};

/**
 * Langue des textes que l'IA écrit (PLAN-100 6.2) : celle de l'INTERFACE du lanceur, jamais sa
 * nationalité. Seule la valeur exacte `'en'` change la consigne ; tout le reste (absent, ancien
 * appel avec un booléen) donne la consigne française d'avant, au caractère près.
 */
export type CompasAiLocale = 'fr' | 'en' | 'es' | 'de' | 'it';

/**
 * Langue dans laquelle l'IA écrit pour une langue d'interface. Le français et l'anglais
 * seulement (PLAN-100 6.2) ; `null` pour une langue d'interface que l'IA n'écrit pas encore
 * (espagnol, allemand, italien) : ses textes ne sont alors pas montrés, plutôt que de mêler
 * deux langues à l'écran. Les règles du Compas, elles, parlent toutes les langues.
 */
export function compasAiLocale(locale: string): CompasAiLocale | null {
  return locale === 'fr' || locale === 'en' || locale === 'es' || locale === 'de' || locale === 'it' ? locale : null;
}

export function buildCompasStagesSystem(locale?: CompasAiLocale): string {
  const lines = [
    'Tu es le specialiste senior de la preparation de voyages et d activites outdoor d une application francaise.',
    'Tu construis un itineraire realiste JOUR PAR JOUR pour la destination, la duree et l activite donnees.',
    'Regles imperatives :',
    '1. Reponds UNIQUEMENT par un objet JSON compact, une ligne par jour : {"stages": [[1, "lieu", "move", "note"], [2, "lieu", "move", ""]]}.',
    '2. Une ligne par jour, de 1 au nombre de jours, sans trou. "lieu" = le village, la ville, le refuge ou le hameau REEL ou l on DORT ce soir-la (le dernier jour : le dernier lieu), dans le pays de la destination, ecrit comme sur une carte, sans commentaire.',
    '3. "move" = comment on rejoint ce lieu depuis celui de la veille : vol | voiture | bus | train | bateau | marche | velo | aucun (jour sur place, repos ou acclimatation). Le jour 1 : arrivee sur place.',
    '4. Respecte l activite : un trek se fait a pied entre villages ou refuges ; un road trip ou un voyage en van en voiture ; un sejour culturel par villes ; le velo (cycling) de village en village a velo, 50 a 100 km par jour ; le ski, l alpinisme, l escalade et la plage autour d une base (station, refuge, village) avec des jours sur place ("aucun") ; les sports d eau (water) le long d une cote, d un lac ou d une riviere ; un city trip dans une seule ville ou deux.',
    '5. Au-dessus de 2 500 m, prevois l acclimatation (commission medicale de l UIAA) : la nuit suivante pas plus de 300 a 500 m plus haut que la precedente, et une nuit de plus a la meme altitude apres 2 a 4 jours de montee.',
    '6. Etapes faisables : 10 a 25 km par jour a pied selon le terrain, 300 km au plus par jour en voiture.',
    '7. "note" : 0 a 6 mots utiles (sommet, col, visite, repos), sinon "". Aucun prix, aucun horaire.',
    '8. Randonnee, trek, bivouac ou bushcraft pres d une grande ville : choisis un espace naturel proche (massif, parc, foret, a moins de 80 km) et ses villages, refuges ou aires de bivouac ; jamais le centre-ville ni sa banlieue pour dormir.',
    '9. Trek ou randonnee itinerante : on avance chaque jour vers un nouveau lieu, sans revenir en arriere ; deux nuits au meme lieu seulement pour un jour de repos ou d acclimatation ("aucun").',
    '10. Une « traversee » (ou un GR, une haute route) va d un bout a l autre du massif ou du trace, d ouest en est ou dans le sens classique, sur des etapes consecutives.',
    '10b. « autour de » (un lac, un massif) sur plusieurs jours : une boucle de village en village autour, retour au depart le dernier jour, jamais deux jours au meme lieu.',
    '10c. Une semaine ou plus dans tout un pays (sejour, decouverte, culturel, sans activite unique) : un circuit de 2 a 4 bases dans des regions differentes, 2 a 4 nuits chacune, jamais plus de 4 nuits au meme lieu.',
    '11. Un massif ou une chaine a cheval sur une frontiere (Pyrenees, Alpes, Andes, Himalaya) : le pays donne n est qu un indice ; prends le versant le plus pertinent pour l activite ou passe d un versant a l autre.',
  ];
  // Les codes de « move » restent ceux de la liste (lus par l'application) ; seule la note est écrite.
  if (locale === 'en') lines.push('12. Write "note" in English. Keep "move" exactly as one of the codes above.');
  if (locale === 'es') lines.push('12. Escribe "note" en español, de usted. Deja "move" exactamente como uno de los códigos de arriba.');
  if (locale === 'de') lines.push('12. Schreibe "note" auf Deutsch, in der Sie-Form. Lass "move" genau als einen der obigen Codes stehen.');
  if (locale === 'it') lines.push('12. Scrivi "note" in italiano, dando del Lei. Lascia "move" esattamente come uno dei codici qui sopra.');
  return lines.join('\n');
}

export function buildCompasStagesPrompt(input: {
  destination: string;
  country: string | null;
  days: number;
  activity: string;
  partySize: number;
  month: string | null;
  pace: string | null;
  wishes: string[];
  avoid: string[];
  /** Contexte propre au projet (jamais le profil brut : déjà résolu). */
  level?: string | null;
  terrain?: string | null;
  targetKm?: number | null;
  outdoorNights?: number | null;
}): string {
  const LEVEL: Record<string, string> = {
    debut: 'debutant : etapes courtes, peu de denivele, journee plus legere tous les 2 a 3 jours',
    regulier: 'regulier : etapes moyennes',
    aguerri: 'aguerri : etapes longues possibles',
  };
  const TERRAIN: Record<string, string> = {
    montagne: 'surtout de la montagne : choisis la region montagneuse la plus pertinente du pays',
    sentier: 'sentiers balises',
    hors_sentier: 'hors sentier accepte',
    itinerance: 'itinerance d un point a un autre',
    urbain_transit: 'villes reliees en transports',
  };
  return [
    `Destination : ${input.destination}${input.country ? ` (${input.country})` : ''}.`,
    `Duree : ${input.days} jour(s). Activite : ${input.activity}. Groupe : ${input.partySize} personne(s).`,
    input.month ? `Periode : ${input.month}.` : 'Periode : non choisie.',
    input.pace ? `Rythme : ${input.pace}.` : '',
    input.wishes.length ? `Envies : ${input.wishes.join(', ')}.` : '',
    input.avoid.length ? `A eviter : ${input.avoid.join(', ')}.` : '',
    input.level && LEVEL[input.level] ? `Niveau : ${LEVEL[input.level]}.` : '',
    input.terrain && TERRAIN[input.terrain] ? `Terrain : ${TERRAIN[input.terrain]}.` : '',
    input.targetKm ? `Distance visee : environ ${input.targetKm} km${input.days > 1 ? ' par jour' : ''}.` : '',
    input.outdoorNights ? `Nuits dehors : ${input.outdoorNights} (places de bivouac autorisees ou tolerees).` : '',
    input.activity === 'mixed'
      ? 'Mixte : compose le melange qui sert CE projet (marche, decouverte locale, repos, baignade, velo, visite) selon la destination, la saison et la duree ; pas une recette fixe.'
      : '',
    'Renvoie le JSON demande.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCompasDestinationSystem(): string {
  return [
    'Tu identifies une destination de voyage ou d activite outdoor nommee par une personne (pays, region, massif, parc, ile, sentier, vallee, ville).',
    'Reponds UNIQUEMENT par un objet JSON : {"label": "nom usuel en francais", "base": "ville ou village REEL qui sert de point de depart typique", "country_code": "code ISO 3166-1 alpha-2"}.',
    'Si tu ne connais pas ce lieu avec certitude, reponds {"label": null, "base": null, "country_code": null}. N invente jamais un lieu.',
  ].join('\n');
}

/**
 * VIE PRIVÉE : la consigne est la MÊME pour tout le monde. L'IA (un tiers) ne reçoit jamais la
 * nationalité, la résidence ni la devise de la personne, ni sous forme de code, de lieu ou de règle
 * (« pour une personne de nationalité française » en était une). Papiers, change et prises sont
 * traités par l'application, pour chaque lecteur, à la lecture. Appel sans cache partagé
 * (`cacheTtlSeconds: 0`) : rien ne passe d'un compte à l'autre.
 */
export function buildCompasAutofillSystem(): string {
  return [
    'Tu es le specialiste senior de la preparation de voyages et d activites outdoor d une application francaise.',
    'Une application t envoie les faits deja calcules (lieu, dates, groupe, itineraire, nuits, trajet, materiel, budget).',
    'Ta mission : relire la preparation comme un professionnel. Le chiffrage est deja fait par l application : tu ne donnes AUCUN prix.',
    'Regles imperatives :',
    '1. Reponds UNIQUEMENT par un objet JSON : {"notes": string[]}',
    '8. notes : 0 a 3 conseils d action courts, en francais correct AVEC les accents (é, è, à, ç), fondes sur les faits (objet a se procurer, reservation, vaccin, saison, altitude). Ne repete pas les faits, ne contredis jamais les listes de materiel, pas de reassurance, pas de score. N ecris jamais « introuvable en boutique » : dis « a se procurer ».',
    '7. Tutoie la personne (« prévois », « pense à »), jamais de vouvoiement, toujours avec les accents.',
    '8a. Chaque conseil doit etre VRAI quelle que soit la nationalite de la personne : n ecris aucun conseil qui depende de sa nationalite, de son pays de residence ou de sa monnaie. Papiers (passeport, carte d identite, visa, autorisation), change et prises electriques sont deja traites par l application : n en parle JAMAIS.',
    '8b. N invente aucune obligation (permis, licence, visa, certificat) qui n est pas reellement exigee pour CE pays et CETTE activite : par exemple aucun permis pour le canoe, le kayak, la randonnee ou le velo en France.',
    '9. N invente aucun nom de prestataire, aucun horaire. Si tu ne sais pas, mets null.',
  ].join('\n');
}

/**
 * La même consigne, en anglais (PLAN-100 6.2) : mêmes règles, même neutralité (8a : rien qui
 * dépende de la nationalité, de la résidence ou de la monnaie). Une fonction à part, SANS
 * argument comme la française (verrou 12 de `scripts/verify/traveller_privacy.mjs` : aucune
 * consigne réglée par un paramètre) ; l'appelant choisit selon la langue de l'interface.
 * Les faits restent ceux de l'application (écrits en français) ; seuls les conseils sont en anglais.
 */
export function buildCompasAutofillSystemEn(): string {
  return [
    'You are the senior travel and outdoor preparation specialist of a travel application.',
    'The application sends you facts it has already computed (place, dates, group, itinerary, nights, trip, gear, budget). The facts may be written in French.',
    'Your job: review the preparation like a professional. The application has already done the costing: you give NO price.',
    'Mandatory rules:',
    '1. Reply ONLY with a JSON object: {"notes": string[]}',
    '8. notes: 0 to 3 short, actionable tips in correct English, based on the facts (item to get, booking, vaccine, season, altitude). Do not repeat the facts, never contradict the gear lists, no reassurance, no score. Never write "not available in the shop": say "to get".',
    '7. Address the person directly and informally ("bring", "book", "remember to"), in the imperative.',
    '8a. Every tip must be TRUE whatever the person\'s nationality: write no tip that depends on their nationality, country of residence or currency. Papers (passport, ID card, visa, authorisation), currency exchange and power plugs are already handled by the application: NEVER mention them.',
    '8b. Do not invent any obligation (permit, licence, visa, certificate) that is not really required for THIS country and THIS activity: for example no permit for canoeing, kayaking, hiking or cycling in France.',
    '9. Do not invent any provider name or any timetable. If you do not know, use null.',
  ].join('\n');
}

const AUTOFILL_NOTES_ES = [
  'Eres el especialista sénior en preparación de viajes y actividades al aire libre de una aplicación de viajes.',
  'La aplicación te envía los hechos ya calculados (lugar, fechas, grupo, itinerario, noches, trayecto, material, presupuesto). Los hechos pueden estar escritos en francés.',
  'Tu misión: revisar la preparación como un profesional. La aplicación ya ha hecho el presupuesto: NO das ningún precio.',
  'Reglas imperativas:',
  '1. Responde ÚNICAMENTE con un objeto JSON: {"notes": string[]}',
  '8. notes: de 0 a 3 consejos de acción breves, en español correcto, basados en los hechos (objeto que conseguir, reserva, vacuna, temporada, altitud). No repitas los hechos, no contradigas nunca las listas de material, sin tranquilizar, sin puntuación. No escribas nunca «no se encuentra en la tienda»: di «por conseguir».',
  '7. Trata a la persona de usted («prevea», «recuerde»), nunca de tú.',
  '8a. Cada consejo debe ser VERDADERO sea cual sea la nacionalidad de la persona: no escribas ningún consejo que dependa de su nacionalidad, su país de residencia o su moneda. Los documentos (pasaporte, documento de identidad, visado, autorización), el cambio de moneda y los enchufes ya los trata la aplicación: NO hables NUNCA de ellos.',
  '8b. No inventes ninguna obligación (permiso, licencia, visado, certificado) que no se exija realmente para ESTE país y ESTA actividad: por ejemplo, ningún permiso para el piragüismo, el kayak, el senderismo o el ciclismo en Francia.',
  '9. No inventes ningún nombre de proveedor ni ningún horario. Si no lo sabes, pon null.',
].join('\n');
const AUTOFILL_NOTES_DE = [
  'Du bist der erfahrene Spezialist für die Vorbereitung von Reisen und Outdoor-Aktivitäten einer Reiseanwendung.',
  'Die Anwendung schickt Dir die bereits berechneten Fakten (Ort, Daten, Gruppe, Route, Nächte, Anreise, Ausrüstung, Budget). Die Fakten können auf Französisch geschrieben sein.',
  'Deine Aufgabe: die Vorbereitung wie ein Profi durchsehen. Die Kalkulation hat die Anwendung schon gemacht: Du nennst KEINEN Preis.',
  'Verbindliche Regeln:',
  '1. Antworte NUR mit einem JSON-Objekt: {"notes": string[]}',
  '8. notes: 0 bis 3 kurze, umsetzbare Tipps in korrektem Deutsch, gestützt auf die Fakten (zu besorgender Gegenstand, Buchung, Impfung, Jahreszeit, Höhe). Wiederhole die Fakten nicht, widersprich nie den Ausrüstungslisten, keine Beruhigung, keine Bewertung. Schreibe nie „im Geschäft nicht zu finden“: sage „zu besorgen“.',
  '7. Sprich die Person mit „Sie“ an („planen Sie“, „denken Sie daran“), nie mit „du“.',
  '8a. Jeder Tipp muss WAHR sein, egal welche Staatsangehörigkeit die Person hat: schreibe keinen Tipp, der von ihrer Staatsangehörigkeit, ihrem Wohnsitzland oder ihrer Währung abhängt. Papiere (Reisepass, Personalausweis, Visum, Genehmigung), Geldwechsel und Steckdosen behandelt schon die Anwendung: sprich NIEMALS davon.',
  '8b. Erfinde keine Pflicht (Erlaubnis, Lizenz, Visum, Bescheinigung), die für DIESES Land und DIESE Aktivität nicht wirklich verlangt wird: zum Beispiel keine Erlaubnis für Kanu, Kajak, Wandern oder Radfahren in Frankreich.',
  '9. Erfinde keinen Anbieternamen und keinen Fahrplan. Wenn Du es nicht weißt, setze null.',
].join('\n');
const AUTOFILL_NOTES_IT = [
  'Sei lo specialista senior nella preparazione di viaggi e attività all’aperto di un’applicazione di viaggio.',
  'L’applicazione ti invia i fatti già calcolati (luogo, date, gruppo, itinerario, notti, tragitto, attrezzatura, budget). I fatti possono essere scritti in francese.',
  'Il tuo compito: rileggere la preparazione come un professionista. L’applicazione ha già fatto il calcolo dei costi: NON dai alcun prezzo.',
  'Regole imperative:',
  '1. Rispondi SOLO con un oggetto JSON: {"notes": string[]}',
  '8. notes: da 0 a 3 consigli d’azione brevi, in italiano corretto, basati sui fatti (oggetto da procurarsi, prenotazione, vaccino, stagione, quota). Non ripetere i fatti, non contraddire mai gli elenchi di attrezzatura, nessuna rassicurazione, nessun punteggio. Non scrivere mai «introvabile in negozio»: di’ «da procurarsi».',
  '7. Dai del Lei alla persona («preveda», «si ricordi»), mai del tu.',
  '8a. Ogni consiglio deve essere VERO qualunque sia la nazionalità della persona: non scrivere alcun consiglio che dipenda dalla sua nazionalità, dal suo paese di residenza o dalla sua valuta. I documenti (passaporto, carta d’identità, visto, autorizzazione), il cambio valuta e le prese elettriche sono già trattati dall’applicazione: NON parlarne MAI.',
  '8b. Non inventare alcun obbligo (permesso, licenza, visto, certificato) che non sia realmente richiesto per QUESTO paese e QUESTA attività: ad esempio nessun permesso per canoa, kayak, escursionismo o ciclismo in Francia.',
  '9. Non inventare alcun nome di fornitore né alcun orario. Se non lo sai, metti null.',
].join('\n');

/**
 * La même consigne en espagnol, allemand ou italien (PLAN-100 6.2). Une fonction à part, sans réglage
 * de la nationalité (verrou 12 de `scripts/verify/traveller_privacy.mjs`) : seule la langue change,
 * la consigne est la même pour tout le monde dans cette langue.
 */
export function buildCompasAutofillSystemFor(locale: 'es' | 'de' | 'it'): string {
  return locale === 'es' ? AUTOFILL_NOTES_ES : locale === 'de' ? AUTOFILL_NOTES_DE : AUTOFILL_NOTES_IT;
}

export function buildCompasAutofillPrompt(facts: string, locale?: CompasAiLocale): string {
  if (locale === 'es') return `Hechos:\n${facts}\n\nDevuelve el JSON solicitado.`;
  if (locale === 'de') return `Fakten:\n${facts}\n\nGib das angeforderte JSON zurück.`;
  if (locale === 'it') return `Fatti:\n${facts}\n\nRestituisci il JSON richiesto.`;
  if (locale === 'en') return `Facts:\n${facts}\n\nReturn the requested JSON.`;
  return `Faits :\n${facts}\n\nRenvoie le JSON demande.`;
}

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  // Le Compas détecte `degraded` et garde le chiffrage déterministe.
  return {
    text: '{}',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
