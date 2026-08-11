import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionState } from "../utils/useSessionState";
import { useNavigate } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  Clock,
  Pencil,
  RotateCcw,
  Share2,
  Tag,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { Skeleton } from "./ui/Skeleton";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import { getQuickAdvice, streamQuickAdvice } from "../../services/geminiService";
import { createSession, flushPendingSessions, queuePendingSession, recordActivity, submitFeedback } from "../../services/dbService";
import { logSession, saveFeedback } from "../../services/feedbackService";
import { QuickAdviceRequest, QuickAdviceResponse } from "../../types";
import { isQuickAdviceDegraded, buildCopyPayload } from "../../services/quickAdvice";
import { useScrollFade } from "../utils/useScrollFade";
import { DisclosureCard } from "./quick/DisclosureCard";
import { ReplyHeroCard } from "./quick/ReplyHeroCard";
import { ReadStrip } from "./quick/ReadStrip";
import { ToneRail } from "./quick/ToneRail";

// SPIKE (plan 009): streamed quick replies. Hardcoded OFF — the production
// path is unchanged. Flip to true to exercise the prototype.
const QUICK_STREAM_ENABLED = false;

const toneOptions = [
  { key: "Smooth", help: null },
  { key: "Bold", help: null },
  { key: "Witty", help: null },
  { key: "Authentic", help: null },
  { key: "Your Style", help: "Uses your saved voice profile when available." },
] as const;

type Tone = (typeof toneOptions)[number]["key"];

const toneMap: Record<Tone, keyof QuickAdviceResponse["suggestions"]> = {
  Smooth: "smooth",
  Bold: "bold",
  Witty: "witty",
  Authentic: "authentic",
  "Your Style": "yourStyle",
};

const feedbackTypeMap: Record<Tone, string> = {
  Smooth: "smooth",
  Bold: "bold",
  Witty: "witty",
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
  const [showStyleTooltip, setShowStyleTooltip] = useState<string | null>(null);
  const [waitDismissed, setWaitDismissed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const [screenshots, setScreenshots] = useSessionState<string[]>("quick_screenshots", [], authUser?.uid);
  const [result, setResult] = useState<QuickAdviceResponse | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "off" | null>(null);
  const [cursor, setCursor] = useState<Record<Tone, number>>({
    Smooth: 0,
    Bold: 0,
    Witty: 0,
    Authentic: 0,
    "Your Style": 0,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);

  // Scroll to the top of results when a new analysis lands
  useEffect(() => {
    if (showResults) {
      window.scrollTo({ top: 0, behavior: "auto" });
      resultsTopRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [showResults, result]);

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

  const isDegraded = useMemo(() => (result ? isQuickAdviceDegraded(result) : false), [result]);

  const [openSection, setOpenSection] = useState<string | null>(null);

  const unrepliedCount = result?.extractedUnrepliedMessages?.length ?? 0;

  const toneHasOptions = (key: Tone) => (result?.suggestions[toneMap[key]]?.length ?? 0) > 0;

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
    setWaitDismissed(false);
    setCursor({ Smooth: 0, Bold: 0, Witty: 0, Authentic: 0, "Your Style": 0 });
    setStreamedText("");
    haptics.medium();

    let isStillLoading = true;
    const toastTimeout = setTimeout(() => {
      if (isStillLoading) {
        toast("Give me a second, this one deserves a thoughtful response.", "info");
      }
    }, 12000);

    try {
      const quickRequest: QuickAdviceRequest = {
        theirMessage: theirMessage.trim() || "Analyze the conversation screenshot",
        yourDraft: yourDraft.trim() || undefined,
        context,
        screenshots: screenshots.length ? screenshots : undefined,
        userStyle: userProfile || undefined,
        userId: authUser?.uid,
      };
      const response = QUICK_STREAM_ENABLED
        ? await streamQuickAdvice(quickRequest, (text) => {
            if (mountedRef.current) setStreamedText((prev) => prev + text);
          })
        : await getQuickAdvice(quickRequest);
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
    setCursor({ Smooth: 0, Bold: 0, Witty: 0, Authentic: 0, "Your Style": 0 });
    setFeedbackGiven(null);
    setStreamedText("");
    haptics.light();
  };

  const handleEdit = () => {
    // Return to the input view with message/draft/context/screenshots preserved
    setShowResults(false);
    setResult(null);
    setFeedbackGiven(null);
    setStreamedText("");
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

  const situationFade = useScrollFade();
  const toneFade = useScrollFade();
  const stripFade = useScrollFade();
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

  const handleCopyAll = async () => {
    if (!selectedOption) return;
    await handleCopy(buildCopyPayload(selectedOption), `copyall-${activeTone}-${cursor[activeTone]}`);
  };

  const showMessage = result?.extractedTargetMessage || theirMessage || "Conversation screenshot";

  // Auto-resize restored textareas so sessionStorage-restored drafts aren't clipped
  const theirMessageRef = useRef<HTMLTextAreaElement | null>(null);
  const yourDraftRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = theirMessageRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
    }
    const el2 = yourDraftRef.current;
    if (el2) {
      el2.style.height = "auto";
      el2.style.height = `${Math.min(el2.scrollHeight, 300)}px`;
    }
  }, [showResults, screenshots.length]);

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
                ref={theirMessageRef}
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
                ref={yourDraftRef}
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
          <div className="px-5 mt-6 pb-[160px]">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.45)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Reading the room...
            </p>
            <div className="flex gap-2 mt-4 overflow-hidden">
              <Skeleton className="h-10 w-24" style={{ borderRadius: 100 }} />
              <Skeleton className="h-10 w-16" style={{ borderRadius: 100 }} />
              <Skeleton className="h-10 w-20" style={{ borderRadius: 100 }} />
            </div>
            <div className="mt-4">
              <Skeleton className="h-2.5 w-40 mb-3" />
              <div className="flex justify-end">
                <Skeleton className="h-9 w-3/4 mb-2" style={{ borderRadius: 12 }} />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-9 w-2/3" style={{ borderRadius: 12 }} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 overflow-hidden">
              <Skeleton className="h-8 w-24" style={{ borderRadius: 8 }} />
              <Skeleton className="h-8 w-20" style={{ borderRadius: 8 }} />
              <Skeleton className="h-8 w-32" style={{ borderRadius: 8 }} />
            </div>
          </div>
        ) : (
          <div className="px-5 pb-[150px]" ref={resultsTopRef}>
            {result?.suggestions?.wait && !waitDismissed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mt-4 relative flex items-start gap-3 px-4 py-3"
                style={{ backgroundColor: "#FEF3E2", borderRadius: 16, border: "1px solid rgba(212,168,83,0.25)" }}
              >
                <Clock size={18} strokeWidth={1.8} color="#B8860B" style={{ marginTop: 2, flexShrink: 0 }} />
                <div className="flex-1 pr-6">
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", color: "#7A5400", textTransform: "uppercase" }}>
                    Don't reply yet
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.7)", lineHeight: 1.5, marginTop: 3 }}>
                    {result.suggestions.wait}
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontStyle: "italic", color: "rgba(26,18,8,0.5)", lineHeight: 1.4, marginTop: 3 }}>
                    Your replies are ready below — give it a beat, then send.
                  </p>
                </div>
                <button
                  onClick={() => setWaitDismissed(true)}
                  aria-label="Dismiss this reminder"
                  className="cursor-pointer absolute top-1 right-1"
                  style={{ width: 44, height: 44, borderRadius: 22, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(122,90,8,0.8)" }}
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </motion.div>
            )}

            {isDegraded && (
              <div className="mt-3 px-4 py-3" style={{ backgroundColor: "#F5E8E0", borderRadius: 16 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", lineHeight: 1.5 }}>
                  The read came back thin — take these with salt, or try again.
                </p>
              </div>
            )}

            <ToneRail
              toneOptions={toneOptions}
              toneHasOptions={toneHasOptions}
              activeTone={activeTone}
              onSelectTone={(key) => {
                setActiveTone(key);
                haptics.light();
              }}
              showStyleTooltip={showStyleTooltip}
              onToggleStyleTooltip={(key) => setShowStyleTooltip((prev) => (prev ? null : key))}
              scrollFade={toneFade}
            />

            <ReplyHeroCard
              selectedOption={selectedOption}
              optionCount={selectedOptions.length}
              activeTone={activeTone}
              cursor={cursor[activeTone]}
              copiedKey={copiedKey}
              prefersReducedMotion={prefersReducedMotion}
              streamedText={streamedText}
              onCopy={(text, key) => void handleCopy(text, key)}
              onSelectVariation={(i) => { haptics.light(); setCursor((prev) => ({ ...prev, [activeTone]: i })); }}
              onDragEnd={({ offset, velocity }) => {
                if (selectedOptions.length <= 1) return;
                const flick = Math.abs(offset.x) > 56 || (Math.abs(offset.x) > 24 && Math.abs(velocity.x) > 500);
                if (!flick) return;
                const dir = offset.x < 0 ? 1 : -1;
                haptics.light();
                setCursor((prev) => ({ ...prev, [activeTone]: (prev[activeTone] + dir + selectedOptions.length) % selectedOptions.length }));
              }}
            />

            <ReadStrip ghostRisk={ghostRisk} riskColor={riskColor} result={result} scrollFade={stripFade} />

            <DisclosureCard
              title={`Their message${unrepliedCount > 1 ? ` (${unrepliedCount})` : ""}`}
              open={openSection === "context"}
              onToggle={() => setOpenSection(openSection === "context" ? null : "context")}
            >
              {result?.conversationContext && (
                <p className="mb-3" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontStyle: "italic", color: "rgba(26,18,8,0.55)", lineHeight: 1.5 }}>
                  {result.conversationContext}
                </p>
              )}
              <div className="space-y-2">
                {(result?.extractedUnrepliedMessages?.length ? result.extractedUnrepliedMessages : [showMessage]).map((msg: string, i: number) => (
                  <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#1A1208", lineHeight: 1.5 }}>
                    "{msg}"
                  </p>
                ))}
              </div>
              {result?.detectedMeta && (result.detectedMeta.platform || result.detectedMeta.deliveryStatus || result.detectedMeta.timestamp || result.detectedMeta.isMessageRequest || (result.detectedMeta.reactions?.length ?? 0) > 0 || result.detectedMeta.groupName) && (
                <div className="flex flex-wrap gap-2 mt-3">
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
              )}
            </DisclosureCard>

            {result?.draftAnalysis?.verdict && (
              <DisclosureCard
                title="Your draft"
                open={openSection === "draft"}
                onToggle={() => setOpenSection(openSection === "draft" ? null : "draft")}
              >
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontStyle: "italic", color: "#1A1208", lineHeight: 1.45 }}>
                  "{result.draftAnalysis.verdict}"
                </p>
              </DisclosureCard>
            )}

            <div className="fixed bottom-20 left-0 right-0 z-30" style={{ backgroundColor: "rgba(245,239,230,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid #E8E0D4" }}>
              <div className="max-w-[430px] mx-auto flex items-center gap-2 px-5 py-2.5">
                <button
                  onClick={() => handleFeedback("helpful")}
                  aria-label="Helpful reply"
                  className="cursor-pointer"
                  style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: feedbackGiven === "helpful" ? "#7A9E7E" : "rgba(26,18,8,0.45)" }}
                >
                  <ThumbsUp size={19} strokeWidth={2} fill={feedbackGiven === "helpful" ? "#7A9E7E" : "none"} />
                </button>
                <button
                  onClick={() => void handleCopyAll()}
                  disabled={!selectedOption}
                  className="flex-1 cursor-pointer transition-all active:scale-[0.98]"
                  style={{
                    height: 52,
                    borderRadius: 999,
                    backgroundColor: !selectedOption ? "#E8E0D4" : copiedKey === `copyall-${activeTone}-${cursor[activeTone]}` ? "#7A9E7E" : "#C8522A",
                    color: !selectedOption ? "rgba(26,18,8,0.35)" : "#FFFFFF",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    fontWeight: 600,
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s ease",
                  }}
                >
                  {copiedKey === `copyall-${activeTone}-${cursor[activeTone]}` ? (
                    <>
                      <Check size={18} strokeWidth={2.5} /> Copied
                    </>
                  ) : !selectedOption ? (
                    "Nothing to copy"
                  ) : selectedOption.replies.length + (selectedOption.conversationHook ? 1 : 0) > 1 ? (
                    "Copy all"
                  ) : (
                    "Copy reply"
                  )}
                </button>
                <button
                  onClick={() => void handleShare()}
                  aria-label="Share analysis"
                  className="cursor-pointer"
                  style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "rgba(26,18,8,0.45)" }}
                >
                  <Share2 size={18} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
