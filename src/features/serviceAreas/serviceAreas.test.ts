import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/firebase/firestore', () => ({
  getCollection: vi.fn(),
  setDocument: vi.fn(async () => undefined),
  updateDocument: vi.fn(async () => undefined),
}));

import { getCollection, setDocument, updateDocument } from '@/integrations/firebase/firestore';
import {
  loadServiceAreas,
  ensureServiceAreasSeeded,
  updateServiceArea,
  isAreaBookable,
  type ServiceArea,
} from './serviceAreas';

const mockGetCollection = getCollection as unknown as { mockResolvedValueOnce: (v: unknown) => void; mockResolvedValue: (v: unknown) => void };

function area(partial: Partial<ServiceArea> & { id: ServiceArea['id'] }): ServiceArea {
  return {
    name_key: `serviceAreas.${partial.id}`,
    responsible_uids: [],
    responsible_names: [],
    default_duration_minutes: 30,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: 'admin',
    ...partial,
  };
}

describe('serviceAreas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadServiceAreas devolve as 3 áreas ordenadas (legal → psychology → mediation)', async () => {
    mockGetCollection.mockResolvedValue([
      area({ id: 'mediation' }),
      area({ id: 'legal' }),
      area({ id: 'psychology' }),
    ]);
    const result = await loadServiceAreas();
    expect(result.map((a) => a.id)).toEqual(['legal', 'psychology', 'mediation']);
  });

  it('ensureServiceAreasSeeded cria as 3 áreas quando a coleção está vazia', async () => {
    // 1ª chamada (loadServiceAreas dentro de ensure) vazia; 2ª chamada devolve seed.
    mockGetCollection.mockResolvedValueOnce([]);
    mockGetCollection.mockResolvedValueOnce([area({ id: 'legal' }), area({ id: 'psychology', default_duration_minutes: 60 }), area({ id: 'mediation' })]);
    const result = await ensureServiceAreasSeeded('admin-1');
    expect(setDocument).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
    // psychology tem duração 60 no seed
    expect(result.find((a) => a.id === 'psychology')?.default_duration_minutes).toBe(60);
  });

  it('ensureServiceAreasSeeded NÃO recria quando já existem áreas', async () => {
    mockGetCollection.mockResolvedValue([area({ id: 'legal' }), area({ id: 'psychology' }), area({ id: 'mediation' })]);
    await ensureServiceAreasSeeded('admin-1');
    expect(setDocument).not.toHaveBeenCalled();
  });

  it('updateServiceArea grava responsáveis com updated_by', async () => {
    await updateServiceArea('legal', { responsible_uids: ['u1', 'u2'], responsible_names: ['A', 'B'] }, 'admin-9');
    const [collection, id, payload] = (updateDocument as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(collection).toBe('service_areas');
    expect(id).toBe('legal');
    expect((payload as { responsible_uids: string[] }).responsible_uids).toEqual(['u1', 'u2']);
    expect((payload as { updated_by: string }).updated_by).toBe('admin-9');
  });

  it('isAreaBookable: ativa com responsáveis = true; ativa sem responsáveis = false; inativa = false', () => {
    expect(isAreaBookable(area({ id: 'legal', is_active: true, responsible_uids: ['u1'] }))).toBe(true);
    expect(isAreaBookable(area({ id: 'legal', is_active: true, responsible_uids: [] }))).toBe(false);
    expect(isAreaBookable(area({ id: 'legal', is_active: false, responsible_uids: ['u1'] }))).toBe(false);
    expect(isAreaBookable(null)).toBe(false);
  });
});
