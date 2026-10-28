import { LKDVIcon, type LKDVIconName } from '@/components/ui/LKDVIcon';

/**
 * Icônes du Compas v5 : la base LKDV V2 (aucun tracé propre à l'écran). `V5Icon` ne fait que poser les
 * classes de taille `.v5-ic` (`s`, `xs`, `big`) autour d'un `LKDVIcon`.
 */
export type V5IconName = LKDVIconName;

export function V5Icon({
  name,
  size,
  className,
  ...rest
}: { name: V5IconName; size?: 's' | 'xs' | 'big' } & Omit<React.ComponentProps<typeof LKDVIcon>, 'name' | 'size'>) {
  return <LKDVIcon name={name} className={`v5-ic${size ? ` ${size}` : ''}${className ? ` ${className}` : ''}`} {...rest} />;
}

/** Icône du moyen de transport choisi. */
export function transportIcon(id: string): V5IconName {
  switch (id) {
    case 'car':
      return 'voiture';
    case 'train':
      return 'train';
    case 'bus':
      return 'bus';
    case 'flight':
      return 'avion';
    case 'carpool':
      return 'communaute';
    default:
      return 'randonnee';
  }
}

export function stayIcon(kind: string): V5IconName {
  switch (kind) {
    case 'refuge':
      return 'refuge';
    case 'camping':
    case 'bivouac':
      return 'tente';
    default:
      return 'hotel';
  }
}
