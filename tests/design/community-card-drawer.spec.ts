import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Communauté — page figée, seul le fil défile', () => {
  const css = read('src/styles/community-card.css');

  it('la coquille verrouillée fait 100dvh sans défilement de page', () => {
    expect(css).toMatch(/\.lkdv-feed-shell--locked\s*\{[^}]*height:\s*100dvh/);
    expect(css).toMatch(/\.lkdv-feed-shell--locked\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/html\.lkdv-no-page-scroll,[\s\S]*overflow:\s*hidden/);
  });

  it('`.lkdv-feed-main` est le seul conteneur qui défile verticalement', () => {
    expect(css).toMatch(/\.lkdv-feed-shell--locked \.lkdv-feed-main\s*\{[^}]*overflow-y:\s*auto/);
    const shell = read('src/features/community/feed/CommunityFeedShell.tsx');
    expect(shell).toContain('lkdv-no-page-scroll');
    expect(shell).toContain('inert={drawerOpen}');
  });

  it('la carte-drawer reprend les mesures du Compte', () => {
    const card = css.slice(css.indexOf('.lkdv-cd {'), css.indexOf('@keyframes lkdv-cd-in'));
    expect(card).toContain('border-radius: 24px');
    expect(card).toContain('blur(25.2px) saturate(1.8) brightness(1.05)');
    expect(card).toContain('rgba(255, 255, 255, 0.486)');
    const grab = css.slice(css.indexOf('.lkdv-cd-grab {'), css.indexOf('.lkdv-cd-body'));
    expect(grab).toContain('height: 18px');
    expect(grab).toContain('width: 40px');
    expect(grab).toContain('height: 4px');
    expect(grab).toContain('rgba(23, 43, 36, 0.35)');
  });

  it('un volet ne défile pas en mode strict, sauf clavier ouvert', () => {
    expect(css).toMatch(/\.lkdv-cd\[data-strict='true'\] \.lkdv-drawer-pane\s*\{\s*overflow:\s*hidden !important/);
    expect(css).toMatch(/data-strict='true'\]\[data-keyboard='true'\] \.lkdv-drawer-pane\s*\{\s*overflow-y:\s*auto !important/);
  });

  it('n’emploie aucune couleur interdite ni ombre noire brute', () => {
    expect(css).not.toMatch(/#e4501c/i);
    expect(css).not.toMatch(/rgba\(0,\s*0,\s*0/);
  });
});

describe('Communauté — drawer Créer en étapes', () => {
  it('l’hôte ferme par poignée, glissement et Échap, sans voile ni croix', () => {
    const host = read('src/features/community/shell/CommunityCardDrawer.tsx');
    expect(host).toContain("event.key === 'Escape'");
    expect(host).toContain('lkdv-cd-grab');
    expect(host).not.toContain('backdrop');
    expect(host).not.toMatch(/aria-label="Fermer" onClick/);
  });

  it('la capsule est en icônes seules et la sous-capsule ne sert qu’à la Publication', () => {
    const sheet = read('src/features/community/create/CreateDrawer.tsx');
    expect(sheet).toContain("CREATE_KINDS[index]?.id === 'post'");
    expect(sheet).toContain('strict');
  });

  it('chaque formulaire passe par le cadre en étapes et ne contient ni select natif ni URL de couverture', () => {
    for (const name of ['Post', 'Story', 'Carnet', 'Sortie', 'Kit', 'Club']) {
      const source = read(`src/features/community/create/${name}CreateForm.tsx`);
      expect(source, name).toContain('<WizardFrame');
      expect(source, name).not.toContain('<select');
      expect(source, name).not.toContain('<Select');
      expect(source, name).not.toMatch(/Cover \(URL\)/);
      expect(source, name).toContain('zod');
    }
  });

  it('l’ancienne coquille modale des formulaires a disparu', () => {
    for (const path of [
      'src/features/community/create/CommunityFormDrawer.tsx',
      'src/features/community/create/EmbeddedFormContext.tsx',
      'src/features/community/create/form-fields.tsx',
      'src/features/community/feed/CommunityCreateDrawer.tsx',
    ]) {
      expect(existsSync(path), path).toBe(false);
    }
  });
});
