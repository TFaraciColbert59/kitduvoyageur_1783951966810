/**
 * Alias explicite de construction de trame Live Sync.
 * La logique reste dans `../route.ts` (une seule implémentation).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export { GET, POST } from '../route';
