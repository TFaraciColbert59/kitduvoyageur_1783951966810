import { compasStepsFr } from './compas-steps.fr';
import { compasScreenFr } from './compas-screen.fr';
import { compasSheetsFr } from './compas-sheets.fr';
/**
 * Espace de noms `compas` (FR, langue source). Branché dans `fr.ts` sous `compas` :
 * les clés se lisent `compas.start.title`, etc. et sont typées par `TranslationKey`.
 *
 * - Clés stables : on renomme un texte, jamais sa clé.
 * - Pluriels : deux clés `…One` / `…Other`, choisies par `plural()` (Intl.PluralRules).
 * - Nombres : passés déjà formatés (`formatNumber`) dans `{count}`.
 * - Aucune donnée : un texte d'interface ne contient ni lieu, ni prix, ni date.
 * Couverture vérifiée par `tests/i18n/compas-coverage.spec.ts`.
 */
export const compasFr = {
  sheets: compasSheetsFr,
  start: {
    lockedStep: 'Disponible dès le premier choix',
    createError: 'L’aventure n’a pas pu être créée.',
    stepsNav: 'Étapes du Compas',
    invitationsLabel: 'Invitations reçues',
    invitationsTitle: 'On t’invite',
    requestLabel: 'Ta demande',
    title: 'Où veux-tu aller ?',
    subtitle:
      'Décris ton aventure avec tes mots. Le Compas prépare tout le reste : parcours, dates, nuits, trajet, kit, budget.',
    placeholder: '« 5 jours de trek dans le Vercors à 3, en refuge, début juillet »',
    understoodTitle: 'Voici ce que j’ai compris',
    precise: 'Préciser (facultatif)',
    activityGroup: 'Activité',
    moreActivities: 'Plus',
    duration: 'Durée',
    people: 'Personnes',
    daysOne: '{count} jour',
    daysOther: '{count} jours',
    peopleOne: '{count} personne',
    peopleOther: '{count} personnes',
    stepperLess: '{label} : moins',
    stepperMore: '{label} : plus',
    auto: 'auto',
    creating: 'Création de l’aventure…',
    submit: 'Préparer mon aventure',
    signInPrompt: '{link} pour enregistrer ton aventure.',
    signInLink: 'Connecte-toi',
    mapLabel: 'Carte du parcours',
    mapEmpty: 'La carte se remplit dès que le parcours est choisi.',
  },
  prep: {
    label: 'Préparation de l’aventure',
    titleDone: 'Ton aventure est prête',
    titleFailed: 'Préparation interrompue',
    titleStopped: 'Préparation arrêtée',
    titleRunning: 'Je prépare ton aventure…',
    understand: 'Comprendre ta demande',
    understandSub: 'Lieu, durée, groupe, envies',
    itinerary: 'Tracer l’itinéraire',
    itinerarySub: 'Lieux réels de la carte, distances mesurées',
    rest: 'Nuits, trajet, kit et budget',
    restSub: 'Barèmes du Compas, rien d’inventé',
    done: 'Synthèse',
    doneSub: 'Tout se retouche ensuite, étape par étape',
    stateDone: 'fait',
    stateRun: 'en cours',
    stateHalt: 'interrompu',
    stateTodo: 'à venir',
    positionNote:
      'Ta position, si tu l’autorises, sert au trajet d’approche ; elle est arrondie à environ 1 km avant tout envoi. Sans elle, le trajet reste à préciser.',
    viewAdventure: 'Voir mon aventure',
    editRequest: 'Préciser ma demande',
    retry: 'Reprendre',
    stop: 'Arrêter',
  },
  skeleton: {
    opening: 'Ouverture du Compas…',
  },
  trial: {
    note: 'Essai sans compte : effacé après 7 jours sans visite.',
    keep: 'Garder mon voyage',
  },
  ai: {
    noticeRun:
      'Une IA peut t’aider à lire ta demande, proposer des étapes et rédiger des conseils. Ce qu’elle propose est signalé comme tel, et le Compas le vérifie.',
    noticeDone:
      'L’IA a contribué à cette préparation : ses étapes portent la mention « Proposée par l’IA », ses conseils « Suggestion de l’IA ».',
    privacyLink: 'Ce qui lui est envoyé',
  },
  credit: {
    /** Formule exigée par les conditions de Geoapify : identique dans toutes les langues. */
    geoapify: 'Powered by Geoapify',
  },
  ...compasStepsFr,
  ...compasScreenFr,
} as const;
