import { PreparationCockpit } from '@/features/preparation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Préparation du Matériel | Le Kit du Voyageur',
  description: 'Centre de préparation de trek : qui participe, quoi emporter, quel poids et audit du sac.',
};

export default function MaterielPreparationPage() {
  return (
    <div className="min-h-screen pb-safe">
      <PreparationCockpit />
    </div>
  );
}
