import { test, expect } from '@playwright/test';

/**
 * POC mini-chat pays — smoke @local-web (sans auth, sans appel IA).
 * Constat environnemental documenté : en build local, l'hydratation de
 * /pays/fr (comme /faq, page témoin sans rapport) bascule sur
 * global-error.tsx sans pageerror — préexistant, non lié au POC.
 * Ce test vérifie donc le montage SSR (HTML servi) : suggestions,
 * toggle accessible. Le plein rendu navigateur est couvert hors local
 * (staging, cf. plan § hors-scope).
 */
test.describe('POC mini-chat pays', () => {
  test(
    'TEST-E2E-PAYS-CHAT-01: SSR /pays/fr contient le mini-chat',
    { tag: '@local-web' },
    async ({ request }) => {
      const res = await request.get('/pays/fr');
      expect(res.status()).toBe(200);

      const html = await res.text();
      expect(html).toContain('Crée mon kit');
      expect(html).toContain('Quand partir ?');
      expect(html).toContain('Ouvrir le mini-chat');
      expect(html).not.toContain('Erreur Critique');
    }
  );
});
