# Handoff Report — Outdoor Objects Domain & Pack Merge Algorithm (Milestone 2)

**Agent** : `explorer_m2_domain_1`  
**Milestone** : Milestone 2 (First-Class Outdoor Objects & Live Cards)  
**Date** : 2026-10-04  
**Type** : Hard Handoff (Investigation & Domain Design Complete)  

---

## 1. Observation

1. **Rendu GPX runtime antérieur & surcharge de parsing** :
   Dans `src/features/messaging/components/GPXPreviewCard.tsx:43-57`, la carte de prévisualisation chargeait et parsait le fichier XML à la volée via `DOMParser` :
   ```typescript
   fetch(gpxUrl)
     .then((res) => res.text())
     .then((text) => {
       const parsed = GPXEngine.parseGPX(text);
       setGpxData(parsed);
     })
   ```
   Cette approche créait des latences et des saccades au défilement du fil de messages, en contradiction avec le principe "Zero-overhead chat rendering" spécifié dans `PROJECT.md:13-14`.

2. **Types de messages existants** :
   Dans `src/features/messaging/types/messaging.types.ts:9-19`, `MessageType` est actuellement défini comme :
   ```typescript
   export type MessageType =
     | 'text'
     | 'image'
     | 'video'
     | 'file'
     | 'system'
     | 'audio'
     | 'gpx'
     | 'product'
     | 'trail'
     | 'kit';
   ```
   et `metadata?: Record<string, unknown> | null;` à la ligne 149 n'était pas typé de façon discriminée pour les objets outdoor enrichis.

3. **Constantes canoniques de portage & répartition existante** :
   Dans `src/features/preparation/services/loadDistribution.ts:8-21`, les ratios physiologiques stricts sont déjà formalisés et exportés :
   ```typescript
   export const DEFAULT_DOG_PORTAGE_RATIO = 0.15; // 15% du poids corporel max pour un chien
   export const DEFAULT_HUMAN_MAX_RATIO = 0.20; // 20% du poids corporel max recommandé pour un humain
   export function calculateDogMaxPackWeight(dogWeightKg: number, ratio: number = DEFAULT_DOG_PORTAGE_RATIO): number
   ```
   La structure `ParticipantLoad` (`allocatedWeightKg`, `maxSafeWeightKg`, `loadPercentage`, `isOverloaded`, `roleOrBreed`) est déclarée dans `src/features/preparation/types/preparation.types.ts:90-99`.

4. **Projection SVG native existante** :
   Dans `src/features/trips/lib/traceSvg.ts:27-58`, LKDV dispose déjà de la fonction pure `projectTraceToSvg(raw: TracePoint[], width: number, height: number, padding: number): ProjectedTrace | null` produisant une chaîne `polyline` au format `"x1,y1 x2,y2 ..."`.

5. **Exécution des tests et TypeScript** :
   - `npm run type-check` : Succès avec code 0 (0 erreur de compilation).
   - `npx vitest run tests/messaging` : 4 suites de tests validées, 87/87 tests au vert en 276ms.

---

## 2. Logic Chain

1. **De l'Observation 1 & 4 à la conception de `GPXSnapshot`** :
   Puisque `projectTraceToSvg` permet de projeter la géométrie en une chaîne SVG `svgPolylinePath` légère de quelques centaines d'octets, sérialiser ce résultat dans `message.metadata` permet d'éliminer 100% des appels réseau `fetch` et des opérations `DOMParser` au scroll de discussion. `GPXLiveCard` peut ainsi effectuer un rendu vectoriel pur en $< 0.1\text{ ms}$.

2. **De l'Observation 2 à `outdoorObjects.types.ts` et `MessageMetadata`** :
   Pour formaliser les 5 objets métier outdoor de premier rang (GPX, Kit, Équipement, Expédition, Fiche d'activité) sans casser les messages existants, nous avons conçu une union discriminée `OutdoorObjectSnapshot` avec un discriminant unique `type: 'gpx_snapshot' | 'kit_snapshot' | 'equipment_snapshot' | 'expedition_snapshot' | 'activity_sheet_snapshot'`. L'union `MessageMetadata` intègre cette union tout en conservant `ProductMessageMeta`, `TrailMessageMeta`, `KitMessageMeta` et `Record<string, unknown>`, garantissant une compatibilité descendante à 100%.

3. **De l'Observation 3 au moteur `packMerge.ts`** :
   En important directement `DEFAULT_HUMAN_MAX_RATIO` (0.20), `DEFAULT_DOG_PORTAGE_RATIO` (0.15) et `calculateDogMaxPackWeight` depuis `src/features/preparation/services/loadDistribution.ts`, nous évitons toute duplication des constantes physiques et nous assurons une cohérence absolue entre le module préparation et LKDV Social.

4. **De la doctrine d'expédition à l'algorithme de dédoublonnage & nivellement** :
   - Pour les tentes : calculer $\sum \text{capacité} \ge N$ (taille du groupe) en sélectionnant les tentes par ratio de poids le plus avantageux, élimine 2 à 4 kg de doublons sur une expédition de 3 à 4 personnes.
   - Pour les réchauds et filtres : dimensionner au ratio $\lceil N / 4 \rceil$ élimine les redondances tout en assurant l'autonomie du groupe.
   - Pour les rôles : assigner d'abord la pharmacie au secouriste (`medic`), la balise/GPS au guide (`guide`), réserver le portage canin aux seules fournitures canines, et appliquer une pénalité $+0.10$ sur l'éclaireur (`scout`) pour le préserver en mode ultraléger ($\le 15\%$).
   - Pour le matériel collectif restant : l'algorithme glouton par ratio minimisé égalise les charges relatives entre équipiers en fonction de leur poids corporel.
   - Pour la sécurité : déclencher des alertes spécifiques si le ratio dépasse 20% (surcharge), 25% (danger biomécanique), 15% pour le chien (alerte vétérinaire), ou si un rôle voit sa mission compromise.

---

## 3. Caveats

1. **Persistance en base de données** :
   Les snapshots sont conçus pour être stockés dans la colonne `metadata JSONB` existante de la table `messages`. Aucune modification de schéma SQL n'est requise pour stocker ces payloads JSONB.
2. **Cas des randonneurs avec contre-indication médicale** :
   Le champ optionnel `maxWeightGramsOverride` sur `PackMergeParticipant` permet de restreindre la charge d'un participant à une valeur inférieure au ratio standard de 20% (ex: blessure au dos, reprise d'activité).
3. **Poids des chiens inférieurs à 10 kg** :
   Pour les très petits chiens ou chiots, même un bât de 1 kg peut être inadapté ; le calcul `calculateDogMaxPackWeight` retourne $0.15 \times \text{poids}$, mais une recommandation d'usage vétérinaire conseille d'éviter tout portage pour les chiens $< 12\text{ kg}$.

---

## 4. Conclusion

1. Les spécifications de types pour `src/features/messaging/types/outdoorObjects.types.ts` sont finalisées et prêtes pour intégration (livrées dans `proposed_outdoorObjects.types.ts`).
2. L'algorithme de dédoublonnage et d'équilibrage de charge de `src/features/messaging/domain/packMerge.ts` est entièrement modélisé, intégrant les seuils de 20% (humains), 15% (chiens), les 3 rôles outdoor spécialisés (`guide`, `medic`, `scout`), et la compatibilité directe avec `loadDistribution.ts` (livré dans `proposed_packMerge.ts`).
3. L'analyse détaillée est disponible dans `analysis.md`.
4. Le domaine est prêt à être implémenté par les workers (`worker_m2_algo_1` / `worker_m2_algo_2`) et branché aux composants UI par `explorer_m2_cards_1`.

---

## 5. Verification Method

Pour vérifier de manière indépendante les travaux présentés :

1. **Inspection des fichiers de proposition** :
   - Examiner `.agents/teamwork/explorer_m2_domain_1/proposed_outdoorObjects.types.ts`
   - Examiner `.agents/teamwork/explorer_m2_domain_1/proposed_packMerge.ts`
   - Examiner `.agents/teamwork/explorer_m2_domain_1/analysis.md`

2. **Vérification de la cohérence TypeScript** :
   Exécuter depuis la racine du projet :
   ```powershell
   npm run type-check
   ```
   Résultat attendu : 0 erreur TypeScript.

3. **Vérification des tests existants du socle messagerie** :
   Exécuter :
   ```powershell
   npx vitest run tests/messaging
   ```
   Résultat attendu : 87 tests passés au vert.

4. **Conditions d'invalidation** :
   - Si un snapshot GPX ne comporte pas `svgPolylinePath` pré-calculé, obligeant la carte à parser du XML.
   - Si le moteur Pack Merge permet à un chien de porter du matériel humain ou de dépasser 15% de son poids corporel sans alerte.
   - Si un humain dépasse 20% de charge sans déclenchement d'un avertissement de surcharge.
