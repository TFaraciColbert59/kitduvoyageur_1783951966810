'use client';
import { CardsView, type CardsViewProps } from './CardsView';

/** Emplacement du contenu du tiroir en vue Cartes : la scène peut fournir projectZone / highlightZone. */
export function CardsSlot(props: CardsViewProps) {
  return <CardsView {...props} />;
}
