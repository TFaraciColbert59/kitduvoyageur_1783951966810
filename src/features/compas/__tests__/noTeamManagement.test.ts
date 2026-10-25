import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Règle fixe : `/hub` est la seule source de vérité pour le groupe, jamais d'interface parallèle de
 * gestion d'équipe (le Compas renvoie vers `/hub/groupe`). Le Compas lit l'équipe ; il n'invite pas,
 * ne change aucun rôle et ne retire personne.
 */
const ROOT = join(process.cwd(), 'src/features/compas');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === '__tests__' || name === 'dev') return [];
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const FILES = sources(ROOT);

describe('le Compas ne gère pas l’équipe', () => {
  it('aucune action serveur d’invitation, de rôle ni de retrait', () => {
    const banned = /compas(InviteMember|InviteLink|CancelInvitation|RestoreMember|SetMemberRole|RemoveMember|SearchPeople)Action/;
    const hits = FILES.filter((f) => banned.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('les actions du Compas n’écrivent ni invitation ni membre (hors réponse à une invitation reçue et Bouteille)', () => {
    const file = join(ROOT, 'server/compasActions.ts');
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/from\('trip_invitations'\)\s*\.\s*(insert|update|delete)/);
    expect(src).not.toMatch(/from\('trip_collaborators'\)\s*\.\s*(update|delete)/);
    expect(src).not.toMatch(/from\('trip_collaborators'\)\s*\.\s*insert/);
  });

  it('les écrans de l’équipe renvoient vers /hub/groupe', () => {
    const members = readFileSync(join(ROOT, 'components/CompasMembers.tsx'), 'utf8');
    const view = readFileSync(join(ROOT, 'engine/crewView.ts'), 'utf8');
    expect(view).toContain("HUB_GROUP_PATH = '/hub/groupe'");
    expect(members).toContain('HUB_GROUP_PATH');
  });
});
