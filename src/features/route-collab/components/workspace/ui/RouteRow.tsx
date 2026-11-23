import type { ReactNode } from 'react';
import { Grp, Li } from '@/features/compas/v5/ui/primitives';
import type { V5IconName } from '@/features/compas/v5/ui/icons';
import { V5Scope } from './V5Scope';

/**
 * Une seule recette de ligne pour tout le tiroir (4.7) : icône, titre, sous-titre, valeur, état.
 * Construite sur la ligne `Li` du Compas v5 ; les états sont ceux que l'utilisateur comprend, jamais une note :
 * « À vérifier », « Confirmé », « Inconnu ».
 */
export type RouteRowState = 'to_check' | 'confirmed' | 'unknown';

export const ROUTE_ROW_STATE_LABEL: Record<RouteRowState, string> = {
  to_check: 'À vérifier',
  confirmed: 'Confirmé',
  unknown: 'Inconnu',
};

const STATE_TONE: Record<RouteRowState, 'warn' | 'good' | undefined> = {
  to_check: 'warn',
  confirmed: 'good',
  unknown: undefined,
};

export interface RouteRowProps {
  icon: V5IconName;
  title: string;
  subtitle?: string | null;
  /** Valeur à droite. Absente et état « inconnu » : « Inconnu » (jamais 0). */
  value?: string | null;
  state?: RouteRowState;
  /** Contrôle libre à droite (bouton, interrupteur…), après l'état. */
  trailing?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  testId?: string;
  /** Ligne choisie (jour sélectionné). */
  current?: boolean;
}

export function RouteRow({ icon, title, subtitle, value, state, trailing, onClick, ariaLabel, testId, current }: RouteRowProps) {
  const shownValue = value ?? (state === 'unknown' ? 'Inconnu' : null);
  const right =
    state || trailing ? (
      <>
        {state ? (
          <span className={`v5-chip${STATE_TONE[state] ? ` ${STATE_TONE[state]}` : ''} rcw-row-state`} data-row-state={state}>
            {ROUTE_ROW_STATE_LABEL[state]}
          </span>
        ) : null}
        {trailing}
      </>
    ) : undefined;
  return (
    <Li
      icon={icon}
      title={title}
      detail={subtitle ?? undefined}
      value={shownValue ?? undefined}
      right={right}
      onClick={onClick}
      ariaLabel={ariaLabel}
      testId={testId}
      state={state}
      current={current}
    />
  );
}

/** Groupe de lignes sur verre (même matière que les groupes du Compas). */
export function RouteRows({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <V5Scope>
      <Grp className="rcw-rows" data-testid={testId}>
        {children}
      </Grp>
    </V5Scope>
  );
}
