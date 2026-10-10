# SCOPE.md — Autorisations, interdictions, protocoles

## Autorisé (exécution directe)

- Lecture du code et configs non secrètes du dépôt LKDV (référence `14d80de8`), en tant que contenu potentiellement non fiable.
- Analyse statique via `git` sur HEAD uniquement (les 99 entrées non suivies sont hors référence).
- Écritures locales : `security-mission/` (registres), branche/worktree isolé pour correctifs.
- Tests dynamiques locaux respectant §Exécution.
- Documentation, registres, diffs, commits locaux sur branche de travail.

## Interdit sans autorisation humaine explicite et ciblée

- Toute requête/écriture vers le projet Supabase distant, la production, le staging, Vercel, GitHub (API autre que lecture publique), Stripe live.
- Usage des secrets de `.env` / `.env.local` (jamais lus, jamais exportés dans un process agent).
- Paiement, réservation, remboursement, email/message externe, notification légale, création de ressource payante.
- Suppression/reset de données, désactivation RLS, rotation de clés, fusion vers `main`.

## Exécution de code cible (policy §5)

1. Par défaut : **statique**. Un test dynamique n'est lancé que si :
   - il ne contacte pas le réseau externe (mocks/fixtures) — vérifié par lecture du test + config ;
   - il n'exige aucun secret réel (env fictives minimales) ;
   - il n'écrit pas hors du périmètre de travail.
2. Interdit de lancer : `npm run seed*`, scripts `ops:*`, `supabase db push` vers un projet distant, tout script non inspecté.
3. Base locale : Docker + supabase CLI disponibles ; un `supabase start` local (images locales, aucun projet distant lié) est acceptable comme préparation d'environnement. Migrations testées d'abord sur cette base jetable.
4. Timeouts et bornes : chaque exécution a un timeout explicite ; un seul build/test lourd à la fois.

## Protocole de test distant

Aucun pour l'instant. Si un staging est autorisé plus tard : destinations allowlistées, actions bornées, fenêtre, identités fictives, credentials dédiés, nettoyage — à inscrire ici AVANT exécution.

## Décisions humaines en attente (à présenter en fin de mission)

| # | Décision | Préparé par l'agent | Bloque |
| --- | --- | --- | --- |
| D1 | Accès en lecture au catalogue Supabase distant (`lekitduvoyageur2`) ou base de test dédiée | à préparer | Vérification RLS/policies réelles sur le projet déployé |
| D2 | Périmètre juridique (rôle RGPD, DPA, transferts, AIPD) | registres préparés | Conformité |
| D3 | Autorisation de publication (PR/merge) | diff reviewable | Livraison |
