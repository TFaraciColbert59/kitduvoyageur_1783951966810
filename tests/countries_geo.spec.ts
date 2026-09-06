import { describe, it, expect } from 'vitest';
import { fetchCountries, fetchCountryByIso, fetchCountryContentByIso, fetchAllCountrySlugs } from '@/lib/geodata';
import { getCompleteCountryDetail } from '@/lib/countryDetails';
import { countryGeoToCountry } from '@/lib/countries';

describe('countries_geo & countries_content Supabase Integration (195 Pays)', () => {
  it('should fetch all 195 countries from countries_geo', async () => {
    const countries = await fetchCountries();
    expect(countries).toBeDefined();
    expect(countries.length).toBeGreaterThanOrEqual(195);

    // Verify first country has required non-null attributes
    const first = countries[0];
    expect(first.iso_a2).toBeDefined();
    expect(first.name).toBeDefined();
    expect(first.continent).toBeDefined();
    expect(first.capital).toBeDefined();
    expect(first.timezone).toBeDefined();
    expect(first.subregion).toBeDefined();
  });

  it('should fetch all 195 country slugs for static generation', async () => {
    const slugs = await fetchAllCountrySlugs();
    expect(slugs.length).toBeGreaterThanOrEqual(195);
    // Every slug should be 2 lowercase letters
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z]{2}$/);
    }
  });

  it('should fetch single country by ISO code and format correctly', async () => {
    const afghanistan = await fetchCountryByIso('AF');
    expect(afghanistan).not.toBeNull();
    if (!afghanistan) return;

    expect(afghanistan.iso_a2).toBe('AF');
    expect(afghanistan.iso_a3).toBe('AFG');
    expect(afghanistan.name).toBe('Afghanistan');
    expect(afghanistan.capital).toBe('Kaboul');
    expect(afghanistan.continent).toBe('Asie');
    expect(afghanistan.subregion).toBe('Asie du Sud');
    expect(afghanistan.timezone).toBe('UTC+4:30');
    expect(afghanistan.area_km2).toBe(652860);
    expect(afghanistan.currency_code).toBe('AFN');
    expect(afghanistan.currency_name).toBe('Afghani');
    expect(afghanistan.languages).toContain('Dari');
    expect(afghanistan.languages).toContain('Pachto');

    // Voluntarily emptied fields should be null/empty
    expect(afghanistan.population).toBeNull();
    expect(afghanistan.geometry).toBeNull();
  });

  it('should fetch country_content for DE and AF with all 7 sheets fields populated', async () => {
    const [deContent, afContent] = await Promise.all([
      fetchCountryContentByIso('DE'),
      fetchCountryContentByIso('AF'),
    ]);

    expect(deContent).not.toBeNull();
    expect(deContent?.country_iso_a2).toBe('DE');
    expect(deContent?.pratique_voyage.visa_requis_fr).toBeDefined();
    expect(deContent?.transport.aeroport_principal).toContain('Francfort');
    expect(deContent?.connectivite.voltage).toContain('230V');
    expect(deContent?.culture.phrases_utiles).toContain('Guten Tag');
    expect(deContent?.budget.prix_repas_moyen).toBeDefined();
    expect(deContent?.outdoor.parcs_nationaux).toBeDefined();

    expect(afContent).not.toBeNull();
    expect(afContent?.country_iso_a2).toBe('AF');
    expect(afContent?.transport.code_iata).toBe('KBL');
    expect(afContent?.connectivite.voltage).toContain('220V');
  });

  it('should populate rich real data in CountryDetail when contentCountry is provided', async () => {
    const [deGeo, deContent] = await Promise.all([
      fetchCountryByIso('DE'),
      fetchCountryContentByIso('DE'),
    ]);

    expect(deGeo).not.toBeNull();
    const detail = getCompleteCountryDetail('DE', deGeo, deContent);

    expect(detail.nom).toBe('Allemagne');
    expect(detail.capitale).toBe('Berlin');
    expect(detail.fuseau).toBe('UTC+1');
    expect(detail.pratique.formalites.length).toBeGreaterThan(0);
    expect(detail.pratique.transport.length).toBeGreaterThan(1);
    expect(detail.pratique.budget.length).toBeGreaterThan(2);
    expect(detail.pratique.electricite_reseau?.length).toBeGreaterThan(0);
    expect(detail.pratique.climat?.length).toBeGreaterThan(0);
    expect(detail.culture.faits.length).toBeGreaterThan(0);
    expect(detail.gastronomie.length).toBeGreaterThan(0);
    expect(detail.activites.length).toBeGreaterThan(0);
  });

  it('should handle NULL currency_code gracefully (PS — Palestine)', async () => {
    const ps = await fetchCountryByIso('PS');
    expect(ps).not.toBeNull();
    if (!ps) return;

    const detail = getCompleteCountryDetail('PS', ps, null);
    // Must not crash even if currency_code is null
    expect(detail.monnaie_code).toBeDefined();
    expect(String(detail.monnaie_code)).not.toBe('undefined');
    expect(String(detail.monnaie_code)).not.toContain('NaN');
  });
});

