# Définition de « terminé »

## Par tâche
- Test écrit **avant** (moteur) ou parcours Playwright (UI), rejoué vert ; sortie résumée dans le grand livre.
- `npx tsc --noEmit -p .` propre sur les fichiers touchés ; ESLint 0 erreur.
- Aucun hexadécimal littéral, aucun `rgba(0,0,0`, aucun `innerHTML`, aucun `console.log`, aucune dépendance de plus que prévu.
- Pas de modification de `src/features/compas/**` ni `src/app/compas/**`.

## Pour le chantier (toutes les cases avec preuve)
- [ ] `scripts/verify-kit-studio.sh` vert (typage, lint, Vitest du module, garde-fou `/compas`, balayage des bordures colorées, absence de couleurs littérales).
- [ ] `npm run test:unit` : pas de test rouge de plus que la mesure de départ (T00).
- [ ] `npx next build` réussi ; `npm run perf:budget` respecté ; chunk 3D < 180 Ko gzip.
- [ ] Playwright WebKit mobile : parcours complet à 402×874 + 390×844 + 430×932 + 375×667.
- [ ] Recette visuelle `SPEC-DRAWER.md` §« Critères » : 6 points, avec captures.
- [ ] a11y (`npm run test:a11y`) : 0 violation sérieuse ou critique ; VoiceOver : ordre de focus documenté.
- [ ] Mémoire : 20 cycles de changement de sac sans croissance de `renderer.info.memory`.
- [ ] Hors ligne : la scène et le dernier kit s'ouvrent sans réseau.
- [ ] Revue Opus (T22) : zéro bloquant restant.
- [ ] Production : route vérifiée (HTTP 200 et rendu) sur l'URL de production ; retour arrière testé sur papier (commande notée).
- [ ] iPhone : voir `ios/RUN-ON-IPHONE.md`, section « Contrôle sur l'appareil ».
- [ ] `docs/kit-studio/RAPPORT-FINAL.md` écrit, chiffres réels.

## Honnêteté
Un contrôle non exécutable (par exemple un geste physique) est écrit **« non testé »** avec la raison, jamais coché.
