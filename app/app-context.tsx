import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AuthUser,
  onAuthChange,
  signOutUser,
  logScreenView,
} from "../services/firebaseService";
import {
  getOrCreateUser,
  getStyleProfile,
  saveStyleProfile,
} from "../services/dbService";
import {
  checkWellbeing,
  clearWellbeingTrigger,
  dismissWellbeingCheckIn,
  triggerWellbeingCheckIn,
} from "../services/feedbackService";
import { UserStyleProfile, WellbeingState } from "../types";

interface AppContextValue {
  authUser: AuthUser | null;
  authLoading: boolean;
  userId: number | null;
  userProfile: UserStyleProfile | null;
  saveUserProfile: (profile: UserStyleProfile) => Promise<void>;
  signOut: () => Promise<void>;
  wellbeingCheckIn: WellbeingState | null;
  runWellbeingCheck: () => void;
  dismissWellbeing: () => void;
  dismissWellbeingForDay: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const parseJsonArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapDbProfileToUserProfile = (profile: Record<string, unknown>): UserStyleProfile => ({
  emojiUsage: (profile.emoji_usage as UserStyleProfile["emojiUsage"]) || "minimal",
  capitalization: (profile.capitalization as UserStyleProfile["capitalization"]) || "lowercase",
  punctuation: (profile.punctuation as UserStyleProfile["punctuation"]) || "minimal",
  averageLength: (profile.average_length as UserStyleProfile["averageLength"]) || "medium",
  slangLevel: (profile.slang_level as UserStyleProfile["slangLevel"]) || "casual",
  signaturePatterns: parseJsonArray(profile.signature_patterns),
  preferredTone: (profile.preferred_tone as UserStyleProfile["preferredTone"]) || "playful",
  aiSummary: (profile.ai_summary as string | undefined) || undefined,
  favoriteEmojis: parseJsonArray(profile.favorite_emojis),
  rawSamples: parseJsonArray(profile.raw_samples),
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserStyleProfile | null>(null);
  const [wellbeingCheckIn, setWellbeingCheckIn] = useState<WellbeingState | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (!user) {
        setUserId(null);
        setUserProfile(null);
        setWellbeingCheckIn(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    let alive = true;

    const sync = async () => {
      try {
        const user = await getOrCreateUser(authUser.uid, {
          email: authUser.email,
          display_name: authUser.displayName,
          photo_url: authUser.photoURL,
          provider: authUser.providerId,
        });
        if (!alive) return;
        setUserId(user.id);

        const profile = await getStyleProfile(user.id);
        if (!alive) return;
        if (profile) {
          setUserProfile(mapDbProfileToUserProfile(profile as unknown as Record<string, unknown>));
        } else {
          const local = localStorage.getItem("userStyleProfile");
          if (local) {
            try {
              setUserProfile(JSON.parse(local) as UserStyleProfile);
            } catch {
              setUserProfile(null);
            }
          }
        }
        logScreenView("home");
      } catch {
        // Keep the app usable even when DB sync fails.
      }
    };

    sync();
    return () => {
      alive = false;
    };
  }, [authUser]);

  const runWellbeingCheck = useCallback(() => {
    if (!authUser) return;
    const reason = checkWellbeing(authUser.uid);
    if (!reason) return;
    triggerWellbeingCheckIn(authUser.uid, reason);
    setWellbeingCheckIn({ triggered: true, reason });
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    const interval = setInterval(runWellbeingCheck, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authUser, runWellbeingCheck]);

  const saveUserProfile = useCallback(
    async (profile: UserStyleProfile) => {
      if (!userId) throw new Error("No user ID available");
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
      localStorage.setItem("userStyleProfile", JSON.stringify(profile));
      setUserProfile(profile);
    },
    [userId]
  );

  const signOut = useCallback(async () => {
    await signOutUser();
    setUserId(null);
    setUserProfile(null);
    setWellbeingCheckIn(null);
  }, []);

  const dismissWellbeing = useCallback(() => {
    if (!authUser) return;
    clearWellbeingTrigger(authUser.uid);
    setWellbeingCheckIn(null);
  }, [authUser]);

  const dismissWellbeingForDay = useCallback(() => {
    if (!authUser) return;
    dismissWellbeingCheckIn(authUser.uid, 24);
    setWellbeingCheckIn(null);
  }, [authUser]);

  const value = useMemo<AppContextValue>(
    () => ({
      authUser,
      authLoading,
      userId,
      userProfile,
      saveUserProfile,
      signOut,
      wellbeingCheckIn,
      runWellbeingCheck,
      dismissWellbeing,
      dismissWellbeingForDay,
    }),
    [
      authUser,
      authLoading,
      userId,
      userProfile,
      saveUserProfile,
      signOut,
      wellbeingCheckIn,
      runWellbeingCheck,
      dismissWellbeing,
      dismissWellbeingForDay,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
};
