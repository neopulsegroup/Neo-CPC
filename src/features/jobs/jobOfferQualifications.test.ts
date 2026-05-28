import { describe, expect, it } from 'vitest';
import {
  jobQualificationRequiresStudyArea,
  normalizeJobMinQualification,
  normalizeJobStudyArea,
} from '@/features/jobs/jobOfferQualifications';

describe('jobOfferQualifications', () => {
  it('requires study area for bachelor and above', () => {
    expect(jobQualificationRequiresStudyArea('bachelor')).toBe(true);
    expect(jobQualificationRequiresStudyArea('master')).toBe(true);
    expect(jobQualificationRequiresStudyArea('phd')).toBe(true);
    expect(jobQualificationRequiresStudyArea('secondary')).toBe(false);
    expect(jobQualificationRequiresStudyArea('none')).toBe(false);
  });

  it('normalizes unknown values safely', () => {
    expect(normalizeJobMinQualification('master')).toBe('master');
    expect(normalizeJobMinQualification('invalid')).toBe('none');
    expect(normalizeJobStudyArea('engineering')).toBe('engineering');
    expect(normalizeJobStudyArea('x')).toBe('');
  });
});
