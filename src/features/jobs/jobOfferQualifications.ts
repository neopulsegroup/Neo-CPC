export const JOB_MIN_QUALIFICATION_VALUES = [
  'none',
  'basic',
  'secondary',
  'technical',
  'bachelor',
  'master',
  'phd',
] as const;

export type JobMinQualification = (typeof JOB_MIN_QUALIFICATION_VALUES)[number];

export const JOB_STUDY_AREA_VALUES = [
  'economics_management',
  'engineering',
  'computer_science',
  'health',
  'law',
  'arts_humanities',
  'sciences',
  'education',
  'social_sciences',
  'other',
] as const;

export type JobStudyArea = (typeof JOB_STUDY_AREA_VALUES)[number];

export function jobQualificationRequiresStudyArea(value: string | null | undefined): boolean {
  return value === 'bachelor' || value === 'master' || value === 'phd';
}

export function normalizeJobMinQualification(value: unknown): JobMinQualification {
  if (typeof value === 'string' && (JOB_MIN_QUALIFICATION_VALUES as readonly string[]).includes(value)) {
    return value as JobMinQualification;
  }
  return 'none';
}

export function normalizeJobStudyArea(value: unknown): JobStudyArea | '' {
  if (typeof value === 'string' && (JOB_STUDY_AREA_VALUES as readonly string[]).includes(value)) {
    return value as JobStudyArea;
  }
  return '';
}

type TranslateFn = { get: (key: string) => string };

export function formatJobQualificationSummary(
  t: TranslateFn,
  minimumQualification: string | null | undefined,
  studyArea: string | null | undefined,
  studyAreaOther: string | null | undefined
): string | null {
  const level = normalizeJobMinQualification(minimumQualification ?? 'none');
  if (level === 'none') return null;

  let label = t.get(`company.createJob.form.qualificationLevels.${level}`);
  if (jobQualificationRequiresStudyArea(level) && studyArea) {
    const areaKey = `company.createJob.form.studyAreas.${studyArea}`;
    const areaLabel =
      studyArea === 'other' && typeof studyAreaOther === 'string' && studyAreaOther.trim()
        ? studyAreaOther.trim()
        : t.get(areaKey);
    if (areaLabel !== areaKey) {
      label = `${label} — ${areaLabel}`;
    }
  }
  return label;
}
