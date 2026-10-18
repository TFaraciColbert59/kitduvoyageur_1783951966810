import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildInventory,
  INVENTORY_JSON,
  inventoryJson,
  REGISTRY_JSON,
  ROOT,
} from '../../scripts/compas/lib/inventory-build.mjs';

/**
 * Phase 7 — verrou du banc de test du Compas.
 *
 * Un contrôle interactif ajouté au Compas (bouton, lien, champ, geste…) DOIT
 * apparaître au registre de couverture : soit avec le scénario qui l'exerce,
 * soit avec la raison pour laquelle il ne peut pas être testé en session, soit
 * « en attente » de son lot (il reste alors NON couvert dans le rapport).
 * Correctif : `node scripts/compas/inventory-controls.mjs --sync-registry`,
 * puis écrire le scénario ou la raison.
 */
type Entry = { scenario?: string; raison_non_testable?: string; en_attente?: string };
type Control = { id: string; delegue?: boolean };

const inv = buildInventory(ROOT) as { controls: Control[]; missingKeys: string[] };
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, REGISTRY_JSON), 'utf8')) as Record<string, Entry>;
const counted = inv.controls.filter((c) => !c.delegue).map((c) => c.id);

describe('registre de couverture du Compas', () => {
  it('chaque contrôle de l’inventaire a une entrée au registre', () => {
    const missing = counted.filter((id) => !registry[id]);
    expect(missing, 'contrôles sans entrée : lancer --sync-registry puis écrire le scénario').toEqual([]);
  });

  it('aucune entrée orpheline (contrôle supprimé ou renommé)', () => {
    const known = new Set(counted);
    expect(Object.keys(registry).filter((id) => !known.has(id))).toEqual([]);
  });

  it('chaque entrée dit exactement une chose : scénario, raison non testable ou lot en attente', () => {
    const bad = Object.entries(registry).filter(([, e]) => {
      const set = [e.scenario, e.raison_non_testable, e.en_attente].filter((v) => typeof v === 'string' && v.trim());
      return set.length !== 1;
    });
    expect(bad.map(([id]) => id)).toEqual([]);
  });

  it('chaque motif est une expression valide qui reconnaît le nom affiché de son contrôle', () => {
    const bad = (inv.controls as Array<Control & { matcher: string; variants: string[] }>).filter((c) => {
      const re = new RegExp(c.matcher);
      // « … » est soit une donnée (joker), soit des points de suspension du texte (« Recherche… »).
      return !c.variants.every((v) => re.test(v) || re.test(v.replace(/…/g, 'x')));
    });
    expect(bad.map((c) => c.id)).toEqual([]);
  });

  it('les identifiants sont uniques', () => {
    expect(new Set(counted).size).toBe(counted.length);
  });

  it('toutes les clés i18n des noms accessibles existent en français', () => {
    expect(inv.missingKeys).toEqual([]);
  });

  it('l’inventaire versionné est à jour (relancer scripts/compas/inventory-controls.mjs)', () => {
    const committed = JSON.parse(fs.readFileSync(path.join(ROOT, INVENTORY_JSON), 'utf8'));
    const fresh = inventoryJson(inv);
    expect(committed.controles.map((c: { id: string }) => c.id)).toEqual(fresh.controles.map((c: { id: string }) => c.id));
    expect(committed.total).toBe(fresh.total);
  });
});
