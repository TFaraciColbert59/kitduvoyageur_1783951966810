import { ProductEditor } from '../../_components/ProductEditor';

/** GET /admin/produits/nouveau — création (shell via layout). */
export default function AdminProductNewPage() {
  return (
    <section className="os-workspace">
      <div className="os-workspace-primary">
        <div className="os-panel">
          <div className="os-panel-head">
            <div>
              <span className="os-eyebrow">Catalogue</span>
              <h2>Nouveau produit</h2>
            </div>
          </div>
          <ProductEditor />
        </div>
      </div>
    </section>
  );
}
