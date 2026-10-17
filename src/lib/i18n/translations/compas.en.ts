import type { TranslationKeys } from './fr';
import { compasStepsEn } from './compas-steps.en';
import { compasScreenEn } from './compas-screen.en';
import { compasSheetsEn } from './compas-sheets.en';
import { compasAlertsEn } from './compas-alerts.en';

/**
 * Espace de noms `compas` (EN). Même forme que `compas.fr.ts`, imposée par le type.
 * « Compas » reste un nom propre (le produit). Traduction naturelle, pas mot à mot.
 */
export const compasEn: TranslationKeys['compas'] = {
  sheets: compasSheetsEn,
  start: {
    lockedStep: 'Unlocks after your first choice',
    createError: 'We couldn’t create your adventure.',
    stepsNav: 'Compas steps',
    invitationsLabel: 'Invitations received',
    invitationsTitle: 'You’re invited',
    requestLabel: 'Your request',
    title: 'Where do you want to go?',
    subtitle:
      'Describe your adventure in your own words. Compas plans the rest: route, dates, nights, travel, gear, budget.',
    placeholder: '“5 days trekking in the Vercors, 3 of us, staying in huts, early July”',
    understoodTitle: 'Here’s what I understood',
    precise: 'Add details (optional)',
    activityGroup: 'Activity',
    moreActivities: 'More',
    duration: 'Duration',
    people: 'People',
    daysOne: '{count} day',
    daysOther: '{count} days',
    peopleOne: '{count} person',
    peopleOther: '{count} people',
    stepperLess: '{label}: decrease',
    stepperMore: '{label}: increase',
    auto: 'auto',
    creating: 'Creating your adventure…',
    submit: 'Plan my adventure',
    signInPrompt: '{link} to save your adventure.',
    signInLink: 'Sign in',
    mapLabel: 'Route map',
    mapEmpty: 'The map fills in as soon as a route is chosen.',
  },
  prep: {
    label: 'Preparing your adventure',
    titleDone: 'Your adventure is ready',
    titleFailed: 'Preparation interrupted',
    titleStopped: 'Preparation stopped',
    titleRunning: 'Preparing your adventure…',
    understand: 'Understanding your request',
    understandSub: 'Where, how long, who, what you’d like',
    itinerary: 'Mapping the itinerary',
    itinerarySub: 'Real places on the map, measured distances',
    rest: 'Nights, travel, gear and budget',
    restSub: 'Compas rates, nothing made up',
    done: 'Summary',
    doneSub: 'You can fine-tune everything afterwards, step by step',
    stateDone: 'done',
    stateRun: 'in progress',
    stateHalt: 'interrupted',
    stateTodo: 'up next',
    positionNote:
      'If you allow it, your location is used to plan how you get there; it’s rounded to about 1 km before anything is sent. Without it, that journey is left for you to fill in.',
    viewAdventure: 'View my adventure',
    editRequest: 'Refine my request',
    retry: 'Resume',
    stop: 'Stop',
  },
  skeleton: {
    opening: 'Opening Compas…',
  },
  trial: {
    note: 'Trial without an account: deleted after 7 days without a visit.',
    keep: 'Keep my trip',
  },
  ai: {
    noticeRun:
      'An AI may help read your request, suggest stages and write tips. Anything it suggests is labelled as such, and Compas checks it.',
    noticeDone:
      'AI contributed to this plan: its stages are marked “Proposed by AI” and its tips “AI suggestion”.',
    privacyLink: 'What it receives',
  },
  credit: {
    geoapify: 'Powered by Geoapify',
  },
  ...compasStepsEn,
  ...compasScreenEn,
  ...compasAlertsEn,
};
