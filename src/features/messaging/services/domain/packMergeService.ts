/**
 * LKDV Social — Pack Merge Domain Service
 * File: src/features/messaging/services/domain/packMergeService.ts
 *
 * Facade domain service for group equipment deduplication and load balancing.
 */

import {
  PackMergeService,
  mergePacks,
  formatPackMergeSummary,
  type PackParticipant,
  type PackGearItem,
  type PackMergeKit,
  type PackMergeResult,
  type PackMergeOptions,
  type PackMergeInput,
  type DeduplicationDecision,
  type AssignedItem,
  type IndividualLoadResult,
} from '../../domain/packMerge';

export {
  PackMergeService,
  mergePacks,
  formatPackMergeSummary,
  type PackParticipant,
  type PackGearItem,
  type PackMergeKit,
  type PackMergeResult,
  type PackMergeOptions,
  type PackMergeInput,
  type DeduplicationDecision,
  type AssignedItem,
  type IndividualLoadResult,
};

export const packMergeService = {
  deduplicateSharedGear: PackMergeService.deduplicateSharedGear.bind(PackMergeService),
  runPackMerge: PackMergeService.runPackMerge.bind(PackMergeService),
  mergePacks,
  formatPackMergeSummary,
};
