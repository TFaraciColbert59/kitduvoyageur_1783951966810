import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

const TOOL_META: Record<string, { title: string; description: string; schemaType: string }> = {
  'poids-du-sac': {
    title: 'Calculateur de poids du sac — Le Kit du Voyageur',
    description: 'Calculez le poids total de votre sac à dos par catégorie. Outil gratuit pour optimiser votre équipement outdoor.',
    schemaType: 'SoftwareApplication',
  },
  'budget-voyage': {
    title: 'Calculateur de budget voyage — Le Kit du Voyageur',
    description: 'Estimez votre budget de voyage par jour et par personne. Outil gratuit de planification financière pour randonneurs.',
    schemaType: 'SoftwareApplication',
  },
  'checklist': {
    title: 'Checklist équipement outdoor — Le Kit du Voyageur',
    description: 'Checklist complète pour ne rien oublier avant votre aventure. Personnalisable et téléchargeable.',
    schemaType: 'HowTo',
  },
  'convertisseur-devises': {
    title: 'Convertisseur de devises voyage — Le Kit du Voyageur',
    description: 'Convertissez distances, poids, températures et devises pour vos voyages. Outil pratique pour randonneurs.',
    schemaType: 'SoftwareApplication',
  },
  'calculateur-calories': {
    title: 'Calculateur de calories randonnée — Le Kit du Voyageur',
    description: 'Calculez vos besoins caloriques en randonnée selon votre profil et l\'intensité de l\'effort.',
    schemaType: 'SoftwareApplication',
  },
  'planificateur-itineraire': {
    title: 'Planificateur d\'itinéraire — Le Kit du Voyageur',
    description: 'Planifiez votre itinéraire jour par jour avec distances, dénivelés et hébergements.',
    schemaType: 'SoftwareApplication',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = TOOL_META[slug];

  if (!meta) {
    return {
      title: 'Outil outdoor — Le Kit du Voyageur',
      description: 'Outils gratuits pour préparer vos aventures outdoor.',
      alternates: { canonical: `${siteUrl}/outils/${slug}` },
    };
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': meta.schemaType,
    name: meta.title.split(' — ')[0],
    description: meta.description,
    url: `${siteUrl}/outils/${slug}`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Outils', item: `${siteUrl}/outils` },
        { '@type': 'ListItem', position: 3, name: meta.title.split(' — ')[0], item: `${siteUrl}/outils/${slug}` },
      ],
    },
  };

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `${siteUrl}/outils/${slug}` },
    openGraph: {
      type: 'website',
      title: meta.title,
      description: meta.description,
      url: `${siteUrl}/outils/${slug}`,
      siteName: 'Le Kit du Voyageur',
    },
    other: {
      'script:ld+json': JSON.stringify(schema),
    },
  };
}

export default function OutilsSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
