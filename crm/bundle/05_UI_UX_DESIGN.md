# UI / UX / design — LKDV Control

Référence visuelle : `references/maquette/*.dc.html` (8 écrans, ouvrables dans un navigateur ; la mise en page est dans les attributs `style` et le bloc `<style>` de chaque fichier). Référence de marque : `DESIGN_SYSTEM.md`, `docs/compas/DESIGN_REFERENCE.md`, `src/styles/tokens.css` du dépôt. Le CRM est une déclinaison **dense, bureau d'abord** du design LKDV, pas une nouvelle identité.

## 1. Jetons (copiés de `src/styles/tokens.css`, jamais réinventés)

| Rôle | Jeton | Valeur |
| --- | --- | --- |
| Primaire (titres, sélection) | `--lkv-primary` | `#17402C` |
| Action | `--lkv-action` | `#226148` ; fond doux `--lkv-action-soft` `#D3EBD9` |
| Accent sage | `--lkv-secondary` | `#5B7F55` ; `--sage-100` `#D8E5D5` ; `--sage-800` `#2D482A` |
| Fond d'application | `--lkv-surface` | `#F5F7F3` |
| Surface carte | `--lkv-surface-card` | `#FFFFFF` (verre : blanc 88 %, bord `rgba(23,43,36,.10)`) |
| Surface atténuée | `--lkv-surface-muted` | `#EDF1EA` |
| Texte | `--lkv-text-primary` / `--lkv-text-secondary` | `#172B24` / `#56665D` |
| Bordures | `--lkv-border` / `--lkv-border-subtle` | `rgba(23,43,36,.14)` / `rgba(23,43,36,.07)` |
| Attention | `--lkv-warning` / `-bg` / `-dark` | `#C89A3B` / `#FBF1DC` / `#765014` (texte) |
| Danger | `--lkv-danger` / `-bg` / `-dark` | `#A8443A` / `#FDE8E6` / `#7E2D25` (texte) |
| Information | `--lkv-info` / `-bg` | `#4B6B7C` / `#DDE7EE` (texte sur fond info : `--lkv-text-primary`) |
| Succès | `--lkv-success` / `-bg` | `#3D6038` / `#E1EBDE` |
| Rayons | `--lkv-radius-sm` / `-md` / `-lg` / `-control` | 14 / 18 / 24 / 18 px |
| Ombres | encre | `rgba(11,31,23,.06)` à `.32`, jamais `rgba(0,0,0)` |
| Polices | `--font-sans`, `--font-brand`, `--font-mono` | SF Pro / Inter ; Manrope (titres d'écran) ; IBM Plex Mono (identifiants, montants) |

Interdits (règles LKDV) : `#E4501C`, `#1C2620`, `#A3C4A3`, `#0B1F17`, `#2D6B4A` dans du code neuf ; toute couleur littérale hors fichier de jetons ; boutons à couleur primaire **pleine** (le Compas impose le verre teinté).

## 2. Composants du CRM (dossier `crm/src/ui/`)

| Composant | Rôle | Source de style |
| --- | --- | --- |
| `AppShell` | En-tête (logo, barre de commande, mode solo, temps réel, notifications, compte) + navigation + zone de travail + panneau de contexte | Maquette `Main.dc.html` |
| `NavPoles` | Navigation : À traiter, 7 pôles avec compteurs, Pilotage (Équipe et agents, Journal, Réglages), carte « Votre session » | Maquette |
| `CommandBar` | ⌘K / Ctrl+K : recherche + actions autorisées, sections Actions / Membres / Commandes / Récents, aide clavier | `Commande.dc.html` |
| `QueueList` + `QueueRow` | File virtualisée, groupes, compte à rebours, pastilles, raccourci | `Main.dc.html` |
| `DecisionCard` | 4 faits + contenu + actions (3 principales + …) + motif + aperçu du message membre | `Moderation.dc.html` |
| `ContextRail` | Panneau droit contextuel selon l'objet (membre, commande, signalement, SOS) | Maquettes |
| `MemberRecord` | Fiche 360° 3 colonnes, données masquées, résumé IA, onglets, fil d'activité replié | `Membre.dc.html` |
| `ApprovalPanel` | Validation à 2 personnes / mode solo, étapes, récap, saisie de confirmation | `Remboursement.dc.html` |
| `AgentCard` | Agent : pôle, statut, 24 h, taux accepté, plafond, outils, arrêter | `Agents.dc.html` |
| `AuditTable` | Journal filtrable, pastilles « validé seul », « accès sensible » | `Journal.dc.html` |
| `SosScreen` | Mobile d'abord, 112, « Je prends », position, contacts, déroulé | `SOS.dc.html` |
| `Chip` (tons sage/warn/danger/info/stone), `Button` (pg/soft/bad), `Kbd`, `Toast` (annuler 10 s), `EmptyState`, `ErrorState`, `Skeleton` | Primitives | Toutes les maquettes |
| `BlurredMedia` | Image grisée + floutée, nette au survol / appui long, accessible au clavier (« Afficher ») | `Moderation.dc.html` |

## 3. Écrans

Les 8 écrans de la maquette sont des **gabarits**. Chaque domaine du catalogue s'y range ainsi :

| Écran | Route | Gabarit | Actions couvertes |
| --- | --- | --- | --- |
| À traiter | `/` | Main | File unifiée, lots |
| Pôle (×7) | `/pole/[code]` | Main (file filtrée sur le pôle) + onglets « File », « Rechercher », « Réglages du pôle » | Toutes les actions du pôle |
| Cas | `/cas/[source]/[id]` | Moderation | Toutes les décisions sur un contenu ou un signalement |
| Membre | `/membres/[id]` | Membre | D1, notes, historique |
| Commande | `/commandes/[id]` | Membre (3 colonnes) adapté : client, paiement, logistique | D11 |
| Demande à valider | `/valider/[id]` | Remboursement | Toutes les actions « 2 personnes » |
| Équipe et agents | `/equipe` | Agents | ACT-144, T-03, T-08 |
| Journal | `/journal` | Journal | ACT-143 |
| SOS | `/sos/[id]` | SOS (mobile) / Moderation (bureau) | D14 |
| Catalogue, contenus, réglages, IA, technique | `/catalogue`, `/contenus`, `/reglages`, `/ia`, `/technique` | Main (liste) + tiroir de détail ; formulaires selon les règles Shopify (§ 5) | D10, D15, D17, D19, T-10 |
| Bac à sable | `/entrainement` | Moderation avec 10 faux cas | EX-UX-04 |
| Connexion, double authentification | `/connexion`, `/double-authentification` | Carte centrée, sobre | EX-AUTH |

Toute action du catalogue doit être atteignable en **3 gestes au plus** depuis « À traiter » ou par la barre de commande.

## 4. Interactions

- Raccourcis : `J`/`K` naviguer, `Entrée` ouvrir, `M` masquer, `L` laisser, `S` sanctionner, `A` approuver, `P` prendre (SOS), `⌘K` barre de commande, `?` aide, `Échap` fermer. Chaque bouton affiche son raccourci. Aucun raccourci global ne s'active dans un champ de saisie.
- Mise à jour optimiste : l'état change à l'écran immédiatement, synchronisé en arrière-plan ; un échec réel s'affiche avec la cause et « Réessayer ».
- Annulation 10 s (toast en bas au centre) pour les actions marquées « Annul. 10 s ».
- Confirmation uniquement pour l'irréversible : bouton qui nomme l'action ; saisie du pseudo pour bannir/supprimer ; saisie du montant pour les remboursements.
- Trois paliers d'information : ligne de file (3 s) → carte + contexte (décision) → fiche complète (lien explicite).
- Suggestion IA : affichée après le contenu, avec la confiance, jamais appliquée en un clic.
- Ludique sans pression : progression du jour, série de jours « file tenue », « Boîte vide » célébrée (animation courte, respect de `prefers-reduced-motion`) ; aucun classement, aucun compteur individuel comparatif.

## 5. Formulaires (règles Shopify retenues)

Pas de grand formulaire dans une fenêtre modale ; au-delà de 5 champs, sections titrées ; champs conditionnels révélés progressivement ; barre d'enregistrement explicite quand des changements sont en attente ; erreurs à côté du champ, en mots simples, saisie conservée.

## 6. États

Chargement : squelettes (jamais d'écran blanc) ; vide : `EmptyState` qui dit ce qui apparaîtra et comment ; erreur : cause + solution + « Réessayer » ; hors connexion : bandeau, actions mises en attente et rejouées. Jamais de chiffre inventé : « non renseigné ».

## 7. Rédaction

Phrases courtes, verbes d'action sur les boutons (« Masquer le commentaire », pas « OK »), aucun jargon technique, aucun code d'erreur brut. Les erreurs de base sont traduites : `42501` + `mfa_required` → « Activez la double authentification pour continuer ».

## 8. Checklist des 40 contrôles (par écran, avant la porte de phase)

**Clarté** — 1. Une seule question par écran, écrite en titre. 2. ≤ 4 informations clés par carte, ≤ 3 actions principales. 3. Deux niveaux dans le flux (carte, tiroir), fiche complète à un lien. 4. Mots du quotidien. 5. Absence dite « non renseigné ». 6. Aucun chiffre décoratif ou en dur.
**Vitesse** — 7. Accusé < 100 ms, réponse < 400 ms. 8. Élément suivant préchargé. 9. Raccourci affiché sur chaque bouton. 10. Clavier, souris et toucher. 11. Rien ne bloque l'écran pendant l'enregistrement.
**Décisions sûres** — 12. Annulation 10 s ou confirmation nommée. 13. Saisie du pseudo pour bannir/supprimer. 14. Second avis pour les actions graves et tout remboursement ; un agent ne valide jamais. 15. Motif obligatoire. 16. Message membre généré, avec recours. 17. Contexte visible à côté. 18. Avertissement avant action risquée. 19. Suggestion IA après le contenu, avec confiance.
**Traçabilité** — 20. Action et consultation sensible journalisées. 21. Données personnelles masquées par défaut. 22. Pas d'accès `trip_documents` (sauf SA, motif, 15 min) ni `user_orientation`. 23. Accès motivé et limité pour un contenu privé. 24. Écran invisible sans le rôle.
**Bien-être** — 25. Images grisées/floutées. 26. Plafond de cas sensibles, pause proposée. 27. Pas de son hors urgence haute. 28. Aucun classement ni compteur de productivité individuelle.
**Temps réel** — 29. Changements des collègues sans recharger. 30. Présence affichée. 31. Décision répercutée dans LKDV immédiatement.
**Accessibilité et design** — 32. Cibles ≥ 44 px. 33. Focus jamais masqué ; équivalent au clic pour tout glisser. 34. Contraste AA, couleur jamais seule. 35. Jetons `--lkv-*`, icônes `public/icons/sf` ou SVG maison sobres, primitives du CRM. 36. axe sans violation. 37. Urgences utilisables sur téléphone.
**Validation** — 38. 100 % des tâches réussies sans aide par un novice (test scénarisé). 39. Score UMUX-Lite estimé ≥ 80 (équivalent SUS). 40. Messages d'erreur relus : cause, solution, saisie conservée.
