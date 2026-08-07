import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CornerDownRight,
  Image,
  Link2,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trash2,
  X,
  Zap,
  AlertCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import { deleteSession, getSessions, Session, SessionResult } from "../../services/dbService";
import { formatShortDate, formatTimeAgo } from "../utils/formatTime";

const filterOptions = ["All", "Quick Mode", "Practice"] as const;

const toMode = (mode?: string) =>
  mode === "quick" ? "Quick Mode" : mode === "simulator" ? "Practice" : "Session";

const getAccentColor = (risk: number) =>
  risk > 65 ? "#C8522A" : risk > 35 ? "#D4A853" : "#7A9E7E";

const formatDate = (isoDate?: string | null) => formatShortDate(isoDate);

const formatAgo = (isoDate?: string | null) => formatTimeAgo(isoDate);

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
  const { toast } = useToast();
  const parsed = session.parsedResult || {};
  const screenshots = getScreenshots(session);
  const vibeCheck = parsed.vibeCheck || parsed.response?.vibeCheck;
  const suggestions = parsed.suggestions || parsed.response?.suggestions;
  const response = parsed.response as SessionResult["response"] | undefined;
  const history = parsed.history || [];
  const analysis = parsed.analysis;
  const theirMessage = parsed.request?.theirMessage;
  const risk = getRisk(session);
  const accent = getAccentColor(risk);
  const isQuick = session.mode === "quick";

  const parsedAny = parsed as any;

  const toneLabels: Record<string, string> = {
    smooth: "Smooth",
    bold: "Bold",
    witty: "Witty",
    roast: "Roast",
    authentic: "Authentic",
    yourStyle: "Your Style",
  };

  const toneOrder = ["smooth", "bold", "witty", "roast", "authentic", "yourStyle"];

  const [activeTone, setActiveTone] = useState<string>(() => {
    const firstAvailable = toneOrder.find((t) => {
      const list = (parsed.suggestions || parsed.response?.suggestions)?.[t];
      return Array.isArray(list) && list.length > 0;
    });
    return firstAvailable || "smooth";
  });
  const [toneCursor, setToneCursor] = useState<Record<string, number>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const optionsForTone = (tone: string): any[] => {
    const list = suggestions?.[tone];
    return Array.isArray(list) ? list.filter((o: any) => o && Array.isArray(o.replies) && o.replies.length > 0) : [];
  };

  const activeOptions = optionsForTone(activeTone);
  const cursor = toneCursor[activeTone] ?? 0;
  const selectedOption = activeOptions.length ? activeOptions[cursor % activeOptions.length] : null;

  const handleCopy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast("Could not copy", "error");
      return;
    }
    setCopiedKey(key);
    haptics.success();
    toast("Copied to clipboard", "success");
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1500);
  };

  const actionLabel: Record<string, { label: string; color: string; bg: string }> = {
    SEND: { label: "Send it", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    WAIT: { label: "Wait", color: "#D4A853", bg: "rgba(212,168,83,0.12)" },
    CALL: { label: "Call / voice note", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
    MATCH: { label: "Match their energy", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
    PULL_BACK: { label: "Pull back", color: "#D4A853", bg: "rgba(212,168,83,0.12)" },
    ABORT: { label: "Walk away", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
  };

  const nextMove = (response?.recommendedAction || parsedAny.recommendedAction) as string | undefined;
  const timing = response?.timingRecommendation || parsedAny.timingRecommendation;
  const interestSignal = response?.interestSignal ?? parsedAny.interestSignal;
  const waitReason = response?.wait ?? suggestions?.wait ?? parsedAny.wait;
  const proTip = response?.proTip || parsedAny.proTip;
  const unreplied = response?.extractedUnrepliedMessages || parsedAny.extractedUnrepliedMessages;
  const conversationContext = response?.conversationContext || parsedAny.conversationContext;
  const draftAnalysis = response?.draftAnalysis || parsedAny.draftAnalysis;
  const detectedMeta = response?.detectedMeta || parsedAny.detectedMeta;
  const yourDraft = parsed.request?.yourDraft || parsedAny.yourDraft;

  const labelStyle: React.CSSProperties = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(26,18,8,0.55)",
  };

  return (
    <div className="relative min-h-screen pb-[72px]" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 px-5 pt-4 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="cursor-pointer flex items-center justify-center"
            style={{ color: "rgba(26,18,8,0.7)", width: 44, height: 44 }}
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
              <p style={labelStyle}>
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
            <p style={{ ...labelStyle, marginBottom: 8 }}>
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

        {yourDraft && (
          <div className="mt-3 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>
              Your draft
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                color: "rgba(26,18,8,0.75)",
                fontStyle: "italic",
                lineHeight: 1.55,
              }}
            >
              "{yourDraft}"
            </p>
          </div>
        )}

        {isQuick && nextMove && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} color="#C8522A" />
              <p style={labelStyle}>Next move</p>
            </div>
            {(() => {
              const a = actionLabel[nextMove] || { label: nextMove, color: "#1A1208", bg: "rgba(26,18,8,0.06)" };
              return (
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    style={{
                      borderRadius: 999,
                      padding: "5px 12px",
                      backgroundColor: a.bg,
                      color: a.color,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {a.label}
                  </span>
                  {typeof interestSignal === "number" && (
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)" }}>
                      Interest: {interestSignal}/100
                    </span>
                  )}
                </div>
              );
            })()}
            {timing && (
              <div className="mt-3 flex items-start gap-2">
                <Timer size={14} strokeWidth={1.8} color="rgba(26,18,8,0.4)" style={{ marginTop: 2, flexShrink: 0 }} />
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.65)", lineHeight: 1.5 }}>
                  {timing}
                </p>
              </div>
            )}
          </div>
        )}

        {isQuick && waitReason && (
          <div className="mt-3 p-4" style={{ backgroundColor: "#FEF3E2", borderRadius: 20, border: "1px solid rgba(212,168,83,0.25)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={15} color="#D4A853" />
              <p style={{ ...labelStyle, color: "#B8860B" }}>Don't reply yet</p>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.7)", lineHeight: 1.5 }}>
              {waitReason}
            </p>
          </div>
        )}

        {isQuick && proTip && (
          <div className="mt-3 p-4" style={{ backgroundColor: "#F5E8E0", borderRadius: 20 }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontStyle: "italic", color: "#1A1208", lineHeight: 1.45 }}>
              "{proTip}"
            </p>
          </div>
        )}

        {isQuick && conversationContext && (
          <div className="mt-3 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 6 }}>Conversation context</p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.7)", lineHeight: 1.5 }}>
              {conversationContext}
            </p>
          </div>
        )}

        {isQuick && Array.isArray(unreplied) && unreplied.length > 0 && (
          <div className="mt-3 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>Messages to reply to</p>
            <div className="space-y-2">
              {unreplied.map((msg: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <CornerDownRight size={13} strokeWidth={2} color="#C8522A" style={{ marginTop: 3, flexShrink: 0 }} />
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.75)", lineHeight: 1.5 }}>
                    "{msg}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isQuick && detectedMeta && (
          <div className="mt-3 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>Detected from screenshots</p>
            <div className="flex flex-wrap gap-2">
              {detectedMeta.platform && detectedMeta.platform !== "unknown" && (
                <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5E8E0", color: "#C8522A", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {detectedMeta.platform}
                </span>
              )}
              {detectedMeta.deliveryStatus && detectedMeta.deliveryStatus !== "unknown" && (
                <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {detectedMeta.deliveryStatus === "read" ? "✓✓ read" : detectedMeta.deliveryStatus}
                </span>
              )}
              {detectedMeta.timestamp && (
                <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {detectedMeta.timestamp}
                </span>
              )}
              {detectedMeta.groupName && (
                <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {detectedMeta.groupName}
                </span>
              )}
              {detectedMeta.isMessageRequest === true && (
                <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "rgba(200,82,42,0.1)", color: "#C8522A", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  message request
                </span>
              )}
              {Array.isArray(detectedMeta.reactions) && detectedMeta.reactions.length > 0 && (
                <span style={{ borderRadius: 999, padding: "3px 10px", backgroundColor: "#F5EFE6", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.6)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {detectedMeta.reactions.join(" ")}
                </span>
              )}
            </div>
          </div>
        )}

        {isQuick && draftAnalysis && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>Draft analysis</p>
            {draftAnalysis.verdict && (
              <p
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 17,
                  fontStyle: "italic",
                  color: "#1A1208",
                  lineHeight: 1.45,
                  marginBottom: 8,
                }}
              >
                "{draftAnalysis.verdict}"
              </p>
            )}
            {typeof draftAnalysis.confidenceScore === "number" && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)" }}>Confidence</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#1A1208" }}>{draftAnalysis.confidenceScore}/100</span>
                </div>
                <div className="w-full overflow-hidden" style={{ height: 6, borderRadius: 100, backgroundColor: "#E8E0D4" }}>
                  <div style={{ width: `${draftAnalysis.confidenceScore}%`, height: "100%", borderRadius: 100, backgroundColor: "#7A9E7E" }} />
                </div>
              </div>
            )}
            {Array.isArray(draftAnalysis.strengths) && draftAnalysis.strengths.length > 0 && (
              <div className="mb-2">
                <p style={{ fontSize: 11, color: "#7A9E7E", marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>Strengths</p>
                <div className="flex flex-wrap gap-2">
                  {draftAnalysis.strengths.map((s: string, i: number) => (
                    <span key={i} style={{ borderRadius: 999, padding: "3px 9px", backgroundColor: "rgba(122,158,126,0.12)", color: "#58745A", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(draftAnalysis.issues) && draftAnalysis.issues.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: "#C8522A", marginBottom: 5, fontFamily: "'DM Sans', sans-serif" }}>Could improve</p>
                <div className="flex flex-wrap gap-2">
                  {draftAnalysis.issues.map((s: string, i: number) => (
                    <span key={i} style={{ borderRadius: 999, padding: "3px 9px", backgroundColor: "rgba(200,82,42,0.12)", color: "#C8522A", fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {vibeCheck && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>
              Vibe check
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: 12, padding: 10, border: "1px solid #E8E0D4" }}>
                <p style={{ fontSize: 11, color: "rgba(26,18,8,0.5)", marginBottom: 4 }}>Energy</p>
                <p style={{ fontSize: 14, color: "#1A1208", fontFamily: "'DM Sans', sans-serif", textTransform: "capitalize" }}>{vibeCheck.theirEnergy || "N/A"}</p>
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

        {isQuick && suggestions && toneOrder.some((t) => optionsForTone(t).length > 0) && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={15} color="#C8522A" />
              <p style={labelStyle}>Suggested replies</p>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar" style={{ marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }}>
              {toneOrder.filter((t) => optionsForTone(t).length > 0).map((tone) => {
                const isActive = activeTone === tone;
                return (
                  <button
                    key={tone}
                    onClick={() => {
                      setActiveTone(tone);
                      haptics.light();
                    }}
                    className="cursor-pointer shrink-0"
                    style={{
                      borderRadius: 100,
                      padding: "7px 13px",
                      backgroundColor: isActive ? "#C8522A" : "transparent",
                      color: isActive ? "#FFFFFF" : "rgba(26,18,8,0.55)",
                      border: isActive ? "1px solid #C8522A" : "1px solid #E8E0D4",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: 500,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {toneLabels[tone]}
                  </button>
                );
              })}
            </div>

            {selectedOption ? (
              <>
                <div className="space-y-3 mt-3">
                  {selectedOption.replies.map((replyItem: any, idx: number) => {
                    const key = `replay-${activeTone}-${cursor}-${idx}`;
                    const isCopied = copiedKey === key;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleCopy(replyItem.reply, key)}
                        className="w-full text-left cursor-pointer transition-all active:scale-[0.99]"
                        style={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E8E0D4",
                          borderRadius: 14,
                          padding: "12px 14px",
                        }}
                      >
                        {replyItem.originalMessage ? (
                          <div className="flex items-start gap-1.5 mb-2">
                            <CornerDownRight size={13} strokeWidth={2} color="rgba(26,18,8,0.35)" style={{ marginTop: 3, flexShrink: 0 }} />
                            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontStyle: "italic", color: "rgba(26,18,8,0.55)", lineHeight: 1.4 }}>
                              "{replyItem.originalMessage}"
                            </span>
                          </div>
                        ) : null}
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14.5, color: "#1A1208", lineHeight: 1.5, paddingLeft: 12, borderLeft: "2px solid #C8522A" }}>
                          {replyItem.reply}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5" style={{ color: isCopied ? "#7A9E7E" : "rgba(26,18,8,0.4)", fontFamily: "'DM Sans', sans-serif", fontSize: 10, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>
                          {isCopied ? <Check size={13} /> : <Copy size={13} />}
                          <span>{isCopied ? "Copied" : "Copy"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedOption.conversationHook && (
                  <button
                    onClick={() => handleCopy(selectedOption.conversationHook, `replay-hook-${activeTone}-${cursor}`)}
                    className="w-full text-left cursor-pointer transition-all active:scale-[0.99] mt-2"
                    style={{
                      backgroundColor: "#F5E8E0",
                      border: "1px solid #E8E0D4",
                      borderRadius: 14,
                      padding: "12px 14px",
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Link2 size={13} strokeWidth={2} color="#C8522A" />
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C8522A" }}>
                        Conversation hook
                      </span>
                    </div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "#1A1208", lineHeight: 1.5 }}>
                      {selectedOption.conversationHook}
                    </p>
                  </button>
                )}
              </>
            ) : (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", marginTop: 12 }}>
                No replies saved for this style.
              </p>
            )}

            {activeOptions.length > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid #E8E0D4" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: "rgba(26,18,8,0.55)" }}>
                  Variation {(cursor % activeOptions.length) + 1} of {activeOptions.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      haptics.light();
                      setToneCursor((prev) => ({
                        ...prev,
                        [activeTone]: cursor > 0 ? cursor - 1 : activeOptions.length - 1,
                      }));
                    }}
                    className="cursor-pointer flex items-center justify-center"
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4", color: "#C8522A" }}
                  >
                    <ChevronLeft size={15} strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      setToneCursor((prev) => ({
                        ...prev,
                        [activeTone]: (cursor + 1) % activeOptions.length,
                      }));
                    }}
                    className="cursor-pointer flex items-center justify-center"
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4", color: "#C8522A" }}
                  >
                    <ChevronRight size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-4 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>
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
                      {turn.result?.rewrites && (
                        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px solid rgba(26,18,8,0.06)" }}>
                          {(["safe", "bold", "spicy", "you"] as const)
                            .filter((k) => turn.result.rewrites?.[k])
                            .map((k) => (
                              <div key={k} className="flex items-start gap-1.5">
                                <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "#C8522A", fontFamily: "'DM Sans', sans-serif", marginTop: 2, flexShrink: 0, width: 38 }}>
                                  {k}
                                </span>
                                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.65)", lineHeight: 1.4 }}>
                                  {turn.result.rewrites[k]}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis && (
          <div className="mt-4 mb-8 p-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>
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
    <div className="relative min-h-screen pb-[72px]" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 px-5 pt-4 max-w-[430px] mx-auto">
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
                className="mt-2 flex items-center gap-2 bg-[#FDFAF5] rounded-[100px] border border-[#E8E0D4] px-3 h-[40px] transition-all duration-300 focus-within:border-[#C8522A] focus-within:ring-[3px] focus-within:ring-[#C8522A]/20 shadow-sm"
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
              className="mt-2"
              style={{
                backgroundColor: "#FDFAF5",
                borderRadius: 18,
                padding: "12px 14px",
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

        <div className="mt-4 flex flex-col gap-2">
          {loading ? (
            <div style={{ backgroundColor: "#FDFAF5", borderRadius: 18, padding: 16 }}>
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
                className="flex flex-col items-center justify-center py-8 px-6"
                style={{
                  backgroundColor: "#FDFAF5",
                  borderRadius: 20,
                  border: "1px dashed rgba(26,18,8,0.15)",
                }}
              >
                <div className="mb-3 flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(200,82,42,0.14)" }}>
                  <MessageSquare size={28} strokeWidth={1.5} color="#C8522A" />
                </div>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#1A1208",
                    marginBottom: 6,
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
                    marginBottom: 16,
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
                      padding: "12px 20px",
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
                    borderRadius: 18,
                    boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div className="flex">
                    <div style={{ width: 4, borderRadius: "18px 0 0 18px", backgroundColor: accent }} />
                    <div className="p-3 flex-1">
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
                      <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: "1px solid rgba(26,18,8,0.06)" }}>
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
              className="fixed inset-0 z-[100]"
              style={{ backgroundColor: "rgba(26, 18, 8, 0.45)", backdropFilter: "blur(8px)" }}
              onClick={() => setConfirmDeleteId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              className="fixed inset-x-5 top-1/2 z-[101] max-w-[360px] mx-auto"
              style={{ translateY: "-50%" }}
            >
              <div style={{ backgroundColor: "#FDFAF5", borderRadius: 24, padding: 20, boxShadow: "0 20px 60px rgba(26,18,8,0.15)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#F5E8E0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AlertCircle size={20} strokeWidth={1.8} color="#C8522A" />
                  </div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
                    Delete Session?
                  </p>
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", lineHeight: 1.5, marginBottom: 20 }}>
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
    </div >
  );
}
