import { searchTerms } from '../../shared/format';

/** Distance d'édition bornée : sert uniquement à proposer une correction. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const insertion = (current[j - 1] as number) + 1;
      const deletion = (previous[j] as number) + 1;
      const substitution = (previous[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(insertion, deletion, substitution);
    }
    previous = current;
  }
  return previous[b.length] as number;
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export interface SearchAlternatives {
  /** « Vous vouliez dire … ? » */
  best: { from: string; to: string } | null;
  /** Mots proches proposés en chips (même préfixe ou distance 1). */
  near: string[];
}

/**
 * Alternatives utiles quand la recherche ne renvoie rien (Recherche#11) :
 * correction orthographique probable + mots proches, sans jamais inventer de
 * contenu. Le vocabulaire est fourni par l'appelant (tendances, lieux).
 */
export function suggestAlternatives(query: string, vocabulary: ReadonlyArray<string>): SearchAlternatives {
  const terms = searchTerms(query);
  const vocab = Array.from(
    new Set(
      vocabulary
        .flatMap((entry) => entry.split(/[\s,;:!?()[\]{}«»"']+/))
        .map((word) => word.replace(/^[#@]+/, '').trim())
        .filter((word) => word.length >= 3),
    ),
  );
  let best: SearchAlternatives['best'] = null;
  let bestDistance = 3;
  const near = new Set<string>();
  for (const term of terms) {
    const foldedTerm = fold(term);
    for (const word of vocab) {
      if (word.length < 3) continue;
      const foldedWord = fold(word);
      if (foldedWord === foldedTerm) continue;
      if (foldedWord.slice(0, 3) === foldedTerm.slice(0, 3)) near.add(word);
      if (foldedTerm.length < 3) continue;
      const distance = editDistance(foldedWord, foldedTerm);
      if (distance < bestDistance && distance <= 2) {
        bestDistance = distance;
        best = { from: term, to: word };
      }
    }
  }
  return { best, near: Array.from(near).slice(0, 4) };
}

/** Remplace le premier terme de la requête par la correction proposée. */
export function withSuggestedTerm(query: string, alternative: { from: string; to: string }): string {
  const escaped = alternative.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return query.replace(new RegExp(escaped, 'i'), alternative.to);
}
