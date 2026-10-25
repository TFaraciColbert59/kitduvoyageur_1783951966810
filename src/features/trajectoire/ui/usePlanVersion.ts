'use client';

import * as React from 'react';

import type { TrajectoireSnapshot } from '../domain/types';
import { nextPlanVersion, type TrajectoirePlanVersion } from '../domain/versioning';

/**
 * Version courante du plan, dans le composant.
 *
 * Le versionnage est une exigence de T2 : un plan affiche doit pouvoir dire
 * d'ou il vient. On ne persiste rien ici — la migration `trajectoire_plans`
 * est prete, mais ecrire en base sans environnement Supabase valide
 * fabriquerait un faux sentiment de durabilite. Ce hook tient la version en
 * memoire, ce qui rend le versionnage VISIBLE et TESTABLE, et laisse la
 * persistance a une phase qui aura reellement ou une base.
 *
 * Pourquoi un `useState` suivi d'un effet plutot qu'une mutation de ref dans
 * le `useMemo` : `nextPlanVersion` renvoie l' precedent objet si le hash des
 * sources n'a pas bouge. L'egalite d'identite devient donc le signal
 * « rien n'a change », et l'effet se stabilise tout seul apres deux rendus.
 * C'est idempotent par construction, pas par convenance.
 */
export function usePlanVersion(
  snapshot: TrajectoireSnapshot,
  intentionId: string
): TrajectoirePlanVersion {
  const [version, setVersion] = React.useState<TrajectoirePlanVersion | null>(null);

  const next = React.useMemo(
    () => nextPlanVersion(version, snapshot, intentionId, new Date().toISOString()),
    [version, snapshot, intentionId]
  );

  React.useEffect(() => {
    setVersion(next);
  }, [next]);

  return next;
}

/** Rendu court du hash : sept caracteres suffisent a identifier une version. */
export function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

export default usePlanVersion;
