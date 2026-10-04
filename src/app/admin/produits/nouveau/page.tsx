import { PageLayout } from '@/design';
import { AdminNav } from '../../_components/AdminNav';
import { ProductEditor } from '../../_components/ProductEditor';

/** GET /admin/produits/nouveau — création. */
export default function AdminProductNewPage() {
  return (
    <PageLayout title="Nouveau produit" subtitle="Création au catalogue">
      <AdminNav />
      <ProductEditor />
    </PageLayout>
  );
}
