import { useState } from "react";
import { Clock, History, Lock, MessageSquarePlus, Pencil, Settings, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router";
import type { ChatThreadSummary } from "../../../services/chatApi";

interface ThreadDrawerProps {
  open: boolean;
  onClose: () => void;
  threads: ChatThreadSummary[];
  activeId: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
  onOpenThread: (id: string) => void;
  onNewChat: () => void;
  onNewIncognito: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  deletingId: string | null;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ThreadDrawer(props: ThreadDrawerProps) {
  const navigate = useNavigate();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const runDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await props.onDelete(deleting.id);
      setDeleting(null);
    } catch {
      setDeleteError("Couldn’t finish deleting. Try again.");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!props.open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70 }} role="dialog" aria-modal="true" aria-label="Chats">
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(26,18,8,0.35)" }} onClick={props.onClose} />
      <aside
        style={{
          position: "absolute", top: 0, bottom: 0, left: 0,
          width: "min(320px, calc(100vw - 48px))",
          backgroundColor: "#FDFAF5", borderRight: "1px solid #E8E0D4",
          display: "flex", flexDirection: "column",
          transition: "transform 160ms ease-out",
        }}
      >
        <div className="flex items-center justify-between" style={{ padding: "12px 12px 8px 16px" }}>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: "#1A1208" }}>Chats</h2>
          <button type="button" onClick={props.onClose} aria-label="Close chats" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "rgba(26,18,8,0.6)" }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ padding: "0 12px 8px" }} className="flex flex-col gap-1">
          <button type="button" onClick={props.onNewChat} className="cursor-pointer flex items-center gap-2 w-full text-left" style={{ height: 44, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "0 14px" }}>
            <MessageSquarePlus size={17} /> New chat
          </button>
          <button type="button" onClick={props.onNewIncognito} className="cursor-pointer flex items-center gap-2 w-full text-left" style={{ height: 44, borderRadius: 12, border: "1px solid #E8E0D4", background: "transparent", color: "#1A1208", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "0 14px" }}>
            <Lock size={15} /> Incognito chat
          </button>
        </div>
        <nav aria-label="Saved chats" className="flex-1 overflow-y-auto" style={{ padding: "4px 8px" }}>
          {props.loading && props.threads.length === 0 ? (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", padding: "8px 8px" }}>Loading chats…</p>
          ) : props.threads.length === 0 ? (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", padding: "8px 8px" }}>No saved chats yet</p>
          ) : (
            props.threads.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 2, borderRadius: 12, backgroundColor: props.activeId === t.id ? "#F5E8E0" : "transparent", opacity: props.deletingId === t.id ? 0.6 : 1 }}>
                <button
                  type="button"
                  onClick={() => props.onOpenThread(t.id)}
                  aria-label={`Open chat ${t.title}`}
                  className="cursor-pointer flex-1 text-left"
                  style={{ background: "none", border: "none", padding: "10px 8px 10px 12px", minWidth: 0 }}
                >
                  <span className="block truncate" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>{t.title}</span>
                  <span className="flex items-center gap-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "rgba(26,18,8,0.45)" }}>
                    <Clock size={11} /> {timeAgo(t.updated_at)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMenuFor(menuFor === t.id ? null : t.id)}
                  aria-label={`Chat options for ${t.title}`}
                  aria-expanded={menuFor === t.id}
                  className="cursor-pointer flex items-center justify-center shrink-0"
                  style={{ width: 44, height: 44, borderRadius: 10, border: "none", background: "none", color: "rgba(26,18,8,0.5)" }}
                >
                  ⋯
                </button>
              </div>
            ))
          )}
          {menuFor && (
            <div role="menu" style={{ backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, margin: "4px 8px", boxShadow: "0 8px 24px rgba(26,18,8,0.12)" }}>
              <button type="button" role="menuitem" className="cursor-pointer w-full flex items-center gap-2 text-left" style={{ background: "none", border: "none", padding: "12px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}
                onClick={() => { const t = props.threads.find((x) => x.id === menuFor); setRenaming(t ? { id: t.id, title: t.title } : null); setRenameError(null); setMenuFor(null); }}>
                <Pencil size={15} /> Rename
              </button>
              <button type="button" role="menuitem" className="cursor-pointer w-full flex items-center gap-2 text-left" style={{ background: "none", border: "none", padding: "12px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#A8401C" }}
                onClick={() => { const t = props.threads.find((x) => x.id === menuFor); setDeleting(t ? { id: t.id, title: t.title } : null); setMenuFor(null); }}>
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}
          {props.hasMore && (
            <button type="button" onClick={props.onLoadMore} className="cursor-pointer w-full" style={{ height: 44, borderRadius: 12, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)", marginTop: 8 }}>
              Load older chats
            </button>
          )}
        </nav>
        <div style={{ borderTop: "1px solid #E8E0D4", padding: 12 }} className="flex flex-col gap-1">
          <button type="button" onClick={() => navigate("/history")} className="cursor-pointer flex items-center gap-2 w-full text-left" style={{ height: 44, borderRadius: 12, border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(26,18,8,0.7)", padding: "0 12px" }}>
            <History size={17} /> History
          </button>
          <button type="button" onClick={() => navigate("/settings")} className="cursor-pointer flex items-center gap-2 w-full text-left" style={{ height: 44, borderRadius: 12, border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(26,18,8,0.7)", padding: "0 12px" }}>
            <Settings size={17} /> Settings
          </button>
        </div>
      </aside>

      {renaming && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, backgroundColor: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setRenaming(null)}>
          <div role="dialog" aria-modal="true" aria-label="Rename chat" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>Rename chat</h3>
            <label htmlFor="rename-input" className="sr-only">Chat title</label>
            <input
              id="rename-input" autoFocus value={renaming.title}
              onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Escape") setRenaming(null); }}
              style={{ width: "100%", marginTop: 12, height: 48, borderRadius: 12, border: "1px solid #E8E0D4", padding: "0 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", backgroundColor: "#fff" }}
            />
            {renameError && <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", marginTop: 6 }}>{renameError}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setRenaming(null)} className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(26,18,8,0.7)" }}>Cancel</button>
              <button
                type="button"
                onClick={() => {
                  const t = renaming.title.trim();
                  if (t.length < 1 || t.length > 56) { setRenameError("Use 1–56 characters."); return; }
                  props.onRename(renaming.id, t).then(() => setRenaming(null)).catch(() => setRenameError("Couldn’t save. Try again."));
                }}
                className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, backgroundColor: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => { if (!deleteBusy) { setDeleting(null); setDeleteError(null); } }}>
          <div role="dialog" aria-modal="true" aria-label="Delete chat" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>Delete “{deleting.title}”?</h3>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", lineHeight: 1.5, marginTop: 8 }}>
              This removes the conversation and its screenshots. Saved memory stays.
            </p>
            {deleteError && <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#A8401C", marginTop: 8 }}>{deleteError}</p>}
            <div className="flex flex-col gap-2 mt-4">
              <button type="button" autoFocus onClick={() => { setDeleting(null); setDeleteError(null); }} disabled={deleteBusy} className="cursor-pointer" style={{ height: 48, borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(26,18,8,0.7)", opacity: deleteBusy ? 0.5 : 1 }}>Cancel</button>
              <button
                type="button"
                onClick={() => void runDelete()}
                disabled={deleteBusy}
                className="cursor-pointer" style={{ height: 48, borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, opacity: deleteBusy ? 0.6 : 1 }}
              >
                {deleteError ? "Retry" : deleteBusy ? "Deleting…" : "Delete chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
