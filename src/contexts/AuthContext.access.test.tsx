import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const mockLoginUser = vi.fn();
const mockLogoutUser = vi.fn();
const mockGetUserProfile = vi.fn();

const mockOnAuthStateChanged = vi.fn();

const mockDoc = vi.fn();
let snapshotCallback: ((snap: { exists: () => boolean; data: () => unknown }) => void) | null = null;
const mockOnSnapshot = vi.fn((_ref: unknown, cb: (snap: { exists: () => boolean; data: () => unknown }) => void) => {
  snapshotCallback = cb;
  return () => {};
});

const mockGetDocument = vi.fn();

vi.mock('@/integrations/firebase/client', () => ({
  auth: {},
  db: {},
  storage: {},
}));

vi.mock('@/integrations/firebase/auth', () => ({
  loginUser: (...args: unknown[]) => mockLoginUser(...args),
  logoutUser: (...args: unknown[]) => mockLogoutUser(...args),
  getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  registerUser: vi.fn(),
}));

vi.mock('@/integrations/firebase/firestore', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

function Harness() {
  const { login, accessIssue } = useAuth();
  const [result, setResult] = useState('');
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void login('user@test.com', 'password')
            .then(() => setResult('ok'))
            .catch((e: unknown) => setResult(e instanceof Error ? e.message : 'error'));
        }}
      >
        Login
      </button>
      <div data-testid="issue">{accessIssue ?? ''}</div>
      <div data-testid="result">{result}</div>
    </div>
  );
}

describe('AuthContext - controlo de acesso (blocked/active)', () => {
  beforeEach(() => {
    snapshotCallback = null;
    mockLoginUser.mockReset();
    mockLogoutUser.mockReset().mockResolvedValue(undefined);
    mockGetUserProfile.mockReset();
    mockGetDocument.mockReset().mockResolvedValue(null);
    mockDoc.mockReset();
    mockOnSnapshot.mockReset().mockImplementation((_ref: unknown, cb: (snap: { exists: () => boolean; data: () => unknown }) => void) => {
      snapshotCallback = cb;
      return () => {};
    });
    mockOnAuthStateChanged.mockReset().mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb(null);
      return () => {};
    });
  });

  it('bloqueia login quando o user está blocked=true', async () => {
    mockLoginUser.mockResolvedValue({ uid: 'u1' });
    mockGetUserProfile.mockResolvedValue({
      email: 'user@test.com',
      name: 'User',
      role: 'migrant',
      blocked: true,
      active: true,
      createdAt: null,
      updatedAt: null,
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByTestId('result').textContent).toBe('ACCOUNT_BLOCKED');
    });
    expect(screen.getByTestId('issue').textContent).toBe('blocked');
    expect(mockLogoutUser).toHaveBeenCalled();
  });

  it('bloqueia login quando o user está active=false', async () => {
    mockLoginUser.mockResolvedValue({ uid: 'u1' });
    mockGetUserProfile.mockResolvedValue({
      email: 'user@test.com',
      name: 'User',
      role: 'mediator',
      blocked: false,
      active: false,
      createdAt: null,
      updatedAt: null,
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByTestId('result').textContent).toBe('ACCOUNT_DISABLED');
    });
    expect(screen.getByTestId('issue').textContent).toBe('disabled');
    expect(mockLogoutUser).toHaveBeenCalled();
  });

  it('faz logout em tempo real quando o status muda para bloqueado', async () => {
    mockOnAuthStateChanged.mockReset().mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb({ uid: 'u1' });
      return () => {};
    });

    mockGetUserProfile.mockResolvedValue({
      email: 'user@test.com',
      name: 'User',
      role: 'migrant',
      blocked: false,
      active: true,
      createdAt: null,
      updatedAt: null,
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    const cb = snapshotCallback;
    expect(cb).not.toBeNull();

    cb?.({
      exists: () => true,
      data: () => ({
        email: 'user@test.com',
        name: 'User',
        role: 'migrant',
        blocked: true,
        active: true,
        createdAt: null,
        updatedAt: null,
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId('issue').textContent).toBe('blocked');
    });
    expect(mockLogoutUser).toHaveBeenCalled();
  });
});
