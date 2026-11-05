'use client';
import { FAMILIES } from '../../domain/catalog';
import type { FamilyId } from '../../domain/catalog';
import { Icon, type IconName } from '../icons';
import { Capsule, type CapsuleItem } from '../Drawer/Capsule';
import { S } from '../strings';

/** Ordre et icône des six familles (maquette FAMS, l.1646). */
const ORDER: readonly (readonly [FamilyId, IconName])[] = [
  ['abri-et-couchage', 'tent'],
  ['eau-et-cuisine', 'bottle'],
  ['vetements', 'jacket'],
  ['lumiere-et-energie', 'bolt'],
  ['securite-et-soin', 'aid'],
  ['orientation-et-outils', 'compass'],
];

const ITEMS: readonly CapsuleItem[] = ORDER.map(([id, icon]) => ({
  id,
  label: FAMILIES.find((f) => f.id === id)?.n ?? id,
  icon: <Icon name={icon} />,
}));

interface FamilyCapsuleProps {
  value: string | null;
  /** null = toutes les familles (on touche la famille active pour la désactiver). */
  onChange: (family: string | null) => void;
}

/** Sélecteur de familles, bas à droite (mode Contenu). */
export function FamilyCapsule({ value, onChange }: FamilyCapsuleProps) {
  return (
    <Capsule kind="tablist" label={S.families.group} items={ITEMS} value={value} buttonWidth={38} onChange={(id) => onChange(id === value ? null : id)} />
  );
}
