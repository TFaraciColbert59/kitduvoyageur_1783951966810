# Fiche membre 360° — fidélité maquette

Référence : `bundle/references/maquette/Membre.dc.html` + `reference/maquette/Membre-1440.png`.
Captures : `fix-01-fiche`, `fix-02-pii`, `fix-03-drawer`, `fix-04-menu` (1440×1040, `/membres/d1200000-…-0001`).
Contrôles : `npx tsc --noEmit` → **0 erreur** ; aucun débordement horizontal (1440 / 1180 / 1024 / 900) ; aucune cible < 32 px ; 0 erreur console ; recherche, onglets et menu testés au clic.

## 1. Écarts corrigés

| # | Maquette | Avant | Maintenant |
| --- | --- | --- | --- |
| 1 | En-tête : avatar 64, nom, 3 pastilles (Compte actif / 1 avertissement actif · expire le 28 oct. 2027 / Membre depuis mars 2025), actions à droite | pastilles dans le désordre, actions issues de `member.actions` (Bannir, libellés longs), 2 lignes | 3 pastilles dans l'ordre et le libellé de la maquette, dates formatées (`28 oct. 2027`, `mars 2025`), actions `Écrire au membre` / `Déconnecter partout` / `Suspendre…` / `…` sur une seule ligne à droite |
| 2 | Colonne gauche : Coordonnées (e-mail + téléphone masqués, un « Afficher » chacun, note journal), Compte (Pseudo, Visibilité, 2FA, Consentement, Documents + « Ouvrir avec motif » + « Super admin seul · 15 min · journalisé ») | un seul bouton « Afficher » (e-mail), pas de Visibilité/2FA/Consentement/Documents, Score/Palier/Dernière activité en trop | les 5 lignes Compte, un « Afficher » par coordonnée, bouton Documents + mention ; Score/Palier/Dernière activité retirés (ils vivent dans le rail) |
| 3 | Centre : badge « Agent Résumeur · à relire » à droite du RÉSUMÉ, onglets Activité / Modération · 4 / Commandes · 2 / Voyages · 3 / Accès à cette fiche, recherche, **fil groupé** (À venir, Novembre 2026, Octobre 2026) avec pastilles carrées par kind et dates | badge à droite mais onglets `Notes · 2` en trop, fil d'activité = état vide | fil groupé rendu depuis `activity_events` : pastille 30×30 (couleur de jeton par kind), libellé fort + détail atténué, référence de commande en mono, date à droite ; recherche filtrante (accents ignorés) ; onglet `Notes` supprimé, notes internes déplacées dans Modération (voir §3) |
| 4 | Rail : CONFIANCE (42/100 + barre orange + « Sorties prouvées au GPS : 9 · signalements reçus : 4 »), COMMANDES (2 lignes numéro/montant/statut), SUPPORT (« Aucun ticket ouvert »), APPAREILS ET SESSIONS (« 2 sessions actives · iPhone, navigateur », « Dernière connexion il y a 1 h »), pas de carte Rappel | carte Rappel, libellés « non renseigné », pas de liste de commandes, label « Contexte » | les 4 cartes de la maquette, aucune carte Rappel, label « Contexte » retiré |
| 5 | En-tête de fiche pleine largeur (le rail commence sous l'en-tête) | en-tête limité à la colonne centrale → actions rejetées à la ligne | l'écran compose `en-tête / identité | centre | contexte` dans le `main` et réutilise la classe `.rail` (aucun fichier de coque touché) |

Aussi corrigé : `Commandes · 2` n'affiche plus un état vide mensonger (la fiche reçoit désormais `orders[]`) — les deux commandes sont listées ; `Voyages · 3` affiche un état vide honnête (compteur seul).

## 2. Restant, justifié

- **Pastille « Reste 12 min » (ligne « À venir »)** : `Member360.activity_events` ne porte pas d'échéance (`due_at`). L'écrire serait une donnée inventée ; le créneau de droite reste vide sur cette seule ligne.
- **Bouton « Afficher les 38 événements plus anciens »** : la fiche ne reçoit ni total ni pagination d'événements (6 événements, tous rendus). Bouton factice = interdit.
- **Police mono plus légère** : `IBM Plex Mono` est déclarée (`src/design/tokens.css`) mais jamais chargée — repli `ui-monospace`. Écart de graisse sur e-mail, téléphone et références. Correctif = chargement de la police dans `src/app/layout.tsx` (hors périmètre).
- **Barre latérale 232 px contre 260 px** dans la maquette (`.nav`, coque) : décalage horizontal de 28 px de tout l'écran ; les colonnes font la même largeur que la maquette (identité 310, contexte 320, centre 578 contre 549).
- **Boutons `btnSm` à 36 px** (maquette 32) pour « Afficher » / « Ouvrir avec motif » : seule taille petite du design system (`crm.module.css`, hors périmètre). Les actions d'en-tête, la recherche et les lignes d'activité sont à 44/48 px.
- **Drawer** : générique, non modifié (consigne). Constats à traiter hors périmètre : pas de maquette de drawer dans `reference/maquette/` ; le drawer actuel a des intitulés de sections (CIBLE / MOTIF ET MESSAGE / MONTANT ET DATE / MESSAGE AU MEMBRE / NOTE INTERNE) et un pied de page avec l'action principale à droite, différents de la capture `08-membre-drawer` fournie. L'en-tête du drawer affiche le libellé du catalogue (`Suspendre (date de fin)`), pas le libellé court du bouton — écart assumé côté registre.
- **« Écrire au membre »** : aucune commande d'envoi de message au registre (`src/lib/catalog.ts`, hors périmètre). Le bouton ouvre la seule action réelle d'écriture au membre (`ticket_reply`, champ cible vide pour éviter une cible fausse). Correctif propre = ajouter une commande `member_message` au catalogue.
- **« Ouvrir avec motif »** : aucune RPC/commande n'ouvre les documents d'identité depuis cette fiche. Le bouton explique l'impossibilité (toast) au lieu de simuler une ouverture.
- **Onglet Notes** : la maquette n'en a pas. Le journal interne (liste + ajout) est conservé dans l'onglet Modération pour ne pas perdre la commande `note_add`.

## 3. Fichiers

- `crm/src/components/member/member-record.tsx` — réécrit (en-tête, colonne identité, centre, fil groupé, onglets, menu « … »).
- `crm/src/app/(app)/membres/[id]/page.tsx` — rail de contexte (4 cartes) + composition.
- Captures : `crm/bundle/etat/preuves/design/fix-member/fix-0{1..4}-*.png` + ce rapport.

Aucun autre fichier modifié ; aucun commit. Scripts de capture jetables supprimés.

## 4. À traiter hors périmètre

1. `components/shell/workspace.tsx` : prévoir un slot d'en-tête pleine largeur (aujourd'hui le rail est frère du `main`, d'où la composition locale).
2. `lib/catalog.ts` : commande d'envoi de message au membre ; commande d'ouverture des documents d'identité.
3. `lib/rpc.ts` + RPC `admin.member_360` : `due_at` par événement, total/pagination d'activité, liste des voyages.
4. `app/layout.tsx` : charger `IBM Plex Mono` (mono du design system).
