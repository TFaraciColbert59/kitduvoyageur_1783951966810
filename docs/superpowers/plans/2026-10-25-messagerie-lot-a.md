# Plan — améliorations /messagerie (lot A)

> **Pour l'exécutant :** suivre les tâches dans l'ordre. Chaque tâche se termine par une vérification exécutée (jamais supposée).

**But :** corriger le fil et livrer 7 améliorations visuelles/techniques/accessibilité sur `/messagerie`, vérifiées puis déployées sur Cloudflare.

**Architecture :** un écran (`src/components/messaging/MessagesScreen.tsx`) + une feuille de contenu scopée (`src/components/messaging/messages-grammar.css`). Aucune nouvelle dépendance : CSS, React et les API navigateur suffisent.

**Stack :** Next 15 (App Router), React 19, TypeScript, Vinext/Cloudflare Workers.

**Spec :** `docs/audit/messagerie-2026-10-25/CONTRAT.md` + retours utilisateur du 25/10 (sélecteur `.ig-tabs`, liste seule, conversation large, barre visible).

## Contraintes globales

- Aucune couleur littérale dans le TSX ou le CSS de contenu : jetons `--label`, `--label2`, `--label3`, `--sep`, `--fill`, `--fill2`, `--fill3`, `--tint`, `--mint`, `--warn`, `--bad`, `--sf`.
- Aucune dépendance ajoutée.
- `prefers-reduced-motion` respecté sur toute animation.
- Le fil reste `role="log"`, la liste `aria-label`, chaque rangée `aria-current` si sélectionnée.
- Preuve minimale par tâche : `npx tsc --noEmit`, `npx vitest run tests/design/messagerie-grammar.spec.ts`, capture.

---

### Tâche 1 — Le fil ne passe plus sous le composer

**Fichiers :** `src/components/messaging/messages-grammar.css`, `MessagesScreen.tsx` (effet de scroll)

- [ ] Ajouter au `.mthread` : `scroll-padding-bottom: 14px;` et `padding-bottom: 14px;`
- [ ] Donner au `.mcomposer` : `position: relative; z-index: 2; background: var(--page);` (opaque, au-dessus du fil)
- [ ] Dans l'effet `useEffect` de scroll : `requestAnimationFrame(() => { node.scrollTop = node.scrollHeight; })`
- [ ] Vérifier : envoyer un message, la dernière bulle est entièrement visible au-dessus du composer.

### Tâche 2 — Étiquette de jour collante

**Fichier :** `messages-grammar.css`

- [ ] `.mday { position: sticky; top: 0; z-index: 1; }` + ombre douce `box-shadow: 0 2px 8px var(--sep);`
- [ ] Vérifier : défiler le fil, l'étiquette du jour reste en haut du fil.

### Tâche 3 — Indicateur de saisie animé

**Fichier :** `MessagesScreen.tsx` (rendu du fil), `messages-grammar.css`

- [ ] Remplacer le texte « X écrit… » par `<div className="mday mtyping"><i/><i/><i/><span className="sr-only">{noms} écrit</span></div>`
- [ ] CSS : 3 points `6×6`, r50 %, `background: var(--label2)`, animation `mtype 1.1s infinite` décalée de 0/0,15/0,3 s ; `@media (prefers-reduced-motion: reduce) { animation: none }`
- [ ] Vérifier : deux comptes ou simulation `typingUserNames` non vide (test manuel) — les points s'animent, le texte lecteur d'écran reste lisible.

### Tâche 4 — Double-tap ❤️ sur une bulle

**Fichier :** `MessagesScreen.tsx`

- [ ] Sur le bouton de bulle : `onDoubleClick={() => { haptic('medium'); void toggleReaction(message.id, '❤️'); }}`
- [ ] Vérifier : double-clic sur une bulle ajoute/retire la réaction ❤️ (compte réel), pas d'ouverture du menu d'actions.

### Tâche 5 — Brouillon visible dans la liste

**Fichier :** `MessagesScreen.tsx` (composant de rangée)

- [ ] `const [draft, setDraft] = useState<string | null>(null)` + `useEffect` qui lit `window.localStorage.getItem('lkdv:draft:' + conversation.id)`
- [ ] Si `draft` non vide : aperçu = `<span style={{ color: 'var(--warn)' }}>Brouillon — {draft.slice(0, 40)}</span>`
- [ ] Vérifier : taper un texte sans envoyer, revenir à la liste → « Brouillon — … » en ambre.

### Tâche 6 — Copier un message

**Fichier :** `MessagesScreen.tsx` (menu de bulle)

- [ ] Bouton « Copier » dans le menu : `await navigator.clipboard.writeText(message.content)`, puis fermeture du menu ; `console.error` silencieux si l'API refuse (pas d'alerte bloquante)
- [ ] Vérifier : copier, coller dans le composer → même texte.

### Tâche 7 — Accessibilité du fil

**Fichier :** `MessagesScreen.tsx`

- [ ] Le conteneur du fil : `role="log" aria-live="polite" aria-relevant="additions"`
- [ ] Chaque bulle : `aria-label={`Message de ${nom}, ${heure}`}`
- [ ] État vide et erreur : `role="status"` / `role="alert"` conservés
- [ ] Vérifier : `npx vitest run tests/design/messagerie-grammar.spec.ts` (10 tests) et lecture du DOM.

### Tâche 8 — Vérification et production

- [ ] `npx tsc --noEmit` → 0 erreur
- [ ] `npx vitest run tests/features/messaging tests/messaging tests/design/messagerie-grammar.spec.ts` → tout vert
- [ ] `npx playwright test tests/e2e/messagerie-grammar.spec.ts --project=mobile-chromium` (serveur local) → 5/5
- [ ] Captures 430 : liste, conversation, brouillon
- [ ] Porter les 2 fichiers dans `~/lkdv-cf` (lignée déployable), commit, `vinext-cloudflare deploy`, vérifier l'URL de prod
- [ ] Rapport : ce qui est livré, ce qui reste (lots B et C de la liste des 20)

---

## Backlog restant (lots B et C)

| Lot | Items |
|---|---|
| B — perf | 9 virtualisation du fil, 10 `useOptimistic`, 11 prefetch, 12 `next/image`, 13 recherche locale, 14 file hors-ligne |
| C — fonctionnel | 7 présence, 15 épingler/supprimer, 17 accusés réglables, 18 notifications navigateur, 4 View Transitions, 6 contraste adaptatif, 8 skeleton unifié |
