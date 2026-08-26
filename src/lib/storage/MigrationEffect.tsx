'use client';

import { useEffect } from 'react';

export default function MigrationEffect() {
  useEffect(() => {
    // Migration différée lors des périodes d'inactivité du navigateur/app
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        // Tâches de maintenance silencieuses en arrière-plan
      }, { timeout: 3000 });
    }
  }, []);

  return null;
}