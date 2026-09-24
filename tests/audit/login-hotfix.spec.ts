import { chromium, type Page } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import * as session from '../../scripts/audit/create_test_session.mjs';

type LoginPage = Page;
type LoginCredentials = { email: string; password: string };
type SessionModule = typeof session & {
  fillVisibleLoginForm?: (page: LoginPage, credentials: LoginCredentials) => Promise<void>;
};

const api = session as SessionModule;

describe('audit login — responsive forms', () => {
  it('remplit uniquement les champs visibles malgré des IDs dupliqués', async () => {
    expect(typeof api.fillVisibleLoginForm).toBe('function');
    if (typeof api.fillVisibleLoginForm !== 'function') return;

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.setContent(`
        <form id="desktop-form" style="display: none">
          <input id="email" type="email">
          <input id="password" type="password">
          <button type="submit">Desktop</button>
        </form>
        <form id="mobile-form">
          <input id="email" type="email">
          <input id="password" type="password">
          <button type="submit">Mobile</button>
        </form>
      `);

      await api.fillVisibleLoginForm(page, {
        email: 'visible@example.test',
        password: 'visible-secret',
      });

      expect(await page.locator('#desktop-form input#email').inputValue()).toBe('');
      expect(await page.locator('#desktop-form input#password').inputValue()).toBe('');
      expect(await page.locator('#mobile-form input#email').inputValue()).toBe('visible@example.test');
      expect(await page.locator('#mobile-form input#password').inputValue()).toBe('visible-secret');
    } finally {
      await browser.close();
    }
  });
});
