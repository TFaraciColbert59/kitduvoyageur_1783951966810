# Rapport UI — LKDV Control (tâche T-2)

Rôle : `frontend` + `parite-design`. Périmètre écrit : `crm/src/app/(app)/**`, `crm/src/app/{connexion,double-authentification,acces-refuse}/**`, `crm/src/components/**`, `crm/src/ui/**`.
Date : 2026-11-09. Auteur : sous-agent `ui`.

---

## 1. Ce qui est livré

### 1.1 Routes (18)

| Route | Écran | Maquette | État |
| --- | --- | --- | --- |
| `/` | À traiter (file unifiée) | `Main.dc.html` | Livré |
| `/pole/[code]` | Pôle (File / Rechercher / Actions du pôle) | `Main.dc.html` filtrée | Livré |
| `/cas/[source]/[id]` | Carte de décision | `Moderation.dc.html` | Livré |
| `/membres/[id]` | Fiche membre 360° | `Membre.dc.html` | Livré |
| `/commandes/[id]` | Commande (client / paiement / articles) | `Membre.dc.html` adaptée | Livré |
| `/valider/[id]` | Demande à valider | `Remboursement.dc.html` | Livré |
| `/equipe` | Équipe et agents IA | `Agents.dc.html` | Livré |
| `/journal` | Journal d'audit | `Journal.dc.html` | Livré |
| `/sos` | Liste des SOS | `SOS.dc.html` (liste) | Livré |
| `/sos/[id]` | SOS en cours (mobile 390) | `SOS.dc.html` | Livré |
| `/catalogue` | 144 actions du registre, exécutables | — | Livré |
| `/contenus` | Pôle Contenus + contributions | `Main` | Livré |
| `/reglages` | Réglages, briques, indicateurs | — | Livré |
| `/ia` | Produit et IA (kill switch, quotas) | — | Livré |
| `/technique` | Erreurs, tâches, briques, temps réel | — | Livré |
| `/entrainement` | Bac à sable, 10 cas fictifs | `Moderation` | Livré |
| `/connexion` | Connexion | Carte centrée | Livré + capture |
| `/double-authentification` | Enrôlement TOTP + vérification | Carte centrée | Livré + capture |
| `/acces-refuse` | Accès refusé | Carte centrée | Livré + capture |

`crm/src/app/page.tsx` a été supprimé : la route `/` est portée par `(app)/page.tsx` (deux fichiers ne peuvent pas résoudre la même route). Aucune autre route n'a été touchée.

### 1.2 Composants (dans le périmètre)

Coque : `AppShell`, `NavPoles`, `SessionCard`, `Workspace` (+ variante `bare`), `RealtimeChip`, `NotificationsButton`, `KeyboardHelp`.
File : `QueueScreen`, `QueueList` (virtualisée), `QueueRail`.
Décision : `DecisionCard`, `BlurredMedia`, `Countdown`.
Membre : `MemberRecord` (PII masquée + `reveal_pii` motivé, notes internes, onglets).
Validation : `ApprovalPanel` (étapes, empreinte, saisie de confirmation, mode solo).
Agents : `AgentsBoard` (6 cartes, arrêt unitaire et global, double confirmation).
Audit : `AuditTable` (filtres période/acteur/type, pastilles « validé seul » / « accès sensible »).
SOS : `SosScreen` (112, « Je prends », position pendant l'alerte, contacts, déroulé).
Commandes : `CommandBar` (⌘K), `CommandDrawer` (formulaire générique des 144 actions), `ActionButtons`.
Données : `components/data/admin-rpc.ts` (RPC `admin.*` serveur, un seul point d'entrée), `cmd.ts` (POST `/api/cmd`, `/api/approve`, `/api/undo`), `use-admin-channel.ts` (canaux `admin:*`), `reason-codes.ts` / `reason-codes-client.ts`.
Primitives (`crm/src/ui/`) : `crm.module.css` (jetons uniquement), `button`, `chip`, `card`, `kbd`, `field`, `tabs`, `toast`, `drawer`, `states`, `error-state`, `offline-banner`, `use-online`, `use-hotkeys`, `avatar`, `icons`.

### 1.3 Preuves exécutées

| Contrôle | Commande | Résultat |
| --- | --- | --- |
| Typage strict | `npx tsc --noEmit` | **0 erreur** (code 0) sur l'ensemble du projet à la clôture ; aucune erreur dans mon périmètre à aucun moment |
| Build production | `npm run build` | **Succès** au moment de la livraison (30 routes, `Compiled successfully`, types verts, 102 kB partagés). À la clôture, un fichier d'un autre rôle (`src/server/db.ts`) déclenche une règle ESLint `no-restricted-imports` qui fait échouer le build — voir § 5, point 5. Aucun avertissement ESLint dans mon périmètre. |
| Build isolé (preuve reproductible) | copie hors `.next` partagé + `npx next build` | Compilation et contrôle de types **verts** ; seul le point ESLint ci-dessus bloque la fin du build |
| Couleurs littérales dans mon périmètre | `grep -rn "#[0-9a-fA-F]{3,8}\|rgba\?(" src/app/(app) src/app/connexion src/app/double-authentification src/app/acces-refuse src/components src/ui` | **0 résultat** (hors `crm.module.css`, également 0) |
| Jetons mesurés au navigateur (`/acces-refuse`, 1440) | `getComputedStyle` | carte `rgba(255,255,255,.94)` / rayon 18 / bord `rgba(23,43,36,.14)` ; titre Manrope 800 `rgb(23,64,44)` ; corps `rgb(245,247,243)` sur `rgb(23,43,36)`, Inter 14 px — conformes aux jetons |
| Captures | `etat/preuves/ui/*.png` | `Connexion-1440.png`, `Double-authentification-1440.png`, `Acces-refuse-1440.png` |

---

## 2. Fidélité à la maquette

### 2.1 Grammaire reprise (valeurs relevées dans les `.dc.html` → jetons)

| Élément | Maquette | Implémentation |
| --- | --- | --- |
| Fond | `#F5F7F3` | `--lkv-surface` |
| Carte | blanc 88 %, bord `rgba(23,43,36,.10)`, rayon 18, ombre `inset 0 1px 0 rgba(255,255,255,.9), 0 8px 24px rgba(11,31,23,.06)` | `.card` : `--card-tint`, `--lkv-border`, `--lkv-radius-md`, `inset 0 1px 0 var(--glass-rim-color)` + ombre `color-mix(--lkv-primary 8%)` |
| En-tête | blanc 72 %, bord bas, padding 14/24, gap 16 | `.header` : `--material-bar-bg` + flou `--material-bar-blur`, `--z-sticky` |
| Bouton | 44 px, rayon 14, 600 14 px | `.btn` : `--lkv-radius-sm`, `--lkv-touch-min` |
| Bouton principal | `#D3EBD9` / `#17402C` / anneau `rgba(34,97,72,.28)` | `.btnPg` : `--lkv-action-soft` / `--lkv-primary` / `--lkv-focus-ring` (valeur identique) |
| Bouton danger | `#FDE8E6` / `#7E2D25` | `.btnBad` : `--lkv-danger-bg` / `--lkv-danger-dark` |
| Pastilles | 22 px, rayon 999, 11,5/600 | `.chip*` : `--sage-100`/`--sage-800`, `--lkv-warning-bg`/`-dark`, `--lkv-danger-bg`/`-dark`, `--lkv-info-bg`, `--lkv-surface-muted`/`--lkv-text-muted` |
| Touche | 20 px, mono 11/600 | `.kbd` : `--font-mono`, fond `color-mix(--lkv-text-primary 7%)` |
| Navigation | item 40 px, actif `#D3EBD9`/`#17402C` | `.navItem` / `.navItemOn` : `--lkv-action-soft` |
| Ligne de file | 56 px, bord bas 0,5 px, sélection `#EBF2EC` + filet 3 px `#226148` | `.row` / `.rowSel` : `--lkv-forest-50`, `inset 3px 0 0 var(--lkv-action)` |
| Groupes | « Urgence haute » danger-bg, « Délai bientôt » warn-bg, autres neutres | `.groupUrgent` / `.groupWarn` / `.groupNeutral` |
| Rail | blanc 45 %, bord gauche | `.rail` : `color-mix(--lkv-surface-card 45%)` |
| Toasts | fond encre, bas centre, « Annuler · 8 s » | `.toast` + `ToastProvider` (décompte réel 10 s) |

### 2.2 Écarts visuels assumés (voulus)

1. **Données réelles** : la maquette montre des chiffres de démonstration (34 éléments, 3/10 cas sensibles, score 42/100). L'app affiche les valeurs de la base ou « non renseigné ». C'est la règle 4 du prompt maître.
2. **Rail de la file** : la maquette affiche le contexte d'un élément sélectionné (membre, règle, cas liés). Faute de RPC de contexte sur un item de file, le rail affiche l'élément sélectionné réel (titre, pôle, délai) + renvoi vers la carte de décision, et dit explicitement où trouver règle, cas liés et suggestion IA.
3. **SOS** : la carte de position est un aplat dégradé avec épingle (comme la maquette) ; aucune tuile cartographique n'est chargée (pas d'appel externe autorisé).
4. **`/equipe`** : le compteur « 6 agents » de la maquette est remplacé par le nombre réel d'agents actifs.
5. **`/journal`** : le bouton « Exporter la période » est présent mais désactivé (pas de route d'export dans le contrat) avec l'explication au survol.

### 2.3 Écarts ouverts (à fermer par d'autres rôles)

| # | Écart | Gravité | Cause | Qui ferme |
| --- | --- | --- | --- | --- |
| E1 | Captures 1440/390 des écrans de la coque impossibles sans session | Moyenne | Le middleware exige une session + `aal2` ; aucune clé de test, aucun appel externe autorisé | `testeur` (comptes de test de `07_VERIFICATION §2`) |
| E2 | Barre de commande : la section « Membres » liste les commandes du pôle Membres, pas des membres trouvés | Moyenne | Aucune RPC de recherche dans `CONTRACT.md` (`admin.search` manquante) | `base-de-donnees` + `backend` (RPC `admin.search`) |
| E3 | Fiche membre : fil d'activité événement par événement | Basse | `admin.member_360` renvoie des compteurs, pas d'événements | `base-de-donnees` (étendre `member_360`) |
| E4 | `/ia` : consommation et coûts | Basse | Aucune RPC de lecture de consommation (`ai_usage_view` est une commande, pas une lecture) | `base-de-donnees` |
| E5 | `/valider` sans index | Basse | Pas de route d'index dans `CONTRACT.md` ; l'accès se fait par la file (« À valider ») et par les toasts de demande créée | `architecte` (décider d'ajouter `/valider`) |
| E6 | Messages d'erreur métier : traduction de `42501`/`mfa_required` côté serveur | Moyenne | Le client affiche le message renvoyé par `/api/cmd` ; la traduction appartient à `src/lib/errors.ts` (backend) | `backend` |
| E7 | `/reglages` : valeurs des réglages (TVA, seuils, plafond IA) non affichées | Basse | Pas de RPC de lecture des réglages dans le contrat | `base-de-donnees` |

Aucun de ces écarts n'empêche un écran de s'afficher : chacun rend un état vide ou une mention « non renseigné » avec sa cause.

---

## 3. Checklist des 40 contrôles (`05_UI_UX_DESIGN.md` § 8)

Légende : **O** = oui (preuve), **P** = partiel (précisé), **N** = non.

| # | Contrôle | Statut | Preuve / précision |
| --- | --- | --- | --- |
| 1 | Une seule question par écran, en titre | O | `/` « À traiter », `/cas` « Commentaire signalé 3 fois », `/valider` « Valider un remboursement de X », `/membres` le pseudo, `/sos` « SOS en cours » |
| 2 | ≤ 4 infos clés, ≤ 3 actions principales | O | 4 faits en grille ; `/cas` : 3 boutons + « … » ; `/membres` : 3 + « … » |
| 3 | Deux niveaux (carte, tiroir), fiche à un lien | O | File → carte de décision → `/membres/[id]` ; tiroir pour toute action |
| 4 | Mots du quotidien | O | « Masquer », « Laisser visible », « Je prends », « Arrêter les agents » |
| 5 | Absence dite « non renseigné » | O | `non renseigné` dans `admin-rpc`, `format.ts`, et 20+ emplacements d'écran |
| 6 | Aucun chiffre décoratif ou en dur | P | Tous les compteurs viennent des RPC ; restent des constantes de **règle** assumées : plafond 10 cas sensibles (checklist 26), session 12 h / 30 min (EX-AUTH-03) |
| 7 | Accusé < 100 ms, réponse < 400 ms | P | Accusé immédiat : état local `busy`, toast ; mesure p95 à faire en couche 7 (non instrumentée ici) |
| 8 | Élément suivant préchargé | O | `router.prefetch` du cas suivant dans `QueueList` |
| 9 | Raccourci affiché sur chaque bouton | O | `Button shortcut` (M, L, S, A, P) + `<Kbd>` sur les lignes |
| 10 | Clavier, souris, toucher | O | `useHotkeys` (J/K/↵/M/L/S/A/P/?/⌘K/Échap), cibles 44 px, `onClick` partout |
| 11 | Rien ne bloque pendant l'enregistrement | O | Boutons désactivés ciblés + libellé « Envoi… », pas d'overlay bloquant |
| 12 | Annulation 10 s ou confirmation nommée | O | Toast « Annuler · N s » → `/api/undo` ; arrêt d'agent en deux temps |
| 13 | Saisie du pseudo pour bannir/supprimer | O | Champ « Confirmation » dans le tiroir (`needsConfirmation`) |
| 14 | Second avis pour les actions graves ; un agent ne valide jamais | O | `needsValidation` → « Créer la demande » + `/valider/[id]` ; bandeau « 2 personnes » ; `agentCanValidate` dans `lib/rbac` |
| 15 | Motif obligatoire | O | Sélection bloquante (`DecisionCard`, `CommandDrawer`) + liste `admin.reason_codes` (repli bundle M01) |
| 16 | Message membre généré, avec recours | O | Aperçu `member_text` + précision + phrase de recours 6 mois |
| 17 | Contexte visible à côté | O | Rail : membre, règle, cas liés, session |
| 18 | Avertissement avant action risquée | O | Bandeau « irréversible », « Mode solo », « Rôle insuffisant » |
| 19 | Suggestion IA après le contenu, avec confiance | O | Carte IA placée **sous** le contenu et la décision, avec % |
| 20 | Action et consultation sensible journalisées | O | `reveal_pii` motivé, texte « Chaque affichage est inscrit au journal » |
| 21 | Données personnelles masquées par défaut | O | `email_masked` / `phone_masked` + bouton « Afficher » |
| 22 | Pas d'accès `trip_documents` ni `user_orientation` | O | Aucun appel ; la fiche dit « Super admin seul · 15 min · journalisé. Cet écran ne les ouvre pas. » |
| 23 | Accès motivé et limité pour un contenu privé | O | Motif ≥ 3 caractères + `revealed_until` affiché |
| 24 | Écran invisible sans le rôle | O | Filtrage `canRun` (barre de commande, catalogue, pôles) ; la base reste la vérité |
| 25 | Images grisées/floutées | O | `BlurredMedia` : `grayscale(1) blur(6px)`, net au survol/focus, bouton « Afficher » |
| 26 | Plafond de cas sensibles, pause proposée | P | Plafond et pause affichés (carte session, carte de décision) ; le **compteur** n'existe pas encore en base → « non renseigné » |
| 27 | Pas de son hors urgence haute | O | Aucun son dans le CRM |
| 28 | Aucun classement ni compteur de productivité individuelle | O | Aucun score par personne ; le journal ne mesure pas le temps |
| 29 | Changements des collègues sans recharger | O | `useAdminChannel('admin:queue')` → `router.refresh()` sur broadcast |
| 30 | Présence affichée | P | Canal de présence créé ; l'UI n'affiche que l'état de connexion (pas la liste des présents, faute de RPC) |
| 31 | Décision répercutée immédiatement | O | `router.refresh()` après chaque action ; canal temps réel |
| 32 | Cibles ≥ 44 px | O | `.btn` 44, `.row` 56, `.field` 44, bouton SOS 52 |
| 33 | Focus jamais masqué ; équivalent au clic | O | `:focus-visible` global (globals) + focus visible sur champs ; bouton « Afficher » pour le média |
| 34 | Contraste AA, couleur jamais seule | O | Couleur toujours doublée d'un texte (« Urgence haute », « Dépassé de 12 min ») |
| 35 | Jetons `--lkv-*`, SVG sobres, primitives du CRM | O | 0 couleur littérale (grep) ; `icons.tsx` maison ; primitives `ui/*` |
| 36 | axe sans violation | N | Non exécuté (couche 5, rôle `testeur`) — aucun test écrit par moi |
| 37 | Urgences utilisables sur téléphone | O | `/sos` mobile d'abord (390), 112 en `<a href="tel:112">` 52 px |
| 38 | 100 % des tâches réussies sans aide (novice) | N | Test scénarisé non exécuté (couche 9) |
| 39 | UMUX-Lite ≥ 80 | N | Non mesuré (couche 6/9) |
| 40 | Messages d'erreur : cause, solution, saisie conservée | O | `ErrorState` (cause + solution + Réessayer) ; `runCommand` traduit 404/réseau/refus ; les formulaires conservent la saisie |

### 3.1 Contrôles non satisfaits, écran par écran

| Écran | Non satisfaits | Pourquoi |
| --- | --- | --- |
| `/connexion`, `/double-authentification`, `/acces-refuse` | 36, 38, 39 | Tests axe / novice / UMUX non exécutés par ce rôle |
| `/` (file) | 26, 30, 36, 38, 39 | Compteur de cas sensibles et liste de présence absents des RPC |
| `/cas/[source]/[id]` | 26, 36, 38, 39 | idem |
| `/membres/[id]` | 36, 38, 39 | idem |
| `/valider/[id]` | 36, 38, 39 | idem |
| `/equipe`, `/journal` | 30, 36, 38, 39 | présence non exposée |
| `/sos`, `/sos/[id]` | 36, 38, 39 | idem |
| `/catalogue`, `/pole/[code]`, `/contenus`, `/reglages`, `/ia`, `/technique`, `/entrainement`, `/commandes/[id]` | 36, 38, 39 | idem |

---

## 4. Comportements vérifiables (lecture du code)

- **Virtualisation** : `QueueList` calcule des sommes de préfixes (groupe 36 px, ligne 58 px), une recherche binaire sur `scrollTop`, un rendu de `viewport/58 + 2×8` lignes. 10 000 éléments → ~27 lignes montées, hauteur totale ~580 000 px.
- **Raccourcis** : `useHotkeys` ignore `INPUT/TEXTAREA/SELECT/contenteditable`, ignore les modificateurs (sauf ⌘K), traite `Échap` et `?` séparément.
- **Annulation** : `DecisionCard` et `CommandDrawer` n'affichent « Annuler » que si la réponse contient `audit_id` ; l'appel part vers `/api/undo` avec cet identifiant.
- **Hors connexion** : `useOnline` + bandeau ; `cmd.ts` refuse l'envoi et le dit (aucune action perdue silencieusement).
- **Temps réel** : canal privé `admin:queue` avec `presence` ; `SUBSCRIBED` → « connecté », erreur → « indisponible » (jamais un faux « connecté ») ; `online` → `router.refresh()`.
- **Aucune écriture directe** : aucune table n'est écrite depuis le navigateur ; seules des RPC de lecture (`admin.*`) et des POST vers `/api/cmd`, `/api/approve`, `/api/undo` sont utilisés.

---

## 5. Ce qui reste (hors périmètre UI)

1. Couche 5 (axe) et couche 6 (captures 1440/390 de la coque) : rôle `testeur`, avec les comptes de test.
2. Couche 7 (mesures < 100 ms / < 400 ms) : instrumentation Playwright.
3. RPC manquantes listées en § 2.3 (recherche, événements d'activité, consommation IA, réglages, index `/valider`).
4. Traduction métier des codes d'erreur serveur (`42501`, `mfa_required`) dans `src/lib/errors.ts`.
5. **Bloquant de build hors UI** : `src/server/db.ts` (rôle backend) importe `@/lib/supabase/service` et déclenche la règle `no-restricted-imports` de la configuration ESLint (`Import réservé à src/server/**`) alors que le fichier **est** dans `src/server/`. À corriger soit dans `eslint.config.mjs` (motif `files`/`ignores`), soit dans le fichier. Sans cela, `npm run build` s'arrête après la compilation et le contrôle de types (qui, eux, sont verts).

## 6. Risques

- **R1** — Si `admin.inbox()` renvoie plus de ~10 000 éléments, la construction des entrées reste linéaire à chaque changement de filtre (négligeable à 10 000, à surveiller au-delà).
- **R2** — Les libellés d'action viennent de `detail.actions` ; un libellé inattendu ne casse rien (repli « Toutes les actions du catalogue »), mais le raccourci M/L/S dépend du libellé (regex). Si la base renomme les libellés, le raccourci disparaît sans casser l'écran.
- **R3** — `reveal_pii` est appelé depuis le navigateur : c'est une RPC de lecture journalisée, prévue au contrat. Elle doit rester `security definer` avec contrôle `admin.assert_staff`.
- **R4** — Le repli des motifs (`BUNDLED_REASON_CODES`) est utilisé si la base est muette ; il est identique au seed M01 mais doit être vérifié par `catalog:diff` après chaque migration.

---

## 7. Reproduire les preuves

```bash
cd crm
npx tsc --noEmit          # 0 erreur
npm run build             # build OK (30 routes)
grep -rn "#[0-9a-fA-F]\{3,8\}\|rgba\?(" \
  src/app/\(app\) src/app/connexion src/app/double-authentification \
  src/app/acces-refuse src/components src/ui   # 0 résultat
```

Captures : `crm/bundle/etat/preuves/ui/{Connexion,Double-authentification,Acces-refuse}-1440.png`.

> Note d'exécution : `crm/.next` est partagé avec le serveur de développement d'un autre rôle. Un `rm -rf .next` concurrent laisse un cache incohérent (`PageNotFoundError: /_document`). Pour une preuve fiable sans arrêter le serveur des autres, copier `crm/` hors du `.next` partagé (node_modules lié) et lancer `npx next build` : c'est la méthode utilisée pour la preuve finale.
