import { describe, it, expect } from "vitest";
import { validateDrafted } from "../engine/itineraryEngine";
import { briefRequestedDays } from "../engine/briefDays";

// LE PROPRE DRAFT RENVOYE PAR L IA, verbatim depuis la reponse serveur
// capturee le 2026-09-28 (probe p018). On le passe dans le VRAI validateur.
//
// Brief soumis : « Week-end de randonnee au depart de Chamonix, refuge la
// premiere nuit. »
// Reponse recue : 1 jour, 1 seule etape, de nature `trajet`.
//
// Ce fichier est la PREUVE DE FERMETURE de P0.18. Tant qu il affirmait
// `ok: true`, il ne prouvait qu une chose : que rien ne regardait ce draft.
// Il affirme maintenant le refus, et le motif exact dudit refus.
const BRIEF = "Week-end de randonnée au départ de Chamonix, refuge la première nuit";

const draftReel = {
  title: "Randonnée refuge au Mont-Blanc",
  days: 1,
  steps: [
    {
      day: 1,
      kind: "trajet",
      title: "Départ vers le refuge du Goûter",
      placeName: "Chamonix-Mont-Blanc",
      startTime: "08:00",
      durationMin: 120,
      reason: "Trajet initial depuis le village",
    },
  ],
  hypotheses: ["Météo et état des sentiers à confirmer"],
};

/** Le verdict complet, detail compris : un refus sans motif lisible ne prouve rien. */
function verdict(expectations: { briefDays: number | null }) {
  const v = validateDrafted(draftReel as never, expectations);
  return { ok: v.ok, reason: v.reason, detail: v.detail, offending: v.offending };
}

describe("P0.18 — le draft reellement renvoye par l IA", () => {
  it("le brief de la demande est bien lu comme deux jours", () => {
    // Sans cette ligne, le refus ci-dessous pourrait venir de n'importe quoi.
    expect(briefRequestedDays(BRIEF)).toBe(2);
  });

  it("est REFUSE : le parcours livre moins de jours que le brief en demande", () => {
    expect(verdict({ briefDays: briefRequestedDays(BRIEF) })).toEqual({
      ok: false,
      reason: "brief_non_honore",
      detail: "le parcours livre dure moins de jours que le brief en demande",
      offending: ["brief: 2 jour(s)", "plan: 1 jour(s)"],
    });
  });

  it("serait refuse meme sans brief, car il ne contient QUE du transport", () => {
    // Le garde-fou ne s'appuie pas sur le brief pour attraper un plan vide :
    // meme muet, « un trajet et rien d'autre » n'est pas un voyage.
    expect(verdict({ briefDays: null })).toEqual({
      ok: false,
      reason: "programme_absent",
      detail: "aucune etape de programme : uniquement du transport",
      offending: ["Départ vers le refuge du Goûter"],
    });
  });
});