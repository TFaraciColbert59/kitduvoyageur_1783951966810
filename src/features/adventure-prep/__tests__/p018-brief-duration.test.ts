import { describe, it, expect } from 'vitest';
import {
  briefRequestedDays,
  acceptSuggestedDurationDays,
  suggestDurationDays,
} from '../engine/briefDays';
import { validateDrafted } from '../engine/itineraryEngine';
import { emptyDraft } from '../engine/emptyDraft';
import { draftActions } from '../store/reducer';
import { fullDraft } from './fixtures';
import {
  itineraryOutputSchema,
  strictItineraryOutputSchema,
  buildItineraryPrompt,
} from '@/lib/ai/features/itinerary';
import type { AdventurePrepDraft } from '../types';

// LE DRAFT REELLEMENT RENVOYE PAR L IA le 2026-09-28, verbatim.
// Brief demande : « Week-end de randonnee au depart de Chamonix, refuge la
// premiere nuit ». Reponse : 1 jour, 1 seule etape, de nature `trajet`.
// C est ce draft que les gardes doivent maintenant refuser.
const DRAFT_REEL = {
  title: 'Randonnée refuge au Mont-Blanc',
  days: 1,
  steps: [
    {
      day: 1,
      kind: 'trajet',
      title: 'Départ vers le refuge du Goûter',
      placeName: 'Chamonix-Mont-Blanc',
      startTime: '08:00',
      durationMin: 120,
      reason: 'Trajet initial depuis le village',
    },
  ],
  hypotheses: ['Météo et état des sentiers à confirmer'],
};

const BRIEF_WEEKEND = 'Week-end de randonnée au départ de Chamonix, refuge la première nuit';

describe('P0.18-A — le brief nomme une duree, la machine la trouve', () => {
  it('lit « week-end » comme deux jours', () => {
    expect(briefRequestedDays('week-end de randonnée')).toBe(2);
    expect(briefRequestedDays('un weekend en montagne')).toBe(2);
    expect(briefRequestedDays('Week-End à Chamonix')).toBe(2);
  });

  it('lit un nombre en chiffres, avec ou sans trait d union', () => {
    expect(briefRequestedDays('2 jours en randonnée')).toBe(2);
    expect(briefRequestedDays('3 jours')).toBe(3);
    expect(briefRequestedDays('une semaine de marche')).toBe(7);
    expect(briefRequestedDays('10 jours de voyage')).toBe(10);
  });

  it('lit un nombre en lettres', () => {
    expect(briefRequestedDays('trois jours de trek')).toBe(3);
    expect(briefRequestedDays('quatre jours en boucle')).toBe(4);
    expect(briefRequestedDays('quatre jours')).toBe(4);
  });

  it('ne devine rien quand le brief ne parle pas de duree', () => {
    expect(briefRequestedDays('randonnée au depart de Chamonix')).toBeNull();
    expect(briefRequestedDays('une belle journee')).toBeNull();
    expect(briefRequestedDays('j ai envie de partir')).toBeNull();
    expect(briefRequestedDays(null)).toBeNull();
    expect(briefRequestedDays('')).toBeNull();
  });

  it('ne confond pas un nombre qui ne compte pas des jours', () => {
    expect(briefRequestedDays('3 personnes')).toBeNull();
    expect(briefRequestedDays('2 vehicules')).toBeNull();
  });

  it('REFUSE d interpreter des nuits : 3 nuits font 4 jours, pas 3', () => {
    // Interpreter « 2 nuits » comme 2 jours serait faux d un jour. On ne
    // propose donc rien plutot qu un nombre invente : l absence de reponse
    // laisse l IA choisir, et l ecran garde sa pastille de proposition.
    expect(briefRequestedDays('2 nuits')).toBeNull();
    expect(briefRequestedDays('deux nuits en refuge')).toBeNull();
  });

  it('donne la priorite au nombre explicite sur « week-end »', () => {
    expect(briefRequestedDays('un week-end de 3 jours')).toBe(3);
  });
});

describe('P0.18-B — le canal duree de l IA', () => {
  const base = {
    title: 'x',
    days: [1],
    steps: [],
    hypotheses: [],
  };

  it('accepte une duree propositionnelle dans les DEUX schemas', () => {
    expect(itineraryOutputSchema.parse({ ...base, suggestedDurationDays: 3 }).suggestedDurationDays).toBe(3);
    expect(strictItineraryOutputSchema.parse({ ...base, suggestedDurationDays: 2 }).suggestedDurationDays).toBe(2);
  });

  it('tolere son absence et tolere null', () => {
    expect(itineraryOutputSchema.parse(base).suggestedDurationDays ?? null).toBeNull();
    expect(itineraryOutputSchema.parse({ ...base, suggestedDurationDays: null }).suggestedDurationDays ?? null).toBeNull();
  });

  it('refuse une duree hors bornes ou non entiere', () => {
    expect(itineraryOutputSchema.safeParse({ ...base, suggestedDurationDays: 0 }).success).toBe(false);
    expect(itineraryOutputSchema.safeParse({ ...base, suggestedDurationDays: 61 }).success).toBe(false);
    expect(itineraryOutputSchema.safeParse({ ...base, suggestedDurationDays: 2.5 }).success).toBe(false);
    expect(itineraryOutputSchema.safeParse({ ...base, suggestedDurationDays: 'trois' }).success).toBe(false);
  });

  it('applique la duree proposee quand la personne n a rien choisi', () => {
    const draft = emptyDraft();
    const next = suggestDurationDays(draft, 3);
    expect(next.calendar.durationDays).toBe(3);
    expect(next.calendar.durationIsSuggested).toBe(true);
  });

  it('NE touche JAMAIS une duree saisie a la main', () => {
    const chosen: AdventurePrepDraft = {
      ...emptyDraft(),
      calendar: { ...emptyDraft().calendar, durationDays: 5, durationIsSuggested: false },
    };
    const next = suggestDurationDays(chosen, 2);
    expect(next.calendar.durationDays).toBe(5);
    expect(next).toBe(chosen);
  });

  it('recalcule la date de retour a partir de la duree appliquee', () => {
    const draft: AdventurePrepDraft = {
      ...emptyDraft(),
      calendar: {
        ...emptyDraft().calendar,
        startDate: '2026-10-05',
        startDateIsSuggested: true,
      },
    };
    const next = suggestDurationDays(draft, 3);
    expect(next.calendar.returnDate).toBe('2026-10-07');
  });

  it('laisse le brouillon intact quand la proposition est refusee', () => {
    const draft = emptyDraft();
    expect(suggestDurationDays(draft, 0)).toBe(draft);
    expect(suggestDurationDays(draft, 99)).toBe(draft);
    expect(suggestDurationDays(draft, null)).toBe(draft);
    expect(acceptSuggestedDurationDays(0)).toBeNull();
    expect(acceptSuggestedDurationDays(61)).toBeNull();
    expect(acceptSuggestedDurationDays(null)).toBeNull();
  });
});

describe("P0.18-C — le prompt donne a l IA le droit de choisir la duree", () => {
  const input = {
    activityLabel: 'randonnee',
    originLabel: 'Chamonix',
    destinationLabel: 'Chamonix',
    startDateLabel: null,
    durationDays: 1,
    briefDays: null,
    durationChosenByUser: false,
    partySize: 2,
    pace: 'normal',
    loop: false,
    preferences: [],
    knownPlaces: [],
    brief: BRIEF_WEEKEND,
  };

  // `briefDays` n est PAS une invention du test : c'est exactement ce que
  // `aiItinerary` passe au prompt, a savoir `briefRequestedDays(draft.brief)`.
  // Un brief « week-end » y vaut 2 — le test qui en mettrait `null`
  // testerait une combinaison que la production ne peut pas produire.
  it('quand le brief demande une duree, elle est annoncee comme une demande', () => {
    const { prompt } = buildItineraryPrompt({
      ...input,
      briefDays: 2,
      todayIso: '2026-09-28',
    } as never);
    expect(prompt).toContain('suggestedDurationDays');
    expect(prompt).toMatch(/2 jour/);
    // Et le modele sait que shorter, c'est échouer.
    expect(prompt).toMatch(/sera refuse/);
  });

  it('quand aucune duree n est demandee, la consigne dit que c est a l IA', () => {
    const { prompt } = buildItineraryPrompt({
      ...input,
      todayIso: '2026-09-28',
    } as never);
    expect(prompt).toMatch(/a toi de la choisir/);
    expect(prompt).toMatch(/OBLIGATOIRE/);
  });

  it('quand la duree EST choisie, elle passe pour un fait', () => {
    const { prompt } = buildItineraryPrompt({
      ...input,
      durationDays: 4,
      durationChosenByUser: true,
      todayIso: '2026-09-28',
    } as never);
    expect(prompt).toMatch(/deja choisie/);
    expect(prompt).toMatch(/4 jour/);
    // Un fait ne se renegocie pas : le modele ne doit pas proposer autre chose.
    expect(prompt).toMatch(/cette valeur, ou null/i);
  });
});

describe('P0.18-D — le garde-fou refuse le parcours vide de sens', () => {
  it('REFUSE le draft reellement recu, et dit pourquoi', () => {
    const v = validateDrafted(DRAFT_REEL as never, { briefDays: 2 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('brief_non_honore');
  });

  it('refuse aussi un plan qui n est QUE du transport', () => {
    const v = validateDrafted(DRAFT_REEL as never, { briefDays: null });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('programme_absent');
  });

  it('ne refuse PAS un plan fait d arrets : un arret est une etape, pas du transport', () => {
    // Piege mesure : `arret` signifie « on s arrete ici » — une cascade, un
    // balcon, un village. Ecranter un plan de panoramas au coucher du jour
    // serait un refus sans cause. Seule une absence TOTALE de substance tombe.
    const queDesArrets = {
      title: 'Cascade et point de vue',
      days: 1,
      steps: [
        {
          day: 1,
          kind: 'arret',
          title: 'Cascade du Dard de Chamonix',
          placeName: null,
          startTime: '10:00',
          durationMin: 45,
          reason: 'Une chute d eau de 70 m, a 15 min du centre',
        },
      ],
      hypotheses: [],
    };
    const v = validateDrafted(queDesArrets as never, { briefDays: null });
    expect({ ok: v.ok, reason: v.reason }).toEqual({ ok: true, reason: null });
  });

  it('accepte le meme plan des qu il contient un vrai programme', () => {
    const avecProgramme = {
      ...DRAFT_REEL,
      days: 2,
      steps: [
        ...DRAFT_REEL.steps,
        {
          day: 2,
          kind: 'nuit',
          title: 'Nuit au refuge du Goûter',
          placeName: 'Refuge du Goûter',
          startTime: '17:00',
          durationMin: 720,
          reason: 'Nuit de refuge demandee',
        },
      ],
    };
    const v = validateDrafted(avecProgramme as never, { briefDays: 2 });
    expect({ ok: v.ok, reason: v.reason }).toEqual({ ok: true, reason: null });
  });

  it('n invente pas de contradiction quand le brief est muet', () => {
    const planSain = {
      title: 'x',
      days: 1,
      steps: [
        {
          day: 1,
          kind: 'ravitaillement',
          title: 'Dejeuner',
          placeName: 'Chamonix',
          startTime: '08:00',
          durationMin: 60,
          reason: 'repos',
        },
      ],
      hypotheses: [],
    };
    expect(validateDrafted(planSain as never, { briefDays: null }).ok).toBe(true);
    expect(validateDrafted(planSain as never).ok).toBe(true);
  });
});

describe('P0.18-E — le brief de reference vient du brouillon reel', () => {
  it('week-end + duree non choisie = 2 jours demandes', () => {
    const draft: AdventurePrepDraft = { ...emptyDraft(), brief: BRIEF_WEEKEND };
    expect(briefRequestedDays(draft.brief)).toBe(2);
    // Le calendrier, lui, ne sait rien : c est bien ce qui a produit le 1 jour.
    expect(draft.calendar.durationDays).toBeNull();
  });

  it('un draft complet sans brief n impose rien', () => {
    expect(briefRequestedDays(fullDraft().brief)).toBeNull();
  });
});

describe('P0.18-F — le brief l emporte sur l heuristique du catalogue', () => {
  const avecBrief = (brief: string | null): AdventurePrepDraft => ({ ...emptyDraft(), brief });
  const choisir = (draft: AdventurePrepDraft): AdventurePrepDraft =>
    draftActions.setActivities(draft, { primary: 'rando-refuge', extra: [], nights: [] });

  it('le catalogue vaut 1 jour pour un refuge, le brief en demande 2 : 2 gagne', () => {
    // Releve terrain du 2026-09-28 : `rando-refuge` vaut 24 h, soit 1 jour.
    // L ecran affichait « 1 jour » pendant que le brief demandait un week-end.
    const next = choisir(avecBrief(BRIEF_WEEKEND));
    expect(next.calendar.durationDays).toBe(2);
  });

  it('reste une proposition : la pastille « modifiable » ne disparait pas', () => {
    expect(choisir(avecBrief(BRIEF_WEEKEND)).calendar.durationIsSuggested).toBe(true);
  });

  it('laisse le catalogue parler quand le brief est muet sur la duree', () => {
    expect(choisir(avecBrief('randonnee au depart de Chamonix')).calendar.durationDays).toBe(1);
  });

  it('NE touche JAMAIS une duree saisie a la main, meme avec un brief', () => {
    const chosen: AdventurePrepDraft = {
      ...avecBrief(BRIEF_WEEKEND),
      calendar: { ...emptyDraft().calendar, durationDays: 5, durationIsSuggested: false },
    };
    expect(choisir(chosen).calendar.durationDays).toBe(5);
  });
});
