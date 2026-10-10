# Handoff Report — Live Cards Métier Outdoor & Ergonomie Apple HIG (Milestone 2)

**Agent :** `explorer_m2_cards_1`  
**Date :** 2026-10-04T10:38:00Z  
**Type de Handoff :** Hard (Mission d'exploration et de conception achevée)  
**Destinataires :** Orchestrateur, `worker_m2_algo_1`, `worker_m2_algo_2`, `reviewer_m2_1`, `challenger_m2_1`

---

## 1. Observation

1. **Goulot d'étranglement de `GPXPreviewCard.tsx`** :
   Dans `src/features/messaging/components/GPXPreviewCard.tsx` :
   - Lignes 42–56 :
     ```typescript
     if (gpxUrl) {
       setLoading(true);
       fetch(gpxUrl)
         .then((res) => res.text())
         .then((text) => {
           if (!isMounted) return;
           const parsed = GPXEngine.parseGPX(text);
           setGpxData(parsed);
         })
     ```
   - Lignes 67–109 : Une boucle Haversine recalcule les distances et dénivelés sur chaque montage du composant dans le scroll de la liste de messages.
   - Ce traitement bloque le thread UI principal avec le `DOMParser` du navigateur, causant des pertes de frames (jank) lors du défilement d'un fil de messages.

2. **Absence d'interactivité collective dans `KitCard.tsx`** :
   Dans `src/features/messaging/components/KitCard.tsx` :
   - Lignes 17–38 : La carte ne comporte aucun indicateur de poids chiffré, aucun décompte d'objets, aucune répartition par catégorie et aucun moyen de fusionner les sacs d'un groupe en expédition.

3. **Logique métier de charge existante dans `loadDistribution.ts`** :
   Dans `src/features/preparation/services/loadDistribution.ts` :
   - Lignes 8–9 :
     ```typescript
     export const DEFAULT_DOG_PORTAGE_RATIO = 0.15; // 15% du poids corporel max pour un chien
     export const DEFAULT_HUMAN_MAX_RATIO = 0.20; // 20% du poids corporel max recommandé pour un humain
     ```
   - Lignes 58–109 : `calculateParticipantLoads` calcule la conformité et détecte les surcharges physiologiques.

4. **Primitive de Bottom Sheet Apple existante dans `src/components/ui/Sheet.tsx`** :
   - Lignes 20–22 & 41–52 : Support natif de `dragToDismiss`, Radix Dialog, safe-area insets (`pb-[calc(var(--safe-bottom)+var(--space-4))]`), detents `'auto' | 'medium' | 'large'`.
   - Bouton de fermeture avec cible tactile 44px (`h-11 w-11`).

5. **Tokens de Design Système dans `tokens.css` et `liquid-glass.css`** :
   - `tokens.css` Lignes 18–29 : Vert forêt `--lkv-primary: #17402C`, Vert action `--lkv-action: #226148`, Sauge `--lkv-secondary: #5B7F55`. Règle stricte d'interdiction de `#E4501C` (orange).
   - `liquid-glass.css` Lignes 32–48 : Classe `.glass`, `backdrop-filter: blur(var(--card-blur)) saturate(var(--card-saturate))`.

---

## 2. Logic Chain

1. **Rupture de performance au scroll** (Observation 1) $\to$ Pour garantir 60/120 fps et 0ms de temps de chargement au défilement, le composant `GPXLiveCard.tsx` ne doit effectuer aucun appel réseau `fetch` ni aucun appel au `DOMParser` côté client. Il doit consommer un snapshot pré-calculé `GPXSnapshot` contenant la polyligne vectorielle normalisée `svgPolylinePath` (`viewBox="0 0 240 80"`).
2. **Problème de saturation du fil (Thread Flooding)** (Observations 1 & 2) $\to$ L'insertion d'objets riches (tracés, inventaires de 30 articles) dans les bulles de messages doit respecter une divulgation progressive (*Progressive Disclosure*) :
   - Dans le thread : cartes compactes plafonnées à `max-w-[280px]` (mobile) et hauteur $< 200\text{px}$.
   - Au tap : ouverture d'une vue dédiée en Bottom Sheet native (`PackMergeSheet.tsx`).
3. **Collaboration outdoor & mutualisation de portage** (Observations 2 & 3) $\to$ `KitLiveCard.tsx` intègre un bouton d'action système 44px "Pack Merge". Au clic, il ouvre `PackMergeSheet.tsx` qui applique immédiatement les seuils de `loadDistribution.ts` : 20% pour les humains et 15% pour les chiens de portage, avec calcul des gains en poids collectif et repérage visuel des doublons éliminés.
4. **Fidélité ergonomique Apple HIG** (Observations 4 & 5) $\to$ Les interfaces utilisent les classes canoniques Liquid Glass, les polices Söhne/Inter avec JetBrains Mono pour les chiffres tabulaires (`tabular-nums`), des zones de frappe minimales de 44x44px, et respectent scrupuleusement la safe-area iOS.

---

## 3. Caveats

1. **Production des Snapshots à la Source** : Les composants Live Cards s'attendent à ce que le message contienne un objet typé dans `message.metadata` (ex: `metadata.type === 'gpx_snapshot'`). Si un message brut ancien arrive avec seulement une URL GPX ou un `KitMessageMeta` legacy, un adaptateur de repli rétrocompatible (`fallback`) a été prévu dans l'architecture pour maintenir la compatibilité.
2. **Précision des coordonnées SVG** : Le viewBox standard retenu pour les miniatures de tracés est `240 x 80` (cohérent avec `TraceMiniMap.tsx`). Les tracés fermés en boucle et les tracés linéaires partagent la même projection normalisée.
3. **Aucun composant de code source n'a été modifié directement** : En tant qu'agent `explorer` en mode lecture seule, ce rapport livre les spécifications, modèles TypeScript et implémentations de référence complètes dans `analysis.md` prêtes pour les implémenteurs (`workers`).

---

## 4. Conclusion

L'architecture UI de Milestone 2 est entièrement spécifiée et documentée dans `analysis.md`. Elle apporte :
1. **`GPXLiveCard.tsx`** : Rendu vectoriel immédiat (0ms, 0 fetch, 0 DOMParser) via `svgPolylinePath` et métriques tri-colonnes.
2. **`KitLiveCard.tsx`** : Carte compacte d'inventaire avec barre segmentée par catégorie et déclencheur Pack Merge.
3. **`PackMergeSheet.tsx`** : Bottom sheet native Apple HIG affichant le dédoublonnage de groupe, les barres de charge avec ratios de sécurité (20% humain / 15% chien), et la répartition du matériel partagé.
4. **`EquipmentLiveCard.tsx`** : Fiche d'équipement compacte avec affichage précis du poids en grammes (`JetBrains Mono`).
5. **`ExpeditionLiveCard.tsx`** : Carte vivante avec statut d'avancement, compte à rebours de départ et pile d'avatars.
6. **Intégration Anti-Flooding** : Enchâssement strict dans `MessageBubble.tsx` / `MessageItem.tsx` avec largeur $\le 280\text{px}$ et divulgation progressive.

---

## 5. Verification Method

Pour vérifier indépendamment cette conception :
1. **Contrôle des fichiers spécifiés** :
   Consulter le document maître :
   `c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_m2_cards_1\analysis.md`
2. **Vérification de non-régression et conformité des tokens** :
   Exécuter les tests de tokens existants :
   ```powershell
   npx vitest run tests/design/tokens-sync.spec.ts
   ```
3. **Vérification de l'absence de couleur orange `#E4501C`** :
   S'assurer que ni les spécifications ni les codes proposés n'introduisent `#E4501C`.
4. **Test de type et intégration** :
   Dès implémentation par les workers, vérifier que `npm run type-check` compile sans erreur et que les tests unitaires de composants dans `tests/messaging/outdoor-live-cards.spec.ts` valident le rendu des snapshots.
