import { TrainingScreen } from '@/components/training/training-screen';
import { Workspace } from '@/components/shell/workspace';

export const dynamic = 'force-dynamic';

/** Bac à sable : 10 faux cas (EX-UX-04). Aucune écriture, aucune donnée réelle. */
export default function TrainingPage() {
  return (
    <Workspace>
      <TrainingScreen />
    </Workspace>
  );
}
