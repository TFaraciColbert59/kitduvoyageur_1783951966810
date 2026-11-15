/**
 * Point d'entrée public du contrat des modes d'activité A01 (S1.08 à S1.12).
 *
 * Ce module expose l'intégralité des types, validateurs, machines à états,
 * moteurs par mode et factory/dispatcher pour que DeepSeek puisse raccorder
 * l'UI (ExplorerV2, SheetContent, Compte → Sorties) et la persistance sans
 * conflit sur les fichiers verrouillés.
 */

export * from './types';
export * from './units';
export * from './catalog';
export * from './manualActivity';
export * from './indoorActivity';
export * from './swimActivity';
export * from './skiActivity';
export * from './rehabActivity';
export * from './modeRegistry';
