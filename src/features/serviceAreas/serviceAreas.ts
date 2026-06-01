import { getCollection, setDocument, updateDocument } from '@/integrations/firebase/firestore';

/**
 * IDs das áreas de serviço. Mantemos 'psychology' (alinhado ao BookingServiceId existente
 * e às sessions já gravadas com service_id='psychology'). A chave i18n do nome usa
 * 'serviceAreas.psychological'.
 */
export type ServiceAreaId = 'legal' | 'psychology' | 'mediation';

export type ServiceAreaDuration = 30 | 60;

export interface ServiceArea {
  id: ServiceAreaId;
  name_key: string;
  responsible_uids: string[];
  responsible_names: string[];
  default_duration_minutes: ServiceAreaDuration;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

interface ServiceAreaSeed {
  id: ServiceAreaId;
  name_key: string;
  default_duration_minutes: ServiceAreaDuration;
}

export const SERVICE_AREA_SEEDS: ServiceAreaSeed[] = [
  { id: 'legal', name_key: 'serviceAreas.legal', default_duration_minutes: 30 },
  { id: 'psychology', name_key: 'serviceAreas.psychological', default_duration_minutes: 60 },
  { id: 'mediation', name_key: 'serviceAreas.mediation', default_duration_minutes: 30 },
];

export const SERVICE_AREA_ORDER: ServiceAreaId[] = ['legal', 'psychology', 'mediation'];

const COLLECTION = 'service_areas';

function sortByOrder(areas: ServiceArea[]): ServiceArea[] {
  return [...areas].sort((a, b) => SERVICE_AREA_ORDER.indexOf(a.id) - SERVICE_AREA_ORDER.indexOf(b.id));
}

/** Carrega as áreas de serviço do Firestore (ordenadas legal → psychology → mediation). */
export async function loadServiceAreas(): Promise<ServiceArea[]> {
  const areas = await getCollection<ServiceArea>(COLLECTION);
  return sortByOrder(areas);
}

/**
 * Garante que as 3 áreas existem. Se a coleção estiver vazia, cria o seed inicial.
 * Devolve sempre a lista final ordenada.
 */
export async function ensureServiceAreasSeeded(updatedBy: string): Promise<ServiceArea[]> {
  const existing = await loadServiceAreas();
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  await Promise.all(
    SERVICE_AREA_SEEDS.map((seed) =>
      setDocument<ServiceArea>(COLLECTION, seed.id, {
        id: seed.id,
        name_key: seed.name_key,
        responsible_uids: [],
        responsible_names: [],
        default_duration_minutes: seed.default_duration_minutes,
        is_active: true,
        created_at: now,
        updated_at: now,
        updated_by: updatedBy,
      })
    )
  );
  return loadServiceAreas();
}

export interface ServiceAreaPatch {
  responsible_uids?: string[];
  responsible_names?: string[];
  default_duration_minutes?: ServiceAreaDuration;
  is_active?: boolean;
}

/** Atualiza uma área de serviço (responsáveis, duração, ativa). */
export async function updateServiceArea(id: ServiceAreaId, patch: ServiceAreaPatch, updatedBy: string): Promise<void> {
  await updateDocument(COLLECTION, id, {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  });
}

/** Uma área só é reservável se estiver ativa E tiver pelo menos um responsável. */
export function isAreaBookable(area: ServiceArea | null | undefined): boolean {
  return !!area && area.is_active === true && Array.isArray(area.responsible_uids) && area.responsible_uids.length > 0;
}
