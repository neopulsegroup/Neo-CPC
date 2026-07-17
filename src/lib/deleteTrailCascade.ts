import { deleteDocument, queryDocuments } from '@/integrations/firebase/firestore';
import { deleteTrailCoverFromStorage } from '@/lib/trailCoverStorage';
import {
  deleteTrailModuleCoverFromStorage,
  deleteTrailModulePdfFromStorage,
} from '@/lib/trailModuleStorage';
import { TRAIL_MODULE_COMMENTS_COLLECTION } from '@/lib/moduleComments';
import { queryTrailModules } from '@/lib/trailModules';

type TrailDeleteDoc = {
  id: string;
  image_path?: string | null;
  image_url?: string | null;
};

type TrailModuleDeleteDoc = {
  id: string;
  content_type?: string | null;
  cover_image_path?: string | null;
  cover_image_url?: string | null;
  content_path?: string | null;
  content_url?: string | null;
};

/**
 * Remove uma trilha e dados associados (módulos, comentários, progresso e ficheiros Storage).
 */
export async function deleteTrailCascade(trail: TrailDeleteDoc): Promise<void> {
  const trailId = trail.id;
  const modules = await queryTrailModules<TrailModuleDeleteDoc>(trailId);

  for (const module of modules) {
    try {
      await deleteTrailModuleCoverFromStorage(module.cover_image_path, module.cover_image_url);
      if (module.content_type === 'pdf') {
        await deleteTrailModulePdfFromStorage(module.content_path, module.content_url);
      }
    } catch (error) {
      console.error('Erro ao apagar ficheiros do módulo', module.id, error);
    }
    await deleteDocument('trail_modules', module.id);
  }

  const [comments, progress] = await Promise.all([
    queryDocuments<{ id: string }>(TRAIL_MODULE_COMMENTS_COLLECTION, [
      { field: 'trail_id', operator: '==', value: trailId },
    ]),
    queryDocuments<{ id: string }>('user_trail_progress', [
      { field: 'trail_id', operator: '==', value: trailId },
    ]),
  ]);

  await Promise.all([
    ...(comments ?? []).map((doc) => deleteDocument(TRAIL_MODULE_COMMENTS_COLLECTION, doc.id)),
    ...(progress ?? []).map((doc) => deleteDocument('user_trail_progress', doc.id)),
  ]);

  try {
    await deleteTrailCoverFromStorage(trail.image_path, trail.image_url);
  } catch (error) {
    console.error('Erro ao apagar capa da trilha', trailId, error);
  }

  await deleteDocument('trails', trailId);
}
