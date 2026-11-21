import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionState } from "../utils/useSessionState";
import { useNavigate } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  Camera,
  ChevronLeft,
  Clock,
  Pencil,
  Tag,
  X,
} from "lucide-react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { Skeleton } from "./ui/Skeleton";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import { getQuickAdvice } from "../../services/quickAdviceService";
import { streamQuickAdvice } from "../../services/aiService";
import { createSession, flushPendingSessions, queuePendingSession, recordActivity, submitFeedback } from "../../services/dbService";
import { logSession, saveFeedback } from "../../services/feedbackService";
import { QuickAdviceRequest, QuickAdviceResponse } from "../../types";
import { isQuickAdviceDegraded } from "../../services/quickAdvice";
import { useScrollFade } from "../utils/useScrollFade";
import { shuffledLoadingLines, loadingLineForElapsed } from "../utils/loadingLines";
import { MAX_QUICK_SCREENSHOTS, optimizeImageFile, clampScreenshotList } from "../utils/imageOptimize";
import { uploadQuickImagesToR2 } from "../../services/mediaService";
import { triggerPassiveVoiceLearning } from "../../services/voiceLearningService";
import { ReplyHeroCard } from "./quick/ReplyHeroCard";
import { FriendSummaryCard } from "./quick/FriendSummaryCard";
import { ToneRail } from "./quick/ToneRail";

// SPIKE (plan 009): streamed quick replies. Hardcoded OFF — the production
// path is unchanged. Flip to true to exercise the prototype.
const QUICK_STREAM_ENABLED = false;

const toneOptions = [
  { key: "Real", help: null },
  { key: "Smooth", help: null },
  { key: "Playful", help: null },
  { key: "Bold", help: null },
  { key: "Your Style", help: "Uses your saved voice profile when available." },
] as const;

type Tone = (typeof toneOptions)[number]["key"];

const toneMap: Record<Tone, keyof QuickAdviceResponse["suggestions"]> = {
  Real: "real",
  Smooth: "smooth",
  Playful: "playful",
  Bold: "bold",
  "Your Style": "yourStyle",
};

const feedbackTypeMap: Record<Tone, string> = {
  Real: "real",
  Smooth: "smooth",
  Playful: "playful",
  Bold: "bold",
  "Your Style": "yourStyle",
};

// Rotating loading lines live in app/utils/loadingLines.ts (organic wingman
// voice, no fake precision). Shuffled per run so repeats never read the same.

function shuffledLines(): string[] {
  return shuffledLoadingLines();
}

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

const toOptimizedPreview = async (file: File): Promise<string> => {
  const optimized = await optimizeImageFile(file);
  return optimized.preview;
};

export function QuickModeScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser, userProfile, userId, applyLearnedProfile, runWellbeingCheck } = useAppContext();

  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [theirMessage, setTheirMessage] = useSessionState("quick_theirMessage", "", authUser?.uid);
  const [yourDraft, setYourDraft] = useSessionState("quick_yourDraft", "", authUser?.uid);
  const [context, setContext] = useSessionState<ContextOption>("quick_context", "new", authUser?.uid);
  const [activeTone, setActiveTone] = useSessionState<Tone>("quick_tone", "Real", authUser?.uid);
  const [showStyleTooltip, setShowStyleTooltip] = useState<string | null>(null);
  const [waitDismissed, setWaitDismissed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [result, setResult] = useState<QuickAdviceResponse | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const [feedbackVotes, setFeedbackVotes] = useState<Record<string, "helpful" | "off">>({});
  const [cursor, setCursor] = useState<Record<Tone, number>>({
    Real: 0,
    Smooth: 0,
    Playful: 0,
    Bold: 0,
    "Your Style": 0,
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [showDraftInput, setShowDraftInput] = useState(false);
  const [loadingLines, setLoadingLines] = useState<string[]>(() => shuffledLoadingLines());
  const [modelStatus, setModelStatus] = useState<{ model: string; effort: string; attempt: number } | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | "edit" | "redo">(null);

  // Restore the last analysis after a refresh so results aren't lost.
  // Screenshots themselves aren't restored (too big for sessionStorage) —
  // input text/stage/tone already persist via useSessionState.
  useEffect(() => {
    const uid = authUser?.uid;
    if (!uid || result || isLoading || showResults) return;
    try {
      const raw = sessionStorage.getItem(`quick_last_result_${uid}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { v?: number; savedAt?: number; result?: QuickAdviceResponse };
      if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > 48 * 3600 * 1000) {
        sessionStorage.removeItem(`quick_last_result_${uid}`);
        return;
      }
      const saved = parsed?.result;
      if (saved && typeof saved === "object" && (saved as any).suggestions && typeof (saved as any).suggestions === "object") {
        setResult(saved as QuickAdviceResponse);
        setShowResults(true);
      }
    } catch {
      // Corrupt cache — start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.uid]);

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
    runWellbeingCheck(); if (!(activeTone in toneMap)) setActiveTone("Real"); try { sessionStorage.removeItem("quick_screenshots"); if (authUser?.uid) sessionStorage.removeItem(`quick_screenshots_${authUser.uid}`); } catch {}
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

  const isDegraded = useMemo(() => (result ? isQuickAdviceDegraded(result) : false), [result]);

  const toneHasOptions = (key: Tone) => (result?.suggestions[toneMap[key]]?.length ?? 0) > 0;

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_QUICK_SCREENSHOTS - screenshots.length;
    if (remainingSlots <= 0) {
      toast("Maximum 10 screenshots allowed", "error");
      return;
    }

    const picked = Array.from(files).slice(0, remainingSlots);
    try {
      const encoded = await Promise.all(picked.map((f) => toOptimizedPreview(f)));
      setScreenshots((prev) => clampScreenshotList(prev, encoded, MAX_QUICK_SCREENSHOTS));
      toast(`${encoded.length} screenshot(s) attached`, "success");
    } catch {
      toast("Could not read one or more screenshots", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const remainingSlots = MAX_QUICK_SCREENSHOTS - screenshots.length;
    if (remainingSlots <= 0) {
      toast("Maximum 10 screenshots allowed", "error");
      return;
    }
    try {
      const encoded = await Promise.all(
        imageFiles.slice(0, remainingSlots).map((f) => toOptimizedPreview(f))
      );
      setScreenshots((prev) => clampScreenshotList(prev, encoded, MAX_QUICK_SCREENSHOTS));
      toast(`${encoded.length} screenshot(s) pasted`, "success");
    } catch {
      toast("Could not read pasted image", "error");
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
    setFeedbackVotes({});
    setWaitDismissed(false);
    setCursor({ Real: 0, Smooth: 0, Playful: 0, Bold: 0, "Your Style": 0 });
    setStreamedText("");
    setLoadingElapsed(0);
    setLoadingLines(shuffledLines());
    setModelStatus(null);
    haptics.medium();

    const loadingTimer = setInterval(() => {
      if (mountedRef.current) setLoadingElapsed((prev) => prev + 1);
    }, 1000);

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
        : await getQuickAdvice(quickRequest, (s) => {
            if (mountedRef.current) setModelStatus(s);
          });
      const isV2 = Boolean(response.summary);
      const derivedGhostRisk = isV2
        ? undefined
        : Math.max(0, 100 - (response.vibeCheck?.interestLevel ?? 50));

      if (!mountedRef.current) return;
      setResult(response);
      setShowResults(true);
      // Persist the analysis so a refresh lands back on results, not a blank form.
      try {
        if (authUser?.uid) {
          sessionStorage.setItem(
            `quick_last_result_${authUser.uid}`,
            JSON.stringify({ v: 2, savedAt: Date.now(), result: response })
          );
        }
      } catch {
        // Quota exceeded — results still work in memory for this visit
      }
      runWellbeingCheck(); if (!(activeTone in toneMap)) setActiveTone("Real"); try { sessionStorage.removeItem("quick_screenshots"); if (authUser?.uid) sessionStorage.removeItem(`quick_screenshots_${authUser.uid}`); } catch {}
      haptics.success();

      if (screenshots.length > 0) {
        const learnImages = screenshots.slice(0, 10).map((src) => {
          const m = src.match(/^data:([^;]+);base64,/);
          return {
            mimeType: m ? m[1] : "image/webp" as string,
            data: src.includes(",") ? src.split(",")[1] : src,
          };
        });
        void triggerPassiveVoiceLearning(learnImages, (updatedProfile, newCount) => {
          if (!mountedRef.current) return;
          applyLearnedProfile(updatedProfile);
          if (newCount && newCount > 0) {
            toast(`voice notes updated · picked up ${newCount} new tell${newCount > 1 ? "s" : ""}`, "success");
          }
        });
      }

      if (authUser?.uid) {
        logSession(authUser.uid, "quick", undefined, derivedGhostRisk);
        void recordActivity(authUser.uid).catch(() => {});
        // Upload screenshots to R2 for durable history; fall back to inline data URLs offline
        let storedImageRefs: string[] | undefined = undefined;
        try {
          if (screenshots.length > 0) {
            const uploadable = screenshots.map((src) => {
              const m = src.match(/^data:([^;]+);base64,/);
              return {
                mimeType: m ? m[1] : "image/webp",
                data: src.includes(",") ? src.split(",")[1] : src,
              };
            });
            storedImageRefs = await uploadQuickImagesToR2(uploadable);
          }
        } catch {
          storedImageRefs = undefined;
        }
        const historyScreenshots = storedImageRefs && storedImageRefs.length > 0 ? storedImageRefs : screenshots;
        void createSession(
          authUser.uid,
          {
            // Envelope v2: full normalized response nested under `response`.
            // History must read suggestions/summary via `parsed.response`, never top-level.
            v: 2,
            request: {
              screenshots: historyScreenshots,
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
            headline: response.summary || response.proTip || "Quick analysis",
            ghost_risk: derivedGhostRisk,
            message_count: response.extractedUnrepliedMessages?.length || 1,
          }
        ).catch((sessionErr) => {
          console.error("Failed to save session:", sessionErr);
          // Queue for retry on next load instead of silently losing it
          queuePendingSession(
            authUser.uid,
            {
              v: 2,
              request: { screenshots: historyScreenshots, theirMessage, yourDraft, context },
              response,
              vibeCheck: response.vibeCheck,
              suggestions: response.suggestions,
            },
            {
              mode: "quick",
              headline: response.summary || response.proTip || "Quick analysis",
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
      clearInterval(loadingTimer);
      setIsLoading(false);
    }
  };

  const handleRedo = () => {
    setShowResults(false);
    setResult(null);
    setTheirMessage("");
    setYourDraft("");
    setScreenshots([]);
    try {
      if (authUser?.uid) sessionStorage.removeItem(`quick_last_result_${authUser.uid}`);
    } catch {
      // ignore
    }
    setCursor({ Real: 0, Smooth: 0, Playful: 0, Bold: 0, "Your Style": 0 });
    setFeedbackVotes({});
    setStreamedText("");
    haptics.light();
  };

  const handleEdit = () => {
    // Return to the input view with message/draft/context/screenshots preserved
    setShowResults(false);
    setResult(null);
    setFeedbackVotes({});
    setStreamedText("");
    haptics.light();
  };

  const handleConfirmAction = () => {
    if (confirmAction === "redo") handleRedo();
    else if (confirmAction === "edit") handleEdit();
    setConfirmAction(null);
    haptics.light();
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

  const handleFeedback = (rating: "helpful" | "off", bubbleIdx?: number) => {
    if (!authUser?.uid || !result) return;
    // One vote per bubble — pick and choose across tones and variations.
    const key = `fb-${activeTone}-${cursor[activeTone]}-${bubbleIdx ?? "all"}`;
    if (feedbackVotes[key]) return;
    setFeedbackVotes((prev) => ({ ...prev, [key]: rating }));
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
          variation: cursor[activeTone],
          bubble: bubbleIdx ?? null,
          recommendedAction: result.recommendedAction,
        },
      }).catch((err) => {
        console.error("Failed to submit feedback:", err);
      });
    }

    toast(rating === "helpful" ? "Saved as helpful" : "Got it, we will calibrate", "success");
  };

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
                  onClick={() => setConfirmAction("edit")}
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
                  onClick={() => setConfirmAction("redo")}
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
          <div className="px-5 pb-[140px]" onPaste={handlePaste}>
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
                {screenshots.length > 0 ? "Tap to add more" : "1–10 images supported • paste works too"}
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
                      loading="lazy"
                      decoding="async"
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
              <label className="block mb-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase" }}>{screenshots.length > 0 ? "Your goal / direction (optional)" : "Their message / context"}</label>
              {screenshots.length > 0 && (
                <p className="mb-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.45)" }}>Private coaching for your wingman — won&apos;t be echoed out loud</p>
              )}
              <textarea
                ref={theirMessageRef}
                value={theirMessage}
                onChange={(e) => {
                  setTheirMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder={screenshots.length > 0 ? "e.g., match her energy, tease her about taking 3 days, pivot toward drinks this week..." : "Paste what they sent, or describe the situation..."}
                className="w-full resize-none outline-none overflow-hidden bg-[#FDFAF5] rounded-[14px] border border-[#E8E0D4] p-3 text-[15px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                style={{
                  minHeight: 80,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            <div className="mt-3 relative">
              {!showDraftInput && !yourDraft.trim() ? (
                <button
                  onClick={() => setShowDraftInput(true)}
                  className="cursor-pointer"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#C8522A", background: "none", border: "none", padding: 0 }}
                >
                  + Test a draft you&apos;re thinking of sending
                </button>
              ) : (
                <>
              <label className="block mb-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase" }}>
                Your tentative draft <span style={{ color: "rgba(26,18,8,0.35)", textTransform: "lowercase", letterSpacing: "normal" }}>(we&apos;ll critique it honestly in The Read)</span>
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
                </>
              )}
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

            <div className="sticky bottom-[76px] z-30 px-5 mt-6" style={{ background: "linear-gradient(to top, #F5EFE6 70%, rgba(245,239,230,0))", paddingTop: 12, paddingBottom: 8, marginLeft: -20, marginRight: -20, paddingLeft: 20, paddingRight: 20 }}>
              <div className="max-w-[430px] mx-auto">
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
              {loadingLineForElapsed(loadingLines, loadingElapsed)}
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.35)", marginTop: 6 }}>
              {modelStatus && modelStatus.attempt > 1
                ? `trying another angle · attempt ${modelStatus.attempt} · ${loadingElapsed}s`
                : `${modelStatus?.effort === "xhigh" ? "deep thinking" : "thinking"} · ${loadingElapsed}s`}
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
          <div className="px-5 pb-24" ref={resultsTopRef}>
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
              onFeedback={(rating, bubbleIdx) => handleFeedback(rating, bubbleIdx)}
              feedbackVotes={feedbackVotes}
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

            <div className="mt-3">
              <FriendSummaryCard
                summary={result?.summary || result?.tacticalSummary || result?.proTip || "Keep it light, match their energy, and leave an easy lane to reply."}
                shouldWait={Boolean(result?.shouldWait)}
                extractedUnrepliedMessages={result?.extractedUnrepliedMessages ?? []}
              />
            </div>

          </div>
        )}

        {confirmAction && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center px-5"
            style={{ backgroundColor: "rgba(26,18,8,0.45)" }}
            onClick={() => setConfirmAction(null)}
          >
            <div
              className="w-full max-w-[390px]"
              style={{
                backgroundColor: "#FDFAF5",
                borderRadius: 24,
                padding: 24,
                boxShadow: "0 20px 60px rgba(26,18,8,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 28,
                  fontStyle: "italic",
                  color: "#1A1208",
                  lineHeight: 1.15,
                }}
              >
                {confirmAction === "redo" ? "Start over?" : "Back to input?"}
              </p>
              <p
                style={{
                  marginTop: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  color: "rgba(26,18,8,0.6)",
                  lineHeight: 1.6,
                }}
              >
                {confirmAction === "redo"
                  ? "This clears your message, draft and screenshots. Anything saved in History stays put."
                  : "Your replies stay saved here — you can jump right back."}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  onClick={handleConfirmAction}
                  style={{
                    height: 48,
                    borderRadius: 999,
                    border: "none",
                    backgroundColor: "#C8522A",
                    color: "#FFFFFF",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {confirmAction === "redo" ? "Start over" : "Back to input"}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{
                    height: 48,
                    borderRadius: 999,
                    border: "1px solid #E8E0D4",
                    backgroundColor: "transparent",
                    color: "rgba(26,18,8,0.65)",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Keep my replies
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}






