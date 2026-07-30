import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

const TOOL_META: Record<string, { title: string; description: string; schemaType: string }> = {
  'poids-sac': {
    title: 'Calculateur de poids du sac — Le Kit du Voyageur',
    description: 'Calculez le poids total de votre sac à dos par catégorie. Outil gratuit pour optimiser votre équipement outdoor.',
    schemaType: 'SoftwareApplication',
  },
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
  'convertisseur': {
    title: 'Convertisseur universel voyage — Le Kit du Voyageur',
    description: 'Convertissez distances, poids, températures et devises pour vos voyages. Outil pratique pour randonneurs.',
    schemaType: 'SoftwareApplication',
  },
  'convertisseur-devises': {
    title: 'Convertisseur universel voyage — Le Kit du Voyageur',
    description: 'Convertissez distances, poids, températures et devises pour vos voyages. Outil pratique pour randonneurs.',
    schemaType: 'SoftwareApplication',
  },
  'checklist': {
    title: 'Checklist équipement outdoor — Le Kit du Voyageur',
    description: 'Checklist complète pour ne rien oublier avant votre aventure. Personnalisable et téléchargeable.',
    schemaType: 'HowTo',
  },
  'tailles': {
    title: 'Convertisseur de tailles vêtements et chaussures — Le Kit du Voyageur',
    description: 'Convertissez les tailles de vêtements et chaussures entre les standards FR, UK, US, EU et JP. Outil gratuit pour voyager.',
    schemaType: 'SoftwareApplication',
  },
  'fuseaux': {
    title: 'Fuseaux horaires et décalage horaire — Le Kit du Voyageur',
    description: 'Comparez les heures entre votre pays et votre destination. Calculez le décalage horaire en temps réel.',
    schemaType: 'SoftwareApplication',
  },
  'boussole': {
    title: 'Boussole et niveau à bulle — Le Kit du Voyageur',
    description: 'Boussole et niveau à bulle utilisant les capteurs de votre appareil. Outil terrain pour randonneurs.',
    schemaType: 'SoftwareApplication',
  },
  'chronometre': {
    title: 'Chronomètre de randonnée — Le Kit du Voyageur',
    description: 'Minuteur et chronomètre avec tours pour vos sorties outdoor. Enregistrez vos temps d\'étape.',
    schemaType: 'SoftwareApplication',
  },
  'rations': {
    title: 'Calculateur de rations eau et nourriture — Le Kit du Voyageur',
    description: 'Calculez vos besoins en eau et nourriture par jour selon l\'effort et la météo. Outil gratuit pour randonneurs.',
    schemaType: 'SoftwareApplication',
  },
  'calculateur-calories': {
    title: 'Calculateur de rations eau et nourriture — Le Kit du Voyageur',
    description: 'Calculez vos besoins en eau, nourriture et calories par jour selon l\'effort et la météo.',
    schemaType: 'SoftwareApplication',
  },
  'decompression': {
    title: 'Calculateur de décompression plongée — Le Kit du Voyageur',
    description: 'Calculez vos paliers de décompression pour la plongée sous-marine. Basé sur les tables PADI et NAUI.',
    schemaType: 'SoftwareApplication',
  },
  'altimetre': {
    title: 'Altimètre et pression atmosphérique — Le Kit du Voyageur',
    description: 'Mesurez l\'altitude et la pression atmosphérique en temps réel via les capteurs de votre appareil.',
    schemaType: 'SoftwareApplication',
  },
  'meteo-montagne': {
    title: 'Météo montagne et bulletins — Le Kit du Voyageur',
    description: 'Interprétez les bulletins météo montagne : nuages, vent, précipitations, risque orage. Guide gratuit.',
    schemaType: 'SoftwareApplication',
  },
  'carbone': {
    title: 'Calculateur carbone voyage — Le Kit du Voyageur',
    description: 'Estimez l\'empreinte carbone de vos voyages et calculez la compensation nécessaire. Outil éco-responsable.',
    schemaType: 'SoftwareApplication',
  },
  'debit-eau': {
    title: 'Calculateur de débit rivière — Le Kit du Voyageur',
    description: 'Estimez le débit et la dangerosité d\'une rivière pour la traversée ou le kayak. Outil terrain gratuit.',
    schemaType: 'SoftwareApplication',
  },
  'pharmacie': {
    title: 'Pharmacie de voyage — Le Kit du Voyageur',
    description: 'Composez votre pharmacie de voyage selon votre destination, durée et activités prévues. Checklist santé.',
    schemaType: 'HowTo',
  },
  'visa': {
    title: 'Vérificateur de visa voyage — Le Kit du Voyageur',
    description: 'Vérifiez les exigences de visa pour votre nationalité et votre destination. Guide gratuit actualisé.',
    schemaType: 'SoftwareApplication',
  },
  'vaccins': {
    title: 'Recommandations vaccins voyage — Le Kit du Voyageur',
    description: 'Consultez les recommandations vaccinales par destination selon les données officielles. Guide santé.',
    schemaType: 'SoftwareApplication',
  },
  'langue': {
    title: 'Phrases essentielles voyage — Le Kit du Voyageur',
    description: 'Les phrases de survie dans 40 langues : urgences, nourriture, transport, hébergement. Guide de conversation.',
    schemaType: 'HowTo',
  },
  'noeud': {
    title: 'Guide des nœuds d\'escalade et camping — Le Kit du Voyageur',
    description: 'Apprenez les nœuds essentiels pour la randonnée, l\'escalade et le camping avec animations interactives.',
    schemaType: 'HowTo',
  },
  'soleil': {
    title: 'Calculateur lever et coucher du soleil — Le Kit du Voyageur',
    description: 'Calculez les heures de lever et coucher du soleil pour n\'importe quelle date et localisation. Outil gratuit.',
    schemaType: 'SoftwareApplication',
  },
  'planificateur-itineraire': {
    title: 'Planificateur d\'itinéraire de voyage — Le Kit du Voyageur',
    description: 'Planifiez votre itinéraire jour par jour avec activités, lieux et conseils. Outil gratuit de planification.',
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
