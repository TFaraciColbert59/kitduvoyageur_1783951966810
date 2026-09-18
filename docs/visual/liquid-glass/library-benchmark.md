# Liquid Glass — comparaison technique des bibliothèques

Audit documentaire et du code source, 17 septembre 2026. Aucune mesure matérielle n'est déduite de cet audit. Les versions npm sont verrouillées pour rendre le prototype reproductible.

## Décision provisoire

Le `GlassCard` CSS reste le composant de production. `liquid-glass-react@1.1.1` et `@samasante/liquid-glass@0.1.1` sont des références de laboratoire, chargées uniquement sur `/dev/glass`. En production, cette route renvoie 404 sauf activation explicite côté serveur avec `LKDV_GLASS_LAB=1`. Aucun moteur premium n'est généralisé avant validation Android/iOS et Capacitor sur appareils.

Commande prévue : `npm install --save-dev --save-exact liquid-glass-react@1.1.1 @samasante/liquid-glass@0.1.1`.

## Sources et niveau de preuve

| Sujet | rdev | samasante |
| --- | --- | --- |
| Version npm consultée | [1.1.1](https://www.npmjs.com/package/liquid-glass-react?activeTab=versions) | [0.1.1](https://www.npmjs.com/package/%40samasante/liquid-glass) |
| Licence | MIT | MIT |
| React dans le dépôt | Peers >=18, dev React 18 | Peers >=18, dev React 19.2 |
| Next 15.5 / React 19.0.3 | Vérification locale requise | Vérification locale requise |
| SSR | Lecture directe de navigator pendant render | Détection moteur après montage, état initial déterministe |
| Safari / Firefox, arrière-plan arbitraire | Déplacement absent selon README | Wrapper material : blur, teinte et reflet ; déplacement absent |
| Réfraction Safari | Non garantie | Contenu propre ou copie `refract` nécessaire |
| Appareils / Capacitor | Aucun résultat appareil relevé | BROWSERS cite Playwright Chromium/WebKit, pas de preuve appareil physique |

Manifestes : [rdev package.json](https://github.com/rdev/liquid-glass-react/blob/master/package.json), [samasante package.json](https://github.com/samasante/liquid-glass/blob/main/package.json). Le manifeste GitHub rdev et les témoignages sur les peers npm divergent pour React 18 : ne pas convertir une plage déclarée en garantie de compatibilité.

## Audit du code rdev

Dans [src/index.tsx](https://github.com/rdev/liquid-glass-react/blob/master/src/index.tsx), `navigator.userAgent` est consulté pendant le render sans garde. Le prototype doit utiliser une boundary client `dynamic(..., { ssr: false })` : `'use client'` seul laisse Next pré-rendre le composant. Voir [guide Next 15](https://nextjs.org/docs/15/app/guides/migrating/from-create-react-app).

Chaque instance écoute mousemove et resize, met à jour React sur le mouvement de souris et relit plusieurs fois la géométrie. Il n'y a pas de ResizeObserver. Le filtre exécute trois déplacements RGB et plusieurs opérations de compositing ; plusieurs couches utilisent mix-blend-mode. Le centrage translate(-50%, -50%) imposé exige un adaptateur de placement. Le wrapper onClick est un div et les interactions sont orientées souris : la sémantique et le focus restent sous la responsabilité du prototype.

Le mode shader est une génération Canvas 2D sur CPU avec parcours des pixels et PNG data URL, pas un shader WebGL : [shader-utils.ts](https://github.com/rdev/liquid-glass-react/blob/master/src/shader-utils.ts). Il est exclu du prototype initial. Les limites Safari/Firefox sont [documentées par rdev](https://github.com/rdev/liquid-glass-react).

## Audit du code samasante

[GlassMaterial.tsx](https://github.com/samasante/liquid-glass/blob/main/src/GlassMaterial.tsx) mesure la surface avec ResizeObserver et distingue le support de backdrop-filter SVG après montage. Un wrapper ordinaire ne réfracte le fond arbitraire que sur les moteurs reconnus compatibles. Safari/Firefox conservent blur, teinte et bord lumineux. La promesse cross-browser du titre du README concerne le mode qui réfracte son contenu ou une copie explicite.

[Glass.tsx](https://github.com/samasante/liquid-glass/blob/main/src/Glass.tsx) propose des corrections WebKit et des mises à jour impératives. `live=true` entretient une boucle requestAnimationFrame. Les copies `refract` ne sont pas automatiquement inert/aria-hidden : le laboratoire utilise le mode material sans duplication d'arbre métier.

[displacement.ts](https://github.com/samasante/liquid-glass/blob/main/src/displacement.ts) génère les cartes par Canvas 2D ; mapSize vaut 512 par défaut et Canvas/ImageData sont conservés jusqu'au nettoyage. Même sans support de réfraction du backdrop, le mode material génère sa carte. Zéro dépendance ne signifie donc pas coût nul.

[BROWSERS.md](https://github.com/samasante/liquid-glass/blob/main/BROWSERS.md) annonce une vérification Playwright Chromium/WebKit, impose le filtre à 1x sur WebKit et recommande quelques lentilles compactes. Ces déclarations ne valident ni Safari iPhone réel, ni mémoire GPU, ni batterie.

## Références Apple actuelles

[WWDC26 State of the Union](https://developer.apple.com/videos/play/wwdc2026/102/) décrit une meilleure diffusion des fonds complexes, un bord sombre et des reflets plus nets, avec transparence personnalisable. Transposition Web retenue : voile lisible, séparation par contour subtil et adaptation à la réduction de transparence/augmentation du contraste.

[SwiftUI Group Lab WWDC26](https://developer.apple.com/videos/play/wwdc2026/8120/) déconseille le verre dans la zone de contenu sans fond défilant sous celle-ci. La couche de contrôles peut flotter au-dessus d'un contenu plus sobre. Cette hiérarchie soutient le système standard/premium demandé, sans transformer toutes les cards en lentilles.

Références complémentaires : [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Meet Liquid Glass WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/), [SwiftUI WWDC26](https://developer.apple.com/videos/play/wwdc2026/269/). Les API SwiftUI/UIKit restent natives : leurs règles de hiérarchie et d'accessibilité sont transposées, pas leurs garanties de rendu.

## Protocole de prototype

Trois fixtures locales sans données métier : synthèse dashboard sur fond clair dense, voyage sur décor illustré, panneau flottant sur carte schématique. Le sélecteur affiche un seul moteur à la fois pour les trois surfaces. Les rayons, couleurs, ombres et reflets viennent des tokens canoniques. Le mode standard est initial et sert de fallback lors du chargement.

Le premium est interdit en cas de préférence de mouvement réduit, transparence réduite, contraste augmenté, saveData, matériel faible connu ou absence de backdrop-filter. L'absence d'indicateur matériel n'est pas une preuve de puissance. Aucun mécanisme Web ne garantit de détecter tous les modes économie d'énergie : l'utilisateur peut forcer le mode sobre dans le laboratoire. Les bibliothèques ne sont pas importées tant que leur moteur n'est pas choisi et autorisé.

Tester les mêmes fixtures à 320x568, 390x844, 430x932, tablette portrait/paysage et desktop. Vérifier clavier, lecteur d'écran, contraste, chargement, erreur, sélection et désactivation. Comparer les frames de scroll, longues tâches et mémoire JS disponibles à la référence CSS. Des timings requestAnimationFrame seuls ne mesurent pas le GPU ni la batterie ; Lighthouse ne remplace pas les Core Web Vitals de terrain.

## Limites et validation restante

À cette étape documentaire : aucun résultat FPS, mémoire, GPU, batterie ou appareil réel n'est revendiqué. Les tests du laboratoire doivent fournir leurs versions de navigateur, appareils et contexte thermique/énergie. La publication premium reste conditionnelle à ces résultats, notamment Safari iOS et les WebViews Capacitor. Les captures desktop émulations mobiles prouvent uniquement leur rendu dans le moteur utilisé.
