import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Bell, ChevronRight, Heart, LogOut, Mic, Sparkles, Target, Zap } from "lucide-react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PremiumModal } from "./PremiumModal";
import { useAppContext } from "../app-context";
import { getSessions, recordActivity, type StreakData } from "../../services/dbService";

const modeCards = [
  {
    name: "Quick Mode",
    descriptor: "Analyze their text instantly",
    icon: Zap,
    path: "/quick",
    tint: "#FEF8F5",
    iconBg: "#F5E8E0",
  },
  {
    name: "Practice",
    descriptor: "Rehearse before you reply",
    icon: Target,
    path: "/practice",
    tint: "#FEFAF5",
    iconBg: "#FEF3E2",
  },
  {
    name: "Deep Dive",
    descriptor: "Unpack your patterns",
    icon: Heart,
    path: "/therapist",
    tint: "#FDF9F9",
    iconBg: "#FDF0F0",
  },
  {
    name: "My Voice",
    descriptor: "Train your texting style",
    icon: Mic,
    path: "/voice",
    tint: "#F9F9FD",
    iconBg: "#EEE8F8",
  },
];

function getGreeting(): { sub: string; hero: string } {
  const h = new Date().getHours();
  const rand = Math.random();
  if (h >= 5 && h < 12) {
    return { sub: "Good morning,", hero: rand > 0.5 ? "Your move starts here." : "Make today's opener count." };
  }
  if (h >= 12 && h < 17) {
    return { sub: "Good afternoon,", hero: rand > 0.5 ? "Decode the message." : "Your next move awaits." };
  }
  if (h >= 17 && h < 21) {
    return { sub: "Good evening,", hero: rand > 0.5 ? "Own the conversation." : "Time to level up." };
  }
  return { sub: "Still up?", hero: rand > 0.5 ? "Trust the process." : "Clarity over impulse." };
}

type ActivityItem = {
  mode: string;
  time: string;
  risk?: number;
};

const formatHoursAgo = (isoDate: string): string => {
  const delta = Date.now() - new Date(isoDate).getTime();
  const hours = Math.max(1, Math.floor(delta / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const toModeCardName = (mode?: string): string | null => {
  if (mode === "quick") return "Quick Mode";
  if (mode === "simulator") return "Practice";
  if (mode === "therapist") return "Deep Dive";
  if (mode === "voice") return "My Voice";
  return null;
};

export function HomeScreen() {
  const navigate = useNavigate();
  const { authUser, userId, userProfile, signOut, isPremium } = useAppContext();
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [lastUsedByMode, setLastUsedByMode] = useState<Record<string, string>>({});
  const [streak, setStreak] = useState<StreakData>({
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null,
  });
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showStreakTip, setShowStreakTip] = useState(false);
  const greeting = useMemo(() => getGreeting(), []);
  const firstName =
    authUser?.displayName?.split(" ")[0] ||
    authUser?.email?.split("@")[0] ||
    "there";

  useEffect(() => {
    if (!authUser?.uid) return;
    let alive = true;
    void getSessions(userId || authUser.uid, 5, 0)
      .then((response) => {
        if (!alive) return;
        const sessions = response.sessions || [];
        const recent = sessions.slice(0, 4).map((session) => ({
          mode:
            toModeCardName(session.mode) ||
            "Deep Dive",
          time: formatHoursAgo(session.created_at),
          risk:
            typeof session.ghost_risk === "number"
              ? session.ghost_risk
              : session.parsedResult?.analysis?.ghostRisk,
        }));
        const latestByMode: Record<string, string> = {};
        sessions.forEach((session) => {
          const mode = toModeCardName(session.mode);
          if (!mode || !session.created_at) return;
          const nextTime = new Date(session.created_at).getTime();
          const prevTime = latestByMode[mode]
            ? new Date(latestByMode[mode]).getTime()
            : 0;
          if (!Number.isNaN(nextTime) && nextTime > prevTime) {
            latestByMode[mode] = session.created_at;
          }
        });
        const computedLastUsed: Record<string, string> = {};
        Object.entries(latestByMode).forEach(([mode, createdAt]) => {
          computedLastUsed[mode] = formatHoursAgo(createdAt);
        });
        setLastUsedByMode(computedLastUsed);
        setActivity(recent);
      })
      .catch(() => {
        if (!alive) return;
        setActivity([]);
        setLastUsedByMode({});
      });
    return () => {
      alive = false;
    };
  }, [authUser?.uid, userId]);

  useEffect(() => {
    if (!authUser?.uid) return;
    let alive = true;
    void recordActivity(authUser.uid).then((data) => {
      if (alive) setStreak(data);
    }).catch(() => { });
    return () => { alive = false; };
  }, [authUser?.uid]);

  const isLateNight = new Date().getHours() >= 21 || new Date().getHours() < 5;
  const hasVoiceProfile = Boolean(userProfile);

  return (
    <div className="relative min-h-screen pb-24" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 px-5 pt-14 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Rizzbot" style={{ width: 32, height: 32, borderRadius: 8 }} />
            <div>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 400,
                  color: "rgba(26, 18, 8, 0.55)",
                }}
              >
                {greeting.sub}
              </p>
              <div className="flex items-center gap-2">
                <h1
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#1A1208",
                  }}
                >
                  {firstName}
                </h1>
                {streak.current_streak > 0 && (
                  <button
                    onClick={() => setShowStreakTip((prev) => !prev)}
                    className="inline-flex items-center gap-1 cursor-pointer fade-press"
                    style={{
                      backgroundColor: '#FEF3E2',
                      border: '1px solid #F5D9A8',
                      borderRadius: 100,
                      padding: '2px 8px',
                      position: 'relative',
                    }}
                  >
                    <span style={{ fontSize: 12 }}>🔥</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: '#C8783A' }}>{streak.current_streak}</span>
                    {showStreakTip && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: 8,
                        width: 220,
                        backgroundColor: '#FDFAF5',
                        borderRadius: 16,
                        padding: '12px 14px',
                        boxShadow: '0 8px 24px rgba(26,18,8,0.12)',
                        border: '1px solid #E8E0D4',
                        zIndex: 20,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        color: 'rgba(26,18,8,0.65)',
                        lineHeight: 1.4,
                      }}>
                        You get a streak for each day you use Rizzbot. Keep it up!
                      </div>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowProfileSheet((prev) => !prev)}
            className="cursor-pointer hover-scale fade-press"
            style={{ background: "none", border: "none", padding: 0, position: "relative" }}
            title="Profile"
          >
            {authUser?.photoURL ? (
              <ImageWithFallback
                src={authUser.photoURL}
                alt={firstName}
                className="object-cover"
                style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #D4B8A0", boxShadow: "0 0 0 2px rgba(200,82,42,0.15)" }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: "#F5E8E0",
                  color: "#C8522A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "2px solid #D4B8A0",
                  boxShadow: "0 0 0 2px rgba(200,82,42,0.15)",
                }}
              >
                {firstName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#7A9E7E",
              border: "2px solid #F5EFE6",
            }} />
          </button>
        </div>

        {isLateNight && (
          <div
            className="mt-4"
            style={{
              backgroundColor: "#FDF0F0",
              borderRadius: 16,
              padding: "12px 16px",
              border: "1px solid rgba(212,131,138,0.2)",
            }}
          >
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                fontWeight: 400,
                color: "rgba(26,18,8,0.6)",
                lineHeight: 1.5,
              }}
            >
              🌙 Late-night texting can feel louder than reality. Take a breath before your next move.
            </p>
          </div>
        )}

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 36,
              fontWeight: 700,
              fontStyle: "italic",
              color: "#1A1208",
              lineHeight: 1.2,
            }}
          >
            {greeting.hero}
          </h2>
        </motion.div>

        <div className="mt-6 flex flex-col gap-3">
          {modeCards.map((card, idx) => {
            const Icon = card.icon;
            const isVoiceCard = card.name === "My Voice";
            const isVoiceProfileActive = isVoiceCard && hasVoiceProfile;
            const iconColor = isVoiceProfileActive ? "#7A9E7E" : ["#C8522A", "#D4A853", "#C8522A", "#D9A0A0"][idx % 4];
            const bgTintColor = isVoiceProfileActive ? "rgba(122,158,126,0.14)" : ["#F5E8E0", "#FEF3E2", "#F5E8E0", "rgba(217,160,160,0.12)"][idx % 4];
            const descriptorText = isVoiceProfileActive ? "✓ Voice profile active" : card.descriptor;
            const descriptorColor = isVoiceProfileActive ? "#6B8F72" : "rgba(26, 18, 8, 0.55)";
            const usedTime = lastUsedByMode[card.name];
            return (
              <button
                key={card.name}
                onClick={() => navigate(card.path)}
                className="w-full relative flex items-center cursor-pointer text-left hover-scale fade-press active:scale-[0.97] active:brightness-95 transition-all duration-100"
                style={{
                  height: 80,
                  backgroundColor: card.tint,
                  borderRadius: 24,
                  boxShadow: "0 1px 4px rgba(26,18,8,0.06), 0 0 0 1px rgba(26,18,8,0.03)",
                  border: "none",
                  padding: "0 20px",
                  transition: "transform 0.1s, box-shadow 0.1s",
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: bgTintColor }}
                >
                  <Icon size={22} strokeWidth={1.8} color={iconColor} />
                </div>
                <div className="ml-4 flex-1 min-w-0">
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                    {card.name}
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, color: descriptorColor }}>
                    {descriptorText}
                  </p>
                </div>
                <ChevronRight size={16} strokeWidth={1.8} color="rgba(26,18,8,0.35)" />
                {usedTime && (
                  <span style={{ position: "absolute", right: 20, bottom: 10, fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(26, 18, 8, 0.45)" }}>
                    Used {usedTime}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Premium Banner (Temporarily Hidden) */}
        {false && !isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setIsPremiumModalOpen(true)}
            className="mt-8 p-6 rounded-[28px] bg-[#1A1208] text-white relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                  Limited Offer
                </span>
                <Sparkles size={12} className="text-[#C8522A]" />
              </div>
              <h3 className="text-xl font-bold mb-1">Get Lifetime Access</h3>
              <p className="text-sm text-white/60 mb-4">
                Unlimited AI advice, practice sessions & more. Just ₹500.
              </p>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-[#C8522A]">
                Upgrade Now <ChevronRight size={16} />
              </div>
            </div>
            <div className="absolute top-1/2 right-[-20px] -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Zap size={140} fill="white" />
            </div>
          </motion.div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.15em",
                color: "rgba(26, 18, 8, 0.55)",
                textTransform: "uppercase",
              }}
            >
              Recent
            </p>
            <button
              onClick={() => navigate("/history")}
              className="cursor-pointer fade-press"
              style={{
                background: "none",
                border: "none",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 500,
                color: "#C8522A",
              }}
            >
              See all →
            </button>
          </div>
          {activity.length > 0 ? (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {activity.map((item, i) => (
                <div
                  key={`${item.mode}-${i}`}
                  onClick={() => navigate('/history')}
                  className="flex items-center gap-2 shrink-0 hover-scale cursor-pointer"
                  style={{
                    backgroundColor: "#FDFAF5",
                    borderRadius: 100,
                    border: "1px solid #E8E0D4",
                    padding: "10px 16px",
                  }}
                >
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1208" }}>
                    {item.mode}
                  </span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26, 18, 8, 0.55)" }}>
                    {item.time}
                  </span>
                  {typeof item.risk === "number" && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: item.risk > 65 ? "#C8522A" : "#7A9E7E" }}>
                      {item.risk}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="mt-3 w-full flex flex-col items-center gap-3 text-center"
              style={{
                backgroundColor: "#FDFAF5",
                borderRadius: 20,
                border: "1px dashed rgba(26,18,8,0.15)",
                padding: "24px 16px",
              }}
            >
              <div style={{ padding: 12, borderRadius: 14, backgroundColor: "#F5E8E0" }}>
                <Zap size={22} color="#C8522A" strokeWidth={1.8} />
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                No sessions yet
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26, 18, 8, 0.55)" }}>
                Analyze a screenshot or type out a message to get started.
              </p>
              <button
                onClick={() => navigate("/quick")}
                className="hover-scale fade-press cursor-pointer"
                style={{
                  backgroundColor: "#C8522A",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 100,
                  padding: "12px 24px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 4px 12px rgba(200,82,42,0.2)",
                  marginTop: 4,
                }}
              >
                Start Quick Mode →
              </button>
            </div>
          )}
        </div>
      </div>

      <TabBar />

      {/* Profile Sheet */}
      {showProfileSheet && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setShowProfileSheet(false)}
          style={{ backgroundColor: "rgba(26,18,8,0.3)" }}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#FDFAF5",
              borderRadius: "24px 24px 0 0",
              padding: "24px 20px 40px",
              maxWidth: 430,
              margin: "0 auto",
            }}
          >
            <div className="flex justify-center mb-4">
              <div style={{ width: 36, height: 4, borderRadius: 100, backgroundColor: "#E8E0D4" }} />
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#F5E8E0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 18, color: "#C8522A" }}>
                {firstName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 600, color: "#1A1208" }}>{authUser?.displayName || firstName}</p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)" }}>{authUser?.email}</p>
              </div>
            </div>
            <button
              onClick={() => { setShowProfileSheet(false); navigate("/voice"); }}
              className="w-full flex items-center gap-3 cursor-pointer fade-press"
              style={{ backgroundColor: "transparent", border: "1px solid #E8E0D4", borderRadius: 16, padding: "14px 16px", marginBottom: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1208", textAlign: "left" }}
            >
              <Mic size={18} color="#C8522A" />
              My Voice Profile
            </button>
            <button
              onClick={() => { setShowProfileSheet(false); signOut(); }}
              className="w-full flex items-center gap-3 cursor-pointer fade-press"
              style={{ backgroundColor: "transparent", border: "1px solid rgba(200,82,42,0.2)", borderRadius: 16, padding: "14px 16px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "#C8522A", textAlign: "left" }}
            >
              <LogOut size={18} color="#C8522A" />
              Sign out
            </button>
          </motion.div>
        </div>
      )}

      <PremiumModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
      />
    </div>
  );
}
