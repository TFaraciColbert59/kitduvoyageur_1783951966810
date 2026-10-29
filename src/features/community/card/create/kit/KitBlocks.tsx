'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { Carousel } from '@/features/community/card/explore/Carousel';
import { chunk } from './catalog';
import type { KitSlot } from './types';

const PER_PAGE = 6;

/**
 * Les blocs du kit : un bloc par élément choisi, et toujours un bloc « + » à la suite.
 * Vide, le « + » est seul au milieu ; une fois un produit choisi, un nouveau « + » apparaît
 * à côté — on ajoute ainsi autant d'éléments qu'on veut. Six blocs par page, page balayée.
 */
export function KitBlocks({
  slots,
  onAdd,
  onRemove,
}: {
  slots: readonly KitSlot[];
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  type Cell = { kind: 'slot'; slot: KitSlot } | { kind: 'add' };
  const cells: Cell[] = [
    ...slots.map((slot) => ({ kind: 'slot' as const, slot })),
    { kind: 'add' as const },
  ];
  const pages = chunk(cells, PER_PAGE);

  return (
    <Carousel
      label="Éléments du kit"
      scrollToPage={pages.length - 1}
      pages={pages.map((page, pageIndex) => (
        <ul
          key={pageIndex}
          className="lkdv-kb-grid"
          data-alone={cells.length === 1 ? 'true' : 'false'}
        >
          {page.map((cell) =>
            cell.kind === 'add' ? (
              <li key="add">
                <button
                  type="button"
                  className="lkdv-kb-tile lkdv-kb-add"
                  onClick={onAdd}
                  aria-label="Ajouter un élément au kit"
                >
                  <Icon name="plus" size={cells.length === 1 ? 30 : 22} aria-hidden="true" />
                </button>
              </li>
            ) : (
              <li key={cell.slot.key}>
                <div className="lkdv-kb-tile lkdv-kb-filled">
                  {cell.slot.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- images de catalogue distantes
                    <img src={cell.slot.image} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <b aria-hidden="true">{cell.slot.name.charAt(0).toUpperCase()}</b>
                  )}
                  <span className="lkdv-kb-name">{cell.slot.name}</span>
                  <button
                    type="button"
                    className="lkdv-kb-remove"
                    aria-label={`Retirer ${cell.slot.name} du kit`}
                    onClick={() => onRemove(cell.slot.key)}
                  >
                    <Icon name="x" size={12} aria-hidden="true" />
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      ))}
    />
  );
}

export default KitBlocks;
