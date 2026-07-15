import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Metadata } from 'next';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import ProductCard from './ProductCard';
import { createClient } from '@/lib/supabase/server';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

// Mapping: URL slug → DB category value
const CATEGORY_SLUG_TO_DB: Record<string, string> = {
  sacs: 'Sacs',
  tentes: 'Tentes',
  sommeil: 'Sommeil',
  cuisine: 'Cuisine',
  eau: 'Eau',
  vetements: 'Vêtements',
  eclairage: 'Éclairage',
  securite: 'Sécurité',
  navigation: 'Navigation',
};

const CATEGORY_LABELS: Record<string, string> = {
  sacs: 'Sacs à dos',
  tentes: 'Tentes',
  sommeil: 'Sommeil & Couchage',
  cuisine: 'Cuisine outdoor',
  eau: 'Filtration & eau',
  vetements: 'Vêtements techniques',
  eclairage: 'Éclairage',
  securite: 'Sécurité',
  navigation: 'Navigation',
};

interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  weightG: number;
  priceEur: number;
  stock: number;
  image: string;
  imageAlt: string;
  badge?: string;
  description: string;
}

const categoryMeta: Record<string, { label: string; description: string; icon: string }> = {
  sacs: {
    label: 'Sacs à dos',
    description: 'Sacs de randonnée, trekking et alpinisme — du daypack au sac expédition.',
    icon: 'ArchiveBoxIcon',
  },
  tentes: {
    label: 'Tentes',
    description: 'Tentes légères, 3 saisons et 4 saisons pour tous les terrains.',
    icon: 'HomeIcon',
  },
  sommeil: {
    label: 'Sommeil & Couchage',
    description: 'Sacs de couchage et matelas pour des nuits confortables en plein air.',
    icon: 'MoonIcon',
  },
  cuisine: {
    label: 'Cuisine',
    description: 'Réchauds, casseroles et systèmes de cuisson pour le bivouac.',
    icon: 'FireIcon',
  },
  vetements: {
    label: 'Vêtements',
    description: "Vestes, couches intermédiaires et tenues techniques pour l'outdoor.",
    icon: 'SparklesIcon',
  },
  eau: {
    label: 'Eau & Hydratation',
    description: "Filtres, gourdes et systèmes de purification pour l'eau en nature.",
    icon: 'BeakerIcon',
  },
  eclairage: {
    label: 'Éclairage',
    description: 'Lampes frontales et lanternes pour les aventures nocturnes.',
    icon: 'SunIcon',
  },
  securite: {
    label: 'Sécurité',
    description: 'Équipements de sécurité et communication pour les aventures en montagne.',
    icon: 'ShieldCheckIcon',
  },
  navigation: {
    label: 'Navigation',
    description: 'GPS, boussoles et montres outdoor pour ne jamais vous perdre.',
    icon: 'MapIcon',
  },
};

interface PageProps {
  params: Promise<{ categorie: string }>;
}

export async function generateStaticParams() {
  return Object.keys(categoryMeta).map((cat) => ({ categorie: cat }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categorie } = await params;
  const label = CATEGORY_LABELS[categorie] || categorie;
  return {
    title: `${label} — Équipement outdoor`,
    description: `Découvrez notre sélection de ${label.toLowerCase()} pour vos aventures. Filtrez par poids, prix et activité.`,
    alternates: { canonical: `${siteUrl}/catalogue/${categorie}` },
    openGraph: {
      title: `${label} | Le Kit du Voyageur`,
      description: `Sélection de ${label.toLowerCase()} pour randonnée, trekking et aventure.`,
      url: `${siteUrl}/catalogue/${categorie}`,
    },
  };
}

export default async function CategorieFilterPage({ params }: PageProps) {
  const { categorie } = await params;
  const meta = categoryMeta[categorie];
  const dbCategory = CATEGORY_SLUG_TO_DB[categorie];

  // Fetch products from Supabase
  let products: Product[] = [];
  if (dbCategory) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, slug, name, brand, category, weight_g, price_eur, stock, image, image_alt, badge, description, featured')
        .eq('category', dbCategory)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        products = data.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          brand: p.brand,
          category: p.category,
          weightG: p.weight_g ?? 0,
          priceEur: Number(p.price_eur),
          stock: p.stock ?? 0,
          image: p.image ?? '',
          imageAlt: p.image_alt ?? '',
          badge: p.badge || undefined,
          description: p.description ?? '',
        }));
      }
    } catch {
      // Silently fall through to empty state
    }
  }

  if (!meta) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 max-w-7xl mx-auto px-4 py-16 text-center">
          <h1
            className="font-display font-700 text-2xl text-foreground mb-4"
            style={{ fontFamily: 'var(--font-display)' }}>
            Catégorie introuvable
          </h1>
          <Link href="/catalogue" className="btn-primary">
            Voir tout le catalogue
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-0 bg-dark-bg relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
          <Link
            href="/catalogue"
            className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-4 transition-colors">
            <Icon name="ArrowLeftIcon" size={14} variant="outline" />
            Catalogue
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-1 h-10 bg-primary flex-shrink-0 mt-1" />
            <div>
              <p
                className="font-mono text-xs text-primary tracking-widest uppercase mb-1"
                style={{ fontFamily: 'var(--font-mono)' }}>
                {products.length} PRODUIT{products.length !== 1 ? 'S' : ''}
              </p>
              <h1
                className="font-display font-800 text-3xl md:text-4xl text-white tracking-tight"
                style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                {meta.label.toUpperCase()}
              </h1>
              <p className="mt-2 text-white/50 text-base max-w-xl">{meta.description}</p>
            </div>
          </div>
        </div>
        <TopoSeparator color="#E7E3D6" />
      </section>

      {/* Category nav */}
      <div className="bg-card border-b border-border sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
            {Object.entries(categoryMeta).map(([slug, info]) => (
              <Link
                key={slug}
                href={`/catalogue/${slug}`}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  slug === categorie
                    ? 'bg-primary text-white' :'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}>
                {info.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Products grid */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {products.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-4">Aucun produit dans cette catégorie pour le moment.</p>
              <Link href="/catalogue" className="btn-primary">
                Voir tout le catalogue
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Back to full catalogue */}
          <div className="mt-10 text-center">
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-5 py-2.5">
              <Icon name="Squares2X2Icon" size={14} variant="outline" />
              Voir tout le catalogue
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
