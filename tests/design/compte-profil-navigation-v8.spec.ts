import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

describe('Compte & Profil Navigation Requirements (iOS 27 Liquid Glass v8)', () => {
  const runtimeSource = read('src/components/compte/compte-liquid-glass-v8-runtime.js');
  const compteCompSource = read('src/components/compte/CompteLiquidGlassV8.tsx');
  const compteCssSource = read('src/components/compte/compte-apple-hig.css');
  const allCompteStyles = compteCompSource + '\n' + compteCssSource;
  const profilPageSource = read('src/app/profil/[id]/page.tsx');
  const mobileNavWrapperSource = read('src/components/mobile-nav/MobileNavWrapper.tsx');
  const publicProfileViewSource = read('src/components/profile/PublicMobileProfileView.tsx');

  describe('Requirement 1: Click on user opens full profile page, NOT a drawer', () => {
    it('implements direct navigation in EXA.openUserProfile and clears sheets/modals', () => {
      expect(runtimeSource).toContain('openUserProfile: v =>');
      expect(runtimeSource).toContain("'/profil/' + encodeURIComponent(cleanHandle)");
      expect(runtimeSource).not.toContain("pushSheet({ k: 'user_profile_preview'");
    });

    it('handles openUserProfile in CompteLiquidGlassV8 via router.push and __lkdvNavigateProfile', () => {
      expect(compteCompSource).toContain('__lkdvNavigateProfile');
      expect(compteCompSource).toContain("action === 'openUserProfile'");
      expect(compteCompSource).toContain('router.push(`/profil/${encodeURIComponent(cleanHandle)}`)');
    });

    it('keeps profile links accessible in the post modal likes text', () => {
      expect(runtimeSource).toContain('data-a="openUserProfile" data-v="montagne_lea"');
      expect(runtimeSource).toContain('pmi-author');
    });

    it('attaches data-a="openUserProfile" to followers and following sheet rows', () => {
      expect(runtimeSource).toContain('class="reseau-av-wrap" data-a="openUserProfile" data-v="${u.h}"');
      expect(runtimeSource).toContain('class="reseau-meta" data-a="openUserProfile" data-v="${u.h}"');
    });

    it('attaches data-a="openUserProfile" to Tab 2 Réseau rows', () => {
      expect(runtimeSource).toContain('class="reseau-user-row"');
      expect(runtimeSource).toContain('\'<div class="reseau-av-wrap" data-a="openUserProfile" data-v="\' + u.h + \'"');
      expect(runtimeSource).toContain('\'<div class="reseau-meta" data-a="openUserProfile" data-v="\' + u.h + \'"');
    });

    it('attaches data-a="openUserProfile" to companions in Cordée/Tribu drawer tab', () => {
      expect(runtimeSource).toContain('data-a="openUserProfile" data-v="${t.ps}"');
    });

    it('keeps profile access in likes text and closes the post from the profile pill', () => {
      expect(runtimeSource).toContain('class="pmi-author" data-a="closePostModal"');
      expect(runtimeSource).toContain('data-a="openUserProfile" data-v="montagne_lea"');
    });
  });

  describe('Requirement 2: Public profile integrates unified iOS 27 Liquid Glass navigation', () => {
    it('renders the public profile without the Compte AppShell', () => {
      expect(profilPageSource).toContain('PublicProfileV2');
      expect(profilPageSource).not.toContain('<AppShell');
    });

    it('rattache le profil public à la barre unique iOS 27 sans masquage', () => {
      expect(mobileNavWrapperSource).toContain('MobileNavWrapper');
      expect(mobileNavWrapperSource).not.toContain("pathname === '/profil'");
    });
  });

  describe('Requirement 3: Back arrow top-left and swipe back gesture on profile', () => {
    it('wires PageHeader with HeaderBackButton falling back to /compte', () => {
      expect(publicProfileViewSource).toContain('HeaderBackButton');
      expect(publicProfileViewSource).toContain('fallbackHref="/compte"');
      expect(publicProfileViewSource).toContain('handleBack');
    });

    it('implements horizontal touch swipe gesture with gesture guards', () => {
      expect(publicProfileViewSource).toContain('handleTouchStart');
      expect(publicProfileViewSource).toContain('handleTouchEnd');
      expect(publicProfileViewSource).toContain('Math.abs(dx) >= 60');
      expect(publicProfileViewSource).toContain('Math.abs(dy) <= Math.abs(dx) * 0.65');
      expect(publicProfileViewSource).toContain('.snap-x');
      expect(publicProfileViewSource).toContain('[role="tablist"]');
    });
  });

  describe('Requirement 4: Bottom bar shrinks/reduces when map opens', () => {
    it('collapses .tb, .tabbar and .acc on .phone.mapbig in CSS', () => {
      expect(allCompteStyles).toContain('.phone.mapbig .tb');
      expect(allCompteStyles).toContain('.phone.mapbig .tabbar');
      expect(allCompteStyles).toContain('.phone.mapbig .acc');
      expect(allCompteStyles).toContain('transform: translateY(120%) !important;');
      expect(allCompteStyles).toContain('opacity: 0 !important;');
      expect(allCompteStyles).toContain('pointer-events: none !important;');
    });
  });

  describe('Requirement 5: Drawers open in CARD (minimal height over the main card)', () => {
    it('defaults openSheet and pushSheet detent to "card" and normalizes any other open detent', () => {
      expect(runtimeSource).toContain('let openSheet = function(k = "step", tab = 0, det = "card"');
      expect(runtimeSource).toContain('if (S.sh.det !== "closed") S.sh.det = "card";');
      expect(runtimeSource).toContain('S.sh = { tab: 0, page: 0, det: "card", ...o };');
    });

    it('exposes the card detent in CSS and keeps map controls visible over the map', () => {
      expect(allCompteStyles).toContain('.sw-wrap[data-det="card"] .sheet');
      expect(allCompteStyles).toContain('.phone[data-det="card"] .mctl');
    });

    it('collapses bottom bar when any drawer is open (.sheet-open, [data-det="card"])', () => {
      expect(allCompteStyles).toContain('.phone.sheet-open .tb');
      expect(allCompteStyles).toContain('.phone[data-sheet-open="true"] .tb');
      expect(allCompteStyles).toContain(':has(#sw[data-det="large"]) .tb');
    });
  });
});
