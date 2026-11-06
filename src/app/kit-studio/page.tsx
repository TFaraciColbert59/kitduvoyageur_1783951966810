import { KitStudioClient } from '@/features/kit-studio/ui/KitStudioClient';

/**
 * Kit Studio v2 : un seul écran (sac 3D + tiroir). Étage 1 : le kit est lu en local côté client
 * (kitRepository) ; la page serveur ne porte ni secret ni donnée de session en v1.
 */
export default function KitStudioPage() {
  return <KitStudioClient />;
}
