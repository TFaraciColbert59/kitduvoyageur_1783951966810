# VA-02 — Pagination de l’export RGPD

Les deux routes authentifiées, `/api/account/export` et `/api/user/export`,
utilisent désormais le même adaptateur paginé. L’identité provient toujours de
`auth.getUser()`. Aucun identifiant fourni dans une URL ou un corps ne choisit
le sujet de l’archive. Le registre des tables exportées reste inchangé ; les
documents de voyage et les données de tiers ne sont pas ajoutés.

Chaque table est ordonnée par sa clé primaire, y compris les clés composites
sans colonne `id`. Les pages demandent 250 lignes avec un décompte exact. Le
curseur de plage avance du nombre de lignes réellement reçu, ce qui supporte
aussi un plafond API inférieur à 250. La lecture ne se termine que lorsque le
nombre reçu rejoint le total annoncé. Un total absent, changeant, une page vide
prématurée, une clé répétée ou une panne intermédiaire invalide l’export.

Les enfants des plans ne sont lus que pour les identifiants des plans du sujet.
Ces identifiants sont regroupés par lots de 100 pour borner la taille des URL.
Leurs lignes sont également paginées et figurent désormais dans les compteurs.
`counts.total` compte les lignes des tables et des plans/enfants une seule fois ;
le profil et les alias du même contenu (`consents`, `tables.adventure_plans`)
ne sont pas comptés une deuxième fois.

Le budget partagé entre toutes les lectures limite l’archive à 50 000 lignes,
10 Mio de JSON source, 500 requêtes et 20 secondes. La limite temporelle est
transmise aux requêtes HTTP par un `AbortSignal` commun. Le JSON final contient
des alias de certaines lignes et sa taille peut donc dépasser celle du JSON
source. Ces limites empêchent une boucle ou un chargement non borné ; elles ne
constituent pas une preuve de capacité en production.

Une limite atteinte ou une lecture incomplète renvoie HTTP 503 avec
`code: EXPORT_INCOMPLETE`, sans archive partielle ni détail interne de la base,
et `Cache-Control: no-store`. Les grands comptes dépassant ces limites ont
besoin d’un export asynchrone ou d’un traitement de support ; aucun traitement
asynchrone n’est prétendu disponible ici.

La pagination REST ne constitue pas une transaction à snapshot partagé. Les
variations de total et les duplications détectées font échouer l’export, mais
une suppression et une insertion simultanées conservant exactement le total
peuvent rester indétectables. Une garantie d’instantané strict demanderait une
fonction ou un travail d’export transactionnel côté base. Aucune migration ni
lecture des données de production n’a été effectuée pour cette correction.

Vérification locale :

```sh
npx vitest run tests/security/gdpr-export-pagination.spec.ts tests/security/a14-gdpr-account.spec.ts tests/security/a14-gdpr-missing-table.spec.ts --maxWorkers=2
```

Les nouvelles régressions utilisent le vrai client `supabase-js` et son
adaptateur HTTP sur un serveur PostgREST simulé en mémoire : 1 001 lignes sous
des plafonds de 1 000 et 37, 1 203 enfants de plans, exclusion d’autres sujets,
clés composites, lots de plans, panne après la première page, compte absent ou
changeant, page répétée/vide, budgets et interruption HTTP. Ce sont des tests
de l’adaptateur et des routes, sans serveur Supabase local ni mesure du plafond
réellement configuré en production.
