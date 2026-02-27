import React, { useState, useEffect } from 'react';
import { Home, Zap, MessageSquare, User, ArrowRight, LogOut, Clock, HeartHandshake } from 'lucide-react';
import { checkWellbeing, triggerWellbeingCheckIn, dismissWellbeingCheckIn, clearWellbeingTrigger } from './services/feedbackService';
import { getOrCreateUser, getStyleProfile, saveStyleProfile } from './services/dbService';
import { onAuthChange, signOutUser, AuthUser, logScreenView } from './services/firebaseService';
import { LoadingScreen } from './components/LoadingScreen';
import { Simulator as PracticeMode } from './components/Simulator';
import { QuickAdvisor as ResponseEngine } from './components/QuickAdvisor';
import { UserProfile } from './components/UserProfile';
import { History } from './components/History';
import { AuthModal } from './components/AuthModal';
import { AdvisoryChat } from './components/AdvisoryChat';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppState, UserStyleProfile, WellbeingState, Module } from './types';
import { Logo } from './components/Logo';
import { BottomTabBar } from './components/BottomTabBar';
import { WellbeingCheckIn } from './components/WellbeingCheckIn';
import { SideDock } from './components/SideDock';
import { StandbyScreen } from './components/StandbyScreen';

// --- MAIN APP COMPONENT ---
function App() {
  const [activeModule, setActiveModule] = useState<Module>('standby');
  const [state, setState] = useState<AppState>('landing');

  // Firebase Auth State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // User Session State (from D1)
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isBooting, setIsBooting] = useState(true);

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserStyleProfile | null>(null);

  // Wellbeing Check-in State
  const [wellbeingCheckIn, setWellbeingCheckIn] = useState<WellbeingState | null>(null);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);

      // If user signs out, clear app state
      if (!user) {
        setUserId(null);
        setUserProfile(null);
        setIsLoadingUser(false);
        setIsBooting(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Once we have a Firebase user, sync with D1 database
  useEffect(() => {
    if (!authUser) return;

    const syncUserWithDatabase = async () => {
      setIsLoadingUser(true);
      try {
        // Use Firebase UID as the identifier
        const user = await getOrCreateUser(authUser.uid, {
          email: authUser.email,
          display_name: authUser.displayName,
          photo_url: authUser.photoURL,
          provider: authUser.providerId,
        });
        setUserId(user.id);

        // Fetch style profile from D1
        try {
          const profile = await getStyleProfile(user.id);
          if (profile) {
            // Convert JSON strings back to objects if necessary
            if (typeof profile.signature_patterns === 'string') {
              profile.signature_patterns = JSON.parse(profile.signature_patterns);
            }
            if (typeof profile.raw_samples === 'string') {
              profile.raw_samples = JSON.parse(profile.raw_samples);
            }
            if (typeof profile.favorite_emojis === 'string') {
              profile.favorite_emojis = JSON.parse(profile.favorite_emojis);
            }
            // Map DB columns to UserStyleProfile type
            setUserProfile({
              emojiUsage: (profile.emoji_usage || 'minimal') as any,
              capitalization: (profile.capitalization || 'lowercase') as any,
              punctuation: (profile.punctuation || 'minimal') as any,
              averageLength: (profile.average_length || 'medium') as any,
              slangLevel: (profile.slang_level || 'casual') as any,
              signaturePatterns: profile.signature_patterns || [],
              preferredTone: profile.preferred_tone || 'playful',
              aiSummary: profile.ai_summary || undefined,
              favoriteEmojis: profile.favorite_emojis || [],
              rawSamples: profile.raw_samples || [],
            });
          }
        } catch (profileError) {
          // Profile fetch failed, but we can continue without it
          console.warn('Failed to fetch style profile (continuing without it):', profileError);
        }

        // Log screen view
        logScreenView('main_app');
      } catch (error) {
        // Database sync failed - continue without DB features
        // The app can still work with just Firebase auth
        console.error('Failed to sync user with database:', error);
        // Don't set userId, features requiring DB will show appropriate messages
      } finally {
        setIsLoadingUser(false);
        // Delay boot completion for smooth transition
        setTimeout(() => setIsBooting(false), 800);
      }
    };

    syncUserWithDatabase();
  }, [authUser]);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setActiveModule('standby');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Check wellbeing on module changes and periodically
  useEffect(() => {
    const checkAndTriggerWellbeing = () => {
      if (!authUser) return;
      const reason = checkWellbeing(authUser.uid);
      if (reason) {
        triggerWellbeingCheckIn(authUser.uid, reason);
        setWellbeingCheckIn({ triggered: true, reason });
      }
    };

    // Check when entering quick or practice mode
    if (activeModule === 'quick' || activeModule === 'simulator') {
      checkAndTriggerWellbeing();
    }

    // Also check every 10 minutes while using the app
    const interval = setInterval(checkAndTriggerWellbeing, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeModule, authUser]);

  // Handle wellbeing dismissal
  const handleWellbeingDismiss = () => {
    if (authUser) {
      clearWellbeingTrigger(authUser.uid);
    }
    setWellbeingCheckIn(null);
  };

  const handleWellbeingDismissForDay = () => {
    if (authUser) {
      dismissWellbeingCheckIn(authUser.uid, 24);
    }
    setWellbeingCheckIn(null);
  };

  // Save user profile to D1 and localStorage
  const handleSaveProfile = async (profile: UserStyleProfile) => {
    try {
      if (!userId) {
        console.error('No user ID available');
        return;
      }

      // Save to D1
      await saveStyleProfile({
        user_id: userId,
        emoji_usage: profile.emojiUsage,
        capitalization: profile.capitalization,
        punctuation: profile.punctuation,
        average_length: profile.averageLength,
        slang_level: profile.slangLevel,
        signature_patterns: profile.signaturePatterns,
        preferred_tone: profile.preferredTone,
        raw_samples: profile.rawSamples,
        ai_summary: profile.aiSummary,
        favorite_emojis: profile.favoriteEmojis,
      });

      // Also save to localStorage for offline access
      localStorage.setItem('userStyleProfile', JSON.stringify(profile));
      setUserProfile(profile);
      setActiveModule('standby');
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };

  // 1. Initial Boot (Firebase loading)
  if (authLoading) {
    return <LoadingScreen />;
  }

  // 2. Auth Required
  if (!authUser) {
    return <AuthModal onAuthSuccess={() => setActiveModule('standby')} />;
  }

  // 3. User Data Syncing
  if (isBooting) {
    return <LoadingScreen />;
  }

  return (
    <ToastProvider>
      <div className="flex h-[100dvh] w-screen bg-matte-base text-zinc-100 overflow-hidden font-sans selection:bg-white selection:text-black">

        {/* Wellbeing Check-in Modal */}
        {wellbeingCheckIn?.triggered && wellbeingCheckIn.reason && (
          <WellbeingCheckIn
            reason={wellbeingCheckIn.reason}
            onDismiss={handleWellbeingDismiss}
            onDismissForDay={handleWellbeingDismissForDay}
          />
        )}


        <SideDock activeModule={activeModule} setModule={setActiveModule} authUser={authUser} onSignOut={handleSignOut} />

        {/* MAIN CONTAINER */}
        <div className="flex-1 relative h-full flex flex-col md:p-3 lg:p-4 overflow-hidden pb-0 md:pb-3 lg:pb-4 scrollbar-hide">

          {/* VIEWPORT FRAME */}
          <div className="relative w-full flex-1 min-h-0 bg-white/[0.02] md:rounded-[2rem] md:border md:border-white/5 overflow-hidden flex flex-col md:shadow-2xl">
            {state === 'loading' && <LoadingScreen />}

            {/* DASHBOARD */}
            {activeModule === 'standby' && (
              <StandbyScreen 
                onActivate={setActiveModule} 
                hasProfile={!!(userProfile && userProfile.preferredTone)} 
                authUser={authUser} 
                userProfile={userProfile} 
                wellbeingReason={wellbeingCheckIn?.reason || null}
              />
            )}

            {/* PRACTICE MODE */}
            {activeModule === 'simulator' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <PracticeMode
                    userProfile={userProfile}
                    firebaseUid={authUser.uid}
                    userId={userId}
                    onBack={() => setActiveModule('standby')}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* ANALYZE MODE */}
            {activeModule === 'quick' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <ResponseEngine
                    onBack={() => setActiveModule('standby')}
                    userProfile={userProfile}
                    firebaseUid={authUser.uid}
                    userId={userId}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* USER PROFILE */}
            {activeModule === 'profile' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <UserProfile
                    onBack={() => setActiveModule('standby')}
                    onSave={handleSaveProfile}
                    initialProfile={userProfile}
                    userId={userId}
                    authUser={authUser}
                    onSignOut={handleSignOut}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* HISTORY */}
            {activeModule === 'history' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <History firebaseUid={authUser?.uid} onBack={() => setActiveModule('standby')} />
                </ErrorBoundary>
              </div>
            )}

            {/* ADVISORY CHAT */}
            {activeModule === 'therapist' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <AdvisoryChat onBack={() => setActiveModule('standby')} firebaseUid={authUser?.uid} />
                </ErrorBoundary>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        <BottomTabBar activeTab={activeModule} onTabChange={(tabId) => setActiveModule(tabId as Module)} />
      </div>
    </ToastProvider>
  );
}

export default App;
