import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth } from '@/integrations/firebase/client';
import { db } from '@/integrations/firebase/client';
import {
  registerUser,
  loginUser,
  logoutUser,
  getUserProfile,
  UserProfile,
} from '@/integrations/firebase/auth';
import { getDocument, setDocument } from '@/integrations/firebase/firestore';

export type UserRole = 'migrant' | 'company' | 'admin' | 'mediator' | 'lawyer' | 'psychologist' | 'manager' | 'coordinator' | 'trainer';

export interface Profile {
  name: string;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  nationality?: string | null;
  photoUrl?: string | null;
  currentLocation?: string | null;
  arrivalDate?: string | null;
}

export interface TriageData {
  userId: string;
  completed: boolean;
  answers?: Record<string, unknown>;
  location?: string | null;
  arrivalDate?: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  profileData: Profile | null;
  triage: TriageData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessIssue: 'blocked' | 'disabled' | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAccessIssue: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  nif?: string;
  /**
   * TASK-05: área de atividade obrigatória para empresa (label em PT
   * já resolvido; "Outro" passa o texto livre digitado).
   * Opcional aqui para não quebrar callers de outros roles.
   */
  activityArea?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [triage, setTriage] = useState<TriageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessIssue, setAccessIssue] = useState<'blocked' | 'disabled' | null>(null);

  const clearAccessIssue = useCallback(() => {
    setAccessIssue(null);
  }, []);

  const getAccessIssue = useCallback((p: UserProfile | null): 'blocked' | 'disabled' | null => {
    if (!p) return null;
    if (p.blocked === true) return 'blocked';
    if (p.active === false) return 'disabled';
    return null;
  }, []);

  const fetchUserData = useCallback(async (firebaseUser: FirebaseUser) => {
    try {
      // Fetch user profile
      const userProfile = await getUserProfile(firebaseUser.uid);
      if (!userProfile) {
        await logoutUser();
        setUser(null);
        setProfile(null);
        setProfileData(null);
        setTriage(null);
        return;
      }

      const issue = getAccessIssue(userProfile);
      if (issue) {
        setAccessIssue(issue);
        await logoutUser();
        setUser(null);
        setProfile(null);
        setProfileData(null);
        setTriage(null);
        return;
      }
      setProfile(userProfile);

      if (userProfile.role === 'company') {
        try {
          // Espelha o papel em profiles para as regras Firestore (employerRoleOnProfileDoc) quando users tiver campos atípicos.
          await setDocument('profiles', firebaseUser.uid, { role: 'company' }, true);
        } catch (error) {
          console.error('Error syncing company role to profile:', error);
        }
        try {
          const existingCompany = await getDocument<Record<string, unknown>>('companies', firebaseUser.uid);
          const baseName =
            (typeof userProfile.name === 'string' && userProfile.name.trim() ? userProfile.name.trim() : null) ??
            (typeof firebaseUser.displayName === 'string' && firebaseUser.displayName.trim() ? firebaseUser.displayName.trim() : null) ??
            firebaseUser.email ??
            'Empresa';

          if (!existingCompany) {
            await setDocument(
              'companies',
              firebaseUser.uid,
              {
                user_id: firebaseUser.uid,
                company_name: baseName,
                verified: false,
                createdAt: new Date().toISOString(),
              },
              false
            );
          } else {
            const patch: Record<string, unknown> = {};
            if (existingCompany.user_id !== firebaseUser.uid) patch.user_id = firebaseUser.uid;
            if (typeof existingCompany.company_name !== 'string' || !existingCompany.company_name.trim()) patch.company_name = baseName;
            if (typeof existingCompany.verified !== 'boolean') patch.verified = false;
            if (Object.keys(patch).length > 0) {
              await setDocument('companies', firebaseUser.uid, patch, true);
            }
          }
        } catch (error) {
          console.error('Error ensuring company profile:', error);
        }
      }

      // Fetch profile data
      try {
        const profileDoc = await getDocument<Profile>('profiles', firebaseUser.uid);
        if (profileDoc) {
          setProfileData(profileDoc);
        } else {
          setProfileData(null);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
        setProfileData(null);
      }

      // Fetch triage data
      try {
        const triageDoc = await getDocument<TriageData>('triage', firebaseUser.uid);
        if (triageDoc) {
          setTriage(triageDoc);
        } else {
          setTriage({
            userId: firebaseUser.uid,
            completed: false
          });
        }
      } catch (error) {
        console.error('Error fetching triage data:', error);
        setTriage({
          userId: firebaseUser.uid,
          completed: false
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, [getAccessIssue]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserData(user);
    }
  }, [user, fetchUserData]);

  useEffect(() => {
    let mounted = true;

    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      try {
        setIsLoading(true);
        setUser(firebaseUser);

        if (firebaseUser) {
          await fetchUserData(firebaseUser);
        } else {
          setProfile(null);
          setProfileData(null);
          setTriage(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [fetchUserData]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as UserProfile;
        const issue = getAccessIssue(data);
        if (issue) {
          setAccessIssue(issue);
          await logoutUser();
          setUser(null);
          setProfile(null);
          setProfileData(null);
          setTriage(null);
          return;
        }
        setProfile(data);
      },
      (error) => {
        console.error('Error listening user status:', error);
      }
    );
    return () => unsubscribe();
  }, [getAccessIssue, user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setAccessIssue(null);
      const firebaseUser = await loginUser(email, password);
      const userProfile = await getUserProfile(firebaseUser.uid);
      const issue = getAccessIssue(userProfile);
      if (issue) {
        setAccessIssue(issue);
        await logoutUser();
        setUser(null);
        setProfile(null);
        setProfileData(null);
        setTriage(null);
        throw new Error(issue === 'blocked' ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_DISABLED');
      }
      // onAuthStateChanged will handle the rest
    } catch (error: unknown) {
      console.error('Login error:', error);
      throw new Error(getErrorMessage(error, 'Failed to login'));
    }
  }, [getAccessIssue]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      await registerUser(data.email, data.password, data.name, data.role, {
        nif: data.nif,
        activityArea: data.activityArea,
      });
      // onAuthStateChanged will handle the rest
    } catch (error: unknown) {
      console.error('Registration error:', error);
      throw new Error(getErrorMessage(error, 'Failed to register'));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
      setUser(null);
      setProfile(null);
      setProfileData(null);
      setTriage(null);
    } catch (error: unknown) {
      console.error('Logout error:', error);
      throw new Error(getErrorMessage(error, 'Failed to logout'));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileData,
        triage,
        isAuthenticated: !!user,
        isLoading,
        accessIssue,
        login,
        register,
        logout,
        refreshProfile,
        clearAccessIssue,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
