import { queryDocuments } from '@/integrations/firebase/firestore';

export type TrailModuleOrder = {
  order_index?: number | null;
};

export function sortTrailModules<T extends TrailModuleOrder>(modules: T[]): T[] {
  return [...modules].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

export async function queryTrailModules<T extends TrailModuleOrder>(trailId: string): Promise<T[]> {
  const modules = await queryDocuments<T>('trail_modules', [
    { field: 'trail_id', operator: '==', value: trailId },
  ]);
  return sortTrailModules(modules || []);
}
