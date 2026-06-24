import { SCAS_DOMAINS, type ScasDomain } from '@/lib/scas';
import type { ScasAssessmentDoc, ScasParticipantSummary } from '@/lib/scas/repository';

function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * CSV comparativo T0 vs T-PDI por domínio + global e variação, para os
 * Relatórios de Execução e Impacto (REI) à EMPIS.
 */
export function buildParticipantScasCsv(
  participantName: string,
  summary: ScasParticipantSummary
): string {
  const { t0, latestFinal, improvement } = summary;
  const header = ['participante', 'metrica', 'T0', 'T_PDI', 'variacao_%'];
  const rows: string[][] = [header];

  const domainScore = (a: ScasAssessmentDoc | null, domain: ScasDomain): number | null => {
    if (!a) return null;
    const key = `score_${domain.toLowerCase()}` as keyof ScasAssessmentDoc;
    const value = a[key];
    return typeof value === 'number' ? value : null;
  };

  for (const domain of SCAS_DOMAINS) {
    rows.push([
      participantName,
      domain,
      domainScore(t0, domain)?.toFixed(2) ?? '',
      domainScore(latestFinal, domain)?.toFixed(2) ?? '',
      '',
    ]);
  }

  rows.push([
    participantName,
    'global',
    t0?.score_global?.toFixed(2) ?? '',
    latestFinal?.score_global?.toFixed(2) ?? '',
    improvement ? improvement.variationPercent.toFixed(2) : '',
  ]);

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
