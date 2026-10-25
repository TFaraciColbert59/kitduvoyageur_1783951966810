import type { TranslationKeys } from './fr';
import { compasStepsIt } from './compas-steps.it';
import { compasScreenIt } from './compas-screen.it';
import { compasSheetsIt } from './compas-sheets.it';
import { compasAlertsIt } from './compas-alerts.it';
import { compasServerIt } from './compas-server.it';
import { compasUnitsIt } from './compas-units.it';
import { compasEngineIt } from './compas-engine.it';
import { compasV5It } from './compas-v5.it';

/**
 * Espace de noms `compas` (IT). Même forme que `compas.fr.ts`, imposée par le type.
 * « Compas » reste un nom propre (le produit). Registre « Lei », traduction naturelle.
 */
export const compasIt: TranslationKeys['compas'] = {
  sheets: compasSheetsIt,
  start: {
    lockedStep: 'Disponibile dopo la Sua prima scelta',
    createError: 'Non è stato possibile creare la Sua avventura.',
    stepsNav: 'Fasi del Compas',
    invitationsLabel: 'Inviti ricevuti',
    invitationsTitle: 'È stato invitato',
    requestLabel: 'La Sua richiesta',
    title: 'Dove vorrebbe andare?',
    subtitle:
      'Descriva la Sua avventura con parole Sue. Compas prepara il resto: percorso, date, notti, spostamenti, attrezzatura, budget.',
    placeholder: '«5 giorni di trekking nel Vercors, in 3, nei rifugi, a inizio luglio»',
    understoodTitle: 'Ecco cosa ho capito',
    precise: 'Aggiungere dettagli (facoltativo)',
    activityGroup: 'Attività',
    moreActivities: 'Altre',
    duration: 'Durata',
    people: 'Persone',
    daysOne: '{count} giorno',
    daysOther: '{count} giorni',
    peopleOne: '{count} persona',
    peopleOther: '{count} persone',
    stepperLess: '{label}: meno',
    stepperMore: '{label}: più',
    auto: 'automatico',
    creating: 'Creazione della Sua avventura…',
    submit: 'Preparare la mia avventura',
    signInPrompt: '{link} per salvare la Sua avventura.',
    signInLink: 'Acceda',
    mapLabel: 'Mappa del percorso',
    mapEmpty: 'La mappa si completa non appena viene scelto un percorso.',
  },
  prep: {
    label: 'Preparazione della Sua avventura',
    titleDone: 'La Sua avventura è pronta',
    titleFailed: 'Preparazione interrotta',
    titleStopped: 'Preparazione fermata',
    titleRunning: 'Preparazione della Sua avventura…',
    understand: 'Capire la Sua richiesta',
    understandSub: 'Dove, per quanto tempo, chi, cosa desidera',
    itinerary: 'Tracciare l’itinerario',
    itinerarySub: 'Luoghi reali sulla mappa, distanze misurate',
    rest: 'Notti, spostamenti, attrezzatura e budget',
    restSub: 'Tariffe del Compas, niente di inventato',
    done: 'Riepilogo',
    doneSub: 'Poi potrà perfezionare tutto, fase per fase',
    stateDone: 'fatto',
    stateRun: 'in corso',
    stateHalt: 'interrotto',
    stateTodo: 'da fare',
    positionNote:
      'Se lo autorizza, la Sua posizione serve a preparare il viaggio di andata; viene arrotondata a circa 1 km prima di qualsiasi invio. Senza di essa, quel tragitto resta da completare.',
    viewAdventure: 'Vedere la mia avventura',
    editRequest: 'Precisare la mia richiesta',
    retry: 'Riprendere',
    stop: 'Fermare',
  },
  skeleton: {
    opening: 'Apertura del Compas…',
  },
  trial: {
    note: 'Prova senza account: eliminata dopo 7 giorni senza visite.',
    keep: 'Conservare il mio viaggio',
  },
  ai: {
    noticeRun:
      'Un’IA può aiutare a leggere la Sua richiesta, proporre tappe e scrivere consigli. Tutto ciò che suggerisce è indicato come tale e Compas lo verifica.',
    noticeDone:
      'L’IA ha contribuito a questo piano: le sue tappe sono segnate «Proposta dall’IA» e i suoi consigli «Suggerimento dell’IA».',
    privacyLink: 'Che cosa riceve',
  },
  credit: {
    geoapify: 'Powered by Geoapify',
  },
  ...compasStepsIt,
  ...compasScreenIt,
  ...compasAlertsIt,
  ...compasServerIt,
  ...compasUnitsIt,
  ...compasEngineIt,
  ...compasV5It,
};
