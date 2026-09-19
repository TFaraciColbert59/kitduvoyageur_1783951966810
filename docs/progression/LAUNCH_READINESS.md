# Lancement international — registre de preuves

Mise à jour : 19 septembre 2026 · Statuts : **implémenté**, **vérifié** (preuve locale), **non vérifié** (dépend d'un environnement indisponible), **restant**.

| Domaine | Exigence | Statut | Preuve / dépendance |
|---|---|---|---|
| Moteur de progression | Un seul moteur, une action = un gain, idempotence, outbox atomique | Vérifié | pgTAP 50/50 (base locale, 19/09) ; tests Vitest service/routes/cron |
| Sécurité progression | Aucune écriture cliente, coordonnées privées inaccessibles, RPC restreintes | Vérifié | `progression_canonique_security.test.sql` 6/6 ; REVOKE + RLS |
| Producteurs | 4 prêts + 3 à compléter, désactivés documentés | Restant P2 | Matrice `PRODUCER_MATRIX.md` ; branchements et tests à livrer |
| Classements | 5 filtres, score identique, seuil 5, 1 km confidentiel sous flag | Restant P3 | Routes 501 en P1 ; agrégats et anti-triangulation à livrer |
| Navigation et produit | 5 destinations, M02–M10, zéro donnée fictive | Partiel | Moteur honnête livré ; navigation et écrans en P4 |
| Direction visuelle | Palette, typo, espacements, contraste mesuré | Restant P5 | Tokens actuels ≠ direction du dossier |
| Internationalisation | FR/EN critiques, pluriels, formats, RTL préparé | Restant P6 | Infra `src/lib/i18n` existante à étendre |
| Performance web mobile | LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (terrain p75) | Non vérifié | Mesures terrain impossibles ici ; laboratoire en P7 |
| Coque native | Démarrage, mémoire, fluidité sur iPhone/Android | Non vérifié | Aucun appareil ni macOS disponibles ; configurations à durcir en P4 |
| Disponibilité 99,9 % / stabilité | Instrumentation et historique | Non vérifié | Dépend de la production et de l'observabilité (P7) |
| Charge et coûts | Scénario 2× sur environnement de test autorisé | Restant P7 | Modèle à écrire ; exécution dépend d'un environnement dédié |
| Accessibilité WCAG 2.2 AA | Web + tests assistifs | Partiel | Tests a11y existants ; audit des routes modifiées en P4/P5 |
| Confidentialité | Position exacte exclue, consentement, export/suppression | Partiel | Territoire privé cloisonné (P1) ; parcours consentement en P3 |
| Stores | Règles, permissions, confidentialité, suppression de compte | Restant P7 | `docs/mobile/STORES_CHECKLIST.md` existant à actualiser |
| Déploiement | Flags, migration additive, restauration testée, retour arrière | Partiel | Flags existants ; restauration locale à exécuter en P7 |

Aucun défaut P0/P1 ouvert sur un parcours critique ne peut être ignoré pour qualifier la version de prête.
