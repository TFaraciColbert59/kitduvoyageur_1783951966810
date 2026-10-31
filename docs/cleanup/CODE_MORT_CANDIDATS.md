# Candidats « code mort » — inventaire, aucune suppression

## Méthode et limites

Scan statique du 31/10/2026 sur `src/` : pour chaque fichier `.ts/.tsx`, recherche
d'imports référencant son chemin ou son nom de module (`from '…/Nom'`), hors
fichiers de convention Next (`app/**/{page,layout,route,loading,error,…}`) et
hors tests. Résultat : **187 fichiers sans référence textuelle directe**.

**Ce chiffre n'est pas une liste de suppressions.** Il est délibérément présenté
comme un générateur de pistes, avec ses faux positifs connus :

- **barrels** : un composant importé via `@/components/compte` (index) n'a
  aucune référence textuelle à son propre nom ;
- **imports dynamiques** construits (`import(\`./${name}\`)`), registres,
  `React.lazy`, routes générées ;
- **conventions Next** (segments parallèles, groupes de routes, `default.tsx`) ;
- **composants montés par un parent via props** (render props, slots) ;
- **consommation par les apps natives** (Capacitor/Swift) ou les scripts.

De plus, un fichier « non référencé » peut être **une API publique** consommée
par du code hors dépôt (webhooks, intégrations) : le protocole du chantier
impose de le conserver en cas de doute.

## Exemples de candidats (les plus volumineux)

| Lignes | Fichier | À vérifier avant toute action |
|---:|---|---|
| 1 219 | `src/components/compte/CommandesTab.tsx` | barrel `components/compte` ? onglet mort ? |
| 1 196 | `src/components/compte/ParametresCompteCard.tsx` | idem |
| 1 100 | `src/components/carnets/CreateCarnetView.tsx` | ancienne vue remplacée par `features/community/create` ? |
| 1 061 | `src/features/trips/server/prepareActivityFromTrail.ts` | appelé par une Server Action non détectée ? |
| 1 060 | `src/components/compte/FideliteTab.tsx` | onglet fidélité retiré de l'UI ? |
| 862 | `src/features/places/data/placesSeed.ts` | données de seed utilisées par un script ? |
| 809 | `src/components/clubs/CreateClubView.tsx` | ancienne vue remplacée ? |
| 684 | `src/components/profile/PublicMobileProfileView.tsx` | route `/profil/[id]` ? |

Liste complète reproductible :

```bash
node -e '
const fs=require("fs"),path=require("path");
function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p,o):/\.(ts|tsx)$/.test(e.name)&&o.push(p);}return o;}
const files=walk("src");const texts=new Map(files.map(f=>[f,fs.readFileSync(f,"utf8")]));
const all=[...texts.values()].join("\n");
… (cf. historique de session)'
```

## Décision

**Aucune suppression, aucune quarantaine** dans ce chantier :

1. prouver l'inutilité exige de couvrir les barrels, les imports dynamiques, les
   conventions Next et les consommateurs natifs — non faisable sans E2E ;
2. la suppression d'un composant de 1 000 lignes sans recette visuelle est un
   risque produit majeur pour un gain de bundle **nul** (tree-shaking) ;
3. le protocole « le doute garde » s'applique intégralement.

**Suite recommandée** : lot dédié « code mort », fichier par fichier, avec
`knip` (ou équivalent épinglé) + recherche de barrels + build + E2E, un commit
par suppression et quarantaine via `npm run cleanup:quarantine`.
