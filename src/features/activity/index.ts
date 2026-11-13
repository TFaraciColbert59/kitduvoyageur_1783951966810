/**
 * Façade publique `@/features/activity` (Lot A01 · S1.08 à S1.12).
 *
 * Ré-exporte l'ensemble du contrat des modes d'activité de
 * `@/features/explorer-v2/activity/modes` afin que les consommateurs UI et
 * persistance puissent importer indifféremment depuis `@/features/activity`
 * ou `@/features/explorer-v2/activity/modes`.
 */

export * from '../explorer-v2/activity/modes';
