/** Regiões do formulário de perfil (CPC). */
export type CpcProfileRegion = 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra';

/** Código postal português: 7 dígitos (NNNNNNN ou NNNN-NNN). */
export function cepDigitsPortugal(cep: string): string | null {
  const d = cep.replace(/\D/g, '');
  return d.length === 7 ? d : null;
}

export function formatPortugalCepDigits(d7: string): string {
  return `${d7.slice(0, 4)}-${d7.slice(4)}`;
}

function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function normalizeDistrictLabel(raw: string): string {
  return stripAccents(raw.replace(/^\s*distrito\s+de\s+/i, '').replace(/^\s*concelho\s+de\s+/i, ''));
}

/**
 * Mapeia distrito / concelho (OSM) para a região do perfil.
 * Ilhas e casos ambíguos → Outra (detalhe em regionOther no caller).
 */
export function mapPortugalPlaceToCpcRegion(state?: string, county?: string, city?: string): CpcProfileRegion {
  const blob = [state, county, city].filter(Boolean).join(' ');
  const n = normalizeDistrictLabel(blob);

  if (/\b(azores|acores|madeira|porto\s+santo)\b/.test(n)) return 'Outra';

  const distritosLisboa: string[] = ['lisboa', 'setubal', 'setúbal'];
  const distritosNorte: string[] = [
    'porto',
    'braga',
    'viana do castelo',
    'vila real',
    'braganca',
    'bragança',
  ];
  const distritosCentro: string[] = [
    'aveiro',
    'coimbra',
    'leiria',
    'santarem',
    'castelo branco',
    'guarda',
    'viseu',
  ];
  const distritosAlentejo: string[] = ['evora', 'évora', 'beja', 'portalegre'];
  const distritosAlgarve: string[] = ['faro'];

  const tryMatch = (labels: string[]) => labels.some((d) => n.includes(d) || n.startsWith(d));

  if (tryMatch(distritosLisboa)) return 'Lisboa';
  if (tryMatch(distritosNorte)) return 'Norte';
  if (tryMatch(distritosCentro)) return 'Centro';
  if (tryMatch(distritosAlentejo)) return 'Alentejo';
  if (tryMatch(distritosAlgarve)) return 'Algarve';

  if (n.includes('lisboa')) return 'Lisboa';
  if (n.includes('porto') && !n.includes('portugal')) return 'Norte';

  return 'Outra';
}

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    city?: string;
    locality?: string;
    district?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

function isPortugalPhotonFeature(f: PhotonFeature): boolean {
  const p = f.properties;
  if (!p) return false;
  if (p.countrycode === 'PT') return true;
  const c = typeof p.country === 'string' ? stripAccents(p.country) : '';
  return c.includes('portugal');
}

function postcodeDigits(p: PhotonFeature['properties']): string {
  return (p?.postcode || '').replace(/\D/g, '');
}

/** Escolhe o melhor resultado Photon para um CEP PT (7 dígitos). Exportado para testes. */
export function pickPhotonFeatureForPortugalCep(features: PhotonFeature[], d7: string): PhotonFeature | null {
  if (!features.length) return null;
  const prefix4 = d7.slice(0, 4);
  const targetNum = parseInt(d7, 10);

  const pt = features.filter(isPortugalPhotonFeature);
  const pool = pt.length > 0 ? pt : features;

  const exact = pool.find((f) => postcodeDigits(f.properties) === d7);
  if (exact) return exact;

  const sameSeries = pool.filter((f) => {
    const pc = postcodeDigits(f.properties);
    return pc.length === 7 && pc.startsWith(prefix4);
  });
  if (sameSeries.length > 0) {
    sameSeries.sort((a, b) => {
      const da = Math.abs(parseInt(postcodeDigits(a.properties), 10) - targetNum);
      const db = Math.abs(parseInt(postcodeDigits(b.properties), 10) - targetNum);
      return da - db;
    });
    return sameSeries[0] ?? null;
  }

  return pool[0] ?? null;
}

type NominatimAddress = {
  postcode?: string;
  town?: string;
  village?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
};

type NominatimHit = {
  display_name?: string;
  address?: NominatimAddress;
};

function nominatimBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return '/osm-nominatim';
  }
  return 'https://nominatim.openstreetmap.org';
}

/**
 * Localidade correta do CEP (freguesia + concelho) via Nominatim.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
async function lookupFromNominatim(formattedCep: string, d7: string): Promise<{
  addressLine: string;
  region: CpcProfileRegion;
  regionOther: string;
} | null> {
  const params = new URLSearchParams({
    postalcode: formattedCep,
    countrycodes: 'pt',
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
  });
  const url = `${nominatimBaseUrl()}/search?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;

  const items = (await res.json()) as NominatimHit[];
  if (!Array.isArray(items) || items.length === 0) return null;

  const hit =
    items.find((x) => (x.address?.postcode || '').replace(/\D/g, '') === d7) ??
    items.find((x) => typeof x.display_name === 'string' && x.display_name.includes(formattedCep)) ??
    items[0];

  const a = hit.address;
  if (a) {
    const town = (a.town || a.village || a.city || '').trim();
    const concelho = (a.municipality || '').trim();
    const parts: string[] = [];
    if (town) parts.push(town);
    if (concelho && concelho !== town) parts.push(concelho);
    let addressLine = parts.join(', ').trim();
    if (addressLine.length < 3 && typeof hit.display_name === 'string') {
      addressLine = hit.display_name
        .replace(/^\s*\d{4}-\d{3}\s*,\s*/i, '')
        .replace(/,\s*Portugal\s*$/i, '')
        .trim();
    }
    if (addressLine.length < 3) return null;

    const region = mapPortugalPlaceToCpcRegion(a.county || a.state, a.municipality, town || a.city);
    const regionOther =
      region === 'Outra'
        ? [town, a.municipality, a.county].filter(Boolean).join(' · ').slice(0, 80)
        : '';

    return { addressLine, region, regionOther };
  }

  if (typeof hit.display_name === 'string') {
    const addressLine = hit.display_name
      .replace(/^\s*\d{4}-\d{3}\s*,\s*/i, '')
      .replace(/,\s*Portugal\s*$/i, '')
      .trim();
    if (addressLine.length < 3) return null;
    const region = mapPortugalPlaceToCpcRegion(undefined, undefined, addressLine);
    const regionOther = region === 'Outra' ? addressLine.slice(0, 80) : '';
    return { addressLine, region, regionOther };
  }

  return null;
}

function suggestionFromPhotonProperties(
  p: NonNullable<PhotonFeature['properties']>,
  postalDigits: string,
  d7: string
): { addressLine: string; region: CpcProfileRegion; regionOther: string } | null {
  const postalExact = postalDigits === d7;
  const city = (p.city || p.locality || '').trim();
  const district = (p.district || '').trim();
  const county = (p.county || '').trim();
  const streetPart = (p.street || p.name || '').trim();
  const locality = (p.locality || p.city || p.district || '').trim();

  let addressLine: string;
  if (postalExact) {
    addressLine = [streetPart, locality].filter(Boolean).join(', ').trim() || locality || streetPart;
  } else {
    const parts = [city, district && district !== city ? district : '', county].filter(Boolean);
    addressLine = [...new Set(parts)].join(', ').trim();
    if (addressLine.length < 3) {
      addressLine = [locality, county].filter(Boolean).join(', ').trim();
    }
  }

  if (addressLine.length < 3) return null;

  const region = mapPortugalPlaceToCpcRegion(p.state, p.county, p.city || locality);
  const regionOther =
    region === 'Outra'
      ? [p.city, p.county, p.state].filter(Boolean).join(' · ').slice(0, 80) || locality.slice(0, 80)
      : '';

  return { addressLine, region, regionOther };
}

/**
 * Morada sugerida + região a partir do CEP (PT).
 * 1) Nominatim (área postal: freguesia/concelho, coerente com o CEP).
 * 2) Photon (escolha por proximidade numérica do CEP; sem rua se o CEP no resultado não for exato).
 *
 * Em desenvolvimento o Vite faz proxy `/osm-nominatim` com User-Agent válido.
 */
export async function lookupAddressFromPortugalCep(cepRaw: string): Promise<{
  addressLine: string;
  region: CpcProfileRegion;
  regionOther: string;
} | null> {
  const d = cepDigitsPortugal(cepRaw);
  if (!d) return null;

  const formatted = formatPortugalCepDigits(d);

  const fromNom = await lookupFromNominatim(formatted, d);
  if (fromNom) return fromNom;

  const q = encodeURIComponent(`${formatted} Portugal`);
  const url = `https://photon.komoot.io/api/?q=${q}&limit=15`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as PhotonResponse;
  const features = data.features || [];
  const match = pickPhotonFeatureForPortugalCep(features, d);

  if (!match?.properties) return null;
  const postalDigits = postcodeDigits(match.properties);
  return suggestionFromPhotonProperties(match.properties, postalDigits, d);
}
