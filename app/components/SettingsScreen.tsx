import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageSquareOff,
  Mic,
  Shield,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAppContext } from "../app-context";
import {
  clearVoiceSamples,
  deleteAllChats,
  getLedger,
  patchLedger,
} from "../../services/chatApi";
import { haptics } from "../utils/haptics";

const VIBE_OPTIONS = [
  {
    id: "unfiltered" as const,
    label: "Unfiltered",
    desc: "Blunt, funny best friend — calls it out straight with zero sugarcoating.",
  },
  {
    id: "balanced" as const,
    label: "Balanced",
    desc: "Warm and candid banter, dialing back heavy roasting and swearing.",
  },
  {
    id: "gentle" as const,
    label: "Gentle",
    desc: "Extra encouraging, supportive, and grounded — no harsh roasts.",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="px-1 mb-2 mt-5 uppercase"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: "rgba(26, 18, 8, 0.45)",
      }}
    >
      {children}
    </p>
  );
}

function SwitchToggle({
  checked,
  label,
  description,
  onToggle,
}: {
  checked: boolean;
  label: string;
  description: string;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3.5"
      style={{ borderBottom: "1px solid rgba(26,18,8,0.06)" }}
    >
      <div className="min-w-0 flex-1">
        <span
          className="block"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14.5, fontWeight: 600, color: "#1A1208" }}
        >
          {label}
        </span>
        <span
          className="block mt-0.5"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, lineHeight: 1.4, color: "rgba(26,18,8,0.55)" }}
        >
          {description}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className="cursor-pointer shrink-0 relative transition-colors"
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          border: "none",
          backgroundColor: checked ? "#C8522A" : "#DDD3C4",
          padding: 3,
        }}
      >
        <span
          className="block rounded-full transition-transform"
          style={{
            width: 22,
            height: 22,
            backgroundColor: "#FDFAF5",
            boxShadow: "0 1px 3px rgba(26,18,8,0.22)",
            transform: checked ? "translateX(18px)" : "translateX(0px)",
          }}
        />
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const { authUser, userProfile, appSettings, refreshAppSettings, saveAppSettings, signOut } = useAppContext();
  const [confirmScope, setConfirmScope] = useState<"memory" | "chats" | "voice" | null>(null);
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refreshAppSettings();
  }, [refreshAppSettings]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 2800);
  };

  const handleResetVoice = async () => {
    setBusyScope("voice");
    try {
      await clearVoiceSamples();
      await refreshAppSettings();
      haptics.success();
      showNotice("Cleared learned writing samples.");
    } catch {
      showNotice("Couldn’t reset voice samples right now.");
    } finally {
      setBusyScope(null);
      setConfirmScope(null);
    }
  };

  const handleClearMemories = async () => {
    setBusyScope("memory");
    try {
      const data = await getLedger();
      await patchLedger({ revision: data.revision, op: "clear" });
      await refreshAppSettings();
      haptics.success();
      showNotice("Cleared all saved memories.");
    } catch {
      showNotice("Couldn’t clear memories right now.");
    } finally {
      setBusyScope(null);
      setConfirmScope(null);
    }
  };

  const handleDeleteAllChats = async () => {
    setBusyScope("chats");
    try {
      await deleteAllChats();
      await refreshAppSettings();
      haptics.success();
      showNotice("Deleted all saved chats.");
    } catch {
      showNotice("Couldn’t delete chats right now.");
    } finally {
      setBusyScope(null);
      setConfirmScope(null);
    }
  };

  const handleSignOut = async () => {
    haptics.light();
    await signOut();
    navigate("/auth", { replace: true });
  };

  const initial = (authUser?.displayName || authUser?.email || "U").slice(0, 1).toUpperCase();
  const sampleCount = userProfile?.sampleCount ?? userProfile?.learnedSamples?.length ?? 0;

  return (
    <div className="relative min-h-screen pb-[96px]" style={{ backgroundColor: "#F5EFE6" }}>
      <div className="relative z-10 px-4 sm:px-5 pt-4 max-w-[540px] mx-auto">
        <header className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => navigate("/chat")}
            aria-label="Back to Chat"
            className="cursor-pointer flex items-center justify-center shrink-0 transition-transform active:scale-95"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4" }}
          >
            <ChevronLeft size={20} color="#1A1208" />
          </button>
          <div>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 30,
                fontWeight: 700,
                lineHeight: 1.05,
                color: "#1A1208",
                letterSpacing: "-0.02em",
              }}
            >
              Settings
            </h1>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(26,18,8,0.52)" }}>
              Kai’s vibe, memory, writing style &amp; account
            </p>
          </div>
        </header>

        {notice && (
          <div
            role="status"
            className="mt-3 px-3.5 py-2.5 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: "#F5E8E0",
              border: "1px solid rgba(200,82,42,0.28)",
              color: "#8E3416",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {notice}
          </div>
        )}

        <SectionLabel>Account</SectionLabel>
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px solid #E8E0D4" }}
        >
          <div
            className="flex items-center justify-center shrink-0 rounded-full font-semibold"
            style={{
              width: 42,
              height: 42,
              backgroundColor: "#F5E8E0",
              color: "#C8522A",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
            }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14.5, fontWeight: 600, color: "#1A1208" }}
            >
              {authUser?.displayName || authUser?.email || "Signed in"}
            </p>
            <p
              className="truncate"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.5)" }}
            >
              {authUser?.email || "Active session"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors hover:bg-[#F5E8E0]"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              color: "#9E3B1A",
              backgroundColor: "#FBF4EE",
              border: "1px solid rgba(200,82,42,0.22)",
            }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>

        <SectionLabel>Kai’s Vibe</SectionLabel>
        <div
          className="p-3.5"
          style={{ backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px solid #E8E0D4" }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles size={15} color="#C8522A" />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>
              How Kai talks to you
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl" style={{ backgroundColor: "#F4EDE2" }}>
            {VIBE_OPTIONS.map((opt) => {
              const active = appSettings.vibe === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    haptics.light();
                    void saveAppSettings({ vibe: opt.id });
                  }}
                  className="cursor-pointer py-2 px-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    backgroundColor: active ? "#FDFAF5" : "transparent",
                    color: active ? "#C8522A" : "rgba(26,18,8,0.62)",
                    boxShadow: active ? "0 1px 4px rgba(26,18,8,0.08)" : "none",
                    border: active ? "1px solid rgba(200,82,42,0.22)" : "1px solid transparent",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p
            className="mt-2.5 px-0.5"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, lineHeight: 1.45, color: "rgba(26,18,8,0.58)" }}
          >
            {VIBE_OPTIONS.find((v) => v.id === appSettings.vibe)?.desc}
          </p>
        </div>

        <SectionLabel>Memory &amp; Your Style</SectionLabel>
        <div
          className="overflow-hidden"
          style={{ backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px solid #E8E0D4" }}
        >
          <button
            type="button"
            onClick={() => navigate("/settings/memory")}
            className="cursor-pointer w-full flex items-center text-left px-4 py-3.5 transition-colors hover:bg-[#FBF6EE]"
            style={{ borderBottom: "1px solid rgba(26,18,8,0.06)", background: "none", borderTop: "none", borderLeft: "none", borderRight: "none" }}
          >
            <span className="flex items-center gap-3 flex-1 min-w-0">
              <Brain size={19} color="#C8522A" className="shrink-0" />
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14.5, fontWeight: 600, color: "#1A1208" }}>
                  Memory
                </span>
                <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(26,18,8,0.55)" }}>
                  What Kai remembers across chats
                </span>
              </span>
            </span>
            <span
              className="mr-2 px-2 py-0.5 rounded-full text-[11px] font-mono shrink-0"
              style={{
                backgroundColor: "#F5E8E0",
                color: "#9E3B1A",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {appSettings.memoryCount}/{appSettings.memoryCap}
            </span>
            <ChevronRight size={17} color="rgba(26,18,8,0.35)" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/voice")}
            className="cursor-pointer w-full flex items-center text-left px-4 py-3.5 transition-colors hover:bg-[#FBF6EE]"
            style={{ borderBottom: "1px solid rgba(26,18,8,0.06)", background: "none", borderTop: "none", borderLeft: "none", borderRight: "none" }}
          >
            <span className="flex items-center gap-3 flex-1 min-w-0">
              <Mic size={19} color="#C8522A" className="shrink-0" />
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14.5, fontWeight: 600, color: "#1A1208" }}>
                  My Voice
                </span>
                <span className="block truncate" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(26,18,8,0.55)" }}>
                  {sampleCount > 0 ? `${sampleCount} learned texting samples` : "Teach Kai & Quick Mode how you text"}
                </span>
              </span>
            </span>
            <ChevronRight size={17} color="rgba(26,18,8,0.35)" />
          </button>

          <SwitchToggle
            checked={appSettings.autoSaveMemory}
            label="Auto-save memories"
            description="Let Kai note names, timelines, and recurring dynamics automatically."
            onToggle={() => {
              haptics.light();
              void saveAppSettings({ autoSaveMemory: !appSettings.autoSaveMemory });
            }}
          />

          <div style={{ borderBottom: "none" }}>
            <SwitchToggle
              checked={appSettings.autoLearnVoice}
              label="Auto-learn your style"
              description="Subtly refine your voice profile when you upload chat screenshots."
              onToggle={() => {
                haptics.light();
                void saveAppSettings({ autoLearnVoice: !appSettings.autoLearnVoice });
              }}
            />
          </div>
        </div>

        <SectionLabel>Experience &amp; Privacy</SectionLabel>
        <div
          className="overflow-hidden"
          style={{ backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px solid #E8E0D4" }}
        >
          <SwitchToggle
            checked={appSettings.hapticsEnabled}
            label="Haptic feedback"
            description="Light vibration taps on swipe-to-reply, recording, and sending."
            onToggle={() => {
              const next = !appSettings.hapticsEnabled;
              void saveAppSettings({ hapticsEnabled: next });
              if (next) setTimeout(() => haptics.light(), 20);
            }}
          />
          <button
            type="button"
            onClick={() => navigate("/chat/incognito")}
            className="cursor-pointer w-full flex items-center text-left px-4 py-3.5 transition-colors hover:bg-[#FBF6EE]"
            style={{ background: "none", border: "none" }}
          >
            <span className="flex items-center gap-3 flex-1 min-w-0">
              <Shield size={19} color="#C8522A" className="shrink-0" />
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14.5, fontWeight: 600, color: "#1A1208" }}>
                  Incognito chat
                </span>
                <span className="block" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(26,18,8,0.55)" }}>
                  Off-the-record chat — nothing saved to history or memory
                </span>
              </span>
            </span>
            <ChevronRight size={17} color="rgba(26,18,8,0.35)" />
          </button>
        </div>
        <p
          className="px-2 mt-2"
          style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, lineHeight: 1.45, color: "rgba(26,18,8,0.48)" }}
        >
          Screenshots and voice notes stay scoped to your account and are never used for ads or sold to third parties.
        </p>

        <SectionLabel>Data Controls</SectionLabel>
        <div
          className="overflow-hidden"
          style={{ backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px solid #E8E0D4" }}
        >
          {confirmScope === "voice" ? (
            <div className="flex items-center justify-between gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(26,18,8,0.06)", backgroundColor: "#FBF4EE" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 600, color: "#9E3B1A" }}>
                Reset learned voice samples?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmScope(null)}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ border: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", color: "#1A1208" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busyScope === "voice"}
                  onClick={handleResetVoice}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                  style={{ border: "none", backgroundColor: "#C8522A" }}
                >
                  {busyScope === "voice" ? "Resetting…" : "Reset"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmScope("voice")}
              className="cursor-pointer w-full flex items-center gap-3 text-left px-4 py-3.5 hover:bg-[#FBF6EE]"
              style={{ borderBottom: "1px solid rgba(26,18,8,0.06)", background: "none", borderTop: "none", borderLeft: "none", borderRight: "none" }}
            >
              <Mic size={17} color="#9E3B1A" />
              <span className="flex-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1208" }}>
                Reset My Voice samples
              </span>
            </button>
          )}

          {confirmScope === "memory" ? (
            <div className="flex items-center justify-between gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid rgba(26,18,8,0.06)", backgroundColor: "#FBF4EE" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 600, color: "#9E3B1A" }}>
                Clear all {appSettings.memoryCount} memories?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmScope(null)}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ border: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", color: "#1A1208" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busyScope === "memory"}
                  onClick={handleClearMemories}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                  style={{ border: "none", backgroundColor: "#C8522A" }}
                >
                  {busyScope === "memory" ? "Clearing…" : "Clear"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmScope("memory")}
              className="cursor-pointer w-full flex items-center gap-3 text-left px-4 py-3.5 hover:bg-[#FBF6EE]"
              style={{ borderBottom: "1px solid rgba(26,18,8,0.06)", background: "none", borderTop: "none", borderLeft: "none", borderRight: "none" }}
            >
              <MessageSquareOff size={17} color="#9E3B1A" />
              <span className="flex-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1208" }}>
                Clear all saved memories
              </span>
            </button>
          )}

          {confirmScope === "chats" ? (
            <div className="flex items-center justify-between gap-2 px-4 py-3.5" style={{ backgroundColor: "#FBECE6" }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 600, color: "#9E2A1A" }}>
                Delete all {appSettings.threadCount} saved chats?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmScope(null)}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ border: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", color: "#1A1208" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busyScope === "chats"}
                  onClick={handleDeleteAllChats}
                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                  style={{ border: "none", backgroundColor: "#B3261E" }}
                >
                  {busyScope === "chats" ? "Deleting…" : "Delete all"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmScope("chats")}
              className="cursor-pointer w-full flex items-center gap-3 text-left px-4 py-3.5 hover:bg-[#FBECE6]/60"
              style={{ background: "none", border: "none" }}
            >
              <Trash2 size={17} color="#B3261E" />
              <span className="flex-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#B3261E" }}>
                Delete all saved chats
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
