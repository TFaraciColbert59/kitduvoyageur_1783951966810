import type { CompasKitLine, CompasStepId } from '../engine/compasModel';
import type { CompasData, CompasShopProduct } from '../server/getCompasData';
import type { Detent } from './CompasSheet';

export type AcquireMode = 'emprunter' | 'louer' | 'acheter';

/** Parcours internes du tiroir de chaque étape (capsule, comme les étapes). */
export const STEP_FLOWS = {
  // Ordre de la maquette finale : Activité → Parcours → Quand → Préférences
  // → Sac. « Sur le tracé » (points OSM réels) suit, en dernier.
  ou: [
    { id: 'activite', label: 'Activité', icon: 'flag' },
    { id: 'parcours', label: 'Parcours', icon: 'route' },
    { id: 'quand', label: 'Quand', icon: 'calendar-days' },
    { id: 'preferences', label: 'Préférences', icon: 'heart' },
    { id: 'sac', label: 'Sac', icon: 'backpack' },
    { id: 'trace', label: 'Sur le tracé', icon: 'map-pin' },
  ],
  nous: [
    { id: 'equipe', label: 'Équipe', icon: 'users' },
    { id: 'budget', label: 'Budget', icon: 'coins' },
  ],
  resa: [
    { id: 'nuits', label: 'Nuits', icon: 'bed-double' },
    { id: 'reservations', label: 'Réservations', icon: 'ticket' },
    { id: 'offres', label: 'Offres', icon: 'tag' },
  ],
  // Maquette finale : Risques → Météo → Veille → Sources (la veille suit).
  verdict: [
    { id: 'raisons', label: 'Risques', icon: 'shield-check' },
    { id: 'meteo', label: 'Météo', icon: 'cloud-sun' },
    { id: 'veille', label: 'Veille', icon: 'bell' },
    { id: 'sources', label: 'Sources', icon: 'layers' },
  ],
  kit: [
    { id: 'conseils', label: 'Conseils', icon: 'sparkles' },
    { id: 'mes-kits', label: 'Mes kits', icon: 'package' },
    { id: 'trouver', label: 'Trouver', icon: 'search' },
    { id: 'emballer', label: 'Emballer', icon: 'check-square' },
    { id: 'tout', label: 'Tout', icon: 'clipboard-list' },
    { id: 'sacs', label: 'Sacs', icon: 'backpack' },
  ],
} as const;

export type StepFlow<S extends CompasStepId = CompasStepId> = (typeof STEP_FLOWS)[S][number]['id'];

export type SheetState =
  | { kind: 'item'; lineId: string }
  | { kind: 'acquire'; lineId: string; mode: AcquireMode }
  | {
      kind: 'add';
      target: 'kit' | 'inventaire';
      /** Venu d'un conseil : recherche pré-remplie et nom proposé pour « Autre ». */
      suggest?: { query: string; name: string };
    }
  | { kind: 'bag'; userId: string }
  | { kind: 'carrier'; lineId: string }
  | { kind: 'step'; step: CompasStepId; flow: StepFlow; hint?: FlowHint };

/** Ce qu'un geste ailleurs (règle, « Dis-le ») transmet au parcours ouvert. */
export interface FlowHint {
  /** Durée choisie sur la règle, en heures, en attente d'un départ. */
  hours?: number;
  /** Lieu à chercher dans Parcours. */
  query?: string;
  /** Jour touché (tuile de nuit) : le tiroir s'ouvre sur ce jour. */
  day?: number;
  /** Phrase tapée dans « Dis-le » sur la carte : le tiroir la comprend aussitôt. */
  say?: string;
}

export type ActionResult = { success: boolean; error?: string };

/** Contrôleur partagé par les cartes et les tiroirs. */
export interface CompasCtl {
  data: CompasData;
  /** Lignes du kit avec l'état « emballé » optimiste appliqué. */
  lines: CompasKitLine[];
  busy: boolean;
  open: (sheet: SheetState, detent?: Detent) => void;
  /** Remplace le tiroir du dessus (changement de parcours interne). */
  replace: (sheet: SheetState) => void;
  back: () => void;
  close: () => void;
  /** Passe le tiroir du dessus en grande hauteur (contenu qui s'allonge). */
  enlarge: () => void;
  run: (success: string, action: () => Promise<ActionResult>) => Promise<boolean>;
  togglePacked: (line: CompasKitLine) => void;
  memberName: (userId: string | null) => string;
  product: (id: string | null) => CompasShopProduct | undefined;
  notify: (message: string, tone?: 'bad') => void;
}
