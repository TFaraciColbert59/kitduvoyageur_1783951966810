import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Metadata } from 'next';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import ProductCard from './ProductCard';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.com';

const CATEGORY_LABELS: Record<string, string> = {
  sacs: 'Sacs à dos',
  tentes: 'Tentes',
  'sacs-de-couchage': 'Sacs de couchage',
  cuisine: 'Cuisine outdoor',
  eau: 'Filtration & eau',
  vetements: 'Vêtements techniques',
  eclairage: 'Éclairage',
  sommeil: 'Confort & sommeil',
  navigation: 'Navigation',
  securite: 'Sécurité',
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

const allProducts: Product[] = [
  {
    id: 'p1',
    slug: 'osprey-exos-58',
    name: 'Osprey Exos 58 L',
    brand: 'Osprey',
    category: 'sacs',
    weightG: 1060,
    priceEur: 249,
    stock: 12,
    badge: 'Bestseller',
    image: 'https://images.unsplash.com/photo-1687755541812-15786d01a728',
    imageAlt: 'Sac à dos de randonnée rouge suspendu contre un mur de pierre, bretelles ergonomiques visibles',
    description: 'Le sac à dos de randonnée ultra-léger par excellence. Suspension AirSpeed, 58 litres, 1 060 g.',
  },
  {
    id: 'p2',
    slug: 'deuter-aircontact',
    name: 'Deuter Aircontact Lite 45+10',
    brand: 'Deuter',
    category: 'sacs',
    weightG: 1480,
    priceEur: 189,
    stock: 8,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1a0058070-1772361191132.png',
    imageAlt: 'Sac à dos de trekking vert avec système de suspension dorsal visible sur fond blanc',
    description: 'Sac polyvalent avec dos ventilé Aircontact, idéal pour les treks multi-jours.',
  },
  {
    id: 'p3',
    slug: 'big-agnes-copper-spur',
    name: 'Big Agnes Copper Spur HV2',
    brand: 'Big Agnes',
    category: 'tentes',
    weightG: 1080,
    priceEur: 549,
    stock: 5,
    badge: 'Léger',
    image: 'https://images.unsplash.com/photo-1571364588707-8638d6c49fea',
    imageAlt: 'Tente légère orange installée sur prairie alpine au coucher du soleil, montagnes en arrière-plan',
    description: 'Tente 2 places ultra-légère avec double paroi, idéale pour la randonnée légère.',
  },
  {
    id: 'p4',
    slug: 'msr-hubba-hubba',
    name: 'MSR Hubba Hubba NX 2',
    brand: 'MSR',
    category: 'tentes',
    weightG: 1540,
    priceEur: 479,
    stock: 7,
    image: 'https://images.unsplash.com/photo-1626326355479-b3a7ddcfe606',
    imageAlt: 'Tente de camping bleue installée en bord de lac de montagne au coucher du soleil',
    description: 'Tente 3 saisons robuste et légère, montage rapide, excellente ventilation.',
  },
  {
    id: 'p5',
    slug: 'sea-to-summit-reactor',
    name: 'Sea to Summit Reactor +5°C',
    brand: 'Sea to Summit',
    category: 'sacs-de-couchage',
    weightG: 680,
    priceEur: 175,
    stock: 20,
    image: 'https://img.rocket.new/generatedImages/rocket_gen_img_1d9318392-1766063031269.png',
    imageAlt: 'Sac de couchage bleu déplié sur sol de forêt, texture lisse et coutures apparentes',
    description: 'Sac de couchage compact et léger pour les nuits estivales en altitude.',
  },
  {
    id: 'p6',
    slug: 'thermarest-neoair',
    name: 'Therm-a-Rest NeoAir XLite',
    brand: 'Therm-a-Rest',
    category: 'sacs-de-couchage',
    weightG: 354,
    priceEur: 199,
    stock: 14,
    badge: 'Top confort',
    image: 'https://images.unsplash.com/photo-1663707333537-9808bb2a84a0',
    imageAlt: 'Matelas gonflable argenté déroulé dans tente, texture alvéolaire visible, fond de toile verte',
    description: 'Matelas gonflable ultra-léger avec isolation ThermaCapture, R-value 4.5.',
  },
  {
    id: 'p7',
    slug: 'msr-pocket-rocket',
    name: 'MSR PocketRocket 2',
    brand: 'MSR',
    category: 'cuisine',
    weightG: 73,
    priceEur: 48,
    stock: 35,
    badge: 'Ultra-léger',
    image: 'https://images.unsplash.com/photo-1729872416347-38d7dfbef04e',
    imageAlt: 'Réchaud à gaz compact posé sur rocher avec casserole en titane, fond de forêt floue',
    description: 'Réchaud à gaz ultra-compact, 73 g, ébullition en 3,5 min pour 1 litre.',
  },
  {
    id: 'p8',
    slug: 'jetboil-flash',
    name: 'Jetboil Flash 1L',
    brand: 'Jetboil',
    category: 'cuisine',
    weightG: 371,
    priceEur: 99,
    stock: 18,
    image: 'https://images.unsplash.com/photo-1520963959303-a5cc3bdf9260',
    imageAlt: 'Système de cuisson intégré Jetboil rouge posé sur rocher avec vapeur visible',
    description: 'Système de cuisson intégré tout-en-un, ébullition en 100 secondes.',
  },
  {
    id: 'p9',
    slug: 'arcteryx-beta-jacket',
    name: "Arc'teryx Beta SL Jacket",
    brand: "Arc'teryx",
    category: 'vetements',
    weightG: 315,
    priceEur: 375,
    stock: 8,
    badge: 'Premium',
    image: 'https://images.unsplash.com/photo-1618143928355-3d9afff6ec23',
    imageAlt: 'Veste imperméable rouge portée par randonneur sur crête rocheuse, ciel nuageux dramatique',
    description: 'Veste imperméable Gore-Tex ultra-légère, coupe-vent, packable.',
  },
  {
    id: 'p10',
    slug: 'patagonia-nano-puff',
    name: 'Patagonia Nano Puff Jacket',
    brand: 'Patagonia',
    category: 'vetements',
    weightG: 298,
    priceEur: 249,
    stock: 7,
    badge: 'Éco',
    image: 'https://images.unsplash.com/photo-1698988934092-41ff930addd2',
    imageAlt: 'Veste doudoune légère bleue portée en montagne avec vue sur vallée alpine',
    description: "Doudoune synthétique recyclée, isolation PrimaLoft, résistante à l'humidité.",
  },
  {
    id: 'p11',
    slug: 'sawyer-squeeze',
    name: 'Sawyer Squeeze Filter',
    brand: 'Sawyer',
    category: 'eau',
    weightG: 85,
    priceEur: 34,
    stock: 48,
    image: 'https://images.unsplash.com/photo-1735281257493-83be781b6483',
    imageAlt: "Filtre à eau compact bleu posé sur pierres au bord d'un ruisseau de montagne",
    description: "Filtre à eau ultra-léger, filtre jusqu'à 378 000 litres, 0,1 micron.",
  },
  {
    id: 'p12',
    slug: 'platypus-gravityworks',
    name: 'Platypus GravityWorks 4L',
    brand: 'Platypus',
    category: 'eau',
    weightG: 170,
    priceEur: 72,
    stock: 18,
    image: 'https://images.unsplash.com/photo-1631329426101-b7250cde7fd7',
    imageAlt: "Système de filtration d'eau suspendu à branche avec poches bleues, fond de forêt",
    description: 'Système de filtration par gravité pour le camp, 1,75 L/min.',
  },
  {
    id: 'p13',
    slug: 'black-diamond-spot',
    name: 'Black Diamond Spot 400',
    brand: 'Black Diamond',
    category: 'eclairage',
    weightG: 91,
    priceEur: 42,
    stock: 30,
    image: 'https://images.unsplash.com/photo-1570612117355-e3f8b19b1c08',
    imageAlt: "Lampe frontale noire posée sur table de camping avec faisceau lumineux visible dans l'obscurité",
    description: 'Lampe frontale 400 lumens, étanche IPX8, rechargeable USB.',
  },
  {
    id: 'p14',
    slug: 'leki-micro-vario',
    name: 'LEKI Micro Vario Carbon',
    brand: 'LEKI',
    category: 'batons',
    weightG: 430,
    priceEur: 159,
    stock: 22,
    image: 'https://images.unsplash.com/photo-1607194383665-b75c341d03d0',
    imageAlt: 'Bâtons de randonnée carbone appuyés contre rocher sur sentier de montagne ensoleillé',
    description: 'Bâtons carbone pliables, système Speed Lock 2, poignée Aergon Thermo.',
  },
];

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
  'sacs-de-couchage': {
    label: 'Sacs de couchage',
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
    description: 'Filtres, gourdes et systèmes de purification pour l\'eau en nature.',
    icon: 'BeakerIcon',
  },
  eclairage: {
    label: 'Éclairage',
    description: 'Lampes frontales et lanternes pour les aventures nocturnes.',
    icon: 'SunIcon',
  },
  batons: {
    label: 'Bâtons',
    description: 'Bâtons de randonnée et trekking pour soulager vos genoux.',
    icon: 'WrenchScrewdriverIcon',
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
  const products = allProducts.filter((p) => p.category === categorie);

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
