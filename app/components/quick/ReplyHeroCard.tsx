import type React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, CornerDownRight, ThumbsDown, ThumbsUp } from "lucide-react";
import type { SuggestionOption } from "../../../types";

interface ReplyHeroCardProps {
  selectedOption: SuggestionOption | null;
  optionCount: number;
  activeTone: string;
  cursor: number;
  copiedKey: string | null;
  prefersReducedMotion: boolean | null;
  onCopy: (text: string, key: string) => void;
  onSelectVariation: (i: number) => void;
  onDragEnd: (info: { offset: { x: number }; velocity: { x: number } }) => void;
  // Spike (plan 009): raw streamed text rendered in the reply bubble area
  // while the streaming prototype is active.
  streamedText?: string;
  // V2 optional props (Plan 012). When provided, ReplyHeroCard can operate
  // in standalone mode without the legacy QuickModeScreen copy handlers.
  style?: string;
  options?: SuggestionOption[];
  selectedIndex?: number;
  onCopyAll?: (text: string) => void;
  onCopySingleBubble?: (bubbleText: string, bubbleIndex: number) => void;
  copiedAll?: boolean;
  /** Rate the visible reply variation. Rendered with a clear label so the
      target is unambiguous (replaces the old bottom-bar thumbs). */
  onFeedback?: (rating: "helpful" | "off") => void;
  feedbackGiven?: "helpful" | "off" | null;
}

export function ReplyHeroCard({
  selectedOption,
  optionCount,
  activeTone,
  cursor,
  copiedKey,
  prefersReducedMotion,
  onCopy,
  onSelectVariation,
  onDragEnd,
  streamedText,
  options,
  selectedIndex,
  onCopyAll,
  onCopySingleBubble,
  copiedAll,
  onFeedback,
  feedbackGiven = null,
}: ReplyHeroCardProps) {
  const effectiveOption = selectedOption ?? (options && typeof selectedIndex === 'number' ? options[selectedIndex] : null);
  const effectiveCount = options ? options.length : optionCount;

  const bubbles = (() => {
    if (!effectiveOption) return [];
    if (Array.isArray((effectiveOption as any).bubbles) && (effectiveOption as any).bubbles.length > 0) {
      return (effectiveOption as any).bubbles as Array<{ replyTo: string | null; text: string }>;
    }
    if (Array.isArray(effectiveOption.replies) && effectiveOption.replies.length > 0) {
      return effectiveOption.replies.map((r) => ({ replyTo: r.originalMessage ?? null, text: r.reply }));
    }
    if (typeof (effectiveOption as any).text === 'string' && (effectiveOption as any).text.trim()) {
      return [{ replyTo: null, text: (effectiveOption as any).text.trim() }];
    }
    return [];
  })();

  const fullText = (() => {
    if (!effectiveOption) return '';
    if (typeof (effectiveOption as any).text === 'string' && (effectiveOption as any).text.trim()) {
      return (effectiveOption as any).text as string;
    }
    return bubbles.map((b) => b.text).join('\n');
  })();

  const handleBubbleCopy = (text: string, idx: number) => {
    if (onCopySingleBubble) {
      onCopySingleBubble(text, idx);
      return;
    }
    onCopy(text, `bubble-${activeTone}-${cursor}-${idx}`);
  };

  const handleCopyAll = () => {
    if (onCopyAll) {
      onCopyAll(fullText);
      return;
    }
    onCopy(fullText, `copyall-${activeTone}-${cursor}`);
  };

  const isAllCopied = typeof copiedAll === 'boolean'
    ? copiedAll
    : copiedKey === `copyall-${activeTone}-${cursor}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut", delay: 0.05 }}
      className="mt-3"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeTone}-${cursor}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          drag={!prefersReducedMotion && effectiveCount > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          whileDrag={{ scale: 0.99, opacity: 0.92 }}
          onDragEnd={(_e, info) => onDragEnd(info)}
          aria-live="polite"
        >
          {streamedText ? (
            <div
              style={{
                backgroundColor: "rgba(26,18,8,0.04)",
                borderRadius: 12,
                padding: "10px 14px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11.5,
                color: "rgba(26,18,8,0.7)",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 200,
                overflowY: "auto",
              }}
            >
              {streamedText}
            </div>
          ) : effectiveOption ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <p style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {bubbles.length > 1 ? `${bubbles.length} bubbles — send in order` : "Your reply"}
                </p>
                {effectiveCount > 1 && (
                  <div className="flex items-center shrink-0" style={{ gap: 2, padding: 2, backgroundColor: "rgba(26,18,8,0.06)", borderRadius: 10 }}>
                    {Array.from({ length: effectiveCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectVariation(i)}
                        aria-label={`Variation ${i + 1}`}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: cursor % effectiveCount === i ? "#1A1208" : "transparent",
                          color: cursor % effectiveCount === i ? "#FFFFFF" : "rgba(26,18,8,0.55)",
                          border: "none",
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                {bubbles.map((bubble, idx) => {
                  const replyKey = `bubble-${activeTone}-${cursor}-${idx}`;
                  const isCopied = copiedKey === replyKey;
                  return (
                    <div key={idx}>
                      {bubble.replyTo && (
                        <div className="flex items-center gap-1.5 text-xs mb-1.5 truncate" style={{ color: "rgba(26,18,8,0.45)" }}>
                          <CornerDownRight size={12} strokeWidth={2} color="rgba(200,82,42,0.55)" />
                          <span className="truncate italic" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>&quot;{bubble.replyTo}&quot;</span>
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={() => (bubbles.length > 1 ? handleBubbleCopy(bubble.text, idx) : handleCopyAll())}
                          className="cursor-pointer fade-press"
                          style={{ maxWidth: "88%", border: "none", background: "none", padding: 0, textAlign: "left" }}
                          aria-label={bubbles.length > 1 ? `Copy bubble ${idx + 1}` : "Copy this reply"}
                        >
                          <div
                            className="flex items-start gap-2"
                            style={{ backgroundColor: isCopied ? "#EAF0EA" : "#F5E8E0", borderRadius: 12, borderTopRightRadius: 4, padding: "10px 14px", transition: "background-color 0.15s ease" }}
                          >
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15.5, color: "#1A1208", lineHeight: 1.45, flex: 1 }}>
                              {bubble.text}
                            </p>
                            <span style={{ marginTop: 2, flexShrink: 0, color: isCopied ? "#58745A" : "rgba(200,82,42,0.55)" }}>
                              {isCopied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {effectiveOption.conversationHook && (
                  <div className="mt-2">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "#C8522A", textTransform: "uppercase", marginBottom: 5 }}>
                      keep it going
                    </p>
                    <button
                      onClick={() => onCopy(effectiveOption.conversationHook!, `hook-${activeTone}-${cursor}`)}
                      className="w-full text-left cursor-pointer fade-press"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E0D4", borderRadius: 12, padding: "10px 14px" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", lineHeight: 1.5, flex: 1 }}>
                          {effectiveOption.conversationHook}
                        </p>
                        <span style={{ flexShrink: 0, color: copiedKey === `hook-${activeTone}-${cursor}` ? "#58745A" : "rgba(200,82,42,0.55)" }}>
                          {copiedKey === `hook-${activeTone}-${cursor}` ? <Check size={15} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                {bubbles.length > 1 && (
                  <button
                    onClick={handleCopyAll}
                    className="w-full cursor-pointer"
                    style={{ marginTop: 8, height: 40, borderRadius: 10, border: "1px solid #E8E0D4", backgroundColor: "#FFFFFF", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}
                  >
                    {isAllCopied ? "Copied all bubbles" : "Copy all bubbles"}
                  </button>
                )}

                {onFeedback && (
                  <div
                    className="mt-3 pt-3 flex items-center justify-between gap-2"
                    style={{ borderTop: "1px solid #252223" }}
                  >
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(242,239,233,0.55)" }}>
                      Was this reply useful?
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onFeedback("helpful")}
                        aria-label="This reply was helpful"
                        className="cursor-pointer flex items-center justify-center transition-colors"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "none",
                          backgroundColor: feedbackGiven === "helpful" ? "rgba(107,158,120,0.25)" : "#221F20",
                          color: feedbackGiven === "helpful" ? "#8FCE9D" : "#A69F95",
                        }}
                      >
                        <ThumbsUp size={15} strokeWidth={2} fill={feedbackGiven === "helpful" ? "#8FCE9D" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onFeedback("off")}
                        aria-label="This reply was off"
                        className="cursor-pointer flex items-center justify-center transition-colors"
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          border: "none",
                          backgroundColor: feedbackGiven === "off" ? "rgba(212,114,84,0.25)" : "#221F20",
                          color: feedbackGiven === "off" ? "#E3886B" : "#A69F95",
                        }}
                      >
                        <ThumbsDown size={15} strokeWidth={2} fill={feedbackGiven === "off" ? "#E3886B" : "none"} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {(effectiveOption as any).subtext && (effectiveOption as any).subtext !== 'Fallback suggestion.' && (
                <p className="mt-3 text-xs italic" style={{ fontFamily: "'DM Sans', sans-serif", color: "rgba(26,18,8,0.5)" }}>
                  {(effectiveOption as any).subtext}
                </p>
              )}
            </>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-center" style={{ backgroundColor: "rgba(26,18,8,0.04)", borderRadius: 12 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)" }}>
                No {activeTone} replies for this one — try another style.
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
