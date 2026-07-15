import ProductDetailClient from './ProductDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProduitPage({ params }: Props) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}