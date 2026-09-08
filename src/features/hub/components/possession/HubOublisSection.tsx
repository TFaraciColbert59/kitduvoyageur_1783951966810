import { ForgetWorkspace } from '@/features/materiel/components/forget/ForgetWorkspace';
import { getForgetChecklist } from '@/features/materiel/services/getForgetChecklist';

/**
 * H-AUTO-42 — Section « à ne pas oublier » du hub (composition
 * materiel/forget/page : mêmes composants, même service, zéro duplication).
 * Le chrome hub remplace l'en-tête de page ; l'ancienne route /materiel/forget
 * redirige 307 vers /hub/oublis.
 */
export async function HubOublisSection() {
  const items = await getForgetChecklist();
  return <ForgetWorkspace items={items} />;
}

export default HubOublisSection;
