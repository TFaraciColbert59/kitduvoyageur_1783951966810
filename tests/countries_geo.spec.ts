import { describe, it, expect } from 'vitest';
import { fetchCountries, fetchCountryByIso, fetchAllCountrySlugs } from '@/lib/geodata';
import { getCompleteCountryDetail } from '@/lib/countryDetails';
import { countryGeoToCountry } from '@/lib/countries';

describe('countries_geo Supabase Integration (195 Pays)', () => {
  it('should fetch all 195 countries from countries_geo', async () => {
    const countries = await fetchCountries();
    expect(countries).toBeDefined();
    expect(countries.length).toBe(195);

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
    expect(slugs.length).toBe(195);
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

  it('should handle complex language descriptions without crashing', async () => {
    const southAfrica = await fetchCountryByIso('ZA');
    expect(southAfrica).not.toBeNull();
    if (!southAfrica) return;

    expect(southAfrica.iso_a2).toBe('ZA');
    const detail = getCompleteCountryDetail('ZA', southAfrica);

    expect(detail.nom).toBe('Afrique du Sud');
    expect(detail.capitale).toBe(southAfrica.capital);
    expect(detail.fuseau).toBe('UTC+2');
    expect(detail.region).toBe('Afrique australe');
    expect(detail.superficie_court).toBe('1 219 912');
    expect(detail.superficie_detail).toBe('1 219 912 km²');
    expect(detail.monnaie_code).toBe('ZAR');
    expect(detail.monnaie_nom).toBe('Rand sud-africain');
    expect(detail.langue).toContain('11 langues officielles');
    // Ensure no NaN or undefined
    expect(detail.superficie_court).not.toContain('NaN');
    expect(detail.superficie_court).not.toContain('undefined');
  });

  it('should convert CountryGeo to Country model correctly', async () => {
    const andorra = await fetchCountryByIso('AD');
    expect(andorra).not.toBeNull();
    if (!andorra) return;

    const countryModel = countryGeoToCountry(andorra);
    expect(countryModel.code).toBe('AD');
    expect(countryModel.nom).toBe('Andorre');
    expect(countryModel.nom_en).toBe('Andorra');
    expect(countryModel.continent).toBe('Europe');
    expect(countryModel.subregion).toBe('Europe du Sud (Pyrénées)');
    expect(countryModel.capital).toBe('Andorre-la-Vieille');
    expect(countryModel.monnaie_code).toBe('EUR');
    expect(countryModel.timezone).toBe('UTC+1');

    const detail = getCompleteCountryDetail('AD', andorra);
    expect(detail.nom_en).toBe('Andorra');
    expect(detail.sources).toBeDefined();
    expect(detail.sources_list).toBeDefined();
    expect(detail.sources_list!.length).toBeGreaterThan(0);
    expect(detail.sources_list![0].url).toContain('http');
  });

  it('should handle NULL currency_code gracefully (PS — Palestine)', async () => {
    const ps = await fetchCountryByIso('PS');
    expect(ps).not.toBeNull();
    if (!ps) return;

    const detail = getCompleteCountryDetail('PS', ps);
    // Must not crash even if currency_code is null
    expect(detail.monnaie_code).toBeDefined();
    expect(String(detail.monnaie_code)).not.toBe('undefined');
    expect(String(detail.monnaie_code)).not.toContain('NaN');
    // Fictitious blocks must be absent
    expect(detail.meteo).toBeUndefined();
    expect(detail.securite).toBeUndefined();
    expect(detail.activites).toHaveLength(0);
    expect(detail.pratique.formalites).toHaveLength(0);
    expect(detail.pratique.sante).toHaveLength(0);
  });

  it('should handle single-element long-text languages array (ZA)', async () => {
    const za = await fetchCountryByIso('ZA');
    expect(za).not.toBeNull();
    if (!za) return;

    const detail = getCompleteCountryDetail('ZA', za);
    expect(detail.nom).toBe('Afrique du Sud');
    // languages may be a single element that is a long phrase
    expect(detail.langue).toBeTruthy();
    expect(detail.langue.length).toBeGreaterThan(5);
    // Fictitious blocks absent
    expect(detail.meteo).toBeUndefined();
    expect(detail.securite).toBeUndefined();
    expect(detail.pratique.formalites).toHaveLength(0);
    expect(detail.pratique.sante).toHaveLength(0);
    expect(detail.activites).toHaveLength(0);
  });

  it('should display only real BDD data for DE with no fictitious fields', async () => {
    const de = await fetchCountryByIso('DE');
    expect(de).not.toBeNull();
    if (!de) return;

    const detail = getCompleteCountryDetail('DE', de);
    expect(detail.nom).toBe('Allemagne');
    expect(detail.capitale).toBe('Berlin');
    expect(detail.fuseau).toBe('UTC+1');
    expect(detail.continent).toBe('Europe');
    expect(detail.monnaie_code).toBe('EUR');
    // Fictitious blocks must be absent
    expect(detail.meteo).toBeUndefined();
    expect(detail.securite).toBeUndefined();
    expect(detail.pratique.formalites).toHaveLength(0);
    expect(detail.pratique.sante).toHaveLength(0);
    expect(detail.pratique.transport).toHaveLength(1); // only timezone
    expect(detail.pratique.transport[0].cle).toBe('Fuseau horaire');
    expect(detail.pratique.budget).toHaveLength(2);   // monnaie + code
    expect(detail.activites).toHaveLength(0);
    expect(detail.gastronomie).toHaveLength(0);
  });
});
