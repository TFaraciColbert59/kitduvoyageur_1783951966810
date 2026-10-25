import { describe, it, expect } from 'vitest';
import { formatConversationTimestamp } from '@/features/messaging/lib/messagingUtils';

const NOW = Date.now();

describe('formatConversationTimestamp', () => {
  it('renvoie une chaîne vide pour une entrée vide', () => {
    expect(formatConversationTimestamp('')).toBe('');
    expect(formatConversationTimestamp('invalid-date')).toBe('');
  });

  it("affiche « à l'instant » pour moins d'une minute", () => {
    const iso = new Date(NOW - 30 * 1000).toISOString();
    expect(formatConversationTimestamp(iso)).toBe("à l'instant");
  });

  it("affiche « <n> min » pour moins d'une heure", () => {
    expect(formatConversationTimestamp(new Date(NOW - 5 * 60 * 1000).toISOString())).toBe(
      '5 min'
    );
    expect(formatConversationTimestamp(new Date(NOW - 59 * 60 * 1000).toISOString())).toBe(
      '59 min'
    );
  });

  it("affiche « HH:MM » pour aujourd'hui (au-delà d'une heure)", () => {
    const date = new Date(NOW - 2 * 60 * 60 * 1000);
    if (date.toDateString() === new Date(NOW).toDateString()) {
      expect(formatConversationTimestamp(date.toISOString())).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it('affiche « Hier » pour la veille', () => {
    const yesterday = new Date(NOW - 24 * 60 * 60 * 1000);
    if (yesterday.toDateString() !== new Date(NOW).toDateString()) {
      expect(formatConversationTimestamp(yesterday.toISOString())).toBe('Hier');
    }
  });

  it('affiche « <n> j » entre 1 et 6 jours', () => {
    const twoDays = new Date(NOW - 2 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(NOW - 24 * 60 * 60 * 1000);
    if (twoDays.toDateString() !== yesterday.toDateString()) {
      expect(formatConversationTimestamp(twoDays.toISOString())).toBe('2 j');
    }
  });

  it("affiche « <jour> <mois abrégé> » pour une date ancienne (≥ 7 jours)", () => {
    const old = new Date(NOW - 30 * 24 * 60 * 60 * 1000);
    expect(
      formatConversationTimestamp(old.toISOString())
    ).toMatch(/^\d{1,2} [a-zàâçéèêëîïôöùûüœ]+\.?$/i);
  });
});