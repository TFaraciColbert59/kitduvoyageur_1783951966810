import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const mobileHub = readFileSync('src/features/hub/components/mobile/MobileAdventureHub.tsx', 'utf8');
const shell = readFileSync('src/features/hub/components/HubShell.tsx', 'utf8');
const edgeDrawer = readFileSync('src/features/hub/components/mobile/HubEdgeDrawer.tsx', 'utf8');
const sortieMenu = readFileSync('src/features/hub/components/menu/SortieMenu.tsx', 'utf8');
const liquidCss = readFileSync('src/features/hub/components/hub-liquid.css', 'utf8');

describe('Hub mobile — trois tiroirs cohérents', () => {
  it('place Points en haut, État au milieu et Cockpit en bas', () => {
    expect(mobileHub).toMatch(/kind="progression"\s+slot="top"/);
    expect(mobileHub).toMatch(/kind="status"\s+slot="mid"/);
    expect(shell).toMatch(/kind="cockpit"\s+slot="bottom"/);
  });

  it('construit le tiroir État avec le composant enrichi et ses données réelles', () => {
    expect(sortieMenu).toContain('<ActivityStateDrawer');
    expect(sortieMenu).toContain('checklistDone');
    expect(sortieMenu).toContain('packedPercent');
    expect(sortieMenu).toContain('pendingSafety');
    expect(sortieMenu).toContain('navigationDecision');
  });

  it('applique le même language de surface aux trois tiroirs', () => {
    expect(edgeDrawer).toContain('hub-edge-panel__body--${kind}');
    expect(liquidCss).toContain('.hub-edge-panel__body--status');
    expect(liquidCss).toContain('.hub-edge-panel__body--cockpit');
  });

  it('force la palette blanche et translucide dans le tiroir Points', () => {
    expect(liquidCss).toMatch(
      /\.hub-progression-drawer \.glass,[\s\S]*?--lkv-text-secondary: rgba\(255, 255, 255, 0\.72\)/
    );
    expect(liquidCss).toMatch(
      /\.hub-progression-drawer \.glass,[\s\S]*?--lkv-primary: #ffffff/
    );
  });

  it('retire le titre Cockpit répété dans le tiroir', () => {
    expect(liquidCss).toMatch(
      /\.hub-edge-panel__body--cockpit \.hub-content-material > header h2[\s\S]*?display: none/
    );
  });
});
