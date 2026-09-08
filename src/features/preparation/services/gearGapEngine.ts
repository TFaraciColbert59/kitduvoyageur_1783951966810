import {
  identifyDuplicates as canonDuplicates,
  identifyMissingVitals as canonVitals,
  identifyHeavyItems as canonHeavy,
  generateShakedownReport as canonReport,
  detectGearGaps as canonGaps,
  HEAVY_THRESHOLDS as canonThresholds,
  ESSENTIAL_GEAR_CHECKLIST as canonChecklist,
} from '@/features/materiel/domain/shakedownEngine';
import type { GearItem, ShakedownReport, GearGapItem } from '../types/preparation.types';

export const HEAVY_THRESHOLDS = canonThresholds;
export const ESSENTIAL_GEAR_CHECKLIST = canonChecklist;
export const identifyDuplicates: (items: GearItem[]) => string[] = canonDuplicates;
export const identifyMissingVitals: (items: GearItem[]) => string[] = canonVitals;
export const identifyHeavyItems: (items: GearItem[]) => { itemId: string; name: string; weightGrams: number; thresholdGrams: number }[] = canonHeavy;
export const generateShakedownReport: (items: GearItem[]) => ShakedownReport = canonReport as (items: GearItem[]) => ShakedownReport;
export const detectGearGaps: (items: GearItem[]) => GearGapItem[] = canonGaps as (items: GearItem[]) => GearGapItem[];
