/**
 * Ancrage de la narration Nemotron — module PUR, sans aucun `askAI`.
 *
 * Ce fichier existe pour une raison architecturale precise : `askAI` porte
 * `import 'server-only'`. Tant que le module de narration l'importe, le hook
 * client qui l'utilise casse le bundle — et le « jamais bloquant » du dossier
 * devient un ecran blanc. On separe donc deux responsabilites :
 *
 *  - ICI : tout ce qui est PUR. La forme attendue, le parseur, le prompt, et
 *    surtout le CONTROLE ANTI-INVENTION. Aucun reseau, aucune cle, aucun
 *    `server-only`. Ce module tourne dans un composant client, dans un routeur
 *    et dans un test, sans comportement different.
 *  - `modelNarration.ts` : le seul fichier qui parle au provider.
 *
 * Conséquence de securite : le client n'envoie JAMAIS les nombres qu'il
 * affiche. Il envoie une intention et une position de curseur ; le serveur
 * re-derive l'instantane avec le meme moteur pur, et verifie la prose contre
 * CET instantane. Un client modifie ne peut donc pas faire valider une
 * narration en forgeant un etat : il n'y a pas d'etat a forger.
 */

import type { TrajectoireSnapshot } from '../domain/types';
import { describeDuration } from '../domain/derive';
import type { Narration, NarrationLine } from '../ui/narration';

/**
 * Facteur de completude minimal.
 *
 * Le dossier fixe 512 tokens : en dessous, Nemotron se fait couper au milieu
 * d'une phrase, et une narration coupee est pire qu'une narration absente —
 * elle a l'air complete. On garde 512.
 */
export const NARRATION_MAX_TOKENS = 512;

/** Borne haute du nombre de lignes. Le modele en rend 1 a 5. */
export const NARRATION_MAX_LINES = 5;

/** Origine affichee quand la prose vient reellement d'un modele. */
export const MODEL_ORIGIN_LABEL = 'Narration Nemotron · moteur seul pour les chiffres';

/** Origine affichee quand le gabarit local a ete conserve. */
export const FALLBACK_ORIGIN_LABEL = 'Modèle déterministe · n’invente jamais';

/** Route qui sert la narration. Le client ne parle JAMAIS a `askAI`. */
export const NARRATION_ROUTE = '/api/trajectoire/narration';

/**
 * La forme EXACTE attendue du modele.
 *
 * Volontairement deux champs, et des lignes en nombre libre dans 1..5. Le
 * modele ne choisit ni le contenu ni l'ordre : il met de la prose dans des
 * cases. Toute donnee structurante reste dans l'instantane, donc dans le
 * moteur, donc testable.
 */
export interface ModelNarrationShape {
  headline: string;
  lines: string[];
}

/**
 * La reponse finale, et son origine.
 *
 * `origin` est NON NEGOCIABLE : c'est lui que l'ecran affiche. Une narration
 * de modele et une narration de gabarit ne doivent jamais pouvoir se
 * confondre a la lecture, sinon l'utilisateur ne sait plus s'il lit une
 * phrase ecrite par une machine ou une regle.
 */
export interface NarrationResult {
  narration: Narration;
  /** `modele` = Nemotron a repondu ; `modele_deterministe` = gabarit. */
  origin: 'modele' | 'modele_deterministe';
  model: string | null;
  /** Raison de l'absence de reponse modele, pour le debug et le badge. */
  reason: string | null;
}

/**
 * Prompt systeme.
 *
 * Il dit ce que le modele ne doit PAS faire, parce que c'est la seule chose
 * qui compte ici : il ne doit produire aucune donnee. Toute valeur chiffree
 * qu'il ecrirait serait une invention — c'est literalement le piege que la
 * regle du dossier ferme.
 */
export const SYSTEM_PROMPT = [
  'Tu rediges la prose d un plan de voyage deja calcule.',
  'REGLE ABSOLUE : tu n inventes aucune donnee.',
  'Tous les chiffres, dates, distances et dangers sont deja calcules par le moteur.',
  'On te les donne dans l etat. Ton travail est de les dire en francais, clairement.',
  'Tu ne dois ni calculer, ni estimer, ni completer une information manquante.',
  'Si une information ne t est pas donnee, tu ne la mentionnes pas.',
  '',
  'Tu reponds UNIQUEMENT avec un objet JSON :',
  '{ "headline": string, "lines": string[] }',
  `Entre 1 et ${NARRATION_MAX_LINES} elements dans lines, chacun une phrase courte.`,
].join('\n');

/**
 * L'etat passe au modele.
 *
 * On ne passe que du STRUCTURE. Aucun composant React, aucune fonction : ce
 * qui part vers le modele est serialisable, donc reproductible, donc
 * debuggable. Un debug impossible a reconstruire est un debug qu'on ne fait
 * jamais.
 */
export function stateForPrompt(snapshot: TrajectoireSnapshot): Record<string, unknown> {
  return {
    zone: snapshot.zoneLabel,
    duree: describeDuration(snapshot.hours),
    danger: {
      score: snapshot.danger.score,
      niveau: snapshot.danger.level,
      // L'echelle est une donnee de domaine, pas une invention du redacteur :
      // le moteur borne la dangerosite sur 100. Sans cette borne, un modele
      // ecrivant « 68 sur 100 » — la forme naturelle — serait rejete a tort.
      max: 100,
    },
    fenetre: {
      ideale: snapshot.window.ideal,
      risque: snapshot.window.risk,
      jour: snapshot.window.daylight,
    },
    plan: {
      etapes: snapshot.steps.length,
      grain: snapshot.grain,
    },
    kit: {
      total: snapshot.kit.length,
    },
    traces: {
      total: snapshot.traces.length,
      aTonEchelle: snapshot.traces.filter((trace) => trace.atYourScale).length,
    },
    sources: snapshot.provenance,
  };
}

/**
 * Parse une reponse brute en structure validee.
 *
 * Renvoie `null` — jamais une exception — si la forme ne correspond pas. Un
 * parseur qui leve obligerait l'appelant a gerer une erreur de forme ET une
 * erreur de reseau ; ici il n'y a qu'un chemin d'echec, donc un seul test.
 *
 * On tolere le ```json ... ``` que les modeles ajoutent spontanement : c'est
 * un detail de forme, pas une divergence de fond, et refuser un plan correct
 * pour un accent grave serait de la pedanterie qui coute une narration.
 */
export function parseModelNarration(raw: string): ModelNarrationShape | null {
  const text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const shape = parsed as Record<string, unknown>;

  const headline = shape.headline;
  const lines = shape.lines;
  if (typeof headline !== 'string' || headline.trim().length === 0) return null;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  if (lines.length > NARRATION_MAX_LINES) return null;
  if (!lines.every((line) => typeof line === 'string' && line.trim().length > 0)) return null;

  return { headline: headline.trim(), lines: lines.map((line) => line.trim()) };
}

/* -------------------------------------------------------------------------- */
/* Nombres en toutes lettres                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Pourquoi un lexique, et pourquoi il s'arrete a seize.
 *
 * Un garde sur les seuls chiffres arabes se contourne en une phrase : « Dix-
 * sept etapes » passe le controle alors que 17 n'a rien a faire dans l'etat.
 * La regle « l'IA n'invente jamais » serait alors une promesse de prompt, et
 * une promesse que rien ne verifie.
 *
 * `un` et `une` sont VOLONTAIREMENT absents : en francais, « un refuge », «
 * une nuit » sont des articles, pas des quantites. Les traiter comme 1 ferait
 * rejeter presque toute narration reelle. C'est le seul echappatoire
 * assume, il est ecrit ici pour qu'on puisse le voir.
 */
const UNITS: Readonly<Record<string, number>> = {
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
};

const TENS: Readonly<Record<string, number>> = {
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
};

/** Valeur rendue quand une suite de mots n'est pas un nombre francais. */
const UNREADABLE = -1;

/**
 * Evalue une suite de mots-nombres deja isolee.
 *
 * Couvre la couche 0-99, ce qui est tout ce qu'un plan peut redire : «
 * dix-sept », « quatre-vingt-dix », « soixante-quinze », « vingt et un ».
 * Une suite qui ne se laisse pas lire rend `UNREADABLE` — et l'appelant
 * REJETTE alors la narration. On echoue du bon cote : une phrase refusee est
 * une phrase de trop, une phrase acceptee avec un nombre invente est un plan
 * qui ment en facade.
 */
function evaluateWordRun(tokens: readonly string[]): number {
  let total = 0;
  let pending = 0;

  for (const token of tokens) {
    if (token === 'cent') {
      // « deux cents » -> 200 ; « cent » seul -> 100.
      total += (pending || 1) * 100;
      pending = 0;
      continue;
    }

    if (token === 'vingt' && pending === 4) {
      // « quatre-vingt » -> 80, et « quatre-vingt-dix » se clot a 90.
      pending = 80;
      continue;
    }

    const unit = UNITS[token];
    if (unit !== undefined) {
      if (pending === 10 || pending >= 20) pending += unit;
      else if (pending === 0) pending = unit;
      else return UNREADABLE;
      continue;
    }

    const ten = TENS[token];
    if (ten !== undefined) {
      if (pending >= 20) pending += ten;
      else if (pending === 0) pending = ten;
      else return UNREADABLE;
      continue;
    }

    return UNREADABLE;
  }

  return total + pending;
}

/**
 * Tous les nombres en toutes lettres d'un texte.
 *
 * Les suites sont isolees par les mots qui ne sont pas des nombres : « cinq
 * etapes au grain jour » ne contient qu'un nombre, 5. « pour cent » est
 * ecarte avant tout, parce que « cent » y est une unite, pas une quantite.
 */
export function spokenNumbers(text: string): number[] {
  const normalised = text
    .toLowerCase()
    .replace(/[\u2010-\u2015-]/g, '-')
    .replace(/\bpour\s+cent\b/g, 'pourcent');

  const words = normalised.split(/[^a-z]+/).filter(Boolean);
  const found: number[] = [];
  let run: string[] = [];

  const flush = (): void => {
    // Un « et » traine sans nombre derriere : c'est la conjonction, pas un
    // quantite. On le retire avant d'evaluer.
    while (run.length > 0 && !isNumberWord(run[run.length - 1])) run.pop();
    if (run.length > 0) found.push(evaluateWordRun(run));
    run = [];
  };

  for (const word of words) {
    if (isNumberWord(word) || word === 'et') {
      run.push(word);
      continue;
    }
    flush();
  }
  flush();

  return found;
}

function isNumberWord(word: string): boolean {
  return word === 'cent' || word === 'et' || UNITS[word] !== undefined || TENS[word] !== undefined;
}

/**
 * Verifie que la prose ne introduit aucune donnee absente de l'etat.
 *
 * C'est le controle qui rend « l'IA n'invente jamais » VERIFIABLE plutot que
 * quete. Un modele qui ecrit « 12 jours » quand l'etat dit 5 jours produit un
 * plan qui a l'air verifie et ne l'est pas — exactement le defaut que la
 * provenance chips vient, elle, rendre visible cote donnees. La, on ferme la
 * porte sur le texte.
 *
 * On compare les nombres comme valeurs, pas comme chaines : le modele peut
 * ecrire « 5 » la ou l'etat porte 5, ou « Cinq », ou « 5,0 ». Il ne doit pas
 * pouvoir ecrire « 72 ».
 */
export function groundNarration(
  shape: ModelNarrationShape,
  snapshot: TrajectoireSnapshot
): boolean {
  const allowed = new Set<number>();
  const harvest = (value: unknown): void => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      allowed.add(value);
      // 68.5 doit autoriser « 68 », pas « 68.5 » : on range les deux formes.
      allowed.add(Math.round(value));
      allowed.add(Math.floor(value));
    } else if (typeof value === 'string') {
      // Les chaines de l'etat (labels, fenetres) sont autorisees telles
      // quelles : le modele doit pouvoir les reprendre, chiffres compris.
      // Les nombres en toutes lettres aussi : une fenetre qui dit « 25 sept. »
      // doit pouvoir etre repetee, sinon le garde refuserait une reprise
      // fidele. Ce n'est pas une brèche : ces nombres viennent du moteur.
      for (const match of value.match(/\d+/g) ?? []) allowed.add(Number(match));
      for (const spoken of spokenNumbers(value)) {
        if (spoken !== UNREADABLE) allowed.add(spoken);
      }
    } else if (Array.isArray(value)) {
      value.forEach(harvest);
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(harvest);
    }
  };
  harvest(stateForPrompt(snapshot));

  const texts = [shape.headline, ...shape.lines];

  return texts.every((text) => {
    for (const token of text.match(/\d+/g) ?? []) {
      if (!allowed.has(Number(token))) return false;
    }
    for (const spoken of spokenNumbers(text)) {
      // Suite illisible : on refuse plutot que de deviner.
      if (spoken === UNREADABLE) return false;
      if (!allowed.has(spoken)) return false;
    }
    return true;
  });
}

/**
 * Enveloppe une forme validee dans le contrat d'affichage.
 *
 * `buildNarrationResult` ne fait AUCUNE verification : c'est le role de
 * `groundNarration`, appele juste avant. Le separer evite d'avoir deux portes,
 * dont une seule serait testee.
 */
export function buildNarrationResult(
  shape: ModelNarrationShape,
  model: string | null
): NarrationResult {
  const lines: NarrationLine[] = shape.lines.map((text, index) => ({
    id: `modele-${index + 1}`,
    text,
    origin: 'modele',
  }));

  return {
    narration: { headline: shape.headline, lines, origin: 'modele' },
    origin: 'modele',
    model,
    reason: null,
  };
}

/** Etiquette d'origine a afficher sous la narration. */
export function originLabel(result: NarrationResult | null): string {
  return result?.origin === 'modele' ? MODEL_ORIGIN_LABEL : FALLBACK_ORIGIN_LABEL;
}
