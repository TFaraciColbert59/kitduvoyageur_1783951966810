# Prêts, onboarding et profils publics — plan d’implémentation

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Steps are checkboxes.

**Goal :** finir la refonte sur trois surfaces : J’emprunte, le parcours de
démarrage d’un nouveau compte, et les profils publics.

**Architecture :** réutiliser le shell React du drawer Profil et les composants
`cards/` existants ; ajouter un endpoint de lecture onboarding et un composant
`PublicProfileV2` qui enveloppe `ProfileDrawerHost` en viewer visiteur.

**Tech Stack :** Next 15, React 19, TypeScript strict, Supabase, Zod, Vitest,
Playwright, Vercel.

**Spec :** `docs/superpowers/specs/2026-10-22-onboarding-loans-profils-publics-design.md`

## Contraintes globales

- Même capsule `.segc` 48 px, lentille 420 ms, verre natif (pas de fond blanc).
- Aucun mock sur un compte authentifié.
- 44 px, focus visible, reduced motion.
- API : auth, Zod, 401/403/404/409/500.
- Chaque tâche : test, implémentation, `tsc`, commit.

---

### Task 1 — J’emprunte

**Files :** `src/components/compte/drawer/slots/LoansSlot.tsx`,
`src/components/compte/drawer/cards/LoanCard.tsx`,
`src/components/compte/drawer/__tests__/LoansBorrow.test.tsx`

- [ ] Écrire les tests : filtre, tri échéance, état vide, carte à rendre.
- [ ] Implémenter l’en-tête, le filtre local, les cartes d’emprunt et l’état
      vide avec CTA `/materiel`.
- [ ] Vérifier que les actions passent toujours par `/api/compte/loans`.
- [ ] `npx vitest run src/components/compte/drawer/__tests__` puis commit.

### Task 2 — Endpoint onboarding

**Files :** `src/app/api/compte/onboarding/route.ts`,
`src/features/compte/server/onboarding.ts`,
`src/features/compte/server/__tests__/onboarding.test.ts`

- [ ] Test : compte neuf, compte actif, profil complété, non authentifié.
- [ ] Lire `user_profiles.created_at`, `hike_sessions`, `materiel_kits`,
      `user_follows`, `story_close_friends`, `carnets`.
- [ ] Renvoyer `{ isNew, steps, counts, profileCompletion }`.
- [ ] Commit.

### Task 3 — Parcours de démarrage

**Files :** `src/components/compte/onboarding/FirstRunJourney.tsx`,
`src/components/compte/onboarding/onboardingSteps.ts`,
`src/app/api/...` déjà fait, `CompteLiquidGlassV8.tsx`,
`SettingsPane.tsx`

- [ ] Tests : ouverture seulement si neuf et non ignoré, fermeture, étape
      suivante, progression réelle, `localStorage`.
- [ ] Feuille basse en verre, 5 étapes, CTA, Plus tard, Passer.
- [ ] Monter le composant sur `/compte` ; entrée « Parcours de découverte »
      dans Paramètres.
- [ ] Commit.

### Task 4 — PublicProfileV2

**Files :** `src/components/profile/PublicProfileV2.tsx`,
`src/components/profile/publicProfilePayload.ts`,
`src/app/profil/[id]/page.tsx`,
`src/components/profile/__tests__/PublicProfileV2.test.tsx`

- [ ] Tests du payload : profil, stats, badges, albums, viewer.
- [ ] En-tête compact + `ProfileDrawerHost` viewer visiteur/propriétaire.
- [ ] Remplacer mobile et desktop historiques.
- [ ] Vérifier privé / introuvable / chargement.
- [ ] Commit.

### Task 5 — Vérification et production

- [ ] `tsc`, tests ciblés, build.
- [ ] Captures 430/390 : emprunts, onboarding, profil d’un autre compte.
- [ ] Déploiement production, smoke test, console 0 erreur.
