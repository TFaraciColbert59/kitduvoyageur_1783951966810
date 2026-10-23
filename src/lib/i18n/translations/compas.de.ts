import type { TranslationKeys } from './fr';
import { compasStepsDe } from './compas-steps.de';
import { compasScreenDe } from './compas-screen.de';
import { compasSheetsDe } from './compas-sheets.de';
import { compasAlertsDe } from './compas-alerts.de';
import { compasServerDe } from './compas-server.de';
import { compasUnitsDe } from './compas-units.de';
import { compasEngineDe } from './compas-engine.de';

/**
 * Espace de noms `compas` (DE). Même forme que `compas.fr.ts`, imposée par le type.
 * « Compas » reste un nom propre (le produit). Registre « Sie », traduction naturelle.
 */
export const compasDe: TranslationKeys['compas'] = {
  sheets: compasSheetsDe,
  start: {
    lockedStep: 'Verfügbar nach Ihrer ersten Auswahl',
    createError: 'Ihr Abenteuer konnte nicht erstellt werden.',
    stepsNav: 'Schritte im Compas',
    invitationsLabel: 'Erhaltene Einladungen',
    invitationsTitle: 'Sie sind eingeladen',
    requestLabel: 'Ihre Anfrage',
    title: 'Wohin möchten Sie?',
    subtitle:
      'Beschreiben Sie Ihr Abenteuer in eigenen Worten. Compas plant den Rest: Route, Termine, Übernachtungen, Anreise, Ausrüstung, Budget.',
    placeholder: '„5 Tage Trekking im Vercors, zu dritt, in Hütten, Anfang Juli“',
    understoodTitle: 'Das habe ich verstanden',
    precise: 'Details ergänzen (optional)',
    activityGroup: 'Aktivität',
    moreActivities: 'Mehr',
    duration: 'Dauer',
    people: 'Personen',
    daysOne: '{count} Tag',
    daysOther: '{count} Tage',
    peopleOne: '{count} Person',
    peopleOther: '{count} Personen',
    stepperLess: '{label}: weniger',
    stepperMore: '{label}: mehr',
    auto: 'automatisch',
    creating: 'Ihr Abenteuer wird erstellt…',
    submit: 'Mein Abenteuer planen',
    signInPrompt: '{link}, um Ihr Abenteuer zu speichern.',
    signInLink: 'Melden Sie sich an',
    mapLabel: 'Karte der Route',
    mapEmpty: 'Die Karte füllt sich, sobald eine Route gewählt ist.',
  },
  prep: {
    label: 'Ihr Abenteuer wird vorbereitet',
    titleDone: 'Ihr Abenteuer ist bereit',
    titleFailed: 'Vorbereitung unterbrochen',
    titleStopped: 'Vorbereitung angehalten',
    titleRunning: 'Ihr Abenteuer wird vorbereitet…',
    understand: 'Ihre Anfrage verstehen',
    understandSub: 'Wo, wie lange, mit wem, was Sie sich wünschen',
    itinerary: 'Die Route festlegen',
    itinerarySub: 'Echte Orte auf der Karte, gemessene Entfernungen',
    rest: 'Übernachtungen, Anreise, Ausrüstung und Budget',
    restSub: 'Richtwerte des Compas, nichts erfunden',
    done: 'Zusammenfassung',
    doneSub: 'Danach können Sie alles Schritt für Schritt anpassen',
    stateDone: 'erledigt',
    stateRun: 'läuft',
    stateHalt: 'unterbrochen',
    stateTodo: 'als Nächstes',
    positionNote:
      'Wenn Sie es erlauben, dient Ihr Standort zur Planung der Anreise; er wird vor jedem Versand auf etwa 1 km gerundet. Ohne ihn bleibt die Anreise von Ihnen auszufüllen.',
    viewAdventure: 'Mein Abenteuer ansehen',
    editRequest: 'Anfrage präzisieren',
    retry: 'Fortsetzen',
    stop: 'Anhalten',
  },
  skeleton: {
    opening: 'Compas wird geöffnet…',
  },
  trial: {
    note: 'Test ohne Konto: wird nach 7 Tagen ohne Besuch gelöscht.',
    keep: 'Meine Reise behalten',
  },
  ai: {
    noticeRun:
      'Eine KI kann helfen, Ihre Anfrage zu lesen, Etappen vorzuschlagen und Tipps zu formulieren. Alles, was sie vorschlägt, ist als solches gekennzeichnet, und Compas prüft es.',
    noticeDone:
      'Die KI hat an diesem Plan mitgewirkt: Ihre Etappen sind mit „Von der KI vorgeschlagen“ markiert, ihre Tipps mit „KI-Vorschlag“.',
    privacyLink: 'Was sie erhält',
  },
  credit: {
    geoapify: 'Powered by Geoapify',
  },
  ...compasStepsDe,
  ...compasScreenDe,
  ...compasAlertsDe,
  ...compasServerDe,
  ...compasUnitsDe,
  ...compasEngineDe,
};
