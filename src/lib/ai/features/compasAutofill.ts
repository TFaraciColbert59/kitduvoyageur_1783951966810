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

export function buildCompasStagesSystem(): string {
  return [
    'Tu es le specialiste senior de la preparation de voyages et d activites outdoor d une application francaise.',
    'Tu construis un itineraire realiste JOUR PAR JOUR pour la destination, la duree et l activite donnees.',
    'Regles imperatives :',
    '1. Reponds UNIQUEMENT par un objet JSON compact, une ligne par jour : {"stages": [[1, "lieu", "move", "note"], [2, "lieu", "move", ""]]}.',
    '2. Une ligne par jour, de 1 au nombre de jours, sans trou. "lieu" = le village, la ville, le refuge ou le hameau REEL ou l on DORT ce soir-la (le dernier jour : le dernier lieu), dans le pays de la destination, ecrit comme sur une carte, sans commentaire.',
    '3. "move" = comment on rejoint ce lieu depuis celui de la veille : vol | voiture | bus | train | bateau | marche | velo | aucun (jour sur place, repos ou acclimatation). Le jour 1 : arrivee sur place.',
    '4. Respecte l activite : un trek se fait a pied entre villages ou refuges ; un road trip ou un voyage en van en voiture ; un sejour culturel par villes ; le velo (cycling) de village en village a velo, 50 a 100 km par jour ; le ski, l alpinisme, l escalade et la plage autour d une base (station, refuge, village) avec des jours sur place ("aucun") ; les sports d eau (water) le long d une cote, d un lac ou d une riviere ; un city trip dans une seule ville ou deux.',
    '5. Au-dessus de 2 500 m, prevois l acclimatation : pas plus de 300 a 500 m de denivele de couchage par jour au-dessus de 3 000 m, et un jour de repos tous les 3 a 4 jours.',
    '6. Etapes faisables : 10 a 25 km par jour a pied selon le terrain, 300 km au plus par jour en voiture.',
    '7. "note" : 0 a 6 mots utiles (sommet, col, visite, repos), sinon "". Aucun prix, aucun horaire.',
    '8. Randonnee, trek, bivouac ou bushcraft pres d une grande ville : choisis un espace naturel proche (massif, parc, foret, a moins de 80 km) et ses villages, refuges ou aires de bivouac ; jamais le centre-ville ni sa banlieue pour dormir.',
    '9. Trek ou randonnee itinerante : on avance chaque jour vers un nouveau lieu, sans revenir en arriere ; deux nuits au meme lieu seulement pour un jour de repos ou d acclimatation ("aucun").',
    '10. Une « traversee » (ou un GR, une haute route) va d un bout a l autre du massif ou du trace, d ouest en est ou dans le sens classique, sur des etapes consecutives.',
    '10b. « autour de » (un lac, un massif) sur plusieurs jours : une boucle de village en village autour, retour au depart le dernier jour, jamais deux jours au meme lieu.',
    '11. Un massif ou une chaine a cheval sur une frontiere (Pyrenees, Alpes, Andes, Himalaya) : le pays donne n est qu un indice ; prends le versant le plus pertinent pour l activite (pour un voyageur francais, souvent le versant francais) ou passe d un versant a l autre.',
  ].join('\n');
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

export function buildCompasAutofillSystem(): string {
  return [
    'Tu es le specialiste senior de la preparation de voyages et d activites outdoor d une application francaise.',
    'Une application t envoie les faits deja calcules (lieu, dates, groupe, itineraire, nuits, trajet, materiel, prix lus en base).',
    'Ta mission : completer le chiffrage en euros et relire la preparation comme un professionnel.',
    'Regles imperatives :',
    '1. Reponds UNIQUEMENT par un objet JSON avec ces cles (null si sans objet ou si tu ne sais pas) :',
    '   {"meals_eur_per_person_day": number|null, "lodging_eur_per_person_night": number|null, "flight_eur_per_person": number|null, "local_transport_eur_per_person": number|null, "car_rental_eur_per_day": number|null, "entry_fees_eur_per_person": number|null, "entry_fees_detail": string|null, "insurance_eur_per_person": number|null, "notes": string[]}',
    '2. meals : cout realiste des repas par personne et par jour pour CE pays, CETTE saison et CES nuits.',
    '3. lodging : prix moyen d une nuit par personne pour les nuits « hebergement » sans prix connu, dans CE pays.',
    '4. flight : SEULEMENT si les faits disent « vol a prevoir » : aller-retour par personne depuis le depart indique, prix moyen de la periode.',
    '5. local_transport : SEULEMENT pour les deplacements en bus, jeep, train, vol interieur, bateau ou taxi listes dans les faits, total par personne (le carburant d une voiture est deja compte).',
    '5b. car_rental : SEULEMENT si les faits disent « voiture de location a prevoir » : prix moyen d une voiture adaptee au groupe et au terrain, par jour, assurance de base comprise, pour CE pays et CETTE saison.',
    '6. entry_fees : SEULEMENT si les faits disent « voyage a l etranger » : visa, permis de trek ou de parc, taxes d entree exigees pour CE pays et CETTE activite, total par personne ; entry_fees_detail les nomme en 12 mots au plus.',
    '7. insurance : assurance voyage avec rapatriement adaptee (altitude, pays), par personne, si a l etranger ou en montagne.',
    '8. notes : 0 a 3 conseils d action courts, en francais correct AVEC les accents (é, è, à, ç), fondes sur les faits (objet a se procurer, reservation, vaccin, saison, altitude). Ne repete pas les faits, ne contredis jamais les listes de materiel, pas de reassurance, pas de score. N ecris jamais « introuvable en boutique » : dis « a se procurer ».',
    '8a. Chaque conseil doit etre VRAI pour une personne qui part de France : pas d adaptateur de prise dans un pays aux prises europeennes (Union europeenne, Suisse, Norvege, Maroc), pas de visa ni de change dans la zone euro. Papiers : dans l espace Schengen la carte d identite suffit ; PARTOUT AILLEURS (Perou, Vietnam, Etats-Unis, Maroc, Nepal...) le passeport est obligatoire, ne dis jamais que la carte d identite suffit hors Schengen.',
    '8b. N invente aucune obligation (permis, licence, visa, certificat) qui n est pas reellement exigee pour CE pays et CETTE activite : par exemple aucun permis pour le canoe, le kayak, la randonnee ou le velo en France.',
    '9. N invente aucun nom de prestataire, aucun horaire. Si tu ne sais pas, mets null.',
  ].join('\n');
}

export function buildCompasAutofillPrompt(facts: string): string {
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
