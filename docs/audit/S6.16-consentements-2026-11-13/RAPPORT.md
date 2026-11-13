# S6.16 — Consentement santé et intégrations révocables

**Chantier** : P01 · Confidentialité et règles de publication  
**Fiche source** : `LKDV_Lancement_Autonome 2/fiches/Strava/S6.16.md` (révision de référence `571142e`), lue en lecture seule.  
**Registre** : `S6.16` — `verification_existant`, complexité 5/5, affichage contextuel.  
**Date** : 2026-11-13.  
**Portée tenue** : Compte → Appareils et services → consentements par usage, avec révocation réelle des usages prévus par le contrat existant. Aucune connexion ni aucun consentement fournisseur simulé.

## 1. Ce que la fiche demande

- Des réglages explicites et une révocation **par fournisseur et usage**.
- Un emplacement `Compte → Appareils et services → gérer et révoquer les consentements`.
- Un drawer ou sous-drawer ouvert sur action explicite ; le retour restaure le contexte du parent.
- Un contrôle des permissions, de la révocation et des tiers.
- En cas de refus d’une permission santé, la sortie GPS continue.

## 2. Contrat existant constaté

| Élément | Constat | Conséquence |
| --- | --- | --- |
| Table | `public.adventure_data_consents` : `user_id`, `purpose`, `granted`, `policy_version`, `granted_at`, `revoked_at` | Une seule dimension : la **finalité**. Aucune colonne `provider`, `account_id`, `scopes` ou `token_ref`. |
| Contrainte | `UNIQUE (user_id, purpose, policy_version)` | Un consentement fournisseur ne peut pas être représenté sans migration. |
| Finalités | `personal_performance`, `collective_terrain`, `live_location`, `group_location`, `external_readiness` | Quatre usages révocables ; la santé est une finalité désactivée. |
| Santé | `adventure_data_consents_external_readiness_disabled` (SQL), policy RLS, refus serveur `DISABLED_CONSENT_PURPOSES` | `external_readiness=true` est refusé à trois niveaux. Aucun moyen de l’activer depuis l’UI. |
| Connecteurs | `NoopReadinessProvider` seulement ; aucun adaptateur HealthKit, Health Connect, Garmin, BLE ou Strava | Aucune connexion réelle à révoquer. La fiche ne peut pas être « simulée ». |
| Révocation | `setConsent` écrit `granted=false` puis émet `consent.revoked` ; le cron `process-adventure-events` purge les dérivés | La révocation par usage est réelle et déjà outillée. |
| RLS | Lecture/écriture limitées à `auth.uid()` ; `has_active_consent` réservé à `service_role` | Aucune lecture inter-utilisateur ; l’UI passe par une route authentifiée. |

## 3. Implémentation livrée

### Service

- `src/features/adventure-intelligence/server/consents.ts`
  - Ajout de `listConsentsForUser(supabase, userId)` et `setConsentForUser(supabase, userId, purpose, granted)`.
  - `listConsents()` et `setConsent()` conservent leur signature et leur comportement (validation avant authentification, refus de `external_readiness`).
  - La révocation continue d’émettre `consent.revoked` avec la clé d’idempotence existante.
- `src/features/compte/server/consents.ts`
  - `loadConsentSettings` lit uniquement les lignes du propriétaire, retient la dernière `policy_version` par finalité (même règle que `has_active_consent`) et construit l’état d’affichage.
  - Une erreur de lecture échoue fermé (`onError: 'throw'`) : la route répond 500 au lieu d’afficher tous les usages « désactivés ».
  - Les fournisseurs sont déclarés `connected: false`, `revocable: false`, `status: 'contract_missing'`.
- `src/features/compte/domain/consentSettings.ts`
  - Contrat d’affichage client-serveur : libellés, descriptions, sensibilité, fournisseurs dépendants et usages visés.
  - Aucun type serveur `server-only` importé côté client.

### API

- `GET /api/compte/consents` : état des usages + fournisseurs bloqués, pour l’utilisateur authentifié.
- `PATCH /api/compte/consents` : `{ purpose, granted }`, validé par `zod` et par `consentPurposeSchema`.
  - `external_readiness` → `409`, même si l’appel contourne l’UI.
  - Révocation → service existant → `consent.revoked`.
  - Réponse = état relu en base, jamais un succès optimiste inventé.

### Interface

- `src/components/compte/drawer/compte/SettingsPane.tsx`
  - Nouvelle carte **« Appareils et services »** avec l’action explicite **« Gérer »**.
  - Le sous-drawer est monté à la demande ; le `SettingsPane` parent reste monté, donc la fermeture restitue le contexte du drawer Compte.
- `src/components/compte/drawer/compte/ConsentSettingsSheet.tsx`
  - Sous-drawer `OverlaySheet` (`nested`).
  - Quatre usages réglables par `role="switch"` ; l’état affiché vient de la réponse serveur.
  - **Données de santé** affichée « Désactivé / Indisponible », sans interrupteur.
  - Fournisseurs listés comme **« Non connecté / Contrat absent »**, avec la dépendance D01/D02 et les usages visés ; aucun bouton de connexion ou de révocation fournisseur.
  - Textes explicites : la révocation coupe les accès futurs et les caches contrôlés, mais ne peut pas effacer une copie déjà reçue.
- Design : classes et tokens Compte existants (`--sf`, `--label*`, `--tint`, verre clair, rayons 16–18 px, cible tactile 44 px via la pilule). Aucun nouvel écran global, aucun sixième onglet.

## 4. Granularité par fournisseur : ce qui n’est pas fait, et pourquoi

**Non implémenté, volontairement :**

- Aucun consentement n’est écrit pour `Apple Santé`, `Health Connect`, `Garmin`, `Strava` ou les capteurs BLE.
- Aucun bouton « Connecter » ou « Révoquer » par fournisseur n’est affiché.
- Aucun jeton, aucun identifiant de compte externe et aucune donnée de santé ne sont lus ou stockés.

**Raison contractuelle :** la table ne permet pas de distinguer deux fournisseurs pour une même finalité. Écrire un consentement fournisseur dans `purpose` reviendrait à inventer une finalité et à contourner la contrainte SQL. Une migration ou une nouvelle table est nécessaire ; elle est exclue de cette mission pour éviter les collisions.

**Contrat minimal à ajouter plus tard, avec D01/D02 :**

1. Une table `adventure_provider_consents` (ou des colonnes dédiées) avec au minimum :
   `user_id`, `provider_id`, `external_account_id`, `purpose`, `policy_version`, `scopes[]`, `granted_at`, `revoked_at`, `token_ref` (référence chiffrée côté serveur, jamais le jeton en clair).
2. `UNIQUE (user_id, provider_id, purpose, policy_version)` et RLS `user_id = auth.uid()`.
3. Un adaptateur par fournisseur (OAuth HealthKit/Health Connect/Garmin/Strava/BLE) avec états `not_connected`, `pending`, `connected`, `revoked`, `error`.
4. Une révocation serveur qui coupe le jeton, invalide les imports en attente, purge les dérivés et journalise l’événement.
5. Les permissions plateforme (HealthKit, Health Connect, Bluetooth) restent hors de cette fiche : elles appartiennent à D02.

Tant que ces éléments ne sont pas livrés, l’UI doit rester honnête : **aucun fournisseur connecté, aucune révocation fournisseur possible**.

## 5. Confidentialité et conception

- Aucune donnée de localisation ou de santé n’est renvoyée par l’API : seulement des booléens, des dates de consentement et des métadonnées de finalité.
- La lecture est bornée par `requireUser()` et par la RLS existante ; aucun `service_role` n’est utilisé dans la route Compte.
- Le retrait d’un usage reste soumis au service existant, donc à la purge `consent.revoked` ; l’UI ne promet pas une purge instantanée des copies déjà reçues.
- Les fournisseurs sont décrits comme des dépendances, pas comme des connexions. Aucun état « connecté » n’est fabriqué.
- Le sous-drawer réutilise `OverlaySheet`, le focus trap, la fermeture Échap et le retour de focus existants.

## 6. Dépendances documentées

| Dépendance | État | Ce qu’elle doit fournir |
| --- | --- | --- |
| D01 — Garmin / Strava | Absente | OAuth, stockage serveur des jetons, import, déduplication, révocation. |
| D02 — HealthKit / Health Connect | Absente | Autorisations plateforme, lecture/écriture, provenance, refus, reconnexion. |
| D02 — BLE | Absente | Appairage, reconnexion, trous de mesure, révocation. |
| P01 — modèle fournisseur | Absent | Table/colonnes, RLS, clés, purge et tests propriétaire/tiers. |
| Migration | **Non créée** | À planifier hors de cette mission, avec rollback et preuve de compatibilité. |

## 7. Contrôles reportés (non exécutés)

Aucun test, suite, build, lint ou `tsc` n’a été lancé, conformément à la consigne. Contrôles à passer à la fin :

```bash
npx tsc --noEmit -p .
npx vitest run tests/adventure-intelligence/consents.server.spec.ts
npx vitest run tests/adventure-intelligence/consent-enforcement.spec.ts
# puis, si disponible :
npm run lint
npm run build
```

Contrôles manuels à faire :

1. Compte → Paramètres → Appareils et services → Gérer : ouverture, fermeture, focus rendu au bouton « Gérer ».
2. Accorder puis révoquer `personal_performance` ; vérifier la ligne `adventure_data_consents` et l’événement `consent.revoked`.
3. Tenter `PATCH external_readiness=true` : attendu `409`, aucune ligne accordée.
4. Vérifier qu’aucun bouton fournisseur n’est cliquable et qu’aucun appel réseau fournisseur n’est émis.
5. Vérifier en 390×844 et 430×932 : pas de débordement, cibles ≥ 44 px, `prefers-reduced-motion`.

## 8. Fichiers modifiés / ajoutés

- `src/features/adventure-intelligence/server/consents.ts` (refactor additif, API existante préservée)
- `src/features/compte/domain/consentSettings.ts` (nouveau)
- `src/features/compte/server/consents.ts` (nouveau)
- `src/app/api/compte/consents/route.ts` (nouveau)
- `src/components/compte/drawer/compte/ConsentSettingsSheet.tsx` (nouveau)
- `src/components/compte/drawer/compte/SettingsPane.tsx` (carte + ouverture du sous-drawer)
- `docs/audit/S6.16-consentements-2026-11-13/RAPPORT.md` (ce rapport)

## 9. Limites résiduelles

- La fiche demande une révocation par fournisseur ; elle n’est pas livrable sans contrat de connexion. Le présent lot livre la partie « usage » et rend le blocage visible, sans le masquer.
- Aucun test n’a été exécuté : les affirmations ci-dessus sont des constats de code, pas des preuves d’exécution.
- Aucun commit, déploiement, appel réseau externe ou délégation n’a été effectué.
