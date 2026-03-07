import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Clock,
  Image,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  Zap,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import { deleteSession, getSessions, Session } from "../../services/dbService";

const filterOptions = ["All", "Quick Mode", "Practice"] as const;

const toMode = (mode?: string) =>
  mode === "quick" ? "Quick Mode" : mode === "simulator" ? "Practice" : "Session";

const getAccentColor = (risk: number) =>
  risk > 65 ? "#C8522A" : risk > 35 ? "#D4A853" : "#7A9E7E";

const formatDate = (isoDate?: string | null) => {
  if (!isoDate) return "Unknown date";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatAgo = (isoDate?: string | null) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  const delta = Date.now() - d.getTime();
  
  const seconds = Math.floor(delta / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const suggestionText = (suggestion: unknown): string => {
  if (!suggestion) return "";
  const option = Array.isArray(suggestion) ? suggestion[0] : suggestion;
  if (typeof option === "string") return option;
  if (!option || typeof option !== "object") return "";
  const maybe = option as { replies?: Array<{ reply?: string }>; conversationHook?: string };
  const replyText = Array.isArray(maybe.replies)
    ? maybe.replies.map((r) => r.reply || "").filter(Boolean).join(" ")
    : "";
  return [replyText, maybe.conversationHook || ""].filter(Boolean).join(" ").trim();
};

const getRisk = (session: Session) =>
  typeof session.ghost_risk === "number"
    ? session.ghost_risk
    : session.parsedResult?.analysis?.ghostRisk || session.parsedResult?.ghostRisk || 0;

const getScreenshots = (session: Session): string[] => {
  const fromRequest = session.parsedResult?.request?.screenshots;
  const fromResult = session.parsedResult?.screenshots;
  return (fromRequest && fromRequest.length ? fromRequest : fromResult) || [];
};

function SessionDetail({ session, onBack }: { session: Session; onBack: () => void }) {
  const parsed = session.parsedResult || {};
  const screenshots = getScreenshots(session);
  const vibeCheck = parsed.vibeCheck || parsed.response?.vibeCheck;
  const suggestions = parsed.suggestions || parsed.response?.suggestions;
  const history = parsed.history || [];
  const analysis = parsed.analysis;
  const theirMessage = parsed.request?.theirMessage;
  const risk = getRisk(session);
  const accent = getAccentColor(risk);

  return (
    <div className="relative min-h-screen pb-6" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 px-5 pt-6 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="cursor-pointer p-1"
            style={{ color: "rgba(26,18,8,0.7)" }}
          >
            <ArrowLeft size={21} />
          </button>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
              fontWeight: 600,
              color: "#1A1208",
            }}
          >
            Session Replay
          </p>
          <div style={{ width: 21 }} />
        </div>

        <div
          className="mt-4"
          style={{
            backgroundColor: "#FDFAF5",
            borderRadius: 20,
            boxShadow: "0 2px 16px rgba(26,18,8,0.07)",
            overflow: "hidden",
          }}
        >
          <div className="flex">
            <div style={{ width: 4, backgroundColor: accent }} />
            <div className="p-4 flex-1">
              <div className="flex items-center justify-between">
                <span
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    color: "#C8522A",
                    fontWeight: 600,
                  }}
                >
                  {toMode(session.mode)}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: "rgba(26,18,8,0.45)",
                  }}
                >
                  {formatAgo(session.created_at)}
                </span>
              </div>
              <p
                className="mt-1"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 28,
                  fontStyle: "italic",
                  color: "#1A1208",
                  lineHeight: 1.05,
                }}
              >
                {session.headline || parsed.headline || session.persona_name || "Conversation replay"}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    backgroundColor: "rgba(122,158,126,0.12)",
                    color: accent,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                  }}
                >
                  {risk}% risk
                </span>
                {session.persona_name && (
                  <span
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      color: "rgba(26,18,8,0.55)",
                    }}
                  >
                    Persona: {session.persona_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {screenshots.length > 0 && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <Image size={15} color="#C8522A" />
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(26,18,8,0.55)",
                }}
              >
                Uploaded screenshots
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {screenshots.map((screenshot, idx) => (
                <img
                  key={idx}
                  src={screenshot.startsWith("data:") ? screenshot : `data:image/png;base64,${screenshot}`}
                  alt={`Screenshot ${idx + 1}`}
                  style={{
                    width: "100%",
                    aspectRatio: "9 / 16",
                    objectFit: "cover",
                    borderRadius: 12,
                    border: "1px solid #E8E0D4",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {theirMessage && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(26,18,8,0.55)",
                marginBottom: 8,
              }}
            >
              Their message
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: "#1A1208",
                lineHeight: 1.55,
              }}
            >
              {theirMessage}
            </p>
          </div>
        )}

        {vibeCheck && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(26,18,8,0.55)",
                marginBottom: 8,
              }}
            >
              Vibe check
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, padding: 10, border: "1px solid #E8E0D4" }}>
                <p style={{ fontSize: 11, color: "rgba(26,18,8,0.5)", marginBottom: 4 }}>Energy</p>
                <p style={{ fontSize: 14, color: "#1A1208", fontFamily: "'DM Sans', sans-serif" }}>{vibeCheck.theirEnergy || "N/A"}</p>
              </div>
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, padding: 10, border: "1px solid #E8E0D4" }}>
                <p style={{ fontSize: 11, color: "rgba(26,18,8,0.5)", marginBottom: 4 }}>Interest</p>
                <p style={{ fontSize: 14, color: "#1A1208", fontFamily: "'DM Sans', sans-serif" }}>{vibeCheck.interestLevel ?? "N/A"}%</p>
              </div>
            </div>
            {Array.isArray(vibeCheck.greenFlags) && vibeCheck.greenFlags.length > 0 && (
              <div className="mb-2">
                <p style={{ fontSize: 11, color: "#7A9E7E", marginBottom: 6 }}>Green flags</p>
                <div className="flex flex-wrap gap-2">
                  {vibeCheck.greenFlags.map((flag: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        borderRadius: 999,
                        padding: "3px 9px",
                        backgroundColor: "rgba(122,158,126,0.12)",
                        color: "#58745A",
                        fontSize: 11,
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(vibeCheck.redFlags) && vibeCheck.redFlags.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: "#C8522A", marginBottom: 6 }}>Red flags</p>
                <div className="flex flex-wrap gap-2">
                  {vibeCheck.redFlags.map((flag: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        borderRadius: 999,
                        padding: "3px 9px",
                        backgroundColor: "rgba(200,82,42,0.12)",
                        color: "#C8522A",
                        fontSize: 11,
                      }}
                    >
                      {flag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {suggestions && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(26,18,8,0.55)",
                marginBottom: 8,
              }}
            >
              Suggestions
            </p>
            <div className="space-y-2">
              {(["smooth", "bold", "witty", "authentic"] as const).map((tone) => {
                const text = suggestionText((suggestions as Record<string, unknown>)[tone]);
                if (!text) return null;
                return (
                  <div
                    key={tone}
                    style={{
                      borderRadius: 12,
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E8E0D4",
                      padding: 10,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 10,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "rgba(26,18,8,0.45)",
                        marginBottom: 4,
                      }}
                    >
                      {tone}
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", lineHeight: 1.5 }}>
                      {text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(26,18,8,0.55)",
                marginBottom: 8,
              }}
            >
              Practice turns
            </p>
            <div className="space-y-3">
              {history.map((turn: any, idx: number) => (
                <div key={idx}>
                  <div className="flex justify-end mb-1">
                    <div
                      style={{
                        maxWidth: "84%",
                        borderRadius: "12px 12px 4px 12px",
                        backgroundColor: "#F5E8E0",
                        border: "1px solid #E8E0D4",
                        padding: "8px 10px",
                      }}
                    >
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208" }}>
                        {turn.draft}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div
                      style={{
                        maxWidth: "84%",
                        borderRadius: "12px 12px 12px 4px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E8E0D4",
                        padding: "8px 10px",
                      }}
                    >
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208" }}>
                        {turn.result?.predictedReply || "No prediction recorded"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis && (
          <div className="mt-4 mb-8 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(26,18,8,0.55)",
                marginBottom: 8,
              }}
            >
              Session analysis
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, padding: 10, border: "1px solid #E8E0D4" }}>
                <p style={{ fontSize: 11, color: "rgba(26,18,8,0.5)" }}>Ghost risk</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#C8522A" }}>
                  {analysis.ghostRisk ?? "N/A"}%
                </p>
              </div>
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, padding: 10, border: "1px solid #E8E0D4" }}>
                <p style={{ fontSize: 11, color: "rgba(26,18,8,0.5)" }}>Vibe match</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#7A9E7E" }}>
                  {analysis.vibeMatch ?? "N/A"}%
                </p>
              </div>
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, padding: 10, border: "1px solid #E8E0D4" }}>
                <p style={{ fontSize: 11, color: "rgba(26,18,8,0.5)" }}>Effort</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#D4A853" }}>
                  {analysis.effortBalance ?? "N/A"}%
                </p>
              </div>
            </div>
            {analysis.headline && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", marginBottom: 8 }}>
                {analysis.headline}
              </p>
            )}
            {Array.isArray(analysis.insights) && analysis.insights.length > 0 && (
              <div className="space-y-1">
                {analysis.insights.map((item: string, i: number) => (
                  <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.65)" }}>
                    • {item}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <TabBar />
    </div >
  );
}

export function HistoryScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser, userId } = useAppContext();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof filterOptions)[number]>("All");
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (!authUser?.uid) return;
    setLoading(true);
    void getSessions(userId || authUser.uid, 50, 0)
      .then((response) => setSessions(response.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [authUser?.uid]);

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      const mode = toMode(session.mode);
      const matchesFilter = activeFilter === "All" || mode === activeFilter;
      const text = session.headline || session.parsedResult?.headline || session.persona_name || mode;
      const matchesQuery = !query || text.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [sessions, activeFilter, query]);

  const handleDelete = async (id: number) => {
    if (!authUser?.uid) return;
    setDeletingId(id);
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((item) => item.id !== id));
      if (selectedSession?.id === id) setSelectedSession(null);
      toast("Session deleted", "info");
    } catch {
      toast("Could not delete session", "error");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (selectedSession) {
    return <SessionDetail session={selectedSession} onBack={() => setSelectedSession(null)} />;
  }

  return (
    <div className="relative min-h-screen pb-6" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 px-5 pt-6 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between">
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 22,
              fontWeight: 600,
              color: "#1A1208",
            }}
          >
            History
          </p>
          <div className="flex items-center justify-end" style={{ minWidth: 72 }}>
            {sessions.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowSearch((prev) => !prev);
                    haptics.light();
                  }}
                  className="cursor-pointer p-1"
                >
                  <Search size={20} strokeWidth={1.8} color="rgba(26,18,8,0.55)" />
                </button>
                <button
                  onClick={() => {
                    setShowFilter((prev) => !prev);
                    haptics.light();
                  }}
                  className="cursor-pointer p-1"
                >
                  <SlidersHorizontal
                    size={20}
                    strokeWidth={1.8}
                    color={activeFilter !== "All" ? "#C8522A" : "rgba(26,18,8,0.55)"}
                  />
                </button>
              </div>
            ) : (
              <div style={{ width: 44, height: 20 }} />
            )}
          </div>
        </div>
        {!loading && sessions.length > 0 && (
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", marginTop: 4, textAlign: "right" }}>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
        )}

        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 flex items-center gap-2 bg-[#FDFAF5] rounded-[100px] border border-[#E8E0D4] px-4 h-[44px] transition-all duration-300 focus-within:border-[#C8522A] focus-within:ring-[3px] focus-within:ring-[#C8522A]/20 shadow-sm"
              >
                <Search size={16} strokeWidth={1.8} color="rgba(26,18,8,0.4)" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search sessions..."
                  className="flex-1 outline-none bg-transparent text-[14px] text-[#1A1208]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="cursor-pointer"
                  >
                    <X size={14} strokeWidth={2} color="rgba(26,18,8,0.4)" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3"
              style={{
                backgroundColor: "#FDFAF5",
                borderRadius: 20,
                padding: "14px 16px",
                boxShadow: "0 4px 20px rgba(26,18,8,0.08)",
              }}
            >
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  color: "rgba(26,18,8,0.45)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                FILTER BY MODE
              </p>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setActiveFilter(opt);
                      setShowFilter(false);
                      haptics.light();
                    }}
                    className="cursor-pointer"
                    style={{
                      borderRadius: 100,
                      padding: "6px 14px",
                      backgroundColor: activeFilter === opt ? "#C8522A" : "transparent",
                      color: activeFilter === opt ? "#FFFFFF" : "rgba(26,18,8,0.6)",
                      border:
                        activeFilter === opt ? "1px solid #C8522A" : "1px solid #E8E0D4",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 flex flex-col gap-3">
          {loading ? (
            <div style={{ backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  color: "rgba(26,18,8,0.55)",
                }}
              >
                Loading sessions...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col mt-2">
              <div
                className="flex flex-col items-center justify-center py-12 px-6"
                style={{
                  backgroundColor: "#FDFAF5",
                  borderRadius: 20,
                  border: "1px dashed rgba(26,18,8,0.15)",
                }}
              >
                <div className="mb-4 flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: "50%", backgroundColor: "rgba(200,82,42,0.14)" }}>
                  <MessageSquare size={48} strokeWidth={1.5} color="#C8522A" />
                </div>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#1A1208",
                    marginBottom: 8,
                    textAlign: "center"
                  }}
                >
                  {query || activeFilter !== "All"
                    ? "No matching sessions"
                    : "Your story starts here."}
                </p>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    color: "rgba(26,18,8,0.5)",
                    textAlign: "center",
                    marginBottom: 24,
                  }}
                >
                  {query || activeFilter !== "All"
                    ? "Try adjusting your filters to find what you're looking for."
                    : "Analyze a screenshot or type out a message to get started."}
                </p>
                {!(query || activeFilter !== "All") && (
                  <button
                    onClick={() => navigate("/quick")}
                    className="hover-scale fade-press"
                    style={{
                      backgroundColor: "#C8522A",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 100,
                      width: "100%",
                      maxWidth: 280,
                      margin: "0 auto",
                      padding: "14px 24px",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(200,82,42,0.2)",
                    }}
                  >
                    Start your first session →
                  </button>
                )}
              </div>
            </div>
          ) : (
            filtered.map((session) => {
              const risk = getRisk(session);
              const mode = toMode(session.mode);
              const accent = getAccentColor(risk);
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setSelectedSession(session);
                    navigate("/history");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedSession(session);
                      navigate("/history");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    backgroundColor: "#FDFAF5",
                    borderRadius: 20,
                    boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div className="flex">
                    <div style={{ width: 4, borderRadius: "20px 0 0 20px", backgroundColor: accent }} />
                    <div className="p-4 flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap size={15} color="#C8522A" />
                          <span
                            style={{
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 14,
                              fontWeight: 500,
                              color: "#1A1208",
                            }}
                          >
                            {mode}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 11,
                            color: "rgba(26,18,8,0.45)",
                            fontWeight: 500,
                          }}
                        >
                          {formatAgo(session.created_at)}
                        </span>
                      </div>
                      <p
                        className="mt-1 line-clamp-1"
                        style={{
                          fontFamily: "'Cormorant Garamond', serif",
                          fontSize: 20,
                          fontStyle: "italic",
                          color: "#1A1208",
                          lineHeight: 1.2,
                        }}
                      >
                        {session.headline || session.parsedResult?.headline || session.persona_name || "Conversation analysis"}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            style={{
                              borderRadius: 999,
                              padding: "2px 8px",
                              backgroundColor: "rgba(122,158,126,0.1)",
                              color: accent,
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: 10,
                              fontWeight: 600,
                              border: `1px solid ${accent}20`
                            }}
                          >
                            {risk}% risk
                          </span>
                          {session.parsedResult?.request?.screenshots?.length > 0 && (
                            <div className="flex items-center gap-1 opacity-40">
                              <Image size={12} />
                              <span style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif" }}>{session.parsedResult.request.screenshots.length}</span>
                            </div>
                          )}
                        </div>
                      <ChevronRight size={16} color="rgba(26,18,8,0.2)" />
                      </div>
                      <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: "1px solid rgba(26,18,8,0.06)" }}>
                        <button
                          className="cursor-pointer shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            haptics.medium();
                            setConfirmDeleteId(session.id);
                          }}
                          disabled={deletingId === session.id}
                          style={{
                            border: "none",
                            background: "none",
                            color: "rgba(26,18,8,0.3)",
                            padding: 2,
                            opacity: deletingId === session.id ? 0.4 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                        <span className="flex-1" />
                        <span
                          style={{
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 13,
                            fontWeight: 500,
                            color: "#C8522A",
                          }}
                        >
                          View →
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {confirmDeleteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: "rgba(26, 18, 8, 0.45)", backdropFilter: "blur(8px)" }}
              onClick={() => setConfirmDeleteId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              className="fixed inset-x-5 z-50 max-w-[360px] mx-auto"
              style={{ top: "50%", transform: "translateY(-50%)" }}
            >
              <div style={{ backgroundColor: "#FDFAF5", borderRadius: 28, padding: 28, boxShadow: "0 20px 60px rgba(26,18,8,0.15)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#F5E8E0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AlertCircle size={20} strokeWidth={1.8} color="#C8522A" />
                  </div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
                    Delete Session?
                  </p>
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", lineHeight: 1.5, marginBottom: 24 }}>
                  This session will be permanently removed from your history.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 100,
                      backgroundColor: "transparent",
                      border: "1px solid #E8E0D4",
                      color: "rgba(26,18,8,0.6)",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleDelete(confirmDeleteId)}
                    disabled={deletingId === confirmDeleteId}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 100,
                      backgroundColor: "#C8522A",
                      border: "none",
                      color: "#FFFFFF",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      opacity: deletingId === confirmDeleteId ? 0.7 : 1,
                    }}
                  >
                    {deletingId === confirmDeleteId ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TabBar />
    </div >
  );
}
