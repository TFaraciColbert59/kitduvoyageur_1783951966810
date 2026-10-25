/**
 * LKDV DESIGN SYSTEM — façade unique.
 *
 * Point d'entrée canonique : `import { … } from '@/design'`.
 *
 * - Tokens : src/design/tokens.ts (miroir typé de src/styles/tokens.css).
 * - Primitives : src/components/ui/ (convention DESIGN_SYSTEM.md, non dupliquée ici).
 * - Layouts : src/design/layouts/.
 *
 * Aucune implémentation n'est dupliquée : cette façade ne fait que réexporter
 * les sources uniques pour offrir un import unique aux features.
 */
export * from './tokens';
export { default as tokens } from './tokens';
export * from '@/components/ui';
export * from './layouts';
