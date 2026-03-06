import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionState } from "../utils/useSessionState";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Heart,
  History,
  ImagePlus,
  Lightbulb,
  MemoryStick,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import {
  deleteMemory,
  getMemories,
  getTherapistSessions,
  saveMemory,
  saveTherapistSession,
  TherapistMemory,
  TherapistSession,
  updateMemory,
} from "../../services/dbService";
import { streamTherapistAdvice } from "../../services/geminiService";
import { ClinicalNotes, ExerciseType, TherapistExercise } from "../../types";
import { useScrollFade } from "../utils/useScrollFade";

type TherapistUiMessage = {
  role: "user" | "therapist";
  content: string;
  timestamp: number;
  images?: string[];
  closureScript?: { tone: string; script: string; explanation: string };
  safetyIntervention?: { level: string; reason: string; calmDownText: string };
  parentalPattern?: { dynamicName: string; insight: string };
  valuesMatrix?: { alignmentScore: number };
  perspective?: { suggestedMotive?: string };
  pattern?: { patternName?: string; explanation?: string };
  projection?: { behavior?: string; potentialRoot?: string };
};

const DEFAULT_NOTES: ClinicalNotes = {
  attachmentStyle: "unknown",
  keyThemes: [],
  emotionalState: undefined,
  relationshipDynamic: undefined,
  userInsights: [],
  actionItems: [],
  customNotes: "",
};

const WELCOME_MESSAGE =
  "Welcome. I'm here to help you make sense of what's happening — vent, spot patterns, or just think it through. Where do you want to start?";
const BOTTOM_NAV_HEIGHT = 60;
const CHAT_BOTTOM_BUFFER = 16;
const DEFAULT_COMPOSER_HEIGHT = 110;
const HERO_SECTION_MAX_HEIGHT = 120;

const ensureUnique = (values: string[] = []): string[] => [...new Set(values.filter(Boolean))];
const normalizeMessageContent = (content: string = "") =>
  content.replace(/\[shared screenshots\]/gi, "📎 Screenshot");
const isLegacyTherapistWelcome = (content: string = "") => {
  const lowerContent = content.toLowerCase();
  const hasLegacyWelcomeHeader =
    lowerContent.includes("welcome to therapist mode") || lowerContent.includes("how i can help");
  const matchedBulletPhrases = ["vent freely", "spot patterns", "build skills"].filter((phrase) =>
    lowerContent.includes(phrase)
  ).length;
  return hasLegacyWelcomeHeader || matchedBulletPhrases >= 2;
};
const normalizeMessages = (messages: TherapistUiMessage[] = []): TherapistUiMessage[] =>
  messages.map((msg) => {
    const normalizedContent = normalizeMessageContent(msg.content);
    if (msg.role === "therapist" && isLegacyTherapistWelcome(normalizedContent)) {
      return { ...msg, content: WELCOME_MESSAGE };
    }
    return { ...msg, content: normalizedContent };
  });

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read image"));
    reader.readAsDataURL(file);
  });

const formatAgo = (isoDate: string) => {
  const delta = Date.now() - new Date(isoDate).getTime();
  const hours = Math.max(1, Math.floor(delta / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="my-3 overflow-hidden" style={{ backgroundColor: '#FDFAF5', borderRadius: 20, boxShadow: '0 2px 16px rgba(26,18,8,0.07)' }}>
      <div className="flex">
        <div style={{ width: 3, backgroundColor: '#C8522A', flexShrink: 0 }} />
        <div className="p-4 flex-1">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C8522A', marginBottom: 8 }}>
            {title}
          </p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: '#1A1208', lineHeight: 1.5 }}>
            {body}
          </p>
          <p className="mt-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: '#C8522A' }}>
            Explore this →
          </p>
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  onComplete,
  onSkip,
}: {
  exercise: TherapistExercise;
  onComplete: (payload: unknown) => void;
  onSkip: () => void;
}) {
  const [boundaries, setBoundaries] = useState(["", "", ""]);
  const [needs, setNeeds] = useState({ safety: 50, connection: 50, autonomy: 50 });

  return (
    <div
      style={{
        backgroundColor: "#FDFAF5",
        borderRadius: 18,
        padding: 16,
        border: "1px solid #E8E0D4",
      }}
    >
      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#C8522A",
          marginBottom: 8,
        }}
      >
        Guided exercise
      </p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 26,
          fontStyle: "italic",
          color: "#1A1208",
          lineHeight: 1.1,
        }}
      >
        {exercise.type.replace("_", " ")}
      </p>
      <p style={{ marginTop: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.6)", lineHeight: 1.5 }}>
        {exercise.context}
      </p>

      {exercise.type === "boundary_builder" && (
        <div className="mt-3 space-y-2">
          {boundaries.map((value, i) => (
            <input
              key={i}
              value={value}
              onChange={(e) => {
                const next = [...boundaries];
                next[i] = e.target.value;
                setBoundaries(next);
              }}
              placeholder={`Boundary ${i + 1}`}
              className="w-full h-[42px] px-3 rounded-[12px] border border-[#E8E0D4] bg-[#FFFFFF] outline-none text-[14px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          ))}
        </div>
      )}

      {exercise.type === "needs_assessment" && (
        <div className="mt-3 space-y-3">
          {Object.entries(needs).map(([key, value]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", textTransform: "capitalize" }}>
                  {key}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#C8522A" }}>{value}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => setNeeds((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={onSkip}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 999,
            border: "1px solid #E8E0D4",
            backgroundColor: "transparent",
            color: "rgba(26,18,8,0.65)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Skip
        </button>
        <button
          onClick={() => {
            if (exercise.type === "boundary_builder") {
              onComplete({ boundaries: boundaries.filter((b) => b.trim()) });
            } else if (exercise.type === "needs_assessment") {
              onComplete(needs);
            } else {
              onComplete({ completed: true });
            }
          }}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 999,
            border: "none",
            backgroundColor: "#C8522A",
            color: "#FFFFFF",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Complete
        </button>
      </div>
    </div>
  );
}

function MemoryItem({
  memory,
  onUpdate,
  onDelete,
}: {
  memory: TherapistMemory;
  onUpdate: (id: number, value: string, type: "GLOBAL" | "SESSION") => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const id = memory.id || 0;

  return (
    <div style={{ border: "1px solid #E8E0D4", borderRadius: 12, padding: 10, backgroundColor: "#FFFFFF" }}>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full min-h-[60px] rounded-[10px] border border-[#E8E0D4] p-2.5 text-[13px] bg-[#FFFFFF] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm outline-none resize-none"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                onUpdate(id, draft, memory.type);
                setEditing(false);
              }}
              style={{
                height: 32,
                borderRadius: 999,
                border: "none",
                backgroundColor: "#C8522A",
                color: "#FFFFFF",
                fontSize: 12,
                padding: "0 12px",
                cursor: "pointer",
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setDraft(memory.content);
                setEditing(false);
              }}
              style={{
                height: 32,
                borderRadius: 999,
                border: "1px solid #E8E0D4",
                backgroundColor: "transparent",
                color: "rgba(26,18,8,0.7)",
                fontSize: 12,
                padding: "0 12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", lineHeight: 1.45 }}>{memory.content}</p>
          <div className="mt-2 flex items-center justify-between">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(26,18,8,0.45)" }}>
              {memory.created_at ? formatAgo(memory.created_at) : "now"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                style={{ border: "none", background: "none", color: "#C8522A", cursor: "pointer", fontSize: 12 }}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(id)}
                style={{ border: "none", background: "none", color: "#C8522A", cursor: "pointer" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MessageImages({ images }: { images: string[] }) {
  const { ref, style } = useScrollFade();
  return (
    <div
      ref={ref}
      className="mb-2 flex gap-2 w-full overflow-x-auto pb-1 no-scrollbar"
      style={style}
    >
      {images.map((img, i) => (
        <img key={i} src={img} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
      ))}
    </div>
  );
}

export function TherapistScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser } = useAppContext();
  const [messages, setMessages] = useState<TherapistUiMessage[]>(() => {
    try {
      const saved = localStorage.getItem("therapist_messages");
      if (saved) return normalizeMessages(JSON.parse(saved) as TherapistUiMessage[]);
    } catch {
      // ignore invalid cache
    }
    return [{ role: "therapist", content: WELCOME_MESSAGE, timestamp: Date.now() }];
  });
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNotes>(() => {
    try {
      const saved = localStorage.getItem("therapist_notes");
      if (saved) return JSON.parse(saved) as ClinicalNotes;
    } catch {
      // ignore invalid cache
    }
    return DEFAULT_NOTES;
  });
  const [interactionId, setInteractionId] = useState<string | undefined>(
    () => localStorage.getItem("therapist_interaction_id") || undefined
  );
  const [inputValue, setInputValue] = useSessionState("therapist_input", "");
  const [pendingImages, setPendingImages] = useSessionState<string[]>("therapist_images", []);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingExercise, setPendingExercise] = useState<TherapistExercise | null>(null);

  const [sessions, setSessions] = useState<TherapistSession[]>([]);
  const [memories, setMemories] = useState<TherapistMemory[]>([]);
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [showMemorySheet, setShowMemorySheet] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryType, setMemoryType] = useState<"GLOBAL" | "SESSION">("GLOBAL");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const pendingFade = useScrollFade();
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(DEFAULT_COMPOSER_HEIGHT);

  const refreshSessions = useCallback(() => {
    if (!authUser?.uid) return;
    void getTherapistSessions(authUser.uid)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [authUser?.uid]);

  const refreshMemories = useCallback(() => {
    if (!authUser?.uid) return;
    void getMemories(authUser.uid, undefined, interactionId)
      .then((data) => setMemories(data))
      .catch(() => setMemories([]));
  }, [authUser?.uid, interactionId]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    refreshMemories();
  }, [refreshMemories]);

  useEffect(() => {
    const chatScrollEl = chatScrollRef.current;
    if (!chatScrollEl) return;
    chatScrollEl.scrollTo({ top: chatScrollEl.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent, pendingExercise]);

  useEffect(() => {
    const composerEl = composerRef.current;
    if (!composerEl) return;

    const syncComposerHeight = () => setComposerHeight(composerEl.offsetHeight);
    syncComposerHeight();
    const resizeObserver = new ResizeObserver(syncComposerHeight);
    resizeObserver.observe(composerEl);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem("therapist_messages", JSON.stringify(messages));
    localStorage.setItem("therapist_notes", JSON.stringify(clinicalNotes));
    if (interactionId) {
      localStorage.setItem("therapist_interaction_id", interactionId);
    }
    if (authUser?.uid && interactionId) {
      void saveTherapistSession(authUser.uid, interactionId, messages, clinicalNotes);
    }
  }, [messages, clinicalNotes, interactionId, authUser?.uid]);

  const activeMemories = useMemo(
    () => ({
      global: memories.filter((m) => m.type === "GLOBAL"),
      session: memories.filter((m) => m.type === "SESSION"),
    }),
    [memories]
  );

  const handleNewSession = () => {
    setMessages([{ role: "therapist", content: WELCOME_MESSAGE, timestamp: Date.now() }]);
    setClinicalNotes(DEFAULT_NOTES);
    setInteractionId(undefined);
    setPendingExercise(null);
    setInputValue("");
    setPendingImages([]);
    localStorage.removeItem("therapist_messages");
    localStorage.removeItem("therapist_notes");
    localStorage.removeItem("therapist_interaction_id");
    setShowSessionSheet(false);
    toast("Started a fresh session", "success");
  };

  const handleLoadSession = (session: TherapistSession) => {
    setInteractionId(session.interaction_id);
    setMessages(normalizeMessages((session.messages || []) as TherapistUiMessage[]));
    setClinicalNotes((session.clinical_notes || DEFAULT_NOTES) as ClinicalNotes);
    setPendingExercise(null);
    setShowSessionSheet(false);
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, 4);
    try {
      const encoded = await Promise.all(picked.map((file) => toDataUrl(file)));
      setPendingImages((prev) => [...prev, ...encoded].slice(0, 4));
      toast(`${encoded.length} image(s) attached`, "success");
    } catch {
      toast("Could not read image", "error");
    }
  };

  const handleAddMemory = async () => {
    if (!authUser?.uid || !memoryDraft.trim()) return;
    try {
      await saveMemory(authUser.uid, memoryType, memoryDraft.trim(), interactionId, "USER");
      setMemoryDraft("");
      await refreshMemories();
      toast("Memory saved", "success");
    } catch {
      toast("Could not save memory", "error");
    }
  };

  const handleUpdateMemory = async (id: number, content: string, type: "GLOBAL" | "SESSION", creator?: "AI" | "USER") => {
    if (!id) return;
    try {
      await updateMemory(id, content, type, creator);
      await refreshMemories();
    } catch {
      toast("Could not update memory", "error");
    }
  };

  const handleDeleteMemory = async (id: number) => {
    if (!id) return;
    try {
      await deleteMemory(id);
      await refreshMemories();
      toast("Memory removed", "info");
    } catch {
      toast("Could not delete memory", "error");
    }
  };

  const handleSend = async (override?: { content: string; images?: string[] }) => {
    const trimmed = normalizeMessageContent(override ? override.content : inputValue).trim();
    const outgoingImages = override ? [...(override.images || [])] : pendingImages;
    if ((!trimmed && outgoingImages.length === 0) || isLoading || !authUser?.uid) return;

    const currentInteractionId = interactionId || `session_${Date.now()}`;
    if (!interactionId) setInteractionId(currentInteractionId);

    const userContent = trimmed || "📎 Screenshot";
    const userMsg: TherapistUiMessage = {
      role: "user",
      content: userContent,
      timestamp: Date.now(),
      images: outgoingImages.length > 0 ? outgoingImages : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!override) {
      setInputValue("");
      setPendingImages([]);
    }
    setIsLoading(true);
    setStreamingContent("");

    let isStillLoading = true;
    const toastTimeout = setTimeout(() => {
      if (isStillLoading) {
        toast("This is taking a bit longer than usual, stay with us...", "info");
      }
    }, 6000);

    const capturedInsights: Record<string, any> = {};

    try {
      let fullResponse = "";
      const newInteractionId = await streamTherapistAdvice(
        userContent === "📎 Screenshot" ? "Please analyze the attached screenshots and guide me." : userContent,
        currentInteractionId,
        userMsg.images,
        clinicalNotes,
        (chunk) => {
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        },
        (noteDelta) => {
          setClinicalNotes((prev) => ({
            ...prev,
            ...noteDelta,
            keyThemes: ensureUnique([...(prev.keyThemes || []), ...(noteDelta.keyThemes || [])]),
            userInsights: ensureUnique([...(prev.userInsights || []), ...(noteDelta.userInsights || [])]),
            actionItems: ensureUnique([...(prev.actionItems || []), ...(noteDelta.actionItems || [])]),
          }));
        },
        (exercise) =>
          setPendingExercise({
            type: exercise.type as ExerciseType,
            context: exercise.context,
            completed: false,
          }),
        (toolName, args) => {
          capturedInsights[toolName] = args;
          if (toolName === "save_memory" && args && authUser?.uid) {
            void saveMemory(authUser.uid, args.type, args.content, currentInteractionId, "AI").then(() => {
              void refreshMemories();
            });
          }
        },
        memories
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "therapist",
          content: fullResponse,
          timestamp: Date.now(),
          closureScript: capturedInsights["generate_closure_script"],
          safetyIntervention: capturedInsights["trigger_safety_intervention"],
          parentalPattern: capturedInsights["log_parental_pattern"],
          valuesMatrix: capturedInsights["assign_values_matrix"],
          perspective: capturedInsights["show_perspective_bridge"],
          pattern: capturedInsights["show_communication_insight"],
          projection: capturedInsights["flag_projection"],
        },
      ]);

      if (newInteractionId) {
        setInteractionId(newInteractionId);
      }
      void refreshSessions();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "therapist",
          content: "⚠️ Something went wrong. Let me try a different approach — could you rephrase that, or send one screenshot at a time?",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      isStillLoading = false;
      clearTimeout(toastTimeout);
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  const lastUserTurn = useMemo(
    () => [...messages].reverse().find((msg) => msg.role === "user"),
    [messages]
  );

  const handleRetryLastTurn = () => {
    if (!lastUserTurn) return;
    void handleSend({ content: lastUserTurn.content, images: lastUserTurn.images });
  };

  const isSendDisabled = isLoading || (!inputValue.trim() && pendingImages.length === 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative flex flex-col min-h-screen" 
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <GrainOverlay />

      <div className="relative z-10 max-w-[430px] mx-auto flex flex-col min-h-screen w-full">
        {/* Sticky Header */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-5 pt-6 pb-2 relative" style={{ backgroundColor: "#F5EFE6" }}>
          <button
            onClick={() => navigate("/home")}
            className="cursor-pointer flex items-center justify-center fade-press relative z-10"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4" }}
          >
            <ChevronLeft size={22} strokeWidth={1.8} color="#1A1208" />
          </button>
          <p className="absolute left-1/2 -translate-x-1/2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 600, color: "#1A1208", paddingBottom: 2 }}>
            Therapist
          </p>
          <div className="relative z-10 flex items-center gap-1 justify-end">
            <button
              onClick={() => {
                setInsightsOpen(true);
                haptics.light();
              }}
              className="flex items-center justify-center cursor-pointer fade-press"
              style={{
                width: 44,
                height: 44,
                border: "1px solid #E8E0D4",
                background: "#FDFAF5",
                borderRadius: 22,
                transition: "all 0.2s ease",
              }}
            >
              <Lightbulb size={18} color="rgba(26,18,8,0.6)" />
            </button>
            <button
              onClick={() => {
                setShowSessionSheet(true);
                haptics.light();
              }}
              className="flex items-center justify-center cursor-pointer fade-press"
              style={{
                width: 44,
                height: 44,
                border: "1px solid #E8E0D4",
                background: "#FDFAF5",
                borderRadius: 22,
              }}
            >
              <History size={18} color="rgba(26,18,8,0.6)" />
            </button>
          </div>
        </div>

        {/* Hero text — only when conversation just started */}
        <div
          className="px-5 mt-2 transition-all duration-300 overflow-hidden"
          style={{ opacity: messages.length <= 1 ? 1 : 0, maxHeight: messages.length <= 1 ? HERO_SECTION_MAX_HEIGHT : 0 }}
        >
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 400, color: "rgba(26,18,8,0.55)", lineHeight: 1.3 }}>
            What's on
          </p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, fontStyle: "italic", color: "#1A1208", lineHeight: 1.2 }}>
            your mind?
          </p>
        </div>



        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: composerHeight + BOTTOM_NAV_HEIGHT + CHAT_BOTTOM_BUFFER }}>
          {messages.map((msg, idx) => {
            const normalizedContent = normalizeMessageContent(msg.content);
            const isTherapistError = msg.role === "therapist" && normalizedContent.startsWith("⚠️");
            return (
              <div key={`${msg.timestamp}-${idx}`} className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2"}`}>
                <div className={msg.role === "user" ? "text-right" : "text-left"} style={{ maxWidth: "75%" }}>
                  <div
                    style={{
                      display: "inline-block",
                      borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                      backgroundColor: msg.role === "user" ? "#FDFAF5" : isTherapistError ? "#FFF5E4" : "#FDF0F0",
                      border: isTherapistError ? "1px solid #F0DEC0" : "none",
                      padding: "10px 16px",
                      textAlign: "left",
                    }}
                    >
                    {msg.images && msg.images.length > 0 && (
                      <MessageImages images={msg.images} />
                    )}
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 400, color: "#1A1208", lineHeight: 1.5 }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizedContent}</ReactMarkdown>
                    </div>
                  </div>

                  {msg.role === "therapist" && (
                    <div className="mt-2 text-left">
                      {isTherapistError && lastUserTurn && (
                        <button
                          onClick={handleRetryLastTurn}
                          style={{ border: "none", background: "none", color: "#C8522A", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 6 }}
                        >
                          Retry
                        </button>
                      )}
                      {msg.pattern?.patternName && <InsightCard title="Pattern Insight" body={msg.pattern.patternName} />}
                      {msg.perspective?.suggestedMotive && <InsightCard title="Perspective Bridge" body={msg.perspective.suggestedMotive} />}
                      {msg.projection?.behavior && <InsightCard title="Projection Check" body={`${msg.projection.behavior} ↔ ${msg.projection.potentialRoot || ""}`} />}
                      {msg.closureScript?.script && <InsightCard title="Closure Script" body={msg.closureScript.script} />}
                      {msg.parentalPattern?.insight && <InsightCard title="Generational Pattern" body={msg.parentalPattern.insight} />}
                      {typeof msg.valuesMatrix?.alignmentScore === "number" && (
                        <InsightCard title="Values Alignment" body={`${msg.valuesMatrix.alignmentScore}% alignment score`} />
                      )}
                      {msg.safetyIntervention?.reason && <InsightCard title="Safety Flag" body={msg.safetyIntervention.reason} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {pendingExercise && !pendingExercise.completed && (
            <ExerciseCard
              exercise={pendingExercise}
              onSkip={() => setPendingExercise(null)}
              onComplete={(payload) => {
                setPendingExercise((prev) => (prev ? { ...prev, completed: true, result: payload } : prev));
                setInputValue(`[Completed ${pendingExercise.type}] ${JSON.stringify(payload)}`);
              }}
            />
          )}

          {isLoading && (
            <div className="mb-3 flex justify-start gap-2">
              <div className="text-left" style={{ maxWidth: "75%" }}>
                <div
                  style={{
                    display: "inline-block",
                    borderRadius: "18px 18px 18px 4px",
                    backgroundColor: "#FDF0F0",
                    padding: "10px 16px",
                  }}
                >
                  {streamingContent ? (
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 400, color: "#1A1208", lineHeight: 1.5 }}>
                      {streamingContent}
                      <span style={{ opacity: 0.7 }}>▋</span>
                    </p>
                  ) : (
                    <div className="flex items-center gap-1 py-1 px-2">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "rgba(212,131,138,0.6)" }}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Fixed bottom area */}
        <div ref={composerRef} className="fixed left-0 right-0 z-30" style={{ bottom: BOTTOM_NAV_HEIGHT }}>
          <div className="max-w-[430px] mx-auto">
            {/* Input bar */}
            <div style={{ backgroundColor: "#FDFAF5", borderTop: "1px solid #E8E0D4" }}>
              <div className="px-4 py-3">
                {pendingImages.length > 0 && (
                  <div 
                    ref={pendingFade.ref}
                    className="mb-2 flex gap-2 w-full overflow-x-auto no-scrollbar pb-1"
                    style={pendingFade.style}
                  >
                    {pendingImages.map((img, i) => (
                      <div key={i} className="relative shrink-0">
                        <img src={img} alt="" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 10, border: "1px solid #E8E0D4" }} />
                        <button
                          onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            border: "none",
                            backgroundColor: "#C8522A",
                            color: "#FFFFFF",
                            cursor: "pointer",
                            fontSize: 10,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex w-full items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      void handleImageUpload(e.target.files);
                    }}
                  />
                  <div className="flex flex-1 w-full items-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Attach image"
                      style={{
                        width: 40,
                        height: 44,
                        borderRadius: 12,
                        border: "none",
                        backgroundColor: "transparent",
                        color: "#C8522A",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <ImagePlus size={20} />
                    </button>
                    <textarea
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder="Type a message..."
                      rows={1}
                      className="flex-1 w-full min-w-0 min-h-[44px] max-h-[120px] rounded-[22px] border border-transparent bg-[#F5EFE6] px-4 py-[11px] text-[15px] text-[#1A1208] outline-none resize-none overflow-y-auto transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20"
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        lineHeight: "1.4",
                        boxSizing: "border-box"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={isSendDisabled}
                      title={isSendDisabled ? "Type a message or add an image to send" : "Send message"}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        border: "none",
                        backgroundColor: "#C8522A",
                        color: "#FFFFFF",
                        cursor: isSendDisabled ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        opacity: isSendDisabled ? 0.4 : 1,
                      }}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <TabBar />
      </div>

      <AnimatePresence>
        {showSessionSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100]"
              style={{ backgroundColor: "rgba(26, 18, 8, 0.45)", backdropFilter: "blur(8px)" }}
              onClick={() => setShowSessionSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setShowSessionSheet(false);
              }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-[110] overflow-hidden"
              style={{ maxHeight: "85vh" }}
            >
              <div
                className="max-w-[430px] mx-auto flex flex-col h-full"
                style={{
                  backgroundColor: "#FDFAF5",
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  boxShadow: "0 -8px 40px rgba(26,18,8,0.15)",
                  maxHeight: "85vh",
                }}
              >
                <div className="flex justify-center pt-3 pb-2">
                  <div style={{ width: 36, height: 4, borderRadius: 100, backgroundColor: "rgba(26,18,8,0.12)" }} />
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-6">
                  <div className="flex items-center justify-between py-4 mb-2 sticky top-0 bg-[#FDFAF5] z-10">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 600, color: "#1A1208" }}>
                      Session History
                    </p>
                    <button
                      onClick={() => setShowSessionSheet(false)}
                      className="p-2"
                      style={{ border: "none", background: "none", color: "rgba(26,18,8,0.3)", cursor: "pointer" }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="mb-4">
                    <button
                      onClick={handleNewSession}
                      className="w-full flex items-center justify-center gap-2 mb-4"
                      style={{
                        backgroundColor: "#C8522A",
                        color: "#FFFFFF",
                        borderRadius: 16,
                        padding: "14px 16px",
                        border: "none",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 4px 12px rgba(200, 82, 42, 0.2)"
                      }}
                    >
                      <Sparkles size={16} />
                      Start Fresh Session
                    </button>

                    <div className="space-y-3">
                      {sessions.slice().reverse().map((session) => {
                        const dateStr = session.created_at ? new Date(session.created_at).toLocaleDateString() : "Unknown Date";
                        const msgCount = Array.isArray(session.messages) ? session.messages.filter((m: any) => m.role === "user").length : 0;
                        const isCurrent = session.interaction_id === interactionId;
                        const notes = session.clinical_notes as ClinicalNotes | undefined;

                        return (
                          <button
                            key={session.interaction_id}
                            onClick={() => handleLoadSession(session)}
                            className="w-full text-left flex flex-col gap-1 transition-all duration-300 active:scale-[0.98]"
                            style={{
                              backgroundColor: isCurrent ? "#FDF0F0" : "#FFFFFF",
                              border: isCurrent ? "1px solid #C8522A" : "1px solid #E8E0D4",
                              borderRadius: 16,
                              padding: "14px 16px",
                              cursor: "pointer",
                            }}
                          >
                            <div className="flex justify-between items-center w-full">
                              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: isCurrent ? "#C8522A" : "#1A1208" }}>
                                {dateStr} {isCurrent && "(Current)"}
                              </p>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(26,18,8,0.4)" }}>
                                {msgCount} msgs
                              </span>
                            </div>
                            {notes?.emotionalState && (
                              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.6)", marginTop: 4 }}>
                                State: {notes.emotionalState}
                              </p>
                            )}
                          </button>
                        );
                      })}

                      {sessions.length === 0 && (
                        <div className="text-center py-8">
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.5)" }}>
                            No past sessions found.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {insightsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100]"
              style={{ backgroundColor: "rgba(26, 18, 8, 0.45)", backdropFilter: "blur(8px)" }}
              onClick={() => setInsightsOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) setInsightsOpen(false);
              }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 z-[110] overflow-hidden"
              style={{ maxHeight: "85vh" }}
            >
              <div
                className="max-w-[430px] mx-auto flex flex-col h-full"
                style={{
                  backgroundColor: "#FDFAF5",
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  boxShadow: "0 -8px 40px rgba(26,18,8,0.15)",
                  maxHeight: "85vh",
                }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div style={{ width: 36, height: 4, borderRadius: 100, backgroundColor: "rgba(26,18,8,0.12)" }} />
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-6">
                  {/* Drawer Title & Header */}
                  <div className="flex items-center justify-between py-4 mb-2 sticky top-0 bg-[#FDFAF5] z-10">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 600, color: "#1A1208" }}>
                      Session Insights
                    </p>
                    <button
                      onClick={() => setInsightsOpen(false)}
                      className="p-2"
                      style={{ border: "none", background: "none", color: "rgba(26,18,8,0.3)", cursor: "pointer" }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Snapshot Section */}
                  <div className="mb-8 p-4 cursor-pointer" onClick={() => setInsightsOpen(true)} style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E0D4", borderRadius: 20 }}>
                    <p className="mb-3" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,18,8,0.4)" }}>
                      Current Context
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3" style={{ backgroundColor: "#FDF0F0", borderRadius: 14 }}>
                        <p style={{ fontSize: 11, color: "rgba(212,131,138,0.7)" }}>Attachment Style</p>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208", textTransform: "capitalize" }}>
                          {clinicalNotes.attachmentStyle || "Analyzing..."}
                        </p>
                      </div>
                      <div className="p-3" style={{ backgroundColor: "#FDFAF5", borderRadius: 14, border: "1px solid #E8E0D4" }}>
                        <p style={{ fontSize: 11, color: "rgba(26,18,8,0.4)" }}>State</p>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208", textTransform: "capitalize" }}>
                          {clinicalNotes.emotionalState || "Listening..."}
                        </p>
                      </div>
                    </div>
                    {clinicalNotes.keyThemes.length > 0 && (
                      <div>
                        <p className="mb-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(26,18,8,0.4)" }}>ACTIVE THEMES</p>
                        <div className="flex flex-wrap gap-1.5">
                          {clinicalNotes.keyThemes.map(theme => (
                            <span key={theme} style={{ padding: "4px 10px", backgroundColor: "#F5E8E0", color: "#C8522A", borderRadius: 100, fontSize: 12, fontWeight: 500 }}>
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Memories Section */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <MemoryStick size={16} color="#C8522A" />
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                          Notes & Memories
                        </p>
                      </div>
                      <span style={{ fontSize: 12, color: "rgba(26,18,8,0.45)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {memories.length} {memories.length === 1 ? "item" : "items"}
                      </span>
                    </div>

                    <div className="space-y-4 mb-4">
                      <textarea
                        value={memoryDraft}
                        onChange={(e) => setMemoryDraft(e.target.value)}
                        placeholder="Save a key fact or pattern..."
                        className="w-full min-h-[80px] rounded-[16px] border border-[#E8E0D4] p-3.5 text-[15px] bg-[#FFFFFF] outline-none resize-none transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                        style={{ fontFamily: "'DM Sans', sans-serif", lineHeight: "1.4" }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void handleAddMemory()}
                          disabled={!memoryDraft.trim()}
                          style={{
                            flex: 1,
                            height: 48,
                            borderRadius: 100,
                            border: "none",
                            backgroundColor: "#C8522A",
                            color: "#FFFFFF",
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            opacity: memoryDraft.trim() ? 1 : 0.5,
                            boxShadow: "0 4px 12px rgba(200, 82, 42, 0.2)"
                          }}
                        >
                          Save Note
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {memories.slice().reverse().map((memory) => (
                        <MemoryItem key={memory.id} memory={memory} onUpdate={handleUpdateMemory} onDelete={handleDeleteMemory} />
                      ))}
                    </div>
                  </div>

                  {/* Insights Section */}
                  {clinicalNotes.actionItems.length > 0 && (
                    <div className="pb-10">
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles size={16} color="#C8522A" />
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                          Suggested Focus
                        </p>
                      </div>
                      <div className="space-y-3">
                        {clinicalNotes.actionItems.map((item, i) => (
                          <div key={i} className="p-4" style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 16 }}>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", lineHeight: 1.5 }}>
                              • {item}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    className="pointer-events-none sticky bottom-0 h-8 -mt-8"
                    style={{ background: "linear-gradient(to top, #FDFAF5, rgba(253,250,245,0))" }}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div >
  );
}
