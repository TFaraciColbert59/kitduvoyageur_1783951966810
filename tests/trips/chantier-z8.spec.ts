import { describe, it, expect } from 'vitest';
import { COUNTRY_DETAILS, getCompleteCountryDetail } from '@/lib/countryDetails';
import { buildSafetyPrompt } from '@/lib/ai/country-content/generateSafetyCriticalBlock';

/**
 * CHANTIER Z8 — RECTIFICATIF DU RÉCIT
 *
 * Verrou narratif : aucun récit public (fallback de fiche pays, libellés d'outils,
 * prompt IA) ne doit affirmer des données « officielles », « vérifiées »,
 * « certifiées » ou une actualité en temps réel sans source réelle.
 */

const BANNED_RECIT_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /données officielles vérifiées/i, label: 'données officielles vérifiées' },
  { pattern: /données officielles(?! -)\b/i, label: 'données officielles (sans source)' },
  { pattern: /officielles certifiées/i, label: 'officielles certifiées' },
  { pattern: /recommandations.*selon les données officielles/i, label: 'vaccins selon données officielles' },
  { pattern: /générateur infaillible/i, label: 'générateur infaillible' },
  { pattern: /clé[s]? en main/i, label: 'clé en main' },
];

describe('CHANTIER Z8 — RECTIFICATIF DU RÉCIT', () => {
  it('Z-RECIT.1 : le fallback de fiche pays ne prétend plus « données officielles vérifiées »', () => {
    const detail = getCompleteCountryDetail('ZZ'); // pays non personnalisé → fallback auto-généré
    const subtitle = detail.subtitle || '';
    for (const { label } of BANNED_RECIT_PATTERNS) {
      expect(subtitle.toLowerCase()).not.toMatch(
        new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      );
    }
    expect(subtitle).toContain('Repères pratiques');
  });

  it('Z-RECIT.2 : le bloc sécurité d\'aucune fiche pays ne contient « absolu(e) » ou « quasi-nul(le) »', () => {
    for (const [code, detail] of Object.entries(COUNTRY_DETAILS)) {
      for (const c of detail?.securite?.conseils || []) {
        const text = `${c.titre} ${c.description}`.toLowerCase();
        expect(text, `Pays ${code}`).not.toMatch(/absolue?/);
        expect(text, `Pays ${code}`).not.toMatch(/quasi-null/i);
      }
    }
  });

  it('Z-RECIT.3 : le prompt du bloc sécurité critique n\'ordonne plus de consulter des données officielles d\'actualité', () => {
    const { system, prompt } = buildSafetyPrompt('formalites', 'France', 'FR', 2026);
    expect(system).not.toMatch(/réseignements officiels vérifiés et actuels/i);
    expect(system).toMatch(/aucun accès à des données officielles/i);
    expect(prompt).not.toMatch(/données officielles et d'actualité/i);
    expect(prompt).toMatch(/ne prétends jamais/i); // interdiction explicite
    expect(prompt).toMatch(/incertitude/i);         // obligation de marquer l'incertitude
  });
});