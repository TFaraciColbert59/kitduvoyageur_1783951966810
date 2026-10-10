# Handoff Report — explorer_social_ui_1

**Agent** : `explorer_social_ui_1` (UI, Live Cards & Expedition Rooms Specialist)  
**Tâche** : Audit d'architecture UI, Live Cards et Expedition Rooms pour « LKDV Social »  
**Destinataire** : Orchestrateur (`22810fd4-62f8-4724-853b-2cdeda826f11`) / Équipe de développement  
**Livrable principal associé** : `.agents/teamwork/explorer_social_ui_1/survey_report_ui.md`

---

## 1. Observation

1. **Socle canonique de messagerie** :
   - Fichier `src/features/messaging/types/messaging.types.ts` (l. 1-13) :
     ```typescript
     export type ConversationType = 'direct' | 'group';
     export type MessageType =
       | 'text' | 'image' | 'video' | 'file' | 'system'
       | 'audio' | 'gpx' | 'product' | 'trail' | 'kit';
     export type MemberRole = 'member' | 'admin' | 'owner';
     ```
     Actuellement limité aux types de base. Ne prend en charge ni les salons thématiques de club, ni les expéditions, ni les nouveaux types de cartes d'action.
   - Fichier `src/features/messaging/components/GPXPreviewCard.tsx` (l. 42-57) :
     ```typescript
     if (gpxUrl) {
       setLoading(true);
       fetch(gpxUrl)
         .then((res) => res.text())
         .then((text) => {
           const parsed = GPXEngine.parseGPX(text);
           setGpxData(parsed);
         })
     ```
     Le composant refait une requête HTTP distante et parse du XML par DOMParser côté client à chaque affichage, ce qui sature le thread de discussion et provoque des saccades au défilement.
   - Fichier `src/features/messaging/components/KitCard.tsx` (l. 12-40) :
     Affiche uniquement un encart avec le nom et "Voir la lignée →". L'action "Pack Merge", le poids total et le décompte d'articles n'existent pas encore.
2. **Fragmentation des groupes et de la messagerie** :
   - Fichier `src/components/groupes/DiscussionCard.tsx` (l. 70-80) :
     Insère directement dans `group_messages` au lieu d'utiliser `src/features/messaging/services/messagingService.ts` et la table canonique `messages`.
   - Fichier `src/components/clubs/MobileClubDetailView.tsx` (l. 73-87) :
     La section "Discussions" est branchée sur des topics de forum asynchrones et non sur des salons de messagerie en temps réel.
   - Fichier `src/components/clubs/ClubTeamCard.tsx` (l. 97) :
     Les rôles sont limités à `'admin'` ("👑 Leader") et `'moderator'` ("🛡️ Modérateur"). Les rôles de Guide et de Sécurité ne sont pas matérialisés.
3. **Briques existantes réutilisables pour les Expedition Rooms** :
   - `src/features/hub/components/weather/WeatherStrip.tsx` : implémente `variant="capsule"` et `variant="strip"` avec prévisions réelles Open-Meteo.
   - `src/features/trips/components/TraceMiniMap.tsx` : implémente un rendu SVG vectoriel projeté ultra-léger et fluide de tracés GPS.
   - `src/features/terrain-live/components/QuickReportSheet.tsx` : implémente un flow en 3 gestes (catégorie, gravité, confirmation) avec cibles tactiles de 44px min et respect de `prefers-reduced-motion`.
   - `src/components/groupes/HeroVoyage.tsx` : propose un en-tête d'expédition avec décompte J-X et métriques (durée, km, D+, nombre de voyageurs).
   - `src/components/groupes/EquipementCard.tsx` : gère le matériel personnel vs partagé, le poids en grammes et les catégories outdoor.
4. **Design System & Ergonomie Mobile** :
   - Fichier `src/styles/tokens.css` (l. 325-330, l. 437-446) :
     - `--control-height-md: var(--lkv-touch-min); /* 44px */`
     - Matériau verre canonique : `--glass-blur: 26px; --glass-saturation: 1.10; --glass-base: rgba(12, 16, 14, 0.34);`
     - Gestion des safe-areas : `--safe-top`, `--safe-bottom`, `--keyboard-inset`.
   - Fichier `src/components/glass/GlassSurface.tsx` : niveaux G1, G2, G3, GC prêts à l'emploi.

---

## 2. Logic Chain

1. **Sur l'invariance d'absence de système parallèle** :
   - *Observation* : `src/components/groupes/DiscussionCard.tsx` utilise une table legacy `group_messages`, alors que le projet dispose de `src/features/messaging/`.
   - *Déduction* : Créer une nouvelle messagerie pour les Expedition Rooms violerait l'exigence R1/R3 du mandat. L'ensemble des salons de clubs et des salles d'expédition doivent pointer vers des `conversation_id` canoniques.
2. **Sur la performance des Live Cards dans le chat** :
   - *Observation* : `GPXPreviewCard.tsx` effectue des requêtes réseau et un parsing XML à chaud pour chaque bulle de message.
   - *Déduction* : Dans un fil de 100 messages, cela sature le réseau mobile et provoque des saccades. La solution réside dans un **snapshot précalculé** stocké dans `message.metadata` (métriques + polyline SVG prête via `TraceMiniMap`), ouvrant une modal ou une page carte détaillée au tap.
3. **Sur l'action Pack Merge** :
   - *Observation* : `EquipementCard.tsx` possède déjà les concepts de matériel partagé, de poids en grammes et d'import d'articles. `KitCard.tsx` est actuellement passif.
   - *Déduction* : L'action Pack Merge sur `KitLiveCard` doit ouvrir une `PackMergeSheet` qui réutilise cette logique de comparaison de charges et de détection de doublons (ex: deux réchauds ou tentes redondantes).
4. **Sur la structure des Expedition Rooms** :
   - *Observation* : Les composants de météo (`WeatherStrip`), de trace (`ParcoursCard`/`TraceMiniMap`), de checklist (`EquipementCard`) et de check-in (`QuickReportSheet`) existent déjà de manière dispersée.
   - *Déduction* : L'Expedition Room n'a pas besoin de réinventer ces briques, mais de les orchestrer dans un **layout multi-pane réactif** (onglets/bottom-sheets sur mobile, disposition split 2/3 colonnes sur desktop) avec le fil de discussion comme colonne vertébrale.
5. **Sur l'intégration de Terra AI** :
   - *Observation* : L'exigence R4 impose que les actions de Terra restent au stade de brouillon et que ses citations soient traçables.
   - *Déduction* : Terra ne doit jamais publier de sondage ou créer d'expédition directement. L'UI doit fournir une `TerraDraftActionCard` avec des boutons explicites *Valider* et *Rejeter*, et un tiroir *Quiet Catch-Up* muni de liens de jump-to-message avec animation de surbrillance.

---

## 3. Caveats

- **Backend / Migrations** : Ce rapport se concentre sur l'UI, les composants et les contrats de métadonnées Frontend. Les migrations de bases de données (tables `expeditions`, champs `sequence_number` et `client_nonce` sur `messages`, trigger de notification) relèvent de la responsabilité des spécialistes Backend/Database.
- **Cartographie lourde sur mobile** : L'instanciation de multiples cartes Leaflet/MapLibre simultanées consomme de la mémoire RAM mobile. L'Expedition Room mobile doit monter la carte interactive uniquement lorsque l'onglet "Itinéraire" est actif, en privilégiant `TraceMiniMap` (SVG léger) pour les vues d'ensemble.

---

## 4. Conclusion

1. L'architecture UI proposée unifie l'ensemble des interactions communautaires et d'expéditions sur le socle canonique `src/features/messaging`.
2. Le système de **Live Cards** résout la saturation du flux de discussion en scindant l'affichage en **snapshots passifs instantanés** (hauteur < 180px) et en **drawers d'action interactifs** (Pack Merge, inspection GPX, validation Terra).
3. Les **Expedition Rooms** transforment la messagerie de groupe en véritable cockpit d'aventure multi-pane intégrant en direct la météo réelle Open-Meteo, l'itinéraire, la checklist de matériel mutualisé et les check-ins de terrain.
4. L'ergonomie respecte strictement les critères Apple HIG : SF Pro, tokens Liquid Glass (G1/G2/G3), cibles tactiles de 44px min et retours haptiques.
5. Toutes les spécifications, contrats TypeScript et matrices de composants sont formalisés en détail dans `survey_report_ui.md`.

---

## 5. Verification Method

Pour vérifier de manière indépendante les constats et s'assurer de l'absence de régressions lors des futurs développements :
1. **Inspection des fichiers analysés** :
   - Inspecter `src/features/messaging/types/messaging.types.ts`
   - Inspecter `src/features/messaging/components/GPXPreviewCard.tsx`
   - Inspecter `src/features/messaging/components/KitCard.tsx`
   - Inspecter `src/features/hub/components/weather/WeatherStrip.tsx`
   - Inspecter `src/features/terrain-live/components/QuickReportSheet.tsx`
   - Inspecter `src/styles/tokens.css`
2. **Vérification de la conformité du type-check et des tests** :
   - `npm run type-check` (doit valider 0 erreur TypeScript)
   - `npm run test` (Vitest)
   - `npm run lint`
3. **Conditions d'invalidation** :
   - Si une implémentation recrée une table ou un composant de messagerie parallèle à `src/features/messaging`.
   - Si les cartes GPX continuent d'effectuer des requêtes distantes non cachées au scroll.
   - Si des actions proposées par Terra AI sont exécutées sans validation explicite dans l'UI.
