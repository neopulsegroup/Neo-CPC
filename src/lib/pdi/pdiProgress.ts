import type { PdiTrilhaEntry } from './types';
import { includedTrilhas } from './generation';

export interface TrailProgressRow {
  trail_id: string;
  progress_percent?: number | null;
  completed_at?: string | null;
  started_at?: string | null;
}

export interface PdiTrailProgressDetail {
  trail_id: string;
  percent: number;
  completed: boolean;
  inProgress: boolean;
  completed_at: string | null;
}

export interface PdiTrailProgressSummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overallPercent: number;
  details: PdiTrailProgressDetail[];
}

export function computePdiTrailProgress(
  trilhas: PdiTrilhaEntry[],
  progressRows: TrailProgressRow[]
): PdiTrailProgressSummary {
  const included = includedTrilhas(trilhas);
  const byTrail = new Map(progressRows.map((p) => [p.trail_id, p]));

  const details: PdiTrailProgressDetail[] = included.map((tr) => {
    const prog = byTrail.get(tr.trail_id);
    const percent = typeof prog?.progress_percent === 'number' ? prog.progress_percent : 0;
    const completed = !!prog?.completed_at;
    return {
      trail_id: tr.trail_id,
      percent: completed ? 100 : Math.max(0, Math.min(100, percent)),
      completed,
      inProgress: !completed && percent > 0,
      completed_at: prog?.completed_at ?? null,
    };
  });

  const completed = details.filter((d) => d.completed).length;
  const inProgress = details.filter((d) => d.inProgress).length;

  return {
    total: details.length,
    completed,
    inProgress,
    notStarted: details.length - completed - inProgress,
    overallPercent: details.length > 0 ? Math.round((completed / details.length) * 100) : 0,
    details,
  };
}
