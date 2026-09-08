import { PreparationCockpit } from '@/features/preparation/components/PreparationCockpit';

/**
 * H4.2 — Section préparation du hub (cockpit canonique preparation).
 * Cockpit sans props (store client) — consomme gearGapEngine/shakedownEngine,
 * jamais dupliqués. /preparation et /materiel/preparation redirigent 307 ici
 * (H5 + H-AUTO-42).
 */
export function HubPreparationSection() {
  return <PreparationCockpit />;
}

export default HubPreparationSection;
