# S6.13 — Visibilité par activité et modification en lot

**Chantier** : P01 · Confidentialité et règles de publication.  
**Fiche source** : `LKDV_Lancement_Autonome 2/fiches/Strava/S6.13.md`, lue en lecture seule.  
**Contrat partagé** : `audience_activite` (S6.13 + K7.04).  
**Fiches et recherches lues** : S6.13, K7.04, recherches 11 (heatmaps/partage) et 14 (drawers), `docs/COMPTE_HANDOFF_V15.md`, `docs/COMPTE_INDISPONIBILITE_LECTURES.md`.  
**Branche sociale de départ** : `codex/lkdv-p01-social`, commit `d4f4e38` (`feat(compte): traiter les lectures secondaires indisponibles`).  
**Date** : 2026-11-13.

## 1. Demande de la fiche et arbitrage

La fiche demande « public / abonnés / moi » sur une sortie, puis un changement
rétroactif en lot depuis l’historique, avec un aperçu réellement partageable.

Le dépôt et le schéma réel ne permettent aujourd’hui que **deux** valeurs pour
`hike_sessions.visibility` :

- `private` ;
- `collective_anonymized`.

La contrainte `hike_sessions_visibility_check` est posée par
`supabase/migrations/20260911131000_a1_private_activity_observations.sql`. La
route `PATCH /api/compte/sorties/[id]` valide exactement ces deux valeurs.
`hike_sessions_select_owner_or_public_carnet`
(`20260911550000_phase8_rls_hardening.sql`) ne lit une session que pour son
propriétaire ou lorsqu’elle est liée à un carnet public. Aucune policy ne lit
une sortie via `user_follows`, aucune policy ne la lit publiquement par sa
seule audience (seul un carnet public expose sa session liée), et aucune route
ni aucun jeton de partage de sortie n’existe.

**Décision tenue** : ne pas créer de migration, ne pas inventer `followers` ou
`public` en base, ne pas présenter `collective_anonymized` comme public. Les
deux audiences demandées mais non portées par le contrat restent visibles,
désactivées, avec leur raison. Les deux valeurs réellement stockables restent
modifiables, y compris en lot.

## 2. Contrat et droits constatés

| Audience | Lecture d’une sortie | Écriture | Preuve dans le dépôt |
| --- | --- | --- | --- |
| Propriétaire | Oui | Oui | policy `hike_sessions_select_owner_or_public_carnet` + filtre `user_id` dans `sorties.ts` |
| Abonnés | Non | Non | aucune policy `user_follows` sur `hike_sessions` |
| Public | Non | Non | aucune policy publique ; seuls les carnets publics exposent leur session liée |
| Tiers bloqué | Non | Non | aucune lecture par l’audience de la sortie ; un carnet public reste un chemin distinct |
| `collective_anonymized` | Non par cette valeur (aucune vue/RLS ne l’expose pour cette raison) | Oui (valeur stockée) | contrainte SQL et `normalizeVisibility` |

Le changement de visibilité reste borné au propriétaire par
`requireUser()`, `assertOwner()` et la RLS. Le lot ne crée aucune nouvelle
autorisation : il répète le PATCH existant, une sortie à la fois.

## 3. Implémentation livrée

### Contrat d’affichage commun

`src/features/compte/domain/outingAudience.ts` décrit les quatre options
affichables, leur valeur serveur réelle, leur disponibilité et la raison
visible des options bloquées. `normalizeStoredOutingVisibility` retombe
toujours sur `private` pour une valeur inconnue : une valeur illisible ne
devient jamais publique.

`src/features/compte/client/outingVisibility.ts` appelle uniquement
`PATCH /api/compte/sorties/[id]`. Aucun endpoint de lot n’est ajouté.

### Fiche sortie → Partager → audience

`SortieDrawer` ouvre désormais `OutingAudienceSheet` depuis la pilule
« Partager » (le partage natif de l’URL du Compte, qui ne partageait pas la
sortie, est retiré). La feuille :

- propose Moi / Abonnés / Public / Collectif anonymisé ;
- n’active que Moi et Collectif anonymisé ;
- affiche la raison de l’indisponibilité de Public et Abonnés ;
- affiche la matrice des droits réellement appliquée ;
- n’écrit qu’après « Enregistrer », et n’affiche le succès qu’après la réponse
  du PATCH.

Le partage externe est explicitement annoncé indisponible : il n’existe ni
route publique, ni jeton, ni aperçu partageable de sortie.

### Historique → modification rétroactive en lot

Deux entrées existantes sont raccordées :

1. **Timeline du slot Souvenirs** (`MemoriesSlot`) : bouton « Gérer la
   visibilité », sélection des cartes, « Tout sélectionner » sur l’année
   filtrée, puis `OutingBulkAudienceSheet`.
2. **Onglet Sorties du compte** (runtime) : bouton « Gérer la visibilité »
   visible seulement pour un compte réel, qui transmet les identifiants réels
   à l’hôte React par l’événement `lkdv:open-outing-bulk`.

Le lot utilise `Promise.all` sur le PATCH existant. Chaque résultat est
compté séparément : les succès sont appliqués localement, les échecs restent
sélectionnés et sont annoncés. Aucune transaction ni aucun succès global ne
sont simulés.

Après une écriture, `lkdv:outings-changed` relit le bootstrap du Compte. Le
runtime et la Timeline ne conservent donc pas une ancienne audience.

### Données

`mapOutings` expose maintenant `visibility` (la requête le lisait déjà mais ne
le transmettait pas). `normalizeOuting` le normalise pour les cartes. Aucun
champ de base n’est ajouté.

## 4. Actions impossibles, dites explicitement

- **Choisir Public** : impossible sans migration (valeur `public`, policy de
  lecture publique, route/lien de partage, invalidation des caches).
- **Choisir Abonnés** : impossible sans migration (valeur `followers` ou
  équivalent, policy `user_follows`, distinction abonnés acceptés/demandes).
- **Partager un lien de sortie** : impossible sans route publique ou jeton
  signé révocable ; l’URL du Compte n’est pas présentée comme ce lien.
- **Rendre `collective_anonymized` public** : refusé ; cette valeur reste une
  contribution anonymisée historique, sans lecture publique directe.
- **Lot atomique** : impossible avec le contrat actuel ; le lot est une
  orchestration honnête, avec échecs partiels visibles.

## 5. Dépendances et suite hors mission

| Dépendance | État | Ce qu’elle doit fournir |
| --- | --- | --- |
| Migration `hike_sessions.visibility` | Non créée | Valeurs `followers` / `public` (ou table d’audience), contrainte et rollback. |
| Policies RLS de lecture | Non créées | Propriétaire, abonnés acceptés, public, exclusion des blocages, tiers. |
| Lien/aperçu partageable | Absent | Jeton révocable, durée, invalidation à la révocation, cache maîtrisé. |
| Médias de sortie | Bucket `outing-media` existant | Vérifier signed URLs, portée et révocation avant toute audience non privée. |
| Export GPX | Route propriétaire existante | Décider explicitement ce qu’un abonné/public peut exporter ; ne pas l’élargir par effet de bord. |
| Matrice de fixtures | À écrire | Propriétaire, abonné, invité, tiers bloqué, trace masquée, révocation. |

Une migration devra être planifiée hors de cette vague, avec inventaire des
lecteurs/écrivains, preuve sur base isolée, RLS testée et rollback.

## 6. Absence de conflit avec la branche confidentialité

La branche `codex/lkdv-p01-trace` (consentements S6.16 et masquage de trace)
modifie notamment `src/components/compte/drawer/sortie/OutingSummary.tsx`.
Ce fichier a donc été **volontairement laissé intact** : la présente vague ne
le touche pas, afin que la branche confidentialité puisse être rejouée sans
conflit sur ce composant.

Aucun fichier de `src/components/compte/drawer/compte/`,
`src/features/compte/server/consents.ts`, `src/app/api/compte/consents/` ou
`src/features/compte/server/tracePrivacy.ts` n’est modifié. Aucune migration
n’est créée.

## 7. Fichiers modifiés / ajoutés

- `src/features/compte/domain/outingAudience.ts` (nouveau)
- `src/features/compte/client/outingVisibility.ts` (nouveau)
- `src/components/compte/drawer/sortie/OutingAudienceOptions.tsx` (nouveau)
- `src/components/compte/drawer/sortie/OutingAudienceSheet.tsx` (nouveau)
- `src/components/compte/drawer/sortie/OutingBulkAudienceSheet.tsx` (nouveau)
- `src/components/compte/drawer/sortie/SortieDrawer.tsx`
- `src/components/compte/drawer/cards/OutingCard.tsx`
- `src/components/compte/drawer/memories/memoriesModel.ts`
- `src/components/compte/drawer/slots/MemoriesSlot.tsx`
- `src/components/compte/drawer/ProfileDrawerHost.tsx`
- `src/components/compte/CompteLiquidGlassV8.tsx`
- `src/components/compte/compte-liquid-glass-v8-runtime.js`
- `src/features/compte/data/accountBootstrap.ts`
- ce rapport

## 8. Contrôles reportés

Conformément à la consigne, **aucun test, suite, build, lint ni `tsc` n’a été
lancé**. Seuls un contrôle syntaxique du runtime JS (`node --check`) et un
contrôle d’espaces (`git diff --check`) ont été exécutés. Contrôles à passer à la
fin :

```bash
npx tsc --noEmit -p .
npx vitest run src/components/compte src/features/compte
npm run lint
npm run build
```

Contrôles manuels :

1. Compte réel → Sorties → Gérer la visibilité : le bouton n’apparaît pas en
   démo/guest ; en compte réel, la feuille liste les sorties réelles.
2. Sélectionner deux sorties, choisir « Moi uniquement », vérifier deux lignes
   `hike_sessions` et la relecture du bootstrap.
3. Provoquer un échec sur une seule sortie (identifiant invalide) : les succès
   restent appliqués, l’échec reste sélectionné et est annoncé.
4. Ouvrir une sortie → Partager : Public et Abonnés sont désactivés avec leur
   raison ; Moi et Collectif anonymisé sont enregistrés par le PATCH existant.
5. Vérifier qu’aucun lien public, aucun bouton de partage externe et aucun
   aperçu de trace ne sont présentés comme disponibles.
6. Vérifier au clavier et sur 390×844 : focus du sous-drawer, retour au
   déclencheur, cibles ≥ 44 px, `prefers-reduced-motion`.
7. Rejouer la branche confidentialité par-dessus sans conflit sur
   `OutingSummary.tsx`.

## 9. Limites résiduelles

- Les valeurs `followers` et `public` ne sont pas stockables : la fiche est
  livrée partiellement, par honnêteté de contrat, pas par simulation.
- Le lot n’est pas atomique et ne peut pas l’être avec le PATCH par sortie.
- `collective_anonymized` reste une valeur sans lecture publique ; l’interface
  le dit au lieu de la faire passer pour Public.
- Aucun test n’a été exécuté : les affirmations ci-dessus sont des constats
  de code, pas des preuves d’exécution.
- Aucun commit, déploiement, réseau externe au modèle ni délégation.
