import { MapPin, Mountain, Tent, Droplet, Compass } from 'lucide-react';

/**
 * Helpers de catégorie des lieux — module partagé volontairement SANS
 * directive `'use client'` : il est consommé par le serveur
 * (`generateMetadata` de /lieux/[slug]) ET par les composants client.
 * Ne jamais le déplacer dans un fichier `'use client'` (erreur RSC).
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'refuge':
      return 'Refuge Alpin';
    case 'bivouac':
      return 'Bivouac';
    case 'water_source':
      return 'Source d’Eau';
    case 'viewpoint':
      return 'Belvédère';
    case 'pass':
      return 'Col';
    case 'campground':
      return 'Campement';
    case 'summit':
      return 'Sommet';
    case 'lake':
      return 'Lac';
    case 'historical':
      return 'Patrimoine';
    default:
      return 'Lieu Outdoor';
  }
}

export function getCategoryIcon(category: string) {
  switch (category) {
    case 'refuge':
      return Mountain;
    case 'bivouac':
    case 'campground':
      return Tent;
    case 'water_source':
      return Droplet;
    case 'pass':
    case 'viewpoint':
    case 'summit':
      return Compass;
    default:
      return MapPin;
  }
}
