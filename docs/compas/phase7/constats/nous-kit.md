# Constats — étapes « Nous » et « Kit » (lot Nous + Kit, phase 7)

Dernier passage réel : aperçu `kitduvoyageur-1783951966810-9gsrib57l`, 19 oct. 2026, dossier
`proof/compas-full/2026-10-19-20-25-07/` (espace d'essai neuf, aventure réellement préparée « 3 jours de
randonnée dans le Vercors à 2 », 1 worker, Chromium téléphone 393 × 852).

| Étape | Scénarios du lot | Réussis | Échoués | Contrôles vérifiés |
|---|---:|---:|---:|---:|
| Nous | 9 | 9 | 0 | 30 / 44 |
| Kit | 17 | 17 | 0 | 68 / 70 |
| Lot | 26 | 26 | 0 | **98 / 114** |

Les 16 contrôles restants sont tous **non testables en session** (raisons précises ci-dessous) ; aucun n'est
« activé sans assertion ». Les chiffres ci-dessus sont ceux de ce seul passage à froid (compte neuf). Les mêmes 26 scénarios avaient
aussi réussi sur un espace réutilisé (passage `2026-10-19-20-11-11`, 66 / 70 Kit et 30 / 44 Nous, les deux liens
« inventaire vide » n'y étant pas exercés).

## 1. Constats sur l'application

Aucun scénario du lot n'est resté rouge : pas de test conservé en échec. Deux observations, relevées pendant
l'exploration (pas de test rouge : ce sont des données du catalogue et un lien hors Compas).

| id | où | observé | attendu | trace |
|----|----|---------|---------|-------|
| K-001 | Kit › Trouver / fiche objet, produits suggérés (catalogue BigBuy) | Le produit relié par défaut à un objet n'est pas toujours celui de l'objet, et les titres du catalogue portent un préfixe de catégorie faux : « Bâtons de trekking télescopiques » → « **Briquet/Allume-Feu Camping** – Bâton Trekking Black Diamond BD110065 Pourpre » (8 €) ; « Sac à dos technique de randonnée » → « **Accessoires pour Sac à Dos** – Catégorie BigBuy » ; « Kit de réparation multi-usage » → « Kit de Réparation **Colliers de Câble** JOKARI… ». Dans « Acheter » : « Crampons à Neige/Glace – Bâton Trekking… », « Jumelles/Optique – Bâton Trekking Leki… » pour une recherche de bâtons. | Un produit de la bonne famille, un titre sans préfixe de catégorie étranger | Observé dans l'espace `proof/compas-full/2026-10-19-20-25-07/` (fiche objet, tiroir « Trouver : … »). Cause probable : import catalogue (`category – name`), à confirmer côté données. Pas de test rouge : aucune règle de pertinence n'est définie dans le code. |
| K-002 | Hors Compas, bloque « Je l'ai récupéré » : `/materiel` › « Prêts & réparations » (`/hub/disponibilite`) | Avec une aventure active, `/hub/disponibilite` (et `/hub/kit`, `/hub/inventaire` ouverts directement) répondent « Sentier introuvable » (404) ; depuis `/materiel`, « Prêts & réparations » mène aussi au 404 alors que « Inventaire » s'ouvre. Le registre dit « nature incompatible → 404 » (`app/hub/[section]/page.tsx`) : les sections « possession » ne sont pas servies quand l'aventure active est une sortie, mais `/materiel` les propose quand même. | Un lien proposé qui s'ouvre, ou n'est pas proposé | `/materiel` (liens `/hub/disponibilite`, `/hub/kit`, `/hub/inventaire`). Le prêt d'un objet est donc inaccessible avec une aventure active : voir § 3 pour ses conséquences sur le test. À confirmer (peut être voulu). |

## 2. Contrôles non testables en session (16)

Raison par contrôle. Le registre (`coverage-registry.json`) n'a pas été modifié par ce lot (fichier du lot Commun) :
à reporter à la fusion en `raison_non_testable`.

### Nous (14) — formulaire « Bouteille à la mer » (onglet « Bouteille »)

Le formulaire (et ses boutons) n'est rendu que si `canLaunch` est vrai (`AnnonceFlow`, `bottleActions.ts`) :
pays du voyage connu, compte non suspendu, **confiance ≥ 65**. Un espace d'essai anonyme affiche, observé :
« Confiance 50/100 : il faut 65 pour lancer une bouteille. » Le seuil dépend de `user_profiles.trust_score`,
qu'aucun geste du Compas ne fait monter ; le modifier en base serait contourner la règle, ce que ce lot ne fait pas.
En plus, « Lancer » **publie dans la communauté** (public) et « Accepter / Refuser / Retirer de la communauté »
agissent sur une annonce publiée avec un candidat : il faut deux comptes réels (BANC-DE-TEST §5).

| Contrôle | Raison précise |
|---|---|
| Titre · Confiance minimale : …/100 (curseur) · « Ouvert à tous » / « Femmes » / « Hommes » (3 onglets) · Places dans le groupe · Départ · Retour · Message · J'ai 18 ans ou plus | Champs du formulaire de lancement, absents tant que `canLaunch` est faux (confiance 50 < 65). Les remplir sans lancer serait possible avec un compte de confiance ≥ 65. |
| Lancer | Publie l'annonce dans la communauté du pays : jamais lancé par le banc ; exige en plus confiance ≥ 65. |
| Refuser … · Accepter … | N'existent que sur une annonce déjà publiée qui a un candidat (deuxième compte). |
| Retirer de la communauté | N'existe que sur une annonce publiée ; agit sur du contenu public. |

À vérifier à la main avec un compte de test non anonyme de confiance ≥ 65 (et un second compte candidat).

Le lien « Inviter quelqu'un que je connais, dans le Hub » et l'onglet « Bouteille » sont, eux, vérifiés
(la règle « il faut 65 » et le renvoi au Hub sont affichés).

### Kit (2)

| Contrôle | Raison précise |
|---|---|
| « Je l'ai récupéré » (fiche objet) | N'apparaît que pour une ligne `status = 'lent'` liée à un objet d'inventaire prêté. Un prêt se crée hors du Compas (`createLoan`, surface Hub « possession »), qui n'est pas servie quand une aventure est active (K-002). Le scénario exigerait : prêter l'objet **avant** de créer l'aventure, puis l'ajouter au kit. À faire à la main (ou lot dédié avec deux étapes de préparation). |
| « Emprunter » (bouton d'un coéquipier, onglet « Emprunter » de « Trouver ») | Une ligne n'existe que s'il y a au moins un autre membre avec compte dans le groupe ; un espace d'essai est seul (« Personne d'autre dans l'équipe pour l'instant », observé, avec « Inviter depuis le Hub » vérifié). Exige un second compte qui rejoint le voyage (BANC-DE-TEST §5). |

## 3. Contrôles crédités avec un identifiant d'inventaire explicite (`{ control }`)

Pour les contrôles dont le nom est calculé, le scénario donne l'identifiant (règle d'or inchangée : activation
réelle puis assertion de l'effet). Quatre contrôles de l'inventaire sont **un seul élément JSX qui change de
libellé** ; le scénario active l'élément dans l'état où il agit, et le crédite sous l'identifiant du libellé
inventorié :

| Identifiant inventorié (libellé) | Élément réellement activé | Effet vérifié |
|---|---|---|
| `MesKitsFlow::button::…kits.addFirst` (« Ajoute d'abord des objets », désactivé) | le même bouton, libellé « Créer le kit » quand le voyage a des objets | annonce « Kit « … » créé » et le kit listé avec sa saison |
| `MesKitsFlow::button::…kits.complete` (« Déjà complet », désactivé) | le même bouton, libellé « Appliquer » quand il manque un objet | annonce « 1 objet ajouté », puis « Déjà complet » désactivé |
| `ItemSheet::button::…item.unpack` (« Déballer ») | le même bouton, « Emballer » avant le geste | pastille « Emballé » et libellé « Déballer » |
| `KitRow::button::cls:cp-ibtn` (rond d'emballage) | le rond de la ligne | `aria-pressed` et libellé « Déballer … » |

Aucun clic n'est forcé sur un bouton désactivé : un contrôle « désactivé » n'est jamais crédité par son seul état.

## 4. Contrôles exercés selon l'état de l'espace

- « Ajouter à l'inventaire » (onglet Inventaire vide **et** source « Inventaire » vide de « Ajouter au kit ») :
  créditées seulement sur un **espace d'inventaire vide** (compte neuf). Sur un espace déjà rempli, le scénario
  atteint le même tiroir par Verdict › Sources et le dit en annotation `etat` ; ces deux liens ne sont alors pas
  exercés. Le passage cité plus haut est à froid : les deux sont vérifiés.
- Conseil de kit « Ajouter » : n'existe que si un conseil n'est pas couvert ; le scénario retire l'objet qui le
  couvre (autant de fois que nécessaire), exerce « Ajouter », puis remet un produit au kit.
- « Réessayer » de l'historique : provoqué sans injection de panne, en coupant le réseau du contexte (`goOffline`)
  avant d'ouvrir l'onglet « Historique », puis en le rétablissant.
- « Gérer le groupe dans le Hub », « Inviter depuis le Hub », « Inviter quelqu'un… », « Voir la location »,
  « Voir le panier », « Voir mes commandes », « Fiche produit » : on vérifie l'URL d'arrivée ; aucune commande,
  aucun paiement n'est lancé (« Choisir » met un produit au panier **local** et le relie à l'objet).
- Heure de départ (« Si tu pars à », « Enregistrer cette heure », « Effacer l'heure enregistrée ») : ces trois
  contrôles de l'inventaire « Nous » vivent dans **Où › Quand** ; le scénario les exerce là.

## 5. Notes pour le banc (hors périmètre, à reporter à la fusion)

- Windows : `npm run test:compas-full` échoue (`ENOENT` à l'écriture du rapport) car
  `scripts/compas/run-bench.mjs` appelle `spawnSync('npx', …)` sans `shell` ; Playwright n'est jamais lancé.
  Contournement : lancer `npx playwright test --config=playwright.compas-full.config.ts <filtres>` avec
  `COMPAS_RUN_DIR` posé, puis `node scripts/compas/coverage-report.mjs <dossier>`.
- La création d'espaces d'essai est limitée par IP (« Beaucoup d'essais depuis cette connexion : réessaie dans une
  heure ») : après quelques passages rapprochés (trois agents sur la même machine), `login()` échoue (timeout de
  90 s sur `waitForURL`). Aide locale `nous/fx.ts` : `COMPAS_REUSE_STATE=<storageState>` réutilise un espace
  d'essai déjà préparé ; sans cette variable, comportement identique aux fixtures du banc.
- Les noms accessibles des boutons à icône incluent le nom de l'icône (`img "plus"` → « plus Ajouter au kit ») :
  `getByRole('button', { name: 'Ajouter au kit', exact: true })` ne les trouve pas ; le lot filtre sur le texte.
  Les contrôles de l'inventaire restent rattachés par le texte visible.
- Filtre Playwright `controles-` attrape aussi les fichiers des autres lots (`ou/controles-*`) ; pour ce lot :
  `e2e-compas-full/(kit|nous)/controles`.

## 6. Rejouer

```bash
export COMPAS_BASE_URL=https://<déploiement>.vercel.app
export VERCEL_SHARE=<jeton du lien partagé>      # jamais dans un fichier
export COMPAS_WORKERS=1
export COMPAS_RUN_DIR="$PWD/proof/compas-full/$(date +%Y-%m-%d-%H-%M-%S)"
npx playwright test --config=playwright.compas-full.config.ts "e2e-compas-full/(kit|nous)/controles"
node scripts/compas/coverage-report.mjs "$COMPAS_RUN_DIR"
```

Équivalent hors Windows : `npm run test:compas-full -- tests/e2e-compas-full/kit tests/e2e-compas-full/nous`
(ajoute les deux scénarios de fumée). Durée d'un passage à froid : 9 minutes (dont ≈ 15 s de préparation réelle).
