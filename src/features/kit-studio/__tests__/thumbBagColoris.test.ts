// Vignettes des corps LKDV ONE : elles prennent le coloris de la carte, avec la teinte de la scène
// (décision du 09/11/2026). Le master mis en cache sert aussi aux autres cartes : il ne doit jamais
// être retouché, et choisir un coloris ne doit rien retélécharger.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Color, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three';
import type { Material, Object3D } from 'three';
import { COLORWAYS } from '../domain/catalog';
import { resolveMaterial } from '../domain/palette';
import { ResourceTracker } from '../scene/resources';
import { bagThumb, colorwayThumb } from '../scene/thumbSpecs';
import type { BagThumbSpec, ThumbBuilder, ThumbResources } from '../scene/thumbnails';

const mocks = vi.hoisted(() => ({
  loadBagAsset: vi.fn(),
  chargerTextureDonnee: vi.fn(),
  builders: {} as Record<string, unknown>,
}));

vi.mock('../scene/bag/loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../scene/bag/loader')>()),
  loadBagAsset: mocks.loadBagAsset,
  chargerTextureDonnee: mocks.chargerTextureDonnee,
}));
vi.mock('../scene/thumbnails', () => ({
  registerBuilder: (kind: string, b: unknown) => {
    mocks.builders[kind] = b;
  },
}));

const GREFFE = Symbol.for('lkdv.atlas.greffe');
interface Greffe {
  uniforms: { tintColor: { value: Color }; tintAmount: { value: number }; zonesMap: { value: Texture | null } };
}
const greffe = (m: Material): Greffe | undefined => (m as unknown as Record<symbol, Greffe | undefined>)[GREFFE];

const MODELE = 'lkdv-one-45';
const SAC = 'lkdv-one-45';

/** Master de test : un corps à matériau d'atlas (porte une `map`) et un écusson qui n'en est pas un. */
function fabriqueMaster(standard = true): { racine: Group; atlas: MeshStandardMaterial; ecusson: MeshStandardMaterial } {
  const atlas = standard
    ? new MeshStandardMaterial({ map: new Texture(), color: 0xffffff })
    : new MeshPhysicalMaterial({ map: new Texture(), color: 0xffffff });
  const ecusson = new MeshStandardMaterial({ color: 0x222222 });
  const corps = new Mesh(new BoxGeometry(0.4, 0.66, 0.25), atlas);
  const poche = new Mesh(new BoxGeometry(0.3, 0.2, 0.05), atlas); // même matériau partagé
  const logo = new Mesh(new BoxGeometry(0.05, 0.05, 0.01), ecusson);
  logo.name = 'LKDV_LOGO';
  const racine = new Group();
  racine.add(corps, poche, logo);
  return { racine, atlas, ecusson };
}

function ressources(): ThumbResources {
  return { tracker: new ResourceTracker() } as unknown as ThumbResources;
}

function materiauxDe(o: Object3D): Material[] {
  const out: Material[] = [];
  o.traverse((n) => {
    if ((n as Mesh).isMesh) out.push((n as Mesh).material as Material);
  });
  return out;
}

/** Matériau d'atlas d'une vignette : le premier mesh (le corps). */
const atlasDe = (o: Object3D): Material => materiauxDe(o)[0];

async function charger(modules: typeof import('../scene/thumbAssets')): Promise<void> {
  modules.ouvrirChargementsVignettes();
  // Premier appel : lance le chargement, rend null.
  expect(modules.maillageCorps(MODELE)).toBeNull();
  await vi.waitFor(() => expect(modules.maillageCorps(MODELE)).not.toBeNull());
}

describe('vignettes des corps : le coloris teinte le maillage réel', () => {
  let assets: typeof import('../scene/thumbAssets');
  let bagBuilder: ThumbBuilder<BagThumbSpec>;
  let master: ReturnType<typeof fabriqueMaster>;
  const zones = new Texture();

  beforeEach(async () => {
    vi.resetModules();
    mocks.loadBagAsset.mockReset();
    mocks.chargerTextureDonnee.mockReset();
    master = fabriqueMaster();
    mocks.loadBagAsset.mockImplementation(async () => ({
      status: 'ready',
      modelId: MODELE,
      manifest: { texturedSource: true, zonesMapUrl: '/zones.png' },
      root: master.racine,
    }));
    mocks.chargerTextureDonnee.mockResolvedValue(zones);
    assets = await import('../scene/thumbAssets');
    const builders = await import('../scene/thumbBuilders');
    builders.registerThumbBuilders();
    bagBuilder = mocks.builders.b as ThumbBuilder<BagThumbSpec>;
    await charger(assets);
  });

  afterEach(() => {
    assets.viderActifsVignettes();
  });

  it('deux coloris du même sac donnent deux teintes différentes, celles de la palette', () => {
    const a = colorwayThumb(COLORWAYS.foret, SAC).spec;
    const b = colorwayThumb(COLORWAYS.sauge, SAC).spec;
    expect(a.body).not.toBe(b.body);

    const vA = bagBuilder(a, ressources());
    const vB = bagBuilder(b, ressources());
    const gA = greffe(atlasDe(vA));
    const gB = greffe(atlasDe(vB));
    expect(gA).toBeDefined();
    expect(gB).toBeDefined();
    expect(atlasDe(vA)).not.toBe(atlasDe(vB));
    expect(gA!.uniforms.tintAmount.value).toBe(1);
    // Même couleur que la scène : `new Color(hex)` du token, jamais un littéral.
    expect(gA!.uniforms.tintColor.value.getHex()).toBe(new Color(a.body).getHex());
    expect(gB!.uniforms.tintColor.value.getHex()).toBe(new Color(b.body).getHex());
    expect(gA!.uniforms.tintColor.value.getHex()).not.toBe(gB!.uniforms.tintColor.value.getHex());
    // La carte de zones du cache est branchée : sans elle, tout le sac serait teinté.
    expect(gA!.uniforms.zonesMap.value).toBe(zones);
  });

  it('le matériau du master en cache n’est pas modifié (même référence, valeurs intactes)', () => {
    const avant = master.atlas;
    const couleurAvant = avant.color.getHex();
    const avantProgramme = avant.onBeforeCompile;
    bagBuilder(colorwayThumb(COLORWAYS.foret, SAC).spec, ressources());
    bagBuilder(colorwayThumb(COLORWAYS.sauge, SAC).spec, ressources());

    const corps = master.racine.children[0] as Mesh;
    expect(corps.material).toBe(avant);
    expect((master.racine.children[1] as Mesh).material).toBe(avant);
    expect(avant.color.getHex()).toBe(couleurAvant);
    expect(avant.onBeforeCompile).toBe(avantProgramme);
    expect(greffe(avant)).toBeUndefined();
    expect((avant as MeshPhysicalMaterial).isMeshPhysicalMaterial).toBeUndefined();
  });

  it('même chose quand le matériau du master est déjà physique (pas de greffe en place)', async () => {
    assets.viderActifsVignettes();
    vi.resetModules();
    master = fabriqueMaster(false);
    assets = await import('../scene/thumbAssets');
    (await import('../scene/thumbBuilders')).registerThumbBuilders();
    bagBuilder = mocks.builders.b as ThumbBuilder<BagThumbSpec>;
    await charger(assets);

    const v = bagBuilder(colorwayThumb(COLORWAYS.sauge, SAC).spec, ressources());
    expect(atlasDe(v)).not.toBe(master.atlas);
    expect(greffe(atlasDe(v))).toBeDefined();
    expect(greffe(master.atlas)).toBeUndefined();
  });

  it('l’écusson garde son matériau (hors carte de zones) et le matériau d’atlas partagé n’est cloné qu’une fois', () => {
    const v = bagBuilder(colorwayThumb(COLORWAYS.foret, SAC).spec, ressources());
    const [corps, poche, logo] = materiauxDe(v);
    expect(logo).toBe(master.ecusson);
    expect(poche).toBe(corps);
  });

  it('les clones sont confiés au tracker : libérés avec la vignette, pas ceux du master', () => {
    const res = ressources();
    const v = bagBuilder(colorwayThumb(COLORWAYS.foret, SAC).spec, res);
    const clone = atlasDe(v);
    expect(res.tracker.counts().materials).toBe(1);

    const libereClone = vi.fn();
    const libereMaster = vi.fn();
    clone.addEventListener('dispose', libereClone);
    master.atlas.addEventListener('dispose', libereMaster);
    res.tracker.disposeAll();
    expect(libereClone).toHaveBeenCalledTimes(1);
    expect(libereMaster).not.toHaveBeenCalled();
    expect(res.tracker.counts().materials).toBe(0);
  });

  it('sans carte de zones, la vignette garde la texture d’origine du master (rien d’inventé)', async () => {
    assets.viderActifsVignettes();
    vi.resetModules();
    mocks.chargerTextureDonnee.mockResolvedValue(null);
    master = fabriqueMaster();
    assets = await import('../scene/thumbAssets');
    (await import('../scene/thumbBuilders')).registerThumbBuilders();
    bagBuilder = mocks.builders.b as ThumbBuilder<BagThumbSpec>;
    await charger(assets);

    const v = bagBuilder(colorwayThumb(COLORWAYS.sauge, SAC).spec, ressources());
    expect(atlasDe(v)).toBe(master.atlas);
  });

  it('master absent : la carte reste vide, aucune doublure', async () => {
    assets.viderActifsVignettes();
    vi.resetModules();
    mocks.loadBagAsset.mockResolvedValue({ status: 'degraded', reason: 'x', root: null });
    assets = await import('../scene/thumbAssets');
    (await import('../scene/thumbBuilders')).registerThumbBuilders();
    bagBuilder = mocks.builders.b as ThumbBuilder<BagThumbSpec>;
    const v = bagBuilder(colorwayThumb(COLORWAYS.sauge, SAC).spec, ressources());
    expect(v.children).toHaveLength(0);
  });

  it('choisir un autre coloris ne relance aucun téléchargement du master ni de la carte', () => {
    expect(mocks.loadBagAsset).toHaveBeenCalledTimes(1);
    expect(mocks.chargerTextureDonnee).toHaveBeenCalledTimes(1);
    for (const cw of Object.values(COLORWAYS)) bagBuilder(colorwayThumb(cw, SAC).spec, ressources());
    expect(mocks.loadBagAsset).toHaveBeenCalledTimes(1);
    expect(mocks.chargerTextureDonnee).toHaveBeenCalledTimes(1);
  });
});

describe('clé de cache des vignettes de corps : elle suit le coloris', () => {
  it('deux coloris du même sac ont deux clés, donc deux images', () => {
    const a = colorwayThumb(COLORWAYS.foret, SAC);
    const b = colorwayThumb(COLORWAYS.sauge, SAC);
    expect(a.key).not.toBe(b.key);
    expect(a.key).toBe(`b:${SAC}:${COLORWAYS.foret.body}:${COLORWAYS.foret.pocket}:${COLORWAYS.foret.trim}`);
    // La clé porte le coloris, la description sa couleur résolue : les deux bougent ensemble.
    expect(a.spec.body).toBe(resolveMaterial(COLORWAYS.foret.body));
    expect(b.spec.body).toBe(resolveMaterial(COLORWAYS.sauge.body));
    expect(bagThumb(SAC, COLORWAYS.sauge).key).toBe(b.key);
  });
});
