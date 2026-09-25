import { describe, expect, it } from 'vitest';
import { adventureStorageKey } from '../ActiveAdventureContext';

describe('adventureStorageKey', () => {
  it('separates private group data for different accounts', () => {
    expect(adventureStorageKey('lkdv_hub_adventures_cache', 'alice')).not.toBe(adventureStorageKey('lkdv_hub_adventures_cache', 'bob'));
  });

  it('does not provide a private key before authentication', () => {
    expect(adventureStorageKey('lkdv_hub_adventures_cache', null)).toBeNull();
  });
});
