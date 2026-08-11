import type React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
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
}: ReplyHeroCardProps) {
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
          drag={!prefersReducedMotion && optionCount > 1 ? "x" : false}
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
          ) : selectedOption ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <p style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selectedOption.replies.length > 1 ? `Replying to ${selectedOption.replies.length} messages` : "Your reply"}
                </p>
                {optionCount > 1 && (
                  <div className="flex items-center shrink-0" style={{ gap: 2, padding: 2, backgroundColor: "rgba(26,18,8,0.06)", borderRadius: 10 }}>
                    {Array.from({ length: optionCount }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectVariation(i)}
                        aria-label={`Variation ${i + 1}`}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: cursor % optionCount === i ? "#1A1208" : "transparent",
                          color: cursor % optionCount === i ? "#FFFFFF" : "rgba(26,18,8,0.55)",
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
                {selectedOption.replies.map((replyItem, idx) => {
                  const replyKey = `reply-${activeTone}-${cursor}-${idx}`;
                  const isCopied = copiedKey === replyKey;
                  return (
                    <div key={idx}>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontStyle: "italic", color: "rgba(26,18,8,0.45)", lineHeight: 1.4, marginBottom: 5 }}>
                        "{replyItem.originalMessage}"
                      </p>
                      <div className="flex justify-end">
                        <button
                          onClick={() => onCopy(replyItem.reply, replyKey)}
                          className="cursor-pointer fade-press"
                          style={{ maxWidth: "88%", border: "none", background: "none", padding: 0, textAlign: "left" }}
                          aria-label="Copy this reply"
                        >
                          <div
                            className="flex items-start gap-2"
                            style={{ backgroundColor: isCopied ? "#EAF0EA" : "#F5E8E0", borderRadius: 12, borderTopRightRadius: 4, padding: "10px 14px", transition: "background-color 0.15s ease" }}
                          >
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15.5, color: "#1A1208", lineHeight: 1.45, flex: 1 }}>
                              {replyItem.reply}
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

                {selectedOption.conversationHook && (
                  <div className="mt-2">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "#C8522A", textTransform: "uppercase", marginBottom: 5 }}>
                      keep it going
                    </p>
                    <button
                      onClick={() => onCopy(selectedOption.conversationHook!, `hook-${activeTone}-${cursor}`)}
                      className="w-full text-left cursor-pointer fade-press"
                      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E0D4", borderRadius: 12, padding: "10px 14px" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", lineHeight: 1.5, flex: 1 }}>
                          {selectedOption.conversationHook}
                        </p>
                        <span style={{ flexShrink: 0, color: copiedKey === `hook-${activeTone}-${cursor}` ? "#58745A" : "rgba(200,82,42,0.55)" }}>
                          {copiedKey === `hook-${activeTone}-${cursor}` ? <Check size={15} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
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
