'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { plural } from '@/components/pays/formatPays';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface TopClub {
  id: string;
  slug: string | null;
  name: string;
  members: number;
  emoji: string | null;
  cover: string | null;
  verified: boolean;
  active: number;
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement des groupes les plus connus">
      {[0, 1, 2, 3].map((i) => (
        <div className="lkdv-compact-card lkdv-skeleton-card" key={i}>
          <span className="lkdv-info-row__ico lkdv-skeleton-block" />
          <div className="lkdv-compact-card__body">
            <span className="lkdv-skeleton-line" style={{ width: `${64 - i * 5}%` }} />
            <span className="lkdv-skeleton-line lkdv-skeleton-line--short" style={{ width: `${36 + i * 4}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaysTopClubs({ countryCode, countryName }: { countryCode: string; countryName: string }) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const [rows, setRows] = useState<TopClub[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('clubs')
          .select('id,slug,name,members_count,emoji,cover_color,is_verified,active_this_month,country_iso')
          .ilike('country_iso', countryCode.toLowerCase())
          .order('members_count', { ascending: false })
          .limit(10);
        if (!alive) return;
        if (error || !data) {
          setRows([]);
          setFailed(true);
          return;
        }
        setRows(
          data.map((row: any) => ({
            id: row.id as string,
            slug: (row.slug as string | null) ?? null,
            name: (row.name as string) || 'Club sans nom',
            members: Number(row.members_count ?? 0),
            emoji: (row.emoji as string | null) ?? null,
            cover: (row.cover_color as string | null) ?? null,
            verified: Boolean(row.is_verified),
            active: Number(row.active_this_month ?? 0),
          })),
        );
      } catch {
        if (alive) {
          setRows([]);
          setFailed(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [countryCode]);

  if (!rows) return <Skeleton />;
  if (failed) {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>Groupes indisponibles</b></div>
        <p className="lkdv-sheet-card__hint">La liste n’a pas pu être chargée. Aucune donnée n’a été inventée.</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>Aucun groupe enregistré</b></div>
        <p className="lkdv-sheet-card__hint">Aucun groupe n’est encore associé à {countryName}.</p>
        <div className="lkdv-sheet-card__actions">
          <button type="button" className="lkdv-compte-btn ghost" onClick={() => router.push('/clubs')}>Explorer les clubs</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="lkdv-compact-card"
          style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => {
            triggerHaptic('light');
            router.push(row.slug ? `/clubs/${row.slug}` : '/clubs');
          }}
          aria-label={`${row.name}, ${row.members} membres`}
        >
          <span className="lkdv-info-row__ico" aria-hidden="true" style={row.cover ? { background: row.cover } : undefined}>
            {row.emoji ?? '◍'}
          </span>
          <span className="lkdv-compact-card__body">
            <b title={row.name}>{row.name}</b>
            <span title={plural(row.members, 'membre', 'membres')}>{plural(row.members, 'membre', 'membres')}</span>
            <em>{[row.verified ? 'Vérifié' : null, row.active > 0 ? 'Actif ce mois' : null].filter(Boolean).join(' · ') || 'Groupe local'}</em>
          </span>
          <span className="lkdv-compact-card__tag">{row.members}</span>
        </button>
      ))}
    </div>
  );
}
