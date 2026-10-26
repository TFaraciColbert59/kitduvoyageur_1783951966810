'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { formatDateRange, plural } from '@/components/pays/formatPays';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface TopCarnet {
  id: string;
  title: string;
  destination: string | null;
  cover: string | null;
  likes: number;
  author: string;
  start: string | null;
  end: string | null;
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement des carnets les plus aimés">
      {[0, 1, 2, 3].map((i) => (
        <div className="lkdv-compact-card lkdv-skeleton-card" key={i}>
          <span className="lkdv-info-row__ico lkdv-skeleton-block" />
          <div className="lkdv-compact-card__body">
            <span className="lkdv-skeleton-line" style={{ width: `${68 - i * 6}%` }} />
            <span className="lkdv-skeleton-line lkdv-skeleton-line--short" style={{ width: `${38 + i * 4}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaysTopCarnets({ countryCode, countryName }: { countryCode: string; countryName: string }) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const [rows, setRows] = useState<TopCarnet[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const iso = countryCode.toLowerCase();
    const supabase = createClient();
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('carnets')
          .select('id,title,destination,cover_image,likes_count,author_id,start_date,end_date,country_iso,visibility')
          .eq('visibility', 'public')
          .ilike('country_iso', iso)
          .order('likes_count', { ascending: false })
          .limit(30);
        if (!alive) return;
        if (error || !data) {
          setRows([]);
          setFailed(true);
          return;
        }
        const profiles = await fetchPublicProfilesWith(supabase, data.map((row: any) => row.author_id));
        if (!alive) return;
        setRows(
          data.map((row: any) => ({
            id: row.id as string,
            title: (row.title as string) || 'Carnet sans titre',
            destination: (row.destination as string | null) ?? countryName,
            cover: (row.cover_image as string | null) ?? null,
            likes: Number(row.likes_count ?? 0),
            author: profiles[row.author_id as string]?.full_name || 'Voyageur',
            start: (row.start_date as string | null) ?? null,
            end: (row.end_date as string | null) ?? null,
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
  }, [countryCode, countryName]);

  if (!rows) return <Skeleton />;
  if (failed) {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>Carnets indisponibles</b></div>
        <p className="lkdv-sheet-card__hint">La liste n’a pas pu être chargée. Aucune donnée n’a été inventée.</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>Aucun carnet publié</b></div>
        <p className="lkdv-sheet-card__hint">Sois le premier à raconter ce pays.</p>
        <div className="lkdv-sheet-card__actions">
          <button type="button" className="lkdv-compte-btn primary" onClick={() => router.push('/carnets/nouveau')}>Écrire un carnet</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {rows.map((row, index) => {
        const dates = formatDateRange(row.start, row.end);
        return (
          <button
            key={row.id}
            type="button"
            className="lkdv-compact-card"
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => {
              triggerHaptic('light');
              router.push(`/carnets/${row.id}`);
            }}
            aria-label={`${row.title}, ${row.likes} mentions j’aime`}
          >
            <span className="lkdv-info-row__ico" aria-hidden="true">
              {row.cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- photo réelle du carnet
                <img src={row.cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              )}
            </span>
            <span className="lkdv-compact-card__body">
              <b title={row.title}>{row.title}</b>
              <span title={`${row.author}${dates ? ` · ${dates}` : ''}`}>{row.author}{dates ? ` · ${dates}` : ''}</span>
              <em title={row.destination ?? ''}>{joinMeta(row.destination, plural(row.likes, 'mention', 'mentions'))}</em>
            </span>
            <span className="lkdv-compact-card__tag">{row.likes}</span>
          </button>
        );
      })}
    </div>
  );
}

function joinMeta(destination: string | null, likes: string): string {
  return [destination, likes].filter(Boolean).join(' · ');
}
