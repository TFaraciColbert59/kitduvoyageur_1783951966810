import { createClient } from '@/lib/supabase/server';
import BlogClient from './BlogClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata = {
  title: 'Blog — Le Kit du Voyageur',
  description: 'Conseils, guides et inspirations pour voyager léger et bien équipé. Découvrez nos articles sur le matériel outdoor, les destinations et les techniques de voyage.',
};

export const revalidate = 3600;

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  published_at: string;
  image: string;
  image_alt: string;
  read_time: number;
  tags: string[];
  featured?: boolean;
}

const FALLBACK_POSTS: BlogPost[] = [
  {
    id: '1',
    slug: 'comment-voyager-leger-10-conseils',
    title: 'Comment voyager léger : 10 conseils d\'experts',
    excerpt: 'Réduire son sac à moins de 7 kg sans sacrifier le confort, c\'est possible. Voici les techniques utilisées par les voyageurs expérimentés.',
    category: 'Conseils',
    author: 'Équipe KDV',
    published_at: '2026-07-15',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    image_alt: 'Sac à dos léger posé sur un rocher en montagne',
    read_time: 8,
    tags: ['ultralight', 'conseils', 'débutant'],
    featured: true,
  },
  {
    id: '2',
    slug: 'meilleur-materiel-islande-2026',
    title: 'Meilleur matériel pour l\'Islande en 2026',
    excerpt: 'L\'Islande est une destination exigeante. Vent, pluie, froid et terrains volcaniques — voici l\'équipement indispensable pour partir sereinement.',
    category: 'Destinations',
    author: 'Équipe KDV',
    published_at: '2026-07-10',
    image: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=800&q=80',
    image_alt: 'Paysage volcanique islandais avec randonneurs équipés',
    read_time: 12,
    tags: ['islande', 'matériel', 'destinations'],
    featured: true,
  },
  {
    id: '3',
    slug: 'guide-sac-a-dos-40l-comparatif',
    title: 'Comparatif sacs à dos 40L : les 5 meilleurs de 2026',
    excerpt: 'Osprey, Deuter, Gregory, Arc\'teryx… Nous avons testé les 5 sacs à dos 40L les plus populaires pour vous aider à choisir.',
    category: 'Comparatifs',
    author: 'Équipe KDV',
    published_at: '2026-07-05',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80',
    image_alt: 'Comparaison de cinq sacs à dos de randonnée 40 litres',
    read_time: 15,
    tags: ['sacs à dos', 'comparatif', 'équipement'],
    featured: false,
  },
  {
    id: '4',
    slug: 'trek-nepal-liste-equipement',
    title: 'Trek au Népal : la liste d\'équipement complète',
    excerpt: 'Everest Base Camp, Annapurna Circuit, Langtang… Chaque trek a ses spécificités. Voici la liste exhaustive pour partir bien préparé.',
    category: 'Destinations',
    author: 'Équipe KDV',
    published_at: '2026-06-28',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80',
    image_alt: 'Randonneurs avec sacs à dos sur un sentier de montagne au Népal',
    read_time: 18,
    tags: ['népal', 'trek', 'liste équipement'],
    featured: false,
  },
  {
    id: '5',
    slug: 'chaussures-randonnee-guide-achat',
    title: 'Chaussures de randonnée : guide d\'achat 2026',
    excerpt: 'Basses, mid ou hautes ? Gore-Tex ou pas ? Vibram ou autre semelle ? Tout ce que vous devez savoir avant d\'acheter vos prochaines chaussures de trek.',
    category: 'Guides d\'achat',
    author: 'Équipe KDV',
    published_at: '2026-06-20',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    image_alt: 'Chaussures de randonnée Salomon sur un sentier rocailleux',
    read_time: 10,
    tags: ['chaussures', 'guide achat', 'équipement'],
    featured: false,
  },
  {
    id: '6',
    slug: 'vanlife-europe-equipement-essentiel',
    title: 'Van Life en Europe : l\'équipement essentiel',
    excerpt: 'Partir en van pour 3 mois à travers l\'Europe demande une préparation spécifique. Voici ce que nous recommandons pour vivre confortablement sur la route.',
    category: 'Lifestyle',
    author: 'Équipe KDV',
    published_at: '2026-06-12',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    image_alt: 'Van aménagé garé dans un paysage naturel européen',
    read_time: 14,
    tags: ['vanlife', 'europe', 'lifestyle'],
    featured: false,
  },
  {
    id: '7',
    slug: 'filtration-eau-randonnee-comparatif',
    title: 'Filtration d\'eau en randonnée : Sawyer vs Katadyn vs LifeStraw',
    excerpt: 'Boire l\'eau des rivières en toute sécurité est possible avec le bon équipement. Comparatif des 3 solutions les plus populaires.',
    category: 'Comparatifs',
    author: 'Équipe KDV',
    published_at: '2026-06-05',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80',
    image_alt: 'Filtre à eau Katadyn utilisé dans un ruisseau de montagne',
    read_time: 9,
    tags: ['eau', 'filtration', 'comparatif'],
    featured: false,
  },
  {
    id: '8',
    slug: 'tente-ultralight-guide-complet',
    title: 'Tentes ultralight : le guide complet 2026',
    excerpt: 'MSR, Big Agnes, Nemo, Zpacks… Le marché des tentes légères explose. Voici comment choisir selon votre usage et votre budget.',
    category: 'Guides d\'achat',
    author: 'Équipe KDV',
    published_at: '2026-05-28',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&q=80',
    image_alt: 'Tente ultralight MSR montée au coucher du soleil en montagne',
    read_time: 13,
    tags: ['tentes', 'ultralight', 'guide achat'],
    featured: false,
  },
];

async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('guides')
      .select('id, slug, title, excerpt, category, author_name, published_at, cover_image_url, cover_image_alt, read_time_min, tags, featured')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) return FALLBACK_POSTS;

    return data.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      excerpt: g.excerpt ?? '',
      category: g.category ?? 'Guides',
      author: g.author_name ?? 'Équipe KDV',
      published_at: g.published_at ?? new Date().toISOString(),
      image: g.cover_image_url ?? 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
      image_alt: g.cover_image_alt ?? g.title,
      read_time: g.read_time_min ?? 8,
      tags: Array.isArray(g.tags) ? g.tags : [],
      featured: g.featured ?? false,
    }));
  } catch {
    return FALLBACK_POSTS;
  }
}

export default async function BlogPage() {
  const posts = await getBlogPosts();

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Blog — Le Kit du Voyageur',
    description: 'Conseils, guides et inspirations pour voyager léger et bien équipé.',
    url: `${siteUrl}/blog`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Le Kit du Voyageur',
      url: siteUrl,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
        suppressHydrationWarning
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        suppressHydrationWarning
      />
      <BlogClient posts={posts} />
    </>
  );
}
