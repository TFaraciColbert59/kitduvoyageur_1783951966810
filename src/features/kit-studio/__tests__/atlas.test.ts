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
