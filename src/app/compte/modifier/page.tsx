'use client';

import React from 'react';
import Header from '@/components/Header';
import EditProfileView from '@/components/compte/EditProfileView';

export default function EditProfilePage() {
  return (
    <div className="min-h-screen bg-[#F5F2E8]">
      <Header />
      <div className="pt-16">
        <EditProfileView />
      </div>
    </div>
  );
}
