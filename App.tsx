import React, { useState, useEffect } from 'react';
import { checkWellbeing, triggerWellbeingCheckIn, dismissWellbeingCheckIn, clearWellbeingTrigger } from './services/feedbackService';
import { getOrCreateUser, getStyleProfile, saveStyleProfile } from './services/dbService';
import { onAuthChange, signOutUser, AuthUser, logScreenView } from './services/firebaseService';
import { LoadingScreen } from './components/LoadingScreen';
import { Simulator } from './components/Simulator';
import { QuickAdvisor } from './components/QuickAdvisor';
import { UserProfile } from './components/UserProfile';
import { History } from './components/History';
import { AuthModal } from './components/AuthModal';
import { TherapistChat } from './components/TherapistChat';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppState, UserStyleProfile, WellbeingState } from './types';
import { StandbyScreen } from './components/StandbyScreen';
import { WellbeingCheckIn } from './components/WellbeingCheckIn';
import { SystemTicker } from './components/SystemTicker';
import { MobileTabBar } from './components/navigation/MobileTabBar';
import { DesktopSideDock } from './components/navigation/DesktopSideDock';
import { CornerNodes } from './components/ui/CornerNodes';

type Module = 'standby' | 'simulator' | 'quick' | 'profile' | 'history' | 'therapist';

function App() {
  const [activeModule, setActiveModule] = useState<Module>('standby');
  const [state, setState] = useState<AppState>('landing');

  // Firebase Auth State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // User Session State (from D1)
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserStyleProfile | null>(null);

  // Wellbeing Check-in State
  const [wellbeingCheckIn, setWellbeingCheckIn] = useState<WellbeingState | null>(null);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);

      if (!user) {
        setUserId(null);
        setUserProfile(null);
        setIsLoadingUser(false);
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
        const user = await getOrCreateUser(authUser.uid, {
          email: authUser.email,
          display_name: authUser.displayName,
          photo_url: authUser.photoURL,
          provider: authUser.providerId,
        });
        setUserId(user.id);

        try {
          const profile = await getStyleProfile(user.id);
          if (profile) {
            if (typeof profile.signature_patterns === 'string') {
              profile.signature_patterns = JSON.parse(profile.signature_patterns);
            }
            if (typeof profile.raw_samples === 'string') {
              profile.raw_samples = JSON.parse(profile.raw_samples);
            }
            if (typeof profile.favorite_emojis === 'string') {
              profile.favorite_emojis = JSON.parse(profile.favorite_emojis);
            }
            setUserProfile({
              emojiUsage: (profile.emoji_usage || 'minimal') as any,
              capitalization: (profile.capitalization || 'lowercase') as any,
              punctuation: (profile.punctuation || 'minimal') as any,
              averageLength: (profile.average_length || 'medium') as any,
              slangLevel: (profile.slang_level || 'casual') as any,
              signaturePatterns: (profile.signature_patterns || []) as any,
              preferredTone: (profile.preferred_tone || 'playful') as any,
              aiSummary: profile.ai_summary || undefined,
              favoriteEmojis: (profile.favorite_emojis || []) as any,
              rawSamples: (profile.raw_samples || []) as any,
            });
          }
        } catch (profileError) {
          console.warn('Failed to fetch style profile (continuing without it):', profileError);
        }

        logScreenView('main_app');
      } catch (error) {
        console.error('Failed to sync user with database:', error);
      } finally {
        setIsLoadingUser(false);
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

    if (activeModule === 'quick' || activeModule === 'simulator') {
      checkAndTriggerWellbeing();
    }

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

      localStorage.setItem('userStyleProfile', JSON.stringify(profile));
      setUserProfile(profile);
      setActiveModule('standby');
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-[100dvh] w-screen bg-matte-base items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-4">AUTHENTICATING...</div>
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthModal onAuthSuccess={() => setActiveModule('standby')} />;
  }

  return (
    <ToastProvider>
      <div className="flex h-[100dvh] w-screen bg-matte-base text-zinc-100 overflow-hidden font-sans selection:bg-white selection:text-black">

        {/* Loading overlay while syncing user */}
        {isLoadingUser && (
          <div className="absolute inset-0 bg-black z-[999] flex items-center justify-center">
            <div className="flex flex-col items-center justify-center">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-4">SYNCING...</div>
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        {/* Wellbeing Check-in Modal */}
        {wellbeingCheckIn?.triggered && wellbeingCheckIn.reason && (
          <WellbeingCheckIn
            reason={wellbeingCheckIn.reason}
            onDismiss={handleWellbeingDismiss}
            onDismissForDay={handleWellbeingDismissForDay}
          />
        )}

        {/* Desktop Navigation */}
        <DesktopSideDock 
          activeModule={activeModule} 
          setModule={setActiveModule} 
          authUser={authUser} 
          onSignOut={handleSignOut} 
        />

        {/* Main Container */}
        <div className="flex-1 relative h-full flex flex-col md:p-3 lg:p-4 overflow-hidden pb-0 md:pb-3 lg:pb-4 scrollbar-hide">

          {/* Viewport Frame */}
          <div className="relative w-full flex-1 min-h-0 md:border md:border-zinc-800 bg-black/20 overflow-hidden flex flex-col md:shadow-2xl">
            <div className="hidden md:block">
              <CornerNodes />
            </div>

            {state === 'loading' && <LoadingScreen />}

            {/* Standby Module */}
            {activeModule === 'standby' && (
              <StandbyScreen 
                onActivate={setActiveModule} 
                hasProfile={!!(userProfile && userProfile.preferredTone)} 
                authUser={authUser} 
                userProfile={userProfile} 
              />
            )}

            {/* Simulator Module */}
            {activeModule === 'simulator' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <Simulator
                    userProfile={userProfile}
                    firebaseUid={authUser.uid}
                    userId={userId}
                    onBack={() => setActiveModule('standby')}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* Quick Module */}
            {activeModule === 'quick' && (
              <div className="h-full w-full flex flex-col animate-fade-in">
                <ErrorBoundary>
                  <QuickAdvisor
                    onBack={() => setActiveModule('standby')}
                    userProfile={userProfile}
                    firebaseUid={authUser.uid}
                    userId={userId}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* Profile Module */}
            {activeModule === 'profile' && (
              <div className="h-full w-full flex flex-col animate-fade-in">
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

            {/* History Module */}
            {activeModule === 'history' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <History firebaseUid={authUser?.uid} onBack={() => setActiveModule('standby')} />
                </ErrorBoundary>
              </div>
            )}

            {/* Therapist Module */}
            {activeModule === 'therapist' && (
              <div className="h-full w-full flex flex-col animate-fade-in">
                <ErrorBoundary>
                  <TherapistChat onBack={() => setActiveModule('standby')} firebaseUid={authUser?.uid} />
                </ErrorBoundary>
              </div>
            )}
          </div>

          {/* System Ticker - Desktop only */}
          <div className="hidden md:block">
            <SystemTicker />
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileTabBar activeTab={activeModule} onTabChange={(tabId) => setActiveModule(tabId as Module)} />
      </div>
    </ToastProvider>
  );
}

export default App;
