import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('Compte social réel — commentaires, partage, notifications', () => {
  it('expose les routes commentaires et partage', () => {
    expect(existsSync(resolve(process.cwd(), 'src/app/api/compte/posts/[id]/comments/route.ts'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/app/api/compte/share-post/route.ts'))).toBe(true);
    const comments = read('src/app/api/compte/posts/[id]/comments/route.ts');
    expect(comments).toContain("action === 'like'");
    expect(comments).toContain("action === 'report'");
    expect(comments).toContain('post_comments');
    expect(comments).toContain('post_comment_likes');
    const share = read('src/app/api/compte/share-post/route.ts');
    expect(share).toContain('post_shares');
    expect(share).toContain("message_type: 'post'");
  });

  it('le runtime charge, aime, répond, signale et partage', () => {
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    expect(runtime).toContain('openPostComments: async');
    expect(runtime).toContain('likeComment');
    expect(runtime).toContain('replyComment');
    expect(runtime).toContain('reportComment');
    expect(runtime).toContain('shareToConversation');
    expect(runtime).toContain("fetch('/api/compte/share-post'");
    expect(runtime).toContain('share_post: () =>');
  });

  it('le compte visiteur reste accessible et les données réelles ne sont pas maquillées', () => {
    const page = read('src/components/compte/CompteLiquidGlassV8.tsx');
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    const header = read('src/components/Header.tsx');
    expect(runtime).toContain('S.notifications');
    expect(runtime).toContain('ORDERS.map');
    expect(page).toContain("handle: 'tony_frc'");
    expect(page).toContain('carnets: DEMO_CARNETS');
    // « Mon compte » ne renvoie plus un visiteur vers /connexion.
    expect(header).toContain("{ label: 'Mon compte', href: '/compte' }");
    // Les compteurs réels à 0 ne retombent plus sur les valeurs de démo.
    expect(runtime).not.toContain("P.followersCount || '1 080'");
    expect(runtime).not.toContain("D.followingCount || '142'");
    // Le hydrate complet garde la priorité sur le patch partiel.
    expect(runtime).toContain('const hydrateAccountReplace = window.__lkdvHydrateCompte');
    expect(runtime).toContain('hydrateAccountReplace(data)');
    // Le bootstrap alimente aussi les notifications et le handle réel.
    expect(page).toContain('notifications: payload.notifications || []');
    expect(page).toContain('if (payload.profile?.handle) setActiveHandle(payload.profile.handle)');
  });

  it('les drawers et sorties ne retombent plus sur les mocks', () => {
    const page = read('src/components/compte/CompteLiquidGlassV8.tsx');
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    const bootstrap = read('src/features/compte/data/accountBootstrap.ts');
    expect(bootstrap).toContain('mapKits');
    expect(bootstrap).toContain('mapStories');
    expect(bootstrap).toContain('followers: mapTribu');
    expect(bootstrap).toContain('following: mapTribu');
    expect(bootstrap).toContain('species: []');
    expect(bootstrap).toContain('massifs: []');
    expect(page).toContain('kits: payload.kits || []');
    expect(page).toContain('followers: payload.followers || []');
    expect(page).toContain('massifs: payload.massifs || []');
    expect(runtime).toContain('FOLLOWERS = data.followers');
    expect(runtime).toContain('FOLLOWING = data.following');
    expect(runtime).toContain('KITS_LINEAGE = data.kits');
    expect(runtime).toContain('MASSIFS = data.massifs');
    // Aucun drawer ne relit le tableau de sorties de démonstration.
    const outingDrawer = runtime.slice(runtime.indexOf('outing_drawer:'), runtime.indexOf('followers_sheet:'));
    expect(outingDrawer).not.toContain('_MOCK_OUTINGS');
    expect(outingDrawer).toContain('Sortie introuvable');
    const followers = runtime.slice(runtime.indexOf('followers_sheet:'), runtime.indexOf('user_profile_preview:'));
    expect(followers).not.toContain('Léa Morel');
    expect(followers).toContain('FOLLOWERS.length');
  });
});
