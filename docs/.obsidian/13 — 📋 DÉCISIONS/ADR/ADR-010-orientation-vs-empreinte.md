---
title: ADR-010 — Orientation (privée) vs Empreinte (publique dérivée) : l'identité se révèle par le terrain
aliases:
  - ADR-010
tags:
  - adr
  - profils
  - identite
  - preuve-terrain
  - configurateur
date: 2026-09-04
status: Proposé
---

# ADR-010 — ORIENTATION (PRIVÉE) vs EMPREINTE (PUBLIQUE DÉRIVÉE)

### Contexte

La demande initiale : « choisir un rôle (voyageur / explorateur / trakkeur) à l'inscription,
avec une couleur assignée ». Rejeté pour trois raisons établies et non négociables :

1. **La palette LKDV n'a qu'une teinte d'accent (sage).** Warn/danger/info sont réservés au
   sémantique. Une couleur par rôle exigerait des tokens parallèles → interdit par la règle
   d'or n°1 de `docs/Design-tokens.md`. **Chiffres recalculés (2026-09-04, fond papier)** —
   voir tableau en Annexe A. Mesure : seuls 3 niveaux de contraste réellement discriminables
   en texte (tous du même vert), sage-300 = remplissage uniquement.
2. **Un rôle auto-déclaré et affiché classe des personnes** — contradiction directe avec le
   principe validé du chantier Lignées (ADR-007/008/009) : « on classe des objets, jamais des
   personnes ». La doctrine « rien ne s'affiche sans preuve terrain » s'étend ici aux profils.
3. **Inutile avant la première visite du configurateur.** Le rôle n'a aucune valeur tant que
   le premier kit n'existe pas ; le poser dans le formulaire d'inscription coûte des inscrits.

**Constat de palette sévère au passage** : `docs/CLAUDE.md` (section Design Système) liste
`#0B1F17`, `#2D6B4A`, `#A3C4A3` — or `docs/Design-tokens.md` v2.0 (§1 Interdictions) les rend
**tous interdits** (anciens ink / sémantiques parallèles). **Le présent ADR et tout le lot
s'appuient sur Design-tokens.md v2.0 comme source de vérité**, jamais sur CLAUDE.md.

### Décision

**Deux objets strictement séparés, rien d'autre.**

**① ORIENTATION — privée, jamais affichée, paramètre du configurateur.**
- Table `public.user_orientation` (4 questions factuelles : terrain, autonomie, priorité,
  expérience), **RLS `user_id = auth.uid()` en lecture et écriture, aucune policy publique**.
  Tous les champs NULLABLE — facultative de bout en bout.
- On ne demande pas « qui es-tu » (identité → hiérarchie) mais « comment tu marches »
  (pratique → paramètre).
- Posée **après** la création du compte, à la première ouverture du configurateur (carte
  capsule, bouton « passer » toujours visible), modifiable depuis `/compte`. Jamais dans le
  formulaire d'inscription. (Si Tony tient à l'inscription : étape 2 post-signup skippable.)
- **Le gain** : `/api/kit-report/generate` pré-remplit `sessionParams` depuis l'orientation,
  **annoncé** (« pré-rempli d'après ta pratique — modifier »), jamais silencieux.
- **Boucle de correction** : si l'empreinte (Lot C) contredit durablement l'orientation,
  *proposer* la mise à jour (`source = 'inferred'`) — jamais l'appliquer d'office.

**② EMPREINTE — publique, 100 % dérivée de `hike_sessions`, jamais choisie.**
- Matview `user_field_signature` : sorties, km, D+, altitude max, saisons, régions,
  autonomie max, part hors-sentier — **granularité géographique = massif/région, jamais de
  coordonnées** (même contrainte que `get_kit_journal`, Lot 2 des Lignées).
- **Plancher : sous 3 sorties, aucune empreinte** (label neutre « lignée jeune »).
- **Aucun agrégat inter-utilisateurs** : pas de moyenne, percentile, « mieux que X % » —
  c'est le point de bascule vers le classement de personnes.
- **Consentement** : `signature_visibility` sur le profil, **private par défaut** ;
  communaute/public sur acte positif avec explication de ce qui est visible et par qui.
- **Sceau visuel** : marque générative déterministe (seed = `hash(user_id)`, géométrie modulée
  par l'empreinte), SVG **en ink + sage uniquement**, lisible 24→240px, sans ordre perceptible
  (différencie, ne hiérarchise pas). Repli : glyphes dessinés dans `LkvIcon`.

**Contraintes dures (tests anti-dérive)** : aucun token CSS de couleur nouveau (aucun
`--role-*`), aucun grade/rang/niveau/palier/XP/titre comparatif, l'orientation jamais rendue
dans un composant public, aucun classement d'utilisateurs nulle part.

### Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| **Couleur par rôle** | Une teinte d'accent → 3 niveaux AAA/AA seulement ; tokens parallèles interdits (annexe A) ; non-discriminable au-delà de 3 rôles. |
| **Badge de niveau / palier XP** | C'est un classement de personnes déguisé ; la preuve terrain est une accumulation, pas une compétition. |
| **Nom de rôle dérivé et ordonnable** (« trakkeur » vs « voyageur ») | Ordonnable ⇒ hiérarchie ⇒ contre-emploi de la preuve ; difficile à tenir sémantiquement. |
| **Orientation affichée publiquement** | Classe des personnes sur auto-déclaration ; aucune utilité sociale. |
| **Pré-remplissage silencieux du configurateur** | Un défaut invisible est un piège ; l'utilisateur doit toujours savoir qui parle. |

### Renoncement explicite (s'il est demandé)

Si Tony veut malgré tout un rôle *choisi* et *affiché*, cela renonce au principe
« rien sans preuve terrain » pour les profils. **Ce renoncement doit être écrit ici, pas
subi** : une note signée en fin d'ADR (date, décision, périmètre) avant toute implémentation
d'un « rôle ». Le présent ADR reste la référence des conséquences acceptées
(risque de classement de personnes, contraste, greenwash).

### Ouvert (décisions Tony)

1. **Vocabulaire de l'empreinte** : descriptif pur (« quinze sorties, trois saisons, Écrins
   et Ariège ») *vs* mots dérivés non ordonnables — à trancher avant le Lot C.
2. **Sceau** : générateur algorithmique *vs* glyphes dessinés — décision sur maquette.
3. **Audit `/inscription`** : chantier de conformité DS séparé (violations déjà listées dans
   `docs/reports/AUDIT_INSCRIPTION_DS.md`) — n'entre pas dans ce lot.

### Statut

**Proposé — en attente GATE A** (validation Tony). L'implémentation (Lots B/C/D) ne démarre
pas avant : GATE A validé **et** préalable du chantier levé (réconciliation Stripe remplie ;
migrations Lignées 1→5 appliquées et validées — voir runbook).

---

## Annexe A — Contraste recalculé (2026-09-04, Design-tokens v2.0)

Fonds stone-50 `#FAF8F5` / papier `#FBFAF6`. Ratio WCAG 2.1, AA normal 4.5:1, AA grand 3:1.

| Tonalité | hex | #FAF8F5 | AA | #FBFAF6 | AA | Verdict |
|---|---|---|---|---|---|---|
| label (texte 1er) | `#17402c` | **10,97:1** | ✓ | **11,13:1** | ✓ | texte |
| label-secondary / sage-700 | `#365233` | **8,21:1** | ✓ | **8,34:1** | ✓ | texte |
| label-tertiary | `#5a7064` | **5,03:1** | ✓ | **5,11:1** | ✓ | texte (petit) |
| sage-500 (primaire) | `#5b7f55` | 4,30:1 | grand | 4,36:1 | grand | remplissage/large |
| sage-300 | `#a6c1a0` | 1,84:1 | ✗ | 1,87:1 | ✗ | **remplissage uniquement** |

Paires utiles : blanc sur sage-500 **4,55:1** ✓ · blanc sur sage-700 **8,71:1** ✓ ·
sage-700 sur sage-300 4,46:1 (grand) · label sur blanc 11,63:1 ✓.

→ **Conclusion** : 3 niveaux texte réellement discriminables, tous du même vert. Assigner une
couleur par rôle ne peut produire que des variantes illisibles ou des tokens parallèles.
Rien dans ce chantier n'introduit une couleur nouvelle : le sceau est ink + sage, le reste
est tokens existants. Commande de conformité (Design-tokens §10) : `0 résultat` exigé sur
tous les fichiers touchés.