# Messagerie lot D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Volet de conversation figé avec pillule auteur, recherche intégrée dans la carte, actions de rangée vers la droite avec suppression confirmée, drawers alignés sur la carte et animés comme ceux du Compte.

**Architecture:** `MessagesScreen` reste l'écran unique, mais son modèle (filtre, titre, aperçu, geste de rangée) sort dans `messagesModel.ts` (pur, testé). `AccountDrawerHost` gagne une variante `card` qui se cale sur la boîte de `#card` et réutilise `.sw-wrap[data-det="card"]` + `.in` du Compte. La suppression utilise la colonne existante `conversation_members.left_at` (aucune migration) ; la confirmation passe par `lkvConfirm` (ConfirmDialog Radix global).

**Tech Stack:** Next 15 App Router, React 19, TypeScript strict, CSS de la grammaire Compte, Supabase JS, Vitest, Vinext/Workers.

**Spec:** `docs/superpowers/specs/2026-10-26-messagerie-lot-d-design.md`

## Global Constraints

- Aucune nouvelle couleur : jetons `--label`, `--label2`, `--label3`, `--sep`, `--fill3`, `--mint`, `--soft-line`, `--tint`.
- Rayons : surfaces 26 · rangées 18 · bulles 18 (queue 6) · champs/pills/boutons ronds 999 · chips 14.
- Aucun `window.confirm`, aucun drawer maison : `lkvConfirm` + `AccountDrawerHost`.
- Le volet de conversation garde `grid-template-rows: 335px minmax(0, 1fr)` ; aucune classe `mapbig`.
- Déploiement : build depuis un worktree isolé au HEAD ; noter la version ; vérifier la prod à 430×932.
- Tests obligatoires : `npx tsc --noEmit`, `npx eslint <fichiers>`, `npx vitest run src/components/messaging`.

---

## File Structure

| Fichier | Rôle |
|---|---|
| `src/components/messaging/messagesModel.ts` (créer) | `conversationTitle`, `lastPreview`, `filterConversations`, `clampSwipe`, `resolveSwipeEnd`, `SWIPE_REVEAL` |
| `src/components/messaging/__tests__/messagesModel.test.ts` (créer) | tests purs |
| `src/features/messaging/services/messagingService.ts` (modifier) | `deleteConversationForMe`, filtre `left_at` |
| `src/design/account/AccountDrawerHost.tsx` (modifier) | variante `card` + languette + animation Compte |
| `src/components/messaging/MessagesScreen.tsx` (modifier) | en-tête, recherche, pillule, volet figé, swipe droite, feuilles |
| `src/components/messaging/messages-grammar.css` (modifier) | recherche, pillule, actions, rayons, suppression des règles mortes |
| `src/features/messaging/components/ConversationOptionsSheet.tsx` (modifier) | passe en variante `card` |
| `src/features/messaging/components/GroupSettingsModal.tsx` (modifier) | variante `card` |
| `src/features/messaging/components/NewConversationModal.tsx` (supprimer l'usage) | plus ouvert depuis la messagerie |

---

### Task 1: Modèle pur de la liste

**Files:**
- Create: `src/components/messaging/messagesModel.ts`
- Create: `src/components/messaging/__tests__/messagesModel.test.ts`
- Modify: `src/components/messaging/MessagesScreen.tsx:61-90` (retirer les helpers locaux, importer)

**Interfaces:**
- Produces: `conversationTitle(conv: Conversation): string`, `lastPreview(conv: Conversation): string`, `filterConversations(list: Conversation[], opts: { filter: FilterId; query: string }): Conversation[]`, `SWIPE_REVEAL = 108`, `clampSwipe(dx: number, base: number): number`, `resolveSwipeEnd(dx: number): { open: boolean; dx: number }`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/messaging/__tests__/messagesModel.test.ts
import { describe, expect, it } from 'vitest';
import {
  SWIPE_REVEAL,
  clampSwipe,
  filterConversations,
  resolveSwipeEnd,
} from '../messagesModel';
import type { Conversation } from '@/features/messaging/types/messaging.types';

const conv = (over: Partial<Conversation>): Conversation =>
  ({
    id: 'c1',
    type: 'direct',
    status: 'accepted',
    unread_count: 0,
    other_member: { id: 'u2', full_name: 'Alexandre', avatar_url: null },
    last_message: { content: 'Salut', created_at: '2026-10-26T08:00:00Z' },
    ...over,
  }) as Conversation;

describe('filterConversations', () => {
  it('écarte les fils supprimés pour moi', () => {
    const rows = [conv({ id: 'a' }), conv({ id: 'b', left_at: '2026-10-26T07:00:00Z' })];
    expect(filterConversations(rows, { filter: 'all', query: '' }).map((c) => c.id)).toEqual(['a']);
  });

  it('filtre par segment puis par texte', () => {
    const rows = [
      conv({ id: 'direct', type: 'direct' }),
      conv({ id: 'group', type: 'group', name: 'Dolomites' }),
    ];
    expect(filterConversations(rows, { filter: 'group', query: '' }).map((c) => c.id)).toEqual(['group']);
    expect(filterConversations(rows, { filter: 'all', query: 'dolo' }).map((c) => c.id)).toEqual(['group']);
  });
});

describe('geste de rangée', () => {
  it('borne le glissement vers la droite', () => {
    expect(clampSwipe(40, 0)).toBe(40);
    expect(clampSwipe(-20, 0)).toBe(0);
    expect(clampSwipe(400, 0)).toBe(SWIPE_REVEAL);
  });

  it('ouvre au-delà de 40 % de la largeur révélée', () => {
    expect(resolveSwipeEnd(SWIPE_REVEAL * 0.5)).toEqual({ open: true, dx: SWIPE_REVEAL });
    expect(resolveSwipeEnd(SWIPE_REVEAL * 0.2)).toEqual({ open: false, dx: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/messaging/__tests__/messagesModel.test.ts`
Expected: FAIL — `Failed to resolve import "../messagesModel"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/messaging/messagesModel.ts
import type { Conversation } from '@/features/messaging/types/messaging.types';

export type FilterId = 'all' | 'direct' | 'group' | 'requests';
export const SWIPE_REVEAL = 108;

export function conversationTitle(conv: Conversation): string {
  if (conv.type === 'group') return conv.name || 'Groupe';
  return conv.other_member?.full_name || 'Voyageur LKDV';
}

export function lastPreview(conv: Conversation): string {
  const text = conv.last_message?.content?.trim();
  if (!text) return 'Aucun message';
  return text.length > 64 ? `${text.slice(0, 63)}…` : text;
}

export function filterConversations(
  list: Conversation[],
  opts: { filter: FilterId; query: string }
): Conversation[] {
  const text = opts.query.trim().toLowerCase();
  return list.filter((conv) => {
    if (conv.left_at) return false;
    if (opts.filter === 'requests') {
      if (conv.status !== 'pending') return false;
    } else {
      if (conv.status === 'pending' || conv.status === 'rejected') return false;
      if (opts.filter === 'direct' && conv.type !== 'direct') return false;
      if (opts.filter === 'group' && conv.type !== 'group') return false;
    }
    if (!text) return true;
    return [conversationTitle(conv), lastPreview(conv)].join(' ').toLowerCase().includes(text);
  });
}

/** Glissement vers la droite uniquement, borné à la largeur révélée. */
export function clampSwipe(dx: number, base: number): number {
  return Math.min(SWIPE_REVEAL, Math.max(base + dx, 0));
}

export function resolveSwipeEnd(dx: number): { open: boolean; dx: number } {
  const open = dx > SWIPE_REVEAL * 0.4;
  return { open, dx: open ? SWIPE_REVEAL : 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/messaging/__tests__/messagesModel.test.ts`
Expected: PASS 4 tests.

- [ ] **Step 5: Brancher MessagesScreen sur le modèle**

Dans `MessagesScreen.tsx` : supprimer les fonctions locales `conversationTitle`, `initials` reste, `lastPreview` ; importer `conversationTitle`, `lastPreview`, `filterConversations`, `SWIPE_REVEAL`, `clampSwipe`, `resolveSwipeEnd` depuis `./messagesModel` ; remplacer le `useMemo` de `visible` par `filterConversations(conversations, { filter, query })`.

- [ ] **Step 6: Commit**

```bash
git add src/components/messaging/messagesModel.ts src/components/messaging/__tests__/messagesModel.test.ts src/components/messaging/MessagesScreen.tsx
git commit -m "refactor(messagerie): modèle de liste pur et testé"
```

---

### Task 2: Suppression pour moi (`left_at`)

**Files:**
- Modify: `src/features/messaging/services/messagingService.ts:414-440` (select + filtre), `:960` (voisinage de `updateMemberPreferences`)
- Modify: `src/features/messaging/types/messaging.types.ts` (`left_at?: string | null`)
- Test: `src/components/messaging/__tests__/messagesModel.test.ts` (déjà couvert au Task 1)

**Interfaces:**
- Produces: `messagingService.deleteConversationForMe(conversationId: string, userId: string): Promise<boolean>`

- [ ] **Step 1: Type**

```ts
// Conversation, dans messaging.types.ts
/** Supprimé pour moi (fil masqué), sans toucher à l'autre participant. */
left_at?: string | null;
```

- [ ] **Step 2: Service**

```ts
/** Supprime le fil pour MOI : `left_at` masque la conversation dans ma liste,
 *  l'autre participant garde l'historique. Aucune suppression de messages. */
async deleteConversationForMe(conversationId: string, userId: string): Promise<boolean> {
  if (conversationId.startsWith('demo-conv-')) {
    const index = demoConversationsCache?.findIndex((c) => c.id === conversationId) ?? -1;
    if (index >= 0) demoConversationsCache?.splice(index, 1);
    return true;
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('conversation_members')
    .update({ left_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  return !error;
}
```

- [ ] **Step 3: Filtre à la lecture**

```ts
// getConversations
.select('conversation_id, unread_count, is_muted, is_archived, status, left_at')
...
memberData = (cmData ?? []).filter((m) => !m.left_at);
```

- [ ] **Step 4: Vérifier les compteurs non lus**

Run:
```
grep -rn "unread_count\|unreadTotal" src/features/messaging/hooks/useConversations.ts src/components/messaging/MessagesScreen.tsx | head
```
Expected: `unreadTotal` dérive de `conversations` déjà filtrées. Sinon, filtrer aussi.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/features/messaging/services/messagingService.ts src/features/messaging/types/messaging.types.ts
git commit -m "feat(messagerie): suppression pour moi via left_at"
```

---

### Task 3: En-tête réduit et recherche intégrée

**Files:**
- Modify: `src/components/messaging/MessagesScreen.tsx:1178-1240` (en-tête), `:1290-1400` (drawers recherche/nouvelle discussion)
- Modify: `src/components/messaging/messages-grammar.css` (`.msearch`)

**Interfaces:**
- Consumes: `filterConversations` (Task 1)
- Produces: `searchRef: RefObject<HTMLInputElement>`, `focusSearch(): void`

- [ ] **Step 1: En-tête**

Remplacer `.ig-top-r` par un seul bouton :

```tsx
<div className="ig-top">
  <button type="button" className="lg ig-handle" onClick={() => router.push('/compte')} aria-label="Messages — aller au compte">
    <span>Messages</span>
  </button>
  <div className="ig-top-r">
    <button
      type="button"
      className="lg gbtn ig-top-btn"
      aria-label="Notifications"
      onClick={() => router.push('/compte?tab=notifications')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0c0 4.1 1.6 5.6 1.6 5.6H4.6s1.6-1.5 1.6-5.6Z" />
        <path d="M10 18.2a2 2 0 0 0 4 0" />
      </svg>
    </button>
  </div>
</div>
```

Supprimer : les deux autres boutons, les `<i className="tb-badge">` de la pillule et de la cloche.

- [ ] **Step 2: Barre de recherche**

Juste sous `.ig-top`, avant `.card` :

```tsx
<div className="msearch">
  <Icon name="search" className="size-4" aria-hidden="true" />
  <input
    ref={searchRef}
    type="search"
    value={query}
    onChange={(event) => setQuery(event.target.value)}
    placeholder="Rechercher une discussion"
    aria-label="Rechercher une discussion"
  />
  {query ? (
    <button type="button" className="msearch-x" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="Effacer la recherche">
      <Icon name="x" className="size-3.5" aria-hidden="true" />
    </button>
  ) : null}
</div>
```

- [ ] **Step 3: Sections Personnes / Messages**

Dans `.card-scroll`, avant `.ig-grid-wrap`, quand `query.trim().length >= 2` :

```tsx
{query.trim().length >= 2 ? (
  <div className="mresults">
    {searchPeople.length ? (
      <section aria-label="Personnes">
        <h3>Personnes</h3>
        {searchPeople.slice(0, 4).map((person) => (
          <button key={person.id} type="button" className="mresult" onClick={() => startWith(person.id)}>
            <span className="fa">{person.avatar_url ? <img src={person.avatar_url} alt="" /> : initials(person.full_name)}</span>
            <b>{person.full_name}</b>
          </button>
        ))}
      </section>
    ) : null}
    {searchMessages.length ? (
      <section aria-label="Messages">
        <h3>Messages</h3>
        {searchMessages.slice(0, 4).map((message) => (
          <button key={message.id} type="button" className="mresult" onClick={() => openById(message.conversation_id)}>
            <span className="mresult-txt">{message.content.slice(0, 60)}</span>
          </button>
        ))}
      </section>
    ) : null}
  </div>
) : null}
```

`startWith` = `getOrCreateDirectConversation(personId, currentUserId)` puis `setSelectedId(id)`.

- [ ] **Step 4: Nouvelle discussion → focus**

Le bouton de l'état vide et tout appel `setNewOpen(true)` deviennent :

```tsx
<button type="button" className="mbtn p" onClick={focusSearch}>Nouvelle discussion</button>
```

avec

```tsx
const focusSearch = () => {
  searchRef.current?.focus();
  searchRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};
```

- [ ] **Step 5: Nettoyage**

Supprimer `searchOpen`, `newOpen`, leurs `AccountDrawerHost`, les imports `NewConversationModal`, `searchMessages`/`searchPeople` restent mais branchés sur la barre.

- [ ] **Step 6: CSS**

```css
.lkdv-messages .msearch {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  margin: 4px 2px 6px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: inset 0 0 0 0.5px rgba(23, 43, 36, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  color: var(--label3);
}
.lkdv-messages .msearch input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  outline: none;
  font: 400 13px/1 var(--sf);
  color: var(--label);
}
.lkdv-messages .msearch input::placeholder { color: var(--label3); }
.lkdv-messages .msearch-x {
  width: 22px; height: 22px; border: 0; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--fill2); color: var(--label2);
}
```

- [ ] **Step 7: Vérifier à l'écran (dev)**

Run: `npm run dev` puis 430×932 sur `/messagerie`
Expected: pillule « Messages » sans compteur, une cloche, barre de recherche, focus au clic « Nouvelle discussion ».

- [ ] **Step 8: Commit**

```bash
git add src/components/messaging/MessagesScreen.tsx src/components/messaging/messages-grammar.css
git commit -m "feat(messagerie): recherche intégrée, en-tête réduit à la cloche"
```

---

### Task 4: Volet figé et pillule auteur

**Files:**
- Modify: `src/components/messaging/MessagesScreen.tsx:1050-1170` (gestes/pane), `:1230-1290` (markup du pane)
- Modify: `src/components/messaging/messages-grammar.css` (`.mpane`, `.mpill`, suppression `mapbig`)

**Interfaces:**
- Produces: composant local `ConversationPill` dans `MessagesScreen.tsx`

- [ ] **Step 1: Retirer la bascule**

`className={\`phone hasnext${selected ? ' mapbig' : ''}...\`}` → `className={\`phone hasnext${surfaceOpen ? ' sheet-open' : ''}\`}`.

Supprimer dans le CSS : `.phone.mapbig`, `.phone.mapbig .card`, `.phone.mapbig .map`.

- [ ] **Step 2: Markup du pane**

```tsx
{selected ? (
  <div className="mpane in" ref={paneRef}>
    <ConversationPill conversation={selected} members={members} onOpen={openSelectedProfile} />
    <div className="mpane-body">
      <MessageThread
        key={selected.id}
        conversation={selected}
        currentUserId={currentUserId as string}
        currentUserProfile={currentUserProfile}
        members={members}
        hideReads={hideReads}
        compact
      />
    </div>
  </div>
) : ( ... )}
```

- [ ] **Step 3: Pillule**

```tsx
function ConversationPill({ conversation, members, onOpen }: { conversation: Conversation; members: ConversationMember[]; onOpen: () => void }) {
  const title = conversationTitle(conversation);
  const meta = conversation.type === 'group' ? `${members.length || 1} membres` : 'Membre LKDV';
  return (
    <button type="button" className="mpill" onClick={onOpen} aria-label={`${title} — ${meta}`}>
      <span className="mpill-av">
        {conversation.avatar_url ? <img src={conversation.avatar_url} alt="" /> : initials(title)}
      </span>
      <span className="mpill-txt">
        <b>{title}</b>
        <span>{meta}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 4: CSS pillule (mesures de `.lkdv-post-author`)**

```css
.lkdv-messages .mpill {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(78%, 300px);
  min-height: 44px;
  padding: 4px 12px 4px 4px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.485), rgba(255, 255, 255, 0.325) 55%, rgba(255, 255, 255, 0.405));
  -webkit-backdrop-filter: blur(14px) saturate(1.8);
  backdrop-filter: blur(14px) saturate(1.8);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 0 0.5px rgba(23, 43, 36, 0.12), 0 6px 18px rgba(23, 43, 36, 0.12);
  color: var(--label);
  text-align: left;
}
.lkdv-messages .mpill-av {
  width: 32px; height: 32px; flex: none; border-radius: 50%; overflow: hidden;
  display: grid; place-items: center;
  background: var(--mint); color: var(--tint);
  font: 700 12px var(--sf);
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.95);
}
.lkdv-messages .mpill-av img { width: 100%; height: 100%; object-fit: cover; }
.lkdv-messages .mpill-txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lkdv-messages .mpill-txt b { font: 700 12.5px/1.1 var(--sf); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lkdv-messages .mpill-txt span { font: 500 10px/1.25 var(--sf); color: var(--label2); }
```

- [ ] **Step 5: Nettoyage**

Supprimer `sheetOpen`, `closingRef`, `paneDrag`, `paneDown/Move/Up`, `closePane`, `AccountDrawerHost` de conversation, `.mpane-h`, `.mpane.out`, `.mpane.dragging`, `.mpane.settling`, `.phone.sheet-open .mpane` (le pane n'a plus de frère drawer de conversation).

- [ ] **Step 6: Vérifier**

À l'écran : sélectionner un fil → aucun agrandissement, pillule en haut à gauche, pas de bandeau, fil défilable, composer collé en bas.

- [ ] **Step 7: Commit**

```bash
git add src/components/messaging/MessagesScreen.tsx src/components/messaging/messages-grammar.css
git commit -m "feat(messagerie): volet figé et pillule auteur"
```

---

### Task 5: Swipe à droite, suppression, notifications

**Files:**
- Modify: `src/components/messaging/MessagesScreen.tsx` (`ConversationFeedRow` 105-320, handlers `swipe`/`open` 990-1010)
- Modify: `src/components/messaging/messages-grammar.css` (`.mrow-actions`)

- [ ] **Step 1: Direction**

Dans `ConversationFeedRow` :

```tsx
const base = snapped ? SWIPE_REVEAL : 0;
dxRef.current = clampSwipe(ddx, base);
setDx(dxRef.current);
...
const end = resolveSwipeEnd(dxRef.current);
dxRef.current = end.dx;
setDx(end.dx);
setSnapped(end.open);
```

- [ ] **Step 2: Actions à gauche**

```tsx
{(dx > 0 || snapped) && onSwipeAction ? (
  <div className="mrow-actions" style={{ width: SWIPE_REVEAL }}>
    <button type="button" className="mrow-act danger" onClick={() => fire('delete')} aria-label="Supprimer la conversation">
      <Icon name="trash-2" className="size-4" aria-hidden="true" />
    </button>
    <button type="button" className="mrow-act" onClick={() => fire('notify')} aria-label="Gérer les notifications">
      <Icon name="bell" className="size-4" aria-hidden="true" />
    </button>
  </div>
) : null}
```

- [ ] **Step 3: Handler de suppression**

```tsx
const swipe = async (conversation: Conversation, action: SwipeAction) => {
  if (!currentUserId) return;
  if (action === 'delete') {
    const ok = await lkvConfirm({
      title: 'Supprimer la conversation ?',
      message: `« ${conversationTitle(conversation)} » disparaîtra de ta messagerie. L'autre participant garde l'historique.`,
      confirmLabel: 'Supprimer',
      cancelLabel: 'Annuler',
      variant: 'destructive',
    });
    if (!ok) return;
    await messagingService.deleteConversationForMe(conversation.id, currentUserId);
    if (selectedId === conversation.id) setSelectedId(null);
    await refreshConversations();
    return;
  }
  if (action === 'notify') {
    setNotifyConv(conversation);
    return;
  }
};
```

- [ ] **Step 4: Feuille notifications**

```tsx
<AccountDrawerHost
  open={notifyConv !== null}
  variant="card"
  title="Notifications"
  subtitle={notifyConv ? conversationTitle(notifyConv) : undefined}
  onClose={() => setNotifyConv(null)}
>
  <div className="mdrawer-actions">
    {MUTE_PRESETS.map((preset) => (
      <button
        key={preset.label}
        type="button"
        className="mbtn"
        onClick={async () => {
          if (!notifyConv || !currentUserId) return;
          await messagingService.updateMemberPreferences(notifyConv.id, currentUserId, {
            is_muted: preset.minutes !== null,
            mute_until: preset.minutes === null ? null : new Date(Date.now() + preset.minutes * 60_000).toISOString(),
          });
          setNotifyConv(null);
          await refreshConversations();
        }}
      >
        {preset.label}
      </button>
    ))}
  </div>
</AccountDrawerHost>
```

avec

```tsx
const MUTE_PRESETS = [
  { label: '1 heure', minutes: 60 },
  { label: '8 heures', minutes: 480 },
  { label: '1 semaine', minutes: 10_080 },
  { label: 'Désactiver', minutes: null },
] as const;
```

- [ ] **Step 5: CSS actions**

```css
.lkdv-messages .mrow-actions {
  position: absolute;
  inset: 0 auto 0 0;
  display: flex;
  gap: 4px;
  padding: 4px;
}
.lkdv-messages .mrow-act {
  flex: 1;
  border: 0;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.55);
  color: var(--label2);
  box-shadow: inset 0 0 0 0.5px rgba(23, 43, 36, 0.1);
}
.lkdv-messages .mrow-act.danger { background: var(--bad-bg); color: var(--bad); }
```

- [ ] **Step 6: Recette geste**

À 430 : glisser la rangée « Alexandre » de 80 px vers la droite → deux boutons ; cliquer Supprimer → dialogue ; Annuler → fil conservé ; Supprimer → fil retiré, liste rafraîchie, `left_at` en base.

SQL de contrôle :
```sql
select conversation_id, left_at from public.conversation_members
where user_id = '<demo user>' order by updated_at desc limit 3;
```

- [ ] **Step 7: Commit**

```bash
git add src/components/messaging/MessagesScreen.tsx src/components/messaging/messages-grammar.css
git commit -m "feat(messagerie): swipe droite, suppression confirmée, réglages de notifications"
```

---

### Task 6: Drawers de carte

**Files:**
- Modify: `src/design/account/AccountDrawerHost.tsx`
- Modify: `src/features/messaging/components/ConversationOptionsSheet.tsx:107`
- Modify: `src/features/messaging/components/GroupSettingsModal.tsx:142`

**Interfaces:**
- Produces: `AccountDrawerHostProps.variant?: 'floating' | 'card'` (défaut `'floating'`)

- [ ] **Step 1: Géométrie carte**

```tsx
const [box, setBox] = useState({ top: 48, left: 12, right: 12, bottom: 60 });

useEffect(() => {
  if (!open || variant !== 'card') return;
  const measure = () => {
    const card = document.getElementById('card');
    const phone = card?.closest('.phone') as HTMLElement | null;
    if (!card || !phone) return;
    const c = card.getBoundingClientRect();
    const p = phone.getBoundingClientRect();
    setBox({ top: c.top - p.top, left: c.left - p.left, right: p.right - c.right, bottom: p.bottom - c.bottom });
  };
  measure();
  const observer = new ResizeObserver(measure);
  const card = document.getElementById('card');
  if (card) observer.observe(card);
  window.addEventListener('resize', measure);
  return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
}, [open, variant]);
```

Rendu :

```tsx
<div
  className="sw-wrap"
  data-det={open ? (variant === 'card' ? 'card' : 'open') : 'closed'}
  data-in={open && variant === 'card' ? 'true' : undefined}
  style={{ inset: `${box.top}px ${box.right}px ${box.bottom}px ${box.left}px`, borderRadius: 26, overflow: 'hidden' }}
>
  <div className="scrim" data-a="close" onClick={onClose} />
  <section className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={{ inset: 0, borderRadius: 26 }}>
    <header className="sh-h hf">
      <span className="grab" aria-hidden="true"><span /></span>
      {/* boutons inchangés */}
    </header>
    ...
```

- [ ] **Step 2: Animation Compte**

Ajouter dans le composant un effet qui pose `.in` au montage quand `variant === 'card'` :

```tsx
useEffect(() => {
  if (!open || variant !== 'card') return;
  const wrap = wrapRef.current;
  if (!wrap) return;
  const raf = requestAnimationFrame(() => wrap.classList.add('in'));
  return () => { cancelAnimationFrame(raf); wrap.classList.remove('in'); };
}, [open, variant]);
```

Le CSS `.sw-wrap[data-det="card"].in .sheet { transform: translateY(0); }` avec `transition: transform .54s cubic-bezier(.32,.72,0,1)` existe déjà (`compte-apple-hig.css:2922-2947`).

- [ ] **Step 3: Migrer les feuilles messagerie**

`ConversationOptionsSheet`, `GroupSettingsModal` : ajouter `variant="card"`. `ComposerMenuSheet`, `NewConversationModal` : inchangés (non ouverts depuis la carte).

- [ ] **Step 4: Vérifier**

Ouvrir « Options » depuis une rangée (appui long) et les réglages de groupe : le drawer couvre exactement la carte liste, languette visible, glissement du doigt suit, fermeture animée.

- [ ] **Step 5: Commit**

```bash
git add src/design/account/AccountDrawerHost.tsx src/features/messaging/components/ConversationOptionsSheet.tsx src/features/messaging/components/GroupSettingsModal.tsx
git commit -m "feat(design): variante drawer carte, alignée sur la carte liste messagerie"
```

---

### Task 7: Rayons, recette, prod

**Files:**
- Modify: `src/components/messaging/messages-grammar.css`

- [ ] **Step 1: Échelle de rayons**

Appliquer : `.card`/drawer/`.mstate` panneau 26 ; `.ig-feed-row` 18 ; `.bub` 18 / queue 6 ; `.mfield`, `.msearch`, `.mpill`, `.msend` 999 ; `.mreact` 14. Retirer les valeurs orphelines 12/14/16/20/24 du fichier.

Run: `grep -n "border-radius" src/components/messaging/messages-grammar.css`
Expected: uniquement 26, 18, 14, 999, 6, 50%.

- [ ] **Step 2: Portes**

```bash
npx tsc --noEmit
npx eslint src/components/messaging src/design/account/AccountDrawerHost.tsx src/features/messaging/services/messagingService.ts
npx vitest run src/components/messaging
```

Expected: 0 erreur, tests du modèle verts.

- [ ] **Step 3: Recette 430 × 932**

Checklist à cocher sur captures :
- pillule Messages sans chiffre, une cloche seule ;
- recherche vide puis « Alexandre » : sections Personnes/Messages ;
- « Nouvelle discussion » donne le focus au champ ;
- sélection d'un fil : hauteur du volet identique à l'avant, pillule auteur, pas de bouton fermer/agrandir ;
- swipe droite → Supprimer / Notifications ; dialogue ; annulation puis suppression ;
- drawer Options : bord à bord carte + languette + animation ;
- cloche → `/compte?tab=notifications` avec le sous-drawer Notifications ouvert.

- [ ] **Step 4: Build et déploiement isolés**

```bash
git commit -m "style(messagerie): échelle de rayons unifiée"
git worktree add /tmp/lkdv-lotd HEAD
ln -s ~/Desktop/lkdv-cloudflare/node_modules /tmp/lkdv-lotd/node_modules
cp ~/Desktop/lkdv-cloudflare/.env.local /tmp/lkdv-lotd/.env.local
cd /tmp/lkdv-lotd && npm run build:vinext && npx vinext-cloudflare deploy --skip-build
```

Noter la version renvoyée. Vérifier `/messagerie` à 430 : `document.querySelector('.mfilters')` présent (design grammaire Compte) et pas la liste sombre `MessageInbox`.

- [ ] **Step 5: Rapport**

Écrire `docs/superpowers/plans/2026-10-26-messagerie-lot-d-recette.md` : version déployée, captures, mesures (hauteur du volet avant/après, rayons), tests, conflit de déploiement éventuel.

---

## Self-review

- **Couverture spec :** volet figé (T4), pillule (T4), recherche (T3), focus nouvelle discussion (T3), swipe droite + suppression + confirmation (T5), notifications (T5), drawers carte + languette + animation (T6), cloche → compte notifications (T3), suppression écrire/recherche/45 (T3), rayons (T7). RAS.
- **Placeholders :** aucun « TBD » ; chaque étape porte le code ou la commande.
- **Cohérence des types :** `left_at?: string | null` (T2) consommé par `filterConversations` (T1) ; `variant` (T6) utilisé par les feuilles (T5, T6) ; `SWIPE_REVEAL`, `clampSwipe`, `resolveSwipeEnd` définis en T1 et consommés en T5.
