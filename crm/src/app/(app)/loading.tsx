import s from '@/ui/crm.module.css';
import { SkeletonCard, SkeletonList } from '@/ui/states';
import { Workspace } from '@/components/shell/workspace';

/** Chargement : squelettes, jamais d'écran blanc. */
export default function AppLoading() {
  return (
    <Workspace
      rail={
        <>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
        </>
      }
    >
      <div className={s.col} style={{ gap: 6 }}>
        <span className={s.skeleton} style={{ height: 30, width: 220 }} />
        <span className={s.skeleton} style={{ height: 14, width: 380 }} />
      </div>
      <div className={s.card}>
        <SkeletonList rows={7} />
      </div>
    </Workspace>
  );
}
