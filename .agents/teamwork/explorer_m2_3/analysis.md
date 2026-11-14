# Analyse Technique & Spécifications — Features 10, 11, 12 (Milestone M2)

**Auteur** : Explorer 3 (`teamwork_explorer`)  
**Milestone** : M2 — `/messagerie` Refactor & Drawers  
**Date** : 14 novembre 2026  
**Statut** : Validé, prêt pour implémentation  

---

## 1. Vue d'Ensemble & Périmètre d'Investigation

Ce document présente l'analyse approfondie, la chaîne causale rigoureusement observée, ainsi que les spécifications techniques et blueprints de code détaillés pour les 3 fonctionnalités suivantes :

| # | Fonctionnalité | Fichiers Clés | Problème Constaté (Audit iPhone §5) |
|---|----------------|---------------|--------------------------------------|
| **10** | **Group Chat Realtime Freeze Elimination** | `src/features/messaging/hooks/useConversations.ts`<br>`src/components/messaging/MessagesScreen.tsx` | Lors de l'ouverture d'un groupe (`Bivouac de printemps`, `Dolomites — août`), la liste du haut se vide ou se fige sur 4 squelettes gris de chargement (`mskel`), ou affiche une ligne fantôme à 30 % d'opacité. |
| **11** | **Shared Post Embed Graceful Fallback & Bubble Text Breaking** | `src/features/messaging/components/SharedPostEmbed.tsx`<br>`src/features/messaging/components/cards/PostMessageCard.tsx`<br>`src/components/messaging/MessagesScreen.tsx`<br>`src/components/messaging/messages-grammar.css` | Carte d'erreur brute grise `"Publication indisponible"` dans le fil ; image de post coupée en deux ; la bulle `"Top / Bien"` casse deux mots de 3 et 4 lettres sur deux lignes. |
| **12** | **Reaction Emoji Overlay Bar & Message Actions** | `src/components/messaging/MessagesScreen.tsx`<br>`src/components/messaging/messages-grammar.css`<br>`src/features/messaging/hooks/useMessages.ts`<br>`src/features/messaging/services/messagingService.ts` | La rangée de 6 réactions + Répondre + Copier se casse sur 2 lignes dans le flux normal et repousse les messages suivants vers le bas ; rognage possible par le conteneur ; absence d'actions de gestion réelles (`Supprimer`, `Modifier`). |

---

## 2. Feature 10 : Élimination du Gel et des Squelettes en Chat de Groupe (Realtime Freeze Elimination)

### 2.1. Traçage & Chaîne Causale

1. **Sélection de la conversation** :
   Dans `src/components/messaging/MessagesScreen.tsx:1385-1388` et `1652`, l'utilisateur clique sur une conversation de groupe (ex. `Bivouac de printemps` ou `Dolomites — août`). `open(conversation)` appelle `setSelectedId(conversation.id)`.
2. **Montage du composant de discussion** :
   `selectedId` devient actif, ce qui monte `<MessageThread conversation={selected} ... />` (`MessagesScreen.tsx:1786-1835`).
3. **Appel de `markAsRead` dans `useMessages`** :
   Dans `src/features/messaging/hooks/useMessages.ts:47-49` :
   ```typescript
   if (currentUserId && isVisible) {
     await messagingService.markAsRead(conversationId, currentUserId);
   }
   ```
4. **Mise à jour en base de données** :
   Dans `src/features/messaging/services/messagingService.ts:1001-1008` :
   ```typescript
   await supabase
     .from('conversation_members')
     .update({ unread_count: 0, last_read_at: new Date().toISOString() })
     .eq('conversation_id', conversationId)
     .eq('user_id', userId);
   ```
5. **Déclenchement de l'abonnement Realtime** :
   Dans `src/features/messaging/hooks/useConversations.ts:76-87` :
   ```typescript
   .on('postgres_changes', {
     event: '*',
     schema: 'public',
     table: 'conversation_members',
     filter: `user_id=eq.${userId}`,
   }, () => {
     fetchConversations();
   })
   ```
6. **Le Bug Critique (`setLoading(true)`)** :
   Dans `src/features/messaging/hooks/useConversations.ts:46-56` :
   ```typescript
   try {
     setLoading(true); // <--- DESTRUCTION DE L'ÉTAT ACTUEL
     const data = await messagingService.getConversations(userId);
     setConversations(data);
     writeCache(userId, data);
     setError(null);
   } ... finally {
     setLoading(false);
   }
   ```
7. **Conséquence dans l'interface utilisateur** :
   Dans `src/components/messaging/MessagesScreen.tsx:1582-1589` :
   ```tsx
   ) : loading ? (
     [1, 2, 3, 4].map((row) => (
       <div className="mskel" key={row} aria-hidden="true">
         <i style={{ width: 40, height: 40, borderRadius: '50%' }} />
         <i style={{ flex: 1, height: 12 }} />
         <i style={{ width: 28, height: 10 }} />
       </div>
     ))
   ) : ...
   ```
   Dès que `loading` passe à `true`, **l'intégralité de la liste des conversations est démontée du DOM** et remplacée par exactement **4 squelettes gris (`mskel`)**.
   - Si la requête réseau met 300 à 800 ms (ou si Realtime reçoit plusieurs updates consécutifs), l'écran reste bloqué sur 4 squelettes gris.
   - Lorsque `loading` repasse à `false`, les rangées sont remontées avec l'animation CSS `@keyframes mrow-in` (`messages-grammar.css:921-930`), qui démarre à `opacity: 0; transform: translateY(5px);`. Sur une machine ou un appareil capturant à cet instant, la première rangée (`Camille Rochat`) a été photographiée à mi-animation à environ 30 % d'opacité, sans que les avatars asynchrones n'aient encore fini de se charger !

### 2.2. Spécification de la Solution

1. **Chargement initial vs. Synchronisation en tâche de fond** :
   - `loading` ne doit être à `true` que si **aucune donnée n'est présente en mémoire ni dans le cache de session** (`conversations.length === 0`).
   - Initialisation : `const [loading, setLoading] = useState(() => readCache(userId).length === 0);`.
   - `fetchConversations` doit accepter un paramètre `{ silent?: boolean }`. Si `silent: true` (ou si `conversations.length > 0`), **NE JAMAIS appeler `setLoading(true)`**.
2. **Gestion Realtime 100 % silencieuse** :
   - Tout événement Realtime (`conversation_members` ou `conversations`) appelle systématiquement `fetchConversations({ silent: true })`.
3. **Mise à jour optimiste locale** :
   - Exposer `markConversationReadLocally(conversationId: string)` depuis `useConversations` :
     ```typescript
     const markConversationReadLocally = useCallback((conversationId: string) => {
       setConversations((prev) =>
         prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
       );
     }, []);
     ```
   - Appeler cette fonction immédiatement lors de la sélection d'une conversation dans `MessagesScreen.tsx`.
4. **Garde-fou dans `MessagesScreen.tsx`** :
   - Remplacer la condition `loading ?` par `loading && conversations.length === 0 ?`. Si des conversations existent déjà, elles continuent d'être affichées et interactives pendant toute resynchronisation réseau.

### 2.3. Blueprint des Remplacements de Code

#### Fichier 1 : `src/features/messaging/hooks/useConversations.ts`
```typescript
// AVANT (Lignes 34-57 & 84-97) :
export function useConversations(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>(() => readCache(userId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await messagingService.getConversations(userId);
      setConversations(data);
      writeCache(userId, data);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to fetch conversations:', err);
      setError('Impossible de charger vos conversations.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

// APRÈS (Remplacement direct) :
export function useConversations(userId: string | undefined) {
  const initialCache = readCache(userId);
  const [conversations, setConversations] = useState<Conversation[]>(initialCache);
  const [loading, setLoading] = useState(() => initialCache.length === 0);
  const [error, setError] = useState<string | null>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const fetchConversations = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const isSilent = opts?.silent ?? (conversationsRef.current.length > 0);
    if (!isSilent) {
      setLoading(true);
    }

    try {
      const data = await messagingService.getConversations(userId);
      setConversations(data);
      writeCache(userId, data);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to fetch conversations:', err);
      if (conversationsRef.current.length === 0) {
        setError('Impossible de charger vos conversations.');
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [userId]);

  const markConversationReadLocally = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
    );
  }, []);
```
Et dans les abonnements Realtime (`useConversations.ts:84-98`) :
```typescript
// Remplacer :
() => { fetchConversations(); }
// Par :
() => { void fetchConversations({ silent: true }); }
```
Retour du hook (`useConversations.ts:108-114`) :
```typescript
  return {
    conversations,
    loading,
    error,
    totalUnread,
    refreshConversations: fetchConversations,
    markConversationReadLocally,
  };
```

#### Fichier 2 : `src/components/messaging/MessagesScreen.tsx`
Ligne 1209 :
```typescript
const { conversations, loading, error, refreshConversations, markConversationReadLocally } =
  useConversations(currentUserId ?? undefined);
```
Ligne 1385 :
```typescript
const open = useCallback((conversation: Conversation) => {
  if (selectedId === conversation.id) return;
  setSelectedId(conversation.id);
  markConversationReadLocally(conversation.id);
}, [selectedId, markConversationReadLocally]);
```
Ligne 1582 :
```tsx
// AVANT :
) : loading ? (
// APRÈS :
) : loading && conversations.length === 0 ? (
```

---

## 3. Feature 11 : Repli Gracieux pour Post Partagé & Césure de Texte des Bulles

### 3.1. Traçage & Analyse

1. **Affichage du post partagé** :
   Dans `src/components/messaging/MessagesScreen.tsx:550-557` :
   ```tsx
   {message.message_type === 'post' ? (
     <div className="mpost-embed-row">
       <SharedPostEmbed
         postId={String(message.metadata?.post_id ?? message.content)}
         currentUserId={currentUserId}
         currentUserProfile={currentUserProfile}
       />
     </div>
   ) : ...
   ```
2. **Le repli brut d'erreur** :
   Dans `src/features/messaging/components/SharedPostEmbed.tsx:71-73` :
   ```tsx
   if (failed) {
     return <div className="mpost-embed-fallback">Publication indisponible</div>;
   }
   ```
   Et dans `src/components/messaging/messages-grammar.css:1513-1519` :
   ```css
   .lkdv-messages .mpost-embed-fallback {
     padding: 14px;
     border-radius: 16px;
     background: var(--fill3);
     color: var(--label2);
     font: 500 12px/1.3 var(--sf);
   }
   ```
   C'est un simple rectangle gris terne sans identité LKDV, sans aucune action ni explication contextuelle.
3. **Troncature de l'image du post partagé** :
   Dans `messages-grammar.css:1492-1504` :
   `.lkdv-messages .mpost-embed .lkdv-feed-post` impose `height: 230px !important;`. Comme `CommunityFeedPost` est un composant complet comprenant l'en-tête auteur, le titre, le texte, la photo et la barre d'actions, le forcer dans 230px coupe la photo en plein milieu.
   De plus, un composant compact optimisé existe déjà dans le projet : `src/features/messaging/components/cards/PostMessageCard.tsx` (testé et validé à 100 % dans Vitest).
4. **Anomalie de césure de texte ("Top / Bien")** :
   Dans `src/components/messaging/messages-grammar.css:78-102` :
   ```css
   .lkdv-messages .bub {
     ...
     font: 400 13px/1.38 var(--sf);
     letter-spacing: -0.13px;
     text-align: left;
     word-break: break-word;
     white-space: pre-wrap;
   }
   ```
   Et dans `.mstack` (`messages-grammar.css:59-65`) :
   ```css
   .lkdv-messages .mstack {
     display: flex;
     flex-direction: column;
     gap: 2px;
     max-width: 78%;
     min-width: 0;
   }
   ```
   Dans WebKit iOS, un élément `<button className="bub">` imbriqué dans une colonne flex sans `width: fit-content` et avec `word-break: break-word` découpe prématurément les séquences courtes contenant des barres obliques ou des espaces lorsque la taille minimale intrinsèque est calculée, provoquant la césure ridicule de "Top / Bien" sur deux lignes.

### 3.2. Spécification de la Solution

1. **Carte de Repli Gracieux (`SharedPostEmbedFallback`)** :
   - **Forme** : Coins squircle continus Apple `border-radius: 18px` (`radii.card`), bordure subtile teintée vert LKDV `rgba(23, 43, 36, 0.12)`, fond de verre clair `rgba(255, 255, 255, 0.85)` avec flou matière WebKit `blur(20px)`.
   - **Icône** : Vignette sauge `rgba(23, 64, 44, 0.08)` avec icône LKDV (`image-off` ou `eye-off`) en vert forêt `#17402C`.
   - **Typographie** :
     - Titre : `Publication privée ou indisponible` (font: `-apple-system-subheadline`, 600, couleur `#172B24` WCAG AAA).
     - Sous-titre : `Ce contenu a été supprimé ou son accès est restreint.` (font: `-apple-system-footnote`, 400, couleur `#56665D`).
   - **Action** : Bouton discret `Réessayer` (`mbtn`) pour relancer la requête en cas de coupure réseau transitoire.
2. **Format compact du post partagé** :
   - Si les métadonnées du post sont fournies dans le message (`message.metadata?.post_url` ou `image_url`), utiliser directement `PostMessageCard` (`src/features/messaging/components/cards/PostMessageCard.tsx`).
   - Dans `SharedPostEmbed`, limiter la hauteur maximale à `auto` avec ratio propre, éliminant la troncature d'image.
3. **Correction de la césure de texte des bulles** :
   - Remplacer `word-break: break-word;` par `word-break: normal; overflow-wrap: anywhere;`.
   - Ajouter `width: fit-content; max-width: 100%;` sur `.bub`.
   - Ajuster `.mstack` pour utiliser `width: fit-content; max-width: 78%;`.

### 3.3. Blueprint des Remplacements de Code

#### Fichier 1 : `src/features/messaging/components/SharedPostEmbed.tsx`
```tsx
// Remplacement complet du rendu en cas d'échec (lignes 71-73) :
  if (failed) {
    return (
      <div className="mpost-embed-fallback-card" role="note" aria-label="Publication indisponible">
        <div className="mpost-embed-fallback-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        </div>
        <div className="mpost-embed-fallback-text">
          <b className="mpost-embed-fallback-title">Publication privée ou indisponible</b>
          <span className="mpost-embed-fallback-desc">Ce contenu a été supprimé ou son accès est réservé.</span>
        </div>
        <button
          type="button"
          className="mpost-embed-fallback-retry"
          onClick={() => {
            setFailed(false);
            setPost(null);
          }}
          aria-label="Réessayer de charger la publication"
        >
          Réessayer
        </button>
      </div>
    );
  }
```

#### Fichier 2 : `src/components/messaging/messages-grammar.css`
```css
/* Remplacement des styles de bulle et conteneur pour éliminer la césure anormale */
.lkdv-messages .mstack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 78%;
  min-width: 0;
  width: fit-content;
}
.lkdv-messages .mstack.mine {
  align-items: flex-end;
  margin-left: auto;
}

.lkdv-messages .bub {
  position: relative;
  width: fit-content;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 18px;
  border: 0;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, calc(var(--ga, 0.19) + 0.3)),
    rgba(255, 255, 255, calc(var(--ga, 0.19) + 0.2))
  );
  -webkit-backdrop-filter: blur(calc(var(--gb, 7px) + 18px)) saturate(1.8) brightness(1.05);
  backdrop-filter: blur(calc(var(--gb, 7px) + 18px)) saturate(1.8) brightness(1.05);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -1px 1px rgba(255, 255, 255, 0.4),
    inset 0 0 16px rgba(255, 255, 255, 0.12),
    0 0 0 0.5px rgba(23, 43, 36, 0.12),
    0 6px 18px rgba(23, 43, 36, 0.1);
  color: var(--label);
  font: 400 13px/1.38 var(--sf);
  letter-spacing: -0.13px;
  text-align: left;
  word-break: normal;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* Carte de repli élégante LKDV (au lieu du rectangle gris terne) */
.lkdv-messages .mpost-embed-fallback-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 340px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.85);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
  backdrop-filter: blur(20px) saturate(1.8);
  border: 0.5px solid rgba(23, 43, 36, 0.12);
  box-shadow: 0 4px 16px rgba(23, 64, 44, 0.08);
}
.lkdv-messages .mpost-embed-fallback-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 12px;
  background: rgba(23, 64, 44, 0.08);
  color: #17402C;
}
.lkdv-messages .mpost-embed-fallback-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.lkdv-messages .mpost-embed-fallback-title {
  font: 600 12.5px/1.25 var(--sf);
  color: #172B24;
}
.lkdv-messages .mpost-embed-fallback-desc {
  font: 400 11px/1.3 var(--sf);
  color: #56665D;
}
.lkdv-messages .mpost-embed-fallback-retry {
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font: 600 11px/1 var(--sf);
  color: #17402C;
  background: rgba(23, 64, 44, 0.06);
  border: 0.5px solid rgba(23, 43, 36, 0.14);
  cursor: pointer;
  flex: none;
  transition: transform 0.12s ease;
}
.lkdv-messages .mpost-embed-fallback-retry:active {
  transform: scale(0.95);
}
```

---

## 4. Feature 12 : Barre d'Emojis de Réaction en Overlay Flottant & Actions sur Message

### 4.1. Traçage & Analyse

1. **Rendu actuel dans le flux normal** :
   Dans `src/components/messaging/MessagesScreen.tsx:798-845` :
   ```tsx
   {openMenu === message.id ? (
     <div className="mreacts" style={{ padding: '2px 0' }}>
       <button ...>Répondre</button>
       <button ...>Transférer</button>
       <button ...>Copier</button>
       {REACTIONS.map((emoji) => (
         <button ...>{emoji}</button>
       ))}
     </div>
   ) : null}
   ```
2. **Pourquoi l'affichage casse sur 2 lignes et pousse les messages** :
   - Le bloc est rendu directement dans le flux normal sous `<button className="bub">` au sein de `.mstack`.
   - 3 boutons de texte + 6 boutons d'émojis = **9 éléments** dans un conteneur limité à 78 % de la largeur.
   - `.mreacts` a la règle `flex-wrap: wrap;` (`messages-grammar.css:187`). Les éléments passent obligatoirement à la ligne suivante.
   - En s'agrandissant de 48 à 60 px dans le flux vertical, il repousse le reste du fil vers le bas. Sur iPhone, le dernier message est poussé sous le composer.
3. **Problème de rognage par le haut (`contain: paint`)** :
   Dans `messages-grammar.css:1720` :
   ```css
   .lkdv-messages .mthread {
     contain: paint;
   }
   ```
   Si un élément absolu déborde au-dessus du bord supérieur du conteneur défilant `.mthread`, il est immédiatement coupé net par `contain: paint`.
4. **Absence d'actions de gestion de ses propres messages** :
   - `messagingService.ts` ne contient aucune méthode `deleteMessage` ni `editMessage`.
   - Pourtant, `useMessages.ts:146-177` écoute déjà en Realtime les événements `UPDATE` (avec `deleted_at`) et `DELETE` sur la table `messages` ! Le backend et le listener Realtime sont déjà prêts, il manque uniquement l'appel API et l'interface utilisateur.

### 4.2. Spécification de la Solution

1. **Overlay Flottant Contextuel (Apple HIG `UIContextMenuInteraction` & iMessage Reaction Bar)** :
   - **Backdrop** : Voile transparent plein écran `<div className="mcontext-backdrop" onClick={() => setOpenMenu(null)} />` capturant les taps extérieurs pour fermer le menu instantanément.
   - **Positionnement intelligent** :
     - Ancrage flottant en `position: absolute; z-index: 60;`.
     - Détection de la position verticale de la bulle (`rect.top`) :
       - Si la bulle est proche du haut du conteneur visible (`rect.top < 120px`) : ancrer **en dessous** (`top: calc(100% + 8px)`).
       - Sinon : ancrer **au-dessus** (`bottom: calc(100% + 8px)`).
     - Alignement horizontal :
       - Pour un message envoyé (`mine`) : aligné à droite (`right: 0`).
       - Pour un message reçu (`other`) : aligné à gauche (`left: 0`).
2. **Capsule de Réaction (Pilule Emojis)** :
   - Forme : Pilule capsule fermée (`border-radius: 9999px`), hauteur 44pt (Apple Human Interface Guidelines), flou de verre Liquid Glass (`background: rgba(255, 255, 255, 0.90); backdrop-filter: blur(24px)`), bordure `0.5px solid rgba(23, 43, 36, 0.14)`.
   - Disposition : `display: flex; flex-direction: row; flex-wrap: nowrap; gap: 4px; padding: 0 8px;`.
   - Boutons : 6 emojis (`👍`, `❤️`, `😂`, `😮`, `🙏`, `🔥`), 34×34pt, touch-target effectif 44pt.
3. **Menu d'Actions Structuré (Action List)** :
   - Carte squircle compacte (`border-radius: 14px`, `background: rgba(255, 255, 255, 0.92)`).
   - Rangées de 40px avec séparateurs fins `0.5px solid rgba(23, 43, 36, 0.12)` :
     - `Répondre` (icône flèche retour)
     - `Copier` (icône copie)
     - `Transférer` (icône transfert)
     - Si `mine` :
       - `Modifier` (icône crayon)
       - `Supprimer` (icône corbeille, texte et icône en rouge destructif `#D33833` / `brand.status.danger.fg`).
4. **Ajout de `deleteMessage` et `editMessage`** :
   - Dans `messagingService.ts` : ajouter `deleteMessage(messageId, userId)` et `editMessage(messageId, userId, newContent)`.
   - Dans `useMessages.ts` : exposer `deleteMessage` et `editMessage` avec mise à jour optimiste immédiate dans `setMessages`.
   - Dans `MessagesScreen.tsx` : gérer l'état `editingMessage` dans le composer, avec bandeau d'annulation (`mreply`) et validation de l'édition.

### 4.3. Blueprint des Remplacements de Code

#### Fichier 1 : `src/features/messaging/services/messagingService.ts`
```typescript
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', userId);
    if (error) {
      console.error('Failed to delete message:', error.message);
      return false;
    }
    return true;
  },

  async editMessage(messageId: string, userId: string, newContent: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('messages')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', userId);
    if (error) {
      console.error('Failed to edit message:', error.message);
      return false;
    }
    return true;
  },
```

#### Fichier 2 : `src/features/messaging/hooks/useMessages.ts`
```typescript
  const deleteMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (!currentUserId) return false;
      // Mise à jour optimiste immédiate
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, deleted_at: new Date().toISOString(), content: '', reactions: [] }
            : m
        )
      );
      return messagingService.deleteMessage(messageId, currentUserId);
    },
    [currentUserId]
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string): Promise<boolean> => {
      if (!currentUserId) return false;
      // Mise à jour optimiste immédiate
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: newContent, updated_at: new Date().toISOString() }
            : m
        )
      );
      return messagingService.editMessage(messageId, currentUserId, newContent);
    },
    [currentUserId]
  );

  return {
    messages,
    loading,
    error,
    hasMore,
    loadingEarlier,
    loadEarlier,
    retryMessage,
    toggleReaction,
    sendMessage,
    refreshMessages: fetchMessages,
    deleteMessage,
    editMessage,
  };
```

#### Fichier 3 : `src/components/messaging/MessagesScreen.tsx`
Remplacer le bloc `openMenu === message.id` (lignes 798-845) par le composant popover overlay contextuel :
```tsx
{openMenu === message.id ? (
  <>
    <div
      className="mcontext-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        setOpenMenu(null);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        setOpenMenu(null);
      }}
    />
    <div
      className={`mcontext-popover ${mine ? 'align-right' : 'align-left'}`}
      style={{
        bottom: 'calc(100% + 8px)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Pilule capsule horizontale de réactions */}
      <div className="mreaction-capsule" role="toolbar" aria-label="Réactions emoji">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="mreaction-btn"
            onClick={() => {
              haptic('light');
              void toggleReaction(message.id, emoji);
              setOpenMenu(null);
            }}
            aria-label={`Réagir avec ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* 2. Menu d'actions style iOS context menu */}
      <div className="mcontext-action-menu" role="menu">
        <button
          type="button"
          className="mcontext-action-row"
          onClick={() => {
            setReplyTo(message);
            setOpenMenu(null);
          }}
          role="menuitem"
        >
          <span>Répondre</span>
          <Icon name="corner-up-left" className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mcontext-action-row"
          onClick={() => {
            void navigator.clipboard?.writeText(message.content).catch(() => {});
            setOpenMenu(null);
          }}
          role="menuitem"
        >
          <span>Copier</span>
          <Icon name="copy" className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="mcontext-action-row"
          onClick={() => {
            setForwarding(message);
            setOpenMenu(null);
          }}
          role="menuitem"
        >
          <span>Transférer</span>
          <Icon name="share" className="size-4" aria-hidden="true" />
        </button>
        {mine ? (
          <>
            <button
              type="button"
              className="mcontext-action-row"
              onClick={() => {
                setEditingMessage(message);
                setOpenMenu(null);
              }}
              role="menuitem"
            >
              <span>Modifier</span>
              <Icon name="edit-2" className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="mcontext-action-row destructive"
              onClick={async () => {
                setOpenMenu(null);
                const ok = await lkvConfirm({
                  title: 'Supprimer le message ?',
                  message: 'Ce message sera effacé pour tous les participants.',
                  confirmLabel: 'Supprimer',
                  cancelLabel: 'Annuler',
                  variant: 'destructive',
                });
                if (ok) {
                  await deleteMessage(message.id);
                }
              }}
              role="menuitem"
            >
              <span>Supprimer</span>
              <Icon name="trash-2" className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  </>
) : null}
```

#### Fichier 4 : `src/components/messaging/messages-grammar.css`
```css
/* ---------- Backdrop plein écran pour dismiss tactile ---------- */
.lkdv-messages .mcontext-backdrop {
  position: fixed;
  inset: 0;
  z-index: 55;
  background: transparent;
}

/* ---------- Popover flottant contextuel ancré à la bulle ---------- */
.lkdv-messages .mcontext-popover {
  position: absolute;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: mpopover-spring 0.22s var(--ease-spring) both;
}
.lkdv-messages .mcontext-popover.align-right {
  right: 0;
  align-items: flex-end;
}
.lkdv-messages .mcontext-popover.align-left {
  left: 0;
  align-items: flex-start;
}

@keyframes mpopover-spring {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* ---------- Pilule de réaction emoji horizontale Apple (44pt) ---------- */
.lkdv-messages .mreaction-capsule {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  height: 44px;
  padding: 0 8px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.90);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  backdrop-filter: blur(24px) saturate(1.8);
  border: 0.5px solid rgba(23, 43, 36, 0.14);
  box-shadow: 0 8px 24px rgba(23, 64, 44, 0.16);
}
.lkdv-messages .mreaction-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 0;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  transition: transform 0.14s var(--ease-spring);
}
.lkdv-messages .mreaction-btn:active {
  transform: scale(1.25);
}

/* ---------- Carte de menu d'actions style iOS Inset Grouped ---------- */
.lkdv-messages .mcontext-action-menu {
  display: flex;
  flex-direction: column;
  width: 190px;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(24px) saturate(1.8);
  backdrop-filter: blur(24px) saturate(1.8);
  border: 0.5px solid rgba(23, 43, 36, 0.14);
  box-shadow: 0 10px 30px rgba(23, 64, 44, 0.18);
}
.lkdv-messages .mcontext-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 14px;
  border: 0;
  background: transparent;
  font: 500 13px/1 var(--sf);
  color: #172B24;
  cursor: pointer;
  transition: background 0.12s ease;
}
.lkdv-messages .mcontext-action-row:not(:last-child) {
  border-bottom: 0.5px solid rgba(23, 43, 36, 0.10);
}
.lkdv-messages .mcontext-action-row:active {
  background: rgba(23, 64, 44, 0.08);
}
.lkdv-messages .mcontext-action-row.destructive {
  color: #D33833;
}
```

---

## 5. Synthèse & Plan de Vérification

1. **Vérification Vitest** :
   - Exécuter `npm test src/components/messaging/` et `npm test src/features/messaging/components/cards/__tests__/PostMessageCard.test.tsx`.
   - Tous les tests existants doivent réussir à 100 %.
2. **Vérification E2E Tiers 1-4** :
   - Exécuter `npm run test:e2e:tiers` ou `node tests/e2e/runner.mjs`.
   - Confirmer le passage des 140 tests sans aucune régression.
3. **Vérification Physique Appium sur iPhone 16 Pro** :
   - Exécution de `crawl-communaute-messagerie-deep.mjs` et `crawl-finish-all-pages.mjs`.
   - Capture `06-messagerie-conv-groupe-bivouac.png` : la liste du haut reste affichée et réactive avec les discussions, sans squelettes ni clignotement.
   - Capture `09-messagerie-message-longpress.png` : la barre d'emojis apparaît en pilule capsule flottante sans casser sur 2 lignes et sans repousser les messages du fil.
