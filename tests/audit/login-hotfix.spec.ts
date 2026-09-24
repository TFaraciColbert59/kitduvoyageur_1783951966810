import { chromium, type Locator, type Page } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import * as session from '../../scripts/audit/create_test_session.mjs';

type LoginPage = Page;
type LoginCredentials = { email: string; password: string };
type SessionModule = typeof session & {
  fillVisibleLoginForm?: (page: LoginPage, credentials: LoginCredentials) => Promise<Locator>;
};

const api = session as SessionModule;

describe('audit login — responsive forms', () => {
  it('résout un formulaire visible unique et navigue avec ce même formulaire', async () => {
    expect(typeof api.fillVisibleLoginForm).toBe('function');
    if (typeof api.fillVisibleLoginForm !== 'function') return;

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.route('http://audit.test/login', route => route.fulfill({
        contentType: 'text/html',
        body: `
          <main>
            <form id="desktop-form" style="display: none">
              <input id="email" type="email">
              <input id="password" type="password">
              <button type="submit">Desktop</button>
            </form>
            <form id="mobile-form" onsubmit="event.preventDefault(); this.dataset.submitted = 'true'; history.pushState({}, '', '/signed-in')">
              <input id="email" type="email">
              <input id="password" type="password">
              <button type="submit">Mobile</button>
            </form>
          </main>
        `,
      }));
      await page.goto('http://audit.test/login');

      const form = await api.fillVisibleLoginForm(page, {
        email: 'visible@example.test',
        password: 'visible-secret',
      });
      expect(form).toBeDefined();
      if (!form) return;

      expect(await form.count()).toBe(1);
      await Promise.all([
        page.waitForURL(url => new URL(url).pathname === '/signed-in', { timeout: 5000 }),
        form.locator('button[type="submit"]:visible').click(),
      ]);

      expect(await page.locator('#desktop-form input#email').inputValue()).toBe('');
      expect(await page.locator('#desktop-form input#password').inputValue()).toBe('');
      expect(await page.locator('#mobile-form input#email').inputValue()).toBe('visible@example.test');
      expect(await page.locator('#mobile-form input#password').inputValue()).toBe('visible-secret');
      expect(await page.locator('#mobile-form').getAttribute('data-submitted')).toBe('true');
      expect(new URL(page.url()).pathname).toBe('/signed-in');
    } finally {
      await browser.close();
    }
  });
});
