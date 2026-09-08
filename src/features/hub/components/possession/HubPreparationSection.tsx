import { PreparationCockpit } from '@/features/preparation/components/PreparationCockpit';

/**
 * H4.2 — Section préparation du hub (composition materiel/preparation/page).
 * Cockpit sans props (store client) — consomme gearGapEngine/shakedownEngine,
 * jamais dupliqués. Rendu direct, flux normal.
 */
export function HubPreparationSection() {
  return <PreparationCockpit />;
}

export default HubPreparationSection;
