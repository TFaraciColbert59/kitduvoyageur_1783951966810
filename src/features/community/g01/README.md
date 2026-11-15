# G01 — publication sportive, fil et profils

Périmètre : **K5.20** (j’aime/commentaires/publication d’une activité),
**S5.01** (fil d’activités), **S5.26** (statistiques et records dans le fil),
**S6.12** (profil sportif et visibilité), **S6.28** (contrôle du contenu et
lecture vidéo).

Les surfaces verrouillées P01 ne sont pas modifiées : `useCommunityFeed.ts`,
`src/app/profil/[id]/page.tsx`, `CommunityStoriesBar.tsx`,
`ReportBlockModal.tsx`, `reseau.ts`, `relationshipPolicy.ts` et
`communityFeedMappers.ts`. G01 est isolé dans `src/features/community/g01/` et
`src/components/communaute/g01/`.

## Contrats

- **Partage d’activité** : `community_posts.creation_meta` avec le schéma
  `lkdv.activity.share.v1`. Aucun `snapshot_payload`, aucun média, aucune trace,
  aucun point GPS. La séance est liée par `session_id` et une projection figée
  (`metrics`, `records`, `activity_visibility`) suffit à rendre la carte à un
  tiers, sans lecture live de `hike_sessions`.
- **Visibilité** : `resolveActivityAccess` puis `resolveSharedActivityAccess`.
  Précédence : propriétaire → blocage → visibilité de la séance → statut du
  partage → audience (`public`, `abonnies`, `club`). Toute valeur absente ou
  inconnue refuse la carte. Un blocage non prouvé refuse un compte connecté.
- **Statistiques** : `selectSportStats` choisit 2 à 4 chiffres selon le sport
  (distance, D+, durée, allure, vitesse, altitude) ; `selectSportRecords`
  n’expose pas un record privé. `redactSessionForShare` applique une liste
  blanche stricte.
- **Profil sportif** : `normalizeSportProfilePreferences` part de privé, aucun
  sport coché, seuls les booléens `true` ouvrent un sport. L’audience sportive
  ne peut jamais élargir `user_profiles.profile_visibility`.
- **Fil et vidéo** : préférences locales (`localStorage`, clé stable par
  utilisateur), autoplay désactivé par défaut, son coupé, boucle désactivée,
  économie de données active. `prefers-reduced-motion`, onglet masqué et carte
  hors écran désactivent la lecture automatique.

## Branchements prévus

- Lecture serveur : `loadSportActivityFeed(supabase, { viewerId })`.
- Écriture : `publishActivityShare` / `revokeActivityShare`.
- Rendu : `<SportActivityFeed>`, `<SportActivityCard>`, `<SportProfileSummary>`,
  `<FeedPreferencesDrawer>`, `<G01VideoPlayer>`.

## Limites connues

- S6.12 : aucune colonne de préférences sportives n’existe en base. Le contrat
  et le composant sont prêts, mais la persistance serveur et l’exposition dans
  la fiche profil verrouillée restent à brancher par le propriétaire de P01.
- S5.01/S6.28 : l’insertion dans le fil Communauté existant doit être faite par
  l’hôte de `useCommunityFeed` (fichier verrouillé) ; ce lot fournit la
  projection et les composants, pas la modification du fil verrouillé.
- Aucune migration n’a été ajoutée pour ce lot ; les écritures utilisent
  `community_posts.creation_meta`, déjà présent.

## Vérification

```bash
npx vitest run src/features/community/g01 src/components/communaute/g01
npx tsc --noEmit -p .        # contrôle global
npx eslint src/features/community/g01 src/components/communaute/g01
```
