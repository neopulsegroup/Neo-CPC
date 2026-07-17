import { queryDocuments } from '@/integrations/firebase/firestore';

export const TRAIL_MODULE_COMMENTS_COLLECTION = 'trail_module_comments';

export type ModuleCommentStatus = 'pending' | 'approved' | 'rejected';

export type TrailModuleComment = {
  id: string;
  trail_id: string;
  module_id: string;
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
  content: string;
  status: ModuleCommentStatus;
  created_at: string;
  moderated_at?: string | null;
  moderated_by?: string | null;
};

export function sortCommentsNewestFirst(comments: TrailModuleComment[]): TrailModuleComment[] {
  return [...comments].sort((a, b) => {
    const tb = Date.parse(b.created_at || '');
    const ta = Date.parse(a.created_at || '');
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

export function isCommentVisibleToViewer(comment: TrailModuleComment, viewerUid?: string | null): boolean {
  if (comment.status === 'approved') return true;
  if (!viewerUid) return false;
  return comment.user_id === viewerUid;
}

export function filterCommentsForViewer(
  comments: TrailModuleComment[],
  viewerUid?: string | null
): TrailModuleComment[] {
  return sortCommentsNewestFirst(comments.filter((comment) => isCommentVisibleToViewer(comment, viewerUid)));
}

export function getCommentStatusLabel(status: ModuleCommentStatus): string | null {
  if (status === 'pending') return 'Em moderação';
  if (status === 'rejected') return 'Não aprovado';
  return null;
}

export function buildNewModuleCommentPayload(args: {
  trailId: string;
  moduleId: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
}): Omit<TrailModuleComment, 'id'> {
  return {
    trail_id: args.trailId,
    module_id: args.moduleId,
    user_id: args.userId,
    user_name: args.userName,
    avatar_url: args.avatarUrl ?? null,
    content: args.content.trim(),
    status: 'pending',
    created_at: new Date().toISOString(),
    moderated_at: null,
    moderated_by: null,
  };
}

/**
 * Carrega comentários visíveis ao migrante, alinhado às regras Firestore:
 * - status == 'approved' (todos leem)
 * - ou user_id == viewerUid (próprios pending/rejected)
 *
 * Uma query só por `module_id` falha com permission-denied porque pode
 * incluir pending/rejected de outros autores.
 */
export async function queryModuleComments(
  moduleId: string,
  viewerUid?: string | null
): Promise<TrailModuleComment[]> {
  const approvedPromise = queryDocuments<TrailModuleComment>(TRAIL_MODULE_COMMENTS_COLLECTION, [
    { field: 'module_id', operator: '==', value: moduleId },
    { field: 'status', operator: '==', value: 'approved' },
  ]);

  const ownPromise = viewerUid
    ? queryDocuments<TrailModuleComment>(TRAIL_MODULE_COMMENTS_COLLECTION, [
        { field: 'module_id', operator: '==', value: moduleId },
        { field: 'user_id', operator: '==', value: viewerUid },
      ])
    : Promise.resolve([] as TrailModuleComment[]);

  const [approved, own] = await Promise.all([approvedPromise, ownPromise]);
  const byId = new Map<string, TrailModuleComment>();
  for (const doc of [...(approved ?? []), ...(own ?? [])]) {
    byId.set(doc.id, doc);
  }
  return filterCommentsForViewer(Array.from(byId.values()), viewerUid);
}

export async function queryPendingTrailComments(trailId: string): Promise<TrailModuleComment[]> {
  const docs = await queryDocuments<TrailModuleComment>(TRAIL_MODULE_COMMENTS_COLLECTION, [
    { field: 'trail_id', operator: '==', value: trailId },
    { field: 'status', operator: '==', value: 'pending' },
  ]);
  return sortCommentsNewestFirst(docs || []);
}
