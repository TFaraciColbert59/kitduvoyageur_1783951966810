import type { Metadata } from 'next';
import AdminProductsManager from './AdminProductsManager';

export const metadata: Metadata = {
  title: 'Gestion Produits — Admin KDV',
  description:
    "Interface d'administration des produits : gestion du catalogue, des stocks, des prix et des fiches produits.",
};

export default function AdminProduitsPage() {
  return <AdminProductsManager />;
}
