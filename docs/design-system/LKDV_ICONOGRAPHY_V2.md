# LKDV V2 — migration des pictogrammes

Nouvelle bibliothèque de 244 fichiers SVG autonomes extraite de la planche LKDV validée, en vert primaire unique `#17402C`, avec fonds transparents, sans dégradé et tracé organique.

Le résolveur `Icon` privilégie ces SVG pour les 207 alias correspondants et conserve un fallback pour les symboles non couverts. `LkvIcon` délègue à cette même bibliothèque.

## Tests et validation avant fusion

Exécuter `npm run test -- tests/design-system/lkdv-v2-icons.spec.ts`, `npm run verify:icons`, `npm run type-check`, `npm run lint`, `npm run build`, puis inspection visuelle sur mobile et desktop. Ces tests n'ont PAS été exécutés sur un checkout local pendant la création de cette PR.

## Limites

Cette phase ne convertit pas tous les imports directs Lucide/Heroicons ni les dessins SVG sur-mesure (notamment `src/features/compas/v5/ui/icons.tsx`), qui exigent des adaptations et une QA spécifique. Ne pas déclarer le remplacement à 100 % avant leur audit et la réussite de CI. Aucune mise en production automatique par cette PR.
