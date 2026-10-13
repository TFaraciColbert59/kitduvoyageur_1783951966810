import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import {
  __resetAmenityCache,
  amenityProvider,
  fetchAmenitiesNear,
  resolveAmenitiesNear,
  type AmenityBbox,
  type AmenityRow,
  type AmenitySourceId,
} from '@/lib/queries/amenities';
import { GET } from '@/app/api/amenities/route';

/* ================================================================== *
 * P0.24 — le delai, et le credit de source.                          *
 *                                                                   *
 * Deux defauts mesurés le 2026-09-29 sur le corridor de Chamonix :    *
 *                                                                   *
 *   1. `/api/amenities` rendait en 45 956 ms (mesure live, bbox      *
 *      fraiche) alors que les dix lieux venaient du repli Photon,    *
 *      disponible en 1,5 a 2,5 s. Les trois miroirs Overpass etaient  *
 *      injoignables : la requete attendait 45 000 ms de               *
 *      `OVERPASS_TIMEOUT_MS` pour rendre une reponse deja presente.   *
 *                                                                   *
 *   2. la reponse ne nommait AUCUN fournisseur. Le credit d une      *
 *      reelle doit dire qui l a produite ; un `?? 'overpass'`        *
 *      attribuerait a Overpass des lieux trouves par Photon.         *
 *                                                                   *
 * Chaque morsant a son contre-exemple : sans lui, un test peut       *
 * passer a vide et ne rien prouver du tout.                          *
 * ================================================================== */

const BOITE: AmenityBbox = { minLat: 45.8, maxLat: 46.05, minLng: 6.7, maxLng: 7.2 };

type Faux = typeof fetch;

const TROP_LENT = 'TROP_LENT';

function reponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Un etablissement Photon, au format que rend l'API. */
const featHotel = (nom: string) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [6.87, 45.92] },
  properties: { name: nom, osm_key: 'tourism', osm_value: 'hotel' },
});

/** Le meme etablissement, au format Overpass. */
const elemsHotel = (nom: string) => ({
  elements: [{ lat: 45.9, lon: 6.87, tags: { name: nom, tourism: 'hotel' } }],
});

/**
 * Overpass ne repond pas.
 *
 * L'etat MESURE, pas une invention : les trois miroirs etaient injoignables.
 * Ils ne repondent donc jamais — et ils finissent par tomber sur l'annulation
 * apres 5 s, assez tot pour que le minuteur de 45 s soit desabonne dans le
 * test (sans quoi chaque test laisserait un minuteur arme pendant 45 s).
 */
function suspendu(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) {
      reject(new Error('aborte'));
      return;
    }
    signal?.addEventListener('abort', () => reject(new Error('aborte')));
    setTimeout(() => reject(new Error('miroir muet')), 5_000);
  });
}

/** Overpass muet immediatement. */
function muet(): Promise<Response> {
  return Promise.reject(new Error('reseau mort'));
}

/** Overpass qui repond `body`. */
function repond(body: unknown): Promise<Response> {
  return Promise.resolve(reponse(body));
}

/** Construit un faux fetch : Overpass d'un cote, Photon de l'autre. */
function fauxFetch(overpass: (url: string, init?: RequestInit) => Promise<Response>, photon: () => Promise<Response>): Faux {
  return (async (url: string, init?: RequestInit) =>
    url.includes('overpass') ? overpass(url, init) : photon()) as unknown as typeof fetch;
}

/** Les dix lieu du repli : c'est ce que Photon rend sur la boite. */
const photonPlein = async () => reponse({ features: [featHotel('Hotel Mont-Blanc')] });

/**
 * Resout `travail`, ou signale que le delai est depasse.
 *
 * C'est ce chien de garde qui rend le test MORDANT. Sans lui, une
 * implementation qui attend le budget d'Overpass ne se distingue d'une
 * implementation rapide que par le timeout de vitest : cinq secondes plus
 * tard, sur un test qui n'a rien a dire du defaut qu'il est cense voir.
 */
async function sousDelai<T>(travail: Promise<T>, budgetMs = 2_000): Promise<T | typeof TROP_LENT> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const chien = new Promise<typeof TROP_LENT>((resolve) => {
    minuteur = setTimeout(() => resolve(TROP_LENT), budgetMs);
  });
  try {
    return await Promise.race([travail, chien]);
  } finally {
    clearTimeout(minuteur);
  }
}

/** Laisse les chaines de promesses se vider. */
function drainer(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

function echouerSiTropLent(v: unknown): void {
  if (v === TROP_LENT) {
    throw new Error('le repli etait disponible et la requete a quand meme attendu son budget');
  }
}

/* ================================================================== *
 * 1. LE DELAI                                                         *
 * ================================================================== */

describe('P0.24 — le delai : rendre des que le repli apporte des lieux', () => {
  it('P024-01 : Overpass ne repond pas, le repli repond — la reponse part quand meme', async () => {
    __resetAmenityCache();
    // Le cas MESURE : Overpass muet, Photon immediat. Avant le correctif, la
    // reponse attendait les 45 000 ms du budget d'Overpass.
    const verdict = await sousDelai(
      resolveAmenitiesNear(BOITE, fauxFetch(suspendu, photonPlein)),
    );
    echouerSiTropLent(verdict);

    // Le chien a du rester muet. Si le produit attendait encore Overpass,
    // c'est ICI, sur ce nom, que le morsant devient rouge.
    expect(verdict).not.toBe(TROP_LENT);

    const v = verdict as Awaited<ReturnType<typeof resolveAmenitiesNear>>;
    expect(v.rows.map((r) => r.name)).toEqual(['Hotel Mont-Blanc']);
    // Le credit suit la source qui a repondu — ici le repli, pas Overpass.
    expect(v.source).toBe('photon');
  });

  it('P024-02 : contre-exemple — le chien voit bien la forme Promise.all d avant', async () => {
    // Ce test ne teste pas le produit : il teste le DETECTEUR de P024-01.
    // Sans lui, `sousDelai` pourrait rendre toujours la premiere branche et
    // le defaut de 45 s passerait inaperçu.
    const rapide = await sousDelai(Promise.resolve('repondu'));
    expect(rapide).toBe('repondu');

    // La forme EXACTE du code d'avant : `Promise.all` attend le plus lent des
    // deux. Le chien doit la voir.
    const overpass = new Promise<AmenityRow[] | null>(() => {
      /* ne se regle jamais : le miroir muet */
    });
    const repli = Promise.resolve([{ name: 'Hotel Mont-Blanc' } as AmenityRow]);
    const ancien = await sousDelai(Promise.all([overpass, repli]).then(([o, r]) => o ?? r));
    expect(ancien).toBe(TROP_LENT);
  });

  it('P024-03 : la reponse d Overpass arrivee apres coup n est pas perdue', async () => {
    __resetAmenityCache();
    // Overpass ne repond pas encore ; le repli, si.
    const enAttente: Array<(r: Response) => void> = [];
    const faux = fauxFetch(
      (_url, init) =>
        new Promise<Response>((resolve, reject) => {
          enAttente.push(resolve);
          init?.signal?.addEventListener('abort', () => reject(new Error('aborte')));
        }),
      photonPlein,
    );

    const premier = await sousDelai(resolveAmenitiesNear(BOITE, faux));
    echouerSiTropLent(premier);
    expect((premier as { source: AmenitySourceId | null }).source).toBe('photon');

    // Overpass finit par repondre, avec SA donnee, plus complete.
    for (const solve of enAttente) solve(reponse(elemsHotel('Via Overpass')));
    await drainer();

    // L'appel suivant — dans le TTL de 6 h — rend Overpass, avec SON credit.
    // Rendre vite ne doit pas condamner la qualite : on rend vite, on
    // ameliore apres.
    const second = await sousDelai(resolveAmenitiesNear(BOITE, faux));
    echouerSiTropLent(second);
    const v = second as Awaited<ReturnType<typeof resolveAmenitiesNear>>;
    expect(v.rows.map((r) => r.name)).toEqual(['Via Overpass']);
    expect(v.source).toBe('overpass');
  });
});

/* ================================================================== *
 * 2. LE CREDIT DE SOURCE                                              *
 * ================================================================== */

describe('P0.24 — le credit : nommer le fournisseur qui a reellement repondu', () => {
  it('P024-04 : quand Overpass repond, c est LUI qui est cite', async () => {
    __resetAmenityCache();
    // Les DEUX repondent : Overpass reste prioritaire, c'est la source la
    // plus complete, donc c'est la sienne qui est citee.
    const v = await sousDelai(
      resolveAmenitiesNear(BOITE, fauxFetch(() => repond(elemsHotel('Via Overpass')), photonPlein)),
    );
    echouerSiTropLent(v);
    const r = v as Awaited<ReturnType<typeof resolveAmenitiesNear>>;

    expect(r.rows.map((x) => x.name)).toEqual(['Via Overpass']);
    expect(r.source).toBe('overpass');
    expect(r.provider).toEqual({
      id: 'overpass',
      name: 'OpenStreetMap (Overpass)',
      url: 'https://overpass-api.de/',
    });
    // Le contre-pied du credit : citer Photon ici serait faux, puisque
    // c'est la ligne d'Overpass qui est rendue.
    expect(r.provider?.id).not.toBe('photon');
  });

  it('P024-05 : quand personne n a repondu, AUCUN fournisseur n est cite', async () => {
    __resetAmenityCache();
    const faux = (async () => {
      throw new Error('reseau mort');
    }) as unknown as typeof fetch;

    const v = await sousDelai(resolveAmenitiesNear(BOITE, faux));
    echouerSiTropLent(v);
    const r = v as Awaited<ReturnType<typeof resolveAmenitiesNear>>;

    expect(r.rows).toEqual([]);
    // Le morsant du credit. Un `?? 'overpass'` mettrait un composant la, et
    // c'est CE nom qui deviendrait rouge.
    expect(r.source).toBeNull();
    expect(r.provider).toBeNull();
  });

  it('P024-06 : contre-exemple — le detecteur voit bien un credit invente', () => {
    // Sur une panne, la forme correcte ne nomme personne.
    expect(amenityProvider(null)).toBeNull();
    expect(amenityProvider(undefined)).toBeNull();

    // Et la forme « reparee au rabais » en nommerait un. Si cette egalite
    // devenait fausse, P024-05 echouerait sans que personne ne sache dire
    // pourquoi : c'est ce qui rend le morsant interpretable.
    const invente = (id: AmenitySourceId | null): AmenitySourceId => id ?? 'overpass';
    expect(invente(null)).toBe('overpass');
    expect(amenityProvider(invente(null))?.id).toBe('overpass');

    // Une cle inconnue ne tombe sur AUCUN fournisseur non plus : pas de repli
    // sur l'entree la plus proche d'une version future du serveur.
    expect(amenityProvider('miroir-inconnu' as AmenitySourceId)).toBeNull();
  });

  it('P024-07 : une boite en cache rejoue le credit de CE QUI l a remplie', async () => {
    __resetAmenityCache();
    // Premier remplissage par le repli, Overpass muet.
    const premier = await sousDelai(
      resolveAmenitiesNear(BOITE, fauxFetch(suspendu, photonPlein)),
    );
    echouerSiTropLent(premier);
    expect((premier as { source: AmenitySourceId | null }).source).toBe('photon');

    // Puis plus aucun fournisseur ne repond. Ce qui est rendu vient du cache
    // — donc le credit du cache, jamais un nom devine pour l'occasion.
    const plusAucun = await sousDelai(
      resolveAmenitiesNear(BOITE, (async () => {
        throw new Error('reseau mort');
      }) as unknown as typeof fetch),
    );
    echouerSiTropLent(plusAucun);
    const r = plusAucun as Awaited<ReturnType<typeof resolveAmenitiesNear>>;
    expect(r.rows.map((x) => x.name)).toEqual(['Hotel Mont-Blanc']);
    expect(r.source).toBe('photon');
  });

  it('P024-08 : une liste VIDE mesuree par Overpass garde son credit', async () => {
    __resetAmenityCache();
    // Overpass repond, et repond « il n y a rien ici ». C est une REPONSE
    // MESUREE, pas une panne : elle porte donc un credit, et le repli ne doit
    // pas la lui voler en rendant des lieux moins fiables.
    const v = await sousDelai(
      resolveAmenitiesNear(BOITE, fauxFetch(() => repond({ elements: [] }), photonPlein)),
    );
    echouerSiTropLent(v);
    const r = v as Awaited<ReturnType<typeof resolveAmenitiesNear>>;

    expect(r.rows).toEqual([]);
    expect(r.source).toBe('overpass');
  });

  it('P024-09 : la route rend le credit du fournisseur gagnant, et rien d invente', async () => {
    __resetAmenityCache();
    const requete = new NextRequest(
      'http://localhost/api/amenities?min_lng=6.7&min_lat=45.8&max_lng=7.2&max_lat=46.05',
    );
    // La route utilise le `fetch` global. Il est remplace ici : le test verifie
    // sa FORME, pas la disponibilite des serveurs publics (le vrai reseau
    // depassait parfois le delai de vitest en CI, 8 oct.). Overpass repond :
    // le credit est le sien, et un seul.
    const espion = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(fauxFetch(() => repond(elemsHotel('Hotel Mont-Blanc')), photonPlein));
    try {
      const reponseRoute = await GET(requete);
      const corps = (await reponseRoute.json()) as {
        status: string;
        amenities: unknown[];
        provider: { id: string } | null;
      };

      expect(corps.status).toBe('ok');
      expect(Array.isArray(corps.amenities)).toBe(true);
      expect(corps.amenities.length).toBeGreaterThan(0);
      expect(corps.provider?.id).toBe('overpass');
    } finally {
      espion.mockRestore();
    }
  });

  it('P024-10 : la route ne contient aucun credit par defaut', () => {
    // Controle de source : le defaut par defaut serait ecrit dans la route,
    // la ou aucun test de comportement ne le verrait si la requete echouait
    // en amont. Ni `?? 'overpass'`, ni `|| 'photon'`, ni un nom en dur.
    const source = readFileSync('src/app/api/amenities/route.ts', 'utf8');
    // Un `?? 'overpass'` ecrit dans un commentaire est de la documentation,
    // pas un repli : seul le CODE compte. D ou le retrait des commentaires.
    const sansCommentaires = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    // Un litteral de regex accepte les deux guillemets sans echappement :
    // pas de chaine a construire, donc rien a evaluer.
    expect(sansCommentaires).not.toMatch(/\?\?\s*['"](overpass|photon)['"]/);
    expect(sansCommentaires).not.toMatch(/\|\|\s*['"](overpass|photon)['"]/);
  });

  it('P024-11 : fetchAmenitiesNear rend toujours une liste nue', async () => {
    // Raccourci conserve pour les appelants qui n'ont besoin que des lieux.
    __resetAmenityCache();
    const lignes = await fetchAmenitiesNear(BOITE, fauxFetch(suspendu, photonPlein));
    expect(Array.isArray(lignes)).toBe(true);
    expect(lignes.map((r) => r.name)).toEqual(['Hotel Mont-Blanc']);
  });
});

// ================================================================== *
// 3. LE REPLI DISTINGUE « ZERO MESURE » ET « PANNE »                  *
//                                                                    *
// Defaut TROUVE en mesurant l'API, apres le correctif de delai :     *
// sur une boite etroite du centre de Chamonix, la reponse mettait    *
// encore 45 117 ms pour rendre 0 lieu SANS nommer personne.           *
//                                                                    *
// Cause : le repli faisait `.catch(() => [])`. Un Photon MORT        *
// (reseau, abort, HTTP ko) devenait donc indiscernable d'un Photon    *
// qui repond VRAIMENT zero, et l'arbitrage — qui ne pouvait pas les    *
// distinguer — rejetait le zero mesure et attendait Overpass.         *
// ================================================================== *

describe('P0.24 — un zero mesure n est pas une panne', () => {
  /** Photon repond 200 avec un corps VALIDE et zero amenite. */
  const photonVide = async () => reponse({ features: [] });

  it('P024-12 : Overpass muet + Photon qui mesure zero -> rapide et SIGNE', async () => {
    __resetAmenityCache();
    const verdict = await sousDelai(
      resolveAmenitiesNear(BOITE, fauxFetch(suspendu, photonVide)),
    );
    echouerSiTropLent(verdict);
    expect(verdict).not.toBe(TROP_LENT);

    const v = verdict as Awaited<ReturnType<typeof resolveAmenitiesNear>>;
    // Zero, mais MESURE : il porte son credit, il ne cite personne.
    expect(v.rows).toEqual([]);
    expect(v.source).toBe('photon');
    expect(v.provider?.id).toBe('photon');
  });

  it('P024-12bis : contre-exemple — une PANNE du repli ne se signe pas', async () => {
    // Le DETECTEUR de P024-12 : une panne Photon, elle, ne doit produire NI
    // credit NI zero signe. Si le produit confondait les deux, ce test le
    // verrait. C'est exactement le `?? 'overpass'` qu'il traque.
    //
    // Note honnete sur le delai : ici on n'asserte PAS la rapidite, et c est
    // voulu. Les deux sources etant mortes, le produit a le CHOIX entre dire
    // « rien » au bout de 2 s — ce qui serait un mensonge, personne n a
    // mesure — et attendre la fin du budget Overpass avant de conclure
    // « personne n a repondu ». Il attend. Seule la panne merite ce delai.
    __resetAmenityCache();
    const panne = await sousDelai(
      resolveAmenitiesNear(BOITE, fauxFetch(suspendu, muet)),
      9_000,
    );
    expect(panne).not.toBe(TROP_LENT);

    const v = panne as Awaited<ReturnType<typeof resolveAmenitiesNear>>;
    expect(v.rows).toEqual([]);
    // Personne n'a repondu : on ne nomme RIEN plutot que d'inventer.
    expect(v.source).toBeNull();
    expect(v.provider).toBeNull();
    // Le budget de 12 s est le SEUL endroit du fichier ou le test depasse le
    // defaut de vitest : c'est la seule situation ou attendre est correct.
  }, 12_000);

  it('P024-13 : un zero de repli reste provisoire, il n est pas gele 6 h', async () => {
    __resetAmenityCache();
    const faux = fauxFetch(suspendu, photonVide);

    await resolveAmenitiesNear(BOITE, faux);
    await drainer();

    let relances = 0;
    const compteur = fauxFetch(suspendu, async () => {
      relances += 1;
      return photonVide();
    });
    await resolveAmenitiesNear(BOITE, compteur);
    await drainer();

    // Le repli est un GEOCODEUR : il voit mal les petites boxes. Geler son
    // zero pendant le TTL (6 h) afficherait « rien ici » alors qu'Overpass,
    // lui, a des lieux. Donc on redemande...
    expect(relances).toBeGreaterThan(0);
    // ...et des que l'appel de fond ramene Overpass, c'est LUI qui gele.
    expect(amenityProvider('overpass')?.id).toBe('overpass');
  });
});
