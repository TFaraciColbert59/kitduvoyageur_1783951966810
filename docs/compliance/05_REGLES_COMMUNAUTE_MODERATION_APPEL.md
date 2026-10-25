# Règles communautaires, modération et procédure d'appel

> **À VALIDER PAR UN HUMAIN HABILITÉ — BROUILLON.** Les règles ci-dessous sont une
> proposition de travail, pas un règlement juridiquement validé.

**Date du brouillon :** 2026-09-12
**Périmètre technique existant :** `community_posts`, `post_comments`,
`comment_reports`, `moderation_queue`, `user_blocks`, `notifications`.

## 1. Règles proposées (résumé)

1. Respect des personnes : pas de harcèlement, menaces, haine, harcèlement sexuel.
2. Pas de contenu illégal ni d'incitation à des pratiques dangereuses.
3. Pas de spam, publicité non sollicitée, ou usurpation d'identité.
4. Localisation : ne pas publier de coordonnées précises de tiers, de lieux
   sensibles (sites protégés, propriétés privées) ou de personnes vulnérables.
5. Contenus de terrain : signaler honnêtement (les rapports terrain sont modérés).
6. Mineurs : protection renforcée, signalement prioritaire.
7. Sanctions graduées : avertissement → retrait de contenu → suspension →
   suppression de compte, selon gravité et récidive.

## 2. Faits techniques (vérifiés Phase 8)

- Signalement : `comment_reports` (INSERT authentifié uniquement ; lecture
  restreinte au signalant, aux modérateurs et admins depuis la Phase 8).
- File de modération : `moderation_queue` (gestion `is_moderateur()`, lecture
  admin), `admin_roles` pour les modérateurs.
- Blocage utilisateur : `user_blocks` (chacun ne voit que ses blocages).
- Les signalements d'un tiers ne sont plus lisibles publiquement (correctif
  Phase 8 — `comment_reports_select_own_or_moderator`).
- Non livré à ce stade : **interface de file de revue admin** et **journal
  d'action de modération** dédié (`moderation_queue` existe mais aucune UI
  d'appel n'est implémentée). Statut : `INSUFFICIENT_DATA`.

## 3. Procédure d'appel (proposition à valider)

| Étape | Délai cible | Responsable |
|---|---|---|
| Décision notifiée à la personne (motif + règle) | immédiat | système/modérateur |
| Dépôt d'un appel (formulaire dédié ou e-mail) | 30 jours pour l'utilisateur | utilisateur |
| Revue par un modérateur différent | 7 jours ouvrés | modération |
| Décision motivée (maintien / réduction / annulation) | 7 jours ouvrés | modération |
| Recours interne de dernier niveau | selon volume | responsable conformité |

**À COMPLÉTER :** canal d'appel, délais fermes, modèle de notification, journal
d'audit des décisions, indicateurs (délai moyen, taux de réformation).

## 4. Points à trancher par un humain habilité

1. Base légale et portée des sanctions (contrat vs intérêt légitime).
2. Information des autorités pour contenus illégaux (seuils, canaux, délais).
3. Accessibilité de la procédure (langues, alternatives, personnes vulnérables).
4. Conservation des preuves de modération (durée, accès, minimisation).
