/**
 * F10 — « Enregistrer mon aventure » cree l'activite en base, puis oriente le
 * hub VERS CETTE activite.
 *
 * Ce que la checklist demande tient en une chaine, et c'est cette chaine que
 * le test parcourt : le vrai `saveAdventure` -> la VRAIE route de commit -> les
 * VRAIES lignes ecrites -> le VRAI cookie d'aventure active que le hub relit
 * ensuite. Aucun maillon n'est simule, pas meme le schema zod du cookie, sa
 * serialisation base64url ou sa relecture.
 *
 * Deux entrees seulement sont doublurees, parce qu'elles sont exterieures au
 * produit : le client Postgres (on observe ce que la route lui demande, ligne
 * par ligne) et le magasin de cookies de la requete. Le produit, lui, reste
 * entierement reel : c'est lui qui calcule la valeur du cookie.
 *
 * Regle de preuve : deux morsants.
 *   1. On retire l'appel a l'orientation -> le test 01 tombe : le hub garde
 *      l'aventure d'avant, alors que la ligne, elle, existe.
 *   2. On remplace le titre calcule par un libelle fige -> le test 02 tombe :
 *      le cookie n'affiche plus la ligne qu'il pointe.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { fullDraft } from './fixtures';
import { buildItinerary } from '../engine/itinerary';
import { tripTitle } from '../tripCommit';
import {
  ACTIVE_ADVENTURE_COOKIE,
  deserializeActiveAdventure,
} from '@/features/hub/context/adventureSchema';
import { getActiveAdventure } from '@/features/hub/context/activeAdventureServer';
import { POST } from '@/app/api/adventure/commit/route';
import {
  COMMIT_ENDPOINT,
  HUB_HREF,
  activateSavedAdventure,
  saveAdventure,
  type SaveAdventureDeps,
  type SaveOutcome,
} from '../saveAdventure';
import type { AdventurePrepDraft } from '../types';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  enforceRateLimit: vi.fn(),
  emitEvent: vi.fn(),
  revalidatePath: vi.fn(),
  cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/rate-limit/routes', () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock('@/lib/events/eventBus', () => ({ emitEvent: mocks.emitEvent }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
// Le magasin de cookies de la requete : c'est la seule chose que le framework
// tient, pas le produit. Le cookie est donc enregistre TEL QUE le produit
// l'a calcule, puis relu par la vraie fonction du hub.
vi.mock('next/headers', () => ({
  cookies: async () => mocks.cookies,
  headers: async () => new Headers(),
}));

const USER_ID = 'user-tony';
type Ligne = Record<string, unknown>;
type Tables = 'trips' | 'trip_steps' | 'trip_collaborators';

const etat: Record<Tables, Ligne[]> = { trips: [], trip_steps: [], trip_collaborators: [] };
/** Table dont l'insertion echoue : sert a prouver l'annulation complete. */
let tableEnPanne: Tables | null = null;
let compteurTrip = 0;
let session: { id: string } | null = { id: USER_ID };
/** Ce que le hub avait en memoire AVANT l'enregistrement. */
type Aventure = { nature: 'sortie'; id: string; slug: string; title: string };
let aventureAvant: Aventure | null = null;

interface ReponseBdd {
  data: unknown;
  error: unknown;
}

/**
 * Client Postgres en doubles : la chaine `.from().select().eq()` est rejouee
 * telle quelle par la route, et chaque filtre compte. Une chaine awaitee deux
 * fois ecouvrirait ses propres traces, donc une seule execution par await.
 */
class Chaine implements PromiseLike<ReponseBdd> {
  private operation: 'lecture' | 'insertion' | 'suppression' = 'lecture';
  private colonnes: string | null = null;
  private charge: unknown = null;
  private readonly filtres: Array<[string, unknown]> = [];

  constructor(private readonly table: Tables) {}

  select(colonnes: string): this {
    this.colonnes = colonnes;
    return this;
  }

  eq(colonne: string, valeur: unknown): this {
    this.filtres.push([colonne, valeur]);
    return this;
  }

  insert(charge: unknown): this {
    this.operation = 'insertion';
    this.charge = charge;
    return this;
  }

  delete(): this {
    this.operation = 'suppression';
    return this;
  }

  async single(): Promise<ReponseBdd> {
    const resultat = this.executer();
    if (resultat.error !== null) return resultat;
    const data = Array.isArray(resultat.data) ? resultat.data[0] : resultat.data;
    return { data: data ?? null, error: null };
  }

  async maybeSingle(): Promise<ReponseBdd> {
    return this.single();
  }

  then<TResult1 = ReponseBdd, TResult2 = never>(
    onfulfilled?: ((valeur: ReponseBdd) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((raison: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.executer()).then(onfulfilled, onrejected);
  }

  private correspond(ligne: Ligne): boolean {
    return this.filtres.every(([colonne, valeur]) => ligne[colonne] === valeur);
  }

  private projeter(lignes: Ligne[]): Ligne[] {
    if (!this.colonnes) return lignes;
    const demandees = this.colonnes.split(',').map((colonne) => colonne.trim());
    return lignes.map((ligne) => {
      const projet: Ligne = {};
      for (const colonne of demandees) projet[colonne] = ligne[colonne] ?? null;
      return projet;
    });
  }

  private executer(): ReponseBdd {
    const lignes = etat[this.table];

    if (this.operation === 'insertion') {
      if (tableEnPanne === this.table) {
        return { data: null, error: { message: `table ${this.table} indisponible` } };
      }
      const entrantes = (Array.isArray(this.charge) ? this.charge : [this.charge]) as Ligne[];
      // Comme la base reelle : la policy d'insertion de `trip_collaborators`
      // refuse le role `owner` a tout client (anti-escalade).
      if (this.table === 'trip_collaborators' && entrantes.some((ligne) => ligne.role === 'owner')) {
        return {
          data: null,
          error: { code: '42501', message: 'new row violates row-level security policy for table "trip_collaborators"' },
        };
      }
      const enregistrees = entrantes.map((ligne) => {
        // La cle primaire est attribuee par la base, pas par le produit :
        // c'est elle que le cookie doit reporter, fidelement.
        const complete: Ligne =
          this.table === 'trips' && !ligne.id
            ? { ...ligne, id: `trip_${(compteurTrip += 1)}` }
            : { ...ligne };
        lignes.push(complete);
        // Trigger `trg_trips_insert_owner` (SECURITY DEFINER) : la ligne owner
        // est posee par la base, pas par la route.
        if (this.table === 'trips') {
          etat.trip_collaborators.push({ trip_id: complete.id, user_id: complete.user_id, role: 'owner' });
        }
        return complete;
      });
      return { data: this.projeter(enregistrees), error: null };
    }

    if (this.operation === 'suppression') {
      const restantes = lignes.filter((ligne) => !this.correspond(ligne));
      const supprimes = new Set(lignes.filter((ligne) => this.correspond(ligne)).map((ligne) => ligne.id));
      etat[this.table] = restantes;
      // ON DELETE CASCADE sur `trip_steps` et `trip_collaborators`.
      if (this.table === 'trips') {
        etat.trip_steps = etat.trip_steps.filter((ligne) => !supprimes.has(ligne.trip_id));
        etat.trip_collaborators = etat.trip_collaborators.filter((ligne) => !supprimes.has(ligne.trip_id));
      }
      return { data: lignes.length - restantes.length, error: null };
    }

    return {
      data: this.projeter(lignes.filter((ligne) => this.correspond(ligne))),
      error: null,
    };
  }
}

/** Cookie httpOnly : valeur brute + options, comme le ferait la plateforme. */
const cookiesEcrits = new Map<string, { valeur: string; options: Record<string, unknown> }>();

function brancherCookies(): void {
  mocks.cookies.set.mockImplementation(
    (nom: string, valeur: string, options: Record<string, unknown>) => {
      cookiesEcrits.set(nom, { valeur, options });
    },
  );
  mocks.cookies.get.mockImplementation((nom: string) =>
    cookiesEcrits.has(nom) ? { name: nom, value: cookiesEcrits.get(nom)?.valeur } : undefined,
  );
  mocks.cookies.delete.mockImplementation((nom: string) => {
    cookiesEcrits.delete(nom);
  });
}

/** Pose le cookie comme le hub le trouve au demarrage. */
function oublierAventureActive(): void {
  aventureAvant = { nature: 'sortie', id: 'trip_avant', slug: 'sejour-en-valais', title: 'Valais' };
  cookiesEcrits.set(ACTIVE_ADVENTURE_COOKIE, {
    valeur: Buffer.from(JSON.stringify(aventureAvant), 'utf-8').toString('base64url'),
    options: { httpOnly: true },
  });
}

/** Le bouton reel, poste vers la VRAIE route de commit. */
function boutonEnregistrer(): { urls: string[]; deps: SaveAdventureDeps } {
  const urls: string[] = [];
  return {
    urls,
    deps: {
      post: (url, body) => {
        urls.push(url);
        return POST(
          new NextRequest(`http://localhost:3000${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
        );
      },
    },
  };
}

/** Brouillon complet, itineraire compris : le commit doit ecrire des etapes. */
function brouillon(overrides: Partial<AdventurePrepDraft> = {}): AdventurePrepDraft {
  const base = fullDraft(overrides);
  return { ...base, itinerary: buildItinerary(base) };
}

/** La ligne que la base a reellement ecrite, pas une reconstruction. */
function ligneCreee(slug: string): Ligne {
  const ligne = etat.trips.find((candidat) => candidat.slug === slug);
  if (!ligne) throw new Error(`aucune ligne trips pour le slug ${slug}`);
  return ligne;
}

beforeEach(() => {
  vi.clearAllMocks();
  etat.trips.length = 0;
  etat.trip_steps.length = 0;
  etat.trip_collaborators.length = 0;
  cookiesEcrits.clear();
  tableEnPanne = null;
  compteurTrip = 0;
  session = { id: USER_ID };
  aventureAvant = null;
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.emitEvent.mockResolvedValue(undefined);
  mocks.createClient.mockImplementation(() => ({
    auth: { getUser: async () => ({ data: { user: session } }) },
    from: (nom: string) => {
      if (!(nom in etat)) throw new Error(`table inattendue : ${nom}`);
      return new Chaine(nom as Tables);
    },
  }));
  brancherCookies();
});

describe('F10 — le flux complet : ecriture reelle, puis hub sur CETTE aventure', () => {
  it('01 : ecrit les lignes ET oriente le hub vers la nouvelle, pas vers l ancienne', async () => {
    // Un voyage deja present du meme personne : le slug doit donc etre
    // uniquifie, sinon le hub n'aurait aucun moyen de distinguer les deux.
    etat.trips.push({
      id: 'trip_ancien',
      user_id: USER_ID,
      slug: 'chamonix-argentiere',
      title: 'Ancienne',
    });
    oublierAventureActive();
    etat.trips[0].slug = 'sejour-en-valais';
    etat.trips[0].title = 'Valais';

    const draft = brouillon();
    const { urls, deps } = boutonEnregistrer();
    const outcome = await saveAdventure(draft, deps);

    expect(outcome.status).toBe('saved');
    expect(urls).toEqual([COMMIT_ENDPOINT]);
    if (outcome.status !== 'saved') throw new Error('sortie de type');

    // 1. La BASE a recu la ligne, avec un slug qui ne peut pas collided.
    const slug = outcome.slug;
    expect(slug).not.toBeNull();
    if (slug === null) throw new Error('slug absent');
    const creee = ligneCreee(slug);
    expect(creee.id).toBe(outcome.tripId);
    expect(creee.id).not.toBe('trip_ancien');
    expect(creee.title).toBe(tripTitle(draft));
    expect(etat.trips).toHaveLength(2);

    // 2. Le parcours et la propriete suivent la ligne, pas l'inverse.
    expect(etat.trip_steps.length).toBeGreaterThan(0);
    for (const step of etat.trip_steps) expect(step.trip_id).toBe(outcome.tripId);
    expect(etat.trip_collaborators).toEqual([
      { trip_id: outcome.tripId, user_id: USER_ID, role: 'owner' },
    ]);

    // 3. Le HUB, lui, lit le cookie : il doit y trouver CETTE ligne.
    const active = await getActiveAdventure();
    expect(active).toEqual({
      nature: 'sortie',
      id: outcome.tripId,
      slug,
      title: tripTitle(draft),
    });
      if (active === null || active.nature !== 'sortie') throw new Error('aventure active hors nature sortie');
    expect(active?.id).not.toBe(aventureAvant?.id);
    // Le slug du cookie doit resoudre vers la ligne qu'il designe.
    expect(etat.trips.find((ligne) => ligne.slug === active?.slug)?.id).toBe(active?.id);

    // 4. Le rendu serveur du hub est invalide, sinon il afficherait l'ancien.
    expect(mocks.revalidatePath).toHaveBeenCalledWith(HUB_HREF, 'layout');
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'trip.created', entity_id: outcome.tripId }),
    );
  });

  it('02 : le titre du cookie est celui de la ligne ecrite, pas un libelle a cote', async () => {
    const draft = brouillon({ coverName: 'Traversée des Écrins' });
    const { deps } = boutonEnregistrer();
    const outcome = await saveAdventure(draft, deps);

    expect(outcome.status).toBe('saved');
    if (outcome.status !== 'saved' || outcome.slug === null) throw new Error('sortie de type');

    const ecrite = ligneCreee(outcome.slug);
    const active = await getActiveAdventure();
    expect(ecrite.title).toBe('Traversée des Écrins');
      if (active === null || active.nature !== 'sortie') throw new Error('aventure active hors nature sortie');
    expect(active?.title).toBe(ecrite.title);
    expect(active?.title).toBe(tripTitle(draft));
  });

  it('03 : le cookie est un jeton httpOnly relisible par le hub, sans champ invente', async () => {
    const { deps } = boutonEnregistrer();
    const draft = brouillon();
    await saveAdventure(draft, deps);

    const ecrit = cookiesEcrits.get(ACTIVE_ADVENTURE_COOKIE);
    expect(ecrit).toBeDefined();
    // La forme reelle du hub : la meme deserialisation, sur la valeur brute.
    expect(deserializeActiveAdventure(ecrit?.valeur)).toEqual(await getActiveAdventure());
    expect(JSON.parse(Buffer.from(ecrit?.valeur ?? '', 'base64url').toString('utf-8'))).toEqual({
      nature: 'sortie',
      id: expect.any(String),
      slug: expect.any(String),
      title: expect.any(String),
    });
    expect(ecrit?.options).toMatchObject({ httpOnly: true, path: '/', sameSite: 'lax' });
  });

  it('04 : sans session, rien n est ecrit et l aventure active ne bouge pas', async () => {
    session = null;
    oublierAventureActive();

    const { deps } = boutonEnregistrer();
    const draft = brouillon();
    const outcome = await saveAdventure(draft, deps);

    expect(outcome.status).toBe('rejected');
    expect(etat.trips).toEqual([]);
    expect(etat.trip_steps).toEqual([]);
    expect(etat.trip_collaborators).toEqual([]);
    // Le hub ne doit surtout pas sauter sur une aventure qui n'existe pas.
    expect(await getActiveAdventure()).toEqual(aventureAvant);
  });

  it('05 : un echec d ecriture annule tout et ne pointe pas un voyage supprime', async () => {
    tableEnPanne = 'trip_steps';
    const { deps } = boutonEnregistrer();
    const draft = brouillon();
    const outcome = await saveAdventure(draft, deps);

    expect(outcome.status).toBe('failed');
    // La route a bien joue son retour arriere : aucune ligne fantome.
    expect(etat.trips).toEqual([]);
    expect(etat.trip_collaborators).toEqual([]);
    expect(await getActiveAdventure()).toBeNull();
  });

  it('06 : un cookie pose sans adresse n est jamais accepte comme une orientation', async () => {
    const issue = vi.fn();
    const { deps } = boutonEnregistrer();
    const draft = brouillon();
    const outcome: SaveOutcome = { status: 'saved', tripId: 'trip_1', slug: null };

    const oriente = await activateSavedAdventure(draft, outcome, {
      ...deps,
      onActivationIssue: issue,
    });

    expect(oriente).toBe(false);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(await getActiveAdventure()).toBeNull();
  });

  it('07 : un refus ou une panne n active jamais quoi que ce soit', async () => {
    const activate = vi.fn(async () => ({ success: true }));
    const { deps } = boutonEnregistrer();
    const refus: SaveOutcome[] = [
      { status: 'rejected', message: 'manque une date' },
      { status: 'failed', message: 'hors ligne' },
    ];

    const draft = brouillon();
    for (const outcome of refus) {
      const oriente = await activateSavedAdventure(draft, outcome, { ...deps, activate });
      expect(oriente).toBe(false);
    }
    expect(activate).not.toHaveBeenCalled();
    expect(await getActiveAdventure()).toBeNull();
  });

  it('08 : si l orientation echoue, le voyage reste enregistre et l echec est dit', async () => {
    const issues: string[] = [];
    const { deps } = boutonEnregistrer();
    const refuse = vi.fn(async () => ({ success: false }));

    const premier = brouillon();
    const refuseOutcome = await saveAdventure(premier, { ...deps, activate: refuse });
    expect(refuseOutcome.status).toBe('saved');
    expect(issues).toHaveLength(0);

    // L'action serveur qui leve ne doit surtout pas transformer un voyage
    // enregistre en « echec » : l'utilisateur verrait un faux probleme.
    const leve = vi.fn(async () => {
      throw new Error('cookies() hors requete');
    });
    const second = brouillon();
    const outcome = await saveAdventure(second, {
      ...deps,
      activate: leve,
      onActivationIssue: (issue) => issues.push(issue),
    });
    expect(outcome.status).toBe('saved');
    expect(refuse).toHaveBeenCalledTimes(1);
    expect(leve).toHaveBeenCalledTimes(1);
    // Le refus du premier essai n'a pas de rapporteur : rien a dire.
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/hub/i);
    // Et la ligne, elle, est bien la.
    if (outcome.status !== 'saved' || outcome.slug === null) throw new Error('sortie de type');
    expect(ligneCreee(outcome.slug).id).toBe(outcome.tripId);
  });
});
