import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FILES = [
  'src/features/materiel/components/depart/DepartChecklist.tsx',
  'src/features/materiel/components/depart/DepartWeightBreakdown.tsx',
  'src/features/materiel/components/depart/DepartWeather.tsx',
  'src/features/materiel/components/depart/DepartParticipants.tsx',
  'src/features/materiel/components/depart/DepartEquipmentHub.tsx',
  'src/features/materiel/components/depart/DepartMap.tsx',
  'src/features/materiel/components/depart/DepartureSheetModal.tsx',
  'src/features/materiel/components/mobile/MobileChecklistItem.tsx',
  'src/features/materiel/components/mobile/MobileVitalAlertBanner.tsx',
];
const FORBIDDEN = [/(?<!lkv-)(?:rose|sand|forest)-\d{2,3}/, /bg-white\/(60|90)/, /dark:/];

describe('DS — composants depart purgés des classes interdites', () => {
  for (const file of FILES) {
    it(file, () => {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(src, `${file} contient ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});
