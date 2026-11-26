# Tournage — mode d'emploi

Tout se tourne avec un seul script, `tools/capture/tournage.cjs`.
- **Lecture seule.** Les écritures sont bloquées au niveau du réseau, et tout ce qui est bloqué est noté dans `journal.txt`.
- **Toujours sur le dernier `main`.** Le script vérifie le SHA avant de tourner et refuse sinon.

## Ce que le script produit

| Commande | Sortie | Rôle |
|---|---|---|
| `verifier` | `assets/shoot/SOURCE.txt` | SHA de l'app servie, comparé à `origin/main`. |
| `connexion` | `tools/capture/.session/state.json` (ignoré par git) | Session du compte de démo. Le mot de passe est lu dans `PWFILE`, un fichier hors dépôt. |
| `decouverte` | `assets/shoot/decouverte/<route>/NN-*.png` + `carte.json` | Ouvre chaque page, puis chaque tiroir et sous-tiroir sûr, et les photographie à 3× (1179×2556). C'est l'inventaire réel et la planche de vérification. |
| `plans` | `assets/shoot/plans/<id>.png` | Les plans choisis pour le film (liste `PLANS`). |
| `gestes` | `assets/shoot/gestes/<id>/` | Les vrais gestes enregistrés : globe qui tourne, tiroirs, fonds de carte, onglets, défilement, sac 3D. Chaque geste est horodaté dans `marks.json` pour poser le curseur et caler le son. |
| `tout` | tout ce qui précède | Enchaîne les quatre premières commandes. |

## Option A — depuis cette session cloud

Il faut d'abord ouvrir le réseau : sur claude.ai, dans un navigateur, Réglages › Capacités, « tous les domaines ».

```bash
cd <clone de main>                      # au SHA de origin/main
NODE_OPTIONS=--max-old-space-size=4096 npx next dev -p 3000 &
APP_DIR=$PWD CHROME_PATH=/usr/bin/google-chrome PWFILE=/home/claude/.secret/mdp.txt \
  node <worktree du film>/video/presentation-complete/tools/capture/tournage.cjs connexion
APP_DIR=$PWD CHROME_PATH=/usr/bin/google-chrome \
  node <worktree du film>/video/presentation-complete/tools/capture/tournage.cjs tout
```

## Option B — depuis le PC de Tony

L'app tourne alors sur un worktree propre de `main`, pour ne pas toucher au travail en cours.

```powershell
git fetch origin
git worktree add ..\lkdv-main origin/main
cd ..\lkdv-main
copy ..\kitduvoyageur\.env.local .env.local
npm ci
$env:NODE_OPTIONS="--max-old-space-size=6144"; npx next dev -p 3000
```

Puis, dans un second terminal, à la racine du dépôt, sur la branche `claude/film-presentation-ultime` :

```powershell
$env:APP_DIR="..\lkdv-main"; $env:PWFILE="C:\hors-depot\mdp.txt"
node video/presentation-complete/tools/capture/tournage.cjs connexion
node video/presentation-complete/tools/capture/tournage.cjs tout
git add video/presentation-complete/assets/shoot
git commit -m "vidéo : tournage sur main"
git push
```

## Contrôle après tournage

1. Lire `assets/shoot/SOURCE.txt` : le verdict doit être « OK, dernier main ».
2. Lire les `journal.txt` : on y voit les requêtes bloquées et les éléments introuvables.
3. Regarder les planches. On écarte toute image vide, coupée ou porteuse de données de test ou personnelles.
