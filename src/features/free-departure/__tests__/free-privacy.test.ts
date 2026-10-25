import { describe, expect, it } from 'vitest';
import { privacyRows, sharingBlockedReason } from '../engine/privacy';

function rows(overrides: Partial<Parameters<typeof privacyRows>[0]> = {}) {
  return privacyRows({ keepTrace: true, shareWithGroup: false, groupSize: 0, ...overrides });
}

function row(id: 'trace' | 'partage', overrides: Partial<Parameters<typeof privacyRows>[0]> = {}) {
  const found = rows(overrides).find((item) => item.id === id);
  if (!found) throw new Error(`ligne ${id} absente`);
  return found;
}

describe('privacy — le partage reste sous le controle de l’utilisateur', () => {
  it('FREE-P01: la trace se garde d’un geste, et reste privee', () => {
    const trace = row('trace');
    expect(trace.label).toBe('Garder la trace');
    expect(trace.checked).toBe(true);
    expect(trace.hint).toBe('Visible par toi seul');
    expect(trace.disabled).toBe(false);
  });

  it('FREE-P02: une trace non conservee est dite comme telle, pas masquee', () => {
    const trace = row('trace', { keepTrace: false });
    expect(trace.checked).toBe(false);
    expect(trace.hint).toBe('Effacée à la fermeture de la session');
  });

  it('FREE-P03: hors groupe, le partage est indisponible ET explique pourquoi', () => {
    const share = row('partage');
    expect(share.disabled).toBe(true);
    expect(share.checked).toBe(false);
    expect(share.blockedReason).toContain('individuelle');
  });

  it('FREE-P04: un partage actif est Impossible sans trace conservee', () => {
    const reason = sharingBlockedReason({ keepTrace: false, shareWithGroup: true, groupSize: 4 });
    expect(reason).toContain('trace');
    expect(row('partage', { keepTrace: false, groupSize: 4 }).disabled).toBe(true);
  });

  it('FREE-P05: un partage demande alors qu’il est bloque retombe a « non partage »', () => {
    expect(row('partage', { keepTrace: false, shareWithGroup: true, groupSize: 4 }).checked).toBe(false);
    expect(row('partage', { shareWithGroup: true, groupSize: 0 }).checked).toBe(false);
  });

  it('FREE-P06: avec un groupe et une trace, le partage devient possible', () => {
    const share = row('partage', { groupSize: 3, shareWithGroup: true });
    expect(share.disabled).toBe(false);
    expect(share.checked).toBe(true);
    expect(share.hint).toContain('3');
  });

  it('FREE-P07: par defaut, rien n’est envoyé et l’ecran le dit', () => {
    const share = row('partage');
    expect(share.hint).toContain('Désactivé');
    expect(share.hint).toContain('sans ton accord');
  });

  it('FREE-P08: la ligne bloque nomme sa raison ET le refus de non-partage', () => {
    const share = row('partage');
    expect(share.hint).toContain('Désactivé');
    expect(share.blockedReason).not.toBeNull();
  });

  it('FREE-P09: une taille de groupe negative ou fractionnaire ne fabrique pas un groupe', () => {
    expect(sharingBlockedReason({ keepTrace: true, shareWithGroup: true, groupSize: -3 })).not.toBeNull();
    expect(sharingBlockedReason({ keepTrace: true, shareWithGroup: true, groupSize: 0.4 })).not.toBeNull();
  });

  it('FREE-P10: ne renvoie que les deux lignes attendues, dans l’ordre', () => {
    expect(rows().map((item) => item.id)).toEqual(['trace', 'partage']);
  });
});
