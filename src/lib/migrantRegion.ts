export type MigrantRegion = 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Desconhecida';

export type MigrantRegionFilter = 'all' | MigrantRegion;

export const MIGRANT_REGION_FILTER_OPTIONS: MigrantRegion[] = [
  'Lisboa',
  'Norte',
  'Centro',
  'Alentejo',
  'Algarve',
  'Desconhecida',
];

export type MigrantProfileRegionSource = {
  region?: 'Lisboa' | 'Norte' | 'Centro' | 'Alentejo' | 'Algarve' | 'Outra' | null;
  regionOther?: string | null;
  currentLocation?: string | null;
};

function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function mapLocationToRegion(value?: string | null): MigrantRegion {
  const v = normalizeText(value);
  if (!v) return 'Desconhecida';
  const match = (tokens: string[]) => tokens.some((t) => v.includes(t));
  if (match(['lisboa', 'lx', 'amadora', 'sintra', 'odivelas', 'loures', 'oeiras', 'cascais', 'mafra', 'vila franca'])) return 'Lisboa';
  if (match(['porto', 'braga', 'vila real', 'braganca', 'viana do castelo', 'ave', 'minho', 'douro'])) return 'Norte';
  if (match(['aveiro', 'coimbra', 'leiria', 'viseu', 'castelo branco', 'guarda', 'regiao centro', 'centro'])) return 'Centro';
  if (match(['portalegre', 'evora', 'beja', 'alentejo'])) return 'Alentejo';
  if (match(['faro', 'albufeira', 'portimao', 'lagos', 'algarve'])) return 'Algarve';
  return 'Desconhecida';
}

/** Região efetiva do migrante a partir do perfil cadastrado (`profiles`). */
export function mapProfileToRegion(profile?: MigrantProfileRegionSource | null): MigrantRegion {
  const region = profile?.region ?? null;
  if (region === 'Lisboa' || region === 'Norte' || region === 'Centro' || region === 'Alentejo' || region === 'Algarve') {
    return region;
  }
  if (region === 'Outra') {
    const fromOther = mapLocationToRegion(profile?.regionOther ?? null);
    if (fromOther !== 'Desconhecida') return fromOther;
  }
  return mapLocationToRegion(profile?.currentLocation ?? null);
}
