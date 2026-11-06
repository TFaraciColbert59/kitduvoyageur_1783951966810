# Audit du Kit Studio actuel

**Objet audité** : `reference/Kit_Studio_actuel.html` (maquette fournie par Tony, 1 655 lignes, 200 Ko, fichier unique). Il n'existe **aucun** équivalent dans le dépôt LKDV (recherche `kit studio` : zéro module). Les modules voisins sont `src/features/kit-simulation/` (calcul de charge, 754 lignes), `src/features/kits/` (lignées, preuve terrain, `KitSheetModal`) et `src/features/materiel/`. Le Kit Studio v2 est donc une **création**, pas une migration : on porte la logique et le design de la maquette, on ne réécrit rien d'existant.

## 1. Ce qui est bon (à conserver)
| Point | Détail |
|---|---|
| 3D 100 % procédurale | Aucun modèle importé : sac, poches, sangles, objets sont construits par code (`rbox`, `itemMesh`). Zéro poids d'asset, zéro licence. |
| Moteur de métier riche | Totaux et répartition par zone, centre de gravité (`cog`), blocages (`blockers`), échange d'objets, rangement automatique, commande de pièces, points d'attache des modules, deck « Remplir le sac » et « Débrief ». |
| Modèle de données lisible | `BAGS`, `CW` (4 coloris), `ONE` (châssis, corps, 6 modules), `INV` (39 objets, 6 familles), `KITS` (3 kits), `ZONES` (8). |
| Accessibilité de base | 69 attributs `aria-*`, `role="dialog"` ×2, `aria-live`, clavier (Échap en chaîne), `prefers-reduced-motion`, `prefers-reduced-transparency`. |
| Gestes soignés | 54 cas de gestes : orbite, inclinaison, pincement « pièces séparées », glisser-déposer d'un objet vers une zone, appui long. Retour haptique centralisé (`haptic`, anti-rebond 40 ms). |
| Verre | Tokens `--lg-*` cohérents avec Liquid Glass ; `safe-area` utilisée 15 fois ; `dvh` présent. |

## 2. Défauts
### Architecture et maintenabilité (bloquants pour une intégration)
- **Monolithe** : une IIFE de ~1 100 lignes, état global unique `S`, rendu par gabarits `innerHTML` (13 occurrences, 21 `esc()`). Aucun type, aucun test, aucun découpage moteur / rendu / UI.
- **three.js r149 chargé depuis un CDN** (jsDelivr) : échec hors ligne, dépendance externe, absent de la CSP du dépôt (`csp.config.mjs` : `script-src` n'autorise pas `cdn.jsdelivr.net`), donc **bloqué en production** et le mode hors ligne (`docs/OFFLINE.md`). `three` n'est **pas** dans `package.json`.
- **Données en dur** (39 objets, 2 sacs, 4 coloris) : aucune persistance hormis deux drapeaux `localStorage` (`lkdv-kit-studio-hints`, `lkdv-kit-studio-coach`). Aucun lien avec `materiel_kits`, `trip_items`, `kit_reports`.
- **Couleurs en hexadécimal littéral** dans les données (`CW`, `INV`) : interdit pour du code neuf (règle « aucune couleur littérale nouvelle »).
- Français codé en dur, aucune extraction i18n.

### Interface (source des demandes de Tony)
- Cinq surfaces concurrentes : feuille du haut (Bilan par glissement vers le bas), feuille du bas, rail de tuiles, deck, menus, plus voile (`scrim`) et bulle d'aide. Des éléments s'ouvrent **en haut**, ce que Tony ne veut plus.
- Tuiles trop petites, vignettes 2D (pictogrammes), nom sous l'image sans hiérarchie Apple.
- Toasts et titres flottants (`hud`, `peek`, bouton « Annuler », bouton « Commander ») qui se superposent au sac et entre eux.
- Gestes cachés sans alternative visible : tirer vers le bas pour le Bilan, appui long sur la pilule, pincement.
- Bordures colorées d'état (vert, orange) incohérentes avec le reste de l'app.

### Performance et robustesse
- Boucle `requestAnimationFrame` permanente (un seul `visibilitychange`) : batterie et chauffe sur iPhone ; aucune mise en veille quand la scène est immobile.
- **Aucun traitement de `webglcontextlost`** : sur iOS, la WebView peut perdre le contexte WebGL en arrière-plan, la scène reste noire.
- `setPixelRatio` plafonné à 2 (bien), mais ombres (`shadowMap`) actives en permanence, anticrénelage activé ; aucune dégradation adaptative.
- `dispose()` quasi absent (2 occurrences) : fuite mémoire à chaque changement de sac ou de kit.
- Vignettes 3D : n'existent pas dans l'original ; la v2 de référence les génère avec un second rendu hors écran mis en cache (voir `spec/SPEC-3D.md`).

### Sécurité et conformité
- `innerHTML` : sûr tant que chaque valeur passe par `esc()`. Le portage doit **supprimer** `innerHTML` (React) ; une donnée venant de la base ne doit jamais atteindre un gabarit HTML.
- Pas de gestion RGPD à faire (aucune coordonnée), mais l'objet « Annecy » (lieu de stockage) montre qu'une donnée de localisation fine peut entrer : appliquer la règle « granularité région, jamais de coordonnées » des kits partagés.
- Aucune validation `zod` ; tout deviendra entrée utilisateur dès la persistance.

## 3. Risques du portage
| Risque | Gravité | Parade |
|---|---|---|
| Perte du contexte WebGL sur iPhone | Haute | Écouter `webglcontextlost/restored`, reconstruire la scène, affichage de repli en vignettes statiques |
| Régression visuelle en réécrivant en React | Moyenne | Maquette v2 = référence pixel ; captures Playwright 402 × 874 comparées |
| Thumbnails 3D lentes (10+ rendus) | Moyenne | Rendu unique par clé, file d'attente, cache `ImageBitmap`/dataURL, un seul moteur de rendu |
| Hauteur 30 % trop juste pour Bilan et fiches | Moyenne | Pages défilantes avec fondu, mise en page resserrée (voir `SPEC-DRAWER.md`) |
| Heurt avec la tab bar native iOS 26 | Moyenne | Page sans chrome, `NATIVE_TABBAR_ENABLED` respecté, test sur appareil |
| Dépassement du budget de performance | Moyenne | `npm run perf:budget` ; `three` chargé en `dynamic(() => import(), { ssr: false })` seulement sur la route |
| Toucher `/compas` par erreur | Haute | Garde-fou dans `verify-kit-studio.sh` (échoue si un fichier `compas` est modifié) |

## 4. Note de maturité
Moteur : bon. Interface : à refaire (déjà prototypée dans `Kit_Studio_v2.html`). Industrialisation : nulle (types, tests, persistance, hors ligne, a11y native à construire). Effort estimé : voir `plan/TASKS.md` (≈ 60 % Haiku/Sonnet, 40 % Sonnet élevé et Opus pour revue).
