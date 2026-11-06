'use client';
import { useMemo } from 'react';
import { Glyph } from '../Glyph';
import { Icon } from '../icons';
import { Capsule, type CapsuleItem } from '../Drawer/Capsule';
import { S } from '../strings';
import type { OptionCat } from './cardsData';

interface CategoryCapsuleProps {
  cats: readonly OptionCat[];
  value: OptionCat;
  onChange: (cat: OptionCat) => void;
}

/** Sélecteur d'options de la pièce, bas à droite (mode Apparence). */
export function CategoryCapsule({ cats, value, onChange }: CategoryCapsuleProps) {
  const items = useMemo<CapsuleItem[]>(
    () =>
      cats.map((c) => ({
        id: c,
        label: S.categories[c],
        icon: c === 'mod' ? <Icon name="cube" /> : <span className="ks-ci"><Glyph name={c} size={18} /></span>,
      })),
    [cats],
  );
  return <Capsule kind="tablist" label="Options" items={items} value={value} buttonWidth={items.length > 4 ? 38 : 44} onChange={(id) => onChange(id as OptionCat)} />;
}
