'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import s from '@/ui/crm.module.css';
import { Chip } from '@/ui/chip';
import { Countdown } from '@/ui/countdown';
import { Label } from '@/ui/card';
import { Tabs, type TabDef } from '@/ui/tabs';
import { Workspace } from '@/components/shell/workspace';
import { POLE_LABELS } from '@/components/command/catalog';
import type { InboxItem, InboxPayload } from '@/lib/rpc';
import { QueueList, matchesFilter, type QueueFilter } from './queue-list';

/**
 * Écran « À traiter » (maquette `Main.dc.html`) : en-tête, filtres, file, rail.
 * Tous les chiffres viennent de `admin.inbox()` ; une valeur absente s'affiche
 * « non renseigné ».
 */
export function QueueScreen({
  items,
  now,
  counts,
  sla
}: {
  items: InboxItem[];
  now: string;
  counts: InboxPayload['counts'] | null;
  sla: InboxPayload['sla'] | null;
}) {
  const [filter, setFilter] = useState<QueueFilter>('tout');
  const [cursor, setCursor] = useState(0);

  const computed = useMemo(() => {
    const by = (value: QueueFilter) => items.filter((item) => matchesFilter(item, value)).length;
    return {
      tout: counts?.total ?? items.length,
      urgent: counts?.urgent ?? by('urgent'),
      signalements: counts?.reports ?? by('signalements'),
      a_valider: counts?.approvals ?? by('a_valider'),
      contributions: counts?.contributions ?? by('contributions')
    };
  }, [items, counts]);

  const tabs: TabDef[] = [
    { id: 'tout', label: 'Tout', badge: computed.tout },
    { id: 'urgent', label: 'Urgent', badge: computed.urgent },
    { id: 'signalements', label: 'Signalements', badge: computed.signalements },
    { id: 'a_valider', label: 'À valider', badge: computed.a_valider },
    { id: 'contributions', label: 'Contributions', badge: computed.contributions }
  ];

  const filtered = items.filter((item) => matchesFilter(item, filter));
  const selected = filtered[cursor] ?? null;

  const soon = items.filter((item) => item.group === 'delai_bientot').length;
  const held = sla?.held_days;
  const treated = sla?.treated_today;
  const target = sla?.target_today;
  const ratio = treated !== undefined && target ? Math.min(100, Math.round((treated / target) * 100)) : null;

  return (
    <Workspace rail={<QueueRail item={selected} now={now} />}>
      <div className={s.between} style={{ alignItems: 'flex-end' }}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.title}>À traiter</h1>
          <span className={s.subtitle}>
            {computed.tout} élément{computed.tout > 1 ? 's' : ''} · {computed.urgent} urgence{computed.urgent > 1 ? 's' : ''} haute
            {computed.urgent > 1 ? 's' : ''} · {soon} délai{soon > 1 ? 's' : ''} proche{soon > 1 ? 's' : ''} · file tenue{' '}
            <strong style={{ color: 'var(--sage-800)' }}>
              {held === undefined ? 'non renseigné' : `${held} jour${held > 1 ? 's' : ''} d’affilée`}
            </strong>
          </span>
        </div>
        <div className={s.col} style={{ gap: 6, minWidth: 260 }}>
          <span className={s.between} style={{ fontSize: 12 }}>
            <span className={s.muted}>Aujourd’hui</span>
            <strong>{treated === undefined || target === undefined ? 'non renseigné' : `${treated} traités sur ${target}`}</strong>
          </span>
          <span className={s.progress}>
            <span className={s.progressFill} style={{ width: `${ratio ?? 0}%` }} />
          </span>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        value={filter}
        ariaLabel="Filtres de la file"
        onChange={(id) => {
          setFilter(id as QueueFilter);
          setCursor(0);
        }}
      />

      <QueueList items={items} now={now} filter={filter} cursor={cursor} onCursorChange={setCursor} />
    </Workspace>
  );
}

function QueueRail({ item, now }: { item: InboxItem | null; now: string }) {
  return (
    <>
      <Label>Contexte de l’élément sélectionné</Label>
      <div className={`${s.card} ${s.railCard}`}>
        {item ? (
          <>
            <strong style={{ fontSize: 14 }}>{item.title}</strong>
            <span className={s.muted} style={{ fontSize: 12.5 }}>
              {item.subtitle}
            </span>
            <div className={s.rowFlexWrap}>
              <Chip tone="stone">{POLE_LABELS[item.pole] ?? item.pole}</Chip>
              {item.urgency === 'haute' ? <Chip tone="danger">Urgence haute</Chip> : null}
              {item.due_at ? <Countdown dueAt={item.due_at} initialNow={now} /> : <Chip tone="stone">Délai : non renseigné</Chip>}
            </div>
            <Link href={`/cas/${item.source}/${item.id}`} style={{ fontWeight: 600, fontSize: 13 }}>
              Ouvrir le cas complet →
            </Link>
          </>
        ) : (
          <span className={s.muted} style={{ fontSize: 13 }}>
            Aucun élément sélectionné. Utilisez <strong>J</strong> et <strong>K</strong> pour parcourir la file.
          </span>
        )}
      </div>

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Règle concernée</Label>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Elle s’affiche sur la carte de décision du cas, avec l’échelle des sanctions.
        </span>
      </div>

      <div className={`${s.card} ${s.railCard}`}>
        <Label>Cas liés</Label>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Les autres cas du même auteur apparaissent sur la carte de décision.
        </span>
      </div>

      <div className={`${s.card} ${s.railCard}`} style={{ background: 'var(--lkv-sage-50)' }}>
        <Label>Suggestion de l’IA</Label>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Elle s’affiche après que vous avez vu le contenu, pour ne pas orienter votre lecture.
        </span>
      </div>
    </>
  );
}
