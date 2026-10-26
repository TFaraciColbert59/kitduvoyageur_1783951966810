'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizeTripHistory, type PaysTripSource } from '@/components/pays/paysDrawerData';
import { formatDateRange } from '@/components/pays/formatPays';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

type HistoryState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'failed' }
  | { status: 'ready'; rows: ReturnType<typeof normalizeTripHistory> };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  active: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement de ton historique dans ce pays">
      {[0, 1].map((i) => (
        <div className="lkdv-compact-card lkdv-skeleton-card" key={i}>
          <span className="lkdv-info-row__ico lkdv-skeleton-block" />
          <div className="lkdv-compact-card__body">
            <span className="lkdv-skeleton-line" style={{ width: `${66 - i * 8}%` }} />
            <span className="lkdv-skeleton-line lkdv-skeleton-line--short" style={{ width: `${40 + i * 6}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaysHistoryPane({ countryCode, countryName }: { countryCode: string; countryName: string }) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();
  const [state, setState] = useState<HistoryState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const iso = countryCode.toUpperCase();

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user ?? null;
        if (!user) {
          if (alive) setState({ status: 'guest' });
          return;
        }
        const columns = 'id,slug,title,destination_name,destination_country_code,start_date,end_date,status';
        const [{ data: owned, error: ownedError }, { data: shared, error: sharedError }] = await Promise.all([
          supabase.from('trips').select(columns).eq('user_id', user.id).eq('destination_country_code', iso),
          supabase
            .from('trip_collaborators')
            .select(`trips(${columns})`)
            .eq('user_id', user.id),
        ]);
        if (!alive) return;
        if (ownedError || sharedError) {
          setState({ status: 'failed' });
          return;
        }
        const sharedRows = ((shared ?? []) as Array<{ trips: PaysTripSource | PaysTripSource[] | null }>)
          .map((link) => (Array.isArray(link.trips) ? link.trips[0] : link.trips))
          .filter((row): row is PaysTripSource => row !== null && Boolean(row.id) && (row.destination_country_code ?? '').toUpperCase() === iso);
        setState({
          status: 'ready',
          rows: normalizeTripHistory((owned ?? []) as PaysTripSource[], sharedRows),
        });
      } catch {
        if (alive) setState({ status: 'failed' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [iso, attempt]);

  if (state.status === 'loading') return <Skeleton />;
  if (state.status === 'failed') {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>Historique indisponible</b></div>
        <p className="lkdv-sheet-card__hint">Tes voyages n’ont pas pu être lus. Aucune donnée n’a été inventée.</p>
        <div className="lkdv-sheet-card__actions">
          <button type="button" className="lkdv-compte-btn ghost" onClick={() => setAttempt((n) => n + 1)}>Réessayer</button>
        </div>
      </div>
    );
  }
  if (state.status === 'guest' || state.rows.length === 0) {
    return (
      <div className="lkdv-sheet-card" role="status">
        <div className="lkdv-sheet-card__head"><b>{state.status === 'guest' ? 'Connecte-toi pour retrouver tes passages' : `Aucun passage enregistré en ${countryName}`}</b></div>
        <p className="lkdv-sheet-card__hint">
          {state.status === 'guest'
            ? 'Ton historique personnel s’affichera ici après connexion.'
            : 'Crée ton premier passage : un voyage à préparer ou un carnet à raconter.'}
        </p>
        <div className="lkdv-sheet-card__actions">
          <button
            type="button"
            className="lkdv-compte-btn primary"
            onClick={() => {
              triggerHaptic('selection');
              router.push('/compas');
            }}
          >
            Créer un voyage
          </button>
          <button
            type="button"
            className="lkdv-compte-btn ghost"
            onClick={() => {
              triggerHaptic('selection');
              router.push('/carnets/nouveau');
            }}
          >
            Créer un carnet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {state.rows.map((row) => {
        const dates = formatDateRange(row.start, row.end);
        const status = row.status ? STATUS_LABEL[row.status] ?? row.status : null;
        return (
          <button
            key={row.id}
            type="button"
            className="lkdv-compact-card"
            style={{ width: '100%', textAlign: 'left', cursor: row.slug ? 'pointer' : 'default' }}
            disabled={!row.slug}
            onClick={() => {
              if (!row.slug) return;
              triggerHaptic('light');
              router.push(`/voyages/${row.slug}`);
            }}
            aria-label={`${row.title}${dates ? `, ${dates}` : ''}`}
          >
            <span className="lkdv-info-row__ico" aria-hidden="true">◍</span>
            <span className="lkdv-compact-card__body">
              <b title={row.title}>{row.title}</b>
              <span>{[dates, row.destination].filter(Boolean).join(' · ') || countryName}</span>
              {status ? <em>{status}</em> : null}
            </span>
            <span className="lkdv-compact-card__tag">{status ?? 'Voyage'}</span>
          </button>
        );
      })}
    </div>
  );
}
