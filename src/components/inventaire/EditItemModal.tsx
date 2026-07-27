// src/components/inventaire/EditItemModal.tsx

'use client';

import React from 'react';
import AddEditGearModal from './AddEditGearModal';
import { GearItemData } from '@/lib/mock/inventaire-marceline';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: GearItemData | null;
  onSave: (itemData: Partial<GearItemData>) => Promise<void>;
}

export default function EditItemModal({
  isOpen,
  onClose,
  initialItem,
  onSave,
}: EditItemModalProps) {
  return (
    <AddEditGearModal
      isOpen={isOpen}
      onClose={onClose}
      initialItem={initialItem}
      onSave={onSave}
    />
  );
}
