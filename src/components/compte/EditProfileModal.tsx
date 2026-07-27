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
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#F5F2E8] animate-fade-in font-sans">
      <div className="relative min-h-screen">
        <EditProfileView onCloseModal={onClose} onSave={onSave} />
      </div>
    </div>
  );
}
