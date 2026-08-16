# NOTIFICATIONS STATE — LE KIT DU VOYAGEUR

## 1. LES 4 INVARIANTS ABSOLUS

1. **Aucune notification n'est câblée sur une table avant d'avoir confirmé qu'elle est bien celle utilisée par le frontend actif.** Ce projet a un historique de doublons de schéma (ex. groupes FR vs EN) où écrire au mauvais endroit crée une fonctionnalité invisible. En cas de doute → étape d'audit obligatoire (section 3), jamais un choix par défaut.
2. **Toute création de notification passe par une fonction serveur centralisée, jamais par de la logique dupliquée dans chaque endpoint.** Un seul point d'entrée (`notify()` / Edge Function / trigger générique) que chaque événement appelle.
3. **Un envoi (email, push) qui échoue ne doit jamais faire échouer l'action utilisateur qui l'a déclenché.** Si l'envoi d'email plante, le like/commentaire/message doit quand même être enregistré. Notifications = asynchrone et best-effort, jamais bloquant.
4. **Aucun secret (clé API email/push) n'est écrit en dur dans le code.** Variables d'environnement / secrets Supabase uniquement.

---

## 2. ÉTAPES ET PROGRÈS

| Étape | Description | Statut |
|---|---|---|
| 1 | Audit complet (section 3) — résolution groupes, infra, tables | ✅ Complété |
| 2 | Choix du provider email (proposer 1-2 options adaptées) | ✅ Complété (Resend via REST API) |
| 3 | Choix de la stratégie push (web push navigateur standard) | ✅ Complété (Web Push standard) |
| 4 | Conception du schéma de données finalisé | ✅ Complété |
| 5 | Migrations de base (notifications, preferences, deliveries, push_subscriptions) | ✅ Complété |
| 6 | Row-Level Security (RLS) sur les tables de notifications | ✅ Complété |
| 7 | Fonction Postgres / RPC centrale `notify()` | ✅ Complété |
| 8 | Triggers Postgres automatiques (likes, favoris, commentaires) | ✅ Complété |
| 9 | Intégration côté API Routes Next.js (invitations, commandes) | ✅ Complété (group triggers & api endpoints) |
| 10 | Edge Function / API Route d'envoi d'emails (asynchrone, retry, logs) | ✅ Complété (`/api/notifications/process`) |
| 11 | API Route / Service Worker pour Web Push | ✅ Complété (`sw.js` + `/api/notifications/subscribe` + `/api/notifications/vapid`) |
| 12 | Job de digest hebdomadaire / planifié | ✅ Complété (`send_digests` SQL + `/api/notifications/digest`) |
| 13 | Logique de regroupement (messages de groupe) | ✅ Complété (15-min SQL clustering) |
| 14 | UI in-app : cloche de notifications, liste, badge non-lus | ✅ Complété (Header count badge + feed lists) |
| 15 | UI de préférences utilisateur (par type et canal) | ✅ Complété (page `/alertes` settings tab) |
| 16 | Cas spécial SOS (bypass complet des préférences, criticité SOS) | ✅ Complété (SOS tester sur la page `/alertes`) |
| 17 | Tests de robustesse et sécurité (RLS, panne SMTP, idempotence) | ✅ Complété (tests d'intrusion & tests unitaires sql validés) |
| 18 | Corrections finales, validation de build et rapports | ✅ Complété (type checks passés sans erreurs) |

---

## 3. DÉCISIONS D'ARCHITECTURE ET RAISONS

- **Résolution du doublon Groupes (Étape 1)** :
  * L'audit montre que la table active contenant 15 lignes en production est `travel_groups` (avec sa table de liaison `group_members` et sa table de chat `group_messages`).
  * La table legacy `groupes` ne contient qu'une seule ligne et est vide de messages ou d'activité collaborative réelle.
  * *Décision* : Les notifications de groupe cibleront exclusivement le schéma actif de production (`travel_groups`, `group_members`, `group_messages`, `group_tasks`, `group_expenses`).
- **Provider d'envoi d'emails (Étape 2)** :
  * Nous suggérons d'utiliser **Resend** comme fournisseur SMTP/REST unifié, car il est parfaitement intégré aux applications Next.js et permet l'envoi d'emails transactionnels de manière ultra-rapide par de simples requêtes HTTP `fetch` (sans nécessiter l'ajout de dépendances lourdes ou complexes).
- **Stratégie Push (Étape 3)** :
  * Aucune application mobile (React Native/Capacitor) n'a été détectée dans le repo. Le canal push repose donc sur l'API **Web Push standard du navigateur** via les clés VAPID et un service worker.
- **Logique de Clustering (Étape 13)** :
  * Les messages de groupe sont groupés directement au sein de la fonction centralisée `public.notify`. Si une notification non-lue pour ce groupe existe dans les 15 minutes précédentes, elle est mise à jour avec le nouveau texte du message, évitant ainsi le spam de notifications.
- **Bypass Anti-Spam sur les Likes/Follows (Étape 12)** :
  * Pour éviter de saturer l'inbox email de l'utilisateur, les notifications de likes de posts/carnets et de followers n'envoient pas d'emails unitaires individuels. À la place, la fonction `public.send_digests` les agrège périodiquement et émet un email récapitulatif unique ("X nouvelles interactions sur vos publications").

---

## 4. ÉCARTS CONSTATÉS (PROMPT VS RÉEL)

- Le prompt mentionne un schéma initial pour `notifications` : `id, user_id, type, title, message, read, created_at`. La structure réelle contient exactement ces colonnes et a été étendue comme spécifié.
- La table active de groupes est `travel_groups` et non `groupes` (confirmé par audit de ligne et de code).

---

## 5. PROBLÈMES À RÉSOUDRE / COMPLICATIONS POTENTIELLES

- *Aucun problème non résolu.*

---

## 6. ⚠️ RACCOURCIS ÉVITÉS

- **Pas de mock d'envoi bloquant** : L'envoi d'emails utilise la table `notification_deliveries` comme file d'attente asynchrone, évitant ainsi de ralentir ou de faire planter l'action utilisateur d'origine (likes/comments) si le serveur d'email subit une panne.
- **Pas de bypass RLS** : Des politiques strictes ont été implémentées pour s'assurer que les utilisateurs ne peuvent lire ou modifier que leurs propres notifications et abonnements, tout en bloquant l'accès direct aux files de livraison.
