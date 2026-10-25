'use client';

import { Sheet } from '@/components/ui/Sheet';

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * MobileSheet — bottom sheet réutilisable unifiée autour de la primitive canonique Sheet.
 * Fournit l'accessibilité Radix Dialog (focus trap, Escape, aria), les animations
 * CSS GPU-safe, le backdrop blur Liquid Glass et la prise en compte des safe-areas iOS.
 */
export const MobileSheet: React.FC<MobileSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
    >
      <div className="py-2">{children}</div>
    </Sheet>
  );
};