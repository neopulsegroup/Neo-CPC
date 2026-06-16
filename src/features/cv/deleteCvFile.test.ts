import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseError } from 'firebase/app';

const mockDeleteObject = vi.fn();

vi.mock('firebase/storage', () => ({
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}));

vi.mock('@/integrations/firebase/client', () => ({
  storage: { _storage: true },
}));

import { deleteMigrantUserCvFiles } from './deleteCvFile';

describe('deleteMigrantUserCvFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteObject.mockResolvedValue(undefined);
  });

  it('tenta apagar todas as extensões conhecidas do migrante', async () => {
    await deleteMigrantUserCvFiles('user-1');
    expect(mockDeleteObject).toHaveBeenCalledTimes(3);
  });

  it('ignora object-not-found', async () => {
    mockDeleteObject.mockRejectedValue(new FirebaseError('storage/object-not-found', 'missing'));
    await expect(deleteMigrantUserCvFiles('user-1')).resolves.toBeUndefined();
  });
});
