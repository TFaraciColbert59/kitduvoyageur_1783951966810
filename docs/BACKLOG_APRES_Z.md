# BACKLOG APRÈS CHANTIER Z — LKDV

> Les règles gel du Chantier Z interdisent de créer une nouvelle fonctionnalité,
> route, table, couche ou blueprint tant que le chantier n'est pas finalisé.
> Les idées et défauts non traités dans la phase courante sont consignés ici et
> implémentés APRÈS la clôture du chantier.

---

## Défauts documentés mais non corrigés (GEL / hors périmètre)

### D28 — Le catalogue pilote le conseil au lieu de l'inverse
**Constat** : dans `contextualKitEngine.ts`, les recommandations d'équipement
pointent vers des slugs produits contenant `-categorie-bigbuy`. La logique
semble sélectionner les produits du catalogue partenaire (BigBuy) plutôt que
de recommander un besoin terrain puis de chercher le produit le plus adapté.

**Correction cible (post-Z)** : découpler le besoin (environnement, altitude,
saison) de l'offre produit. D'abord un moteur de besoin → puis un mapping
produit. Ne pas laisser la disponibilité catalogue déterminer le conseil.

### D29 — Libellés fournisseur « BigBuy » visibles/utilisés côté logique
**Constat** : `src/features/trips/engine/contextualKitEngine.ts` embarque des
`preferredProductSlug` génériques (`...-categorie-bigbuy`). Le slug est un
identifiant technique, mais le libellé du fournisseur peut filtrer côté
utilisateur. Règle Z-R2 : ne pas afficher de données d'un autre lieu / source
sans attribution claire.

**Correction cible (post-Z)** : stocker le fournisseur réel dans un champ dédié
(`supplier`) et l'utiliser comme métadonnée, jamais comme slug technique
sémantique. Afficher un libellé partenaire honnête si pertinent.

---

## Décision Z7 — Conformité légale (NE PAS TRANCHER)
Le régime de vente de voyages, licences ODbL, RGPD et sécurité applicative
nécessitent un **avis humain juridique**. NON implémenté — bloqué en attente.

## Z10 — Go / No-Go final
Non tranché. Dépend des 6 conditions de la spec.
