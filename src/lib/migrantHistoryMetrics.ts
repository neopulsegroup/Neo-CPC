import { isSessionCompletedStatus } from '@/lib/sessionApproval';

export type MigrantSessionMetric = { status?: string | null };
export type MigrantTrailProgressMetric = { progress_percent?: number | null; modules_completed?: number | null };

export function countMigrantCompletedSessions(sessions: MigrantSessionMetric[]): number {
  return sessions.filter((s) => isSessionCompletedStatus(s.status)).length;
}

export function countMigrantCompletedModules(progress: MigrantTrailProgressMetric[]): number {
  return progress.reduce((sum, row) => sum + (row.modules_completed ?? 0), 0);
}

export function computeMigrantSessionsProgressPercent(sessions: MigrantSessionMetric[]): number {
  if (sessions.length === 0) return 0;
  const done = countMigrantCompletedSessions(sessions);
  return Math.min(100, Math.round((done / sessions.length) * 100));
}

export function computeMigrantOverallProgressPercent(parts: {
  trailsProgressAvg: number;
  sessionsProgress: number;
  profileCompleteness: number;
  triageProgress: number;
}): number {
  const values = [parts.trailsProgressAvg, parts.sessionsProgress, parts.profileCompleteness, parts.triageProgress];
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
