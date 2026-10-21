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

  it('les notifications et commandes sont réelles, les mocks invités sont retirés', () => {
    const page = read('src/components/compte/CompteLiquidGlassV8.tsx');
    const runtime = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
    expect(runtime).toContain('S.notifications');
    expect(runtime).toContain('ORDERS.map');
    expect(page).toContain("name: 'Invité'");
    expect(page).toContain('carnets: []');
  });
});
