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
  image: string | null;
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
          .select('id,slug,name,members_count,emoji,cover_color,cover_image,is_verified,active_this_month,country_iso')
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
            image: (row.cover_image as string | null) ?? null,
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
    <div className="ig-voyages-tab" role="region" aria-label={`Groupes les plus connus en ${countryName}`}>
      <div className="voyages-carousel" data-hscroll>
        {rows.map((row) => {
          const status = [row.verified ? 'Vérifié' : null, row.active > 0 ? 'Actif ce mois' : null].filter(Boolean).join(' · ') || 'Groupe local';
          return (
            <button
              key={row.id}
              type="button"
              className="voyage-card"
              onClick={() => {
                triggerHaptic('light');
                router.push(row.slug ? `/clubs/${row.slug}` : '/clubs');
              }}
              aria-label={`${row.name}, ${plural(row.members, 'membre', 'membres')}, ${status}`}
            >
              <span className="voyage-cover">
                {row.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- visuel réel du club
                  <img src={row.image} alt="" className="voyage-img" loading="lazy" />
                ) : (
                  <span className="voyage-cover-fallback" aria-hidden="true" style={row.cover ? { background: row.cover } : undefined}>
                    {row.emoji ?? '◍'}
                  </span>
                )}
                <span className="voyage-cover-overlay" />
                <span className="voyage-chip-gps">{status}</span>
                <span className="voyage-info">
                  <b className="voyage-title">{row.name}</b>
                  <span className="voyage-sub">{countryName}</span>
                  <span className="voyage-metrics">
                    <span className="vm-item"><b>{plural(row.members, 'membre', 'membres')}</b></span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
