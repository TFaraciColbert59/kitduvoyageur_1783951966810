# Recette — « Demande à valider » et « SOS » fidèles à la maquette

Date : 2026-11-09 · Prévisualisation : `http://127.0.0.1:4200` (fixtures `CRM_DESIGN_PREVIEW=1`) ·
Références : `reference/maquette/Remboursement-1440.png`, `reference/maquette/SOS-390.png`.

## 1. Fichiers touchés

| Fichier | Nature |
|---|---|
| `crm/src/components/approval/approval-panel.tsx` | réécrit : étapes, bandeaux, récap, montant, confirmation, boutons, garde d'aperçu |
| `crm/src/components/approval/format.ts` | **nouveau** : montant du libellé, saisie tolérante, code d'empreinte, horodatage, motif |
| `crm/src/app/(app)/valider/[id]/page.tsx` | réécrit : fil d'Ariane (libellé de pôle), titre, rail 3 cartes (risque, empreinte, ce qui se passera), zone de travail qui passe à la ligne sous 900 px |
| `crm/src/components/sos/sos-screen.tsx` | réécrit : plein écran mobile, pastille, carte, 112, « Je prends », contacts, déroulé, clôture notée, garde d'aperçu |

Hors périmètre, non modifiés : `lib/rpc.ts`, `data/fixtures.ts`, `ui/crm.module.css`, `components/shell/**`,
migrations, tests. Aucun commit.

## 2. « Demande à valider » — 1440 × 1040

Positions mesurées sur la capture (référence entre parenthèses) :

| Ancre | Réalisé | Maquette |
|---|---|---|
| Fil d'Ariane | y 99–112 | y 99–112 |
| Titre `Valider un remboursement de 89,90 €` | y 143–165 | y 143–165 |
| Étapes `Préparé / 2 À valider / 3 Exécuté sur Stripe` | y 190–215 | y 190–215 |
| Bandeau `Mode solo :` | y 237–302 | y 234–300 |
| Carte récapitulatif | y 319–808 (489 px) | y 320–808 (488 px) |
| Ligne `Montant demandé` (fond sauge) | 600–656 | 599–655 |
| Champ de confirmation | 320 × 52 px | 320 × 50 px |
| Boutons | `Valider et rembourser 89,90 €` (sauge) · `Renvoyer à l'agent avec une question` (blanc) · `Refuser` (rouge pâle) | idem |

Corrections :

- structure 3 colonnes : récap au centre (Commande, Membre, Paiement d'origine, Payé, Déjà remboursé, Encore
  remboursable, Montant demandé, Motif, Pièces, Préparé par), rail `CONTEXTE DE LA COMMANDE` à droite
  (Articles, Risque, Empreinte, Ce qui se passera) ;
- valeurs de la maquette servies par le contrat étendu de `RequestDetail` (ajouté par un autre intervenant en
  cours de chantier) : `paid_cents` 129,80 €, `refunded_cents` 0,00 €, `refundable_cents` 129,80 €,
  `card_brand`/`card_last4` → « pi_3N••• · carte Visa •• 4417 », `member_orders` → « · 3 commandes »,
  `evidence` → « 2 photos du membre · échange de 4 messages », `items` → carte ARTICLES, `risk` → faits +
  pastille « Risque faible » ;
- libellés et densité de la maquette : lignes de 45 px (14 px), montant 24 px en `--lkv-primary`, `Préparé par`
  avec pastille `Agent IA` + « aujourd'hui HH:MM » ;
- étapes : coche sauge, pastille 2 pleine, connecteurs 40 px, « Exécuté sur Stripe » pour `order_refund` ;
- bandeau solo en une phrase (« **Mode solo :** … ») au lieu d'un label séparé ; le bandeau rouge « demande que
  vous avez préparée » n'apparaît plus qu'en mode à deux humains ;
- empreinte conservée dans le rail (`data-testid="approval-fingerprint"`) ;
- saisie : accepte `89,90 €`, `89,90`, `89.90`, `8990` (espaces insécables et symbole € retirés) et le code
  d'empreinte à 8 caractères ; en cas d'écart, `aria-invalid` + message **sous le champ** (« Le montant ne
  correspond pas. Tapez exactement 89,90 €. ») et aucun envoi ;
- en prévisualisation (`NEXT_PUBLIC_CRM_DESIGN_PREVIEW=1`), valider/refuser n'appellent ni `/api/approve` ni
  `/api/cmd` : bandeau et toast « Aperçu : … », zéro requête d'écriture (vérifié sur les 10 captures) ;
- `data-testid` du contrat de test ajoutés : `approval-panel`, `approval-steps`, `approval-fingerprint`,
  `solo-notice`, `confirmation-input`, `approve-button`, `reject-button` ;
- sous 900 px, la zone de travail passe à la ligne (le rail descend sous le récap) : plus de colonne de 197 px.

## 3. « SOS en cours » — 390 × 844

| Ancre | Réalisé | Maquette |
|---|---|---|
| Bouton retour 44 px | y 28–72 | y 28–72 |
| Pastille `Urgence haute · 3 min` | y 37–63 | y 32–58 |
| Titre `SOS en cours` | y 87–105 | y 81–99 |
| Carte position (carte 173 px + bandeau coordonnées) | y 172–389 | y 167–385 |
| `Appeler le 112` (`tel:`) | y 427–478, 358 × **52 px** | y 399–450, 358 × 52 |
| `Je prends` / `Appeler Léa` | y 489–541, 174 × 52 px | y 459–511 |
| Contacts d'urgence | y 553–679 | y 529–630 |
| Déroulé | y 691–783 (3 lignes) | y 647–770 (3 lignes) |
| Note de bas de page | y 801–828 | y 781–810 |

- plus de coque au-dessus de l'alerte : sous 900 px, l'écran prend le viewport (`position: fixed`,
  `--z-emergency + --z-sticky`, fond `--lkv-surface`, verrou de défilement du fond) ; au-delà, l'écran se pose
  dans la page en deux colonnes (980 px max) ;
- 112 en `<a href="tel:112">`, cible 52 px, texte blanc ; « Je prends » 52 px ; « Appeler Léa » en `tel:` ;
- coordonnées en français (`44,9246 N · 6,3452 E · ± 12 m`), en mono, `data-testid="sos-position"` ;
- contacts : préfixe « Contact d'urgence 1 — » retiré, `Appeler` en lien `tel:` de 44 px, libellés sur une ligne ;
- déroulé : 2 constats + l'étape programmée « Sans « Je prends », rappel et e-mail » (créée + 5 min) ;
- clôture : possible après « Je prends », en deux gestes, avec **note de clôture** (le contrat `sos_ack_close`
  attend `sos_id`, `action`, `note` — l'appel client envoyait `target`/`reason`, corrigé sans toucher au serveur) ;
- plus aucun débordement horizontal : `scrollWidth = 390 = innerWidth`, page = 844 px, aucun texte tronqué ;
- `data-testid` : `sos-screen`, `sos-call-112`, `sos-take`, `sos-close`, `sos-position`, `sos-timeline`.

## 4. Preuves

- `npx tsc --noEmit` : **0 erreur** (après chaque lot).
- `@axe-core/playwright` (WCAG 2.0/2.1 A-AA) : **0 violation** sur `/valider/…` 1440 et 390, `/sos/…` 390 et 1440,
  `/sos` 390.
- Cibles ≥ 44 px : aucune cible en défaut dans l'écran SOS (balayage `button,a[href],input,[role=button]`).
- Focus : contour `2px solid var(--lkv-action)` visible au clavier (retour, « Je prends »).
- Réseau : **0 requête d'écriture** (`POST /api/*`) sur valider/refuser et prendre/clore en prévisualisation.
- Captures : `valider-1440.png`, `valider-saisie-1440.png`, `valider-erreur-1440.png`, `valider-validee-1440.png`,
  `valider-390.png`, `sos-390.png`, `sos-pris-390.png`, `sos-cloture-390.png`, `sos-1440.png`,
  `sos-liste-390.png` + `mesures.json` (boîtes et débordements).

## 5. Écarts restants, justifiés

| Écart | Cause | Statut |
|---|---|---|
| `Membre` sans lien vers la fiche | pas d'identifiant membre dans `RequestDetail` (`member_handle` absent) | assumé ; le nom et le nombre de commandes sont affichés |
| Carte `Empreinte` en plus dans le rail | exigée par la mission (preuve de la liaison) ; la maquette n'a que 3 cartes | assumé |
| Rail 320 px (maquette 300), libellé de nav 260 px | largeurs de la coque (`.rail`, `.nav`) hors périmètre | signalé |
| `SOS` : contacts de 44 px (maquette 32) | cible tactile minimale | assumé |
| `SOS` : pas de « Refuge le plus proche 2,1 km » | aucun champ de distance au contrat | signalé (D-B32 propose `contacts[].distance_m`) |
| `SOS` : 3ᵉ ligne du déroulé = étape programmée, pas un événement reçu | aucun horodatage de rappel au contrat | assumé, horodatage calculé (+5 min) |
| `SOS` : bas de page 20–30 px plus bas | lignes de contacts à 44 px, mention `seulement` retirée, maquette dont la légende chevauche le bouton 112 | assumé, tout tient en 844 px |
| En-tête de la coque | `components/shell` et `crm.module.css` interdits | hors périmètre |

## 6. Besoins hors périmètre (à arbitrer)

1. **Fixture incohérente** — `demoRequest.amount_cents = 8900` (89,00 €) alors que `label` et
   `confirmation_hint` disent **89,90 €** (8990). L'écran affiche le montant du libellé pour rester fidèle à la
   maquette ; corriger `fixtures.ts` en `8990` rend tout cohérent (fichier interdit ici).
2. **Contrat de confirmation** — `/api/approve` exige **8 caractères hexadécimaux** (préfixe de l'empreinte,
   `20261109090400_crm_requests.sql`), la maquette demande le **montant**. L'UI accepte les deux ; en production,
   taper le montant seul serait refusé. Décision produit nécessaire.
3. **Champs encore manquants** dans `admin.request_detail` : `member_handle` (lien vers la fiche membre) ;
   les autres (`paid_cents`, `refunded_cents`, `refundable_cents`, `items`, `evidence`, `risk`, `card_*`,
   `member_orders`) sont désormais au type mais restent à exposer côté RPC SQL.
4. **SOS** : `contacts[].distance_m` / refuge le plus proche ; événement de rappel horodaté.
5. **Route SOS déplacée** — `(app)/sos/[id]` a été supprimé et recréé en `src/app/sos/[id]` (route nue) par un
   autre intervenant pendant le chantier. Le composant fonctionne dans les deux montages ; le fichier de route
   n'est pas dans mon périmètre.
6. **ESLint** — la configuration du dépôt pointe vers
   `kitduvoyageur_*/node_modules/eslint-config-next` et échoue (`Failed to patch ESLint`) ; contrôle non
   exécutable, `tsc` a servi de garde.
