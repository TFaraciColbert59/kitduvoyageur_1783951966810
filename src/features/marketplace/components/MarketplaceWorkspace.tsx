'use client';
import { useCallback, useEffect, useState } from 'react';
import { MarketplaceModeration } from './MarketplaceModeration';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card } from '@/components/ui';
import type { InventoryItem } from '@/features/materiel/services/getInventory';
import { getInventoryStatus } from '@/features/materiel/domain/inventory';
import type { MarketplaceListing, MarketplaceTransaction, TransactionAction } from '../types';
import { FIELD, Feedback, ManualNotice, SignIn, money, request } from './shared';

const STATUS = {
  requested: 'Demandée',
  accepted: 'Acceptée',
  active: 'Remise effectuée',
  return_pending: 'Retour déclaré',
  completed: 'Terminée',
  cancelled: 'Annulée',
  disputed: 'En litige',
};
export function transactionActions(
  tx: MarketplaceTransaction,
  userId: string
): { action: TransactionAction; label: string }[] {
  const owner = tx.owner_id === userId;
  const buyer = tx.buyer_id === userId;
  if (!owner && !buyer) return [];
  const result: { action: TransactionAction; label: string }[] = [];
  if (tx.status === 'requested' && owner)
    result.push({ action: 'accept', label: 'Accepter la demande' });
  if (tx.status === 'accepted' && owner)
    result.push({
      action: 'handover',
      label:
        tx.mode === 'vente'
          ? 'Confirmer la vente et la remise irréversibles'
          : 'Confirmer la remise du matériel',
    });
  if (tx.status === 'active' && buyer)
    result.push({
      action: tx.mode === 'vente' ? 'receive' : 'return',
      label: tx.mode === 'vente' ? 'Confirmer la réception' : 'Déclarer le retour du matériel',
    });
  if (tx.status === 'return_pending' && owner)
    result.push({ action: 'complete_return', label: 'Confirmer le retour reçu' });
  if (['requested', 'accepted'].includes(tx.status))
    result.push({ action: 'cancel', label: 'Annuler l’accord' });
  if (['active', 'return_pending'].includes(tx.status))
    result.push({ action: 'dispute', label: 'Déclarer un litige' });
  return result;
}
function Transaction({
  tx,
  userId,
  onChanged,
}: {
  tx: MarketplaceTransaction;
  userId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const act = async (body: unknown) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await request<{ transaction: MarketplaceTransaction }>(
        `/api/marketplace/transactions/${tx.id}/actions`,
        body
      );
      if (!data.transaction?.id) throw new Error('Action non confirmée.');
      setMessage('État enregistré.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action indisponible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">
        {tx.listing_snapshot.name} · {STATUS[tx.status]}
      </h3>
      <p>
        {tx.owner_id === userId
          ? 'Vous êtes le propriétaire'
          : 'Vous êtes l’acquéreur / emprunteur'}{' '}
        · {tx.mode}
      </p>
      <p>
        Prix convenu : {money(tx.price_cents)}
        {tx.mode === 'location' ? ' / jour' : ''} · Caution : {money(tx.deposit_cents)}
      </p>
      {tx.start_date && (
        <p>
          Période : {tx.start_date} → {tx.end_date}
        </p>
      )}
      {tx.tracking_code && <p>Suivi communiqué : {tx.tracking_code}</p>}
      {transactionActions(tx, userId).length > 0 && (
        <>
          <label className="block">
            Note de suivi (obligatoire pour un litige)
            <textarea
              className={FIELD}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {tx.status === 'accepted' && tx.owner_id === userId && (
            <>
              <label className="block">
                Référence de transport (facultative)
                <input
                  className={FIELD}
                  maxLength={100}
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </label>
              {tx.mode === 'vente' && (
                <p>
                  Cette confirmation marque votre objet comme vendu. Elle ne confirme aucun paiement
                  et ne peut pas être annulée dans ce suivi.
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {transactionActions(tx, userId).map(({ action, label }) => (
              <Button
                key={action}
                disabled={busy}
                variant={action === 'cancel' || action === 'dispute' ? 'secondary' : 'primary'}
                onClick={() => {
                  if (action === 'dispute' && note.trim().length < 10) {
                    setError('Décrivez le litige en au moins 10 caractères.');
                    return;
                  }
                  void act({
                    action,
                    note: note || undefined,
                    tracking_code: tracking || undefined,
                  });
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </>
      )}
      {tx.status === 'disputed' && (
        <p>Le matériel reste indisponible jusqu’à une résolution documentée par la modération.</p>
      )}
      {tx.status === 'completed' && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const data = await request<{ review: { id: string } }>('/api/marketplace/reviews', {
                transaction_id: tx.id,
                rating: Number(rating),
                comment,
              });
              if (!data.review?.id) throw new Error('Avis non confirmé.');
              setMessage('Avis enregistré. Un seul avis est autorisé par participant.');
              setComment('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Avis indisponible.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <h4 className="font-semibold">Avis sur cette transaction terminée</h4>
          <label className="block">
            Note
            <select className={FIELD} value={rating} onChange={(e) => setRating(e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Commentaire public
            <textarea
              className={FIELD}
              required
              minLength={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <Button type="submit" loading={busy}>
            Publier mon avis
          </Button>
        </form>
      )}
      <Feedback error={error} message={message} />
    </Card>
  );
}
export function MarketplaceWorkspace({ items }: { items: InventoryItem[] }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [transactions, setTransactions] = useState<MarketplaceTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [itemId, setItemId] = useState('');
  const [description, setDescription] = useState('');
  const [town, setTown] = useState('');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('0');
  const eligible = items.filter(
    (i) =>
      i.quantity === 1 &&
      ['vente', 'location', 'pret'].includes(i.listing_mode ?? '') &&
      ['en_stock', 'a_louer', 'a_preter'].includes(getInventoryStatus(i))
  );
  const selected = eligible.find((i) => i.id === itemId);
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [a, b] = await Promise.all([
        request<{ listings: MarketplaceListing[] }>('/api/marketplace/listings?mine=true'),
        request<{ transactions: MarketplaceTransaction[] }>('/api/marketplace/transactions'),
      ]);
      setListings(a.listings);
      setTransactions(b.transactions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suivi indisponible.');
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const changed = () => {
    void refresh();
    router.refresh();
  };
  return (
    <section id="marketplace" className="space-y-5 text-[color:var(--glass-label)]">
      <h2 className="text-2xl font-semibold">Annonces et transactions</h2>
      <ManualNotice />
      <div className="flex gap-5">
        <Link className="underline min-h-11 inline-flex items-center" href="/occasion">
          Voir les ventes
        </Link>
        <Link className="underline min-h-11 inline-flex items-center" href="/location">
          Voir les locations et prêts
        </Link>
      </div>
      {authLoading ? (
        <p role="status">Chargement du compte…</p>
      ) : !user ? (
        <SignIn next="/hub/inventaire#marketplace" />
      ) : (
        <>
          <Card>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                setMessage('');
                try {
                  if (!selected)
                    throw new Error('Sélectionnez un objet disponible de votre inventaire.');
                  const cents = Math.round(Number(price) * 100);
                  const depositCents = Math.round(Number(deposit) * 100);
                  if (
                    !Number.isSafeInteger(cents) ||
                    cents < 0 ||
                    !Number.isSafeInteger(depositCents) ||
                    depositCents < 0
                  )
                    throw new Error('Les montants doivent être valides.');
                  const data = await request<{ listing: MarketplaceListing }>(
                    '/api/marketplace/listings',
                    {
                      item_id: itemId,
                      description,
                      public_location: town,
                      price_cents: selected.listing_mode === 'pret' ? 0 : cents,
                      deposit_cents: selected.listing_mode === 'vente' ? 0 : depositCents,
                    }
                  );
                  if (!data.listing?.id) throw new Error('Publication non confirmée.');
                  setMessage('Annonce publique enregistrée.');
                  setDescription('');
                  setTown('');
                  changed();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Publication indisponible.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3 className="text-lg font-semibold">Publier un objet existant</h3>
              <p className="text-sm">
                Choisissez d’abord Vente, Location ou Prêt dans la fiche de votre inventaire. Le
                nom, la marque, la catégorie, l’état et la photo deviennent publics ; saisissez
                séparément la description et la commune à partager. La série, la localisation privée
                et l’historique restent privés.
              </p>
              <label className="block">
                Objet disponible
                <select
                  className={FIELD}
                  required
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    setPrice('');
                    setDeposit('0');
                  }}
                >
                  <option value="">Choisir un objet</option>
                  {eligible.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {i.listing_mode}
                    </option>
                  ))}
                </select>
              </label>
              {eligible.length === 0 && (
                <p>
                  Aucun objet éligible. Modifiez le mode d’un objet disponible dans l’inventaire
                  ci-dessus.
                </p>
              )}
              <label className="block">
                Description publique
                <textarea
                  className={FIELD}
                  required
                  minLength={10}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block">
                Commune publique
                <input
                  className={FIELD}
                  required
                  maxLength={100}
                  value={town}
                  onChange={(e) => setTown(e.target.value)}
                  placeholder="Commune uniquement, sans adresse privée"
                />
              </label>
              {selected?.listing_mode !== 'pret' && (
                <label className="block">
                  {selected?.listing_mode === 'location'
                    ? 'Tarif par jour (€)'
                    : 'Prix de vente (€)'}
                  <input
                    className={FIELD}
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
              )}
              {selected && selected.listing_mode !== 'vente' && (
                <label className="block">
                  Caution convenue (€), sans préautorisation
                  <input
                    className={FIELD}
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    required
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                  />
                </label>
              )}
              <Button type="submit" loading={busy} disabled={!selected}>
                Publier ces informations
              </Button>
            </form>
          </Card>
          <Feedback error={error} message={message} />
          {error && (
            <Button variant="secondary" onClick={() => void refresh()}>
              Actualiser le suivi
            </Button>
          )}
          {loading && <p role="status">Chargement du suivi…</p>}
          <MarketplaceModeration />
          <h3 className="text-lg font-semibold">Mes annonces</h3>
          {!loading && listings.length === 0 && <p>Aucune annonce enregistrée.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => (
              <Card key={l.id} className="space-y-3">
                <h4 className="font-semibold">{l.name}</h4>
                <p>
                  {l.status === 'published'
                    ? 'Publiée'
                    : l.status === 'hidden'
                      ? 'Masquée par la modération'
                      : 'Retirée'}{' '}
                  · {l.public_location}
                </p>
                {l.status !== 'hidden' && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const data = await request<{ listing: MarketplaceListing }>(
                          `/api/marketplace/listings/${l.id}/actions`,
                          { action: l.status === 'published' ? 'withdraw' : 'publish' }
                        );
                        if (!data.listing?.id) throw new Error('Action non confirmée.');
                        changed();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Action indisponible.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {l.status === 'published' ? 'Retirer l’annonce' : 'Republier'}
                  </Button>
                )}
              </Card>
            ))}
          </div>
          <h3 className="text-lg font-semibold">Mes accords et remises</h3>
          {!loading && transactions.length === 0 && <p>Aucune transaction enregistrée.</p>}
          <div className="grid gap-4 lg:grid-cols-2">
            {transactions.map((tx) => (
              <Transaction key={tx.id} tx={tx} userId={user.id} onChanged={changed} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
