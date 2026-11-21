import { useMemo, useRef, useState } from "react";
import { Check, Copy, Reply } from "lucide-react";
import { ReplyHeroCard } from "./ReplyHeroCard";
import { ToneRail, type Tone } from "./ToneRail";
import { PickedTray, type PickedItem } from "./PickedTray";
import { FriendSummaryCard } from "./FriendSummaryCard";
import { useScrollFade } from "../../utils/useScrollFade";
import { haptics } from "../../utils/haptics";
import { TONE_ORDER } from "../../utils/quickLogic";
import type { QuickAdviceResponse, SuggestionOption } from "../../../types";
import type { ReplyQuote } from "../../../services/chatApi";
import { buildCopyPayload } from "../../../services/quickAdvice";
import { saveFeedback } from "../../../services/feedbackService";
import { submitFeedback } from "../../../services/dbService";
import { useAppContext } from "../../app-context";

const toneOptions = [
  { key: "Real", help: null },
  { key: "Smooth", help: null },
  { key: "Playful", help: null },
  { key: "Bold", help: null },
  { key: "Your Style", help: "Uses your saved voice profile when available." },
] as const;

const toneKeyMap: Record<string, keyof QuickAdviceResponse["suggestions"]> = {
  Real: "real",
  Smooth: "smooth",
  Playful: "playful",
  Bold: "bold",
  "Your Style": "yourStyle",
};

const labelToKey: Record<string, string> = { Real: "real", Smooth: "smooth", Playful: "playful", Bold: "bold", "Your Style": "yourStyle" };

interface ChatReplyCardProps {
  turnId: string;
  card: any;
  onRefine?: (ref: { sourceTurnId: string; tone?: string; optionIndex?: number; bubbleIndex?: number; label: string }) => void;
  onQuoteBubble?: (quote: ReplyQuote) => void;
  onCopyLine?: (text: string) => void;
}

function toDeck(card: any): { suggestions: Record<string, SuggestionOption[]>; summary?: string; shouldWait?: boolean; extracted?: string[] } | null {
  if (!card || typeof card !== "object") return null;
  if (card.kind === "revision") return null;
  const suggestions = (card as any).suggestions;
  if (!suggestions || typeof suggestions !== "object") return null;
  return {
    suggestions: suggestions as Record<string, SuggestionOption[]>,
    summary: typeof (card as any).summary === "string" ? (card as any).summary : undefined,
    shouldWait: Boolean((card as any).shouldWait),
    extracted: Array.isArray((card as any).extractedUnrepliedMessages) ? (card as any).extractedUnrepliedMessages : [],
  };
}

function toRevision(card: any): { variations: Array<{ bubbles: Array<{ text: string; replyTo: string | null }> }>; sourceTone?: string; sourceOptionIndex?: number } | null {
  if (!card || (card as any).kind !== "revision") return null;
  const v = (card as any).variations;
  if (!Array.isArray(v)) return null;
  return { variations: v, sourceTone: (card as any).sourceTone, sourceOptionIndex: (card as any).sourceOptionIndex };
}

export function ChatReplyCard({ turnId, card, onQuoteBubble, onCopyLine }: ChatReplyCardProps) {
  const { authUser, userId } = useAppContext();
  const deck = toDeck(card);
  const revision = toRevision(card);
  const [activeTone, setActiveTone] = useState<Tone>("Real");
  const [cursor, setCursor] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<string, { tone: string; variation: number; text: string }>>({});
  const [pickedCopied, setPickedCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showTip, setShowTip] = useState<string | null>(null);
  const [feedbackVotes, setFeedbackVotes] = useState<Record<string, "helpful" | "off">>({});
  const copyTimer = useRef<number | null>(null);
  const toneFade = useScrollFade();

  const pickedItems: PickedItem[] = useMemo(
    () => Object.entries(picked).map(([key, v]) => ({ key, tone: v.tone, text: v.text })),
    [picked]
  );

  const copyText = async (text: string, key: string, okLabel = "Copied"): Promise<boolean> => {
    if (!text) return false;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setCopyError("Couldn’t copy. Select the text to copy it.");
      return false;
    }
    setCopiedKey(key);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedKey(null), 1500);
    void okLabel;
    if (onCopyLine && key.startsWith("bubble-")) onCopyLine(text);
    return true;
  };

  if (revision) {
    const variations = revision.variations;
    const idx = cursor[`rev-${turnId}`] || 0;
    const current = variations.length ? variations[idx % variations.length] : null;
    return (
      <section aria-label="Revised reply" className="mt-3 rounded-[20px] bg-[#FDFAF5] border border-[#E8E0D4] p-4">
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(26,18,8,0.55)", marginBottom: 8 }}>
          Revised reply
        </p>
        {current ? (
          <div className="space-y-2">
            {current.bubbles.map((b, i) => (
              <div key={i} className="flex items-center justify-end gap-1">
                <button
                  type="button"
                  onClick={() => void copyText(b.text, `rev-${turnId}-${idx}-${i}`)}
                  className="cursor-pointer"
                  style={{ maxWidth: "88%", border: "none", background: "none", padding: 0, textAlign: "left" }}
                  aria-label={current.bubbles.length > 1 ? `Copy revised line ${i + 1}` : "Copy revised reply"}
                >
                  <span style={{ display: "block", backgroundColor: "#F5E8E0", borderRadius: 12, borderTopRightRadius: 4, padding: "10px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", lineHeight: 1.45 }}>
                    {b.text}
                  </span>
                </button>
              </div>
            ))}
            {variations.length > 1 && (
              <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid #E8E0D4" }}>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)" }}>
                  Variation {(idx % variations.length) + 1} of {variations.length}
                </span>
                <div className="flex gap-2">
                  <button type="button" aria-label="Previous variation" onClick={() => setCursor((p) => ({ ...p, [`rev-${turnId}`]: (idx - 1 + variations.length) % variations.length }))} className="cursor-pointer" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4", color: "#C8522A" }}>‹</button>
                  <button type="button" aria-label="Next variation" onClick={() => setCursor((p) => ({ ...p, [`rev-${turnId}`]: (idx + 1) % variations.length }))} className="cursor-pointer" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4", color: "#C8522A" }}>›</button>
                </div>
              </div>
            )}
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: copiedKey?.startsWith(`rev-${turnId}`) ? "#58745A" : "rgba(26,18,8,0.4)" }}>
              {copiedKey?.startsWith(`rev-${turnId}`) ? "Copied" : copyError || ""}
            </p>
          </div>
        ) : (
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)" }}>No revised lines saved.</p>
        )}
      </section>
    );
  }

  if (!deck) return null;
  const hasOptions = (key: Tone) => {
    const sk = toneKeyMap[key];
    const list = (deck.suggestions as any)?.[sk];
    return Array.isArray(list) && list.length > 0;
  };
  const resolvedTone: Tone = hasOptions(activeTone) ? activeTone : ((toneOptions.map((t) => t.key).find((k) => hasOptions(k as Tone)) as Tone) || "Real");
  const skey = toneKeyMap[resolvedTone];
  const options: SuggestionOption[] = Array.isArray((deck.suggestions as any)?.[skey]) ? (deck.suggestions as any)[skey] : [];
  const cur = cursor[resolvedTone] || 0;
  const selected = options.length ? options[cur % options.length] : null;

  const handleTogglePick = (bubbleIdx: number, text: string) => {
    const key = `pick-${resolvedTone}-${cur}-${bubbleIdx}`;
    haptics.light();
    setPicked((prev) => {
      if (prev[key]) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: { tone: resolvedTone, variation: cur, text } };
    });
    setPickedCopied(false);
  };

  const handleCopyPicked = async () => {
    if (!pickedItems.length) return;
    const ok = await copyText(pickedItems.map((p) => p.text).join("\n\n"), `picked-${turnId}`);
    if (ok) setPickedCopied(true);
  };

  const optionIdx = options.length ? cur % options.length : 0;

  const feedbackTypeForTone = (tone: Tone): "real" | "smooth" | "playful" | "bold" | "yourStyle" => {
    if (tone === "Your Style") return "yourStyle";
    return tone.toLowerCase() as "real" | "smooth" | "playful" | "bold";
  };

  const handleFeedback = (rating: "helpful" | "off", bubbleIdx: number) => {
    const key = `fb-${resolvedTone}-${cur}-${bubbleIdx}`;
    if (feedbackVotes[key]) return;
    haptics.light();
    setFeedbackVotes((prev) => ({ ...prev, [key]: rating }));
    const suggestionType = feedbackTypeForTone(resolvedTone);
    if (authUser?.uid) {
      saveFeedback(authUser.uid, {
        source: "chat",
        suggestionType,
        rating,
        recommendedAction: deck.summary || "",
      });
    }
    if (userId) {
      void submitFeedback({
        user_id: userId,
        source: "chat",
        suggestion_type: suggestionType,
        rating: rating === "helpful" ? 1 : -1,
        metadata: {
          turnId,
          tone: resolvedTone,
          variation: cur,
          bubble: bubbleIdx,
        },
      }).catch(() => {});
    }
  };

  const quoteActiveOption = (bubbleText?: string, bubbleIdx?: number) => {
    if (!onQuoteBubble || !selected) return;
    haptics.light();
    const toneKey = labelToKey[resolvedTone] || resolvedTone.toLowerCase();
    const label = `${resolvedTone} #${optionIdx + 1}`;
    const fullText = bubbleText || buildCopyPayload(selected);
    onQuoteBubble({
      author: `Kai (${label})`,
      text: fullText.slice(0, 400),
      turnId,
      tone: toneKey,
      optionIndex: optionIdx,
      ...(typeof bubbleIdx === "number" ? { bubbleIndex: bubbleIdx } : {}),
    });
  };

  return (
    <div className="space-y-3">
      <section
        aria-label="Reply options"
        style={{
          backgroundColor: "#FDFAF5",
          border: "1px solid #E8E0D4",
          borderRadius: 20,
          padding: "12px 14px 14px",
          boxShadow: "0 2px 10px rgba(26,18,8,0.04)",
        }}
      >
        <ToneRail
          toneOptions={toneOptions}
          toneHasOptions={hasOptions}
          activeTone={resolvedTone}
          onSelectTone={(k) => { setActiveTone(k); haptics.light(); }}
          showStyleTooltip={showTip}
          onToggleStyleTooltip={(k) => setShowTip((p) => (p ? null : k))}
          scrollFade={toneFade}
        />
        <ReplyHeroCard
          selectedOption={selected}
          optionCount={options.length}
          activeTone={resolvedTone}
          cursor={cur}
          copiedKey={copiedKey}
          prefersReducedMotion={false}
          hideCopyAllBar
          onCopy={(text, key) => void copyText(text, key)}
          onTogglePick={(idx, text) => handleTogglePick(idx, text)}
          pickedKeys={picked}
          onFeedback={handleFeedback}
          feedbackVotes={feedbackVotes}
          onQuoteBubble={onQuoteBubble ? (bubbleText, idx) => quoteActiveOption(bubbleText, idx) : undefined}
          onSelectVariation={(i) => { haptics.light(); setCursor((p) => ({ ...p, [resolvedTone]: i })); }}
          onDragEnd={({ offset, velocity }) => {
            if (options.length <= 1) return;
            const flick = Math.abs(offset.x) > 56 || (Math.abs(offset.x) > 24 && Math.abs(velocity.x) > 500);
            if (!flick) return;
            const dir = offset.x < 0 ? 1 : -1;
            setCursor((p) => ({ ...p, [resolvedTone]: (cur + dir + options.length) % options.length }));
          }}
        />
        <div className="mt-3 pt-2.5 flex items-center gap-2 border-t border-[#E8E0D4]">
          {onQuoteBubble && (
            <button
              type="button"
              onClick={() => quoteActiveOption()}
              className="cursor-pointer inline-flex items-center gap-1.5 transition-colors hover:bg-[#F5E8E0]"
              style={{ height: 38, borderRadius: 10, border: "1px solid #E8E0D4", backgroundColor: "#F5EFE6", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208", padding: "0 13px" }}
            >
              <Reply size={13} strokeWidth={2.2} color="#C8522A" />
              Reply to this
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!selected) return;
              const text = buildCopyPayload(selected);
              void copyText(text, `copyall-${resolvedTone}-${cur}`);
            }}
            className="cursor-pointer inline-flex items-center gap-1.5 transition-colors ml-auto hover:opacity-90"
            style={{
              height: 38,
              borderRadius: 10,
              border: "none",
              backgroundColor: copiedKey === `copyall-${resolvedTone}-${cur}` ? "#58745A" : "#1A1208",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#FFFFFF",
              padding: "0 14px",
            }}
          >
            {copiedKey === `copyall-${resolvedTone}-${cur}` ? <Check size={14} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
            {copiedKey === `copyall-${resolvedTone}-${cur}` ? "Copied" : "Copy reply"}
          </button>
        </div>
      </section>
      <PickedTray
        items={pickedItems}
        copied={pickedCopied}
        onCopyAll={() => void handleCopyPicked()}
        onRemove={(key) => { setPicked((p) => { const n = { ...p }; delete n[key]; return n; }); setPickedCopied(false); }}
        onClear={() => { setPicked({}); setPickedCopied(false); }}
      />
      {deck.summary ? (
        <FriendSummaryCard summary={deck.summary} shouldWait={Boolean(deck.shouldWait)} extractedUnrepliedMessages={deck.extracted || []} />
      ) : null}
      <p className="sr-only" aria-live="off">{TONE_ORDER.join(",")}</p>
      {copyError && !copiedKey && (
        <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", marginTop: 6 }}>{copyError}</p>
      )}
    </div>
  );
}
