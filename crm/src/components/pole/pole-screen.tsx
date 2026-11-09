'use client';

import { useState } from 'react';
import s from '@/ui/crm.module.css';
import { Button } from '@/ui/button';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/states';
import { Tabs, TabPanel } from '@/ui/tabs';
import { TextInput } from '@/ui/field';
import type { InboxItem, PoleCode, StaffContext } from '@/lib/rpc';
import { QueueList } from '@/components/queue/queue-list';
import { POLE_LABELS, type CatalogCommand } from '@/components/command/catalog';
import { CommandDrawer } from '@/components/command/command-drawer';

/**
 * Pôle (maquette `Main.dc.html` filtrée) : onglets File, Rechercher, Réglages du pôle.
 * Toutes les actions du pôle sont listées et exécutables depuis cet écran.
 */
export function PoleScreen({
  code,
  items,
  commands,
  ctx,
  now
}: {
  code: PoleCode;
  items: InboxItem[];
  commands: CatalogCommand[];
  ctx: StaffContext | null;
  now: string;
}) {
  const [tab, setTab] = useState('file');
  const [cursor, setCursor] = useState(0);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState<CatalogCommand | null>(null);

  const label = POLE_LABELS[code] ?? code;
  const searchResults = items.filter((item) =>
    query.trim() ? `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase()) : true
  );
  const commandResults = commands.filter((command) =>
    query.trim() ? `${command.label} ${command.command}`.toLowerCase().includes(query.toLowerCase()) : true
  );

  return (
    <>
      <div className={s.between} style={{ alignItems: 'flex-end' }}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.title}>{label}</h1>
          <span className={s.subtitle}>
            {items.length} élément{items.length > 1 ? 's' : ''} dans ce pôle · {commands.length} action
            {commands.length > 1 ? 's' : ''} disponibles
          </span>
        </div>
        <div className={s.rowFlexWrap}>
          {ctx?.poles?.find((pole) => pole.code === code) ? (
            <Chip tone="sage">Votre rôle : {ctx.poles.find((pole) => pole.code === code)?.role}</Chip>
          ) : (
            <Chip tone="stone">Hors de votre périmètre</Chip>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'file', label: 'File', badge: items.length },
          { id: 'rechercher', label: 'Rechercher' },
          { id: 'reglages', label: 'Actions du pôle', badge: commands.length }
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Sections du pôle"
      />

      <TabPanel active={tab === 'file'}>
        <QueueList items={items} now={now} filter="tout" cursor={cursor} onCursorChange={setCursor} />
      </TabPanel>

      <TabPanel active={tab === 'rechercher'}>
        <TextInput
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher dans ce pôle…"
          aria-label="Chercher dans ce pôle"
        />
        <div className={s.card}>
          {searchResults.length === 0 ? (
            <EmptyState title="Aucun élément ne correspond">Essayez un autre mot, ou videz la recherche.</EmptyState>
          ) : (
            searchResults.slice(0, 30).map((item) => (
              <a key={item.key} className={s.row} href={`/cas/${item.source}/${item.id}`}>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{item.title}</span>
                  <span className={s.rowSub}>{item.subtitle}</span>
                </span>
                <Chip tone="stone">{item.group}</Chip>
              </a>
            ))
          )}
        </div>
      </TabPanel>

      <TabPanel active={tab === 'reglages'}>
        <div className={s.card} style={{ padding: '6px 16px' }}>
          {commandResults.length === 0 ? (
            <EmptyState title="Aucune action ne correspond">
              Les actions de ce pôle viennent du registre ; rien n’est inventé.
            </EmptyState>
          ) : (
            commandResults.map((command) => (
              <div key={command.command} className={s.row} style={{ cursor: 'default' }}>
                <span className={s.rowMain}>
                  <span className={s.rowTitle}>{command.label}</span>
                  <span className={s.rowSub}>
                    {command.id} · {command.command}
                  </span>
                </span>
                <span className={s.rowFlexWrap}>
                  {command.needsValidation ? <Chip tone="info">2 personnes</Chip> : null}
                  {command.reasonRequired ? <Chip tone="warn">Motif</Chip> : null}
                </span>
                <Button tone="soft" size="sm" onClick={() => setDrawer(command)}>
                  Ouvrir
                </Button>
              </div>
            ))
          )}
        </div>
      </TabPanel>

      <CommandDrawer open={drawer !== null} command={drawer} ctx={ctx} onClose={() => setDrawer(null)} />
    </>
  );
}
