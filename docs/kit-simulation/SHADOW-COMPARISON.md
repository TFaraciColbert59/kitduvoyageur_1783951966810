# SHADOW-COMPARISON — Noyau kit-simulation vs moteurs historiques (KIT-002)

Date : 2026-10-18. Statut : comparaison hors ligne terminée ; aucun moteur
historique modifié ; aucune donnée réelle utilisée (fixtures synthétiques).

Exécution de référence : `npx vitest run tests/kit-simulation/shadow-comparison.spec.ts`
→ **11/11 verts** (chaque ligne du tableau est un test exécuté, pas une lecture).

## Périmètre comparé

| Moteur | Fichier | Entrée |
| --- | --- | --- |
| Noyau kit-simulation | `src/features/kit-simulation/core.ts` | `Option[] + Requirement[] + Conditions` |
| Shakedown canonique | `src/features/materiel/domain/shakedownEngine.ts` | `GearItem[]` |
| Checklist de départ | `src/features/materiel/domain/departCalculations.ts` | `ChecklistItem[]` |
| Kit contextuel de voyage | `src/features/trips/engine/contextualKitEngine.ts` (`computeKitWeight`) | `TripItem[]` |
| Configurateur | `src/lib/ai/configuratorCore.ts` (`analyzeKit`) | Catalogue + inventaire + clés météo/durée |

## Tableau d'attribution

| Cas | Divergence observée | Attribution |
| --- | --- | --- |
| C1 masse connue (1200+900+100+50 g) | aucune — 2250 g partout | accord arithmétique |
| C2 quantité ×2 sur 100 g | noyau/shakedown/contextual : 200 g ; checklist : 100 g | comportement historique conservé (quantité gérée en amont de `departCalculations`) — dossier §8 l'anticipe |
| C3 poids inconnu | noyau : `packWeightG=null` + `knownPackWeightG=1200` + avertissement ; contextual : `unweighedItemsCount=1`, « incomplet » ; shakedown/checklist : 1200 g silencieux | E03/E10 — zéro historique assimilé à une absence (non corrigé, préservation des appelants) |
| C4 porté 800 g | exclus du dos puis exposés séparément partout | accord sémantique |
| C5 classification 4800 g / 10000 g | shakedown : light/traditional ; contextual : ultralight/standard | deux barèmes incompatibles coexistent ; le noyau n'expose aucun badge (§10) |
| C6 sac vide | shakedown : « ultralight » (badge optimiste) ; contextual : « none » ; noyau : besoin structuré `['pack']`, aucun badge | constat du dossier §10 confirmé par exécution |
| C7 consommables inconnus | noyau : `packWeightG=null` ; checklist : 0 silencieux | E10 — inconnue vs exactitude affirmée |
| C7 bis 2 L d'eau | checklist : 2000 g via constante 1000 g/L ; noyau : grammes exigés en entrée | E10 — constante non contextualisée côté historique ; contrat strict côté noyau |
| C8 besoins (catalogue vide) | noyau : `missing=['pack']` structuré ; configurateur : `missingItems=[]`, score 40 | rôles complémentaires, pas de contradiction — « never fabricates » |
| C9 prix | noyau : 4999 cents entiers ; configurateur : 49.99 EUR flottants | unités distinctes (§7) — conversion à l'affichage uniquement |

## Conséquences pour la migration (dossier §8, étapes 3–4)

1. Les appelants de `departCalculations` ne peuvent pas être basculés tels quels
   sur le noyau sans traiter la quantité (C2) et l'inconnue (C3/C7) : ces deux
   écarts sont visibles pour l'utilisateur et doivent être expliqués, pas masqués.
2. Les badges MUL (C5) ne doivent pas être recopiés dans la nouvelle interface ;
   le noyau publie couverture et exactitude, jamais « ultralight ».
3. `contextualKitEngine.computeKitWeight` est le plus proche du noyau (quantités,
   inconnue, porté) ; c'est un candidat d'adaptation directe vers le contrat
   canonique, sans réécriture simultanée des quatre moteurs (dossier §3).
4. Aucun prix, aucune commission n'entre dans le classement du noyau (C9) ;
   la neutralité commerciale est structurelle, pas une convention.

## Limites explicites

- Fixtures synthétiques uniquement ; aucun produit réel, aucun flux de vente.
- La comparaison ne couvre pas `generateTripContextualKit` (génération de
  besoins contextuels), ni `analyzeKit` dans sa partie alertes météo : périmètre
  du lot suivant (KIT-007).
- Aucune conclusion sur la justesse physiologique ou commerciale des moteurs ;
  seules les divergences de contrat et d'arithmétique sont établies.
