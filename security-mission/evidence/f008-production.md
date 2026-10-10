# F-008 — vérification et remédiation production (2026-10-09)

Autorisation : priorité critique du propriétaire (F-008 + D1 lecture seule puis action). Aucune clé
n'a été affichée ni journalisée ; les scripts chargent `.env.local` en mémoire uniquement.

## 1. Vérification lecture seule (projet `icxyvwzfjbflcbqukpfz` — réf. extraite de l'URL publique)

Script `%TEMP%\opencode\lkdv-baseline\f008-check.mjs` — requête bornée `user_profiles` filtrée sur les
31 emails connus (aucune autre ligne lue), complétée par `auth.admin.getUserById` par id trouvé.

**Résultat : 18 comptes existent réellement en production** (sur 31 emails) :

| Groupe | Emails | Créés | `last_sign_in_at` |
| --- | --- | --- | --- |
| `@kitduvoyageur.fr` (seed 20260713170000) | 10 (marie.dupont, thomas.martin, sophie.bernard, lucas.petit, camille.leroy, antoine.moreau, julie.simon, maxime.garcia, lea.rousseau, pierre.lambert) | 2026-01-14 → 2026-07-03 | **null** pour tous |
| `@email.fr` (seeds appliqués tardivement) | 8 (marie.dupont, thomas.martin, sophie.bernard, lucas.petit, camille.leroy, antoine.moreau, julie.simon, maxime.garcia) | **2026-08-25** | **null** pour tous |
| Absents | 13 (alice.perrin, clara.fontaine, emma.fontaine, emma.henry, felix.dumont, hugo.renard, ines.chevalier, lea.roux, manon.girard, nicolas.blanc, pierre.lambert, romain.leblanc, theo.marceau) | — | — |

Enseignement : la garde temporelle initiale de la migration (`created_at < 2026-08-01`) **aurait
manqué les 8 comptes créés le 25/08** → migration corrigée (`< 2026-09-12`, cf. commit `aca62384`).

## 2. Remédiation exécutée en production (même jour)

1. **Mots de passe invalidés — 18/18** : remplacement par des valeurs aléatoires de 32 octets
   (`randomBytes(32).toString('base64url')`), jamais journalisées ni conservées
   (`f008-secure-result.json`). Aucun compte n'a de rôle `admin` (vérifié avant action).
2. **Sessions verrouillées — 18/18** : l'endpoint admin `POST /auth/v1/admin/users/{id}/logout`
   n'existe pas dans cette version GoTrue (404) ; `auth.admin.signOut` du SDK attend un JWT utilisateur
   (échec explicite). Action retenue : **bannissement admin** (`ban_duration: '876000h'`) via
   `PUT /auth/v1/admin/users/{id}`, **vérifié par relecture** `banned_until` non nul pour les 18
   (`f008-ban-result.json`). Effet : connexion refusée, refresh de jeton refusé pour un compte banni ;
   d'éventuels access tokens résiduels expirent ≤ 1 h. Aucune connexion n'était enregistrée
   (`last_sign_in_at` null partout), le risque de session active était donc très faible.

## 3. Ce qui reste

- Révoquer/annuler les bannissements si un compte de démo devait être réactivé (procédure admin).
- La migration `20261009120000_invalidate_seed_credentials.sql` (corrigée) reste la ceinture-bretelles
  côté base — non appliquée par migration (action déjà faite via API admin) ; l'appliquer ou non est
  sans risque supplémentaire (idempotente).
- Aucune suppression de contenu de démo n'a été faite (profils/clubs/avis intacts).

## 4. Preuves

- `%TEMP%\opencode\f008-secure-result.json` (mots de passe invalidés, 18/18)
- `%TEMP%\opencode\f008-ban-result.json` (bannis + vérifiés, 18/18)
- PR #85 (branche `security/fixes-wave1`) contient la migration corrigée.
