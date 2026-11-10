import type { KitItemV2 } from '../engine/createSchemasV2';

export { storySchemaV2, createDefaultsV2 } from '../engine/createSchemasV2';

export function buildKitItemFixture(name: string): KitItemV2 {
  return {
    id: `i-${name}`,
    name,
    category: 'Vêtements',
    weightG: 100,
    quantity: 1,
    productId: null,
    ownershipId: null,
    isChecked: false,
  };
}
