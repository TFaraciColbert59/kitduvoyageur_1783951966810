import type { LKDVIconName } from '@/components/ui/LKDVIcon';

export interface EquipmentCategory {
  key: string;
  label: string;
  icon: LKDVIconName;
  color: string;
  bgLight: string;
  order: number;
}

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  { key: 'all', label: 'Tout le matériel', icon: 'sac', color: '#17402C', bgLight: '#E1EBDD', order: 0 },
  { key: 'Sacs à dos', label: 'Sacs & Portage', icon: 'sac', color: '#17402C', bgLight: '#E1EBDD', order: 1 },
  { key: 'Couchage', label: 'Couchage & Tentes', icon: 'couchage', color: '#1A4D36', bgLight: '#DDEAE2', order: 2 },
  { key: 'Bivouac', label: 'Bivouac & Abris', icon: 'camping', color: '#275841', bgLight: '#DCECE0', order: 3 },
  { key: 'Vêtements', label: 'Vêtements & Vestes', icon: 'vetement', color: '#3A6B56', bgLight: '#E3EFE9', order: 4 },
  { key: 'Chaussures', label: 'Chaussures', icon: 'chaussure', color: '#526A5E', bgLight: '#EAEFEA', order: 5 },
  { key: 'Cuisine', label: 'Cuisine & Réchauds', icon: 'rechaud', color: '#447055', bgLight: '#E3EFE5', order: 6 },
  { key: 'Hydratation', label: 'Eau & Filtres', icon: 'eau_potable', color: '#2B6B78', bgLight: '#DCEDF2', order: 7 },
  { key: 'Navigation', label: 'Navigation & GPS', icon: 'boussole', color: '#68593F', bgLight: '#EFECE2', order: 8 },
  { key: 'Sécurité', label: 'Sécurité & Soins', icon: 'trousse', color: '#7E4E42', bgLight: '#F7E7E3', order: 9 },
  { key: 'Éclairage', label: 'Lampes & Éclairage', icon: 'lampe', color: '#7A6B32', bgLight: '#F5F0DC', order: 10 },
  { key: 'Autre', label: 'Accessoires & Outils', icon: 'options_avancees', color: '#5C6B63', bgLight: '#EFEFEA', order: 11 },
];

export function getCategoryIcon(categoryKeyOrName?: string | null): LKDVIconName {
  if (!categoryKeyOrName) return 'sac';
  const clean = categoryKeyOrName.toLowerCase().trim();
  const match = EQUIPMENT_CATEGORIES.find(
    (c) => c.key.toLowerCase() === clean || c.label.toLowerCase().includes(clean)
  );
  if (match) return match.icon;
  if (clean.includes('sac') || clean.includes('portage')) return 'sac';
  if (clean.includes('couch') || clean.includes('tente') || clean.includes('dormir')) return 'couchage';
  if (clean.includes('bivouac')) return 'camping';
  if (clean.includes('vêtement') || clean.includes('habit') || clean.includes('veste')) return 'vetement';
  if (clean.includes('chauss') || clean.includes('botte') || clean.includes('soulier')) return 'chaussure';
  if (clean.includes('cuisin') || clean.includes('réchaud') || clean.includes('popote')) return 'rechaud';
  if (clean.includes('eau') || clean.includes('hydrat') || clean.includes('gourde') || clean.includes('filtre')) return 'eau_potable';
  if (clean.includes('navig') || clean.includes('gps') || clean.includes('boussole')) return 'boussole';
  if (clean.includes('sécur') || clean.includes('soin') || clean.includes('secours')) return 'trousse';
  if (clean.includes('éclair') || clean.includes('lampe') || clean.includes('frontale')) return 'lampe';
  return 'options_avancees';
}

export function getCategoryColor(categoryKeyOrName?: string | null): { color: string; bgLight: string } {
  if (!categoryKeyOrName) return { color: '#17402C', bgLight: '#E1EBDD' };
  const clean = categoryKeyOrName.toLowerCase().trim();
  const match = EQUIPMENT_CATEGORIES.find(
    (c) => c.key.toLowerCase() === clean || c.label.toLowerCase().includes(clean)
  );
  if (match) return { color: match.color, bgLight: match.bgLight };
  return { color: '#17402C', bgLight: '#E1EBDD' };
}
