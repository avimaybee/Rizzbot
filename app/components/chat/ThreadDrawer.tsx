import { useState } from "react";
import { Brain, Clock, History, Lock, MessageSquarePlus, Mic, Pencil, Search, Settings, Trash2, X } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
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
        <div style={{ padding: "0 12px 8px" }} className="flex flex-col gap-1.5">
          <button type="button" onClick={props.onNewChat} className="cursor-pointer flex items-center gap-2 w-full text-left" style={{ height: 44, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "0 14px" }}>
            <MessageSquarePlus size={17} /> New chat
          </button>
          <button type="button" onClick={props.onNewIncognito} className="cursor-pointer flex items-center gap-2 w-full text-left" style={{ height: 44, borderRadius: 12, border: "1px solid #E8E0D4", background: "transparent", color: "#1A1208", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, padding: "0 14px" }}>
            <Lock size={15} /> Incognito chat
          </button>
          <div className="relative mt-0.5">
            <Search size={14} color="rgba(26,18,8,0.42)" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats…"
              aria-label="Search chats"
              style={{
                width: "100%",
                height: 36,
                borderRadius: 10,
                border: "1px solid #E8E0D4",
                backgroundColor: "#FBF7F0",
                paddingLeft: 32,
                paddingRight: searchQuery ? 28 : 10,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
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
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(26,18,8,0.45)", padding: 4 }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <nav aria-label="Saved chats" className="flex-1 overflow-y-auto" style={{ padding: "4px 8px" }}>
          {(() => {
            const q = searchQuery.trim().toLowerCase();
            const filtered = q ? props.threads.filter((t) => t.title.toLowerCase().includes(q)) : props.threads;
            if (props.loading && props.threads.length === 0) {
              return <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", padding: "8px 8px" }}>Loading chats…</p>;
            }
            if (filtered.length === 0) {
              return <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.5)", padding: "8px 8px" }}>{q ? "No matching chats" : "No saved chats yet"}</p>;
            }
            return filtered.map((t) => (
              <div key={t.id} style={{ position: "relative" }}>
                <div className="transition-colors hover:bg-[#F5E8E0]/60" style={{ display: "flex", alignItems: "center", gap: 2, borderRadius: 12, backgroundColor: props.activeId === t.id ? "#F5E8E0" : "transparent", opacity: props.deletingId === t.id ? 0.6 : 1 }}>
                  <button
                    type="button"
                    onClick={() => { setMenuFor(null); props.onOpenThread(t.id); }}
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
                    className="cursor-pointer flex items-center justify-center shrink-0 rounded-lg hover:bg-black/5"
                    style={{ width: 40, height: 40, border: "none", background: "none", color: "rgba(26,18,8,0.5)" }}
                  >
                    ⋯
                  </button>
                </div>
                {menuFor === t.id && (
                  <div role="menu" style={{ position: "absolute", right: 8, top: 44, zIndex: 75, minWidth: 150, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, boxShadow: "0 8px 24px rgba(26,18,8,0.14)" }}>
                    <button type="button" role="menuitem" className="cursor-pointer w-full flex items-center gap-2 text-left hover:bg-[#F5E8E0]/50 rounded-t-xl" style={{ background: "none", border: "none", padding: "11px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}
                      onClick={() => { setRenaming({ id: t.id, title: t.title }); setRenameError(null); setMenuFor(null); }}>
                      <Pencil size={15} /> Rename
                    </button>
                    <button type="button" role="menuitem" className="cursor-pointer w-full flex items-center gap-2 text-left hover:bg-[#FDF0F0] rounded-b-xl" style={{ background: "none", border: "none", padding: "11px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#A8401C" }}
                      onClick={() => { setDeleting({ id: t.id, title: t.title }); setMenuFor(null); }}>
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ));
          })()}
          {props.hasMore && !searchQuery.trim() && (
            <button type="button" onClick={props.onLoadMore} className="cursor-pointer w-full" style={{ height: 44, borderRadius: 12, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)", marginTop: 8 }}>
              Load older chats
            </button>
          )}
        </nav>
        <div style={{ borderTop: "1px solid #E8E0D4", padding: 10 }} className="flex flex-col gap-0.5">
          <div className="grid grid-cols-2 gap-1">
            <button type="button" onClick={() => navigate("/settings/memory")} className="cursor-pointer flex items-center gap-2 text-left rounded-xl hover:bg-[#F5E8E0]/50" style={{ height: 40, border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 500, color: "rgba(26,18,8,0.75)", padding: "0 10px" }}>
              <Brain size={15} color="#C8522A" /> Memory
            </button>
            <button type="button" onClick={() => navigate("/voice")} className="cursor-pointer flex items-center gap-2 text-left rounded-xl hover:bg-[#F5E8E0]/50" style={{ height: 40, border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 500, color: "rgba(26,18,8,0.75)", padding: "0 10px" }}>
              <Mic size={15} color="#C8522A" /> My Voice
            </button>
          </div>
          <button type="button" onClick={() => navigate("/history")} className="cursor-pointer flex items-center gap-2 w-full text-left rounded-xl hover:bg-[#F5E8E0]/50" style={{ height: 40, border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 500, color: "rgba(26,18,8,0.72)", padding: "0 10px" }}>
            <History size={15} /> History
          </button>
          <button type="button" onClick={() => navigate("/settings")} className="cursor-pointer flex items-center gap-2 w-full text-left rounded-xl hover:bg-[#F5E8E0]/50" style={{ height: 40, border: "none", background: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, fontWeight: 500, color: "rgba(26,18,8,0.72)", padding: "0 10px" }}>
            <Settings size={15} /> Settings
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
