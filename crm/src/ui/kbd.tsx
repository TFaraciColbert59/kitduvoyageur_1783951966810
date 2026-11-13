import type { ReactNode } from 'react';
import s from './crm.module.css';

/** Touche affichée à côté d'un bouton (le raccourci réel est câblé plus haut). */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}
