import type { ReactNode } from 'react';
import s from '../../ui/crm.module.css';

/**
 * Zone de travail : colonne centrale + rail de contexte à droite.
 * Le rail est un slot : chaque écran y met le contexte de SON objet.
 */
export function Workspace({ rail, children, bare = false }: { rail?: ReactNode; children: ReactNode; bare?: boolean }) {
  return (
    <div className={s.work}>
      <main className={bare ? s.mainBare : s.main}>{children}</main>
      {rail ? (
        <aside className={s.rail} aria-label="Contexte">
          {rail}
        </aside>
      ) : null}
    </div>
  );
}
