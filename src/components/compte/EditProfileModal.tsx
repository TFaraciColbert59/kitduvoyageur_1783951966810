'use client';

import React from 'react';
import EditProfileView from '@/components/compte/EditProfileView';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: any;
  onSave?: (updatedProfile: any) => void;
}

export default function EditProfileModal({ isOpen, onClose, onSave }: EditProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] overflow-y-auto bg-[color:var(--sand-100)] animate-fade-in font-sans">
      <div className="relative min-h-screen">
        <EditProfileView onCloseModal={onClose} onSave={onSave} />
      </div>
    </div>
  );
}
