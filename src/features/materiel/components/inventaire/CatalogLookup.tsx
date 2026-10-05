'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card } from '@/components/ui';
export default function CatalogLookup() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [product, setProduct] = useState<{ id: string; slug: string; name: string } | null>(null);
  async function lookup() {
    if (pending) return;
    setPending(true);
    setError('');
    setProduct(null);
    try {
      const r = await fetch('/api/materiel/catalog-lookup?barcode=' + encodeURIComponent(code));
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setProduct(d.product);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recherche impossible');
    } finally {
      setPending(false);
    }
  }
  return (
    <Card as="section" className="space-y-3 p-4">
      <h2 className="font-semibold">Retrouver une référence par code-barres</h2>
      <p className="text-sm">
        Recherche dans notre catalogue. Un code GTIN/EAN ne certifie ni le numéro de série, ni
        l’authenticité ou la garantie.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
        className="flex flex-wrap gap-2"
      >
        <label className="min-w-0 flex-1">
          Code GTIN/EAN
          <input
            inputMode="numeric"
            maxLength={30}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="block w-full min-h-11 rounded-lg bg-[color:var(--glass-bg-medium)] px-3"
          />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? 'Recherche…' : 'Rechercher'}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {product && (
        <div className="space-y-2">
          <p>{product.name}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                router.push('/hub/inventaire?product_id=' + encodeURIComponent(product.id))
              }
            >
              Préremplir un objet
            </Button>
            <Link
              className="min-h-11 inline-flex items-center underline"
              href={'/produit/' + encodeURIComponent(product.slug)}
            >
              Voir la fiche
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
