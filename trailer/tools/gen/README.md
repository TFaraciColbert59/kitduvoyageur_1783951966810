# Création locale des plans au sol (FLUX.1 schnell, CPU)

Les plans au sol du trailer sont générés sur cette machine, sans banque d'images et sans service en ligne.
Chaîne par plan : génération 1024×576 (pages du carnet 768×512) → agrandissement 3072×1728 (pages : ×2)
→ carte de profondeur 16 bits à la taille agrandie.

Tout le lourd est hors dépôt, dans `G` :
`/tmp/claude-0/-home-user-kitduvoyageur-1783951966810/01a3ca9d-48c3-50c5-8d53-c0cbef7f3fab/scratchpad/gen`
(`build/bin/sd-cli`, `models/`, `venv/`, `logs/`). Le chemin se change par la variable `GEN`.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `plates.json` | Un prompt par plan, graine fixe (1783 + numéro ; `08b_page_k` : 1783 + 80 + k), ordre de la file. Prompt final = `prompt` + `style` (+ `people`). |
| `run_queue.py` | File reprenable : un plan à la fois, `nice -n 10`, 3 fils (`GEN_THREADS`), saute tout fichier déjà présent, écrit sous nom temporaire puis renomme. |
| `upscale.py` | Real-ESRGAN x2plus en tuiles (architecture RRDBNet réécrite, sans basicsr), mélangé à 60 % avec un Lanczos, grain de 1,2 %. Le x4plus a été écarté : rendu plastique (lupins devenus pâte). |
| `depth.py` | Depth Anything V2 Small via transformers, réseau à 1344×756, sortie PNG 16 bits, **blanc = près**, normalisée par plan (centiles 0,5–99,5 %). |
| `flux.sh`, `run_timed.py`, `prompt_02.txt` | Banc d'essai initial (conservé pour mémoire). |

Sorties (dans `assets/footage/`) : `raw/<nom>.png` (brut), `<nom>.png` (agrandi), `depth/<nom>.png`,
`plates.json` (manifeste enrichi : graine, prompt, dimensions, `focus`), `plates.log` (une ligne JSON par étape,
avec la durée), `QUEUE_STATUS.txt` (plan en cours, faits / total, fin estimée). Les versions remplacées par
`--only` sont archivées dans `raw/old/`.

## Commandes (depuis `trailer/`)

Lancer ou **relancer après un redémarrage de la machine** (reprend là où elle s'est arrêtée ; une génération
interrompue est refaite depuis le début de ce plan) :

```bash
G=/tmp/claude-0/-home-user-kitduvoyageur-1783951966810/01a3ca9d-48c3-50c5-8d53-c0cbef7f3fab/scratchpad/gen
cd /home/user/kitduvoyageur_1783951966810/trailer
setsid nohup python3 tools/gen/run_queue.py >> $G/logs/queue.log 2>&1 < /dev/null &
```

État :

```bash
cat assets/footage/QUEUE_STATUS.txt
tail -n 5 assets/footage/plates.log
pgrep -af "run_queue|sd-cli"
tail -c 300 $G/logs/flux_<nom>_s<graine>.log | tr '\r' '\n' | tail -2   # pas en cours de la génération
```

Refaire un plan avec une autre graine (les anciens fichiers vont dans `raw/old/`) — à lancer quand la file
ne tourne pas (un seul lanceur à la fois, verrou `assets/footage/.queue.lock`) :

```bash
python3 tools/gen/run_queue.py --only 08_k2_concordia_solo --seed 1891
python3 tools/gen/run_queue.py --only 02_iceland_route1_lupines --steps upscale,depth   # sans régénérer
```

Pour changer un prompt : modifier `plates.json` puis `--only <nom>` (la graine retenue est lue dans
`assets/footage/plates.json` si le plan a déjà été refait). Arrêter la file : `pkill -f run_queue.py; pkill sd-cli`.

## Temps mesurés (4 vCPU, sans GPU)

Génération 1024×576 : ≈ 19–23 min (dont ≈ 3,5 min de décodage VAE), plus lente si d'autres rendus tournent.
Agrandissement : ≈ 30 s (3 fils) à 80 s (1 fil). Profondeur : ≈ 10–30 s. Pic mémoire ≈ 9 Go.
