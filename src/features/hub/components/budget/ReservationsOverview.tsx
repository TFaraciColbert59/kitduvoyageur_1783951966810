import { BedDouble, Car, Plane, ShoppingCart, Ticket } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, EmptyState } from '@/components/ui';
import type {
  BookingOverviewEntry,
  CartOverviewEntry,
  TripBookingOverview,
} from '../../server/getTripBookingOverview';

/**
 * W6 (P4) — apercu des reservations et du panier dans la section budget.
 *
 * Composant presentatif : il recoit un objet serialisable et ne lit rien. Il
 * est rendu a cote de `TripBudgetView` (vue budget existante, non modifiee) —
 * D-02 interdit de reconstruire le hub.
 *
 * Aucun montant n'est invente : une reservation sans devise confirmee affiche
 * le code devise tel quel, et une table absente ne produit aucun bloc plutot
 * qu'un « 0 EUR » qui ferait croire a un etat mesure.
 */

interface ReservationsOverviewProps {
  overview: TripBookingOverview;
}

const VERTICAL_ICONS: Record<string, ReactNode> = {
  flight: <Plane size={14} aria-hidden="true" />,
  hotel: <BedDouble size={14} aria-hidden="true" />,
  car: <Car size={14} aria-hidden="true" />,
  activity: <Ticket size={14} aria-hidden="true" />,
};

const CART_KIND_LABELS: Record<CartOverviewEntry['kind'], string> = {
  product: 'Boutique',
  booking: 'Réservation',
};

function formatAmount(value: number, currency: string): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function Row({ children }: { children: ReactNode }) {
  return (
    <Card variant="compact" className="flex items-center justify-between gap-[var(--space-2)]">
      {children}
    </Card>
  );
}

export function ReservationsOverview({ overview }: ReservationsOverviewProps) {
  // Aucune source lisible : on ne dessine rien plutôt qu'un bloc vide qui
  // ferait croire à un voyage sans réservation.
  if (!overview.bookingsAvailable && !overview.cartAvailable) return null;


  return (
    <section className="space-y-2.5" aria-label="Réservations et panier">
      {overview.bookingsAvailable ? (
        <div className="space-y-2">
          <h2 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            Réservations
            {overview.reservations.length > 0 ? ` · ${overview.reservations.length}` : ''}
          </h2>
          {overview.reservations.length === 0 ? (
            <EmptyState
              compact
              icon={<Ticket size={18} aria-hidden="true" />}
              title="Aucune réservation"
              description="Les réservations ouvertes depuis le préparateur apparaissent ici."
            />
          ) : (
            <>
              {overview.reservations.map((entry: BookingOverviewEntry) => (
                <Row key={entry.id}>
                  <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                    {VERTICAL_ICONS[entry.vertical] ?? <Ticket size={14} aria-hidden="true" />}
                    <div className="min-w-0">
                      <div className="truncate text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                        {entry.title}
                      </div>
                      <div className="truncate text-[10px] text-[color:var(--lkv-text-secondary)]">
                        {entry.provider}
                        {entry.checkoutChannel ? ` · ${entry.checkoutChannel}` : ''}
                        {entry.status === 'pending' ? ' · en attente' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-[length:var(--lkv-text-footnote)] font-extrabold text-[color:var(--lkv-text-primary)]">
                    {formatAmount(entry.amountEur, entry.currency)}
                  </div>
                </Row>
              ))}
              {overview.pendingEur > 0 ? (
                <p className="text-[10px] text-[color:var(--lkv-text-muted)]">
                  {formatAmount(overview.pendingEur, 'EUR')} en attente — non décomptés du budget
                  tant que la réservation n’est pas confirmée.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {overview.cartAvailable ? (
        <div className="space-y-2">
          <h2 className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            Panier
            {overview.cartTotals.lineCount > 0
              ? ` · ${overview.cartTotals.lineCount} ligne${
                  overview.cartTotals.lineCount > 1 ? 's' : ''
                }`
              : ''}
          </h2>
          {overview.cartLines.length === 0 ? (
            <EmptyState
              compact
              icon={<ShoppingCart size={18} aria-hidden="true" />}
              title="Panier vide"
              description="Les articles et réservations ajoutés depuis le préparateur s’ajoutent ici."
            />
          ) : (
            <>
              {overview.cartLines.map((line: CartOverviewEntry) => (
                <Row key={`${line.kind}:${line.refId}`}>
                  <div className="min-w-0">
                    <div className="truncate text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
                      {line.title ?? CART_KIND_LABELS[line.kind]}
                    </div>
                    <div className="truncate text-[10px] text-[color:var(--lkv-text-secondary)]">
                      {CART_KIND_LABELS[line.kind]}
                      {line.quantity > 1 ? ` · ×${line.quantity}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-[length:var(--lkv-text-footnote)] font-extrabold text-[color:var(--lkv-text-primary)]">
                    {formatAmount(
                      line.unitPriceEur * line.quantity,
                      overview.cartTotals.currency
                    )}
                  </div>
                </Row>
              ))}
              <p className="text-[10px] text-[color:var(--lkv-text-muted)]">
                Total panier {formatAmount(overview.cartTotals.totalEur, overview.cartTotals.currency)}
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default ReservationsOverview;
