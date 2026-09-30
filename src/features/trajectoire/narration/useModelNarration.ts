'use client';

/**
 * Branchement React de la narration Nemotron.
 *
 * Le hook applique la contrainte qui-decule du dossier : « narration LLM en
 * async apres le squelette (jamais bloquante) ». Il n'attend rien au premier
 * rendu, et il n'affiche rien tant que la reponse n'est pas la.
 *
 * Trois precautions, chacune un piege deja vu ailleurs dans ce chantier :
 *
 *  1. LE PONT EST UNE ROUTE, PAS UN IMPORT. Ce hook ne parle pas a `askAI` :
 *     `askAI` est `server-only`, et un composant client qui l'importe casse le
 *     bundle. Il POST donc `{ intention, t }` a `/api/trajectoire/narration`,
 *     et c'est le serveur qui re-derive l'instantane et verifie la prose. Le
 *     client n'a donc jamais la main sur les nombres de la porte.
 *
 *  2. L'ABANDON. Un composant qui deplace le curseur tres vite declenche
 *     autant d'appels. Sans annulation, une reponse arrive pour un etat qui
 *     n'est plus affiche et ecrase l'ecran — l'utilisateur voit le plan
 *     correspondre a une position qu'il a quittee depuis dix secondes. On
 *     annule donc la requete precedente, et on ignore aussi une reponse deja
 *     resolue si l'etat a change entre-temps : une annulation peut toujours
 *     arriver trop tard, on ne lui fait donc pas confiance seule.
 *
 *  3. PAS DE PHRASE PERIMEE. Une reponse de modele appartient a l'etat qu'elle
 *     decrit. Des qu'un nouvel etat arrive, on repart du gabarit deterministe
 *     de CE nouvel etat, avec le badge « en cours ». Garder l'ancienne phrase
 *     le temps de la reponse afficherait un plan qui n'est plus celui du
 *     curseur — exactement l'illusion que « n'invente jamais » interdit.
 *
 * Le hook ne renvoie jamais `null` : l'appelant n'a aucun cas vide a gerer.
 */

import * as React from 'react';

import type { Narration } from '../ui/narration';
import { FALLBACK_ORIGIN_LABEL, NARRATION_ROUTE, type NarrationResult } from './grounding';

/**
 * Temporisation avant appel.
 *
 * Un `pointermove` de souris emet un evenement par pixel : sans temporisation,
 * un simple glissement de traversee declenchait une centaine de requetes en
 * quelques secondes. La route repondait alors 429 en serie, et l'utilisateur
 * voyait « Narration indisponible » alors que la limite n'etait pas atteinte --
 * c'etait le geste lui-meme qui l'avait atteinte.
 *
 * 280 ms est le compromis mesure : assez long pour absorber une traversee de
 * curseur, assez court pour que la phrase soit deja la quand le doigt se
 * repose. Le curseur, lui, reste instantane : c'est le gabarit deterministe
 * qui s'affiche, sans attendre quoi que ce soit.
 */
const NARRATION_DEBOUNCE_MS = 280;

export interface UseModelNarration extends Narration {
  /** Etiquette d'origine, prete a afficher. */
  originLabel: string;
  /** Le modele est-il en train de repondre ? Sert a griser le badge. */
  pending: boolean;
}

/**
 * Garde de forme sur la reponse du serveur.
 *
 * Une reponse JSON est une entree non fiable : le serveur peut evoluer, une
 * erreur peut se glisser dans le corps, un reverse proxy peut renvoyer autre
 * chose. On ne fait confiance qu'a ce qui a la forme d'une narration modele.
 */
function readNarrationResult(payload: unknown): NarrationResult | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const result = payload as { narration?: unknown };

  if (typeof result.narration !== 'object' || result.narration === null) return null;
  const narration = result.narration as {
    headline?: unknown;
    lines?: unknown;
    origin?: unknown;
  };

  if (typeof narration.headline !== 'string' || narration.headline.trim().length === 0) {
    return null;
  }
  if (!Array.isArray(narration.lines) || narration.lines.length === 0) return null;
  if (
    !narration.lines.every(
      (line: unknown) =>
        typeof line === 'object' &&
        line !== null &&
        typeof (line as { text?: unknown }).text === 'string'
    )
  ) {
    return null;
  }

  return {
    narration: {
      headline: narration.headline,
      lines: narration.lines as Narration['lines'],
      origin: 'modele',
    },
    origin: 'modele',
    model: null,
    reason: null,
  };
}

export function useModelNarration(
  intention: string,
  t: number,
  fallback: Narration
): UseModelNarration {
  const [result, setResult] = React.useState<NarrationResult | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    let current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Le nouvel etat repart de ZERO : pas de phrase perimee, badge en cours.
    setResult(null);
    setPending(true);

    const ask = () => {
      fetch(NARRATION_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intention, t }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          // Deux gardes, volontairement redondants : l'un repose sur le signal,
          // l'autre sur l'etat. Une annulation peut toujours perdre la course
          // contre une reponse deja resolue.
          if (!current || controller.signal.aborted) return;
          const answer = readNarrationResult(payload);
          if (!answer) return;
          setResult(answer);
        })
        .catch(() => {
          // Hors ligne, 503, limite : le gabarit reste. Preferer une absence de
          // phrase a un ecran casse.
        })
        .finally(() => {
          if (current && !controller.signal.aborted) setPending(false);
        });
    };

    timer = setTimeout(ask, NARRATION_DEBOUNCE_MS);

    return () => {
      current = false;
      if (timer !== null) clearTimeout(timer);
      controller.abort();
    };
  }, [intention, t]);

  return React.useMemo(() => {
    if (!result) {
      return { ...fallback, originLabel: FALLBACK_ORIGIN_LABEL, pending };
    }
    return {
      ...result.narration,
      originLabel: 'Narration Nemotron · moteur seul pour les chiffres',
      pending,
    };
  }, [result, fallback, pending]);
}

export default useModelNarration;
