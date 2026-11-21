import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowDown, Brain, Check, ChevronLeft, ChevronRight, Copy, ImagePlus, Lock, Menu, Mic, MoreHorizontal, NotebookPen, Pencil, Plus, Reply, Search, SquarePen, Trash2, X } from "lucide-react";
import { useAppContext } from "../app-context";
import {
  abortTurn,
  createThread,
  deleteThread,
  getThread,
  listThreads,
  newThreadId,
  newTurnId,
  renameThread,
  rewindThread,
  updateThreadNote,
  uploadChatImages,
  type ChatThreadSummary,
  type ChatTurnWire,
  type ReplyQuote,
} from "../../services/chatApi";
import { reconcileTurn, sendChatTurn } from "../../services/chatStream";
import { triggerPassiveVoiceLearning } from "../../services/voiceLearningService";
import { ChatComposer, type ComposerAttachment } from "./chat/ChatComposer";
import { ThreadDrawer } from "./chat/ThreadDrawer";
import { ChatReplyCard } from "./quick/ChatReplyCard";
import { R2Image } from "./ui/R2Image";
import { TabBar } from "./TabBar";
import { haptics } from "../utils/haptics";

interface ChatScreenProps {
  incognito?: boolean;
}

type UiTurn = ChatTurnWire & {
  localKey: string;
  failedCode?: string;
  pendingUpload?: ComposerAttachment[];
};

function formatShortTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function SwipeReplyWrap({
  onQuote,
  children,
}: {
  onQuote: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number; active: boolean; locked: boolean; firedHaptic: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || e.button > 0) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    startRef.current = { x: e.clientX, y: e.clientY, active: true, locked: false, firedHaptic: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = startRef.current;
    if (!st || !st.active) return;
    const diffX = e.clientX - st.x;
    const diffY = e.clientY - st.y;
    if (!st.locked) {
      if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
        st.active = false;
        return;
      }
      if (diffX > 10 && diffX > Math.abs(diffY) * 1.25) {
        st.locked = true;
        setDragging(true);
      } else {
        return;
      }
    }
    const clamped = Math.max(0, Math.min(68, diffX * 0.65));
    if (clamped >= 44 && !st.firedHaptic) {
      st.firedHaptic = true;
      haptics.light();
    }
    setDx(clamped);
  };

  const finish = () => {
    const st = startRef.current;
    startRef.current = null;
    if (dx >= 44 && st?.locked) {
      onQuote();
    }
    setDragging(false);
    setDx(0);
  };

  const progress = Math.min(1, dx / 44);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      style={{ position: "relative", touchAction: "pan-y" }}
    >
      {dx > 4 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 2,
            top: "50%",
            transform: `translateY(-50%) scale(${0.7 + progress * 0.35})`,
            opacity: progress,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: progress >= 1 ? "#C8522A" : "#EAD7CA",
            color: progress >= 1 ? "#fff" : "#9E3B1A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Reply size={14} />
        </div>
      )}
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function splitAssistantBubbles(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Lightweight safe inline emphasis (**bold**, *italic*) so markdown symbols don't leak raw. */
function renderInlineText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function AssistantBubbles({
  text,
  hasCard,
  settled,
  createdAt,
  onQuote,
}: {
  text: string;
  hasCard?: boolean;
  settled?: boolean;
  createdAt?: string;
  onQuote?: () => void;
}) {
  const bubbles = splitAssistantBubbles(text);
  const [copied, setCopied] = useState(false);
  if (!bubbles.length) return null;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(bubbles.join("\n\n"));
      setCopied(true);
      haptics.light();
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const ts = formatShortTime(createdAt);

  return (
    <div className="group" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, marginBottom: hasCard ? 12 : 0 }}>
      {bubbles.map((chunk, i) => {
        const isFirst = i === 0;
        const isLast = i === bubbles.length - 1;
        const radius =
          bubbles.length === 1
            ? "18px 18px 18px 5px"
            : isFirst
              ? "18px 18px 18px 6px"
              : isLast
                ? "6px 18px 18px 5px"
                : "6px 18px 18px 6px";
        return (
          <div
            key={i}
            style={{
              maxWidth: "86%",
              width: "fit-content",
              backgroundColor: "#FDFAF5",
              border: "1px solid #E8E0D4",
              borderRadius: radius,
              padding: "10px 14px",
              boxShadow: "0 1px 2px rgba(26,18,8,0.04)",
              overflowWrap: "anywhere",
            }}
          >
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, lineHeight: 1.5, color: "#1A1208", whiteSpace: "pre-wrap", margin: 0 }}>
              {renderInlineText(chunk)}
            </p>
          </div>
        );
      })}
      {settled && !hasCard && (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity mt-0.5">
          <button
            type="button"
            onClick={() => void handleCopyAll()}
            aria-label="Copy reply"
            className="cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[#EFE6DA]"
            style={{ border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: copied ? "#58745A" : "rgba(26,18,8,0.45)" }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {onQuote && (
            <button
              type="button"
              onClick={onQuote}
              aria-label="Reply to Kai"
              className="cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[#EFE6DA]"
              style={{ border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(26,18,8,0.45)" }}
            >
              <Reply size={12} />
              Reply
            </button>
          )}
          {ts && (
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "rgba(26,18,8,0.38)" }}>
              {ts}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TypingDots({ label }: { label?: string }) {
  return (
    <span
      aria-label={label || "Typing"}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "2px 0" }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "rgba(26,18,8,0.4)",
            animation: "rizzbot-dot 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </span>
  );
}

export function ChatScreen({ incognito }: ChatScreenProps) {
  const { threadId: routeThreadId } = useParams();
  const navigate = useNavigate();
  const { authUser, signOut, appSettings, applyLearnedProfile } = useAppContext();
  const isIncognito = Boolean(incognito);

  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [threadsCursor, setThreadsCursor] = useState<string | null>(null);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<ChatThreadSummary | null>(null);
  const [turns, setTurns] = useState<UiTurn[]>([]);
  const [turnsCursor, setTurnsCursor] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const draftBucketKey = isIncognito ? "__incognito__" : routeThreadId || "__new__";
  const draftsByThreadRef = useRef<Record<string, string>>({});
  const [draft, setDraftState] = useState("");
  const setDraft = useCallback((value: string) => {
    draftsByThreadRef.current[draftBucketKey] = value;
    setDraftState(value);
  }, [draftBucketKey]);

  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [skippedNote, setSkippedNote] = useState<string | null>(null);
  const [refine, setRefine] = useState<{ sourceTurnId: string; tone?: string; optionIndex?: number; bubbleIndex?: number; label: string } | null>(null);
  const [quoteReply, setQuoteReply] = useState<ReplyQuote | null>(null);
  const [editingTurnKey, setEditingTurnKey] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [copiedUserKey, setCopiedUserKey] = useState<string | null>(null);
  const [editingThreadNote, setEditingThreadNote] = useState(false);
  const [threadNoteDraft, setThreadNoteDraft] = useState("");

  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [pendingStatusCode, setPendingStatusCode] = useState("");
  const [pendingTurnId, setPendingTurnId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [showJump, setShowJump] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<(() => void) | null>(null);
  const [lightbox, setLightbox] = useState<{ keys: string[]; idx: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | null>(null);
  const dragDepthRef = useRef(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const activeSendInfoRef = useRef<{ threadId?: string; turnId: string; isIncognito: boolean } | null>(null);
  const lastVoiceLearnRef = useRef<number>(0);
  const candidateIds = useRef<{ threadId: string; turnId: string } | null>(null);
  const routeUidRef = useRef<string | null>(null);
  // Prevents navigate(`/chat/${tid}`) after sending the first turn from refetching D1 and wiping the live reply (StrictMode-safe)
  const createdInViewRef = useRef<string | null>(null);
  const activeThreadId = activeThread?.id || (!isIncognito ? routeThreadId || null : null);
  const activeThreadIdRef = useRef<string | null>(null);
  activeThreadIdRef.current = activeThreadId;
  const isDesktop = useIsDesktop();

  const incognitoSession = useRef(`inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);

  const hasContent = turns.length > 0 || draft.trim().length > 0 || attachments.length > 0 || sending;

  // Load thread list (regular only)
  const loadThreads = useCallback(async (cursor?: string | null) => {
    if (isIncognito || !authUser) return;
    setThreadsLoading(true);
    try {
      const res = await listThreads(cursor || undefined);
      setThreads((prev) => (cursor ? [...prev, ...res.threads] : res.threads));
      setThreadsCursor(res.nextCursor);
    } catch { /* keep */ } finally { setThreadsLoading(false); }
  }, [isIncognito, authUser]);

  useEffect(() => {
    if (!isIncognito && authUser) void loadThreads(null);
  }, [isIncognito, authUser, loadThreads]);

  // Restore unfinished draft per thread + auto-focus on desktop thread open
  useEffect(() => {
    setDraftState(draftsByThreadRef.current[draftBucketKey] || "");
    setQuoteReply(null);
    setEditingTurnKey(null);
    setEditingThreadNote(false);
    if (typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [draftBucketKey]);

  // Press `/` on desktop (when not typing in a field) to focus composer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      textareaRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load active thread transcript
  useEffect(() => {
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    if (isIncognito) {
      createdInViewRef.current = null;
      setActiveThread(null);
      setTurns([]);
      setThreadError(null);
      setLoadingThread(false);
      setSending(false);
      setPendingText("");
      setPendingStatusCode("");
      setPendingTurnId(null);
      setRefine(null);
      setSkippedNote(null);
      return;
    }
    const tid = routeThreadId;
    if (!tid) {
      createdInViewRef.current = null;
      setActiveThread(null);
      setTurns([]);
      setTurnsCursor(null);
      setThreadError(null);
      setLoadingThread(false);
      setSending(false);
      setPendingText("");
      setPendingStatusCode("");
      setPendingTurnId(null);
      setRefine(null);
      setSkippedNote(null);
      candidateIds.current = null;
      return;
    }
    // Just created this thread from /chat during an active first-turn send — keep live optimistic/streaming state
    if (createdInViewRef.current === tid) {
      setLoadingThread(false);
      return;
    }
    createdInViewRef.current = null;
    if (!authUser) return;
    let alive = true;
    setSending(false);
    setPendingText("");
    setPendingStatusCode("");
    setPendingTurnId(null);
    setRefine(null);
    setSkippedNote(null);
    setLoadingThread(true);
    setThreadError(null);
    getThread(tid)
      .then((res) => {
        if (!alive) return;
        setActiveThread(res.thread);
        setTurns((res.turns || []).map((t) => ({ ...t, localKey: t.id })));
        setTurnsCursor(res.nextCursor || null);
        requestAnimationFrame(() => scrollToBottom(false));
      })
      .catch((e: any) => {
        if (!alive) return;
        if (e?.message === "not_found") setThreadError("This chat isn’t available.");
        else setThreadError("Couldn’t load this chat.");
      })
      .finally(() => { if (alive) setLoadingThread(false); });
    return () => { alive = false; };
  }, [isIncognito, routeThreadId, authUser]);

  // Clear incognito on unmount
  useEffect(() => () => {
    if (isIncognito) {
      setTurns([]);
      setDraft("");
      setAttachments([]);
    }
  }, [isIncognito]);

  // Discard guard for reload/close while incognito holds content
  useEffect(() => {
    if (!isIncognito || !hasContent) return;
    const onBefore = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [isIncognito, hasContent]);

  // Hide the mobile nav while the software keyboard is open
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      try { setKeyboardOpen(window.innerHeight - vv.height > 150); } catch { /* ignore */ }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Track route uid to disregard late incognito events
  useEffect(() => {
    routeUidRef.current = `${isIncognito ? "inc" : routeThreadId || "new"}:${authUser?.uid || ""}`;
  }, [isIncognito, routeThreadId, authUser?.uid]);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
    } catch { el.scrollTop = el.scrollHeight; }
    followRef.current = true;
    setShowJump(false);
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    followRef.current = nearBottom;
    setShowJump(!nearBottom && turns.length > 0);
  };

  useEffect(() => {
    if (followRef.current) {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }, [turns, pendingText, sending]);

  const guardIncognitoLeave = (fn: () => void) => {
    if (isIncognito && hasContent) setLeaveConfirm(() => fn);
    else fn();
  };

  const executeSend = async (params?: {
    overrideText?: string;
    overrideAttachments?: ComposerAttachment[];
    preservedKeys?: string[];
    overrideQuote?: ReplyQuote | null;
    overrideThreadId?: string;
    clearComposer?: boolean;
  }) => {
    if (sending || preparing) return;
    const text = params?.overrideText ?? draft;
    const localAttachments = params?.overrideAttachments ?? [...attachments];
    const preservedKeys = params?.preservedKeys ?? [];
    const activeQuote = params?.overrideQuote !== undefined ? params.overrideQuote : quoteReply;
    const activeRefine = params?.overrideText !== undefined ? null : refine;
    const clearComposer = params?.clearComposer ?? true;

    if (!text.trim() && localAttachments.length === 0 && preservedKeys.length === 0) return;
    if (text.length > 12_000) { setSkippedNote("Message is over 12,000 characters."); return; }

    const myUid = authUser?.uid || "";
    const myRoute = `${isIncognito ? "inc" : params?.overrideThreadId || routeThreadId || "new"}:${myUid}`;
    const ctrl = new AbortController();
    turnAbortRef.current?.abort();
    turnAbortRef.current = ctrl;

    followRef.current = true;
    setSending(true);
    setPendingText("");
    setPendingStatusCode("thinking");
    setAnnounce("Sending message");

    try {
      if (isIncognito) {
        const prior = turns.slice(-10).flatMap((t) => {
          const arr: Array<{ role: "user" | "assistant"; text: string; replyQuote?: ReplyQuote }> = [];
          if (t.userText) arr.push({ role: "user", text: t.userText, ...(t.replyQuote ? { replyQuote: t.replyQuote } : {}) });
          if (t.assistantText) arr.push({ role: "assistant", text: t.assistantText });
          return arr;
        });
        const turnKey = `local-${Date.now()}`;
        activeSendInfoRef.current = { turnId: turnKey, isIncognito: true };
        const userTurn: UiTurn = {
          id: turnKey,
          localKey: turnKey,
          userText: text,
          attachments: localAttachments.map((a) => a.preview),
          replyQuote: activeQuote || undefined,
          assistantText: "",
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        setTurns((p) => [...p, userTurn]);
        if (clearComposer) {
          setDraft("");
          setAttachments([]);
          setQuoteReply(null);
          setRefine(null);
          setSkippedNote(null);
        }
        const imgs = localAttachments.map((a) => ({ data: a.data, mimeType: a.mimeType }));
        setPendingTurnId(turnKey);
        scrollToBottom(false);
        await sendChatTurn(
          {
            mode: "incognito",
            text,
            images: imgs,
            priorTurns: prior,
            sessionId: incognitoSession.current,
            replyQuote: activeQuote || undefined,
            ref: activeRefine ? { sourceTurnId: activeRefine.sourceTurnId, tone: activeRefine.tone, optionIndex: activeRefine.optionIndex, bubbleIndex: activeRefine.bubbleIndex } : undefined,
            action: activeRefine ? "refine" : undefined,
          },
          {
            signal: ctrl.signal,
            onAccepted: () => { setPendingTurnId(turnKey); },
            onStatus: (c) => { if (routeUidRef.current !== myRoute) return; setPendingStatusCode(c); },
            onDelta: (t) => { if (routeUidRef.current !== myRoute) return; setPendingText((p) => p + t); },
            onDone: (turn) => {
              if (routeUidRef.current !== myRoute) return;
              turnAbortRef.current = null;
              activeSendInfoRef.current = null;
              setTurns((p) => p.map((x) => (x.localKey === turnKey ? { ...x, assistantText: turn.assistantText || "", card: turn.card, status: "complete", id: turn.id || turnKey, createdAt: x.createdAt || new Date().toISOString() } : x)));
              setPendingText("");
              setPendingTurnId(null);
              setSending(false);
              setRefine(null);
              setAnnounce("Reply ready");
              haptics.success();
            },
            onError: (c, m) => {
              if (routeUidRef.current !== myRoute) return;
              turnAbortRef.current = null;
              activeSendInfoRef.current = null;
              setTurns((p) => p.map((x) => (x.localKey === turnKey ? { ...x, status: "failed", failedCode: c } : x)));
              setPendingText("");
              setPendingTurnId(null);
              setSending(false);
              setAnnounce(m);
            },
          }
        );
        return;
      }

      // Regular: candidate IDs for safe retry + immediate optimistic bubble
      const threadId = params?.overrideThreadId || routeThreadId || candidateIds.current?.threadId || newThreadId();
      const turnId = candidateIds.current?.turnId || newTurnId();
      candidateIds.current = { threadId, turnId };
      activeThreadIdRef.current = threadId;
      activeSendInfoRef.current = { threadId, turnId, isIncognito: false };

      const refPayload = activeRefine ? { sourceTurnId: activeRefine.sourceTurnId, tone: activeRefine.tone, optionIndex: activeRefine.optionIndex, bubbleIndex: activeRefine.bubbleIndex } : undefined;
      const actionPayload = activeRefine ? "refine" : undefined;

      const optimisticTurn: UiTurn = {
        id: turnId,
        localKey: turnId,
        threadId,
        userText: text,
        attachments: preservedKeys.length ? preservedKeys : localAttachments.map((a) => a.preview),
        replyQuote: activeQuote || undefined,
        assistantText: "",
        status: "pending",
        ref: refPayload,
        action: actionPayload,
        createdAt: new Date().toISOString(),
      };
      setTurns((p) => [...p, optimisticTurn]);
      if (clearComposer) {
        setDraft("");
        setAttachments([]);
        setQuoteReply(null);
        setRefine(null);
        setSkippedNote(null);
      }
      setPendingTurnId(turnId);
      scrollToBottom(false);

      // Create thread on first send
      if (!routeThreadId && !params?.overrideThreadId) {
        const title = text.trim() ? text.split("\n")[0].trim().slice(0, 56) || "New chat" : "New chat";
        try {
          const created = await createThread({ id: threadId, title, initialText: text });
          setActiveThread(created.thread);
        } catch {
          setTurns((p) => p.map((x) => (x.localKey === turnId ? { ...x, status: "failed", failedCode: "upstream", pendingUpload: localAttachments } : x)));
          setSending(false);
          setPendingTurnId(null);
          turnAbortRef.current = null;
          activeSendInfoRef.current = null;
          setAnnounce("Couldn’t send your message. Try again.");
          setSkippedNote("Couldn’t send your message. Try again.");
          return;
        }
      }

      // Upload images if present
      let keys: string[] = [...preservedKeys];
      if (localAttachments.length) {
        setPreparing(true);
        setPendingStatusCode("uploading");
        try {
          keys = await uploadChatImages(threadId, turnId, localAttachments.map((a) => ({ id: a.id, data: a.data, mimeType: a.mimeType })));
          setTurns((p) => p.map((x) => (x.localKey === turnId ? { ...x, attachments: keys, pendingUpload: undefined } : x)));
        } catch {
          setPreparing(false);
          setSending(false);
          setPendingTurnId(null);
          turnAbortRef.current = null;
          activeSendInfoRef.current = null;
          setTurns((p) => p.map((x) => (x.localKey === turnId ? { ...x, status: "failed", failedCode: "upload", pendingUpload: localAttachments } : x)));
          setAnnounce("Couldn’t upload images. Tap retry on the message.");
          return;
        }
        setPreparing(false);
        setPendingStatusCode("thinking");

        // Intelligent passive voice learning: only on screenshot turns, when enabled, with a 3-min session cooldown
        if (appSettings.autoLearnVoice && Date.now() - lastVoiceLearnRef.current > 3 * 60 * 1000) {
          lastVoiceLearnRef.current = Date.now();
          void triggerPassiveVoiceLearning(
            localAttachments.slice(0, 6) as any,
            (prof) => applyLearnedProfile(prof)
          );
        }
      }

      await sendChatTurn(
        { mode: "regular", threadId, turnId, text, attachmentKeys: keys, ref: refPayload, replyQuote: activeQuote || undefined, action: actionPayload },
        {
          signal: ctrl.signal,
          onAccepted: () => {
            if (!routeThreadId && !params?.overrideThreadId) {
              createdInViewRef.current = threadId;
              navigate(`/chat/${threadId}`, { replace: true });
            }
            candidateIds.current = null;
          },
          onStatus: (c) => { if (activeThreadIdRef.current !== threadId) return; setPendingStatusCode(c); },
          onDelta: (t) => { if (activeThreadIdRef.current !== threadId) return; setPendingText((p) => p + t); },
          onDone: (turn, updatedTitle) => {
            if (activeThreadIdRef.current !== threadId) return;
            turnAbortRef.current = null;
            activeSendInfoRef.current = null;
            setTurns((p) => {
              const found = p.some((x) => x.localKey === turnId);
              if (!found) {
                return [...p, { id: turn.id || turnId, localKey: turnId, threadId, userText: turn.userText ?? text, attachments: turn.attachments ?? keys, replyQuote: turn.replyQuote ?? (activeQuote || undefined), assistantText: turn.assistantText || "", card: turn.card, status: "complete", attempt: turn.attempt, createdAt: new Date().toISOString() }];
              }
              return p.map((x) => (x.localKey === turnId ? { ...x, userText: turn.userText ?? text, attachments: turn.attachments ?? keys, replyQuote: turn.replyQuote ?? x.replyQuote, assistantText: turn.assistantText || "", card: turn.card, status: "complete", attempt: turn.attempt, pendingUpload: undefined } : x));
            });
            if (updatedTitle) {
              setActiveThread((a) => (a && a.id === threadId ? { ...a, title: updatedTitle } : a));
              setThreads((p) => p.map((th) => (th.id === threadId ? { ...th, title: updatedTitle } : th)));
            }
            setPendingText("");
            setPendingTurnId(null);
            setSending(false);
            setRefine(null);
            setAnnounce("Reply ready");
            haptics.success();
            void loadThreads(null).catch(() => {});
          },
          onError: (code, message) => {
            if (activeThreadIdRef.current !== threadId) return;
            turnAbortRef.current = null;
            activeSendInfoRef.current = null;
            setPendingText("");
            setSending(false);
            setAnnounce(message);
            if (code === "active") {
              setPendingStatusCode("checking");
              return;
            }
            setTurns((p) => p.map((x) => (x.localKey === turnId ? { ...x, status: "failed", failedCode: code } : x)));
            setPendingTurnId(null);
          },
        }
      );
    } catch {
      const aborted = ctrl.signal.aborted;
      turnAbortRef.current = null;
      activeSendInfoRef.current = null;
      setSending(false);
      setPreparing(false);
      setPendingText("");
      setPendingTurnId(null);
      if (aborted) {
        setTurns((p) => p.map((x) => (x.status === "pending" ? { ...x, status: "failed", failedCode: "aborted" } : x)));
        setAnnounce("Stopped.");
      } else {
        setAnnounce("Couldn’t finish that reply.");
      }
    }
  };

  const doSend = () => executeSend();

  const handleStop = () => {
    const info = activeSendInfoRef.current;
    turnAbortRef.current?.abort();
    turnAbortRef.current = null;
    activeSendInfoRef.current = null;
    setSending(false);
    setPreparing(false);
    setPendingText("");
    setPendingTurnId(null);
    setAnnounce("Stopped.");
    if (info && !info.isIncognito && info.threadId && info.turnId) {
      setTurns((p) => p.map((x) => (x.localKey === info.turnId || x.id === info.turnId ? { ...x, status: "failed", failedCode: "aborted" } : x)));
      void abortTurn(info.threadId, info.turnId).catch(() => {});
    } else {
      setTurns((p) => p.map((x) => (x.status === "pending" ? { ...x, status: "failed", failedCode: "aborted" } : x)));
    }
  };

  const handleSaveEdit = async (turn: UiTurn, idx: number) => {
    const nextText = editingDraft.trim();
    if (!nextText && turn.attachments.length === 0) return;
    if (sending || preparing) return;
    setEditingTurnKey(null);
    setEditingDraft("");
    const r2Keys = turn.attachments.filter((a) => a.startsWith("r2:") || a.startsWith("chat/"));
    if (isIncognito) {
      setTurns((p) => p.slice(0, idx));
      await executeSend({
        overrideText: nextText,
        overrideAttachments: [],
        overrideQuote: turn.replyQuote || null,
        clearComposer: false,
      });
      return;
    }
    const tid = activeThreadId;
    if (!tid) return;
    try {
      await rewindThread(tid, turn.id, { keepAnchorMedia: r2Keys.length > 0 });
      setTurns((p) => p.slice(0, idx));
      candidateIds.current = null;
      await executeSend({
        overrideText: nextText,
        overrideAttachments: [],
        preservedKeys: r2Keys,
        overrideQuote: turn.replyQuote || null,
        overrideThreadId: tid,
        clearComposer: false,
      });
    } catch {
      setSkippedNote("Couldn’t edit that message. Try again.");
    }
  };

  const retryTurn = async (turn: UiTurn) => {
    const latestFailed = turns.at(-1);
    if (latestFailed?.status === "failed" && latestFailed.localKey === turn.localKey && !isIncognito) {
      const tid = activeThreadId;
      if (!tid) return;
      const ctrl = new AbortController();
      turnAbortRef.current?.abort();
      turnAbortRef.current = ctrl;
      activeSendInfoRef.current = { threadId: tid, turnId: turn.id, isIncognito: false };
      setSending(true);
      setPendingText("");
      setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, status: "pending" } : x)));
      setPendingTurnId(turn.id);

      let keys = turn.attachments.filter((a) => a.startsWith("r2:") || a.startsWith("chat/"));
      if (turn.pendingUpload?.length) {
        setPreparing(true);
        setPendingStatusCode("uploading");
        try {
          keys = await uploadChatImages(tid, turn.id, turn.pendingUpload.map((a) => ({ id: a.id, data: a.data, mimeType: a.mimeType })));
          setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, attachments: keys, pendingUpload: undefined } : x)));
        } catch {
          setPreparing(false);
          setSending(false);
          setPendingTurnId(null);
          turnAbortRef.current = null;
          activeSendInfoRef.current = null;
          setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, status: "failed", failedCode: "upload" } : x)));
          return;
        }
        setPreparing(false);
      }

      setPendingStatusCode("thinking");
      try {
        await sendChatTurn(
          { mode: "regular", threadId: tid, turnId: turn.id, text: turn.userText, attachmentKeys: keys, ref: turn.ref, replyQuote: turn.replyQuote, action: turn.action },
          {
            signal: ctrl.signal,
            onStatus: (c) => { if (activeThreadIdRef.current !== tid) return; setPendingStatusCode(c); },
            onDelta: (t) => { if (activeThreadIdRef.current !== tid) return; setPendingText((p) => p + t); },
            onDone: (done, updatedTitle) => {
              if (activeThreadIdRef.current !== tid) return;
              turnAbortRef.current = null;
              activeSendInfoRef.current = null;
              setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, assistantText: done.assistantText || "", card: done.card, status: "complete", pendingUpload: undefined } : x)));
              if (updatedTitle) {
                setActiveThread((a) => (a && a.id === tid ? { ...a, title: updatedTitle } : a));
                setThreads((p) => p.map((th) => (th.id === tid ? { ...th, title: updatedTitle } : th)));
              }
              setPendingText(""); setSending(false); setPendingTurnId(null); setAnnounce("Reply ready");
              haptics.success();
            },
            onError: (code, message) => {
              if (activeThreadIdRef.current !== tid) return;
              turnAbortRef.current = null;
              activeSendInfoRef.current = null;
              setSending(false); setPendingText(""); setPendingTurnId(null);
              setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, status: "failed", failedCode: code } : x)));
              setAnnounce(message);
            },
          }
        );
      } catch {
        turnAbortRef.current = null;
        activeSendInfoRef.current = null;
        setSending(false); setPendingText(""); setPendingTurnId(null);
        setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, status: "failed", failedCode: ctrl.signal.aborted ? "aborted" : "upstream" } : x)));
      }
    } else {
      if (!draft) setDraft(turn.userText);
      textareaRef.current?.focus();
    }
  };

  const reconcilePending = async () => {
    if (!pendingTurnId || isIncognito || !activeThreadId) return;
    setPendingStatusCode("checking");
    const saved = await reconcileTurn(activeThreadId, pendingTurnId);
    if (saved) {
      if (saved.status === "complete") {
        setTurns((p) => p.map((x) => (x.localKey === pendingTurnId ? { ...x, assistantText: saved.assistantText || "", card: saved.card, status: "complete" } : x)));
        setPendingText(""); setSending(false); setPendingTurnId(null); setAnnounce("Reply ready");
      } else if (saved.status === "pending") {
        setPendingStatusCode("checking");
      } else {
        setTurns((p) => p.map((x) => (x.localKey === pendingTurnId ? { ...x, status: "failed", failedCode: "upstream" } : x)));
        setPendingText(""); setSending(false); setPendingTurnId(null);
      }
    } else {
      setTurns((p) => p.map((x) => (x.localKey === pendingTurnId ? { ...x, status: "failed", failedCode: "upstream" } : x)));
      setPendingText(""); setSending(false); setPendingTurnId(null);
    }
  };

  const title = useMemo(() => {
    if (isIncognito) return "Incognito";
    if (activeThread?.title) return activeThread.title;
    return "New chat";
  }, [isIncognito, activeThread]);

  const starters = [
    { label: "Decode what she meant", prompt: "Can you help me read what's going on here? " },
    { label: "Help me write a reply", prompt: "What should I text back here?" },
    { label: "She's been pulling back", prompt: "Someone I'm talking to has been pulling back lately — " },
  ];

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) setDroppedFiles(files);
  };

  return (
    <div
      className="chat-shell"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: "relative", height: "100dvh", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "minmax(0, 1fr)", backgroundColor: "#F5EFE6", paddingTop: "env(safe-area-inset-top)", paddingBottom: 0, paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
    >
      {dragActive && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed", inset: 12, zIndex: 85, borderRadius: 24,
            backgroundColor: "rgba(253, 250, 245, 0.92)",
            border: "2px dashed #C8522A",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
            pointerEvents: "none",
          }}
        >
          <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "#F5E8E0", display: "flex", alignItems: "center", justifyContent: "center", color: "#C8522A" }}>
            <ImagePlus size={26} />
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208", margin: 0 }}>Drop screenshots to attach</p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.55)", margin: 0 }}>PNG, JPEG, or WebP (up to 10 images)</p>
        </div>
      )}
      <style>{`
        @keyframes rizzbot-dot { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 0.9; transform: translateY(-2px); } }
        @keyframes rizzbot-msg-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <h1 className="sr-only">Chat</h1>
      <div aria-live="polite" className="sr-only">{announce}</div>

      <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
        {isDesktop && !isIncognito && (
          <aside aria-label="Saved chats" style={{ flex: "0 0 256px", minWidth: 0, borderRight: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <DesktopThreadList
              threads={threads} activeId={activeThreadId} hasMore={Boolean(threadsCursor)}
              onLoadMore={() => void loadThreads(threadsCursor)} loading={threadsLoading}
              onOpen={(id) => guardIncognitoLeave(() => navigate(`/chat/${id}`))}
              onNew={() => guardIncognitoLeave(() => navigate("/chat"))}
              onNewIncognito={() => navigate("/chat/incognito")}
              onRename={async (id, t) => { await renameThread(id, t); await loadThreads(null); if (activeThread?.id === id) setActiveThread((a) => (a ? { ...a, title: t } : a)); }}
              onDelete={async (id) => {
                setDeletingId(id);
                try {
                  await deleteThread(id);
                  setThreads((p) => p.filter((x) => x.id !== id));
                  if (activeThreadId === id) navigate("/chat");
                } finally {
                  setDeletingId(null);
                }
              }}
              deletingId={deletingId}
            />
          </aside>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <header style={{ position: "relative", minHeight: "calc(56px + env(safe-area-inset-top))", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderBottom: "1px solid #E8E0D4", backgroundColor: "#F5EFE6", maxWidth: isDesktop ? 720 : undefined, width: "100%", margin: isDesktop ? "0 auto" : undefined }}>
            {!isDesktop && (
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open chats" className="cursor-pointer flex items-center justify-center rounded-xl transition-colors hover:bg-[#EFE6DA]" style={{ width: 42, height: 42, border: "none", background: "none", color: "#1A1208" }}>
                <Menu size={20} />
              </button>
            )}
            {isIncognito ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4" }}>
                  <Lock size={13} color="#A8401C" aria-hidden="true" />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#1A1208" }} aria-describedby="incognito-desc">Incognito</span>
                </span>
                <span className="flex-1" />
                <span id="incognito-desc" className="sr-only">Uses saved memory. This chat won’t be saved.</span>
                <button type="button" onClick={() => guardIncognitoLeave(() => navigate("/chat"))} aria-label="Close incognito chat" className="cursor-pointer transition-colors hover:bg-[#EFE6DA]" style={{ height: 40, padding: "0 14px", borderRadius: 12, border: "1px solid #E8E0D4", background: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>
                  Close
                </button>
              </>
            ) : (
              <>
                <span className="truncate" title={title} style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>{title}</span>
                {!isDesktop && activeThreadId && (
                  <button
                    type="button"
                    onClick={() => navigate("/chat")}
                    aria-label="New chat"
                    className="cursor-pointer flex items-center justify-center rounded-xl transition-colors hover:bg-[#EFE6DA]"
                    style={{ width: 42, height: 42, border: "none", background: "none", color: "#1A1208" }}
                  >
                    <SquarePen size={18} />
                  </button>
                )}
                {activeThreadId && (
                  <ThreadOverflowMenu
                    onRename={async (t) => {
                      if (activeThreadId) {
                        await renameThread(activeThreadId, t);
                        setActiveThread((a) => (a ? { ...a, title: t } : a));
                        void loadThreads(null);
                      }
                    }}
                    onOpenNote={() => {
                      setThreadNoteDraft(activeThread?.context_note || "");
                      setEditingThreadNote(true);
                    }}
                    onDelete={async () => { if (activeThreadId) { await deleteThread(activeThreadId); navigate("/chat"); } }}
                    currentTitle={title}
                  />
                )}
              </>
            )}
          </header>

          {!isIncognito && activeThread?.context_note?.trim() && (
            <div style={{ borderBottom: "1px solid #EAE0D2", backgroundColor: "#FBF7F0", padding: "6px 16px" }}>
              <button
                type="button"
                onClick={() => {
                  setThreadNoteDraft(activeThread.context_note || "");
                  setEditingThreadNote(true);
                }}
                title="Edit thread note"
                className="cursor-pointer w-full flex items-center gap-2 text-left max-w-[680px] mx-auto hover:opacity-80"
                style={{ background: "none", border: "none", padding: 0 }}
              >
                <NotebookPen size={13} color="#C8522A" className="shrink-0" />
                <span className="truncate" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.68)" }}>
                  <strong style={{ fontWeight: 600, color: "#9E3B1A" }}>Note:</strong> {activeThread.context_note}
                </span>
              </button>
            </div>
          )}

          <div ref={scrollRef} onScroll={onScroll} role="log" aria-label="Conversation" style={{ flex: 1, overflowY: "auto", padding: isDesktop ? "18px 24px" : "14px 16px", maxWidth: isDesktop ? 720 : undefined, width: "100%", margin: isDesktop ? "0 auto" : undefined }}>
            {threadError ? (
              <div style={{ backgroundColor: "#FDFAF5", borderRadius: 16, border: "1px solid #E8E0D4", padding: 20, textAlign: "center" }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>{threadError}</p>
                <div className="flex gap-2 justify-center mt-3">
                  <button type="button" onClick={() => window.location.reload()} className="cursor-pointer" style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Retry</button>
                  <button type="button" onClick={() => navigate("/chat")} className="cursor-pointer" style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>Back to chats</button>
                </div>
              </div>
            ) : loadingThread ? (
              <div className="flex flex-col gap-3 pt-4">
                <div className="self-end h-10 w-44 rounded-2xl bg-[#EFE6DA] animate-pulse" />
                <div className="self-start h-16 w-64 rounded-2xl bg-[#FDFAF5] border border-[#E8E0D4] animate-pulse" />
              </div>
            ) : turns.length === 0 && !sending ? (
              <div style={{ paddingTop: 44, paddingBottom: 24, textAlign: "center" }}>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                  style={{
                    backgroundColor: "#F5E8E0",
                    border: "1px solid #EAD7CA",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#9E3B1A",
                  }}
                >
                  {isIncognito ? "Kai · Off the record" : "Kai · 23"}
                </span>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isDesktop ? 40 : 35, fontWeight: 700, color: "#1A1208", lineHeight: 1.08 }}>
                  Hey, I’m Kai.
                </h2>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", marginTop: 8, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                  {isIncognito
                    ? "Off the record — I still know your saved context, but nothing in this chat gets saved."
                    : "Drop screenshots, send a voice note, or vent about someone. I’ll tell you what’s really going on and help you text back."}
                </p>
                {isIncognito && (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.45)", marginTop: 6 }}>
                    When Kai replies, message content is processed with zero-data retention where supported.
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {starters.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setDraft(s.prompt);
                        requestAnimationFrame(() => textareaRef.current?.focus());
                      }}
                      className="cursor-pointer transition-all hover:bg-[#F5E8E0] hover:border-[#C8522A]/40 active:scale-95"
                      style={{
                        borderRadius: 999,
                        padding: "9px 15px",
                        border: "1px solid #E8E0D4",
                        backgroundColor: "#FDFAF5",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1A1208",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {turnsCursor && (
                  <button type="button" onClick={() => activeThreadId && getThread(activeThreadId, { cursor: turnsCursor }).then((r) => { setTurns((p) => [...(r.turns || []).map((t) => ({ ...t, localKey: t.id })), ...p]); setTurnsCursor(r.nextCursor || null); })} className="cursor-pointer w-full mb-3 transition-colors hover:bg-[#EFE6DA]" style={{ height: 40, borderRadius: 12, border: "1px solid #E8E0D4", background: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)" }}>
                    Load older messages
                  </button>
                )}
                {turns.map((t, turnIdx) => {
                  const isEditingThis = editingTurnKey === t.localKey;
                  const userTs = formatShortTime(t.createdAt);
                  const quoteUser = () => {
                    const snippet = t.userText.trim() || (t.attachments.length ? `Screenshot${t.attachments.length > 1 ? "s" : ""}` : "");
                    if (!snippet) return;
                    setQuoteReply({ author: "You", text: snippet.slice(0, 400), turnId: t.id });
                    textareaRef.current?.focus();
                  };
                  const quoteAssistant = () => {
                    const firstText = t.assistantText.trim();
                    if (!firstText) return;
                    setQuoteReply({ author: "Kai", text: firstText.slice(0, 400), turnId: t.id });
                    textareaRef.current?.focus();
                  };
                  const snapOnImageLoad = () => {
                    if (followRef.current && scrollRef.current) {
                      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                  };
                  return (
                    <article key={t.localKey} style={{ marginBottom: 22, animation: "rizzbot-msg-in 180ms ease-out" }}>
                      {isEditingThis ? (
                        <div className="flex justify-end mb-2.5">
                          <div
                            style={{
                              width: "min(92%, 480px)",
                              backgroundColor: "#FDFAF5",
                              border: "1.5px solid #C8522A",
                              borderRadius: 18,
                              padding: 12,
                              boxShadow: "0 4px 16px rgba(26,18,8,0.08)",
                            }}
                          >
                            <textarea
                              autoFocus
                              value={editingDraft}
                              onChange={(e) => setEditingDraft(e.target.value)}
                              rows={3}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") { setEditingTurnKey(null); setEditingDraft(""); }
                              }}
                              style={{
                                width: "100%",
                                border: "none",
                                outline: "none",
                                resize: "vertical",
                                background: "transparent",
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: 15,
                                lineHeight: 1.5,
                                color: "#1A1208",
                              }}
                            />
                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#E8E0D4]">
                              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, color: "rgba(26,18,8,0.5)" }}>
                                Resending rewinds chat to here
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => { setEditingTurnKey(null); setEditingDraft(""); }}
                                  className="cursor-pointer px-3 py-1.5 rounded-full text-xs font-semibold"
                                  style={{ border: "1px solid #E8E0D4", background: "transparent", color: "#1A1208" }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveEdit(t, turnIdx)}
                                  className="cursor-pointer px-3.5 py-1.5 rounded-full text-xs font-semibold text-white"
                                  style={{ border: "none", backgroundColor: "#A8401C" }}
                                >
                                  Save &amp; resend
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <SwipeReplyWrap onQuote={quoteUser}>
                          <div className="group flex flex-col items-end mb-2.5">
                            <div style={{ maxWidth: "85%", width: "fit-content", backgroundColor: "#F5E8E0", border: "1px solid #EAD7CA", borderRadius: "18px 18px 5px 18px", padding: t.userText || t.replyQuote ? "10px 14px" : "6px", overflowWrap: "anywhere", boxShadow: "0 1px 2px rgba(26,18,8,0.03)" }}>
                              {t.replyQuote && (
                                <div
                                  className="mb-2 px-2.5 py-1.5 rounded-xl"
                                  style={{
                                    backgroundColor: "rgba(253, 250, 245, 0.72)",
                                    borderLeft: "2.5px solid #C8522A",
                                  }}
                                >
                                  <p className="truncate" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#9E3B1A", margin: 0 }}>
                                    {t.replyQuote.author}
                                  </p>
                                  <p className="truncate" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.7)", margin: 0 }}>
                                    {t.replyQuote.text}
                                  </p>
                                </div>
                              )}
                              {t.attachments.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: t.userText ? 6 : 0 }}>
                                  {t.attachments.map((k, i) => (
                                    <ChatImage
                                      key={`${t.localKey}-${i}`}
                                      srcOrKey={k}
                                      index={i}
                                      total={t.attachments.length}
                                      onImageLoad={snapOnImageLoad}
                                      onOpen={() => setLightbox({ keys: t.attachments, idx: i })}
                                    />
                                  ))}
                                </div>
                              )}
                              {t.userText ? <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, lineHeight: 1.5, color: "#1A1208", whiteSpace: "pre-wrap", margin: 0 }}>{t.userText}</p> : null}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity mt-0.5 pr-1">
                              {userTs && (
                                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "rgba(26,18,8,0.38)" }}>
                                  {userTs}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={quoteUser}
                                aria-label="Reply to your message"
                                className="cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[#EFE6DA]"
                                style={{ border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(26,18,8,0.48)" }}
                              >
                                <Reply size={11} />
                                Reply
                              </button>
                              {t.userText && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(t.userText).then(() => {
                                      setCopiedUserKey(t.localKey);
                                      haptics.light();
                                      setTimeout(() => setCopiedUserKey((c) => (c === t.localKey ? null : c)), 1400);
                                    }).catch(() => {});
                                  }}
                                  aria-label="Copy your message"
                                  className="cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[#EFE6DA]"
                                  style={{ border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: copiedUserKey === t.localKey ? "#58745A" : "rgba(26,18,8,0.48)" }}
                                >
                                  {copiedUserKey === t.localKey ? <Check size={11} /> : <Copy size={11} />}
                                  {copiedUserKey === t.localKey ? "Copied" : "Copy"}
                                </button>
                              )}
                              {!sending && t.status !== "pending" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTurnKey(t.localKey);
                                    setEditingDraft(t.userText);
                                  }}
                                  aria-label="Edit and rewind to here"
                                  className="cursor-pointer flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[#EFE6DA]"
                                  style={{ border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(26,18,8,0.48)" }}
                                >
                                  <Pencil size={11} />
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                        </SwipeReplyWrap>
                      )}
                      {t.status === "failed" ? (
                        <div style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 16, padding: "12px 14px", maxWidth: "85%" }}>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}>
                            {t.failedCode === "allowance"
                              ? "Chat is at its usage limit. Try again later."
                              : t.failedCode === "aborted"
                                ? "Stopped."
                                : t.failedCode === "upload"
                                  ? "Couldn’t upload those images."
                                  : "Couldn’t finish that reply."}
                          </p>
                          <div className="flex gap-2 mt-2">
                            {turns[turns.length - 1]?.localKey === t.localKey ? (
                              <button type="button" onClick={() => void retryTurn(t)} className="cursor-pointer" style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>Retry</button>
                            ) : (
                              <button type="button" onClick={() => void retryTurn(t)} className="cursor-pointer" style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #E8E0D4", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>Send again</button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ maxWidth: "65ch" }}>
                          {t.assistantText ? (
                            <SwipeReplyWrap onQuote={quoteAssistant}>
                              <AssistantBubbles
                                text={t.assistantText}
                                hasCard={Boolean(t.card)}
                                settled={t.status === "complete"}
                                createdAt={t.createdAt}
                                onQuote={quoteAssistant}
                              />
                            </SwipeReplyWrap>
                          ) : null}
                          {t.card ? (
                            <ChatReplyCard
                              turnId={t.id}
                              card={t.card}
                              onQuoteBubble={(q) => {
                                setQuoteReply(q);
                                textareaRef.current?.focus();
                              }}
                              onRefine={(r) => {
                                setRefine(r);
                                textareaRef.current?.focus();
                                haptics.light();
                              }}
                            />
                          ) : null}
                        </div>
                      )}
                    </article>
                  );
                })}
                {(sending || pendingText) && (
                  <article aria-label="Assistant is responding" style={{ marginBottom: 22, maxWidth: "65ch" }}>
                    {pendingText ? (
                      <AssistantBubbles text={pendingText} />
                    ) : null}
                    {sending && (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          marginTop: pendingText ? 6 : 0,
                          backgroundColor: "#FDFAF5",
                          border: "1px solid #E8E0D4",
                          borderRadius: "18px 18px 18px 5px",
                          padding: "8px 14px",
                          boxShadow: "0 1px 2px rgba(26,18,8,0.04)",
                        }}
                      >
                        <TypingDots label={pendingStatusCode || "typing"} />
                        {pendingStatusCode === "uploading" && (
                          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.55)" }}>Uploading…</span>
                        )}
                      </div>
                    )}
                    {pendingStatusCode === "checking" && (
                      <button type="button" onClick={() => void reconcilePending()} className="cursor-pointer mt-2" style={{ height: 40, padding: "0 16px", borderRadius: 12, border: "1px solid #E8E0D4", background: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>
                        Check again
                      </button>
                    )}
                  </article>
                )}
              </div>
            )}
            {showJump && (
              <button type="button" onClick={() => scrollToBottom()} className="cursor-pointer inline-flex items-center gap-1.5 transition-transform hover:scale-105" style={{ position: "sticky", bottom: 8, marginLeft: "auto", height: 40, padding: "0 14px", borderRadius: 999, border: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208", boxShadow: "0 4px 16px rgba(26,18,8,0.12)" }}>
                <ArrowDown size={14} /> Latest
              </button>
            )}
          </div>

          <div style={{ maxWidth: isDesktop ? 720 : undefined, width: "100%", margin: isDesktop ? "0 auto" : undefined, padding: isDesktop ? "8px 24px calc(8px + env(safe-area-inset-bottom))" : "8px 16px calc(8px + env(safe-area-inset-bottom))" }}>
            <ChatComposer
              draft={draft}
              onDraftChange={setDraft}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              sending={sending}
              preparing={preparing}
              onSend={() => void doSend()}
              onStop={handleStop}
              quoteReply={quoteReply}
              onClearQuote={() => setQuoteReply(null)}
              refineLabel={refine?.label || null}
              onClearRefine={() => setRefine(null)}
              textareaRef={textareaRef}
              skippedNote={skippedNote}
              onSkippedNoteChange={setSkippedNote}
              droppedFiles={droppedFiles}
              onDroppedFilesHandled={() => setDroppedFiles(null)}
            />
          </div>
          {!isDesktop && !keyboardOpen && <TabBar embedded />}
        </div>
      </div>

      {!isDesktop && (
        <ThreadDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          threads={threads}
          activeId={activeThreadId}
          hasMore={Boolean(threadsCursor)}
          onLoadMore={() => void loadThreads(threadsCursor)}
          loading={threadsLoading}
          onOpenThread={(id) => { setDrawerOpen(false); guardIncognitoLeave(() => navigate(`/chat/${id}`)); }}
          onNewChat={() => { setDrawerOpen(false); guardIncognitoLeave(() => navigate("/chat")); }}
          onNewIncognito={() => { setDrawerOpen(false); navigate("/chat/incognito"); }}
          onRename={async (id, t) => { await renameThread(id, t); await loadThreads(null); if (activeThread?.id === id) setActiveThread((a) => (a ? { ...a, title: t } : a)); }}
          onDelete={async (id) => {
            setDeletingId(id);
            try {
              await deleteThread(id);
              setThreads((p) => p.filter((x) => x.id !== id));
              if (activeThreadId === id) navigate("/chat");
            } finally {
              setDeletingId(null);
            }
          }}
          deletingId={deletingId}
        />
      )}

      {editingThreadNote && activeThreadId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 92, backgroundColor: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setEditingThreadNote(false)}>
          <div role="dialog" aria-modal="true" aria-label="Thread context note" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") setEditingThreadNote(false); }} style={{ width: "100%", maxWidth: 400, backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>Thread note</h3>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.58)", marginTop: 4 }}>
              Persistent background context just for this chat (e.g., who she is, your goal).
            </p>
            <textarea
              autoFocus
              rows={4}
              maxLength={500}
              value={threadNoteDraft}
              onChange={(e) => setThreadNoteDraft(e.target.value)}
              placeholder="e.g., Met Maya on Hinge last Friday, she works nights as a nurse…"
              style={{ width: "100%", marginTop: 12, borderRadius: 12, border: "1px solid #E8E0D4", padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", backgroundColor: "#fff", resize: "vertical" }}
            />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setEditingThreadNote(false)} className="cursor-pointer flex-1" style={{ height: 44, borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  const trimmed = threadNoteDraft.trim().slice(0, 500);
                  try {
                    const updated = await updateThreadNote(activeThreadId, trimmed);
                    setActiveThread(updated.thread);
                    setThreads((p) => p.map((th) => (th.id === activeThreadId ? { ...th, context_note: updated.thread.context_note } : th)));
                    setEditingThreadNote(false);
                    haptics.success();
                  } catch {
                    setSkippedNote("Couldn’t save thread note. Try again.");
                  }
                }}
                className="cursor-pointer flex-1" style={{ height: 44, borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {leaveConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, backgroundColor: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setLeaveConfirm(null)}>
          <div role="dialog" aria-modal="true" aria-label="Leave incognito chat" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") setLeaveConfirm(null); }} style={{ width: "100%", maxWidth: 380, backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>Leave incognito chat?</h3>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", marginTop: 8 }}>This chat won’t be saved. Leaving discards it.</p>
            <div className="flex gap-2 mt-4">
              <button type="button" autoFocus onClick={() => setLeaveConfirm(null)} className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>Stay</button>
              <button type="button" onClick={() => { const fn = leaveConfirm; setLeaveConfirm(null); fn(); }} className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Leave chat</button>
            </div>
          </div>
        </div>
      )}

      {lightbox && lightbox.keys[lightbox.idx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image ${lightbox.idx + 1} of ${lightbox.keys.length}`}
          style={{ position: "fixed", inset: 0, zIndex: 95, backgroundColor: "rgba(26,18,8,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightbox(null);
            if (e.key === "ArrowRight" && lightbox.idx < lightbox.keys.length - 1) setLightbox({ ...lightbox, idx: lightbox.idx + 1 });
            if (e.key === "ArrowLeft" && lightbox.idx > 0) setLightbox({ ...lightbox, idx: lightbox.idx - 1 });
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "92vw", backgroundColor: "#FDFAF5", borderRadius: 18, padding: 12 }}>
            <div className="relative flex items-center justify-center">
              {lightbox.keys.length > 1 && lightbox.idx > 0 && (
                <button
                  type="button"
                  onClick={() => setLightbox({ ...lightbox, idx: lightbox.idx - 1 })}
                  aria-label="Previous image"
                  className="cursor-pointer flex items-center justify-center rounded-full"
                  style={{ position: "absolute", left: 8, zIndex: 2, width: 38, height: 38, backgroundColor: "rgba(26,18,8,0.68)", color: "#fff", border: "none" }}
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <R2Image srcOrKey={lightbox.keys[lightbox.idx]} alt={`Chat screenshot ${lightbox.idx + 1}`} style={{ maxWidth: "100%", maxHeight: "72vh", objectFit: "contain", borderRadius: 12 }} />
              {lightbox.keys.length > 1 && lightbox.idx < lightbox.keys.length - 1 && (
                <button
                  type="button"
                  onClick={() => setLightbox({ ...lightbox, idx: lightbox.idx + 1 })}
                  aria-label="Next image"
                  className="cursor-pointer flex items-center justify-center rounded-full"
                  style={{ position: "absolute", right: 8, zIndex: 2, width: 38, height: 38, backgroundColor: "rgba(26,18,8,0.68)", color: "#fff", border: "none" }}
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 mt-2.5">
              {lightbox.keys.length > 1 ? (
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, fontWeight: 600, color: "rgba(26,18,8,0.6)", paddingLeft: 4 }}>
                  {lightbox.idx + 1} / {lightbox.keys.length}
                </span>
              ) : <span />}
              <button type="button" onClick={() => setLightbox(null)} className="cursor-pointer px-6" style={{ height: 40, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 600 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function useIsDesktop(): boolean {
  const [v, setV] = useState(() => typeof window !== "undefined" && window.innerWidth >= 900);
  useEffect(() => {
    const onResize = () => setV(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return v;
}

function ChatImage({ srcOrKey, index, total, onOpen, onImageLoad }: { srcOrKey: string; index: number; total: number; onOpen: () => void; onImageLoad?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed || !srcOrKey) {
    return (
      <div style={{ width: 120, height: 90, borderRadius: 10, border: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.5)" }}>
        Image {index + 1} unavailable
      </div>
    );
  }
  if (srcOrKey.startsWith("data:") || srcOrKey.startsWith("blob:") || srcOrKey.startsWith("http")) {
    return (
      <button type="button" onClick={onOpen} aria-label={`Open image ${index + 1} of ${total}`} className="cursor-pointer" style={{ background: "none", border: "none", padding: 0 }}>
        <img src={srcOrKey} alt={`Screenshot ${index + 1}`} onLoad={onImageLoad} onError={() => setFailed(true)} style={{ width: 120, height: 90, borderRadius: 10, objectFit: "cover", border: "1px solid #E8E0D4" }} />
      </button>
    );
  }
  return (
    <div onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }} role="button" tabIndex={0} aria-label={`Open image ${index + 1} of ${total}`} style={{ cursor: "pointer" }}>
      <R2Image srcOrKey={srcOrKey} alt={`Screenshot ${index + 1}`} onLoad={onImageLoad} style={{ width: 120, height: 90, borderRadius: 10, objectFit: "cover", border: "1px solid #E8E0D4" }} />
    </div>
  );
}

function DesktopThreadList(props: { threads: ChatThreadSummary[]; activeId: string | null; hasMore: boolean; onLoadMore: () => void; loading: boolean; onOpen: (id: string) => void; onNew: () => void; onNewIncognito: () => void; onRename: (id: string, t: string) => Promise<void>; onDelete: (id: string) => Promise<void>; deletingId: string | null }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!menuFor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuFor(null); };
    const onClick = () => setMenuFor(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, [menuFor]);

  const q = searchQuery.trim().toLowerCase();
  const filteredThreads = q ? props.threads.filter((t) => t.title.toLowerCase().includes(q)) : props.threads;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <NavLink label="Chat" active to="/chat" />
          <NavLink label="Quick" to="/quick" />
        </div>
        <button type="button" onClick={props.onNew} className="cursor-pointer flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90" style={{ height: 42, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>
          <Plus size={16} /> New chat
        </button>
        <div className="relative">
          <Search size={13} color="rgba(26,18,8,0.42)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            style={{
              width: "100%",
              height: 34,
              borderRadius: 10,
              border: "1px solid #E8E0D4",
              backgroundColor: "#FBF7F0",
              paddingLeft: 30,
              paddingRight: searchQuery ? 26 : 10,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12.5,
              color: "#1A1208",
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="cursor-pointer"
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(26,18,8,0.45)", padding: 2 }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <nav aria-label="Saved chats" className="flex-1 overflow-y-auto" style={{ padding: "4px 8px" }}>
        {filteredThreads.length === 0 && !props.loading ? (
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", padding: "8px" }}>{q ? "No matching chats" : "No saved chats yet"}</p>
        ) : (
          filteredThreads.map((t) => (
            <div key={t.id} style={{ position: "relative" }}>
              <div className="transition-colors hover:bg-[#F5E8E0]/60" style={{ display: "flex", alignItems: "center", borderRadius: 10, backgroundColor: props.activeId === t.id ? "#F5E8E0" : "transparent", opacity: props.deletingId === t.id ? 0.6 : 1 }}>
                <button type="button" onClick={() => { setMenuFor(null); props.onOpen(t.id); }} aria-label={`Open chat ${t.title}`} className="cursor-pointer flex-1 text-left truncate" style={{ background: "none", border: "none", padding: "10px 8px 10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>
                  {t.title}
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteError(null); setMenuFor(menuFor === t.id ? null : t.id); }} aria-label={`Chat options for ${t.title}`} aria-expanded={menuFor === t.id} className="cursor-pointer flex items-center justify-center shrink-0 rounded-lg hover:bg-black/5" style={{ width: 38, height: 38, border: "none", background: "none", color: "rgba(26,18,8,0.5)" }}>
                  <MoreHorizontal size={16} />
                </button>
              </div>
              {menuFor === t.id && (
                <div role="menu" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", right: 6, top: 42, zIndex: 40, minWidth: 140, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, boxShadow: "0 8px 24px rgba(26,18,8,0.14)" }}>
                  <button type="button" role="menuitem" className="cursor-pointer w-full flex items-center gap-2 text-left hover:bg-[#F5E8E0]/50 rounded-t-xl" style={{ background: "none", border: "none", padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208" }} onClick={() => { setRenaming({ id: t.id, title: t.title }); setMenuFor(null); }}>
                    <Pencil size={14} /> Rename
                  </button>
                  <button type="button" role="menuitem" className="cursor-pointer w-full flex items-center gap-2 text-left hover:bg-[#FDF0F0] rounded-b-xl" style={{ background: "none", border: "none", padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#A8401C" }} onClick={() => { setConfirming({ id: t.id, title: t.title }); setMenuFor(null); }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        {renaming && (
          <div role="dialog" aria-label="Rename chat" style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, margin: "4px 8px", padding: 12 }}>
            <label htmlFor="desktop-rename" className="sr-only">Chat title</label>
            <input id="desktop-rename" autoFocus value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") setRenaming(null); if (e.key === "Enter") { const t = renaming.title.trim(); if (t.length >= 1 && t.length <= 56) void props.onRename(renaming.id, t).then(() => setRenaming(null)); } }} style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #E8E0D4", padding: "0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, backgroundColor: "#fff" }} />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setRenaming(null)} className="cursor-pointer flex-1" style={{ height: 38, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={() => { const t = renaming.title.trim(); if (t.length < 1 || t.length > 56) return; void props.onRename(renaming.id, t).then(() => setRenaming(null)); }} className="cursor-pointer flex-1" style={{ height: 38, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontSize: 13, fontWeight: 600 }}>Save</button>
            </div>
          </div>
        )}
        {confirming && (
          <div role="alertdialog" aria-label="Delete chat" style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, margin: "4px 8px", padding: 12 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208", fontWeight: 600 }}>Delete “{confirming.title}”?</p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.6)", marginTop: 4 }}>This removes the conversation and its screenshots. Saved memory stays.</p>
            {deleteError && <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", marginTop: 4 }}>{deleteError}</p>}
            <div className="flex gap-2 mt-2">
              <button type="button" autoFocus onClick={() => { setConfirming(null); setDeleteError(null); }} disabled={deleteBusy} className="cursor-pointer flex-1" style={{ height: 38, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  const id = confirming.id;
                  setDeleteBusy(true);
                  setDeleteError(null);
                  void props.onDelete(id).then(() => setConfirming(null)).catch(() => setDeleteError("Couldn’t finish deleting. Try again.")).finally(() => setDeleteBusy(false));
                }}
                className="cursor-pointer flex-1" style={{ height: 38, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontSize: 13, fontWeight: 600 }}
              >
                {deleteError ? "Retry" : deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
        {props.hasMore && (
          <button type="button" onClick={props.onLoadMore} className="cursor-pointer w-full mt-2 transition-colors hover:bg-[#EFE6DA]" style={{ height: 40, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)" }}>
            Load older chats
          </button>
        )}
      </nav>
      <div style={{ borderTop: "1px solid #E8E0D4", padding: 10, display: "flex", flexDirection: "column", gap: 2 }}>
        <button type="button" onClick={() => props.onNewIncognito()} className="cursor-pointer text-left flex items-center gap-2 rounded-lg transition-colors hover:bg-[#F5E8E0]/60" style={{ background: "none", border: "none", padding: "8px 10px", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "rgba(26,18,8,0.75)" }}>
          <Lock size={14} /> Incognito chat
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => navigate("/settings/memory")} className="cursor-pointer text-left flex items-center gap-1.5 rounded-lg transition-colors hover:bg-[#F5E8E0]/60" style={{ background: "none", border: "none", padding: "8px 10px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.75)" }}>
            <Brain size={14} color="#C8522A" /> Memory
          </button>
          <button type="button" onClick={() => navigate("/voice")} className="cursor-pointer text-left flex items-center gap-1.5 rounded-lg transition-colors hover:bg-[#F5E8E0]/60" style={{ background: "none", border: "none", padding: "8px 10px", fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.75)" }}>
            <Mic size={14} color="#C8522A" /> My Voice
          </button>
        </div>
        <FooterLink to="/history" label="History" />
        <FooterLink to="/settings" label="Settings" />
      </div>
    </div>
  );
}

function NavLink({ label, to, active }: { label: string; to: string; active?: boolean }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} aria-current={active ? "page" : undefined} className="cursor-pointer transition-colors" style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, backgroundColor: active ? "#1A1208" : "transparent", color: active ? "#fff" : "rgba(26,18,8,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, border: active ? "none" : "1px solid #E8E0D4" }}>
      {label}
    </button>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} className="cursor-pointer text-left rounded-lg transition-colors hover:bg-[#F5E8E0]/60" style={{ padding: "8px 10px", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: "rgba(26,18,8,0.7)", background: "none", border: "none", width: "100%" }}>{label}</button>
  );
}

function ThreadOverflowMenu({ onRename, onOpenNote, onDelete, currentTitle }: { onRename: (t: string) => Promise<void>; onOpenNote: () => void; onDelete: () => Promise<void>; currentTitle: string }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(currentTitle);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (!open && !renaming && !confirming) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setRenaming(false); setConfirming(false); } };
    const onClick = () => { if (open) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("click", onClick); };
  }, [open, renaming, confirming]);

  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => { if (renaming || confirming) { setRenaming(false); setConfirming(false); setOpen(false); } else setOpen((v) => !v); }}
        aria-label={open ? "Close chat options" : "Chat options"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="cursor-pointer flex items-center justify-center rounded-xl transition-colors hover:bg-[#EFE6DA]"
        style={{ width: 42, height: 42, border: "none", background: "none", color: "#1A1208" }}
      >
        <MoreHorizontal size={20} />
      </button>
      {open && !renaming && !confirming && (
        <div role="menu" style={{ position: "absolute", top: 46, right: 0, zIndex: 60, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, minWidth: 165, boxShadow: "0 8px 24px rgba(26,18,8,0.12)" }}>
          <button type="button" role="menuitem" onClick={() => { setValue(currentTitle); setRenaming(true); setOpen(false); }} className="cursor-pointer w-full flex items-center gap-2 text-left hover:bg-[#F5E8E0]/50 rounded-t-xl" style={{ background: "none", border: "none", padding: "11px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}>
            <Pencil size={15} /> Rename
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenNote(); }} className="cursor-pointer w-full flex items-center gap-2 text-left hover:bg-[#F5E8E0]/50" style={{ background: "none", border: "none", padding: "11px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}>
            <NotebookPen size={15} /> Thread note
          </button>
          <button type="button" role="menuitem" onClick={() => { setConfirming(true); setOpen(false); }} className="cursor-pointer w-full flex items-center gap-2 text-left hover:bg-[#FDF0F0] rounded-b-xl" style={{ background: "none", border: "none", padding: "11px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#A8401C" }}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      )}
      {renaming && (
        <div role="dialog" aria-label="Rename chat" style={{ position: "absolute", top: 46, right: 0, zIndex: 60, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 14, padding: 12, boxShadow: "0 8px 24px rgba(26,18,8,0.12)", width: 260 }}>
          <label htmlFor="chat-rename" className="sr-only">Chat title</label>
          <input id="chat-rename" autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const t = value.trim(); if (t.length >= 1 && t.length <= 56) void onRename(t).then(() => setRenaming(false)); } }} style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid #E8E0D4", padding: "0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, backgroundColor: "#fff" }} />
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={() => setRenaming(false)} className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button type="button" onClick={() => { const t = value.trim(); if (t.length < 1 || t.length > 56) return; void onRename(t).then(() => setRenaming(false)); }} className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontWeight: 600, fontSize: 13 }}>Save</button>
          </div>
        </div>
      )}
      {confirming && (
        <div role="alertdialog" aria-label="Delete chat" style={{ position: "absolute", top: 46, right: 0, zIndex: 60, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(26,18,8,0.12)", width: 280 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", fontWeight: 600 }}>Delete “{currentTitle}”?</p>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.6)", marginTop: 6 }}>This removes the conversation and its screenshots. Saved memory stays.</p>
          {deleteError && <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", marginTop: 6 }}>{deleteError}</p>}
          <div className="flex gap-2 mt-3">
            <button type="button" autoFocus onClick={() => { setConfirming(false); setDeleteError(null); }} disabled={deleteBusy} className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontWeight: 600, fontSize: 13 }}>Cancel</button>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => {
                setDeleteBusy(true);
                setDeleteError(null);
                void onDelete().catch(() => setDeleteError("Couldn’t finish deleting. Try again.")).finally(() => setDeleteBusy(false));
              }}
              className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontWeight: 600, fontSize: 13 }}
            >
              {deleteError ? "Retry" : deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function useSignOutClear() {
  const { signOut } = useAppContext();
  return signOut;
}
void useSignOutClear;
