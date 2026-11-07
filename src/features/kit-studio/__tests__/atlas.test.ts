/**
 * Apparence des sacs importés texturés — avenant du 7 novembre, § 4.
 *
 * Ce que ces tests protègent, et c'est une seule idée : **sans carte de zones, on ne touche à
 * rien.** Tout le sac est un seul matériau ; teinter ou allumer la lueur textile sans savoir où
 * s'arrête le tissu repeint les boucles et l'écusson. Mesuré : allumer le sheen sans masque fait
 * virer les boucles noires au vert pâle.
 *
 * Les décisions sont prises par `atlasUniformsFor`, fonction pure, précisément pour qu'elles soient
 * vérifiables ici plutôt que dans un shader.
 */

import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';
import { chromium } from 'playwright';
import { BoxGeometry, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { ConfigSet } from '../domain/catalog';
import {
  applyMeterUvs,
  atlasUniformsFor,
  FABRIC_ROUGHNESS,
  luminance,
  RIGID_ROUGHNESS,
  WEAVE_TILE_M,
  type AtlasMaps,
} from '../scene/bag/atlas';

const SANS_CARTE: AtlasMaps = { zones: null, weaveNormal: null };
const AVEC_CARTE: AtlasMaps = { zones: new Texture(), weaveNormal: null };
const AVEC_TRAME: AtlasMaps = { zones: new Texture(), weaveNormal: new Texture() };

const config = (col?: string) => ({ body: col ? { col } : {} }) as unknown as ConfigSet;

describe('Atlas — réglages déduits des cartes', () => {
  it('n’allume rien quand la carte de zones manque, même si une couleur est demandée', () => {
    const u = atlasUniformsFor(config('forest'), SANS_CARTE);
    expect(u.enabled).toBe(false);
    expect(u.tint).toBeNull();
    expect(u.weaveStrength).toBe(0);
  });

  it('n’applique pas de trame sans tuile de trame, même avec la carte de zones', () => {
    expect(atlasUniformsFor(config('forest'), AVEC_CARTE).weaveStrength).toBe(0);
    expect(atlasUniformsFor(config('forest'), AVEC_TRAME).weaveStrength).toBe(1);
  });

  it('s’allume et résout la couleur du token quand la carte est là', () => {
    const u = atlasUniformsFor(config('forest'), AVEC_TRAME);
    expect(u.enabled).toBe(true);
    expect(u.tint).not.toBeNull();
    for (const c of [u.tint!.r, u.tint!.g, u.tint!.b]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('reste allumé sans teinte quand aucune couleur n’est choisie', () => {
    const u = atlasUniformsFor(config(), AVEC_CARTE);
    expect(u.enabled).toBe(true);
    expect(u.tint).toBeNull();
  });

  it('donne aux pièces rigides une rugosité plus basse que le tissu', () => {
    // C'est ce qui fait qu'une boucle accroche un reflet net là où le tissu reste mat.
    expect(RIGID_ROUGHNESS).toBeLessThan(FABRIC_ROUGHNESS);
    const u = atlasUniformsFor(config('forest'), AVEC_CARTE);
    expect(u.fabricRoughness).toBe(FABRIC_ROUGHNESS);
    expect(u.rigidRoughness).toBe(RIGID_ROUGHNESS);
  });
});

describe('Atlas — luminance et UV physiques', () => {
  it('applique la luminance Rec. 709, celle du shader', () => {
    expect(luminance(1, 1, 1)).toBeCloseTo(1, 6);
    expect(luminance(0, 1, 0)).toBeCloseTo(0.7152, 6);
    expect(luminance(0, 0, 1)).toBeCloseTo(0.0722, 6);
  });

  it('pose des UV en mètres : une pièce deux fois plus grande reçoit deux fois plus de tuiles', () => {
    const etendue = (taille: number) => {
      const g = new BoxGeometry(taille, taille, taille);
      applyMeterUvs(g);
      const uv = g.getAttribute('uv1');
      let min = Infinity; let max = -Infinity;
      for (let i = 0; i < uv.count; i++) {
        min = Math.min(min, uv.getX(i)); max = Math.max(max, uv.getX(i));
      }
      return max - min;
    };
    const petite = etendue(0.1);
    const grande = etendue(0.2);
    expect(grande / petite).toBeCloseTo(2, 3);
    // Une tuile couvre WEAVE_TILE_M : une pièce de 10 cm en reçoit donc une.
    expect(petite).toBeCloseTo(0.1 / WEAVE_TILE_M, 3);
  });

  it('est idempotent : une géométrie partagée n’est pas projetée deux fois', () => {
    const g = new BoxGeometry(0.3, 0.3, 0.3);
    applyMeterUvs(g);
    const avant = Array.from((g.getAttribute('uv1').array as Float32Array).slice(0, 12));
    applyMeterUvs(g);
    applyMeterUvs(g);
    const apres = Array.from((g.getAttribute('uv1').array as Float32Array).slice(0, 12));
    expect(apres).toEqual(avant);
  });
});

interface WebGlRenderStats {
  readonly shaderErrors: string[];
  readonly appliedForest: boolean;
  readonly appliedOchre: boolean;
  readonly weaveLoaded: boolean;
  readonly fabricPixelCount: number;
  readonly fabricChangedCount: number;
  readonly fabricMeanDelta: number;
  readonly bucklePixelCount: number;
  readonly buckleMaxDelta: number;
  readonly strapPixelCount: number;
  readonly strapMaxDelta: number;
  readonly badgePixelCount: number;
  readonly badgeMaxDelta: number;
  readonly weaveDiffOnFabricCount: number;
  readonly weaveMaxDeltaOnBuckle: number;
  readonly sheenBuckleMaxDelta: number;
  readonly sheenFabricDiffCount: number;
  readonly sheenStrapDiffCount: number;
}

describe('Atlas — rendu WebGL pixel à pixel sur lkdv-one-45', () => {
  it(
    'teinte uniquement le tissu entre forest et ochre, préserve boucles/sangles/écusson, et applique la trame et le sheen',
    async () => {
      const rootDir = process.cwd();
      const entrySource = `
        import * as THREE from 'three';
        import { loadBagAsset, chargerTextureDonnee } from './src/features/kit-studio/scene/bag/loader';
        import { applyAtlasAppearance } from './src/features/kit-studio/scene/bag/atlas';

        window.__runAtlasPixelCheck = async () => {
          const SIZE = 512;
          const canvas = document.getElementById('c');
          const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false,
            alpha: true,
            preserveDrawingBuffer: true,
          });
          renderer.setSize(SIZE, SIZE, false);
          renderer.outputColorSpace = THREE.SRGBColorSpace;

          const shaderErrors = [];
          renderer.debug.onShaderError = (gl, _program, vs, fs) => {
            const vsLog = gl.getShaderInfoLog(vs) || '';
            const fsLog = gl.getShaderInfoLog(fs) || '';
            shaderErrors.push((vsLog + ' ' + fsLog).trim());
          };

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 10);
          camera.position.set(0, 0.34, 0.95);
          camera.lookAt(0, 0.33, 0);

          scene.add(new THREE.AmbientLight(0xffffff, 1.1));
          const key = new THREE.DirectionalLight(0xffffff, 2.2);
          key.position.set(0.8, 1.4, 1.2);
          scene.add(key);
          const rim = new THREE.DirectionalLight(0xffffff, 1.4);
          rim.position.set(-0.9, 0.8, -0.6);
          scene.add(rim);

          const provider = {
            async fetchManifest(id) {
              const r = await fetch('/assets/bags/' + id + '.manifest.json');
              return r.json();
            },
            async fetchGlb(id, url) {
              const target = url && !url.startsWith('http') ? url : '/assets/bags/' + id + '.glb';
              const r = await fetch(target);
              return r.arrayBuffer();
            },
            async fetchZonesMap(_id, url) {
              return url ? chargerTextureDonnee(url) : null;
            },
          };

          const loaded = await loadBagAsset('lkdv-one-45', provider);
          if (loaded.status !== 'ready') throw new Error('Load failed: ' + loaded.reason);

          const zones = await chargerTextureDonnee(loaded.manifest.zonesMapUrl);
          const weave = await chargerTextureDonnee('/assets/materials/weave-normal.webp');
          scene.add(loaded.root);

          const gl = renderer.getContext();
          const readPixels = () => {
            const buf = new Uint8Array(SIZE * SIZE * 4);
            gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            return buf;
          };

          // 1. Passe de classification géométrique : on peint la carte de zones brute sur le corps
          //    et une couleur franche sur l'écusson pour connaître la classe exacte de chaque pixel.
          const savedMaterials = new Map();
          loaded.root.traverse((n) => {
            if (n.isMesh) {
              savedMaterials.set(n, n.material);
              const isBadge =
                n.name === 'LKDV_LOGO' ||
                n.name === 'LKDV_ECUSSON_SUPPORT' ||
                n.material?.name === 'LKDV_MARQUAGE_PIERRE' ||
                n.material?.name === 'LKDV_Ecusson_Tisse';
              if (isBadge) {
                n.material = new THREE.MeshBasicMaterial({ color: 0xff00ff, toneMapped: false });
              } else {
                n.material = new THREE.MeshBasicMaterial({ map: zones, toneMapped: false });
              }
            }
          });
          renderer.render(scene, camera);
          const classPixels = readPixels();

          // Restauration des matériaux d'origine
          loaded.root.traverse((n) => {
            if (n.isMesh && savedMaterials.has(n)) {
              n.material.dispose();
              n.material = savedMaterials.get(n);
            }
          });

          // 2. Rendu avec token 'forest' (avec trame)
          const mapsWithWeave = { zones, weaveNormal: weave };
          const appliedForest = applyAtlasAppearance(loaded, { body: { col: 'forest' } }, mapsWithWeave);
          renderer.render(scene, camera);
          const pixelsForest = readPixels();

          // 3. Rendu avec token 'ochre' (avec trame)
          const appliedOchre = applyAtlasAppearance(loaded, { body: { col: 'ochre' } }, mapsWithWeave);
          renderer.render(scene, camera);
          const pixelsOchre = readPixels();

          // 4. Rendu avec token 'forest' SANS trame (pour vérifier que la trame agit sur le tissu et pas sur les boucles)
          applyAtlasAppearance(loaded, { body: { col: 'forest' } }, { zones, weaveNormal: null });
          renderer.render(scene, camera);
          const pixelsNoWeave = readPixels();

          // 5. Vérification du sheen : rendu 'forest' sans trame vs sheen éteint (sheen = 0)
          loaded.root.traverse((n) => {
            if (n.isMesh && n.material && n.material.isMeshPhysicalMaterial) {
              n.material.sheenColor.setRGB(0, 0, 0);
            }
          });
          renderer.render(scene, camera);
          const pixelsNoSheen = readPixels();

          let fabricPixelCount = 0;
          let fabricChangedCount = 0;
          let fabricDeltaSum = 0;
          let bucklePixelCount = 0;
          let buckleMaxDelta = 0;
          let strapPixelCount = 0;
          let strapMaxDelta = 0;
          let badgePixelCount = 0;
          let badgeMaxDelta = 0;
          let weaveDiffOnFabricCount = 0;
          let weaveMaxDeltaOnBuckle = 0;
          let sheenBuckleMaxDelta = 0;
          let sheenFabricDiffCount = 0;
          let sheenStrapDiffCount = 0;

          // On évite le bord immédiat d'1 pixel entre deux zones pour écarter le filtrage bilinéaire de texture
          const isPureNonRed = (x, y) => {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return false;
                const idx = (ny * SIZE + nx) * 4;
                if (classPixels[idx + 3] < 250 || classPixels[idx] > 0) return false;
              }
            }
            return true;
          };

          const isPureBadge = (x, y) => {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return false;
                const idx = (ny * SIZE + nx) * 4;
                if (
                  classPixels[idx + 3] < 250 ||
                  classPixels[idx] < 240 ||
                  classPixels[idx + 1] > 15 ||
                  classPixels[idx + 2] < 240
                ) {
                  return false;
                }
              }
            }
            return true;
          };

          for (let y = 1; y < SIZE - 1; y++) {
            for (let x = 1; x < SIZE - 1; x++) {
              const i = (y * SIZE + x) * 4;
              const ca = classPixels[i + 3];
              if (ca < 250) continue;

              const cr = classPixels[i];
              const cg = classPixels[i + 1];
              const cb = classPixels[i + 2];

              const dR = Math.abs(pixelsForest[i] - pixelsOchre[i]);
              const dG = Math.abs(pixelsForest[i + 1] - pixelsOchre[i + 1]);
              const dB = Math.abs(pixelsForest[i + 2] - pixelsOchre[i + 2]);
              const maxChannelDelta = Math.max(dR, dG, dB);
              const sumDelta = dR + dG + dB;

              const wR = Math.abs(pixelsForest[i] - pixelsNoWeave[i]);
              const wG = Math.abs(pixelsForest[i + 1] - pixelsNoWeave[i + 1]);
              const wB = Math.abs(pixelsForest[i + 2] - pixelsNoWeave[i + 2]);
              const weaveDelta = Math.max(wR, wG, wB);

              const sR = Math.abs(pixelsNoWeave[i] - pixelsNoSheen[i]);
              const sG = Math.abs(pixelsNoWeave[i + 1] - pixelsNoSheen[i + 1]);
              const sB = Math.abs(pixelsNoWeave[i + 2] - pixelsNoSheen[i + 2]);
              const sheenDelta = Math.max(sR, sG, sB);

              if (isPureBadge(x, y)) {
                badgePixelCount++;
                if (maxChannelDelta > badgeMaxDelta) badgeMaxDelta = maxChannelDelta;
              } else if (cr > 220 && cg < 20 && cb < 20) {
                fabricPixelCount++;
                if (sumDelta > 15) fabricChangedCount++;
                fabricDeltaSum += sumDelta;
                if (weaveDelta > 0) weaveDiffOnFabricCount++;
                if (sheenDelta > 0) sheenFabricDiffCount++;
              } else if (cb > 220 && cg < 20 && isPureNonRed(x, y)) {
                bucklePixelCount++;
                if (maxChannelDelta > buckleMaxDelta) buckleMaxDelta = maxChannelDelta;
                if (weaveDelta > weaveMaxDeltaOnBuckle) weaveMaxDeltaOnBuckle = weaveDelta;
                if (sheenDelta > sheenBuckleMaxDelta) sheenBuckleMaxDelta = sheenDelta;
              } else if (cg > 220 && cb < 20 && isPureNonRed(x, y)) {
                strapPixelCount++;
                if (maxChannelDelta > strapMaxDelta) strapMaxDelta = maxChannelDelta;
                if (sheenDelta > 0) sheenStrapDiffCount++;
              }
            }
          }

          loaded.dispose();
          renderer.dispose();

          return {
            shaderErrors,
            appliedForest,
            appliedOchre,
            weaveLoaded: Boolean(weave),
            fabricPixelCount,
            fabricChangedCount,
            fabricMeanDelta: fabricPixelCount > 0 ? fabricDeltaSum / fabricPixelCount : 0,
            bucklePixelCount,
            buckleMaxDelta,
            strapPixelCount,
            strapMaxDelta,
            badgePixelCount,
            badgeMaxDelta,
            weaveDiffOnFabricCount,
            weaveMaxDeltaOnBuckle,
            sheenBuckleMaxDelta,
            sheenFabricDiffCount,
            sheenStrapDiffCount,
          };
        };
      `;

      const built = await esbuild.build({
        stdin: {
          contents: entrySource,
          resolveDir: rootDir,
          loader: 'ts',
        },
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
      });
      const bundleJs = built.outputFiles[0].text;

      const browser = await chromium.launch({
        headless: true,
        args: [
          '--use-gl=swiftshader',
          '--enable-webgl',
          '--ignore-gpu-blocklist',
          '--enable-unsafe-swiftshader',
        ],
      });

      try {
        const page = await browser.newPage();
        await page.route('http://lkdv.local/**', async (route) => {
          const url = new URL(route.request().url());
          if (url.pathname === '/') {
            await route.fulfill({
              status: 200,
              contentType: 'text/html',
              body: '<!DOCTYPE html><html><body><canvas id="c" width="512" height="512"></canvas><script src="/bundle.js"></script></body></html>',
            });
            return;
          }
          if (url.pathname === '/bundle.js') {
            await route.fulfill({
              status: 200,
              contentType: 'application/javascript',
              body: bundleJs,
            });
            return;
          }
          const diskPath = path.join(rootDir, 'public', url.pathname);
          if (fs.existsSync(diskPath)) {
            const contentType = diskPath.endsWith('.json')
              ? 'application/json'
              : diskPath.endsWith('.glb')
                ? 'model/gltf-binary'
                : 'image/webp';
            await route.fulfill({
              status: 200,
              contentType,
              body: fs.readFileSync(diskPath),
            });
            return;
          }
          await route.fulfill({ status: 404, body: 'Not found' });
        });

        await page.goto('http://lkdv.local/');
        const stats = await page.evaluate(async () => {
          const w = window as unknown as { __runAtlasPixelCheck: () => Promise<WebGlRenderStats> };
          return w.__runAtlasPixelCheck();
        });

        // 0. Aucune erreur de compilation GLSL
        expect(stats.shaderErrors).toEqual([]);
        expect(stats.appliedForest).toBe(true);
        expect(stats.appliedOchre).toBe(true);
        expect(stats.weaveLoaded).toBe(true);

        // 1. Les texels du tissu diffèrent franchement entre 'forest' et 'ochre'
        expect(stats.fabricPixelCount).toBeGreaterThan(20_000);
        expect(stats.fabricChangedCount).toBeGreaterThan(stats.fabricPixelCount * 0.95);
        expect(stats.fabricMeanDelta).toBeGreaterThan(25);

        // 2. Les texels hors tissu (boucles, sangles, écusson) restent strictement identiques
        expect(stats.bucklePixelCount).toBeGreaterThan(1_000);
        expect(stats.buckleMaxDelta).toBeLessThanOrEqual(1);

        expect(stats.strapPixelCount).toBeGreaterThan(2_000);
        expect(stats.strapMaxDelta).toBeLessThanOrEqual(1);

        expect(stats.badgePixelCount).toBeGreaterThan(50);
        expect(stats.badgeMaxDelta).toBeLessThanOrEqual(1);

        // 3. La tuile de trame modifie visiblement le tissu et ne touche pas les boucles
        expect(stats.weaveDiffOnFabricCount).toBeGreaterThan(stats.fabricPixelCount * 0.1);
        expect(stats.weaveMaxDeltaOnBuckle).toBeLessThanOrEqual(1);

        // 4. Le sheen est actif sur les zones rouge (tissu) et verte (sangles), et strictement nul sur la bleue (boucles)
        expect(stats.sheenFabricDiffCount).toBeGreaterThan(1_000);
        expect(stats.sheenStrapDiffCount).toBeGreaterThan(500);
        expect(stats.sheenBuckleMaxDelta).toBe(0);
      } finally {
        await browser.close();
      }
    },
    30_000,
  );
});
