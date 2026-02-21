import {
  initializeApp,
  getApps,
  getApp,
} from 'firebase/app';
import {
  getAuth,
  Auth,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { logger } from './logger';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCm2XGzgv5Tlsm7bkw_lCYsfPaR7N3NOWQ",
  authDomain: "rizzbot-auth.firebaseapp.com",
  projectId: "rizzbot-auth",
  storageBucket: "rizzbot-auth.firebasestorage.app",
  messagingSenderId: "337505017340",
  appId: "1:337505017340:web:80ed41857a045e50e92679",
  measurementId: "G-0S5E7X2RM1",
};

// Initialize Firebase
let app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
let analytics: any = null;

// Initialize analytics only in browser environment
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: string;
}

// ============================================
// AUTH FUNCTIONS
// ============================================

/**
 * Sign up a new user with email and password
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName?: string
): Promise<AuthUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update display name if provided
    if (displayName) {
      await updateProfile(user, { displayName });
    }

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      providerId: userCredential.user.providerData[0]?.providerId || 'password',
    };
  } catch (error) {
    logger.error('Sign up error:', error);
    throw error;
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<AuthUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      providerId: userCredential.user.providerData[0]?.providerId || 'password',
    };
  } catch (error) {
    logger.error('Sign in error:', error);
    throw error;
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<AuthUser> => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      providerId: userCredential.user.providerData[0]?.providerId || 'google.com',
    };
  } catch (error) {
    logger.error('Google sign in error:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    logger.error('Password reset error:', error);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    logger.error('Sign out error:', error);
    throw error;
  }
};

/**
 * Listen to authentication state changes
 * Returns unsubscribe function
 */
export const onAuthChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      const authUser: AuthUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        providerId: firebaseUser.providerData[0]?.providerId || 'password',
      };
      callback(authUser);
    } else {
      callback(null);
    }
  });
};

/**
 * Get the current authenticated user
 */
export const getCurrentUser = (): AuthUser | null => {
  const user = auth.currentUser;
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    providerId: user.providerData[0]?.providerId || 'password',
  };
};

// ============================================
// ANALYTICS
// ============================================

/**
 * Log a screen view event
 */
export const logScreenView = (screenName: string, screenClass?: string): void => {
  if (analytics) {
    logEvent(analytics, 'screen_view', {
      firebase_screen: screenName,
      firebase_screen_class: screenClass || screenName,
    });
  }
};

/**
 * Log a custom event
 */
export const logCustomEvent = (eventName: string, eventData?: Record<string, any>): void => {
  if (analytics) {
    logEvent(analytics, eventName, eventData);
  }
};
