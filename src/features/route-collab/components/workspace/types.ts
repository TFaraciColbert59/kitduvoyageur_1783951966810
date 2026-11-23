import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';
import type { UserPaceProfile } from '../../paceProfile';
import type { RouteCorridorPoi } from '../../routeAnalysis';
import type { RouteWorkspaceState } from '../../types';

export type SubDrawerId =
  | 'point'
  | 'section'
  | 'stage'
  | 'gpx'
  | 'variants'
  | 'kit'
  | 'terrain'
  | 'proposals'
  | 'sharing'
  | 'offline-carnet';

export interface RouteCollabWorkspaceProps {
  initialWorkspace: RouteWorkspaceState;
  currentUserId: string;
  currentUserName: string;
  /** Si vrai, toutes les mutations/lectures passent par /api/routes/[id]/* pour la vraie coédition multi-sessions. */
  serverSynced?: boolean;
  shareToken?: string | null;
  /** Pour les tests ou environnements sans WebGL. */
  forceNoWebGL?: boolean;
  /** Ouvre le tiroir dès le premier rendu (utile pour tests ou accès direct). */
  initialSheetOpen?: boolean;
  onWorkspaceChange?: (next: RouteWorkspaceState) => void;
  /** Allure apprise des sorties de la personne (10.8), lue côté serveur ; absent : allure standard, dite. */
  paceProfile?: UserPaceProfile | null;
  /** Profil de performance complet de la personne, pour la prédiction d'effort (7.1) ; absent : non personnalisée. */
  performanceProfile?: PerformanceProfile | null;
}

/** Titre + sous-titre d'un sous-tiroir (le corps est un composant dédié). */
export interface DrawerHeader {
  title: string;
  subtitle: string;
}

/** Tiroir superposé hiérarchique (jour -> point -> POI -> sac). */
export type OverlayDetailState =
  | { kind: 'day'; stageId: string; precision: 1 | 2 | 3 }
  | { kind: 'point'; pointId: string; stageId?: string; precision: 1 | 2 | 3 }
  | { kind: 'poi'; poi: RouteCorridorPoi; stageId?: string; precision: 1 | 2 }
  | { kind: 'kit'; stageId?: string; precision: 1 | 2 };
