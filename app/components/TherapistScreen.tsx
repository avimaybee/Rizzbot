import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  "I am here to help you process patterns, decode mixed signals, and protect your peace. What feels heaviest right now?";

const ensureUnique = (values: string[] = []): string[] => [...new Set(values.filter(Boolean))];

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
              style={{
                width: "100%",
                height: 42,
                borderRadius: 12,
                border: "1px solid #E8E0D4",
                padding: "0 12px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                outline: "none",
                backgroundColor: "#FFFFFF",
              }}
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
            style={{
              width: "100%",
              minHeight: 60,
              borderRadius: 10,
              border: "1px solid #E8E0D4",
              padding: 10,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              outline: "none",
            }}
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

export function TherapistScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser } = useAppContext();
  const [messages, setMessages] = useState<TherapistUiMessage[]>(() => {
    try {
      const saved = localStorage.getItem("therapist_messages");
      if (saved) return JSON.parse(saved) as TherapistUiMessage[];
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
  const [inputValue, setInputValue] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
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
  const endRef = useRef<HTMLDivElement | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);

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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, pendingExercise]);

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
    setMessages((session.messages || []) as TherapistUiMessage[]);
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
      await saveMemory(authUser.uid, memoryType, memoryDraft.trim(), interactionId);
      setMemoryDraft("");
      await refreshMemories();
      toast("Memory saved", "success");
    } catch {
      toast("Could not save memory", "error");
    }
  };

  const handleUpdateMemory = async (id: number, content: string, type: "GLOBAL" | "SESSION") => {
    if (!id) return;
    try {
      await updateMemory(id, content, type);
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

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if ((!trimmed && pendingImages.length === 0) || isLoading || !authUser?.uid) return;

    const currentInteractionId = interactionId || `session_${Date.now()}`;
    if (!interactionId) setInteractionId(currentInteractionId);

    const userMsg: TherapistUiMessage = {
      role: "user",
      content: trimmed || "[shared screenshots]",
      timestamp: Date.now(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setPendingImages([]);
    setIsLoading(true);
    setStreamingContent("");

    const capturedInsights: Record<string, any> = {};

    try {
      let fullResponse = "";
      const newInteractionId = await streamTherapistAdvice(
        trimmed || "Please analyze the attached screenshots and guide me.",
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
            void saveMemory(authUser.uid, args.type, args.content, currentInteractionId).then(() => {
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
          content: "I hit a processing issue. Try rephrasing or sending one screenshot at a time.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />

      <div className="relative z-10 max-w-[430px] mx-auto flex flex-col min-h-screen w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-14 pb-2">
          <button onClick={() => navigate("/home")} className="cursor-pointer p-1">
            <ChevronLeft size={24} strokeWidth={1.8} color="#1A1208" />
          </button>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
            Deep Dive
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSessionSheet(true)}
              style={{ border: "none", background: "none", color: "#C8522A", cursor: "pointer", padding: 6 }}
            >
              <History size={18} />
            </button>
            <button
              onClick={() => setShowMemorySheet(true)}
              style={{ border: "none", background: "none", color: "#C8522A", cursor: "pointer", padding: 6 }}
            >
              <MemoryStick size={18} />
            </button>
          </div>
        </div>

        {/* Hero text — only when conversation just started */}
        {messages.length <= 1 && (
          <div className="px-5 mt-2">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 400, color: "rgba(26,18,8,0.55)", lineHeight: 1.3 }}>
              What's on
            </p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, fontStyle: "italic", color: "#1A1208", lineHeight: 1.2 }}>
              your mind?
            </p>
          </div>
        )}

        {/* Context banner */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2" style={{ backgroundColor: "#FDF0F0", borderRadius: 16, padding: "10px 16px" }}>
            <Heart size={14} strokeWidth={1.8} color="rgba(212,131,138,0.6)" style={{ flexShrink: 0 }} />
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(26,18,8,0.55)" }}>
              This space is private and judgment-free
            </p>
          </div>
        </div>

        {/* Chat area */}
        <div
          className="flex-1 overflow-y-auto px-5"
          style={{ paddingBottom: insightsOpen ? "calc(60vh + 80px)" : 148 }}
        >
          {messages.map((msg, idx) => (
            <div key={`${msg.timestamp}-${idx}`} className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}>
              <div
                style={{
                  display: "inline-block",
                  maxWidth: "75%",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  backgroundColor: msg.role === "user" ? "#FDFAF5" : "#FDF0F0",
                  padding: "10px 16px",
                }}
              >
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-2 flex gap-2 flex-wrap">
                    {msg.images.map((img, i) => (
                      <img key={i} src={img} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                    ))}
                  </div>
                )}
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 400, color: "#1A1208", lineHeight: 1.5 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              </div>

              {msg.role === "therapist" && (
                <div style={{ maxWidth: "75%" }}>
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
          ))}

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
            <div className="mb-3 text-left">
              <div
                style={{
                  display: "inline-block",
                  maxWidth: "75%",
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
                  <div className="flex items-center gap-1 py-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "rgba(212,131,138,0.6)" }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Fixed bottom area */}
        <div className="fixed left-0 right-0 bottom-20 z-30">
          <div className="max-w-[430px] mx-auto">
            {/* View Insights toggle */}
            <button
              onClick={() => {
                setInsightsOpen((prev) => !prev);
                if (window.navigator && (window.navigator as any).vibrate) {
                  (window.navigator as any).vibrate(10);
                }
              }}
              className="flex items-center justify-center gap-2 w-full"
              style={{
                padding: "8px 0",
                backgroundColor: "#FDFAF5",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "#C8522A" }}>
                {insightsOpen ? "Hide Insights" : "View Insights"}
              </span>
              {insightsOpen ? <ChevronDown size={14} color="#C8522A" /> : <ChevronUp size={14} color="#C8522A" />}
            </button>

            {/* Input bar */}
            <div style={{ backgroundColor: "#FDFAF5", borderTop: "1px solid #E8E0D4" }}>
              <div className="px-4 py-3">
                {pendingImages.length > 0 && (
                  <div className="mb-2 flex gap-2 overflow-x-auto">
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

                <div className="flex items-center gap-2">
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
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
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
                    <Lightbulb size={18} />
                  </button>
                  <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Share what's on your mind..."
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 100,
                      border: "none",
                      backgroundColor: "#F5EFE6",
                      padding: "0 16px",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      outline: "none",
                      color: "#1A1208",
                    }}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={isLoading || (!inputValue.trim() && pendingImages.length === 0)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "#C8522A",
                      color: "#FFFFFF",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      opacity: isLoading || (!inputValue.trim() && pendingImages.length === 0) ? 0.5 : 1,
                    }}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Insights Drawer */}
        <AnimatePresence>
          {insightsOpen && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed left-0 right-0 bottom-20 z-30"
              style={{ maxHeight: "60vh", pointerEvents: "auto" }}
            >
              <div
                className="max-w-[430px] mx-auto overflow-y-auto"
                style={{
                  backgroundColor: "#FDFAF5",
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  boxShadow: "0 -4px 30px rgba(26,18,8,0.08)",
                  maxHeight: "60vh",
                  paddingBottom: 24,
                }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div style={{ width: 40, height: 4, borderRadius: 100, backgroundColor: "#E8E0D4" }} />
                </div>

                <div className="px-5">
                  {/* Header */}
                  <p className="mb-4" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                    YOUR INSIGHTS
                  </p>

                  {/* Key Themes */}
                  {clinicalNotes.keyThemes.length > 0 && (
                    <div className="mb-5">
                      <p className="mb-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,18,8,0.55)" }}>
                        KEY THEMES
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {clinicalNotes.keyThemes.map((theme) => (
                          <button
                            key={theme}
                            onClick={() => setExpandedTheme((prev) => (prev === theme ? null : theme))}
                            style={{
                              borderRadius: 100,
                              padding: "5px 12px",
                              border: "none",
                              backgroundColor: expandedTheme === theme ? "#C8522A" : "#F5E8E0",
                              color: expandedTheme === theme ? "#FFFFFF" : "#C8522A",
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 12,
                              fontWeight: 500,
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {theme}
                          </button>
                        ))}
                      </div>
                      <AnimatePresence>
                        {expandedTheme && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-2 overflow-hidden"
                          >
                            <div style={{ backgroundColor: "#F5E8E0", borderRadius: 14, padding: "12px 16px" }}>
                              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", lineHeight: 1.5 }}>
                                Theme: {expandedTheme}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Attachment Style */}
                  {clinicalNotes.attachmentStyle && clinicalNotes.attachmentStyle !== "unknown" && (
                    <div className="mb-5">
                      <p className="mb-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "#C8522A" }}>
                        ATTACHMENT STYLE
                      </p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                        {clinicalNotes.attachmentStyle}
                      </p>
                      <p className="mt-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(26,18,8,0.55)", lineHeight: 1.5 }}>
                        Based on the patterns we've discussed so far
                      </p>
                    </div>
                  )}

                  {/* Action Items */}
                  {clinicalNotes.actionItems.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,18,8,0.55)" }}>
                        ACTION ITEMS
                      </p>
                      <ol className="list-none m-0 p-0 space-y-1">
                        {clinicalNotes.actionItems.map((item, i) => (
                          <li key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 400, color: "#1A1208", lineHeight: 1.5 }}>
                            {i + 1}. {item}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Session Sheet */}
      <AnimatePresence>
        {showSessionSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: "rgba(26,18,8,0.35)" }}
              onClick={() => setShowSessionSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <div
                className="max-w-[430px] mx-auto"
                style={{
                  backgroundColor: "#FDFAF5",
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  padding: "18px 18px 38px",
                  boxShadow: "0 -4px 30px rgba(26,18,8,0.08)",
                  maxHeight: "65vh",
                  overflowY: "auto",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                    Therapist Sessions
                  </p>
                  <button onClick={() => setShowSessionSheet(false)} style={{ border: "none", background: "none", color: "rgba(26,18,8,0.5)", cursor: "pointer" }}>
                    <X size={18} />
                  </button>
                </div>

                <button
                  onClick={handleNewSession}
                  style={{
                    width: "100%",
                    height: 44,
                    borderRadius: 999,
                    border: "1px solid #C8522A",
                    backgroundColor: "transparent",
                    color: "#C8522A",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    marginBottom: 12,
                  }}
                >
                  New Session
                </button>

                {sessions.length === 0 ? (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.55)" }}>
                    No saved sessions yet.
                  </p>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.interaction_id}
                      onClick={() => handleLoadSession(session)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        borderRadius: 12,
                        border: "1px solid #E8E0D4",
                        backgroundColor: interactionId === session.interaction_id ? "#F5E8E0" : "#FFFFFF",
                        padding: 12,
                        marginBottom: 8,
                        cursor: "pointer",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208" }}>
                          {session.clinical_notes?.keyThemes?.[0] || "Session notes"}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(26,18,8,0.45)" }}>
                          {formatAgo(session.updated_at || session.created_at || new Date().toISOString())}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Memory Sheet */}
      <AnimatePresence>
        {showMemorySheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: "rgba(26,18,8,0.35)" }}
              onClick={() => setShowMemorySheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <div
                className="max-w-[430px] mx-auto"
                style={{
                  backgroundColor: "#FDFAF5",
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  padding: "18px 18px 38px",
                  boxShadow: "0 -4px 30px rgba(26,18,8,0.08)",
                  maxHeight: "70vh",
                  overflowY: "auto",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                    Notes & Memories
                  </p>
                  <button onClick={() => setShowMemorySheet(false)} style={{ border: "none", background: "none", color: "rgba(26,18,8,0.5)", cursor: "pointer" }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E0D4", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(26,18,8,0.5)", marginBottom: 8 }}>
                    Clinical snapshot
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", marginBottom: 4 }}>
                    Attachment: {clinicalNotes.attachmentStyle || "unknown"}
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", marginBottom: 4 }}>
                    State: {clinicalNotes.emotionalState || "listening"}
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.6)" }}>
                    Themes: {clinicalNotes.keyThemes.length ? clinicalNotes.keyThemes.join(", ") : "none yet"}
                  </p>
                </div>

                <div style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E0D4", borderRadius: 14, padding: 12, marginBottom: 12 }}>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(26,18,8,0.5)", marginBottom: 8 }}>
                    Add memory
                  </p>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setMemoryType("GLOBAL")}
                      style={{
                        borderRadius: 999,
                        border: memoryType === "GLOBAL" ? "1px solid #C8522A" : "1px solid #E8E0D4",
                        backgroundColor: memoryType === "GLOBAL" ? "#F5E8E0" : "transparent",
                        color: memoryType === "GLOBAL" ? "#C8522A" : "rgba(26,18,8,0.6)",
                        fontSize: 12,
                        padding: "5px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Global
                    </button>
                    <button
                      onClick={() => setMemoryType("SESSION")}
                      style={{
                        borderRadius: 999,
                        border: memoryType === "SESSION" ? "1px solid #C8522A" : "1px solid #E8E0D4",
                        backgroundColor: memoryType === "SESSION" ? "#F5E8E0" : "transparent",
                        color: memoryType === "SESSION" ? "#C8522A" : "rgba(26,18,8,0.6)",
                        fontSize: 12,
                        padding: "5px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Session
                    </button>
                  </div>
                  <textarea
                    value={memoryDraft}
                    onChange={(e) => setMemoryDraft(e.target.value)}
                    placeholder="Save a key fact or pattern..."
                    style={{
                      width: "100%",
                      minHeight: 54,
                      borderRadius: 10,
                      border: "1px solid #E8E0D4",
                      padding: 10,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => void handleAddMemory()}
                    style={{
                      marginTop: 8,
                      height: 34,
                      borderRadius: 999,
                      border: "none",
                      backgroundColor: "#C8522A",
                      color: "#FFFFFF",
                      fontSize: 12,
                      padding: "0 12px",
                      cursor: "pointer",
                    }}
                  >
                    Save memory
                  </button>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} color="#C8522A" />
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1208" }}>
                      Global Memories
                    </p>
                  </div>
                  {activeMemories.global.length === 0 ? (
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)", marginBottom: 10 }}>
                      No global memories yet.
                    </p>
                  ) : (
                    activeMemories.global.map((memory) => (
                      <div key={memory.id} className="mb-2">
                        <MemoryItem memory={memory} onUpdate={handleUpdateMemory} onDelete={handleDeleteMemory} />
                      </div>
                    ))
                  )}

                  <div className="flex items-center gap-2 mb-2 mt-3">
                    <Lightbulb size={14} color="#C8522A" />
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1208" }}>
                      Session Memories
                    </p>
                  </div>
                  {activeMemories.session.length === 0 ? (
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)" }}>
                      No session memories yet.
                    </p>
                  ) : (
                    activeMemories.session.map((memory) => (
                      <div key={memory.id} className="mb-2">
                        <MemoryItem memory={memory} onUpdate={handleUpdateMemory} onDelete={handleDeleteMemory} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TabBar />
    </div>
  );
}
