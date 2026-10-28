'use client';

import React from 'react';
import Link from 'next/link';
import { Search as SearchIcon, X } from 'lucide-react';
import { DrawerEmpty } from '@/components/compte/drawer/shell/DrawerShell';
import {
  kindLabel,
  paginate,
  RESULTS_PER_PAGE,
  SEARCH_KINDS,
  SEARCH_MIN_CHARS,
  type SearchResult,
} from '@/features/community/sections/search';
import { Carousel } from './Carousel';
import type { CarnetRow } from '@/features/community/sections/useCommunitySections';
import { CarnetTile } from './CarnetTile';
import { ExplorerCard, ExplorerMini, itemKey, type ExplorerItem } from './ExplorerCard';

const toneOf = (kind: SearchResult['kind']) =>
  SEARCH_KINDS.find((entry) => entry.id === kind)?.tone ?? '#17402C';

/* --- Recherche ------------------------------------------------------------------- */

export function SearchPane({
  query,
  onQuery,
  results,
  searching,
  recents,
  onRemoveRecent,
  autoFocus,
  onNavigate,
  resetKey,
}: {
  query: string;
  onQuery: (value: string) => void;
  results: SearchResult[];
  searching: boolean;
  recents: string[];
  onRemoveRecent: (value: string) => void;
  autoFocus: boolean;
  onNavigate: () => void;
  resetKey: string;
}) {
  const ready = query.trim().length >= SEARCH_MIN_CHARS;
  const pages = paginate(results, RESULTS_PER_PAGE);

  return (
    <div className="lkdv-ex-pane">
      <div className="lkdv-ex-search" role="search">
        <SearchIcon size={17} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Posts, carnets, clubs, sorties, membres…"
          aria-label="Rechercher dans toute la communauté"
          data-autofocus={autoFocus ? 'true' : undefined}
        />
        {query ? (
          <button type="button" aria-label="Effacer la recherche" onClick={() => onQuery('')}>
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {!ready ? (
        recents.length > 0 ? (
          <div className="lkdv-ex-recents">
            <span className="lkdv-wz-label">Récentes</span>
            <div className="lkdv-wz-chips">
              {recents.slice(0, 6).map((entry) => (
                <span key={entry} className="lkdv-ex-recent">
                  <button type="button" onClick={() => onQuery(entry)}>
                    {entry}
                  </button>
                  <button
                    type="button"
                    aria-label={`Retirer « ${entry} » des recherches récentes`}
                    onClick={() => onRemoveRecent(entry)}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <DrawerEmpty
            title="Tout trouver"
            hint="Un post, un carnet, un club, une sortie ou un membre."
          />
        )
      ) : searching && results.length === 0 ? (
        <p className="lkdv-ex-note" role="status">
          Recherche…
        </p>
      ) : results.length === 0 ? (
        <DrawerEmpty
          title={`Rien pour « ${query.trim()} »`}
          hint="Essaie un autre mot, ou change le filtre en bas à droite."
          action={
            <button type="button" className="lkdv-ex-secondary" onClick={() => onQuery('')}>
              Effacer la recherche
            </button>
          }
        />
      ) : (
        <>
          <p className="lkdv-ex-count" role="status" aria-live="polite">
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </p>
          <Carousel
            label="Résultats de recherche"
            resetKey={resetKey}
            pages={pages.map((page, pageIndex) => (
              <ul key={pageIndex} className="lkdv-ex-results">
                {page.map((result) => (
                  <li key={`${result.kind}-${result.id}`}>
                    <Link href={result.href} className="lkdv-ex-result" onClick={onNavigate}>
                      <span className="lkdv-ex-result-cover" aria-hidden="true">
                        {result.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- couvertures distantes
                          <img src={result.cover} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <b>{result.title.charAt(0).toUpperCase()}</b>
                        )}
                      </span>
                      <span className="lkdv-ex-result-txt">
                        <b>{result.title}</b>
                        <small>{result.meta}</small>
                      </span>
                      <span
                        className="lkdv-ex-kind"
                        style={{ '--tone': toneOf(result.kind) } as React.CSSProperties}
                      >
                        {kindLabel(result.kind)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          />
        </>
      )}
    </div>
  );
}

/* --- Pour toi --------------------------------------------------------------------- */

export interface Rail {
  kind: ExplorerItem['kind'];
  title: string;
  items: ExplorerItem[];
  empty: string;
}

export function ForYouPane({
  rails,
  onOpen,
  onSeeAll,
}: {
  rails: Rail[];
  onOpen: (item: ExplorerItem) => void;
  onSeeAll: (kind: Rail['kind']) => void;
}) {
  if (rails.every((rail) => rail.items.length === 0)) {
    return (
      <DrawerEmpty
        title="Rien à te montrer pour l’instant"
        hint="Les carnets, clubs et sorties de la communauté apparaîtront ici."
      />
    );
  }
  return (
    <div className="lkdv-ex-pane lkdv-ex-rails">
      {rails.map((rail) => (
        <section key={rail.kind} className="lkdv-ex-rail" aria-label={rail.title}>
          <header>
            <h3>{rail.title}</h3>
            {rail.items.length > 0 ? (
              <button type="button" onClick={() => onSeeAll(rail.kind)}>
                Tout voir
              </button>
            ) : null}
          </header>
          {rail.items.length === 0 ? (
            <p className="lkdv-ex-note">{rail.empty}</p>
          ) : (
            <div className="lkdv-ex-rail-track">
              {rail.items.map((item) => (
                <ExplorerMini key={itemKey(item)} item={item} onOpen={() => onOpen(item)} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/* --- Carnets · Clubs · Sorties : une grande carte à la fois ------------------------ */

export function ListPane({
  label,
  items,
  mine,
  emptyTitle,
  emptyHint,
  onOpen,
  onAction,
  onPropose,
  onLikeCarnet,
  onNavigate,
  resetKey,
}: {
  label: string;
  items: ExplorerItem[];
  mine: boolean;
  emptyTitle: string;
  emptyHint: string;
  onOpen: (item: ExplorerItem) => void;
  onAction: (item: ExplorerItem) => void;
  onPropose: () => void;
  onLikeCarnet: (carnet: CarnetRow) => void;
  onNavigate: () => void;
  resetKey: string;
}) {
  if (items.length === 0) {
    return (
      <DrawerEmpty
        title={mine ? emptyTitle : 'Rien à découvrir pour l’instant'}
        hint={mine ? emptyHint : 'Reviens plus tard, ou propose le premier.'}
        action={
          <button type="button" className="lkdv-ex-primary" onClick={onPropose}>
            Proposer
          </button>
        }
      />
    );
  }
  const carnets = items.filter(
    (item): item is Extract<ExplorerItem, { kind: 'carnet' }> => item.kind === 'carnet'
  );
  if (carnets.length === items.length) {
    // Carnets : quatre tuiles par page (2 × 2), bien espacées, image en fond.
    const pages: Array<typeof carnets> = [];
    for (let i = 0; i < carnets.length; i += 4) pages.push(carnets.slice(i, i + 4));
    return (
      <div className="lkdv-ex-pane">
        <Carousel
          label={label}
          resetKey={resetKey}
          pages={pages.map((page, index) => (
            <ul key={index} className="lkdv-ct-grid">
              {page.map((item) => (
                <li key={item.row.id}>
                  <CarnetTile carnet={item.row} onLike={onLikeCarnet} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          ))}
        />
      </div>
    );
  }
  return (
    <div className="lkdv-ex-pane">
      <Carousel
        label={label}
        resetKey={resetKey}
        pages={items.map((item) => (
          <ExplorerCard
            key={itemKey(item)}
            item={item}
            onOpen={() => onOpen(item)}
            onAction={() => onAction(item)}
          />
        ))}
      />
    </div>
  );
}
