import { describe, expect, it } from 'vitest';
import { mapLocationToRegion, mapProfileToRegion } from './migrantRegion';

describe('migrantRegion', () => {
  it('mapProfileToRegion uses registered region', () => {
    expect(mapProfileToRegion({ region: 'Algarve' })).toBe('Algarve');
  });

  it('mapProfileToRegion resolves Outra from regionOther', () => {
    expect(mapProfileToRegion({ region: 'Outra', regionOther: 'Faro' })).toBe('Algarve');
  });

  it('mapProfileToRegion falls back to Desconhecida', () => {
    expect(mapProfileToRegion({})).toBe('Desconhecida');
  });

  it('mapLocationToRegion maps city tokens', () => {
    expect(mapLocationToRegion('Porto')).toBe('Norte');
    expect(mapLocationToRegion('Lisboa')).toBe('Lisboa');
  });
});
