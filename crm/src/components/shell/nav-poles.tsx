'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { cx } from '../../ui/cx';
import type { PoleCode } from '../../lib/rpc';

export type NavPole = { code: PoleCode; label: string; count: number | null };

const PILOTAGE = [
  { href: '/equipe', label: 'Équipe et agents IA' },
  { href: '/journal', label: "Journal d'audit" },
  { href: '/reglages', label: 'Réglages' }
];

/** Navigation de gauche : À traiter, 7 pôles avec compteurs, Pilotage, session. */
export function NavPoles({
  poles,
  total,
  teamCount = null,
  sessionCard
}: {
  poles: NavPole[];
  total: number | null;
  teamCount?: number | null;
  sessionCard: React.ReactNode;
}) {
  const pathname = usePathname();
  const onHome = pathname === '/';
  const poleFromPath: Record<string, PoleCode> = {
    '/membres': 'MEMB',
    '/commandes': 'COMM',
    '/catalogue': 'COMM',
    '/contenus': 'CONT',
    '/ia': 'PRIA',
    '/cas': 'CONF',
    '/valider': 'COMM',
    '/reglages': 'PRIA',
    '/technique': 'TECH'
  };
  const entry = Object.entries(poleFromPath).find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const activePole = entry?.[1] ?? (pathname.startsWith('/pole/') ? (pathname.split('/')[2] as PoleCode) : null);

  return (
    <nav className={s.nav} aria-label="Navigation principale">
      <Link href="/" className={cx(s.navItem, onHome && s.navItemOn)} aria-current={onHome ? 'page' : undefined}>
        <span>À traiter</span>
        <span className={cx(s.navCount, onHome && s.navCountOn)}>{total ?? '—'}</span>
      </Link>

      <span className={cx(s.label, s.navGroup)}>Pôles</span>
      {poles.map((pole) => {
        const href = `/pole/${pole.code}`;
        const active = activePole === pole.code;
        return (
          <Link
            key={pole.code}
            href={href}
            className={cx(s.navItem, active && s.navItemOn)}
            aria-current={active ? 'page' : undefined}
          >
            <span>{pole.label}</span>
            <span className={cx(s.navCount, active && s.navCountOn)}>{pole.count ?? '—'}</span>
          </Link>
        );
      })}

      <span className={cx(s.label, s.navGroup)}>Pilotage</span>
      {PILOTAGE.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(s.navItem, active && s.navItemOn)}
            aria-current={active ? 'page' : undefined}
          >
            <span>{item.label}</span>
            {item.href === '/equipe' && teamCount !== null ? (
              <span className={cx(s.navCount, active && s.navCountOn)}>{teamCount}</span>
            ) : null}
          </Link>
        );
      })}

      {sessionCard ? <div key="session-card">{sessionCard}</div> : null}
    </nav>
  );
}
