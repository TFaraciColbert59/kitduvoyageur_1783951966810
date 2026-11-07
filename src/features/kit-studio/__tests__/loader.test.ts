import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  loadBagAsset,
  type BagAssetProvider,
} from '../scene/bag/loader';
import { applyPartCustomization } from '../scene/bag/materials';
import type { BagIndexEntry, BagManifest } from '../scene/bag/parts';

const BAGS_DIR = path.join(process.cwd(), 'public', 'assets', 'bags');
const indexJson = JSON.parse(
  fs.readFileSync(path.join(BAGS_DIR, 'bags.index.json'), 'utf8')
) as { schema: number; models: (BagIndexEntry & { source?: string; tiers?: string[] })[] };

/**
 * L'index porte désormais deux familles de sacs, et elles n'ont pas les mêmes promesses.
 *
 * Les sacs du générateur maison sont découpés en pièces nommées, personnalisables une à une.
 * Les sacs importés (gamme LKDV ONE) sont des maillages texturés d'un seul tenant : leur apparence
 * vit dans leur atlas, ils n'ont ni pièce nommée ni ancrage, et leur personnalisation de couleur
 * est déclarée indisponible tant qu'aucun masque de zone tissu n'existe.
 *
 * Les tests qui suivent vérifient chaque famille selon ce qu'elle promet, et jamais l'inverse.
 */
const PROCEDURAUX = indexJson.models.filter((m) => m.source !== 'imported');
const IMPORTES = indexJson.models.filter((m) => m.source === 'imported');

const fsProvider: BagAssetProvider = {
  async fetchManifest(modelId: string): Promise<BagManifest> {
    const file = path.join(BAGS_DIR, `${modelId}.manifest.json`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  },
  async fetchGlb(modelId: string): Promise<ArrayBuffer> {
    const file = path.join(BAGS_DIR, `${modelId}.glb`);
    const buf = fs.readFileSync(file);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
};

describe('Bag GLB + Manifest Loader (Lot L4-2 / C-13 / D-04 / H-07)', () => {
  it('trouve les 5 modèles procéduraux validés dans bags.index.json sous les budgets (<= 40k tri, <= 900 Ko)', () => {
    expect(PROCEDURAUX.length).toBe(5);
    for (const entry of indexJson.models) {
      expect(entry.valid).toBe(true);
      expect(entry.triangles).toBeLessThanOrEqual(40_000);
      expect(entry.bytes).toBeLessThanOrEqual(900 * 1024);
    }
  });

  it.each(PROCEDURAUX)(
    'charge $modelId : pièces nommées, ancres, matériaux isolés et honnêteté openable ($openable)',
    async (entry) => {
      const loaded = await loadBagAsset(entry.modelId, fsProvider);
      expect(loaded.status).toBe('ready');
      if (loaded.status !== 'ready') return;

      // Toutes les pièces personnalisables déclarées dans le manifeste existent dans le graphe 3D
      for (const partId of loaded.manifest.capabilities.customizableParts) {
        expect(loaded.parts.has(partId)).toBe(true);
      }

      // Toutes les ancres d'insigne déclarées existent
      for (const anchorId of loaded.manifest.capabilities.badgeAnchors) {
        expect(loaded.anchors.has(anchorId)).toBe(true);
      }

      // Honnêteté C-13 : duffel-60 (openable: false) n'expose AUCUNE charnière
      if (entry.openable) {
        expect(loaded.capabilities.openable).toBe(true);
        expect(loaded.hinges.size).toBeGreaterThan(0);
      } else {
        expect(loaded.capabilities.openable).toBe(false);
        expect(loaded.capabilities.hasInterior).toBe(false);
        expect(loaded.hinges.size).toBe(0);
      }

      // D-04 : modifier une pièce ne modifie AUCUNE pièce sœur (isolation des matériaux)
      if (loaded.parts.has('shoulder-strap-l') && loaded.parts.has('shoulder-strap-r')) {
        const leftMat = loaded.parts.get('shoulder-strap-l')!.material as any;
        const rightMat = loaded.parts.get('shoulder-strap-r')!.material as any;
        expect(leftMat).not.toBe(rightMat);

        const rightHexBefore = rightMat.color.getHexString();
        const applied = applyPartCustomization(loaded.parts, 'shoulder-strap-l', {
          color: 'var(--hub-bag-ochre)',
          material: 'ripstop-ultralight',
        });
        expect(applied).toBe(true);
        expect(rightMat.color.getHexString()).toBe(rightHexBefore);
        expect(leftMat.color.getHexString()).not.toBe(rightHexBefore);
      }

      loaded.dispose();
    }
  );

  it.each(PROCEDURAUX)(
    '$modelId porte des coordonnées de texture sur toutes ses pièces, sans quoi aucune matière ne peut se poser',
    async (entry) => {
      const loaded = await loadBagAsset(entry.modelId, fsProvider);
      expect(loaded.status).toBe('ready');
      if (loaded.status !== 'ready') return;

      for (const [partId, mesh] of loaded.parts) {
        const uv = mesh.geometry.getAttribute('uv');
        expect(uv, `pièce ${partId} sans uv`).toBeDefined();
        expect(uv.itemSize).toBe(2);
        expect(uv.count).toBe(mesh.geometry.getAttribute('position').count);
      }
    }
  );

  it('retourne status: degraded sans crash lorsque le fichier GLB est manquant ou corrompu', async () => {
    const missing = await loadBagAsset('modele-fantome-999', fsProvider);
    expect(missing.status).toBe('degraded');
    expect(missing.capabilities.openable).toBe(false);
    expect(missing.root).toBeNull();

    const empty = await loadBagAsset(null, fsProvider);
    expect(empty.status).toBe('degraded');
  });
});

/**
 * La gamme LKDV ONE : maillages Meshy texturés, d'un seul tenant, servis en deux paliers.
 *
 * Ce que ces tests protègent : le palier web reste dans le budget du déploiement, l'atlas arrive
 * entier, le sac est à sa taille réelle sans qu'on le remette à l'échelle, et le Studio n'annonce
 * pas une personnalisation de couleur qu'il ne sait pas encore tenir.
 */
describe('Gamme LKDV ONE — maillages importés texturés', () => {
  const BAGS = path.join(process.cwd(), 'public', 'assets', 'bags');

  it('déclare les cinq sacs, chacun avec ses deux paliers', () => {
    expect(IMPORTES.map((m) => m.modelId).sort()).toEqual([
      'lkdv-one-15', 'lkdv-one-25', 'lkdv-one-45', 'lkdv-one-60', 'lkdv-one-80',
    ]);
    for (const e of IMPORTES) expect(e.tiers).toEqual(['web', 'hd']);
  });

  it.each(IMPORTES)('$modelId : le palier web tient dans le budget du déploiement', async (entry) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(BAGS, `${entry.modelId}.manifest.json`), 'utf8')
    ) as BagManifest;
    const web = manifest.assets?.web;
    const hd = manifest.assets?.hd;
    expect(web).toBeDefined();
    expect(hd).toBeDefined();
    expect(web!.bytes).toBeLessThanOrEqual(900 * 1024);
    expect(web!.triangles).toBeLessThanOrEqual(40_000);
    // Le fichier du palier web est bien celui qui est sur le disque, à l'octet près.
    expect(fs.statSync(path.join(BAGS, `${entry.modelId}.glb`)).size).toBe(web!.bytes);
    // Le master est hors du dépôt : son adresse est absolue, pas un chemin local.
    expect(hd!.url).toMatch(/^https:\/\//);
    expect(web!.url).toBe(`/assets/bags/${entry.modelId}.glb`);
    // Il vaut la peine de décimer : sinon le palier web n'a pas de raison d'exister.
    expect(hd!.triangles).toBeGreaterThan(web!.triangles * 5);
  });

  it.each(IMPORTES)('$modelId : arrive texturé, à sa taille réelle, posé au sol', async (entry) => {
    const loaded = await loadBagAsset(entry.modelId, fsProvider);
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;

    const boite = new THREE.Box3().setFromObject(loaded.root);
    const taille = boite.getSize(new THREE.Vector3());
    // La hauteur déclarée au manifeste est celle qu'on obtient sans rien remettre à l'échelle.
    expect(taille.y).toBeCloseTo(loaded.manifest.boundingBoxM.h, 2);
    expect(boite.min.y).toBeCloseTo(0, 2);

    // L'atlas est déclaré par le fichier. Le liage effectif des cartes demande `createImageBitmap`,
    // absent de jsdom : il est vérifié au rendu, pas ici. Ce qu'on protège à ce niveau, c'est que
    // le fichier porte bien ses images et que les matériaux pointent dessus.
    const brut = fs.readFileSync(path.join(BAGS, `${entry.modelId}.glb`));
    const enTete = JSON.parse(
      brut.subarray(20, 20 + brut.readUInt32LE(12)).toString('utf8')
    ) as { images?: unknown[]; materials?: { pbrMetallicRoughness?: { baseColorTexture?: unknown } }[] };
    expect(enTete.images?.length ?? 0).toBeGreaterThan(0);
    expect(
      (enTete.materials ?? []).some((m) => m.pbrMetallicRoughness?.baseColorTexture)
    ).toBe(true);
  });

  it.each(IMPORTES)('$modelId : n’annonce aucune capacité que le maillage ne porte pas', async (entry) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(BAGS, `${entry.modelId}.manifest.json`), 'utf8')
    ) as BagManifest;
    expect(manifest.texturedSource).toBe(true);
    // La personnalisation de couleur n'est annoncée que si la carte de zones existe : teinter sans
    // elle repeindrait l'atlas entier, boucles et écusson compris. Avec la carte, la teinte est
    // bornée au tissu, et la capacité devient honnête.
    expect(manifest.capabilities.customizableParts).toEqual(
      manifest.zonesMapUrl ? ['body'] : []
    );
    if (manifest.zonesMapUrl) {
      expect(manifest.zonesMapUrl).toBe(`/assets/bags/${entry.modelId}.zones.webp`);
      expect(fs.existsSync(path.join(BAGS, `${entry.modelId}.zones.webp`))).toBe(true);
    }
    expect(manifest.capabilities.openable).toBe(false);
    expect(manifest.capabilities.badgeAnchors).toEqual([]);
    expect(manifest.slots).toEqual([]);
  });
});

/**
 * Garde-fou sur le pas d'entrelacement des accesseurs.
 *
 * Un fichier compressé en meshopt aligne chaque élément sur quatre octets : une position en trois
 * entiers courts occupe six octets dans un pas de huit. Lue comme si elle était serrée, la
 * géométrie se mélange — et le piège est que la boîte englobante reste juste, si bien que les
 * contrôles de taille passent pendant que le sac est devenu un tas d'éclats.
 *
 * L'invariant qui le détecte : sur un maillage sain, une arête est courte devant l'objet. Mélangé,
 * les arêtes relient des points pris au hasard et leur longueur moyenne explose.
 */
describe('Lecture des accesseurs entrelacés', () => {
  it.each(IMPORTES)('$modelId : les arêtes restent courtes devant le sac', async (entry) => {
    const loaded = await loadBagAsset(entry.modelId, fsProvider);
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;

    const boite = new THREE.Box3().setFromObject(loaded.root);
    const diagonale = boite.getSize(new THREE.Vector3()).length();

    let somme = 0;
    let n = 0;
    loaded.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const pos = mesh.geometry.getAttribute('position');
      const idx = mesh.geometry.getIndex();
      if (!pos || !idx) return;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      // Un triangle sur cinquante suffit : on cherche un ordre de grandeur, pas une moyenne exacte.
      for (let t = 0; t < idx.count / 3; t += 50) {
        a.fromBufferAttribute(pos, idx.getX(t * 3));
        b.fromBufferAttribute(pos, idx.getX(t * 3 + 1));
        somme += a.distanceTo(b) * mesh.getWorldScale(new THREE.Vector3()).x;
        n += 1;
      }
    });

    expect(n).toBeGreaterThan(100);
    const areteMoyenne = somme / n;
    // Mesuré après correction : de l'ordre de 0,3 % de la diagonale. Avec le défaut, les arêtes
    // reliaient des sommets quelconques et la moyenne dépassait 20 %.
    expect(areteMoyenne).toBeLessThan(diagonale * 0.05);
  });
});
