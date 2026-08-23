'use client';

import { useEffect } from 'react';

export default function MigrationEffect() {
  useEffect(() => {
    // This effect runs once on client-side mount.
    // In a real app, we might run migration logic here.
    // For now, we do nothing.
    console.log('MigrationEffect: no-op');
  }, []);

  return null;
}