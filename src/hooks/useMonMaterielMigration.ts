import { useEffect } from 'react';
import { migrateMonMaterielStorage } from '@/lib/storage/storageVersion';

/**
 * Hook to execute mon-materiel storage migration only once on mount
 * This prevents the migration from running on every route change
 */
export function useMonMaterielMigration() {
  useEffect(() => {
    // Execute migration only once when the component mounts
    migrateMonMaterielStorage();
  }, []); // Empty dependency array means run once on mount
}