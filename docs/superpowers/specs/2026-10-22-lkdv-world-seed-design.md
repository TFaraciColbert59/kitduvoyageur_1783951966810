# Le Monde LKDV — design du seed de démonstration

Date : 2026-10-22
Statut : validé (plan approuvé par le porteur du projet)

## 1. Objectif

Créer dans le projet Supabase `icxyvwzfjbflcbqukpfz` un monde crédible et complet :

- 50 comptes résidents fictifs, couvrant tous les types de personnes, profils et états de vie ;
- 1 compte démo ultra-complet (Léa Fontaine, `demo@lkdv.app`) utilisable comme vitrine ;
- la vie correspondante sur toutes les surfaces réellement lues par l'app (fil, stories, carnets, sorties, voyages, clubs, événements, messagerie, matériel, commerce, fidélité, progression) ;
- un système idempotent, rejouable, vérifiable et réversible.

Ce design s'appuie sur l'audit du 2026-10-22 et sur le code courant
(`/Users/fr168256/Desktop/kitduvoyageur_1783951966810`).

## 2. Contraintes découvertes

1. `public_profiles` exclut `is_demo = true`. Tout auteur absent de cette vue
   s'affiche « Membre » et `/profil/<id>` renvoie 404. Les 50 résidents et le
   compte démo sont donc `is_demo = false` et `profile_visibility = 'public'`
   (sauf 3 profils privés assumés).
2. Les compteurs likes/commentaires/carnets/participants/`last_message_at` sont
   maintenus par triggers. `clubs.members_count`, `conversations.members_count`,
   `materiel_kits.total_weight_g` et `user_progression.*` sont manuels.
3. Les triggers de voyage créent un équipage, le collaborateur propriétaire et
   9 lignes de checklist. Le seed fournit `crew_id` et met à jour la checklist.
4. Les photos de sortie exigent des objets réels dans `outing-media` (privé) ;
   les stories V2 dans `stories-private`.
5. Tables mortes à ne pas seeder : `experts`, `expert_bookings`, `ambassadors`,
   `qa_*`, `ama_*`, `product_reviews`, `order_items`, `occasion_items`,
   `rental_items`, `listings`.
6. `/feed` est statique ; la surface sociale réelle est `/communaute` + stories.
7. `/groupes/:id` redirige vers `/hub/groupe` en production.
8. L'accès Supabase de l'agent est read-only : l'exécution exige
   `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`.

## 3. Casting

50 résidents répartis en 5 groupes de 10 (montagne/expertise, itinérance/van,
familles/âges/accessibilité/diversité, mer/vélo/autres pratiques,
communauté/pros/commerce). Détail complet dans `scripts/seed/world/data/personas/`.

États couverts : 3 comptes privés, 2 en 2FA, 1 suspendu des groupes, 2 blocages
mutuels, 1 demande de suivi en attente, 4 dormants, 5 nouveaux, 1 profil
incomplet.

Le compte démo est Léa Fontaine (28 ans, Lille), sœur d'Amélie Fontaine
(persona 26). Il conserve ses 4 carnets existants (TMB, Islande, Dolomites,
Jura) et ses voyages cohérents ; les brouillons « fdgb » sont requalifiés.

## 4. Volumes cibles

Voir la matrice de vie du plan approuvé. Ordre de grandeur : 18 000 à 22 000
lignes, dont ~1 150 follows, ~180 posts, ~160 stories, ~65 carnets, ~190
sorties, ~100 voyages, ~1 300 messages, ~2 500 notifications (dont une partie
générée par triggers).

## 5. Architecture

```
scripts/seed/world/
  run.mjs                 CLI : --dry-run, --apply, --verify, --refresh, --cleanup
  world.mjs               modèle en mémoire
  lib/                    env, ids, time, client, schema, batch, media, manifest
  data/                   personas, médias, clubs, voyages, guides, démo
  build/                  un builder par domaine
  verify/                 invariants
  .cache/                 photos téléchargées (gitignore)
  .manifest/              manifeste + credentials (0600, gitignore)
```

Principes :

- UUID v5 déterministes : même seed ⇒ mêmes IDs.
- Upserts par lots de 250 avec retry/backoff.
- Préflight de chaque table/colonne avant la première écriture.
- Manifeste de chaque entité créée (table, id, persona) pour le rapport et le
  `--cleanup`.
- Médias publics : URLs Unsplash. Médias privés : téléchargement + upload
  Storage + cache par hash.
- Aucune suppression de données existantes. Sauvegarde JSON des tables
  existantes touchées avant modification.
- `--refresh` régénère la vie des dernières 24 h (stories, présence,
  notifications) pour que la démo reste vivante.

## 6. Ordre d'écriture

1. auth.users (admin API, `email_confirm: true`) → user_profiles (trigger)
2. annexes de profil (préférences, adresses, documents, voyageur, orientation)
3. réseau (follows, demandes, blocages, vues)
4. équipages → voyages (avec `crew_id`) → étapes/items/dépenses/docs/notes/POI/
   checkpoints/collaborateurs/participants/invitations → checklist mise à jour
5. sorties + activités miroir + photos + participants/kudos/commentaires/gear
6. carnets + médias + moments + interactions
7. posts + commentaires + likes + saves + shares ; stories + vues + likes +
   highlights
8. clubs + membres + sujets/réponses + événements de club
9. événements + participants
10. groupes de voyage + membres/tâches/kit/dépenses/messages/sondages
11. conversations + membres + messages + réactions
12. commandes, réservations, matériel, prêts, alertes, annonces marketplace
13. fidélité (loyalty_history → trigger points) + récompenses + échanges
14. progression (user_progression, saison, territoire, badges, challenges,
    événements, leaderboard)
15. notifications curatées, présence, lkv_events
16. réconciliation des compteurs manuels
17. vérification

## 7. Recette

Invariants SQL : 51 profils, emails/handles uniques, auteurs visibles dans
`public_profiles`, compteurs cohérents, activités miroir, stories non expirées,
aucun contenu public orphelin d'auteur, aucune donnée réelle modifiée.

Recette visuelle : connexion réelle sur l'app déployée avec le compte démo,
captures mobile et desktop des 15 surfaces principales, aucune zone vide sur les
surfaces clés, aucune erreur console.

## 8. Décisions par défaut

- Démo `is_demo = false` (contrainte de la vue `public_profiles`).
- Quarantaine réversible des comptes de test clairement identifiés.
- 12 clubs existants enrichis ; doublons masqués.
- 16 nouveaux événements à venir ; anciens doublons en `past`.
- Photos Unsplash réelles + uploads Storage pour les buckets privés.
- Aucune modification du code applicatif dans ce chantier.
- Mots de passe aléatoires pour les 50 ; démo réinitialisé et documenté.
- Aucun commit sans accord.
