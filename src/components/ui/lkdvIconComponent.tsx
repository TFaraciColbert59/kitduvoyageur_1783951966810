import { LKDVIcon, type LKDVIconName, type LKDVIconProps } from './LKDVIcon';

export type LKDVIconComponentProps = Omit<LKDVIconProps, 'name'>;
export type LKDVIconComponent = (props: LKDVIconComponentProps) => React.JSX.Element;

const cache = new Map<LKDVIconName, LKDVIconComponent>();

/**
 * Composant lié à une clé de la base LKDV V2, pour les tables d'icônes
 * (`{ sortie: lkdvIcon('boussole') }`) rendues ensuite en `<Icon size={20} />`.
 * L'identité du composant est stable d'un appel à l'autre.
 */
export function lkdvIcon(name: LKDVIconName): LKDVIconComponent {
  let component = cache.get(name);
  if (!component) {
    component = function LKDVBoundIcon(props: LKDVIconComponentProps) {
      return <LKDVIcon name={name} {...props} />;
    };
    cache.set(name, component);
  }
  return component;
}
