# Population de démonstration LKDV

Le classeur `LKDV_1000_profils_demo.xlsx` alimente la communauté, les profils voyageurs, les clubs, les sorties, les groupes, la messagerie, les carnets, les activités et le matériel. Les personnes et les activités sont fictives. Les abonnements et les liens narratifs ont des identités distinctes.

## Exécuter

Python 3.11 ou ultérieur et `psql` sont requis. Depuis la racine du dépôt, installer les dépendances dans un environnement virtuel.

```sh
python3 -m venv /tmp/lkdv-demo-venv
/tmp/lkdv-demo-venv/bin/pip install -r scripts/seed/demo_population/requirements.txt
export LKDV_DEMO_PYTHON=/tmp/lkdv-demo-venv/bin/python
npm run seed:demo:population -- plan /chemin/LKDV_1000_profils_demo.xlsx --out /tmp/lkdv-demo-plan
```

Le plan vérifie les références et la chronologie puis affiche les volumes. Les deux fichiers sous `--out` sont facultatifs. Le manifeste JSON est lisible par `verify.py`. Le SQL du plan documente le schéma étendu. Pour l’import ou le rattachement d’un compte existant, employer `apply`, qui vérifie le schéma et la cible avant l’écriture.

Utiliser une base de démonstration dédiée et accessible en boucle locale. Elle doit contenir les migrations LKDV, les métadonnées Auth de GoTrue et les référentiels pays/sports utilisés par les voyages. Le dépôt offre un chemin de reconstruction du schéma via `scripts/db/ci/install.sh`. Ce chemin configure la doublure PostgreSQL de la CI, qui ne remplace pas le service Auth. Pour un environnement complet, initialiser une instance Auth locale et utiliser son schéma Auth avec la base LKDV isolée.

Renseigner `LKDV_DEMO_DB_URL` avec la connexion à cette base et `DEMO_LOGIN_PASSWORD` avec le secret local de son compte démo. `DEMO_LOGIN_EMAIL` prend par défaut la valeur `p0001@lkdv.invalid`. Un compte existant à cette adresse peut être repris s’il est déjà marqué `is_demo`; son UUID et son profil sont conservés et ses invitations, messages et contenus sont rattachés à cet UUID. Les autres adresses du lot sont réservées à la démo et les autres profils sont provisionnés sans mot de passe.

```sh
npm run seed:demo:population -- apply /chemin/LKDV_1000_profils_demo.xlsx
```

L’import utilise l’horloge du bac à sable pour placer les stories et les sorties autour de la date d’exécution. `--as-of 2026-11-15T18:00:00Z` reproduit l’instant original du classeur. Le rejeu réutilise la date enregistrée sauf paramètre explicite. Le lot est appliqué dans une transaction. Un rejeu identique laisse intacts les volumes et les données modifiées pendant la démo. Pour réinitialiser le monde et choisir une nouvelle date, recréer le bac à sable dédié à partir du schéma et des référentiels.

## Connecter l’application

Pointer les variables Supabase de l’application de test vers cette même instance et renseigner côté serveur `DEMO_LOGIN_EMAIL` et `DEMO_LOGIN_PASSWORD`. Activer `DEMO_AUTO_LOGIN=true` et `NEXT_PUBLIC_DEMO_AUTO_LOGIN=true` dans le déploiement de démo. La route existante `/api/auth/demo` ouvre alors une session pour l’ancre.

1. Ouvrir le fil et chercher la publication de la boucle de Lille.
2. Consulter l’annonce, le commentaire de l’ancre, la réponse, la story et le repost.
3. Consulter la conversation directe et la conversation de préparation. Ouvrir le partage de post natif.
4. Depuis la fiche publique de la sortie, vérifier neuf réservations et deux places en attente. Depuis le Hub, sélectionner le groupe de préparation et ouvrir le sondage, les tâches, le kit et la dépense de groupe fictive.
5. Ouvrir le carnet historique de l’ancre et son activité liée. Vérifier aussi qu’un autre compte ne lit pas les échanges privés.

## Couverture et règles de lecture

- Le schéma étendu couvre 68 tables métier et de configuration. Les 5 596 liens éditoriaux et les fiches enrichies vivent dans le schéma local non exposé, avec les UUID du lot. Les compteurs de réactions et les notifications dérivées passent par les déclencheurs existants.
- Lorsque les tables de sourdines, salons, inscriptions de club ou visibilité métrique sont absentes du schéma, `apply` affiche précisément les omissions. Les parcours prévus dans les anciennes tables restent alimentés.
- Les avatars et couvertures sont des illustrations PNG reproductibles. Certaines fiches utilisent les initiales. Les stories image utilisent des illustrations. Une slide texte prend la place des vidéos prévues.
- Les commentaires de stories à audience restreinte restent dans le classeur. La politique de lecture actuelle de la table des commentaires impose de limiter la fixture aux stories publiques.
- Sept annulations internes restent dans le classeur. Le schéma de sortie de club ne prévoit pas d’état annulé. Les annulations exposées sur les fiches publiques utilisent l’état natif.
- Le fichier de vue ne s’applique qu’au bac local lors de l’import. Il conserve les règles de visibilité et utilise les UUID enregistrés du lot pour afficher les profils fictifs dans le fil.
- La vérification couvre le jeu synthétique et les permissions PostgreSQL dans un bac séparé. Les commandes, paiements, avis commerciaux, télémétrie réelle et SOS n’ont pas de lignes synthétiques dans l’import.

Classeur source dans ce fil, fichier `LKDV_1000_profils_demo.xlsx`.
