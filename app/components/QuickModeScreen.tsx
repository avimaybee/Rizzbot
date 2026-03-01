import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Camera,
  ChevronLeft,
  Copy,
  Info,
  RotateCcw,
  Share2,
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
import { getQuickAdvice } from "../../services/geminiService";
import { createSession, submitFeedback } from "../../services/dbService";
import { logSession, saveFeedback } from "../../services/feedbackService";
import { QuickAdviceResponse, SuggestionOption } from "../../types";

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
  "Your Style": "authentic",
};

const feedbackTypeMap: Record<Tone, "smooth" | "bold" | "authentic"> = {
  Smooth: "smooth",
  Bold: "bold",
  Witty: "bold",
  Authentic: "authentic",
  "Your Style": "authentic",
};

const composeSuggestion = (option: SuggestionOption | null): string => {
  if (!option) return "";
  const replyLines = option.replies.map((r) => r.reply).join("\n");
  return option.conversationHook ? `${replyLines}\n\n${option.conversationHook}` : replyLines;
};

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
  const [theirMessage, setTheirMessage] = useState("");
  const [activeTone, setActiveTone] = useState<Tone>("Smooth");
  const [showStyleTooltip, setShowStyleTooltip] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [result, setResult] = useState<QuickAdviceResponse | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"helpful" | "off" | null>(null);
  const [cursor, setCursor] = useState<Record<Tone, number>>({
    Smooth: 0,
    Bold: 0,
    Witty: 0,
    Authentic: 0,
    "Your Style": 0,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const ghostRisk = result ? Math.max(0, 100 - (result.vibeCheck?.interestLevel || 50)) : 0;
  const riskColor = ghostRisk > 65 ? "#C8522A" : ghostRisk > 35 ? "#D4A853" : "#7A9E7E";
  const riskLabel = ghostRisk > 65 ? "High" : ghostRisk > 35 ? "Medium" : "Low";

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, 3);
    try {
      const encoded = await Promise.all(picked.map((f) => toDataUrl(f)));
      setScreenshots(encoded);
      toast(`${encoded.length} screenshot(s) attached`, "success");
    } catch {
      toast("Could not read one or more screenshots", "error");
    }
  };

  const handleAnalyze = async () => {
    if (!theirMessage.trim() && screenshots.length === 0) {
      toast("Add a message or screenshot first", "error");
      return;
    }

    setIsLoading(true);
    setShowResults(false);
    haptics.medium();

    try {
      const response = await getQuickAdvice({
        theirMessage: theirMessage.trim() || "Analyze the conversation screenshot",
        context: "talking",
        screenshots: screenshots.length ? screenshots : undefined,
        userStyle: userProfile || undefined,
        userId: authUser?.uid,
      });
      const derivedGhostRisk = Math.max(0, 100 - (response.vibeCheck?.interestLevel || 50));

      setResult(response);
      setShowResults(true);
      runWellbeingCheck();
      haptics.success();

      if (authUser?.uid) {
        logSession(authUser.uid, "quick", undefined, derivedGhostRisk);
        await createSession(
          authUser.uid,
          {
            request: {
              screenshots,
              theirMessage,
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
        );
      }

      toast("Analysis complete", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      toast(message, "error");
      haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedo = () => {
    setShowResults(false);
    setResult(null);
    setTheirMessage("");
    setScreenshots([]);
    setCursor({ Smooth: 0, Bold: 0, Witty: 0, Authentic: 0, "Your Style": 0 });
    setFeedbackGiven(null);
    haptics.light();
  };

  const handleCopy = () => {
    const text = composeSuggestion(selectedOption);
    if (!text) return;
    navigator.clipboard.writeText(text);
    haptics.success();
    toast("Copied to clipboard", "success");
  };

  const handleFeedback = (rating: "helpful" | "off") => {
    if (!authUser?.uid || !result) return;
    setFeedbackGiven(rating);
    const suggestionType = feedbackTypeMap[activeTone];
    saveFeedback(authUser.uid, {
      source: "quick",
      suggestionType,
      rating,
      context: "talking",
      theirEnergy: result.vibeCheck.theirEnergy,
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
      });
    }

    toast(rating === "helpful" ? "Saved as helpful" : "Got it, we will calibrate", "success");
  };

  const showMessage = result?.extractedTargetMessage || theirMessage || "Conversation screenshot";

  return (
    <div className="relative min-h-screen pb-24" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between px-5 pt-14">
          <button onClick={() => navigate("/home")} className="cursor-pointer p-1">
            <ChevronLeft size={24} strokeWidth={1.8} color="#1A1208" />
          </button>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
            Quick Mode
          </p>
          {showResults ? (
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
          ) : (
            <div style={{ width: 32 }} />
          )}
        </div>

        {!showResults && !isLoading ? (
          <div className="px-5">
            <div className="mt-6">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 400, color: "rgba(26, 18, 8, 0.55)", lineHeight: 1.3 }}>
                Drop their
              </p>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, fontStyle: "italic", color: "#1A1208", lineHeight: 1.2 }}>
                message.
              </p>
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
              className="mt-6 w-full flex flex-col items-center justify-center cursor-pointer"
              style={{
                height: 160,
                border: "2px dashed #C8522A",
                backgroundColor: "#F5E8E0",
                borderRadius: 24,
              }}
            >
              <Camera size={28} strokeWidth={1.8} color="#C8522A" />
              <p className="mt-3" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                {screenshots.length > 0 ? `${screenshots.length} screenshot(s) attached` : "Upload screenshot(s)"}
              </p>
              <p className="mt-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.45)" }}>
                {screenshots.length > 0 ? "Tap to add more" : "1–3 images supported"}
              </p>
            </button>

            {screenshots.length > 0 && (
              <div className="flex gap-3 mt-3">
                {screenshots.map((src, i) => (
                  <div key={i} className="relative shrink-0">
                    <img
                      src={src}
                      alt={`Screenshot ${i + 1}`}
                      style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }}
                    />
                    <button
                      onClick={() => setScreenshots((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute flex items-center justify-center cursor-pointer"
                      style={{
                        top: -6,
                        right: -6,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        backgroundColor: "#C8522A",
                        border: "none",
                        padding: 0,
                      }}
                    >
                      <X size={10} strokeWidth={2.5} color="#FFFFFF" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1" style={{ height: 1, backgroundColor: '#E8E0D4' }} />
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: '0.15em', color: 'rgba(26,18,8,0.35)', textTransform: 'uppercase' }}>
                or type it out
              </span>
              <div className="flex-1" style={{ height: 1, backgroundColor: '#E8E0D4' }} />
            </div>

            <div className="mt-4 relative">
              <textarea
                value={theirMessage}
                onChange={(e) => setTheirMessage(e.target.value)}
                placeholder="Paste or type their message here..."
                className="w-full resize-none outline-none"
                style={{
                  minHeight: 110,
                  backgroundColor: "#FDFAF5",
                  borderRadius: 14,
                  border: "1px solid #E8E0D4",
                  padding: "14px 16px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  color: "#1A1208",
                }}
              />
            </div>

            <div className="fixed bottom-24 left-0 right-0 px-5 z-30">
              <div className="max-w-[430px] mx-auto">
                <button
                  onClick={() => void handleAnalyze()}
                  className="w-full cursor-pointer transition-colors"
                  style={{
                    height: 56,
                    borderRadius: 100,
                    backgroundColor: "#C8522A",
                    color: "#FFFFFF",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    fontWeight: 600,
                    border: "none",
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
              style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)" }}
            >
              <div className="flex">
                <div style={{ width: 3, backgroundColor: "#C8522A", borderRadius: "3px 0 0 3px", flexShrink: 0 }} />
                <div className="p-5 flex-1">
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase" }}>
                    Their message
                  </p>
                  <p className="mt-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", lineHeight: 1.5 }}>
                    {showMessage}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="mt-4"
              style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}
            >
              <div className="flex items-center justify-between mb-4">
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>Vibe Check</p>
                <Share2 size={16} strokeWidth={1.8} color="rgba(26,18,8,0.4)" />
              </div>
              <div className="mb-4" style={{ height: 1, backgroundColor: "#E8E0D4" }} />

              {[
                { label: "Energy", value: result?.vibeCheck.theirEnergy || "neutral", level: 0.6, color: "#C8522A" },
                {
                  label: "Interest",
                  value: `${result?.vibeCheck.interestLevel || 50}/100`,
                  level: Math.max(0.05, (result?.vibeCheck.interestLevel || 50) / 100),
                  color: "#C8522A",
                },
                { label: "Ghost Risk", value: `${riskLabel} (${ghostRisk}%)`, level: Math.max(0.05, ghostRisk / 100), color: riskColor },
              ].map((metric) => (
                <div key={metric.label} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26, 18, 8, 0.55)" }}>{metric.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: metric.color }}>{metric.value}</span>
                  </div>
                  <div className="w-full overflow-hidden" style={{ height: 6, borderRadius: 100, backgroundColor: "#E8E0D4" }}>
                    <div style={{ width: `${metric.level * 100}%`, height: "100%", borderRadius: 100, backgroundColor: metric.color, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              ))}

              {result?.proTip && (
                <div className="mt-2" style={{ backgroundColor: "#F5E8E0", borderRadius: 12, padding: "14px 16px" }}>
                  <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontStyle: "italic", color: "#1A1208", lineHeight: 1.4 }}>
                    "{result.proTip}"
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase" }}>
                Suggested replies
              </p>
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
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
                style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}
              >
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${activeTone}-${cursor[activeTone]}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", lineHeight: 1.6, whiteSpace: "pre-wrap" }}
                  >
                    {composeSuggestion(selectedOption)}
                  </motion.p>
                </AnimatePresence>

                <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid #E8E0D4" }}>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 cursor-pointer"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#C8522A",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    <Copy size={16} strokeWidth={1.8} />
                    Copy
                  </button>
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

              <button
                onClick={() =>
                  setCursor((prev) => ({
                    ...prev,
                    [activeTone]:
                      selectedOptions.length > 0 ? (prev[activeTone] + 1) % selectedOptions.length : 0,
                  }))
                }
                className="w-full flex items-center justify-center gap-2 mt-4 cursor-pointer"
                style={{
                  background: "none",
                  border: "none",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 400,
                  color: "#C8522A",
                }}
              >
                <RotateCcw size={14} strokeWidth={1.8} />
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
      <TabBar />
    </div>
  );
}
