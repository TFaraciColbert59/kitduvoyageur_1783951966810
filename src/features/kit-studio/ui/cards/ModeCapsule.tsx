'use client';
import { Icon } from '../icons';
import { Capsule, type CapsuleItem } from '../Drawer/Capsule';
import { S } from '../strings';
import type { Mode } from '../../store/uiStore';

const ITEMS: readonly CapsuleItem[] = [
  { id: 'content', label: S.modes.content, icon: <Icon name="bag" /> },
  { id: 'appearance', label: S.modes.look, icon: <Icon name="brush" /> },
];

const UNDO_LABEL = 'Annuler la dernière modification';

interface ModeCapsuleProps {
  mode: Mode;
  onChange: (m: Mode) => void;
  canUndo: boolean;
  onUndo: () => void;
}

/** Sélecteur de mode, bas à gauche : Contenu / Apparence, puis ↺ (KS-006) tant qu'une annulation existe. */
export function ModeCapsule({ mode, onChange, canUndo, onUndo }: ModeCapsuleProps) {
  return (
    <div className="ks-modegrp">
      <Capsule kind="radiogroup" label={S.modes.group} items={ITEMS} value={mode} onChange={(id) => onChange(id as Mode)} />
      {canUndo ? (
        <button type="button" className="ks-undo" aria-label={UNDO_LABEL} onClick={onUndo}>
          <svg viewBox="0 0 24 24" className="ks-icon" aria-hidden="true" focusable="false">
            <path d="M9 7 4.5 11.5 9 16M5 11.5h8.5a5 5 0 0 1 0 10H11" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
