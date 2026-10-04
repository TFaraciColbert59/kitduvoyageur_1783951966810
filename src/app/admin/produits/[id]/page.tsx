import { PageLayout } from '@/design';
import { AdminNav } from '../../_components/AdminNav';
import { ProductDetailLoader } from '../../_components/ProductDetailLoader';

/** GET /admin/produits/[id] — fiche complète (édition + visuels + stock). */
export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageLayout title="Fiche produit" subtitle={id.slice(0, 8)}>
      <AdminNav />
      <ProductDetailLoader id={id} />
    </PageLayout>
  );
}
