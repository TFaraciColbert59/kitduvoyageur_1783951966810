import React from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import type { CarnetHubItem } from '@/features/carnet/hub/types';
import { CarnetHubTopo } from './CarnetHubTopo';
import { liveStatusLabel, miniAriaLabel } from './labels';

/**
 * Bande « En route maintenant » (proposition n° 4) : carrousel horizontal en
 * tête du hub, uniquement quand des carnets sont réellement en cours. Chaque
 * vignette porte la pastille vivante « En route · J4 sur 9 ».
 */
export interface CarnetHubLiveStripProps {
  items: ReadonlyArray<CarnetHubItem>;
}

export function CarnetHubLiveStrip({ items }: CarnetHubLiveStripProps) {
  if (items.length === 0) return null;

  return (
    <section className="lkdh-live-band" aria-label="En route maintenant" data-testid="lkdh-live-band">
      <span className="lkdh-eyebrow">En route maintenant</span>
      <div className="lkdh-strip">
        {items.map((item) => {
          const photo = item.coverImage ?? item.coverPhotos[0] ?? null;
          return (
            <Link
              key={item.id}
              className="lkdh-mini"
              href={`/carnets/${item.id}`}
              aria-label={miniAriaLabel(item)}
              data-testid="lkdh-live-mini"
              data-id={item.id}
            >
              {photo ? (
                <AppImage
                  src={photo}
                  alt=""
                  fill
                  sizes="196px"
                  className="lkdh-mini-img"
                />
              ) : (
                <CarnetHubTopo />
              )}
              <span className="lkdh-mini-veil" aria-hidden="true" />
              <span className="lkdh-mini-body">
                <span className="lkdh-mini-title">{item.title}</span>
                <span className="lkdh-mini-meta">{liveStatusLabel(item)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default CarnetHubLiveStrip;
