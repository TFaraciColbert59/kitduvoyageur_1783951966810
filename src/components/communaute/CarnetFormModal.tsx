'use client';

import React from 'react';
import CreateCarnetView from '@/components/carnets/CreateCarnetView';

export default function CarnetFormModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (form: any) => void;
  saving?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#F5F2E8] animate-fade-in font-sans">
      <div className="relative min-h-screen">
        <CreateCarnetView onCloseModal={onClose} />
      </div>
    </div>
  );
}
