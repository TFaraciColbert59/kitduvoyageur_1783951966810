# HANDOFF AGENT — CHANTIER Z · LKDV
> **Date de passation :** 07/09/2026 · 13h05 CEST
> **Dépôt :** TFaraciColbert59/kitduvoyageur_1783951966810
> **Workspace :** c:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810
> **SHA de référence actuel :** c1b704623a4799a94e0bf21bce55bc03fed5f7d2 (branch chantier/z2-donnees-verite)

---

## 0. INSTRUCTIONS DAMORÇAGE OBLIGATOIRES

### Skills à lire EN PREMIER (dans cet ordre)
1. .agents/skills/lkdv-development/SKILL.md
2. .agents/skills/subagent-driven-development/SKILL.md
3. .agents/skills/verification-before-completion/SKILL.md
4. .agents/skills/code-quality/SKILL.md
5. .agents/skills/supabase-postgis/SKILL.md
6. .agents/skills/github-workflow/SKILL.md
7. .agents/skills/apple-ui-designer/SKILL.md
8. .agents/skills/interaction-design/SKILL.md

### Fichiers de référence du Chantier Z à lire AVANT TOUT CODE
- docs/Z_PROVENANCE_AUDIT.md         (Audit Z2.1 complet provenances fabriquees)
- docs/Z_TROUS_INVENTAIRE.md         (Z2.5 : vrai inventaire des trous)
- docs/Z_POLITIQUE_DONNEES_LOCALES.md (Z2.3 : politique cache Overpass)
- docs/CHANTIER_Z_ETAT.md           (ce fichier - etat general)

---

## 1. REGLES FONDAMENTALES NON NEGOCIABLES

| Règle | Libellé |
|-------|---------|
| Z-R1 | Aucune valeur fabriquee avec source: official/community sans sourceRef URL https. Sinon: source: estimated, confidence: low |
| Z-R2 | Aucune donnee dun autre lieu ne saffiche pour le lieu courant |
| Z-R3 | Un seul selecteur par chiffre. Pas de literal JSX pour duree, distance, participants, etapes, budget |
| Z-R4 | Un test Z-D{n} par defaut, vu rouge avant correction, vert apres |
| Z-R7 | Rapport factuel uniquement. Toujours coller la vraie sortie brute du terminal |
| Z-R8 | Jamais de merge direct sur main. Branche chantier/z{n}-*, PR obligatoire |
| GEL | Aucune nouvelle fonctionnalite, route, table. Correctifs uniquement |

---

## 2. ETAT DAVANCEMENT

### Z1 - NEUTRALISATION DES RISQUES - COMPLET
SHA: 4363391 | Branch: chantier/z1-securite | Tests: 13/13 passes
- D13: Coordonnees de secours blueprint bloquees (hasVerifiedEmergencyCoordinates)
- D14/D15: lookupWaterSources et lookupMountainShelters filtres par isPointInBounds
- D17: blurSensitiveCoordinates destructif (3 decimales, isIrreversible: true)
- D18: getTripPhase() force prepare si nowIso < startIso
- D19: Ordonnances/vaccins neutralises

### Z2 - MISE EN VERITE DES DONNEES - COMPLET
SHA: c1b7046 | Branch: chantier/z2-donnees-verite | Tests: 7/7 passes | Total: 824/824 passes
- makeProposal(): source official -> estimated, confidence high -> low (tous 16 blueprints)
- Code urbanisme Art. R. 111-32-35 (corrige depuis faux Art. R331-48 environnement)
- IS, MA retrograde en estimated. Fallback pays inconnus: estimated
- Vrais noeuds OSM: #1875111743, #3953793268, #4440723933 (Chamonix verifies)
- lookupWaterSources() avec connecteur Overpass live + cache TTL 1h
- provenanceValidator.ts: isResolubleProvenance()
- ProposalCard: badge ambre Estimation pour confidence low
- GOLDEN_TEST_SUITE.md: Naismith 1h/600m (corrige depuis 300m), tarifs 2024 -> a reconfirmer

### Z3 a Z10 - NON COMMENCES

---

## 3. PROCHAINE ACTION: Z3 — COHERENCE DES CHIFFRES

**Branche a creer:** git checkout -b chantier/z3-coherence-chiffres

Defauts D20-D26 a corriger:
- D20: Duree differente header/Apercu/Vivre/pastille/Checklist
- D21: Equipement: 0/3 vs 0/11 objets prets
- D22: Compteur onglet Itineraire: 2, 39 ou 29 selon onglet
- D23: Equipage: header 1, badge 2 ou 3
- D24: Distance: "+54 m / +422 m D+" (deux valeurs dans un champ)
- D25: Statut "Active" ET "Brouillon" simultanement
- D26: Deux etapes "JOUR 1"

Tests a ecrire en TDD strict (rouge avant correctif):
- tests/trips/chantier-z3.spec.ts
  - Z-D20: duration/daysUntilDeparture/currentDay identiques partout
  - Z-D21: kitCounters = meme valeur ApertureView et KitView
  - Z-D22: stagesCount identique sur tous les onglets
  - Z-D23: participantsCount unique
  - Z-D24: elevation D+ = une seule valeur numerique
  - Z-D25: status draft et active mutuellement exclusifs
  - Z-D26: pas de doublon day_number dans trip_stages

Hooks a creer (un selecteur par valeur):
- src/features/trips/hooks/useTripDuration.ts
- src/features/trips/hooks/useKitCounters.ts
- src/features/trips/hooks/useTripCounters.ts
- src/features/trips/hooks/useTripDistance.ts
- src/features/trips/hooks/useTripStatus.ts

---

## 4. DONNEES TECHNIQUES

### Voyage test en Supabase
- ID: 1b694721-8e08-46b9-9e83-aae4de36d1c9
- Slug: fdgb-3c3a92
- URL locale: http://localhost:4000/voyages/fdgb-3c3a92
- URL live: http://localhost:4000/voyages/fdgb-3c3a92?phase=live
- Depart 29/09/2026, 29 jours, 2 etapes reelles

### Commandes essentielles
```
npm run dev                          # serveur port 4000
npm test                             # Vitest complet
npm test -- tests/trips/chantier-z1.spec.ts
npm test -- tests/trips/chantier-z2.spec.ts
npx tsc --noEmit                     # 0 erreur attendu
npm run lint
npm run build                        # SEULEMENT sans serveur dev actif
```

### Git workflow
```
git checkout -b chantier/z{n}-{desc}  # depuis branche Z2
git add {fichiers}
git commit -m "fix(z{n}): {desc}"
git push origin chantier/z{n}-{desc}
```

### IMPORTANT PowerShell
- Les "node -e" avec regex echouent dans PS
- Toujours ecrire dans un fichier .js scratch et faire node fichier.js
- Ne pas utiliser tail (non disponible), utiliser Select-Object -Last N

---

## 5. PHASES SUIVANTES (apres Z3)

### Z4 — Honnetete commerciale
- D27: Offres haute montagne pour voyage < 1500m d'altitude
- D28: Catalogue pilote le conseil au lieu de l'inverse
- D29: Libelles fournisseur BigBuy visibles utilisateur
- D30: Partenaires verifies sans definition de verifie
- D31: Affirmation securite absolue sans test

### Z5 — Finition
- D32: Image de couverture cassee (placeholder gris)
- D33: Saisies test (fdgb, ez!2wf) non filtrees
- D34: Build production — verifier CSS prod

### Z6 — Tests de verite (oracles croises)
- Z-BOUNDS: resultats connecteur dans boite englobante
- Z-NOFALLBACK: pas de substitution données autres voyages
- Z-REDLINE-ARMED: chaque ligne rouge possede un cas declencheur

### Z7 — Conformite (NE PAS TRANCHER — avis humain juridique requis)
- Regime vente de voyages
- Licences ODbL
- RGPD
- Securite applicative

### Z8 — Rectificatif du recit
### Z9 — Format rapport (voir spec section Z9)
### Z10 — Go/No-Go (6 conditions, cf. spec)

---

## 6. TRAVELPAYOUTS DRIVE

Script NTYxMTY5 dans src/app/layout.tsx lignes 194-218:
- OK localement (Playwright confirme 8 requetes vers tpembars.com)
- PAS encore verifiable par Travelpayouts (cache Netlify age 21j)
- Action UTILISATEUR requise: forcer redeploi depuis Rocket.new

---

## 7. FORMAT RAPPORT OBLIGATOIRE FIN DE PHASE

# Rapport Z{n} — {date ISO} — {branche} — {SHA}
## Defauts traites (D13...D34)
## Tests Z-D{n}: rouge avant, vert apres (sorties brutes)
## Fichiers modifies (liste + lignes)
## Sorties brutes: npm test | npm run lint | npx tsc --noEmit | git rev-parse HEAD
## Valeurs retrograde en estimated (nombre + liste)
## Ce qui NE fonctionne toujours pas
## Risques ouverts
## Prochaine phase
