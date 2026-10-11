// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PRIVACY_UPDATED_AT, privacySections } from '@/components/legal/PrivacyPolicySections';
import { aiEnabled } from '@/lib/ai/aiMode';
import { buildCompasAutofillSystem } from '@/lib/ai/features/compasAutofill';
import { AI_STEP_LABEL } from '@/features/compas/engine/aiNotice';
import { AI_SUGGESTION_PREFIX } from '@/features/compas/engine/advice';
import { originFact } from '@/features/compas/engine/travel';

/**
 * Politique de confidentialité (plan 2.10, 5.3) : dans le style du contrôle des sources de
 * données, chaque affirmation vérifiable est relue dans le code. On ne nomme pas un
 * destinataire que le code n'appelle pas, on n'oublie pas celui qu'il appelle, et chaque
 * durée ou garantie renvoie au fichier qui la tient.
 *
 * L'identité de l'éditeur (mentions légales, section 1 de la politique) n'est PAS ici : case
 * réservée à Tony, rien n'est inventé.
 */

const ROOT = path.resolve(__dirname, '../../../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

afterEach(cleanup);

function policy() {
  const { container } = render(
    <>
      {privacySections('lien').map((s) => (
        <section key={s.title} data-title={s.title}>
          <h2>{s.title}</h2>
          {s.body}
        </section>
      ))}
    </>
  );
  const text = (container.textContent ?? '').replace(/\s+/g, ' ');
  const section = (start: string) => {
    const el = Array.from(container.querySelectorAll('section')).find((s) => s.getAttribute('data-title')?.includes(start));
    if (!el) throw new Error(`Section introuvable : ${start}`);
    return (el.textContent ?? '').replace(/\s+/g, ' ');
  };
  return { text, section };
}

/** Destinataire nommé dans la politique → le code qui l'appelle (fichier relu et motif attendu). */
const CALLED: Array<{ named: string; file: string; pattern: RegExp }> = [
  { named: 'NVIDIA', file: 'src/lib/ai/providers/nvidia.ts', pattern: /integrate\.api\.nvidia\.com/ },
  { named: 'Google (Gemini)', file: 'src/app/api/materiel/scan/route.ts', pattern: /generativelanguage\.googleapis\.com/ },
  { named: 'Photon (komoot)', file: 'src/features/compas/server/placeLookup.ts', pattern: /photon\.komoot\.io/ },
  { named: 'LocationIQ', file: 'src/features/compas/server/locationIq.ts', pattern: /locationiq\.com/ },
  { named: 'Geoapify', file: 'src/features/compas/server/geoapify.ts', pattern: /api\.geoapify\.com/ },
  { named: 'Valhalla (FOSSGIS)', file: 'src/features/adventure-prep/routingService.ts', pattern: /valhalla1\.openstreetmap\.de/ },
  { named: 'Overpass (private.coffee)', file: 'src/features/compas/server/stagePoiLookup.ts', pattern: /overpass\.private\.coffee/ },
  { named: 'overpass-api.de', file: 'src/lib/queries/amenities.ts', pattern: /overpass-api\.de/ },
  { named: 'overpass-api.de', file: 'src/features/explorer-osm/adapters/overpassAdapter.ts', pattern: /overpass-api\.de/ },
  { named: 'Nominatim', file: 'src/features/compas/server/placeLookup.ts', pattern: /nominatim\.openstreetmap\.org\/(?:search|reverse)/ },
  { named: 'Nominatim', file: 'src/features/compas/server/officialAlerts.ts', pattern: /nominatim\.openstreetmap\.org\/reverse/ },
  { named: 'Esri (ArcGIS)', file: 'src/components/map/engine/createMapStyle.ts', pattern: /static-map-tiles-api\.arcgis\.com/ },
  { named: 'MET Norway', file: 'src/lib/weather/metnoRequest.ts', pattern: /api\.met\.no/ },
  { named: 'NASA POWER', file: 'src/features/compas/server/weather.ts', pattern: /power\.larc\.nasa\.gov/ },
  { named: 'Terrain Tiles', file: 'src/lib/geo/terrainElevation.ts', pattern: /elevation-tiles-prod/ },
  { named: 'RouteStack', file: 'src/features/booking/server/routeStackBookingProvider.ts', pattern: /mcp\.routestack\.ai/ },
  { named: 'Viator', file: 'src/features/discovery/providers/viator/viatorClient.ts', pattern: /api\.viator\.com/ },
  { named: 'hCaptcha', file: 'src/lib/captcha/hcaptcha.ts', pattern: /js\.hcaptcha\.com/ },
  { named: 'Google Analytics', file: 'src/components/GoogleAnalytics.tsx', pattern: /googletagmanager\.com/ },
  { named: 'unpkg', file: 'src/components/explorer/ExplorerMap.tsx', pattern: /unpkg\.com\/leaflet@/ },
];

describe('destinataires : chacun est réellement appelé par le code', () => {
  it.each(CALLED)('« $named » ↔ $file', ({ named, file, pattern }) => {
    expect(policy().section('Destinataires')).toContain(named);
    expect(read(file)).toMatch(pattern);
  });

  it('OpenRouter n’est plus nommé : la chaîne d’IA n’appelle que NVIDIA (décision du 7 oct.)', () => {
    expect(policy().text).not.toMatch(/OpenRouter/i);
    const chain = read('src/lib/ai/providers/index.ts');
    expect(chain).toContain('disponibles.push(nvidiaProvider)');
    expect(chain).not.toMatch(/disponibles\.push\(openrouterProvider\)/);
  });
});

describe('essai sans compte : la durée dite est celle de la purge', () => {
  it('7 jours sans utilisation, avec ses voyages', () => {
    expect(policy().section('Durées de conservation')).toContain('Essai sans compte : effacé avec ses voyages après 7 jours sans utilisation');
    const purge = read('supabase/migrations/20261008180000_anonymous_trial_purge.sql');
    expect(purge).toMatch(/p_inactive interval default interval '7 days'/);
    expect(purge).toMatch(/where u\.is_anonymous/);
    // Les voyages partent avec le compte : suppression de auth.users, cascades.
    expect(purge).toMatch(/delete from auth\.users where id = r\.id/);
  });
});

describe('profil voyageur : privé, et ce qui en sort est dit', () => {
  const traveller = () => policy().section('Données traitées');

  it('la politique le dit privé, hors voyages partagés et profils publics, et dans l’export', () => {
    const t = traveller();
    expect(t).toContain('Profil voyageur');
    expect(t).toMatch(/seul le compte concerné/);
    expect(t).toMatch(/ni dans un voyage partagé ni dans un profil public/);
    expect(t).toMatch(/export de vos données/);
  });

  it('base : lecture et écriture par la personne seule, aucun droit pour anon', () => {
    const sql = read('supabase/migrations/20261010100000_user_traveller.sql');
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect((sql.match(/user_id = \(select auth\.uid\(\)\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(sql).toMatch(/REVOKE ALL ON public\.user_traveller FROM anon/);
    expect(sql).not.toMatch(/TO (anon|public)\b(?!;?\s*\n--)/i);
    // Domicile rangé à 0,01° près, soit environ 1 km.
    expect(sql).toMatch(/home_lat\s+numeric\(4,2\)/);
    expect(traveller()).toContain('à environ 1 km près');
  });

  it('l’export de données de la personne contient la table', () => {
    expect(read('src/server/gdprExport.ts')).toMatch(/table: 'user_traveller'/);
  });

  it('à l’IA : seule l’indication « nationalité française » passe, jamais le domicile', () => {
    const t = traveller();
    expect(t).toMatch(/Rien de ce profil n’est envoyé à l’IA, sauf l’indication « nationalité française »/);
    // Le code : consigne différente pour un ressortissant français, rien d'autre du profil.
    expect(buildCompasAutofillSystem(true)).toContain('nationalite francaise');
    expect(buildCompasAutofillSystem(false)).not.toContain('nationalite francaise');
    expect(
      originFact({ name: 'Lyon', country: 'France', countryCode: 'FR', lat: 45.76, lon: 4.83, source: 'domicile' })
    ).toBe('domicile de la personne (ville non transmise)');
  });
});

describe('intelligence artificielle : ce qui est signalé, vérifié, éteignable', () => {
  const ai = () => policy().section('Intelligence artificielle');

  it('les quatre mentions de l’écran sont nommées, et elles existent dans le code', () => {
    const t = ai();
    for (const label of ['Compris par l’IA', AI_STEP_LABEL, 'Suggestion de l’IA', 'Rédigé par l’IA']) expect(t).toContain(label);
    expect(AI_SUGGESTION_PREFIX).toContain('Suggestion de l’IA');
    expect(read('src/features/compas/components/CompasDisLe.tsx')).toContain('Compris par l’IA');
    expect(read('src/features/compas/components/CompasSheets.tsx')).toContain('Rédigé par l’IA');
  });

  it('le niveau du verdict vient du moteur ; les lieux sont retrouvés sur la carte', () => {
    expect(ai()).toMatch(/niveau du verdict est calculé par le Compas, jamais par l’IA/);
    expect(read('src/features/compas/components/CompasSheets.tsx')).toMatch(/Le\s+niveau vient du moteur, pas de l’IA/);
  });

  it('l’interrupteur existe : IA éteinte, le Compas prépare par ses règles et n’en parle plus', () => {
    expect(ai()).toMatch(/Le site peut éteindre l’IA/);
    expect(aiEnabled({ AI_MODE: 'off' })).toBe(false);
    expect(aiEnabled({})).toBe(true);
  });

  it('la préparation reste annulable d’un geste', () => {
    expect(ai()).toContain('Annuler la préparation');
    expect(read('src/features/compas/components/CompasCards.tsx')).toContain('Annuler la préparation');
  });

  it('cite l’article 50 du règlement (UE) 2024/1689 sobrement : une inspiration, pas une déclaration de conformité', () => {
    const t = ai();
    expect(t).toMatch(/article 50 du règlement \(UE\) 2024\/1689/);
    expect(t).not.toMatch(/conform|certifi|garanti|se conforme/i);
  });
});

describe('date de mise à jour', () => {
  it('elle suit la dernière relecture', () => {
    expect(PRIVACY_UPDATED_AT).toBe('11 octobre 2026');
  });
});
