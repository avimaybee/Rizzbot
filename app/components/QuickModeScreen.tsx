import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionState } from "../utils/useSessionState";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  Clock,
  Copy,
  CornerDownRight,
  Info,
  Link2,
  Pencil,
  RotateCcw,
  Share2,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Timer,
  X,
  ChevronRight,
} from "lucide-react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { Skeleton } from "./ui/Skeleton";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import { getQuickAdvice } from "../../services/geminiService";
import { createSession, flushPendingSessions, queuePendingSession, recordActivity, submitFeedback } from "../../services/dbService";
import { logSession, saveFeedback } from "../../services/feedbackService";
import { QuickAdviceResponse, SuggestionOption } from "../../types";
import { useScrollFade } from "../utils/useScrollFade";

const toneOptions = [
  { key: "Smooth", help: null },
  { key: "Bold", help: null },
  { key: "Witty", help: null },
  { key: "Roast", help: "Playful teasing — savage but affectionate. Only when the vibe allows it." },
  { key: "Authentic", help: null },
  { key: "Your Style", help: "Uses your saved voice profile when available." },
] as const;

type Tone = (typeof toneOptions)[number]["key"];

const toneMap: Record<Tone, keyof QuickAdviceResponse["suggestions"]> = {
  Smooth: "smooth",
  Bold: "bold",
  Witty: "witty",
  Roast: "roast",
  Authentic: "authentic",
  "Your Style": "yourStyle",
};

const feedbackTypeMap: Record<Tone, string> = {
  Smooth: "smooth",
  Bold: "bold",
  Witty: "witty",
  Roast: "roast",
  Authentic: "authentic",
  "Your Style": "yourStyle",
};

const contextOptions = [
  { value: "stranger", label: "STRANGER" },
  { value: "new", label: "NEW" },
  { value: "talking", label: "TALKING" },
  { value: "dating", label: "DATING" },
  { value: "complicated", label: "COMPLEX" },
  { value: "friends", label: "FRIENDS" },
  { value: "ex", label: "EX" },
] as const;

type ContextOption = (typeof contextOptions)[number]["value"];

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Read failed"));
    reader.readAsDataURL(file);
  });

export function QuickModeScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser, userProfile, userId, runWellbeingCheck } = useAppContext();

  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [theirMessage, setTheirMessage] = useSessionState("quick_theirMessage", "", authUser?.uid);
  const [yourDraft, setYourDraft] = useSessionState("quick_yourDraft", "", authUser?.uid);
  const [context, setContext] = useSessionState<ContextOption>("quick_context", "new", authUser?.uid);
  const [activeTone, setActiveTone] = useSessionState<Tone>("quick_tone", "Smooth", authUser?.uid);
  const [showStyleTooltip, setShowStyleTooltip] = useState(false);
  const [screenshots, setScreenshots] = useSessionState<string[]>("quick_screenshots", [], authUser?.uid);
  const [result, setResult] = useState<QuickAdviceResponse | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "off" | null>(null);
  const [cursor, setCursor] = useState<Record<Tone, number>>({
    Smooth: 0,
    Bold: 0,
    Witty: 0,
    Roast: 0,
    Authentic: 0,
    "Your Style": 0,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    runWellbeingCheck();
  }, [runWellbeingCheck]);

  const selectedOptions = useMemo(() => {
    if (!result) return [];
    const key = toneMap[activeTone];
    const options = result.suggestions[key];
    return Array.isArray(options) ? options : [];
  }, [activeTone, result]);

  const selectedOption = selectedOptions.length
    ? selectedOptions[cursor[activeTone] % selectedOptions.length]
    : null;

  const ghostRisk = result ? Math.max(0, 100 - (result.vibeCheck?.interestLevel ?? 50)) : 0;
  const riskColor = ghostRisk > 65 ? "#C8522A" : ghostRisk > 35 ? "#D4A853" : "#7A9E7E";
  const riskLabel = ghostRisk > 65 ? "High" : ghostRisk > 35 ? "Medium" : "Low";

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = 3 - screenshots.length;
    if (remainingSlots <= 0) {
      toast("Maximum 3 screenshots allowed", "error");
      return;
    }

    const picked = Array.from(files).slice(0, remainingSlots);
    try {
      const encoded = await Promise.all(picked.map((f) => toDataUrl(f)));
      setScreenshots((prev) => [...prev, ...encoded]);
      toast(`${encoded.length} screenshot(s) attached`, "success");
    } catch {
      toast("Could not read one or more screenshots", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (isLoading) return;
    if (!theirMessage.trim() && screenshots.length === 0) {
      toast("Add a message or screenshot first", "error");
      return;
    }

    setIsLoading(true);
    setShowResults(false);
    setFeedbackGiven(null);
    setCursor({ Smooth: 0, Bold: 0, Witty: 0, Roast: 0, Authentic: 0, "Your Style": 0 });
    haptics.medium();

    let isStillLoading = true;
    const toastTimeout = setTimeout(() => {
      if (isStillLoading) {
        toast("Give me a second, this one deserves a thoughtful response.", "info");
      }
    }, 12000);

    try {
      const response = await getQuickAdvice({
        theirMessage: theirMessage.trim() || "Analyze the conversation screenshot",
        yourDraft: yourDraft.trim() || undefined,
        context,
        screenshots: screenshots.length ? screenshots : undefined,
        userStyle: userProfile || undefined,
        userId: authUser?.uid,
      });
      const derivedGhostRisk = Math.max(0, 100 - (response.vibeCheck?.interestLevel ?? 50));

      if (!mountedRef.current) return;
      setResult(response);
      setShowResults(true);
      runWellbeingCheck();
      haptics.success();

      if (authUser?.uid) {
        logSession(authUser.uid, "quick", undefined, derivedGhostRisk);
        void recordActivity(authUser.uid).catch(() => {});
        void createSession(
          authUser.uid,
          {
            request: {
              screenshots,
              theirMessage,
              yourDraft,
              context,
            },
            response,
            vibeCheck: response.vibeCheck,
            suggestions: response.suggestions,
          },
          {
            mode: "quick",
            headline: response.proTip || "Quick analysis",
            ghost_risk: derivedGhostRisk,
            message_count: response.extractedUnrepliedMessages?.length || 1,
          }
        ).catch((sessionErr) => {
          console.error("Failed to save session:", sessionErr);
          // Queue for retry on next load instead of silently losing it
          queuePendingSession(
            authUser.uid,
            {
              request: { screenshots, theirMessage, yourDraft, context },
              response,
              vibeCheck: response.vibeCheck,
              suggestions: response.suggestions,
            },
            {
              mode: "quick",
              headline: response.proTip || "Quick analysis",
              ghost_risk: derivedGhostRisk,
              message_count: response.extractedUnrepliedMessages?.length || 1,
            }
          );
        });
      }

      toast("Analysis complete", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      toast(message, "error");
      haptics.error();
    } finally {
      isStillLoading = false;
      clearTimeout(toastTimeout);
      setIsLoading(false);
    }
  };

  const handleRedo = () => {
    setShowResults(false);
    setResult(null);
    setTheirMessage("");
    setYourDraft("");
    setScreenshots([]);
    setCursor({ Smooth: 0, Bold: 0, Witty: 0, Roast: 0, Authentic: 0, "Your Style": 0 });
    setFeedbackGiven(null);
    haptics.light();
  };

  const handleEdit = () => {
    // Return to the input view with message/draft/context/screenshots preserved
    setShowResults(false);
    setResult(null);
    setFeedbackGiven(null);
    haptics.light();
  };

  const handleShare = async () => {
    if (!result) return;
    const summary = [
      `Vibe: ${result.vibeCheck?.theirEnergy || "neutral"} · Interest ${result.vibeCheck?.interestLevel ?? 50}/100`,
      result.proTip ? `Tip: ${result.proTip}` : "",
      result.recommendedAction ? `Next move: ${result.recommendedAction}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const text = `Rizzbot analysis\n\n${summary}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast("Analysis copied", "success");
      }
    } catch {
      // user cancelled share — no-op
    }
  };

  const actionLabel: Record<string, { label: string; color: string; bg: string }> = {
    SEND: { label: "Send it", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    WAIT: { label: "Wait", color: "#B8860B", bg: "rgba(212,168,83,0.12)" },
    CALL: { label: "Call / voice note", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
    MATCH: { label: "Match their energy", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    PULL_BACK: { label: "Pull back", color: "#B8860B", bg: "rgba(212,168,83,0.12)" },
    ABORT: { label: "Walk away", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
  };

  const situationFade = useScrollFade();
  const toneFade = useScrollFade();
  const personaFade = useScrollFade();
  const screenshotsFade = useScrollFade();

  const handleCopy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast("Could not copy — copy manually?", "error");
      return;
    }
    setCopiedKey(key);
    haptics.success();
    toast("Copied to clipboard", "success");
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleFeedback = (rating: "helpful" | "off") => {
    if (!authUser?.uid || !result || feedbackGiven) return;
    setFeedbackGiven(rating);
    const suggestionType = feedbackTypeMap[activeTone] as any;
    saveFeedback(authUser.uid, {
      source: "quick",
      suggestionType,
      rating,
      context,
      theirEnergy: result.vibeCheck?.theirEnergy,
      recommendedAction: result.recommendedAction,
    });

    if (userId) {
      void submitFeedback({
        user_id: userId,
        source: "quick",
        suggestion_type: suggestionType,
        rating: rating === "helpful" ? 1 : -1,
        metadata: {
          tone: activeTone,
          recommendedAction: result.recommendedAction,
        },
      }).catch((err) => {
        console.error("Failed to submit feedback:", err);
      });
    }

    toast(rating === "helpful" ? "Saved as helpful" : "Got it, we will calibrate", "success");
  };

  const showMessage = result?.extractedTargetMessage || theirMessage || "Conversation screenshot";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative min-h-screen pb-[72px]"
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <GrainOverlay />
      <div className="relative z-10 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 relative">
          <button onClick={() => navigate("/home")} className="cursor-pointer flex items-center justify-center fade-press relative z-10" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4" }}>
            <ChevronLeft size={22} strokeWidth={1.8} color="#1A1208" />
          </button>
          <p className="absolute left-1/2 -translate-x-1/2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 600, color: "#1A1208", paddingBottom: 2 }}>
            Quick Mode
          </p>
          <div className="relative z-10 flex items-center justify-end gap-2" style={{ minWidth: 96 }}>
            {showResults && (
              <>
                <button
                  onClick={handleEdit}
                  className="cursor-pointer flex items-center gap-1"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "rgba(26,18,8,0.55)",
                    background: "none",
                    border: "none",
                  }}
                >
                  <Pencil size={13} strokeWidth={2} />
                  Edit
                </button>
                <button
                  onClick={handleRedo}
                  className="cursor-pointer"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#C8522A",
                    background: "none",
                    border: "none",
                  }}
                >
                  Redo
                </button>
              </>
            )}
          </div>
        </div>

        {!showResults && !isLoading ? (
          <div className="px-5 pb-[140px]">
            <div className="mt-4">
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 700, fontStyle: "italic", color: "#1A1208", lineHeight: 1.2 }}>
                Drop their message.
              </h2>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                void handleUpload(e.target.files);
              }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 w-full flex flex-col items-center justify-center cursor-pointer hover-scale fade-press"
              style={{
                height: 140,
                border: "2px dashed #B8AFA6",
                backgroundColor: "#FDFAF5",
                borderRadius: 20,
                boxShadow: "inset 0 2px 8px rgba(26,18,8,0.03)",
              }}
            >
              <Camera size={26} strokeWidth={1.8} color="#C8522A" />
              <p className="mt-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                {screenshots.length > 0 ? `${screenshots.length} screenshot(s) attached` : "Upload screenshot(s)"}
              </p>
              <p className="mt-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.45)" }}>
                {screenshots.length > 0 ? "Tap to add more" : "1–3 images supported"}
              </p>
            </button>

            {screenshots.length > 0 && (
              <div
                ref={screenshotsFade.ref}
                className="flex gap-3 w-full mt-4 overflow-x-auto pb-4 no-scrollbar"
                style={screenshotsFade.style}
              >
                {screenshots.map((src, i) => (
                  <div key={i} className="relative shrink-0">
                    <img
                      src={src}
                      alt={`Screenshot ${i + 1}`}
                      style={{
                        width: 120,
                        height: 160,
                        borderRadius: 20,
                        objectFit: "cover",
                        border: "1px solid #E8E0D4",
                        boxShadow: "0 4px 12px rgba(26, 18, 8, 0.08)"
                      }}
                    />
                    <button
                      onClick={() => setScreenshots((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute flex items-center justify-center cursor-pointer shadow-lg"
                      style={{
                        top: -10,
                        right: -10,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        backgroundColor: "#C8522A",
                        border: "2px solid #FDFAF5",
                        padding: 0,
                        zIndex: 20
                      }}
                    >
                      <X size={14} strokeWidth={2.5} color="#FFFFFF" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1" style={{ height: 1, backgroundColor: '#E8E0D4' }} />
              <span className="shrink-0 text-center" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: 'rgba(26,18,8,0.55)', textTransform: 'uppercase' }}>
                OR TYPE IT OUT
              </span>
              <div className="flex-1" style={{ height: 1, backgroundColor: '#E8E0D4' }} />
            </div>

            <div className="mt-4 relative">
              <label className="block mb-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase" }}>Context</label>
              <textarea
                value={theirMessage}
                onChange={(e) => {
                  setTheirMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder={screenshots.length > 0 ? "Any backstory? e.g., 'We haven't talked in 2 weeks'" : "Paste their message or add context here..."}
                className="w-full resize-none outline-none overflow-hidden bg-[#FDFAF5] rounded-[14px] border border-[#E8E0D4] p-3 text-[15px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                style={{
                  minHeight: 80,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            <div className="mt-3 relative">
              <label className="block mb-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase" }}>
                Your Potential Reply <span style={{ color: "rgba(26,18,8,0.35)", textTransform: "lowercase", letterSpacing: "normal" }}>(optional)</span>
              </label>
              <textarea
                value={yourDraft}
                onChange={(e) => {
                  setYourDraft(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="What are you thinking of saying?"
                className="w-full resize-none outline-none overflow-hidden bg-[#FDFAF5] rounded-[14px] border border-[#E8E0D4] p-3 text-[15px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                style={{
                  minHeight: 80,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            <div className="mt-4">
              <label className="block mb-2 flex items-center gap-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase" }}>
                <Tag size={14} color="#C8522A" />
                Situation
              </label>
              <div
                ref={situationFade.ref}
                className="flex gap-2 w-full overflow-x-auto pb-2 no-scrollbar"
                style={situationFade.style}
              >
                {contextOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setContext(opt.value);
                      haptics.light();
                    }}
                    className="cursor-pointer transition-colors"
                    style={{
                      height: 44,
                      borderRadius: 12,
                      padding: "0 14px",
                      backgroundColor: context === opt.value ? "#1A1208" : "transparent",
                      color: context === opt.value ? "#FFFFFF" : "rgba(26, 18, 8, 0.55)",
                      border: context === opt.value ? "1px solid #1A1208" : "1px solid #E8E0D4",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fixed bottom-20 left-0 right-0 px-5 z-30 pointer-events-none">
              <div className="max-w-[430px] mx-auto pointer-events-auto">
                <button
                  onClick={() => void handleAnalyze()}
                  disabled={!theirMessage.trim() && screenshots.length === 0}
                  className="w-full transition-colors fade-press"
                  style={{
                    height: 52,
                    borderRadius: 100,
                    backgroundColor: (!theirMessage.trim() && screenshots.length === 0) ? "#E8E0D4" : "#C8522A",
                    color: (!theirMessage.trim() && screenshots.length === 0) ? "rgba(26,18,8,0.35)" : "#FFFFFF",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    fontWeight: 600,
                    border: "none",
                    cursor: (!theirMessage.trim() && screenshots.length === 0) ? "not-allowed" : "pointer",
                    boxShadow: (!theirMessage.trim() && screenshots.length === 0) ? "none" : "0 4px 16px rgba(200, 82, 42, 0.3)",
                    opacity: 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  Analyze →
                </button>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="px-5 mt-6">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.45)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Reading the room...
            </p>
            <div style={{ backgroundColor: "#FDFAF5", borderRadius: 24, padding: 20, marginTop: 16 }}>
              <Skeleton className="h-3 w-28 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div style={{ backgroundColor: "#FDFAF5", borderRadius: 24, padding: 20, marginTop: 12 }}>
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-1.5 w-full mb-4" />
              <Skeleton className="h-1.5 w-full mb-4" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          </div>
        ) : (
          <div className="px-5 pb-8">
            <div
              className="mt-4 overflow-hidden"
              style={{ backgroundColor: "#FDFAF5", borderRadius: 20, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)" }}
            >
              <div className="flex">
                <div style={{ width: 3, backgroundColor: "#C8522A", borderRadius: "3px 0 0 3px", flexShrink: 0 }} />
                <div className="p-4 flex-1">
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase" }}>
                    {result?.extractedUnrepliedMessages?.length ? "Messages to reply to" : "Their message"}
                  </p>
                  {result?.extractedUnrepliedMessages?.length ? (
                    <div className="mt-2 space-y-2">
                      {result.extractedUnrepliedMessages.map((msg: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <CornerDownRight size={14} strokeWidth={2} color="#C8522A" style={{ marginTop: 4, flexShrink: 0 }} />
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", lineHeight: 1.5 }}>
                            "{msg}"
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", lineHeight: 1.5 }}>
                      {showMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {result?.conversationContext && (
              <div className="mt-3 px-4 py-3" style={{ backgroundColor: "#FDFAF5", borderRadius: 16 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontStyle: "italic", color: "rgba(26,18,8,0.55)", lineHeight: 1.5 }}>
                  {result.conversationContext}
                </p>
              </div>
            )}

            {result?.detectedMeta && (result.detectedMeta.platform || result.detectedMeta.deliveryStatus || result.detectedMeta.timestamp || result.detectedMeta.isMessageRequest || (result.detectedMeta.reactions?.length ?? 0) > 0 || result.detectedMeta.groupName) && (
              <div className="mt-3 px-4 py-3" style={{ backgroundColor: "#FDFAF5", borderRadius: 16 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase", marginBottom: 8 }}>
                  Detected
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.detectedMeta.platform && result.detectedMeta.platform !== "unknown" && (
                    <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5E8E0", color: "#C8522A", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      {result.detectedMeta.platform}
                    </span>
                  )}
                  {result.detectedMeta.deliveryStatus && result.detectedMeta.deliveryStatus !== "unknown" && (
                    <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      {result.detectedMeta.deliveryStatus === "read" ? "✓✓ read" : result.detectedMeta.deliveryStatus}
                    </span>
                  )}
                  {result.detectedMeta.timestamp && (
                    <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      {result.detectedMeta.timestamp}
                    </span>
                  )}
                  {result.detectedMeta.groupName && (
                    <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      {result.detectedMeta.groupName}
                    </span>
                  )}
                  {result.detectedMeta.isMessageRequest === true && (
                    <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "rgba(200,82,42,0.1)", color: "#C8522A", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      message request
                    </span>
                  )}
                  {Array.isArray(result.detectedMeta.reactions) && result.detectedMeta.reactions.length > 0 && (
                    <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                      {result.detectedMeta.reactions.join(" ")}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div
              className="mt-4"
              style={{ backgroundColor: "#FDFAF5", borderRadius: 20, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 16 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>Vibe Check</p>
                <button
                  onClick={() => void handleShare()}
                  className="cursor-pointer flex items-center gap-1.5"
                  style={{ border: "none", background: "none", color: "rgba(26,18,8,0.4)" }}
                  title="Share analysis"
                >
                  <Share2 size={16} strokeWidth={1.8} />
                </button>
              </div>
              <div className="mb-3" style={{ height: 1, backgroundColor: "#E8E0D4" }} />

              {[
                {
                  label: "Energy",
                  value: result?.vibeCheck?.theirEnergy || "neutral",
                  level: result?.vibeCheck?.theirEnergy === "hot" ? 1.0 :
                    result?.vibeCheck?.theirEnergy === "warm" ? 0.8 :
                      result?.vibeCheck?.theirEnergy === "cold" ? 0.2 : 0.5,
                  color: "#C8522A"
                },
                {
                  label: "Interest",
                  value: `${result?.vibeCheck?.interestLevel ?? 50}/100`,
                  level: Math.max(0.05, (result?.vibeCheck?.interestLevel ?? 50) / 100),
                  color: "#C8522A",
                },
                { label: "Ghost Risk", value: `${riskLabel} (${ghostRisk}%)`, level: Math.max(0.05, ghostRisk / 100), color: riskColor },
                ...(typeof result?.interestSignal === "number"
                  ? [{
                      label: "Interest to show",
                      value: `${result.interestSignal}/100`,
                      level: Math.max(0.05, result.interestSignal / 100),
                      color: "#D4A853",
                    }]
                  : []),
              ].map((metric) => (
                <div key={metric.label} className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26, 18, 8, 0.55)" }}>{metric.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: metric.color }}>{metric.value}</span>
                  </div>
                  <div className="w-full overflow-hidden" style={{ height: 6, borderRadius: 100, backgroundColor: "#E8E0D4" }}>
                    <div style={{ width: `${metric.level * 100}%`, height: "100%", borderRadius: 100, backgroundColor: metric.color, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}

              {Array.isArray(result?.vibeCheck?.greenFlags) && result.vibeCheck.greenFlags.length > 0 && (
                <div className="mb-2">
                  <p style={{ fontSize: 11, color: "#7A9E7E", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Green flags</p>
                  <div className="flex flex-wrap gap-2">
                    {result.vibeCheck.greenFlags.map((flag: string, i: number) => (
                      <span key={i} style={{ borderRadius: 999, padding: "3px 9px", backgroundColor: "rgba(122,158,126,0.12)", color: "#58745A", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(result?.vibeCheck?.redFlags) && result.vibeCheck.redFlags.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: "#C8522A", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Red flags</p>
                  <div className="flex flex-wrap gap-2">
                    {result.vibeCheck.redFlags.map((flag: string, i: number) => (
                      <span key={i} style={{ borderRadius: 999, padding: "3px 9px", backgroundColor: "rgba(200,82,42,0.12)", color: "#C8522A", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result?.proTip && (
                <div className="mt-3" style={{ backgroundColor: "#F5E8E0", borderRadius: 12, padding: "12px 14px" }}>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontStyle: "italic", color: "#1A1208", lineHeight: 1.4 }}>
                    "{result.proTip}"
                  </p>
                </div>
              )}
            </div>

            {result?.recommendedAction && (
              <div className="mt-3 px-4 py-3" style={{ backgroundColor: "#FDFAF5", borderRadius: 16 }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} color="#C8522A" />
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase" }}>
                    Next move
                  </p>
                </div>
                {(() => {
                  const a = actionLabel[result.recommendedAction] || { label: result.recommendedAction, color: "#1A1208", bg: "rgba(26,18,8,0.06)" };
                  return (
                    <span style={{ borderRadius: 999, padding: "5px 12px", backgroundColor: a.bg, color: a.color, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>
                      {a.label}
                    </span>
                  );
                })()}
                {result?.timingRecommendation && (
                  <div className="mt-3 flex items-start gap-2">
                    <Timer size={14} strokeWidth={1.8} color="rgba(26,18,8,0.4)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.65)", lineHeight: 1.5 }}>
                      {result.timingRecommendation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {result?.suggestions?.wait && (
              <div className="mt-3 px-4 py-3" style={{ backgroundColor: "#FEF3E2", borderRadius: 16, border: "1px solid rgba(212,168,83,0.25)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock size={15} color="#B8860B" />
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#B8860B", textTransform: "uppercase" }}>
                    Don't reply yet
                  </p>
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.7)", lineHeight: 1.5 }}>
                  {result.suggestions.wait}
                </p>
              </div>
            )}

            {result?.draftAnalysis && (
              <div className="mt-3 px-4 py-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 16 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase", marginBottom: 8 }}>
                  Draft analysis
                </p>
                {result.draftAnalysis.verdict && (
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontStyle: "italic", color: "#1A1208", lineHeight: 1.45, marginBottom: 10 }}>
                    "{result.draftAnalysis.verdict}"
                  </p>
                )}
                {typeof result.draftAnalysis.confidenceScore === "number" && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)" }}>Confidence</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#1A1208" }}>{result.draftAnalysis.confidenceScore}/100</span>
                    </div>
                    <div className="w-full overflow-hidden" style={{ height: 6, borderRadius: 100, backgroundColor: "#E8E0D4" }}>
                      <div style={{ width: `${result.draftAnalysis.confidenceScore}%`, height: "100%", borderRadius: 100, backgroundColor: "#7A9E7E" }} />
                    </div>
                  </div>
                )}
                {Array.isArray(result.draftAnalysis.strengths) && result.draftAnalysis.strengths.length > 0 && (
                  <div className="mb-2">
                    <p style={{ fontSize: 11, color: "#7A9E7E", marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>Strengths</p>
                    <div className="flex flex-wrap gap-2">
                      {result.draftAnalysis.strengths.map((s: string, i: number) => (
                        <span key={i} style={{ borderRadius: 999, padding: "3px 9px", backgroundColor: "rgba(122,158,126,0.12)", color: "#58745A", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(result.draftAnalysis.issues) && result.draftAnalysis.issues.length > 0 && (
                  <div>
                    <p style={{ fontSize: 11, color: "#C8522A", marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>Could improve</p>
                    <div className="flex flex-wrap gap-2">
                      {result.draftAnalysis.issues.map((s: string, i: number) => (
                        <span key={i} style={{ borderRadius: 999, padding: "3px 9px", backgroundColor: "rgba(200,82,42,0.12)", color: "#C8522A", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase" }}>
                Suggested replies
              </p>
              <div
                ref={toneFade.ref}
                className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar"
                style={toneFade.style}
              >
                {toneOptions.map(({ key, help }) => (
                  <div key={key} className="relative shrink-0">
                    <button
                      onClick={() => {
                        setActiveTone(key);
                        haptics.light();
                      }}
                      className="flex items-center gap-1.5 cursor-pointer transition-colors"
                      style={{
                        borderRadius: 100,
                        padding: "8px 16px",
                        backgroundColor: activeTone === key ? "#C8522A" : "transparent",
                        color: activeTone === key ? "#FFFFFF" : "rgba(26, 18, 8, 0.55)",
                        border: activeTone === key ? "1px solid #C8522A" : "1px solid #E8E0D4",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {key}
                      {help && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStyleTooltip((prev) => !prev);
                          }}
                          className="cursor-pointer"
                        >
                          <Info size={12} strokeWidth={2} color={activeTone === key ? "rgba(255,255,255,0.6)" : "rgba(26,18,8,0.35)"} />
                        </button>
                      )}
                    </button>
                    {help && showStyleTooltip && activeTone === key && (
                      <div
                        className="absolute bottom-full mb-2 left-0 z-50"
                        style={{ backgroundColor: "#1A1208", borderRadius: 10, padding: "8px 12px", width: 210 }}
                      >
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#FDFAF5", lineHeight: 1.4 }}>{help}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div
                className="mt-3 overflow-hidden"
                style={{ backgroundColor: "#FDFAF5", borderRadius: 20, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 16 }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeTone}-${cursor[activeTone]}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-3"
                  >
                    {selectedOption?.replies?.length ? selectedOption.replies.map((replyItem, idx) => {
                      const replyKey = `reply-${activeTone}-${cursor[activeTone]}-${idx}`;
                      const isCopied = copiedKey === replyKey;
                      return (
                        <div key={idx} className="relative group">
                          <button
                            onClick={() => handleCopy(replyItem.reply, replyKey)}
                            className="w-full text-left cursor-pointer transition-all"
                            style={{
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E8E0D4",
                              borderRadius: 14,
                              padding: "12px 14px",
                            }}
                          >
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26, 18, 8, 0.6)", display: "flex", alignItems: "center", gap: 6 }}>
                                <CornerDownRight size={14} />
                                <span className="italic">"{replyItem.originalMessage}"</span>
                              </span>
                              <div className="flex items-center gap-1.5" style={{ color: isCopied ? "#7A9E7E" : "rgba(26, 18, 8, 0.4)", fontFamily: "'DM Sans', sans-serif", fontSize: 10, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                <span>{isCopied ? "Copied" : "Copy"}</span>
                              </div>
                            </div>
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", lineHeight: 1.5, paddingLeft: 12, borderLeft: "2px solid #C8522A" }}>
                              {replyItem.reply}
                            </p>
                          </button>
                        </div>
                      );
                    }) : null}

                    {!selectedOption && (
                      <div
                        className="py-8 flex flex-col items-center justify-center text-center"
                        style={{ backgroundColor: "#F9F7F4", borderRadius: 16 }}
                      >
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)" }}>
                          No {activeTone} replies for this one — try another style.
                        </p>
                      </div>
                    )}

                    {selectedOption?.conversationHook && (
                      <div className="relative mt-1">
                        <button
                          onClick={() => handleCopy(selectedOption.conversationHook!, `hook-${activeTone}-${cursor[activeTone]}`)}
                          className="w-full text-left cursor-pointer transition-all"
                          style={{
                            backgroundColor: "#F5E8E0",
                            border: "1px solid #E8E0D4",
                            borderRadius: 14,
                            padding: "12px 14px",
                          }}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#C8522A", display: "flex", alignItems: "center", gap: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                              <Link2 size={14} />
                              Conversation Hook
                            </span>
                            <div className="flex items-center gap-1.5" style={{ color: copiedKey === `hook-${activeTone}-${cursor[activeTone]}` ? "#C8522A" : "rgba(200, 82, 42, 0.5)", fontFamily: "'DM Sans', sans-serif", fontSize: 10, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                              {copiedKey === `hook-${activeTone}-${cursor[activeTone]}` ? <Check size={14} /> : <Copy size={14} />}
                              <span>{copiedKey === `hook-${activeTone}-${cursor[activeTone]}` ? "Copied" : "Copy"}</span>
                            </div>
                          </div>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", lineHeight: 1.5 }}>
                            {selectedOption.conversationHook}
                          </p>
                        </button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-end mt-3 pt-3" style={{ borderTop: "1px solid #E8E0D4" }}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleFeedback("helpful")}
                      style={{ border: "none", background: "none", color: "#7A9E7E", cursor: "pointer" }}
                    >
                      <ThumbsUp size={15} fill={feedbackGiven === "helpful" ? "#7A9E7E" : "none"} />
                    </button>
                    <button
                      onClick={() => handleFeedback("off")}
                      style={{ border: "none", background: "none", color: "#C8522A", cursor: "pointer" }}
                    >
                      <ThumbsDown size={15} fill={feedbackGiven === "off" ? "#C8522A" : "none"} />
                    </button>
                  </div>
                </div>
              </div>

              {selectedOptions.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid #E8E0D4" }}>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(26,18,8,0.55)" }}>
                    Variation {(cursor[activeTone] % selectedOptions.length) + 1} of {selectedOptions.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        haptics.light();
                        setCursor(prev => ({
                          ...prev,
                          [activeTone]: prev[activeTone] > 0 ? prev[activeTone] - 1 : selectedOptions.length - 1
                        }));
                      }}
                      className="flex items-center justify-center cursor-pointer transition-colors"
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4", color: "#C8522A"
                      }}
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => {
                        haptics.light();
                        setCursor(prev => ({
                          ...prev,
                          [activeTone]: prev[activeTone] + 1
                        }));
                      }}
                      className="flex items-center justify-center cursor-pointer transition-colors"
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4", color: "#C8522A"
                      }}
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
