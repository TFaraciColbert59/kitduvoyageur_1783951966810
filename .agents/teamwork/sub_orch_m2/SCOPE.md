# Scope: Milestone M2 — Refonte /messagerie & Tiroirs (Audit iPhone Section 5)

## Objective
Corriger l'intégralité des anomalies ergonomiques, fonctionnelles et visuelles répertoriées dans la section 5 de l'audit iPhone (`audit_complet_iphone.md`) sur la page `/messagerie` et ses tiroirs, en appliquant les tokens et composants Apple du design system LKDV (palette verte pure, zéro noir pur #000000, zéro flash noir #0d1117).

## Authoritative Inputs
- `ORIGINAL_REQUEST.md`: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/.agents/teamwork/ORIGINAL_REQUEST.md
- `PROJECT.md`: /Users/fr168256/Documents/Codex/2026-11-11/files-pasted-by-the-user-lkdv/work/lkdv-reference/PROJECT.md
- Audit Report Section 5: `/Users/fr168256/.gemini/antigravity/brain/25ed2e40-8086-4101-9dbd-3687f6e94b76/audit_complet_iphone.md`
- Baseline Screenshots: `/Users/fr168256/.gemini/antigravity/scratch/lkdv-device-qa/audit-shots/05-messagerie/`
- Central Design Bank: `src/design/bank.ts`, `src/styles/tokens.generated.css`, `src/components/ui/Sheet.tsx`

## Features in Scope (Features 5 to 12 from PROJECT.md)
1. **Feature 5: Header Navigation Fix**
   - Fichiers: `src/app/messagerie/page.tsx`, `src/components/messaging/MessagesScreen.tsx`.
   - Empêcher `router.push('/compte')` sur le titre "Messages" et remplacer `<Link href="/compte?tab=notifications">` sur la cloche pour supprimer toute fuite vers `/compte` et éliminer le flash noir `#0d1117`.
2. **Feature 6: Filter SegmentedControl Repositioning**
   - Fichiers: `src/components/messaging/MessagesScreen.tsx`, `src/components/messaging/messages-grammar.css`.
   - Intégrer `SubCapsuleTabs` (`Toutes`, `Non lues`, `Groupes`, `Demandes`) dans le flux normal sous la barre de recherche.
   - Supprimer le style `position: absolute; bottom: 10px; right: 12px;` qui masque la 4e ligne de conversation.
3. **Feature 7: Split View 40/60 De-collision**
   - Fichiers: `src/components/messaging/MessagesScreen.tsx`, `src/components/messaging/messages-grammar.css`.
   - Éliminer les 44pt de collision entre la poignée de redimensionnement `msplit` et la pastille de groupe `mpill`.
   - Ajouter un padding haut suffisant pour que le premier message ne soit pas masqué sous l'en-tête du volet inférieur.
4. **Feature 8: Bottom Sheet Drawers (`+` and `...`)**
   - Fichiers: `src/features/messaging/components/ComposerMenuSheet.tsx`, `src/features/messaging/components/ConversationOptionsSheet.tsx`, `src/components/ui/Sheet.tsx`.
   - Migrer ces tiroirs hors de `AccountDrawerHost variant="card"` (qui s'ouvrait anormalement en haut de l'écran `y=114..386`) vers un véritable bottom sheet Apple ancré en bas (`y >= 500pt`).
   - Grabber standardisé 36×5pt capsule (radius 2.5pt), padding latéral complet (éviter tout texte rogné à gauche), et options du bas entièrement visibles.
5. **Feature 9: Demandes & Empty State Fix**
   - Fichiers: `src/components/messaging/MessagesScreen.tsx`.
   - Supprimer l'affichage simultané en double de l'état vide dans l'onglet `Demandes`.
   - Rendre le bouton "Nouvelle discussion" lisible (contraste conforme WCAG AAA, zéro noir pur) et fonctionnel (ouverture de `NewConversationModal`).
6. **Feature 10: Group Chat Realtime Freeze Elimination**
   - Fichiers: `src/features/messaging/hooks/useConversations.ts`, `src/components/messaging/MessagesScreen.tsx`.
   - Supprimer `setLoading(true)` lors des rafraîchissements en tâche de fond (notamment `markAsRead` en Realtime) pour éliminer le gel et le remplacement par 4 squelettes gris.
7. **Feature 11: Shared Post Embed Graceful Fallback**
   - Fichiers: `src/components/messaging/MessagesScreen.tsx`.
   - Remplacer les cartes d'erreur brutes "Publication indisponible" par un composant de repli élégant aux couleurs de la marque LKDV avec coins continuous squircle.
8. **Feature 12: Reaction Emoji Overlay Bar**
   - Fichiers: `src/components/messaging/MessagesScreen.tsx`, `src/components/messaging/messages-grammar.css`.
   - Afficher la barre d'emojis en overlay contextuel flottant au-dessus de la bulle de message lors d'un appui long sans causer de saut de ligne ni de rognage par le haut du conteneur.

## Invariants & Design Contracts
- Zéro noir pur `#000000`, zéro `#0d1117`.
- Utilisation exclusive des tokens de `src/design/bank.ts` et `src/styles/tokens.generated.css`.
- Tous les tests E2E Tiers 1-4 (`npm run test:e2e:tiers` ou `node tests/e2e/runner.mjs`) doivent passer à 100% (140/140).
- Tous les tests vitest existants doivent continuer de passer sans régression.
