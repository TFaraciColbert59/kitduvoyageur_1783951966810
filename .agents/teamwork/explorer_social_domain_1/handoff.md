# Handoff Report — explorer_social_domain_1

## 1. Observation

1. **Architecture `src/features/messaging/`** :
   - Fichier de types `src/features/messaging/types/messaging.types.ts` (145 lignes) : `ConversationType = 'direct' | 'group'`; `MemberRole = 'member' | 'admin' | 'owner'`; le type `Message` ne possède pas de champ `sequence_number` ni `client_nonce`. `ConversationMember` ne possède pas de champ `last_read_sequence`.
   - Fichier de service `src/features/messaging/services/messagingService.ts` (1312 lignes) : Combine un mode démo interactif (`localDemoMessages`, `demoConversationsCache`) et un mode Supabase en direct. La méthode `getMessages` (lignes 568-593) effectue un tri par `created_at` avec une limite fixe de 50 :
     ```typescript
     .order('created_at', { ascending: true })
     .limit(limit);
     ```
   - La méthode `sendMessage` (lignes 732-813) insère directement dans `messages` sans `client_nonce` ni déduplication, et tente d'insérer des notifications in-app côté client (`await supabase.from('notifications').insert(notifInserts);`).
   - Le suivi des accusés de lecture dans `src/features/messaging/components/MessageList.tsx` (lignes 209-211) repose sur une comparaison d'horodatage avec une tolérance arbitraire de `-1000ms` :
     ```typescript
     const lastReadTime = m.last_read_at ? new Date(m.last_read_at).getTime() : 0;
     if (lastReadTime >= msgTime - 1000) {
       readByCount += 1;
     }
     ```
2. **Tests existants** :
   - Frontend : `tests/messaging/messagingUtils.spec.ts` (54 lignes, 7 tests exécutés via Vitest en 478ms avec code retour 0). Couvre uniquement `formatConversationTimestamp`. Aucun test unitaire ou d'intégration pour `messagingService.ts`, les hooks ou les composants.
   - Base de données : `supabase/tests/database/messaging_security.test.sql` (166 lignes, 15 assertions pgTAP validant l'isolation RLS des conversations et l'interdiction de lecture/écriture anonyme) et `supabase/tests/database/messaging_rls_initplan.test.sql` (98 lignes, 6 tests de performance RLS).
3. **Schéma Supabase existant** :
   - Migration `20260831000000_messaging_system_canonical.sql` : Tables `conversations`, `conversation_members`, `messages`, `message_attachments`, `message_reactions`.
   - Migration `20261003120000_r1_reward_rpc_security_hardening.sql` : `claim_reward_points` sécurisée `SECURITY DEFINER` avec `search_path = public, pg_temp` strict, réservée à `service_role`.
4. **Capacités Outdoor et IA dans le workspace** :
   - Répartition de charge dans `src/features/preparation/services/loadDistribution.ts` : Fonctions `calculateDogMaxPackWeight`, `calculateDogWaterRation`, `calculateParticipantLoads` avec ratios corporels stricts (20% humain, 15% chien) et rôles `'guide'` / `'medic'`.
   - Intégration IA dans `src/lib/ai/askAI.ts` : Point d'entrée résilient avec registre de features, déduplication, gestion de quotas et course de providers.
   - Décisions engageantes dans `src/features/adventure-intelligence/domain/decisions.ts` : Modèle de décisions requérant une confirmation explicite (`requiresConfirmation`).

## 2. Logic Chain

1. **À partir de l'Observation 1.1 & 1.2** : `getMessages` ordonnance par `created_at` sans monotonicité garantie ni pagination par curseur. En environnement distribué ou sous mauvaise connexion, deux messages peuvent être inversés ou des doublons créés lors des rejeux car aucun `client_nonce` n'est transmis ni validé en base.
2. **À partir de l'Observation 1.3** : La comparaison temporelle `msgTime - 1000` pour marquer les messages comme lus crée des incohérences lors des décalages d'horloge. Un compteur arithmétique `last_read_sequence` résout ce problème de façon déterministe en O(1).
3. **À partir de l'Observation 1.1 & 1.2** : Le fichier `messagingService.ts` étant importé à travers l'application (`ConversationView`, `ConversationList`, `useMessages`, etc.), toute restructuration doit respecter le **Pattern Façade** : conserver l'objet `messagingService` intact en façade tout en déléguant à des sous-services spécialisés (`messageDomainService`, `sequenceService`, `offlineSyncService`).
4. **À partir des Observations 3 & 4** : L'intégration d'objets outdoor (tracés GPX, kits, Pack Merge, expéditions) et de Terra AI s'appuie sur des briques déjà éprouvées dans le projet (`loadDistribution.ts`, `askAI.ts`, `decisions.ts`). Terra doit agir sous le modèle de "brouillons d'actions" (`requiresConfirmation: true`) pour interdire toute mutation autonome.
5. **À partir de l'Observation 3 (Reward Hardening)** : Pour éviter le spam dans les salons de chat, l'attribution de récompenses ne doit pas indexer le volume de messages bruts, mais uniquement l'utilité réciproque validée (signalements terrain, participation au Pack Merge, expéditions achevées).
6. **À partir de l'Observation 2** : Le frontend ne possède que 7 tests sur les dates. Une suite de tests de non-régression Vitest complète est indispensable avant d'industrialiser les flux.

## 3. Caveats

- **Environnement de test Supabase local** : Les tests pgTAP nécessitent une instance Postgres / Supabase locale active pour être rejoués à la volée ; leur cohérence statique a été vérifiée via l'historique des migrations.
- **WebSocket Realtime en mode offline** : Les tests de reconnexion et de réconciliation hors-ligne devront émuler les pertes de connectivité réseau à l'aide de mocks de l'API Supabase Channel.

## 4. Conclusion

L'infrastructure actuelle de `src/features/messaging/` fournit une base solide pour l'expérience UI mais nécessite 4 consolidations critiques pour devenir « LKDV Social » :
1. **Migration SQL non destructive** : Ajouter `sequence_number`, `client_nonce` sur `messages`, `last_sequence_number` sur `conversations`, `last_read_sequence` et les rôles `guide`/`safety` sur `conversation_members`.
2. **Pattern Façade sur `messagingService.ts`** : Modulariser sans casser l'API existante.
3. **Moteur Pack Merge & Cartes GPX optimisées** : Exploiter les métadonnées pré-calculées pour éviter les lags de parsing GPX dans le chat et distribuer le portage d'expédition via `loadDistribution.ts`.
4. **Terra AI avec isolation et actions brouillons** : Résumés "Quiet Catch-Up" avec citations obligatoires et actions soumises à validation humaine.

Le rapport d'enquête exhaustif est disponible dans :
`c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\.agents\teamwork\explorer_social_domain_1\survey_report_domain.md`

## 5. Verification Method

- **Vérification Vitest du formatage existant** :
  `npx vitest run tests/messaging/messagingUtils.spec.ts` (Attendu : 7 tests passants en <1s).
- **Vérification TypeScript globale** :
  `npm run type-check` (Attendu : 0 erreur TypeScript).
- **Vérification des fichiers de rapport et d'analyse** :
  - `survey_report_domain.md` : Contient les 7 sections d'ingénierie détaillées, les interfaces TS et le schéma SQL.
  - `handoff.md` : Conforme aux 5 sections obligatoires du protocole Teamwork.
