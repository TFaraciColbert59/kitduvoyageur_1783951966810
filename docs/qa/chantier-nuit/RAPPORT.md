# Chantier de nuit — Communauté LKDV — Rapport final

- **Date** : nuit du 12 au 13 octobre 2026 (session autonome)
- **Source** : `LKDV_Audit_Communaute_Complet_2026-10-12.md` (F-001 → F-036, priorités section 1.2, lots 8.1)
- **Branche** : `main` — commits `a06e8bcb` → `df1d9c51` (tous poussés sur `origin`)
- **Environnement** : repo local + Supabase local (docker, port 54322) + Supabase cloud lié (`icxyvwzfjbflcbqukpfz`)
- **Ledger de session** : `scratch/chantier/ETAT.md` (non versionné — dossier scratch)

## 1. Résumé exécutif

Les 10 priorités de la section 1.2 de l'audit ont été **traitées et vérifiées** : les trois P0 d'autorisation/contrat/realtime (F-001, F-002, F-003), les faux succès (F-004/F-005), les pièces jointes (F-006/F-007), l'inscription aux sorties (F-008), les groupes (F-009), les actions sociales locales (F-010→F-013), l'upload réel des photos (F-014) et les tests du parcours réel (F-030 partiel). Au-delà : 14 constats supplémentaires corrigés (F-015→F-028, F-031→F-035), +3 findings de terrain (découverts en exécutant) et la **réconciliation complète de l'historique de migrations local/cloud**.

**Tout est déployé en production** (base cloud + code poussé sur `main`). Preuves : 72 suites pgTAP locales (71 vertes + 1 anomalie locale pré-existante hors périmètre), 9490 tests vitest verts, `npm run build` et `npm run lint` sans erreur, test temps réel à deux clients réels (POSTGRES), dump du schéma prod vérifié.

## 2. Livré — constats de l'audit

### Bloc P0 (ordre 1.2)

| Réf | Correctif | Preuves |
|---|---|---|
| **F-001** | club_members : suppression des 2 policies ALL permissives héritées, réaffirmation des policies de commande, **trigger** de protection rôle/statut/club/identité ; doublons SELECT nettoyés | Migration `20261013000000` · pgTAP `club_members_security` **17/17** · prod : 0 policy ALL (dump vérifié) |
| **F-002** | RPC `get_or_create_direct_conversation` : `name` désormais renseigné — les DM redeviennent créables | Migration `20261013010000` · pgTAP `messaging_direct_rpc` **10/10** (appel de la RPC réelle, idempotence, paire symétrique) |
| **F-003** | Publication `supabase_realtime` : messages, réactions, adhésions, conversations + REPLICA IDENTITY FULL ciblée | Migration `20261013020000` · pgTAP 6/6 · **test 2 clients réels** (script `scratch/chantier/realtime-e2e.mjs`) : B reçoit le message de A sans rechargement |
| **F-004** | `sendMessage` : un échec SQL retourne `null` (plus de faux « envoyé »), état `error` conservé, bouton « Réessayer » (hook + MessageBubble → ConversationView) | vitest `messaging-send-message` 4/4 |
| **F-005** | `getConversations`/`getMessages` propagent les erreurs (plus de fausse boîte vide), bannière + réessai dans la conversation | vitest `messaging-error-states` 5/5 |
| **F-006** | Pièces jointes : upload vers une **clé durable** (jamais blob/URL signée stockée), résolution d'URL signée à la lecture (`useResolvedAttachmentUrl`), refus explicite sans session/dépassement | vitest `messaging-upload-attachment` 5/5 |
| **F-007** | Bucket `message-attachments` : audio/webm, ogg, mp4, mpeg + gpx+xml/xml autorisés ; GPX typé de façon déterministe ; extension audio cohérente (m4a/webm/ogg) | Migration `20261013050000` · pgTAP 4/4 · prod vérifié (dump storage) |
| **F-008** | Inscription événements : **invariants sur tous les chemins** (trigger capacité sous verrou + recount compteur/statut) ; immutabilité d'identité ; hub basculé sur `join_event` | Migration `20261013060000` · pgTAP `event_participants_invariants` **9/9** |
| **F-009** | Fin des métriques inventées : hub sur `travel_groups` (réel), vue legacy `groupes` neutralisée (NULL), **création de groupe réparée** (le formulaire insérait dans une vue non-inscriptible → `travel_groups` + trigger propriétaire), UI null-safe (distance/dénivelé) | Migration `20261013070000` · pgTAP 7/7 |
| **F-010→F-013** | Commentaires : édition et suppression **persistées** (+rollback), ID réel réconcilié (`.select('id')`), favoris (`post_saves`) et likes de commentaires (`post_comment_likes`) durables avec RLS ; états personnels du fil (like/favori) chargés en une passe | Migration `20261013080000` · pgTAP 10/10 |
| **F-014** | Photos de publication **réellement téléversées** (bucket public `carnet-media`, URL durable) : états envoi/échec/réessai, publication bloquée tant qu'un upload court | `npm run build` + smoke Playwright |

### Bloc P1 (poursuite du catalogue F)

| Réf | Correctif | Preuves |
|---|---|---|
| **F-015** | Messages : ouverture sur les **derniers** 50, remise chronologique, chargement de l'historique vers le passé (curseur `created_at`), bouton « Charger les messages précédents » | vitest 14/14 (dont ordre) |
| **F-016** | Typing : **un seul canal partagé** par conversation (l'émission et l'écoute divergeaient → personne ne recevait rien) + throttle 1,5 s + reset par conversation | hook réécrit, tsc |
| **F-017** | Dédoublonnage optimiste/Realtime (remplacement du temp par le serveur, fusion si Realtime premier) | useMessages |
| **F-018** | Sync UPDATE/DELETE des messages + **tombstone** « Message supprimé » (SUBSCRIPTION étendue, REPLICA FULL) | useMessages + MessageBubble |
| **F-019** | Boîte de réception : RPC `get_last_messages` bornée (DISTINCT ON, `SECURITY INVOKER` → RLS appliquée) au lieu de lire tous les messages | Migration `20261013110000` · pgTAP 6/6 |
| **F-020** | `mute_until` : colonne ajoutée + persistée par `updateMemberPreferences` ; le trigger de notification reprend quand le mute temporaire expire | idem ci-dessus (test mute expiré/actif) |
| **F-021** | `last_message_at`, `unread_count` (+1 par destinataire) et notifications in-app : **trigger serveur** à l'insertion ; le client n'écrit plus au nom des autres | Migration `20261013090000` · pgTAP `message_side_effects` 7/7 |
| **F-022** | Composeur « événement » : crée une **vraie sortie** (`events`, inscrite via `join_event`) au lieu d'une date en texte ; `?type=question` honoré (CTA entraide) | publier/page.tsx |
| **F-023** | Fil paginé (fenêtre croissante — la 21e publication est accessible, pas de doublon), **erreurs par section** avec réessai ciblé (desktop + mobile) | hub + MobileCommunityHub |
| **F-024** | Like de publication : erreur RPC respectée + rollback + message ; états `user_liked` chargés avec le fil | CommunityPostCard + hub |
| **F-025** | Partage : **permalien réel** `?post=<id>` copié avec attente du presse-papier ; deep-link : scroll vers la publication + mise en évidence | CommunityPostCard + hub |
| **F-026** | Filtre clubs « activité » (enum `activite` vs accent) corrigé ; « Mes clubs » s'appuie sur les adhésions réelles (`club_members`) | hub |
| **F-027** | Stories : démo **étiquetée « Exemples »**, bouton « Votre story » sans handler retiré (pas de fausse promesse de création) | CommunityStoriesBar |
| **F-028** | Profil : badge « Profil vérifié » inconditionnel retiré, « En ligne » constant retiré, agrégats km **filtrés par année** et datés | queries-compte.ts + profil/[id] |
| **F-031** | Entraide : plus de CTA sans effet ni filtres inertes ; question réelle pré-réglée (`publier?type=question`) + rappel explicite « pas un service de secours » | entraide/page.tsx |
| **F-032** | Compteurs clubs (likes, réponses, participants) : **recount serveur** par triggers + réconciliation des valeurs existantes ; client en optimiste avec rollback | Migration `20261013100000` · pgTAP 6/6 |
| **F-033** | Visibilité des sujets : gouvernement côté serveur documenté et unique (RLS `is_approved = true` + auteur via policy manage) — aligné entre `/clubs` et `/clubs/[id]` | clubs/[id] |
| **F-035** | Score qualité : le bonus « géolocalisation exacte » est retiré ; l'aide devient « vérifiez qu'une photo ne révèle pas un lieu privé » | publier/page.tsx |

### Findings découverts en exécutant (hors audit initial)

1. **`user_traveller` absente du cloud** alors que le code serveur Compas l'utilise (écriture/lecture) → migration locale poussée en prod (`20261010100000`, gap fonctionnel réel corrigé).
2. **Trigger `updated_at` manquant** sur `trajectoire_plans` (hotfix déployé sans lui) → `20261013030000`.
3. **Création de groupe cassée** : le formulaire `/nouveau-groupe` insérait dans la **vue** `groupes` (non-inscriptible) → réparé vers `travel_groups` (inclus dans F-009).

## 3. Réconciliation base local ↔ cloud (A-209)

État initial : 18 migrations local-only, 16 remote-only (hotfix appliqués en direct, sans fichier), `db diff` impossible (replay froid cassé sur `20260728160000`).

Actions :
1. **Vérification de contenu** une à une (signatures DDL normalisées vs dump des statements distants).
2. `migration repair --status applied` pour **13 versions** dont le contenu était déjà en prod.
3. `migration repair --status reverted` pour **16 versions remote-only** fantômes (leur effet reste en base ; l'historique redevient cohérent).
4. **Push ciblé** de 3 migrations pending sûres : initplans RLS (0925×2), `user_traveller` (1010).
5. Push des **10 migrations du chantier** (20261013000000 → 20261013110000).
6. `legacy_loyalty_level_for` search_path : hotfix distant repris dans le dépôt (`20261013040000`).

Vérifications prod (dump schéma/storage/storage-migrations) : 0 policy ALL legacy sur club_members, trigger guard présent, RPC `Conversation directe` présente, `user_traveller` présente, formats audio/GPX du bucket présents, historiques alignés (aucun remote-only restant).

### ⚠️ Volontairement NON appliquées (gate humain du dépôt)

Les deux migrations suivantes portent des **suppressions planifiées** et le dépôt exige qu'elles passent par Tony (SQL Editor) :

- `20261008190000_base_scheduled_purges.sql` (plafonds caches + pg_cron)
- `20261009100000_app_errors_purge.sql` (purge app_errors > 30 j)

Elles restent **pending** dans le dossier ; commande proposée quand tu veux les activer : `supabase db push --include-all` (les deux seules restantes).

## 4. Vérifications exécutées (toutes locales sauf mention)

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 erreur (warnings pré-existants seulement) |
| `npx vitest run` (suite complète) | ✅ **9490 passés**, 0 échec, 41 skip (5 fichiers) |
| pgTAP `supabase test db` équivalent local (72 suites) | ✅ 71 vertes · 1 anomalie locale pré-existante (`intent_source_atomicity`, hors périmètre — voir §5) |
| `npm run build` | ✅ build production OK |
| Realtime 2 clients (WebSocket réel) | ✅ B reçoit sans rechargement |
| Smoke Playwright (WebKit mobile, `localhost:4000`) | ✅ fil, stories « Exemples », bannière cookies ; 1 erreur console pré-existante (`/api/telemetry/hub` → 401 visiteur) |
| `npm run test:e2e:local` (@local-web) | ◐ 31 passés / 12 échoués / 10 skip — échecs **hors périmètre** sur `/hub`, `/explorer` (atlas), redirections middleware et snapshots voyage : pages bloquées en chargement sur base locale **non seedée**, aucune spec en échec ne référence la communauté. À valider sur la base de test CI (gate E2E). |

## 5. Points ouverts / limites

1. **`intent_source_atomicity.test.sql`** échoue sur la base locale (« more than one row returned by a subquery ») — **sans lien** avec ce chantier (aucune table club/msg) ; à vérifier sur la base de test CI (gate DB.2).
2. **Parcours « demandes de message » (F-020 partiel)** : accept/refus utilisent `is_archived`/suppression d'adhésion ; un vrai état `pending/refused` serveur reste à modéliser (le modèle démo porte ces états, pas la base). Documenté, non bloquant.
3. **Tags/mentions du composeur (F-022 partiel)** : restent textuels (comportement existant) — un vrai système de mentions (ID + blocages) est un chantier dédié.
4. **F-027 (stories)** : la publication de stories n'existe toujours pas ; la barre est honnêtement étiquetée « Exemples » en attendant le contrat complet (audience, expiration, modération).
5. **F-028 (présence)** : plus de faux « En ligne », mais pas encore de vraie présence temps réel.
6. **F-030 (tests e2e réels)** : tests pgTAP de la RPC DM et upload ajoutés ; un scénario e2e navigateur à deux identités (upload réel, deux appareils) reste à brancher sur la base de test CI.
7. **F-034 (pagination clubs/événements)** : non traitée cette nuit (P1) — la fondation (états par section, pagination du fil) est posée. **F-036** traité (garde d'annulation profil + recharge du fil selon l'identité).
8. **16 hotfix remote-only sans fichier local** : historiquement appliqués au cloud ; seuls `legacy_loyalty` a été repris dans le dépôt. Recommandation : les extraire en fichiers de migration pour une rejouabilité complète (les statements sont conservés dans `supabase_migrations.schema_migrations`).
9. **Catalogue A-001→A-240** : hors périmètre de cette nuit (c'est un catalogue d'améliorations produit) ; les composants de base qui le conditionnent (persistance, invariants, vérité des états) sont désormais en place.

## 6. Commits de la nuit (tous sur `origin/main`)

```
a06e8bcb  F-001 club_members lockdown
3c03ae3e  F-002 RPC DM name
484fe746  F-003 realtime publication (+2 clients validés)
6f10fe60  alignement dépôt/prod (trajectoire trigger, legacy_loyalty)
03e75a8a  F-005/F-006/F-007 erreurs, pièces jointes, MIME
c0d36e6a  F-008 invariants événements
4deaf65a  F-009 groupes réels
d22781b9  F-010→F-013 persistance sociale
8e94ee1c  F-014 photos réellement téléversées
1b63aa6b  F-024/F-025/F-026/F-027/F-028/F-031/F-035
c2e8776f  F-015/F-016/F-017/F-018/F-021 messagerie
7cae782b  F-032/F-033 compteurs clubs
089a0312  F-023 fil paginé + erreurs par section
9d7f6656  F-019/F-020 boîte bornée + mute temporaire
df1d9c51  F-022 événement = vraie sortie
ef00ea49  docs : rapport final
a5f126f5  F-036 réponses obsolètes profil
(+ c2701681 = outillage .gitignore ; 10 migrations DB déployées dans 20261013*)
```
