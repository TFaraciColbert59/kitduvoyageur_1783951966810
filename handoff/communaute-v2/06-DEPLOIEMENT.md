# 06 — Livraison : GitHub, Vercel, Supabase, iPhone

Ordre strict. Chaque étape a son contrôle ; si un contrôle échoue, applique le retour arrière de l'étape et note-le dans le journal.

## 1. GitHub
1. `git push -u origin feat/communaute-v2`, ouvrir la PR vers `main` (titre `feat(communaute): tiroirs Explorer et Création au système /compte`, description : résumé, captures avant/après, liste des migrations et RPC, couverture des 200 améliorations, plan de retour arrière, lien vers ce dossier).
2. Attendre la CI complète verte. Corriger et repousser tant qu'elle ne l'est pas.

## 2. Aperçu Vercel
1. Variable `NEXT_PUBLIC_COMMUNAUTE_V2=true` sur l'environnement **Preview**.
2. L'aperçu pointe sur la **base de prod** (variables partagées). Conséquences :
   - tout ce que tu crées depuis l'aperçu est visible par de vrais utilisateurs : les règles de `00` § 4.8 s'appliquent **aussi** à l'aperçu ;
   - si une branche Supabase ou une base de staging est configurée, applique-y les migrations et branche l'aperçu dessus (préféré) ;
   - sinon, applique en prod **uniquement les migrations de la phase 1** (§ 3) avant la recette d'aperçu.
3. Dérouler `07-RECETTE.md` § A sur l'URL d'aperçu (iPhone via Safari + Playwright distant).

## 3. Migrations en production
Deux phases :
- **Phase 1 (avant la fusion)** : seulement ce qui est purement additif et n'est appelé par aucun code v1 : nouvelles colonnes, index, nouvelles fonctions (`lkdv_norm`, `community_search*`, feeds, `join_club`, `review_join_request`, `create_*`, `check_club_slug`), colonnes `client_request_id`.
- **Phase 2 (après la revue de `05` § 3, bloquante)** : tout ce qui **réécrit** une fonction ou un trigger existant ou ajoute une contrainte sur une table existante : `join_event`, `leave_event`, `sync_event_participants_count`, `guard_event_participant_insert`, `guard_event_participant_identity`, contrainte `clubs_privacy_check`. Condition : les pgTAP existants `event_participants_invariants`, `event_cancellation`, `club_members_security`, `club_last_admin` verts en CI avec ces réécritures.

Pour chaque phase :
1. **Sauvegarde** : lancer `db-backup.yml` (`gh workflow run db-backup.yml`), attendre le succès, puis **vérifier que l'artefact `sauvegarde-base` existe et date d'aujourd'hui** (`gh run download <id> -n sauvegarde-base` et contrôle de la taille). Sans artefact (secrets absents, le workflow sort alors en vert sans dump) : **arrêt avant toute migration**, cas `00` § 5.
2. **Registre** : `PROD_DB_URL=… node scripts/db/fetch-prod-ledger.mjs registre.txt && node scripts/db/migrations-alignment.mjs registre.txt --strict`. Le moindre écart `missing` inexpliqué → ne rien appliquer, documenter. En cas de `renumbered`, **n'utilise pas** `supabase db push` (il réappliquerait des fichiers déjà passés) : applique seulement tes fichiers avec `psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -1 -f <fichier>` puis enregistre la version comme le fait le dépôt.
3. **Application** : si le registre est propre, `supabase link --project-ref icxyvwzfjbflcbqukpfz`, `supabase db push --dry-run` (doit lister **exactement** tes nouveaux fichiers, rien d'autre), puis `supabase db push`. Sinon `psql -1 -f` fichier par fichier.
4. **Contrôles après chaque fichier, en lecture seule** : `select` sur `information_schema` et `pg_proc` (objets présents), `pg_policies`, `explain` des RPC de recherche, advisors Supabase (sécurité + performance) sans nouvelle alerte, tiroirs v1 toujours fonctionnels. **Les tests pgTAP ne s'exécutent jamais contre `PROD_DB_URL`** (ils insèrent des fixtures dans `auth.users`) : uniquement sur Postgres éphémère (CI `database-gates`) ou en local.
5. **Retour arrière** :
   - migration en échec ou objet jamais utilisé : `.down.sql` correspondant, dans l'ordre inverse ;
   - **après le premier usage réel** (des données écrites dans les nouvelles colonnes ou tables) : ne supprime rien ; passe le drapeau à `false`, redéploie, et pour les fonctions réécrites de la phase 2 restaure seulement leurs corps précédents. Tout `.down.sql` qui contient un `drop column` commence par un contrôle `select count(*) … where <colonne> is not null` et lève une erreur s'il trouve des données.

## 4. Fusion et production Vercel
1. Fusion de la PR dans `main` (squash), CI `main` verte.
2. Déploiement Production Vercel déclenché par `main` (région `cdg1`). Attendre « Ready ».
3. `NEXT_PUBLIC_COMMUNAUTE_V2=true` sur **Production**, puis redéployer (variable `NEXT_PUBLIC_*` = valeur figée au build).
4. Recette `07-RECETTE.md` § B en production. Surveillance 30 min : logs Vercel (5xx), rapports CSP (`/api/csp-report`), erreurs console.
5. **Retour arrière** : drapeau à `false` + redéploiement, ou « Promote » du déploiement précédent (`vercel rollback`).
6. CSP : ajouter toute nouvelle origine dans `csp.config.mjs` (aucune n'est prévue : tuiles, routeur, élévation, géocodage et Supabase déjà autorisés). La météo (Sortie#7, Sorties#8, Story#5, Kit#9) passe par une route API du dépôt si elle existe déjà ; sinon elle est reportée (`01` § 6).
7. iOS : vérifier dans `ios/App/App/Info.plist` les textes d'autorisation `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription` (en français) ; les ajouter si absents.

## 5. iPhone (Xcode, sur le Mac où tourne Antigravity)
La coque Capacitor charge le site déployé (`CAPACITOR_SERVER_URL`, HTTPS obligatoire) : les tiroirs arrivent sur l'app dès la mise en production. L'installation via Xcode sert à livrer la dernière coque et à recetter sur l'appareil.
1. iPhone branché, déverrouillé, « Mode développeur » activé, Mac approuvé.
2. `CAPACITOR_SERVER_URL=<URL de prod Vercel> npm run mobile:build` (pas le domaine `koosmoweb.fr`, sans DNS selon `ios/RUN-ON-IPHONE.md` ; ou `bash scripts/ios-install.sh` s'il couvre ce cas) puis `npx cap sync ios`.
3. Signature automatique, équipe `QRU99VJUB5`, bundle `com.lekitduvoyageur.app`, schéma `App`. Installation : `npx cap run ios --target <UDID>` (UDID via `xcrun devicectl list devices`), ou `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'id=<UDID>' -allowProvisioningUpdates build` puis installation par `xcrun devicectl device install app`. Procédure complète : `ios/RUN-ON-IPHONE.md`.
4. Ne pas casser le contrat « glass natif » : le front doit toujours servir `/.well-known/lkdv-ios-native-glass.json` (feature `ios-native-liquid-glass`, release `all-except-compas-fast-v2`).
5. Recette `07-RECETTE.md` § C sur l'appareil, flow Maestro `.maestro/communaute.yaml`.
6. Si l'iPhone n'est pas disponible : tout le reste est terminé, l'installation est la seule étape restante, la commande exacte est dans le rapport.
7. TestFlight (`ios-testflight.yml`) : **ne pas** déclencher (hors périmètre ; mentionner comme suite).
