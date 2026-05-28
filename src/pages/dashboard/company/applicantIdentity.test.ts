import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from '@/integrations/firebase/firestore';
import { loadApplicantIdentityMap } from '@/pages/dashboard/company/applicantIdentity';

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: vi.fn(),
}));

describe('loadApplicantIdentityMap', () => {
  beforeEach(() => {
    vi.mocked(getDocument).mockReset();
  });

  it('marks profile as unavailable when read fails', async () => {
    vi.mocked(getDocument).mockRejectedValue(new Error('permission-denied'));

    const map = await loadApplicantIdentityMap(['uid-abc12345'], 'Desconhecido');
    const row = map.get('uid-abc12345');

    expect(row?.profileUnavailable).toBe(true);
    expect(row?.name).toContain('Desconhecido');
  });

  it('marks profile as available when read succeeds', async () => {
    vi.mocked(getDocument).mockResolvedValue({
      id: 'uid-abc12345',
      name: 'Ana Silva',
      email: 'ana@example.com',
    });

    const map = await loadApplicantIdentityMap(['uid-abc12345'], 'Desconhecido');
    const row = map.get('uid-abc12345');

    expect(row?.profileUnavailable).toBe(false);
    expect(row?.name).toBe('Ana Silva');
    expect(row?.email).toBe('ana@example.com');
  });
});
