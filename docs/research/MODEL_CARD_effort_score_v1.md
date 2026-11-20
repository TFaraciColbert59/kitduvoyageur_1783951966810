# MODEL CARD — `effort-score-v1` (Moteur Bioénergétique d’Effort & Prédiction Collective V2)

**Version du modèle** : `effort-score-v1`  
**Date de publication** : 20 novembre 2026  
**Périmètre** : `src/features/adventure-intelligence/domain/` (moteur pur, zéro I/O, déterministe)  
**Statut de déploiement** : Mode *shadow* désactivé par défaut (`effort_score_v1_shadow = false`, `group_prediction_v2_shadow = false`)

---

## 1. Architecture scientifique (`effort-score-v1`)

Le moteur `effort-score-v1` remplace les heuristiques additives par une chaîne bioénergétique modulaire et explicable :

1. **Noyau métabolique LCDA (Looney et al., 2019, 2022)** :
   - Pente : $m_{\text{grade}} = 0.34 \cdot v \cdot g_{\%} \cdot \left(1 - 1.05^{1 - 1.1^{g_{\%} + 32}}\right)$
   - Métabolisme de repos $m_{\text{rest}}$ par Cunningham / Schofield (`1.25 W/kg` pour le profil de référence 75 kg).
   - Charge sac à dos : $\text{loadFactor} = 1 + 1.96 \cdot L_{\text{Bp}}^{1.36}$ avec $L_{\text{Bp}} = \text{clamp}(\text{packWeightKg} / \text{weightKg}, 0, 0.70)$ (facteur linéaire $1 + L_{\text{Bp}}$ pour `carryType = "vest"`).
   - Puissance métabolique : $m_{\text{LCDA}} = W \cdot \left[m_{\text{rest}} + 0.19 + \eta \cdot \left(1.78 v^{0.58} + 0.27 v^4 + m_{\text{grade}}\right) \cdot \text{loadFactor}\right]$.
2. **Terrain, neige & sol latent ($\eta$)** :
   - Table OSM $\rightarrow \eta$ (`asphalt 1.00`, `compacted 1.05`, `dirt 1.10`, `gravel 1.15`, `grass 1.20`, `rock/scree 1.35` + frein vitesse, `mud 1.50..1.80`, `sand 1.50 + 1.3 v^2`).
   - Neige fraîche (**Pandolf et al., 1976**) : $\eta = \min(5.0, 1.30 + 0.082 \cdot \text{snowSinkCm})$.
   - Modulation boue par `API_72h` + `soilMoistureVwc` uniquement sur sols non revêtus ($T_{\text{sol}} > 0\,^\circ\text{C}$) ; si $T_{\text{sol}} \le 0\,^\circ\text{C}$ et humide $\Rightarrow$ alerte `verglas` dans `risque`.
3. **Traînée aérodynamique vectorielle (Pugh, 1971)** :
   - $v_{\text{rel}} = v + v_{\text{wind,head}}$ (signée), surface corporelle DuBois ($0.266 \cdot \text{BSA}$), $P_{\text{aero}} = \max(0, F_{\text{aero}} \cdot v / 0.25)$.
4. **Chaussures, couches froid & marche nocturne** :
   - Chaussures lourdes : `+0.96 %` par 100 g/pied (Legg & Mahanty, 1986).
   - Couches froid : `+3 %` par kg de vêtement ou par couche (Rintamäki, 2007 / Kuklane, 2020).
   - Marche de nuit / crépuscule dépassé : `+10 %` à `+30 %` selon pente et technicité (Norrbrand, 2023/2025).
5. **Capacité aérobie effective** :
   - $P_{\text{VO2max,sea}} = (\dot{V}\text{O}_{2\max} \cdot W / 1000) \cdot 335$ (`1 206 W` pour le profil référence `75 kg`, `48 mL/kg/min`).
   - Hypoxie (**Péronnet et al., 1991**) en pression barométrique $P_B(\text{Torr})$ jusqu’à 4 500 m, relayée par sigmoïde continue au-delà.
   - Stress thermique `fTherm(UTCI, deltaIcl)` borné et monotone.
6. **Fusion sans double comptage (Bayes-Kalman à variance inverse)** :
   - `iMod = mEffW / pVo2MaxEffW`. En `cardio`/`complet`, fusion inverse-variance avec la FC observée et calcul de `iec = iMod / iObs`.
   - En `socle`, `iEff = iMod` et `varPost = varMod` (**aucune pénalité sur la valeur centrale**).
   - Filtre anti-surdéclaration : si $(i_{\text{Mod}} - i_{\text{Obs}}) > 2.5 \sigma$ avec sac lourd déclaré, rétraction vers le prior et warning `low_confidence`.
7. **Double canal en descente** :
   - Canal métabolique (LCDA kJ) pour nutrition et hydratation.
   - Canal excentrique pour le score proportionnel à $D_- \cdot (W + L)$, atténué de `25 %` lorsque `hasPoles = true`.
8. **Dose, Hill 0–100 %, Shapley exact & Sécurité séparée** :
   - $\text{dose} = \sum 100 \cdot \psi_{\text{env}} \cdot \psi_{\text{cog}} \cdot (i_{\text{eff}} / 0.70)^2 \cdot (\Delta t / 3600)$
   - $\text{score} = 100 \cdot \text{dose}^{1.35} / (180^{1.35} + \text{dose}^{1.35})$
   - **IEA** (profil référence 75 kg, $\dot{V}\text{O}_{2\max} = 48$) et **ERP** (profil personnel) calculés séparément.
   - **Shapley exact** sur $K = 6$ piliers ($2^6 = 64$ coalitions : `ascent`, `descent`, `packLoad`, `surfaceAndSnow`, `thermalAndWind`, `altitude`) garantissant $\sum \phi_k = \text{IEA} - \text{IEA}_{\text{baseline}}$ à $< 10^{-12}$.
   - **Technicité (1..5)** et **Risque** (WCT/IREQ, WBGT/HSDA, sudation Gonzalez, MAWD, verglas, nuit, BRA) strictement séparés et jamais additionnés au score.

---

## 2. Contrats transversaux & Domaine de validité

- **Conventions d’unités strictes (Contrat A)** : `weightKg` / `packWeightKg` (kg, $L_{\text{Bp}} \in [0, 0.70]$), `speedMs` (m/s), `gradePct` (%) / `gradeDec = gradePct / 100`, `snowSinkCm` (cm), `tempC` (°C), `windMs` (m/s ; `windKmh = windMs * 3.6` exclusivement dans Wind Chill), `altitudeM` (m), `durationS` (s ; heures `durationS / 3600` pour la dose).
- **Domaine de validité LCDA** : `[0.45, 1.97] m/s`. Tout segment en dehors émet le drapeau `outOfDomain: true` et un avertissement explicite `out_of_domain`.
- **Provenance obligatoire (Contrat B)** : chaque sortie embarque un tableau `Evidence<T>[]` (`value`, `unit`, `source`, `kind`, `quality`, `uncertainty`, `capturedAt`, `licenceSnapshot`, `modelVersion`).
- **Immutabilité & Cache (Contrat C)** : `snapshotHash = sha256(modelVersion | profileVersion | routeFeatureVersion | equipmentSnapshot | contextSnapshot | scenario)` (SHA-256 FIPS 180-4 déterministe, parité bit-à-bit vérifiée avec WebCrypto).

---

## 3. Résultats mesurés de vérification (Lots P1, P5, P6)

### 3.1 Vecteurs de test dorés (Lot P1 — `effortScore.test.ts`)

| Scénario doré | Paramètres clés | Puissance mesurée (`mEffW`) | Cible puissance | Score IEA mesuré | Cible IEA | Statut |
|---|---|---|---|---|---|---|
| **Golden Test 1 — Printemps plat 15 km** | 75 kg, VO2max 48, sac 3 kg, bitume $\eta=1.0$, 15 °C, vent face 1 m/s, jour, 1.35 m/s | **348.0 W** | 345–355 W | **15.90 %** | 13–19 % | **VERT** |
| **Golden Test 2 — Hiver rigoureux 15 km plat** | Neige 15 cm ($\eta=2.53$ Pandolf 76), -8 °C, vent face 12 m/s, sac 18 kg, bottes + couches + crépuscule, 0.95 m/s | **980.5 W** | > 800 W | **83.3 %** | 75–90 % | **VERT** |

- **5 tests de propriété vérifiés** : monotonie stricte (`pack`, `wind`, `snow`, `heat`), bornes `[0, 100]` sans `NaN`/`Infinity`, équité `complet` vs `socle` (même score espéré, `[p10, p90]` élargi uniquement), additivité exacte de Shapley ($|\sum \phi_k - (\text{IEA} - \text{IEA}_{\text{baseline}})| < 10^{-12}$), et absence totale de bonus de danger sur `IEA`.

### 3.2 Benchmark Moteur de Groupe V2 (Lot P5 — `groupIntelligenceV2.test.ts`)

| Charge de test | Budget cible | Temps mesuré (Vitest) | Statut |
|---|---|---|---|
| **6 membres × 300 segments × 2 000 tirages Monte Carlo** | `< 1 000 ms` | **< 71 ms** (ensemble des 7 tests P5) | **VERT** |

### 3.3 Calibration conforme, Backtest temporel, Ablations & Équité contrefactuelle (Lot P6 — `scripts/verify/effort_fairness_audit.ts`)

Exécuté sur des splits strictement étanches (`0` fuite d'utilisateurs, d'itinéraires, de groupes, de saisons et d'ordre chronologique vérifiée par `assertNoSplitLeakage`) :

- **Biais contrefactuel `complet` vs `socle`** : $|\mathbb{E}[\hat{S}_{\text{socle}} - S_{\text{complet}}]| = \mathbf{0.0574\text{ pts}}$ (cible `< 2.0 pts`).
- **Calibration conforme asymétrique par case (`dataLevel × historyBucket × routeType`)** :
  - Couverture P90 globale : **90.42 %** (nominal `90.00 %`, écart **0.42 pts** $\le 3\text{ pts}$, cible $\ge 85\text{ \%}$).
  - Couverture P90 en mode `socle` : **91.67 %** ($\ge 85\text{ \%}$).
- **Backtest temporel séparé** :
  - Pipeline Prévision (`forecast`) : `MAE = 2.705 pts`.
  - Pipeline Rétrospectif (`retrospective`) : `MAE = 2.776 pts`.
- **Ablations automatisées (`MAE`)** :
  - `full` : **2.740 pts**
  - `no_weather` : **2.995 pts** (`+0.255`)
  - `no_pack` : **2.709 pts**
  - `no_fatigue` : **2.729 pts**
  - `no_cardio` : **4.112 pts** (`+1.372`)

---

## 4. Limites connues, Éthique, Non-diagnostic & Vie privée

- **Zéro diagnostic médical** : tous les messages de l'objet `risque` (refroidissement d'attente IREQ/CoWEDA, chaleur WBGT/HSDA, sudation Gonzalez, MAWD, verglas, nivologie BRA) emploient exclusivement des formulations préventives de terrain, sans aucun terme clinique ni diagnostic.
- **Confidentialité biométrique absolue** : `PublicGroupPredictionSchema` (`.strict()` + inspection récursive `superRefine`) rejette toute fuite de clé biométrique (`weightKg`, `vo2Max`, `hrRest`, `hrMax`, `hrv`, `sleep`, `birthYear`, `sex`) ou de vitesse individuelle nominative. Les tables biométriques (`user_physiology`, `effort_scores`, `group_prediction_members`) sont protégées par `ENABLE` + `FORCE ROW LEVEL SECURITY` (`auth.uid() = user_id`).
- **Seuils collectifs (DECISIONS D-13)** : toute publication collective exige `MIN_DISTINCT_USERS = 5` et `MIN_PUBLISH_CONFIDENCE = 0.5`.
- **Limites connues** : les courses rapides (`> 1.97 m/s`) ou progressions techniques d'escalade (`< 0.45 m/s`) sortent du domaine LCDA validé et déclenchent `out_of_domain` ; la calibration sur les 141 `hike_sessions` réelles de production s'effectuera en mode *shadow* (segmentation directe depuis `positions_timed` + MNT tant que `trail_segments = 0`).

---

## 5. Procédure de Rollback (Sans migration destructive)

Le déploiement d'`effort-score-v1` est **strictement additif et isolé derrière deux feature flags** initialisés à `false` dans `public.feature_flags` :
- `effort_score_v1_shadow = false`
- `group_prediction_v2_shadow = false`

**Rollback immédiat (< 5 s, zéro migration destructive)** :
1. Basculer `effort_score_v1_shadow = false` (et `group_prediction_v2_shadow = false`) dans `public.feature_flags`.
2. `resolveEffortShadowRollout()` bascule instantanément en `flag_off_instant_noop` : aucune écriture supplémentaire dans `public.effort_scores`, le moteur primaire `a3-legacy` reste inchangé pour 100 % des utilisateurs.
3. Si une suppression complète du schéma additif est souhaitée ultérieurement en environnement de test, exécuter `supabase/migrations_down/20261120143000_effort_engine_v1.sql`.
