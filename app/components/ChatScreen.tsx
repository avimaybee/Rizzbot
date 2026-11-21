import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Lock, Menu } from "lucide-react";
import { useAppContext } from "../app-context";
import {
  createThread,
  deleteThread,
  getThread,
  listThreads,
  newThreadId,
  newTurnId,
  renameThread,
  uploadChatImages,
  type ChatThreadSummary,
  type ChatTurnWire,
} from "../../services/chatApi";
import { reconcileTurn, sendChatTurn } from "../../services/chatStream";
import { ChatComposer, type ComposerAttachment } from "./chat/ChatComposer";
import { ThreadDrawer } from "./chat/ThreadDrawer";
import { ChatReplyCard } from "./quick/ChatReplyCard";
import { R2Image } from "./ui/R2Image";
import { haptics } from "../utils/haptics";

interface ChatScreenProps {
  incognito?: boolean;
}

type UiTurn = ChatTurnWire & { localKey: string; failedCode?: string };

const STATUS_COPY: Record<string, string> = {
  thinking: "Thinking…",
  drafting: "Drafting replies…",
  refining: "Reworking that line…",
  reading: "Reading your screenshots…",
};

export function ChatScreen({ incognito }: ChatScreenProps) {
  const { threadId: routeThreadId } = useParams();
  const navigate = useNavigate();
  const { authUser, signOut } = useAppContext();
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

  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [skippedNote, setSkippedNote] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState<"draft" | null>(null);
  const [refine, setRefine] = useState<{ sourceTurnId: string; tone?: string; optionIndex?: number; bubbleIndex?: number; label: string } | null>(null);

  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [pendingStatus, setPendingStatus] = useState("Thinking…");
  const [pendingTurnId, setPendingTurnId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [showJump, setShowJump] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState<(() => void) | null>(null);
  const [lightbox, setLightbox] = useState<{ key: string; idx: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const candidateIds = useRef<{ threadId: string; turnId: string } | null>(null);
  const routeUidRef = useRef<string | null>(null);
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

  // Load active thread transcript
  useEffect(() => {
    if (isIncognito) {
      setActiveThread(null);
      setTurns([]);
      setThreadError(null);
      return;
    }
    const tid = routeThreadId;
    if (!tid) {
      setActiveThread(null);
      setTurns([]);
      setThreadError(null);
      candidateIds.current = null;
      return;
    }
    if (!authUser) return;
    let alive = true;
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

  // Clear per-user draft memory on sign-out is handled by parent; clear incognito on exit
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

  // Track route uid to disregard late events
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
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [turns, pendingText]);

  const guardIncognitoLeave = (fn: () => void) => {
    if (isIncognito && hasContent) setLeaveConfirm(() => fn);
    else fn();
  };

  const doSend = async () => {
    if (sending || preparing) return;
    const text = draft;
    if (!text.trim() && attachments.length === 0) return;
    if (text.length > 12_000) { setSkippedNote("Message is over 12,000 characters."); return; }
    if (refine && !text.trim() && attachments.length === 0) return;

    const myUid = authUser?.uid || "";
    const myRoute = `${isIncognito ? "inc" : routeThreadId || "new"}:${myUid}`;
    setSending(true);
    setPendingText("");
    setPendingStatus("Thinking…");
    setAnnounce("Sending message");

    try {
      if (isIncognito) {
        const prior = turns.slice(-10).flatMap((t) => {
          const arr: Array<{ role: "user" | "assistant"; text: string }> = [];
          if (t.userText) arr.push({ role: "user", text: t.userText });
          if (t.assistantText) arr.push({ role: "assistant", text: t.assistantText });
          return arr;
        });
        const turnKey = `local-${Date.now()}`;
        const userTurn: UiTurn = {
          id: turnKey, localKey: turnKey, userText: text, attachments: attachments.map((a) => a.preview),
          assistantText: "", status: "pending",
        };
        setTurns((p) => [...p, userTurn]);
        setDraft("");
        const imgs = attachments.map((a) => ({ data: a.data, mimeType: a.mimeType }));
        setAttachments([]);
        setSkippedNote(null);
        scrollToBottom(false);
        await sendChatTurn(
          {
            mode: "incognito", text, images: imgs, priorTurns: prior,
            sessionId: incognitoSession.current,
            ref: refine ? { sourceTurnId: refine.sourceTurnId, tone: refine.tone, optionIndex: refine.optionIndex, bubbleIndex: refine.bubbleIndex } : undefined,
            action: draftAction || (refine ? "refine" : undefined),
          },
          {
            onAccepted: () => { setPendingTurnId(turnKey); },
            onStatus: (_c, m) => { if (routeUidRef.current !== myRoute) return; setPendingStatus(m); },
            onDelta: (t) => { if (routeUidRef.current !== myRoute) return; setPendingText((p) => p + t); },
            onDone: (turn) => {
              if (routeUidRef.current !== myRoute) return;
              setTurns((p) => p.map((x) => (x.localKey === turnKey ? { ...x, assistantText: turn.assistantText || "", card: turn.card, status: "complete", id: turn.id || turnKey } : x)));
              setPendingText("");
              setPendingTurnId(null);
              setSending(false);
              setDraftAction(null);
              setRefine(null);
              setAnnounce("Reply ready");
              haptics.success();
            },
            onError: (_c, m) => {
              if (routeUidRef.current !== myRoute) return;
              setTurns((p) => p.map((x) => (x.localKey === turnKey ? { ...x, status: "failed", failedCode: _c } : x)));
              setPendingText("");
              setSending(false);
              setAnnounce(m);
            },
          }
        );
        return;
      }

      // Regular: candidate IDs for retry
      let threadId = routeThreadId || candidateIds.current?.threadId || newThreadId();
      let turnId = candidateIds.current?.turnId || newTurnId();
      candidateIds.current = { threadId, turnId };

      // Create thread on first send (no server record until accepted)
      if (!routeThreadId) {
        const title = text.trim() ? text.split("\n")[0].trim().slice(0, 56) || "New chat" : "New chat";
        try {
          const created = await createThread({ id: threadId, title, initialText: text });
          setActiveThread(created.thread);
        } catch {
          setSending(false);
          setAnnounce("Couldn’t send your message. Try again.");
          setSkippedNote("Couldn’t send your message. Try again.");
          return;
        }
      }

      // Upload images
      let keys: string[] = [];
      if (attachments.length) {
        setPreparing(true);
        setPendingStatus("Adding images…");
        try {
          keys = await uploadChatImages(threadId, turnId, attachments.map((a) => ({ id: a.id, data: a.data, mimeType: a.mimeType })));
        } catch (e: any) {
          setPreparing(false);
          setSending(false);
          setAnnounce("Couldn’t send your message. Try again.");
          setSkippedNote("Couldn’t send your message. Try again.");
          return;
        }
        setPreparing(false);
      }

      const userTurn: UiTurn = { id: turnId, localKey: turnId, threadId, userText: text, attachments: keys.length ? keys : [], assistantText: "", status: "pending" };
      setTurns((p) => [...p, userTurn]);
      setDraft("");
      setAttachments([]);
      setSkippedNote(null);
      setPendingTurnId(turnId);
      scrollToBottom(false);

      const refPayload = refine ? { sourceTurnId: refine.sourceTurnId, tone: refine.tone, optionIndex: refine.optionIndex, bubbleIndex: refine.bubbleIndex } : undefined;
      const actionPayload = draftAction || (refine ? "refine" : undefined);

      await sendChatTurn(
        { mode: "regular", threadId, turnId, text, attachmentKeys: keys, ref: refPayload, action: actionPayload },
        {
          onAccepted: () => {
            if (!routeThreadId) navigate(`/chat/${threadId}`, { replace: true });
            candidateIds.current = null;
          },
          onStatus: (_c, m) => { if (activeThreadIdRef.current && activeThreadIdRef.current !== threadId) return; setPendingStatus(m); },
          onDelta: (t) => { if (activeThreadIdRef.current && activeThreadIdRef.current !== threadId) return; setPendingText((p) => p + t); },
          onDone: (turn) => {
            if (activeThreadIdRef.current && activeThreadIdRef.current !== threadId) return;
            setTurns((p) => p.map((x) => (x.localKey === turnId ? { ...x, userText: turn.userText ?? text, attachments: turn.attachments ?? keys, assistantText: turn.assistantText || "", card: turn.card, status: "complete", attempt: turn.attempt } : x)));
            setPendingText("");
            setPendingTurnId(null);
            setSending(false);
            setDraftAction(null);
            setRefine(null);
            setAnnounce("Reply ready");
            haptics.success();
            // Refresh thread title/timestamp ordering
            void loadThreads(null).catch(() => {});
          },
          onError: (code, message) => {
            if (activeThreadIdRef.current && activeThreadIdRef.current !== threadId) return;
            setPendingText("");
            setSending(false);
            setAnnounce(message);
            if (code === "active") {
              // Keep pending view, show checking state
              setPendingStatus("Checking your message…");
              return;
            }
            setTurns((p) => p.map((x) => (x.localKey === turnId ? { ...x, status: "failed", failedCode: code } : x)));
            setPendingTurnId(null);
          },
        }
      );
    } catch {
      setSending(false);
      setPendingText("");
      setAnnounce("Couldn’t finish that reply.");
    }
  };

  const retryTurn = async (turn: UiTurn) => {
    // Latest failed turn retries with same ID; older failed restores as new draft
    const failedTurns = turns.filter((t) => t.status === "failed");
    const latestFailed = failedTurns[failedTurns.length - 1];
    if (latestFailed && latestFailed.localKey === turn.localKey && !isIncognito) {
      const tid = activeThreadId;
      if (!tid) return;
      setSending(true);
      setPendingText("");
      setPendingStatus("Thinking…");
      setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, status: "pending" } : x)));
      setPendingTurnId(turn.id);
      await sendChatTurn(
        { mode: "regular", threadId: tid, turnId: turn.id, text: turn.userText, attachmentKeys: turn.attachments.filter((a) => a.startsWith("r2:")), ref: turn.ref },
        {
          onStatus: (_c, m) => { if (activeThreadIdRef.current && activeThreadIdRef.current !== tid) return; setPendingStatus(m); },
          onDelta: (t) => { if (activeThreadIdRef.current && activeThreadIdRef.current !== tid) return; setPendingText((p) => p + t); },
          onDone: (done) => {
            if (activeThreadIdRef.current && activeThreadIdRef.current !== tid) return;
            setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, assistantText: done.assistantText || "", card: done.card, status: "complete" } : x)));
            setPendingText(""); setSending(false); setPendingTurnId(null); setAnnounce("Reply ready");
          },
          onError: (code, message) => {
            if (activeThreadIdRef.current && activeThreadIdRef.current !== tid) return;
            setSending(false); setPendingText(""); setPendingTurnId(null);
            setTurns((p) => p.map((x) => (x.localKey === turn.localKey ? { ...x, status: "failed", failedCode: code } : x)));
            setAnnounce(message);
          },
        }
      );
    } else {
      // Send again: restore as new draft without overwriting nonempty draft
      if (!draft) setDraft(turn.userText);
      textareaRef.current?.focus();
    }
  };

  const reconcilePending = async () => {
    if (!pendingTurnId || isIncognito || !activeThreadId) return;
    setPendingStatus("Checking your message…");
    const saved = await reconcileTurn(activeThreadId, pendingTurnId);
    if (saved) {
      if (saved.status === "complete") {
        setTurns((p) => p.map((x) => (x.localKey === pendingTurnId ? { ...x, assistantText: saved.assistantText || "", card: saved.card, status: "complete" } : x)));
        setPendingText(""); setSending(false); setPendingTurnId(null); setAnnounce("Reply ready");
      } else if (saved.status === "pending") {
        setPendingStatus("Checking your message…");
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
    if (turns.length === 0) return "New chat";
    return activeThread?.title || "New chat";
  }, [isIncognito, activeThread, turns.length]);

  const headerDesc = isIncognito ? "Uses saved memory. This chat won’t be saved." : undefined;

  return (
    <div className="chat-shell" style={{ height: "100dvh", display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto auto", backgroundColor: "#F5EFE6", paddingTop: "env(safe-area-inset-top)", paddingBottom: 0, paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      <h1 className="sr-only">Chat</h1>
      <div aria-live="polite" className="sr-only">{announce}</div>

      <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
        {isDesktop && !isIncognito && (
          <aside aria-label="Saved chats" style={{ width: 256, borderRight: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", display: "flex", flexDirection: "column", minHeight: 0 }}>
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
          <header style={{ minHeight: "calc(56px + env(safe-area-inset-top))", display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid #E8E0D4", backgroundColor: "#F5EFE6", maxWidth: isDesktop ? 720 : undefined, width: "100%", margin: isDesktop ? "0 auto" : undefined }}>
            {!isDesktop && (
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open chats" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "#1A1208" }}>
                <Menu size={20} />
              </button>
            )}
            {isIncognito ? (
              <>
                <Lock size={16} color="#1A1208" aria-hidden="true" />
                <span className="truncate" style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }} aria-describedby="incognito-desc">Incognito</span>
                <span id="incognito-desc" className="sr-only">Uses saved memory. This chat won’t be saved.</span>
                <button type="button" onClick={() => guardIncognitoLeave(() => navigate("/chat"))} aria-label="Close incognito chat" className="cursor-pointer" style={{ height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid #E8E0D4", background: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>
                  Close
                </button>
              </>
            ) : (
              <>
                {activeThreadId && (
                  <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="cursor-pointer items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "#1A1208", display: isDesktop ? "none" : "flex" }}>
                    <ArrowLeft size={20} />
                  </button>
                )}
                <span className="truncate" title={title} style={{ flex: 1, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>{title}</span>
                {activeThreadId && (
                  <ThreadOverflowMenu
                    onRename={async (t) => { if (activeThreadId) { await renameThread(activeThreadId, t); setActiveThread((a) => (a ? { ...a, title: t } : a)); void loadThreads(null); } }}
                    onDelete={async () => { if (activeThreadId) { await deleteThread(activeThreadId); navigate("/chat"); } }}
                    currentTitle={title}
                  />
                )}
              </>
            )}
          </header>

          <div ref={scrollRef} onScroll={onScroll} role="log" aria-label="Conversation" style={{ flex: 1, overflowY: "auto", padding: isDesktop ? "16px 24px" : "12px 16px", maxWidth: isDesktop ? 720 : undefined, width: "100%", margin: isDesktop ? "0 auto" : undefined }}>
            {threadError ? (
              <div style={{ backgroundColor: "#FDFAF5", borderRadius: 16, padding: 20, textAlign: "center" }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>{threadError}</p>
                <div className="flex gap-2 justify-center mt-3">
                  <button type="button" onClick={() => window.location.reload()} className="cursor-pointer" style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Retry</button>
                  <button type="button" onClick={() => navigate("/chat")} className="cursor-pointer" style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>Back to chats</button>
                </div>
              </div>
            ) : loadingThread ? (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.5)" }}>Loading chat…</p>
            ) : turns.length === 0 && !sending ? (
              <div style={{ paddingTop: 48, paddingBottom: 24, textAlign: "center" }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: isDesktop ? 36 : 32, fontWeight: 700, color: "#1A1208" }}>What’s on your mind?</h2>
                {isIncognito && (
                  <>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", marginTop: 8 }}>Uses saved memory. This chat won’t be saved.</p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.45)", marginTop: 4 }}>When Rizzbot replies, message content is processed by the model provider under its retention policy.</p>
                  </>
                )}
              </div>
            ) : (
              <div>
                {turnsCursor && (
                  <button type="button" onClick={() => activeThreadId && getThread(activeThreadId, { cursor: turnsCursor }).then((r) => { setTurns((p) => [...(r.turns || []).map((t) => ({ ...t, localKey: t.id })), ...p]); setTurnsCursor(r.nextCursor || null); })} className="cursor-pointer w-full mb-3" style={{ height: 40, borderRadius: 12, border: "1px solid #E8E0D4", background: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)" }}>
                    Load older messages
                  </button>
                )}
                {turns.map((t) => (
                  <article key={t.localKey} style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                      <div style={{ maxWidth: "85%", width: "fit-content", backgroundColor: "#F5E8E0", border: "1px solid #E8E0D4", borderRadius: "16px 16px 4px 16px", padding: t.userText ? "10px 14px" : "6px", overflowWrap: "anywhere" }}>
                        {t.attachments.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: t.userText ? 6 : 0 }}>
                            {t.attachments.map((k, i) => (
                              <ChatImage key={`${t.localKey}-${i}`} srcOrKey={k} index={i} total={t.attachments.length} onOpen={() => setLightbox({ key: k, idx: i })} />
                            ))}
                          </div>
                        )}
                        {t.userText ? <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, lineHeight: 1.5, color: "#1A1208", whiteSpace: "pre-wrap", margin: 0 }}>{t.userText}</p> : null}
                      </div>
                    </div>
                    {t.status === "failed" ? (
                      <div style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 14, padding: "12px 14px" }}>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}>
                          {t.failedCode === "allowance" ? "Chat is at its usage limit. Try again later." : "Couldn’t finish that reply."}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {turns[turns.length - 1]?.localKey === t.localKey ? (
                            <button type="button" onClick={() => void retryTurn(t)} className="cursor-pointer" style={{ height: 44, padding: "0 16px", borderRadius: 12, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>Retry</button>
                          ) : (
                            <button type="button" onClick={() => void retryTurn(t)} className="cursor-pointer" style={{ height: 44, padding: "0 16px", borderRadius: 12, border: "1px solid #E8E0D4", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>Send again</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ maxWidth: "65ch" }}>
                        {t.assistantText ? (
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, lineHeight: 1.5, color: "#1A1208", whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "0 0 12px" }}>{t.assistantText}</p>
                        ) : null}
                        {t.card ? (
                          <ChatReplyCard
                            turnId={t.id}
                            card={t.card}
                            onRefine={(r) => {
                              setRefine(r);
                              setDraftAction(null);
                              textareaRef.current?.focus();
                              haptics.light();
                            }}
                          />
                        ) : null}
                      </div>
                    )}
                  </article>
                ))}
                {(sending || pendingText) && (
                  <article aria-label="Assistant is responding" style={{ marginBottom: 24 }}>
                    <p aria-live="off" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", marginBottom: 6 }}>
                      {pendingStatus === "Thinking…" && pendingText ? pendingText.slice(0, 120) : pendingStatus}
                    </p>
                    {pendingStatus !== "Thinking…" && pendingText ? (
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, lineHeight: 1.5, color: "#1A1208", whiteSpace: "pre-wrap" }}>{pendingText}</p>
                    ) : pendingStatus === "Thinking…" && pendingText ? null : null}
                    {pendingStatus === "Checking your message…" && (
                      <button type="button" onClick={() => void reconcilePending()} className="cursor-pointer mt-2" style={{ height: 44, padding: "0 16px", borderRadius: 12, border: "1px solid #E8E0D4", background: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>
                        Check again
                      </button>
                    )}
                  </article>
                )}
              </div>
            )}
            {showJump && (
              <button type="button" onClick={() => scrollToBottom()} className="cursor-pointer" style={{ position: "sticky", bottom: 8, marginLeft: "auto", display: "block", height: 44, padding: "0 16px", borderRadius: 999, border: "1px solid #E8E0D4", backgroundColor: "#FDFAF5", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208", boxShadow: "0 4px 16px rgba(26,18,8,0.12)" }}>
                Jump to latest
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
              draftAction={draftAction}
              onDraftActionChange={setDraftAction}
              refineLabel={refine?.label || null}
              onClearRefine={() => setRefine(null)}
              textareaRef={textareaRef}
              skippedNote={skippedNote}
              onSkippedNoteChange={setSkippedNote}
            />
            {!isDesktop && !keyboardOpen && <MobileChatNav onNavigate={(p) => guardIncognitoLeave(() => navigate(p))} />}
          </div>
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

      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label="Image preview" style={{ position: "fixed", inset: 0, zIndex: 95, backgroundColor: "rgba(26,18,8,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setLightbox(null)} onKeyDown={(e) => { if (e.key === "Escape") setLightbox(null); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", backgroundColor: "#FDFAF5", borderRadius: 16, padding: 12 }}>
            <R2Image srcOrKey={lightbox.key} alt="Chat screenshot" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 12 }} />
            <button type="button" onClick={() => setLightbox(null)} className="cursor-pointer w-full mt-2" style={{ height: 44, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Close</button>
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

function ChatImage({ srcOrKey, index, total, onOpen }: { srcOrKey: string; index: number; total: number; onOpen: () => void }) {
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
        <img src={srcOrKey} alt={`Screenshot ${index + 1}`} onError={() => setFailed(true)} style={{ width: 120, height: 90, borderRadius: 10, objectFit: "cover", border: "1px solid #E8E0D4" }} />
      </button>
    );
  }
  return (
    <div onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }} role="button" tabIndex={0} aria-label={`Open image ${index + 1} of ${total}`} style={{ cursor: "pointer" }}>
      <R2Image srcOrKey={srcOrKey} alt={`Screenshot ${index + 1}`} style={{ width: 120, height: 90, borderRadius: 10, objectFit: "cover", border: "1px solid #E8E0D4" }} />
    </div>
  );
}

function DesktopThreadList(props: { threads: ChatThreadSummary[]; activeId: string | null; hasMore: boolean; onLoadMore: () => void; loading: boolean; onOpen: (id: string) => void; onNew: () => void; onNewIncognito: () => void; onRename: (id: string, t: string) => Promise<void>; onDelete: (id: string) => Promise<void>; deletingId: string | null }) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <NavLink label="Chat" active to="/chat" />
          <NavLink label="Quick" to="/quick" />
        </div>
        <button type="button" onClick={props.onNew} className="cursor-pointer" style={{ height: 44, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>+ New chat ▾</button>
      </div>
      <nav aria-label="Saved chats" className="flex-1 overflow-y-auto" style={{ padding: "4px 8px" }}>
        {props.threads.length === 0 && !props.loading ? (
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", padding: "8px" }}>No saved chats yet</p>
        ) : (
          props.threads.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", borderRadius: 10, backgroundColor: props.activeId === t.id ? "#F5E8E0" : "transparent", opacity: props.deletingId === t.id ? 0.6 : 1 }}>
              <button type="button" onClick={() => props.onOpen(t.id)} aria-label={`Open chat ${t.title}`} className="cursor-pointer flex-1 text-left truncate" style={{ background: "none", border: "none", padding: "10px 8px 10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>
                {t.title}
              </button>
              <button type="button" onClick={() => { setDeleteError(null); setMenuFor(menuFor === t.id ? null : t.id); }} aria-label={`Chat options for ${t.title}`} aria-expanded={menuFor === t.id} className="cursor-pointer flex items-center justify-center shrink-0" style={{ width: 44, height: 44, borderRadius: 10, border: "none", background: "none", color: "rgba(26,18,8,0.5)" }}>
                ⋯
              </button>
            </div>
          ))
        )}
        {menuFor && (
          <div role="menu" style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, margin: "4px 8px", boxShadow: "0 8px 24px rgba(26,18,8,0.12)" }}>
            <button type="button" role="menuitem" className="cursor-pointer w-full text-left" style={{ background: "none", border: "none", padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }} onClick={() => { const t = props.threads.find((x) => x.id === menuFor); setRenaming(t ? { id: t.id, title: t.title } : null); setMenuFor(null); }}>
              Rename
            </button>
            <button type="button" role="menuitem" className="cursor-pointer w-full text-left" style={{ background: "none", border: "none", padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#A8401C" }} onClick={() => { const t = props.threads.find((x) => x.id === menuFor); setConfirming(t ? { id: t.id, title: t.title } : null); setMenuFor(null); }}>
              Delete
            </button>
          </div>
        )}
        {renaming && (
          <div role="dialog" aria-label="Rename chat" style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, margin: "4px 8px", padding: 12 }}>
            <label htmlFor="desktop-rename" className="sr-only">Chat title</label>
            <input id="desktop-rename" value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} onKeyDown={(e) => { if (e.key === "Escape") setRenaming(null); }} style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid #E8E0D4", padding: "0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }} />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setRenaming(null)} className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button type="button" onClick={() => { const t = renaming.title.trim(); if (t.length < 1 || t.length > 56) return; void props.onRename(renaming.id, t).then(() => setRenaming(null)); }} className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontSize: 13, fontWeight: 600 }}>Save</button>
            </div>
          </div>
        )}
        {confirming && (
          <div role="alertdialog" aria-label="Delete chat" style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, margin: "4px 8px", padding: 12 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#1A1208" }}>Delete “{confirming.title}”?</p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.6)", marginTop: 4 }}>This removes the conversation and its screenshots. Saved memory stays.</p>
            {deleteError && <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", marginTop: 4 }}>{deleteError}</p>}
            <div className="flex gap-2 mt-2">
              <button type="button" autoFocus onClick={() => { setConfirming(null); setDeleteError(null); }} disabled={deleteBusy} className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontSize: 13, fontWeight: 600 }}>Cancel</button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  const id = confirming.id;
                  setDeleteBusy(true);
                  setDeleteError(null);
                  void props.onDelete(id).then(() => setConfirming(null)).catch(() => setDeleteError("Couldn’t finish deleting. Try again.")).finally(() => setDeleteBusy(false));
                }}
                className="cursor-pointer flex-1" style={{ height: 40, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontSize: 13, fontWeight: 600 }}
              >
                {deleteError ? "Retry" : deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
        {props.hasMore && (
          <button type="button" onClick={props.onLoadMore} className="cursor-pointer w-full mt-2" style={{ height: 40, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)" }}>
            Load older chats
          </button>
        )}
      </nav>
      <div style={{ borderTop: "1px solid #E8E0D4", padding: 12, display: "flex", flexDirection: "column", gap: 2 }}>
        <button type="button" onClick={() => props.onNewIncognito()} className="cursor-pointer text-left" style={{ background: "none", border: "none", padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.7)" }}>Incognito chat</button>
        <FooterLink to="/history" label="History" />
        <FooterLink to="/settings" label="Settings" />
      </div>
    </div>
  );
}

function NavLink({ label, to, active }: { label: string; to: string; active?: boolean }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} aria-current={active ? "page" : undefined} className="cursor-pointer" style={{ flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 10, backgroundColor: active ? "#1A1208" : "transparent", color: active ? "#fff" : "rgba(26,18,8,0.6)", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, border: active ? "none" : "1px solid #E8E0D4" }}>
      {label}
    </button>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} className="cursor-pointer text-left" style={{ padding: "10px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.7)", background: "none", border: "none", borderRadius: 8, width: "100%" }}>{label}</button>
  );
}

function ThreadOverflowMenu({ onRename, onDelete, currentTitle }: { onRename: (t: string) => Promise<void>; onDelete: () => Promise<void>; currentTitle: string }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(currentTitle);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  if (!open && !renaming && !confirming) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Chat options" aria-haspopup="menu" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "#1A1208" }}>
        ⋯
      </button>
    );
  }
  if (renaming) {
    return (
      <div role="dialog" aria-label="Rename chat" style={{ position: "absolute", top: 64, right: 12, zIndex: 60, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 14, padding: 12, boxShadow: "0 8px 24px rgba(26,18,8,0.12)", width: 260 }}>
        <label htmlFor="chat-rename" className="sr-only">Chat title</label>
        <input id="chat-rename" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid #E8E0D4", padding: "0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }} />
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={() => { setRenaming(false); setOpen(false); }} className="cursor-pointer flex-1" style={{ height: 44, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent" }}>Cancel</button>
          <button type="button" onClick={() => { const t = value.trim(); if (t.length < 1 || t.length > 56) return; void onRename(t).then(() => { setRenaming(false); setOpen(false); }); }} className="cursor-pointer flex-1" style={{ height: 44, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontWeight: 600 }}>Save</button>
        </div>
      </div>
    );
  }
  if (confirming) {
    return (
      <div role="alertdialog" aria-label="Delete chat" style={{ position: "absolute", top: 64, right: 12, zIndex: 60, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 14, padding: 14, boxShadow: "0 8px 24px rgba(26,18,8,0.12)", width: 280 }}>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}>Delete “{currentTitle}”?</p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.6)", marginTop: 6 }}>This removes the conversation and its screenshots. Saved memory stays.</p>
        {deleteError && <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", marginTop: 6 }}>{deleteError}</p>}
        <div className="flex gap-2 mt-3">
          <button type="button" autoFocus onClick={() => { setConfirming(false); setOpen(false); setDeleteError(null); }} disabled={deleteBusy} className="cursor-pointer flex-1" style={{ height: 44, borderRadius: 10, border: "1px solid #E8E0D4", background: "transparent" }}>Cancel</button>
          <button
            type="button"
            disabled={deleteBusy}
            onClick={() => {
              setDeleteBusy(true);
              setDeleteError(null);
              void onDelete().catch(() => setDeleteError("Couldn’t finish deleting. Try again.")).finally(() => setDeleteBusy(false));
            }}
            className="cursor-pointer flex-1" style={{ height: 44, borderRadius: 10, border: "none", backgroundColor: "#A8401C", color: "#fff", fontWeight: 600 }}
          >
            {deleteError ? "Retry" : deleteBusy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(false)} aria-label="Close chat options" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "#1A1208" }}>⋯</button>
      <div role="menu" style={{ position: "absolute", top: 48, right: 0, zIndex: 60, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, minWidth: 160, boxShadow: "0 8px 24px rgba(26,18,8,0.12)" }}>
        <button type="button" role="menuitem" onClick={() => { setValue(currentTitle); setRenaming(true); }} className="cursor-pointer w-full text-left" style={{ background: "none", border: "none", padding: "12px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>Rename</button>
        <button type="button" role="menuitem" onClick={() => setConfirming(true)} className="cursor-pointer w-full text-left" style={{ background: "none", border: "none", padding: "12px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#A8401C" }}>Delete</button>
      </div>
    </div>
  );
}

function MobileChatNav({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <nav aria-label="Primary" style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <a href="/chat" aria-current="page" onClick={(e) => { e.preventDefault(); onNavigate("/chat"); }} style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Chat</a>
      <a href="/quick" onClick={(e) => { e.preventDefault(); onNavigate("/quick"); }} style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 12, backgroundColor: "transparent", border: "1px solid #E8E0D4", color: "rgba(26,18,8,0.65)", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Quick</a>
    </nav>
  );
}

export function useSignOutClear() {
  const { signOut } = useAppContext();
  return signOut;
}
void useSignOutClear;
