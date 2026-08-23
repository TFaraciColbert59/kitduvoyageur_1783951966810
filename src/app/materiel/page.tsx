import { MaterielGrid } from '@/features/materiel/components/MaterielGrid';
import { getMaterielSummary } from '@/features/materiel/services/getMaterielSummary';
import { DemoLoginButton } from '@/features/materiel/components/DemoLoginButton';

export const dynamic = 'force-dynamic';

export default async function MaterielPage() {
  const data = await getMaterielSummary();
  const isEmpty = data.kits.count === 0 && data.inventaire.count === 0;

  return (
    <div className="min-h-[calc(100dvh-64px-env(safe-area-inset-bottom)-env(safe-area-inset-top))] md:min-h-[calc(100dvh-88px)] flex flex-col justify-center items-center w-full px-3 sm:px-4 py-4 md:py-6">
      <div className="w-full max-w-[var(--page-max-w)] mx-auto flex flex-col justify-center">
        <h1 className="sr-only">Mon Matériel</h1>
        {isEmpty && (
          <div className="flex justify-center mb-4">
            <DemoLoginButton />
          </div>
        )}
        <MaterielGrid data={data} />
      </div>
    </div>
  );
}