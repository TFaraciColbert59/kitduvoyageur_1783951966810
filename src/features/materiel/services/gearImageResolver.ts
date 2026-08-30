/**
 * Moteur de résolution d'images pour le matériel outdoor LKDV.
 * Associe intelligemment une photographie haute définition réelle et soignée
 * à chaque équipement selon son nom, sa marque ou sa catégorie.
 */

const CURATED_GEAR_IMAGES: Record<string, string> = {
  // Tentes & Bivouac
  'tente 2p': 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&auto=format&fit=crop&q=80',
  'tente 1p': 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=800&auto=format&fit=crop&q=80',
  'tente hubba': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop&q=80',
  'tente copper': 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=800&auto=format&fit=crop&q=80',
  'tente 4 saisons': 'https://images.unsplash.com/photo-1517824806704-9040b037703b?w=800&auto=format&fit=crop&q=80',
  'tente': 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&auto=format&fit=crop&q=80',
  'tarp': 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=800&auto=format&fit=crop&q=80',
  'bivouac': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop&q=80',

  // Couchage & Duvets
  'sac de couchage': 'https://images.unsplash.com/photo-1627916607164-7b20241db935?w=800&auto=format&fit=crop&q=80',
  'duvet': 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=800&auto=format&fit=crop&q=80',
  'matelas': 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=800&auto=format&fit=crop&q=80',
  'neoair': 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=800&auto=format&fit=crop&q=80',
  'drap de sac': 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=800&auto=format&fit=crop&q=80',

  // Cuisine & Réchauds
  'rechaud': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
  'pocketrocket': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
  'popote': 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80',
  'gaz': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
  'cartouche de gaz': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
  'cuisine': 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=800&auto=format&fit=crop&q=80',

  // Vêtements & Chaussures
  'veste': 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=800&auto=format&fit=crop&q=80',
  'hardshell': 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=800&auto=format&fit=crop&q=80',
  'polaire': 'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=800&auto=format&fit=crop&q=80',
  'doudoune': 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&auto=format&fit=crop&q=80',
  'chaussures': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
  'chaussures de trail': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
  'chaussures de randonnee': 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=800&auto=format&fit=crop&q=80',
  'vetements': 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=800&auto=format&fit=crop&q=80',

  // Hydratation & Filtres
  'filtre': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&auto=format&fit=crop&q=80',
  'eau': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&auto=format&fit=crop&q=80',
  'gourde': 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80',
  'hydratation': 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&auto=format&fit=crop&q=80',

  // Sécurité & Montagne
  'secours': 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=800&auto=format&fit=crop&q=80',
  'trousse': 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=800&auto=format&fit=crop&q=80',
  'couteau': 'https://images.unsplash.com/photo-1589256469067-ea99122bbdc4?w=800&auto=format&fit=crop&q=80',
  'frontale': 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=800&auto=format&fit=crop&q=80',
  'lampe': 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=800&auto=format&fit=crop&q=80',
  'crampons': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
  'piolet': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
  'securite': 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=800&auto=format&fit=crop&q=80',

  // Nutrition & Vivres
  'repas': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',
  'lyophilise': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',
  'en-cas': 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&auto=format&fit=crop&q=80',
  'barres': 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&auto=format&fit=crop&q=80',
  'nutrition': 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',

  // Électronique
  'batterie': 'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?w=800&auto=format&fit=crop&q=80',
  'electronique': 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=800&auto=format&fit=crop&q=80',

  // Sac à dos
  'sac a dos': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
};

const CATEGORY_DEFAULT_IMAGES: Record<string, string> = {
  Bivouac: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=800&auto=format&fit=crop&q=80',
  Couchage: 'https://images.unsplash.com/photo-1627916607164-7b20241db935?w=800&auto=format&fit=crop&q=80',
  Cuisine: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
  Vêtements: 'https://images.unsplash.com/photo-1544923246-77307dd654cb?w=800&auto=format&fit=crop&q=80',
  Hydratation: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&auto=format&fit=crop&q=80',
  Sécurité: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=800&auto=format&fit=crop&q=80',
  Nutrition: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=800&auto=format&fit=crop&q=80',
  Électronique: 'https://images.unsplash.com/photo-1508873696983-2df5293cb32b?w=800&auto=format&fit=crop&q=80',
  Hygiène: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=800&auto=format&fit=crop&q=80',
  Autre: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
};

export function resolveGearImage(name?: string | null, category?: string | null, existingUrl?: string | null): string {
  if (existingUrl && existingUrl.trim() !== '' && !existingUrl.includes('no_image.png')) {
    return existingUrl;
  }

  const cleanName = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [keyword, url] of Object.entries(CURATED_GEAR_IMAGES)) {
    if (cleanName.includes(keyword)) {
      return url;
    }
  }

  if (category && CATEGORY_DEFAULT_IMAGES[category]) {
    return CATEGORY_DEFAULT_IMAGES[category];
  }

  return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80';
}
