'use client';

import { useRef, useState } from 'react';
import { Compass, Package, Users } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui';
import { resetHubPrefs, type Nature } from '../engine/hubNature';

const NATURES: { id: Nature; label: string; Icon: typeof Package }[] = [
  { id: 'possession', label: 'Matériel', Icon: Package },
  { id: 'sortie', label: 'Voyage', Icon: Compass },
  { id: 'collectif', label: 'Rando', Icon: Users },
];

/** Haptique gardée (iOS Safari : fallback silencieux). */
function buzz(): void {
  try {
    if (typeof navigator !== 'undefined') navigator.vibrate?.(10);
  } catch {
    /* silencieux */
  }
}

/**
 * H3.2 — Sélecteur de nature : 3 vignettes Icône + Nom, zéro sous-titre,
 * zéro description, zéro CTA. Sélection longue (≥ 1 s) révèle Réinitialiser.
 */
export function NatureSwitcherSheet({
  open,
  onOpenChange,
  current,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  current: Nature;
  onSelect: (nature: Nature) => void;
}) {
  const [showReset, setShowReset] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armReset = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShowReset(true), 1000);
  };
  const disarmReset = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const pick = (nature: Nature) => {
    buzz();
    onSelect(nature);
    setShowReset(false);
    onOpenChange(false);
  };

  const reset = () => {
    resetHubPrefs();
    buzz();
    onSelect('possession');
    setShowReset(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Changer la nature de l'aventure">
      <div className="grid grid-cols-3 gap-2 p-2">
        {NATURES.map(({ id, label, Icon }) => (
          <Button
            key={id}
            variant={current === id ? 'primary' : 'secondary'}
            data-testid={`nature-option-${id}`}
            onClick={() => pick(id)}
            onPointerDown={armReset}
            onPointerUp={disarmReset}
            onPointerLeave={disarmReset}
            aria-pressed={current === id}
            className="!flex-col !gap-1.5 !rounded-[var(--lkv-radius-md)] !px-2 !py-3"
          >
            <Icon size={18} aria-hidden="true" />
            <span className="text-xs font-semibold">{label}</span>
          </Button>
        ))}
      </div>
      {showReset && (
        <div className="px-2 pb-2">
          <Button
            variant="ghost"
            fullWidth
            onClick={reset}
            className="!rounded-[var(--lkv-radius-md)] text-xs font-semibold !text-[var(--lkv-danger)]"
          >
            Réinitialiser (retour Matériel)
          </Button>
        </div>
      )}
    </Sheet>
  );
}

export default NatureSwitcherSheet;
