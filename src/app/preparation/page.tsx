import { PreparationCockpit } from '@/features/preparation';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Préparation du Trek | Le Kit du Voyageur',
  description: 'Centre de préparation de trek : qui participe, quoi emporter, quel poids et audit du sac.',
};

export default function PreparationPage() {
  return (
    <div className="min-h-screen pb-safe">
      <PreparationCockpit />
    </div>
  );
}
