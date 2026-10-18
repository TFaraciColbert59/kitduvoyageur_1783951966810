# Bootstrap Hermes autonome LKDV — WSL2 Ubuntu

## État

Ce dossier prépare le dépôt, la politique, le registre de tâches et les quality gates. Il n'installe pas Hermes sur le PC de l'utilisateur, ne configure aucune clé, ne modifie pas les protections GitHub/Vercel et ne lance aucun déploiement. Ces opérations nécessitent un accès réel à la machine ou une configuration explicite du compte.

## 1. Préparer WSL2

Dans Ubuntu WSL2, vérifier :
```bash
git --version
node --version
npm --version
```

Le projet utilise un lockfile npm. Employer Node 22 pour rester aligné avec la CI proposée.

Copier le dossier technique maître fourni dans une zone privée **hors du dépôt public**. Ne pas le committer : il contient des détails internes du projet.

```bash
mkdir -p ~/work
# Copier le fichier fourni depuis Windows/Downloads vers :
# ~/work/LKDV_Dossier_Technique_Maitre.md
```

Cloner le dépôt dans le système de fichiers Linux, pas dans `/mnt/c`, pour de meilleures performances :
```bash
mkdir -p ~/work
cd ~/work
git clone https://github.com/TFaraciColbert59/kitduvoyageur_1783951966810.git lkdv
cd lkdv
git switch --track origin/agent/hermes-autonomy-bootstrap
npm ci
node scripts/autonomy/validate-registry.mjs
```

Vérifier l'état Git et le commit avant de commencer. Ne pas lancer l'agent sur une copie contenant des changements humains non compris.

## 2. Installer et configurer Hermes

Installation officielle Hermes pour Linux/WSL2 :
```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

Puis recharger le shell, lancer `hermes setup` ou `hermes model`, sélectionner le fournisseur DeepSeek et saisir la clé via le wizard. La clé doit être stockée dans `~/.hermes/.env` sous `DEEPSEEK_API_KEY`, jamais dans le dépôt. Ne pas copier la clé dans une commande shell, un prompt, un log ou un fichier du projet.

Utiliser l'identifiant de modèle Flash actuellement proposé par le wizard/documentation DeepSeek/Hermes. Ne pas supposer qu'un identifiant historique fonctionne : vérifier la liste du fournisseur, sélectionner Flash, puis exécuter un test de réponse court.

Commande de diagnostic documentée :
```bash
hermes chat --oneshot -q "Réponds uniquement : HERMES_DEEPSEEK_OK"
```

Pour les cycles autonomes, la CLI Hermes documente `hermes chat --oneshot`, `--query-file`, `--provider deepseek`, `--model` et `--max-turns`. Le runner de ce dépôt utilise ces options ; vérifier `hermes chat --help` après installation et avant activation.

## 3. Plafond de dépenses obligatoire

Le budget cible est de 20 EUR par mois. Avant d'activer le superviseur :

1. Configurer dans le compte API DeepSeek le plafond de dépenses le plus strict disponible, ou un quota dédié dont le plafond mensuel est inférieur ou égal à 20 EUR.
2. Vérifier les prix et l'identifiant exact du modèle dans le compte/API au jour de la mise en service.
3. Vérifier que les appels de l'agent sont comptabilisés et que les dépenses peuvent être consultées.
4. Exporter/configurer la variable `LKDV_PROVIDER_BUDGET_CONFIRMED=1` seulement après avoir réellement configuré et vérifié ce plafond.
5. Si aucun plafond ferme n'est disponible, ne pas activer l'exécution non surveillée : un compteur local ne remplace pas une limite côté fournisseur.

Les montants API peuvent être libellés en USD et convertis en EUR. Le budget est un maximum, pas une promesse de coût.

## 4. Credentials de déploiement

- GitHub : authentification SSH ou credential helper ; limiter les droits à ce dépôt.
- Vercel : connecter le dépôt existant et vérifier que `main` est la branche de production.
- Supabase : séparer staging et production, utiliser les accès minimaux, ne pas exposer de service-role key au navigateur.
- Les secrets restent dans les magasins de secrets ou fichiers hors dépôt, jamais dans les fichiers de mission.

## 5. Activer les contrôles de production

Avant de considérer la voie de production comme protégée, vérifier dans GitHub :
- les règles de protection de `main` ;
- l'obligation de passer les quality gates ;
- l'interdiction de pousser directement si elle est compatible avec le flux retenu ;
- les permissions minimales de GitHub Actions.

Dans Vercel, vérifier la connexion au dépôt, la branche de production `main`, les variables d'environnement Production et les domaines. Le déploiement automatique de Vercel doit être déclenché par le merge vers `main`, après les contrôles requis. Les déploiements de preview doivent rester séparés de la production.

## 6. Premier démarrage

1. Lire `HERMES_MISSION.md`, `POLICY.yml` et `TASKS.json`.
2. Faire un audit sans modification et consigner les preuves dans `EVIDENCE.md`.
3. Exécuter le validator et les gates localement.
4. Configurer les protections GitHub/Vercel et le plafond API.
5. Seulement après vérification, activer le superviseur.

Le runner attend par défaut le dossier maître à `$HOME/work/LKDV_Dossier_Technique_Maitre.md`. S'il est ailleurs, définir `LKDV_MASTER_DOSSIER=/chemin/prive/vers/LKDV_Dossier_Technique_Maitre.md`. Le runner refuse de démarrer si le dossier est absent.

Le travail n'est pas considéré fini tant que les critères du dossier maître n'ont pas des preuves. L'installation locale et la configuration des comptes sont des prérequis séparés de ce commit.
