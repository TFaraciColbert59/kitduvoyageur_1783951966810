# Kit Studio v2 — rapport final

## Livré
- Route `/kit-studio` plein cadre (sans barre d'onglets) : scène three.js (sac LKDV ONE, objets rangés, fantômes, caméra de zone, gestes), tiroir iOS à 30 % de la hauteur, rail de trois cartes carrées, capsules de mode/familles/catégories, pilule du poids.
- Feuilles montées dans le tiroir : Bilan (4 pages), Fiche objet, Sac/Configuration/Lignée, Commande, et le deck « Remplir le sac » / « Débrief ».
- Domaine pur (totaux, équilibre, rangement, pièces, commande, deck) + store zustand persisté, validé par zod.
- Vignettes 3D réelles (objets et sacs) avec cache et repli SVG.
- Lien d'entrée depuis le départ (`DepartSacSection`), page `noindex`, hors ligne, perte de contexte WebGL gérée.

## Preuves
- Tests unitaires du module : **264 / 264 verts** (`npx vitest run src/features/kit-studio`).
- Suite complète : 33 fichiers / **49 tests rouges** (mesure de départ sur `main` : 33 fichiers / 54 rouges) — aucun test rouge imputable au chantier.
- E2E **WebKit mobile 402 × 874** : 6 parcours verts, en local **et sur l'aperçu Vercel** (https://kitduvoyageur-1783951966810-6t2g6e40u.vercel.app).
- Captures de référence : `docs/kit-studio/captures/kit-studio-402x874.png` (+ 393×852, 430×932, 360×800) et la maquette `reference-402x874.png` pour comparaison.
- Portes `scripts/verify-kit-studio.sh` : vert (typage complet, eslint 0, vitest, aucune couleur littérale, `/compas` intact, vie privée, identité).
- Revue indépendante T22 (`docs/kit-studio/REVIEW.md`) : 2 bloquants et 6 importants fermés ; dette documentée.
- Bundle : `/kit-studio` = 39,5 kB de page, 176 kB de First Load ; plus gros chunk contenant three ≈ 82 kB gzip (< 180 kB demandés).

## Corrections trouvées par la recette (invisibles aux tests unitaires)
- La pilule affichait **10 281 kg** au lieu de 10,3 kg (grammes lus comme des kilos).
- Le sac sortait **vert sauge** au lieu de vert forêt (`LEGACY_COLOR_LOOK`).
- Les cartes n'avaient **aucune vignette 3D** : le moteur existait mais aucun constructeur n'était enregistré (repli SVG partout).
- Les feuilles et le deck **n'étaient montés nulle part** : la pilule changeait l'état sans rien afficher.
- La bannière de consentement **recouvrait le tiroir** (masquée sur `/kit-studio`, comme sur `/explorer`).

## Non prouvé (honnêtement)
- **iPhone 16 Pro physique** : absent de la machine au moment de la recette (`devicectl` : « unavailable »). Tout est prêt (`ios/RUN-ON-IPHONE.md`) ; l'app Capacitor charge le site déployé, donc une app déjà installée montre le Kit Studio dès la mise en production, sans rebuild.
- VoiceOver, contrastes AA mesurés, budget de performance sur appareil réel : non testés.
- Conversion euros → centimes de `totals.buy/rent` : dette laissée ouverte (revue T22, important non fermé), conversion faite à la main aux quatre points d'affichage.

## Reste à faire côté Tony
1. Ouvrir l'app sur l'iPhone 16 Pro et suivre `ios/RUN-ON-IPHONE.md` §Contrôle (7 gestes).
2. Signaler tout écart visuel sur l'appareil : la recette a été faite sur le moteur WebKit, pas sur WKWebView.
