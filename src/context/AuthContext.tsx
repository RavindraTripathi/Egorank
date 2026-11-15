import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { fetchProfileByUid, fetchUserNotifications } from '../lib/firestoreService';
import { NotificationRecord, Profile } from '../types/egorank';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  notifications: NotificationRecord[];
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
  loginWithGoogle: () => Promise<User>;
  loginWithEmail: (email: string, password: string) => Promise<User>;
  registerWithEmail: (email: string, password: string) => Promise<User>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BOOTSTRAP_ADMIN_EMAIL = 'tripathiravindra212@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setProfile(null);
      setNotifications([]);
      setIsAdmin(false);
      return;
    }

    const bootstrapAdmin =
      firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL && firebaseUser.emailVerified;

    let adminDocExists = false;
    if (firebaseUser.emailVerified) {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        adminDocExists = adminSnap.exists();
      } catch {
        adminDocExists = false;
      }
    }
    setIsAdmin(bootstrapAdmin || adminDocExists);

    try {
      const p = await fetchProfileByUid(firebaseUser.uid);
      setProfile(p);
    } catch {
      setProfile(null);
    }

    if (firebaseUser.emailVerified) {
      try {
        const notifs = await fetchUserNotifications(firebaseUser.uid);
        setNotifications(notifs);
      } catch {
        setNotifications([]);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      await loadUserData(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, [loadUserData]);

  const refreshProfile = useCallback(async () => {
    await loadUserData(auth.currentUser);
  }, [loadUserData]);

  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser } as User);
      await loadUserData(auth.currentUser);
    }
  }, [loadUserData]);

  const loginWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    await loadUserData(cred.user);
    return cred.user;
  };

  const loginWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await loadUserData(cred.user);
    return cred.user;
  };

  const registerWithEmail = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // Non-blocking verification email trigger
    }
    await loadUserData(cred.user);
    return cred.user;
  };

  const sendResetEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setNotifications([]);
    setIsAdmin(false);
  };

  const getIdToken = async () => {
    if (!auth.currentUser) throw new Error('You must sign in first.');
    return auth.currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        notifications,
        loading,
        isAdmin,
        refreshProfile,
        refreshUser,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendResetEmail,
        resendVerification,
        logout,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
