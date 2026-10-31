# Outils de nettoyage LKDV

Ce dossier opaque les deux outils **sûrs** du chantier de nettoyage. Aucun des
deux ne supprime définitivement quoi que ce soit.

## `npm run cleanup:audit` — inventaire en lecture seule

```bash
npm run cleanup:audit            # rapport lisible
npm run cleanup:audit -- --json  # JSON exploitable
npm run cleanup:audit -- --strict # échoue si un script package.json pointe un fichier absent
```

Produit : nombre de fichiers suivis, octets suivis, scripts `package.json` cassés,
groupes de fichiers **exactement** identiques (hash sha256), sources ≥ 800 lignes
et chemins générés encore suivis par git.

**Ce n'est pas une liste de suppressions** : un hash identique ne prouve pas
l'inutilité (ex. deux routes Next au contenu proche, deux skills dupliqués mais
chargés par des outils différents). Chaque candidat doit passer par le protocole
`docs/cleanup/PROTOCOLE_SUPPRESSION.md`.

## `npm run cleanup:quarantine` — quarantaine avec manifeste

```bash
# 1. Toujours commencer par un plan (DRY RUN : rien ne bouge)
npm run cleanup:quarantine -- --paths src/features/x/dead.ts --reason "export jamais importé (knip+grep+runtime)"

# 2. Exécution : déplace vers .cleanup-trash/<timestamp>/<chemin> + manifeste + restore.sh
npm run cleanup:quarantine -- --paths src/features/x/dead.ts --reason "..." --apply --yes

# 3. Restauration vérifiée par hash
npm run cleanup:quarantine -- --restore <timestamp>
```

Garde-fous codés et testés (`npm run cleanup:test`) :

- refus des chemins absolus, `..` et hors dépôt ;
- refus des racines protégées (`.git`, `node_modules`, `.next`, `.turbo`,
  `supabase/migrations`) et des fichiers `package.json`/lockfiles ;
- refus d'un fichier **non suivi par git** (travail en cours d'un autre chantier) ;
- refus d'un fichier **modifié** dans l'arbre de travail ;
- `--apply` exige `--yes` et une `--reason` de 8 caractères minimum ;
- restauration refusée si le contenu quarantiné a été altéré (sha256).

`.cleanup-trash/` est ignoré par git : la suppression définitive reste un geste
manuel, après validation et commit de la suppression.
