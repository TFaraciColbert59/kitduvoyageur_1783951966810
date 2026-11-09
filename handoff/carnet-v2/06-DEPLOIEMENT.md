# 06 — Livraison : GitHub, Vercel, Supabase, iPhone

Ordre strict. Chaque étape a son contrôle ; si un contrôle échoue, applique le retour arrière de l'étape et note-le dans le journal.

## 1. GitHub
1. `git push -u origin feat/carnet-v2`, ouvrir la PR vers `main` (titre `feat(carnet): fiche carnet v2 au système /compte`, description : résumé, captures avant/après, liste des migrations, plan de retour arrière, lien vers ce dossier).
2. Attendre la CI complète verte. Corriger et repousser tant qu'elle ne l'est pas.

## 2. Aperçu Vercel
1. Variable `NEXT_PUBLIC_CARNET_V2=true` sur l'environnement **Preview**.
2. Migrations : l'aperçu pointe sur la base de prod (variables partagées) → **ne pas** tester l'aperçu contre des tables absentes. Deux options, dans cet ordre de préférence :
   - si une branche Supabase / base de staging est configurée : y appliquer les migrations et brancher l'aperçu dessus ;
   - sinon : appliquer en prod **les lots additifs** (§ 3) avant la recette d'aperçu. Ils sont invisibles tant que le drapeau Production est à `false`.
3. Dérouler `07-RECETTE.md` § A sur l'URL d'aperçu (iPhone via Safari + Playwright distant).

## 3. Migrations en production
1. **Sauvegarde** : lancer `db-backup.yml` (workflow_dispatch) et attendre le succès ; noter l'identifiant de l'exécution.
2. **Ledger** : `node scripts/db/migrations-alignment.mjs` (avec `PROD_DB_URL`) pour vérifier que la prod est alignée sur `main` avant d'ajouter les tiennes. Écart inexpliqué → ne rien appliquer, documenter.
3. **Application** lot par lot (A, puis B, C, D, E), chacune dans une transaction : `supabase link --project-ref icxyvwzfjbflcbqukpfz` puis `supabase db push --dry-run` (doit lister **uniquement** tes nouveaux fichiers) puis `supabase db push`. Si le CLI n'est pas utilisable, `psql "$PROD_DB_URL" -v ON_ERROR_STOP=1 -1 -f <fichier>` puis enregistrer la version dans `supabase_migrations.schema_migrations` comme le fait le dépôt (vérifier avec `fetch-prod-ledger.mjs`).
4. **Contrôles après chaque lot** : `pg_policies` des nouvelles tables, exécution des tests pgTAP contre une copie ou en lecture seule, advisors Supabase (sécurité + performance) sans nouvelle alerte, fiche v1 toujours fonctionnelle.
5. **Retour arrière** : `.down.sql` du lot dans l'ordre inverse.

## 4. Fusion et production Vercel
1. Fusion de la PR dans `main` (squash), CI `main` verte.
2. Déploiement Production Vercel déclenché par `main` (région `cdg1`). Attendre « Ready ».
3. `NEXT_PUBLIC_CARNET_V2=true` sur **Production**, puis redéployer (variable `NEXT_PUBLIC_*` = valeur figée au build).
4. Recette `07-RECETTE.md` § B en production. Surveillance 30 min : logs Vercel (5xx), rapports CSP (`/api/csp-report`), erreurs console.
5. **Retour arrière** : drapeau à `false` + redéploiement, ou « Promote » du déploiement précédent (`vercel rollback`).
6. CSP : ajouter toute nouvelle origine dans `csp.config.mjs` (aucune n'est prévue : tuiles OpenFreeMap et Supabase déjà autorisées).

## 5. iPhone (Xcode, sur le Mac où tourne Antigravity)
La coque Capacitor charge le site déployé (`CAPACITOR_SERVER_URL`, HTTPS obligatoire) : la fiche arrive sur l'app dès la mise en production. L'installation via Xcode sert à livrer la dernière coque et à recetter sur l'appareil.
1. iPhone branché, déverrouillé, « Mode développeur » activé, Mac approuvé.
2. `CAPACITOR_SERVER_URL=<URL de prod Vercel ou domaine canonique> npm run mobile:build` puis `npx cap sync ios`.
3. Signature automatique, équipe `QRU99VJUB5`, bundle `com.lekitduvoyageur.app`, schéma `App`. Installation : `npx cap run ios --target <UDID>` (UDID via `xcrun devicectl list devices`), ou `xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'id=<UDID>' -allowProvisioningUpdates build` puis installation par `xcrun devicectl device install app`. Procédure complète : `ios/RUN-ON-IPHONE.md`.
4. Ne pas casser le contrat « glass natif » : le front doit toujours servir `/.well-known/lkdv-ios-native-glass.json` (feature `ios-native-liquid-glass`, release `all-except-compas-fast-v2`).
5. Recette `07-RECETTE.md` § C sur l'appareil, flow Maestro `.maestro/carnet.yaml`.
6. Si l'iPhone n'est pas disponible : tout le reste est terminé, l'installation est la seule étape restante, la commande exacte est dans le rapport.
7. TestFlight (`ios-testflight.yml`) : **ne pas** déclencher (hors périmètre ; mentionner comme suite).
