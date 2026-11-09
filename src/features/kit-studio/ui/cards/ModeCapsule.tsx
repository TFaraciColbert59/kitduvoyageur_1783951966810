'use client';
import { Icon } from '../icons';
import { Capsule, type CapsuleItem } from '../Drawer/Capsule';
import { S } from '../strings';
import type { Mode } from '../../store/uiStore';

const ITEMS: readonly CapsuleItem[] = [
  { id: 'content', label: S.modes.content, icon: <Icon name="bag" /> },
  { id: 'appearance', label: S.modes.look, icon: <Icon name="brush" /> },
];

interface ModeCapsuleProps {
  mode: Mode;
  onChange: (m: Mode) => void;
}

/**
 * Sélecteur de mode, bas à gauche : Contenu / Apparence. ↺ n'est plus ici (voir UndoButton) : la
 * barre basse de la maquette n'a pas la place d'un troisième élément à gauche.
 */
export function ModeCapsule({ mode, onChange }: ModeCapsuleProps) {
  return (
    <div className="ks-modegrp">
      <Capsule kind="radiogroup" label={S.modes.group} items={ITEMS} value={mode} onChange={(id) => onChange(id as Mode)} />
    </div>
  );
}
