import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cepDigitsPortugal,
  formatPortugalCepDigits,
  lookupAddressFromPortugalCep,
  mapPortugalPlaceToCpcRegion,
  pickPhotonFeatureForPortugalCep,
} from './portugalCepLookup';

describe('portugalCepLookup', () => {
  it('cepDigitsPortugal aceita 7 dígitos com ou sem hífen', () => {
    expect(cepDigitsPortugal('1000-001')).toBe('1000001');
    expect(cepDigitsPortugal('1000001')).toBe('1000001');
    expect(cepDigitsPortugal('1000')).toBeNull();
    expect(cepDigitsPortugal('')).toBeNull();
  });

  it('formatPortugalCepDigits formata NNNN-NNN', () => {
    expect(formatPortugalCepDigits('1000001')).toBe('1000-001');
  });

  it('mapPortugalPlaceToCpcRegion mapeia distritos conhecidos', () => {
    expect(mapPortugalPlaceToCpcRegion('Distrito do Porto', undefined, undefined)).toBe('Norte');
    expect(mapPortugalPlaceToCpcRegion('Lisboa', undefined, undefined)).toBe('Lisboa');
    expect(mapPortugalPlaceToCpcRegion('Faro', undefined, undefined)).toBe('Algarve');
    expect(mapPortugalPlaceToCpcRegion('Açores', undefined, undefined)).toBe('Outra');
  });

  it('pickPhotonFeatureForPortugalCep prioriza PT e código postal exato', () => {
    const features = [
      { properties: { city: 'Buenos Aires', country: 'Argentina', countrycode: 'AR', postcode: 'B1754' } },
      {
        properties: {
          street: 'Rua Exemplo',
          city: 'Perafita',
          county: 'Porto',
          country: 'Portugal',
          countrycode: 'PT',
          postcode: '4425-116',
        },
      },
    ];
    const picked = pickPhotonFeatureForPortugalCep(features, '4425116');
    expect(picked?.properties?.city).toBe('Perafita');
  });

  it('pickPhotonFeatureForPortugalCep escolhe na série NNNN-* o CEP numericamente mais próximo', () => {
    const features = [
      {
        properties: {
          street: 'Rua A',
          city: 'Trofa',
          county: 'Porto',
          country: 'Portugal',
          countrycode: 'PT',
          postcode: '4425-322',
        },
      },
      {
        properties: {
          street: 'Rua B',
          city: 'Águas Santas',
          county: 'Porto',
          country: 'Portugal',
          countrycode: 'PT',
          postcode: '4425-101',
        },
      },
    ];
    const picked = pickPhotonFeatureForPortugalCep(features, '4425116');
    expect(picked?.properties?.postcode).toBe('4425-101');
    expect(picked?.properties?.city).toBe('Águas Santas');
  });

  it('pickPhotonFeatureForPortugalCep com um único PT na série mantém esse resultado', () => {
    const features = [
      { properties: { city: 'Buenos Aires', country: 'Argentina', countrycode: 'AR', postcode: '4425116' } },
      {
        properties: {
          street: 'Rua A',
          city: 'Trofa',
          county: 'Porto',
          country: 'Portugal',
          countrycode: 'PT',
          postcode: '4425-322',
        },
      },
    ];
    const picked = pickPhotonFeatureForPortugalCep(features, '4425116');
    expect(picked?.properties?.countrycode).toBe('PT');
    expect(picked?.properties?.city).toBe('Trofa');
  });
});

describe('lookupAddressFromPortugalCep (fetch mock)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prioriza Nominatim: freguesia e concelho coerentes com o CEP', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (u.includes('nominatim') || u.includes('osm-nominatim')) {
        return {
          ok: true,
          json: async () => [
            {
              display_name: '4425-116, Águas Santas, Maia, Porto, Portugal',
              address: {
                postcode: '4425-116',
                town: 'Águas Santas',
                municipality: 'Maia',
                county: 'Porto',
              },
            },
          ],
        };
      }
      return { ok: false, json: async () => null };
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await lookupAddressFromPortugalCep('4425116');
    expect(r?.addressLine).toBe('Águas Santas, Maia');
    expect(r?.region).toBe('Norte');
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('osm-nominatim') || String(c[0]).includes('nominatim'))).toBe(
      true
    );
  });

  it('fallback Photon não usa lang=pt na URL (evita 400)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (u.includes('nominatim') || u.includes('osm-nominatim')) {
        return { ok: true, json: async () => [] };
      }
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                street: 'Rua Teste',
                city: 'Porto',
                county: 'Porto',
                country: 'Portugal',
                countrycode: 'PT',
                postcode: '4425-116',
              },
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const r = await lookupAddressFromPortugalCep('4425116');
    expect(r).not.toBeNull();
    expect(r?.region).toBe('Norte');
    const photonUrl = fetchMock.mock.calls.map((c) => String(c[0])).find((x) => x.includes('photon.komoot.io'));
    expect(photonUrl).toBeDefined();
    expect(photonUrl).not.toMatch(/lang=pt/);
  });
});
