import { ProductDetailLoader } from '../../_components/ProductDetailLoader';

/** GET /admin/produits/[id] — fiche complète (shell via layout). */
export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <section className="os-workspace">
      <div className="os-workspace-primary">
        <div className="os-panel">
          <div className="os-panel-head">
            <div>
              <span className="os-eyebrow">Catalogue</span>
              <h2>Fiche produit</h2>
            </div>
            <span className="os-chip os-clear">{id.slice(0, 8)}</span>
          </div>
          <ProductDetailLoader id={id} />
        </div>
      </div>
    </section>
  );
}
