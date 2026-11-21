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
import { clearUserSessionState } from "./utils/useSessionState";
import {
  getOrCreateUser,
  getStyleProfile,
  saveStyleProfile,
  flushPendingSessions,
} from "../services/dbService";
import {
  checkWellbeing,
  clearWellbeingTrigger,
  dismissWellbeingCheckIn,
  triggerWellbeingCheckIn,
} from "../services/feedbackService";
import { UserStyleProfile, WellbeingState } from "../types";
import { AppSettingsWire, getAppSettings, updateAppSettings } from "../services/chatApi";

const DEFAULT_APP_SETTINGS: AppSettingsWire = {
  vibe: "unfiltered",
  autoLearnVoice: true,
  autoSaveMemory: true,
  hapticsEnabled: true,
  memoryCount: 0,
  memoryCap: 40,
  threadCount: 0,
};

interface AppContextValue {
  authUser: AuthUser | null;
  authLoading: boolean;
  userId: number | null;
  userProfile: UserStyleProfile | null;
  appSettings: AppSettingsWire;
  refreshAppSettings: () => Promise<void>;
  saveAppSettings: (
    patch: Partial<Pick<AppSettingsWire, "vibe" | "autoLearnVoice" | "autoSaveMemory" | "hapticsEnabled">>
  ) => Promise<void>;
  saveUserProfile: (profile: UserStyleProfile) => Promise<void>;
  applyLearnedProfile: (profile: UserStyleProfile) => void;
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
  responseSpeed: (profile.response_speed as UserStyleProfile["responseSpeed"] | undefined) || undefined,
  flirtLevel: (profile.flirt_level as UserStyleProfile["flirtLevel"] | undefined) || undefined,
  humorStyle: (profile.humor_style as UserStyleProfile["humorStyle"] | undefined) || undefined,
  energy: (profile.energy as UserStyleProfile["energy"] | undefined) || undefined,
  learnedSamples: parseJsonArray(profile.learned_samples),
  cadenceNotes: (profile.cadence_notes as string | undefined) || undefined,
  sampleCount: typeof profile.sample_count === 'number' ? profile.sample_count : parseJsonArray(profile.learned_samples).length,
  updatedAt: profile.updated_at ? new Date(profile.updated_at as string).getTime() : undefined,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<UserStyleProfile | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettingsWire>(() => {
    try {
      const h = localStorage.getItem("rizzbot_haptics");
      return h === "off" ? { ...DEFAULT_APP_SETTINGS, hapticsEnabled: false } : DEFAULT_APP_SETTINGS;
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  });
  const [wellbeingCheckIn, setWellbeingCheckIn] = useState<WellbeingState | null>(null);

  const syncHapticsCache = (enabled: boolean) => {
    try { localStorage.setItem("rizzbot_haptics", enabled ? "on" : "off"); } catch { /* ignore */ }
  };

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (!user) {
        setUserId(null);
        setUserProfile(null);
        setAppSettings(DEFAULT_APP_SETTINGS);
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

        // Retry any sessions that failed to save offline
        void flushPendingSessions().catch(() => {});

        void getAppSettings()
          .then((s) => {
            if (!alive) return;
            setAppSettings(s);
            syncHapticsCache(s.hapticsEnabled);
          })
          .catch(() => {});

        const profile = await getStyleProfile(user.id);
        if (!alive) return;
        if (profile) {
          setUserProfile(mapDbProfileToUserProfile(profile as unknown as Record<string, unknown>));
        } else {
          const local = localStorage.getItem(`userStyleProfile_${authUser.uid}`);
          if (local) {
            try {
              setUserProfile(JSON.parse(local) as UserStyleProfile);
            } catch {
              setUserProfile(null);
            }
          }
        }
        logScreenView("chat");
      } catch {
        // DB sync failed (offline/error) — fall back to the cached local profile
        const local = localStorage.getItem(`userStyleProfile_${authUser.uid}`);
        if (local) {
          try {
            setUserProfile(JSON.parse(local) as UserStyleProfile);
          } catch {
            setUserProfile(null);
          }
        }
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
        response_speed: profile.responseSpeed,
        flirt_level: profile.flirtLevel,
        humor_style: profile.humorStyle,
        energy: profile.energy,
        learned_samples: profile.learnedSamples ?? [],
        cadence_notes: profile.cadenceNotes ?? '',
        sample_count: profile.sampleCount ?? 0,
      });
      try {
        localStorage.setItem(`userStyleProfile_${authUser?.uid || "anon"}`, JSON.stringify(profile));
      } catch {
        // Quota exceeded — DB copy is the source of truth
      }
      setUserProfile(profile);
    },
    [userId, authUser?.uid]
  );

  const applyLearnedProfile = useCallback(
    (profile: UserStyleProfile) => {
      setUserProfile((prev) => {
        const merged: UserStyleProfile = {
          ...(prev || profile),
          ...profile,
        };
        try {
          localStorage.setItem(`userStyleProfile_${authUser?.uid || "anon"}`, JSON.stringify(merged));
        } catch {
          // Ignore quota errors
        }
        return merged;
      });
    },
    [authUser?.uid]
  );

  const signOut = useCallback(async () => {
    const uid = authUser?.uid;
    await signOutUser();
    setUserId(null);
    setUserProfile(null);
    setWellbeingCheckIn(null);
    if (uid) clearUserSessionState(uid);
  }, [authUser]);

  const dismissWellbeing = useCallback(() => {
    if (!authUser) return;
    clearWellbeingTrigger(authUser.uid);
    setWellbeingCheckIn(null);
  }, [authUser]);

  const refreshAppSettings = useCallback(async () => {
    if (!authUser) return;
    try {
      const next = await getAppSettings();
      setAppSettings(next);
      syncHapticsCache(next.hapticsEnabled);
    } catch { /* ignore */ }
  }, [authUser]);

  const saveAppSettings = useCallback(
    async (patch: Partial<Pick<AppSettingsWire, "vibe" | "autoLearnVoice" | "autoSaveMemory" | "hapticsEnabled">>) => {
      setAppSettings((prev) => {
        const merged = { ...prev, ...patch };
        if (typeof patch.hapticsEnabled === "boolean") syncHapticsCache(patch.hapticsEnabled);
        return merged;
      });
      if (!authUser) return;
      try {
        const saved = await updateAppSettings(patch);
        setAppSettings(saved);
        syncHapticsCache(saved.hapticsEnabled);
      } catch { /* retain optimistic state cleanly */ }
    },
    [authUser]
  );

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
      appSettings,
      refreshAppSettings,
      saveAppSettings,
      saveUserProfile,
      applyLearnedProfile,
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
      appSettings,
      refreshAppSettings,
      saveAppSettings,
      saveUserProfile,
      applyLearnedProfile,
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
