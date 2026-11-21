import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { getLedger, patchLedger, type LedgerEntry } from "../../services/chatApi";

export function MemoryScreen() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [revision, setRevision] = useState(0);
  const [cap, setCap] = useState(40);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; text: string; label?: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LedgerEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getLedger();
      setEntries(res.entries);
      setRevision(res.revision);
      setCap(res.cap);
    } catch {
      setLoadError("Couldn’t load memory. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    if (text.length > 250) return;
    try {
      const op = editing.id ? "edit" as const : "add" as const;
      const res = await patchLedger({ revision, op, id: editing.id, text, label: editing.label?.trim() || undefined });
      setEntries(res.entries);
      setRevision(res.revision);
      setEditing(null);
      setConflict(false);
      setNotice(editing.id ? "Memory saved" : "Memory saved");
    } catch (e: any) {
      if (e?.message === "conflict" && e?.data) {
        setEntries(e.data.entries || []);
        setRevision(e.data.revision ?? revision);
        setConflict(true);
        // retain draft
      } else {
        setNotice("Couldn’t save. Try again.");
      }
    }
  };

  const remove = async (entry: LedgerEntry) => {
    try {
      const res = await patchLedger({ revision, op: "delete", id: entry.id });
      setEntries(res.entries);
      setRevision(res.revision);
      setConfirmDelete(null);
      setNotice("Memory deleted");
    } catch (e: any) {
      if (e?.message === "conflict" && e?.data) {
        setEntries(e.data.entries || []);
        setRevision(e.data.revision ?? revision);
        setConflict(true);
        setConfirmDelete(null);
      } else {
        setNotice("Couldn’t delete. Try again.");
      }
    }
  };

  const clearAll = async () => {
    try {
      const res = await patchLedger({ revision, op: "clear" });
      setEntries(res.entries);
      setRevision(res.revision);
      setConfirmClear(false);
      setNotice("Memory cleared");
    } catch (e: any) {
      if (e?.message === "conflict" && e?.data) {
        setEntries(e.data.entries || []);
        setRevision(e.data.revision ?? revision);
        setConflict(true);
        setConfirmClear(false);
      } else {
        setNotice("Couldn’t clear. Try again.");
      }
    }
  };

  return (
    <div className="relative min-h-screen pb-[72px]" style={{ backgroundColor: "#F5EFE6" }}>
      <div className="relative z-10 px-5 pt-4 max-w-[430px] mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} aria-label="Back" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4" }}>
            <ChevronLeft size={20} color="#1A1208" />
          </button>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: "#1A1208" }}>Memory</h1>
        </div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", marginTop: 8, lineHeight: 1.5 }}>
          Things Rizzbot can remember across your chats. You can change or remove any of them.
        </p>

        {notice && <p role="status" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#58745A", marginTop: 8 }}>{notice}</p>}
        {conflict && (
          <div style={{ backgroundColor: "#FEF3E2", border: "1px solid rgba(212,168,83,0.35)", borderRadius: 14, padding: "12px 14px", marginTop: 8 }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#7A5400" }}>Memory changed in another chat. Review the latest version before saving.</p>
            <button type="button" onClick={() => { setConflict(false); void load(); }} className="cursor-pointer mt-2" style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid #E8E0D4", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>Reload latest</button>
          </div>
        )}

        {loading ? (
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.5)", marginTop: 16 }}>Loading memory…</p>
        ) : loadError ? (
          <div style={{ backgroundColor: "#FDFAF5", borderRadius: 16, padding: 20, marginTop: 16, textAlign: "center" }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}>{loadError}</p>
            <button type="button" onClick={() => void load()} className="cursor-pointer mt-3" style={{ height: 44, padding: "0 18px", borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Retry</button>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ backgroundColor: "#FDFAF5", borderRadius: 20, border: "1px dashed rgba(26,18,8,0.15)", padding: "24px 18px", marginTop: 16, textAlign: "center" }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>No saved memories yet</p>
            <button type="button" onClick={() => setEditing({ text: "" })} disabled={entries.length >= cap} className="cursor-pointer mt-3" style={{ height: 48, padding: "0 22px", borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>
              Add memory
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-4">
            {entries.map((e) => (
              <div key={e.id} style={{ backgroundColor: "#FDFAF5", borderRadius: 16, border: "1px solid #E8E0D4", padding: "14px 16px" }}>
                {e.label && <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(26,18,8,0.45)", marginBottom: 4 }}>{e.label}</p>}
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", lineHeight: 1.5, overflowWrap: "anywhere" }}>{e.text}</p>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setEditing({ id: e.id, text: e.text, label: e.label })} aria-label={`Edit memory ${e.text.slice(0, 30)}`} className="cursor-pointer flex items-center gap-1.5" style={{ height: 44, padding: "0 14px", borderRadius: 10, border: "1px solid #E8E0D4", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208" }}>
                    <Pencil size={14} /> Edit memory
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(e)} aria-label={`Delete memory ${e.text.slice(0, 30)}`} className="cursor-pointer flex items-center gap-1.5" style={{ height: 44, padding: "0 14px", borderRadius: 10, border: "1px solid #E8E0D4", background: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#A8401C" }}>
                    <Trash2 size={14} /> Delete memory
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setEditing({ text: "" })}
                disabled={entries.length >= cap}
                className="cursor-pointer flex items-center gap-1.5 flex-1 justify-center"
                style={{ height: 48, borderRadius: 999, border: "none", backgroundColor: entries.length >= cap ? "#E8E0D4" : "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, opacity: entries.length >= cap ? 0.6 : 1 }}
              >
                <Plus size={16} /> Add memory
              </button>
              <button type="button" onClick={() => setConfirmClear(true)} className="cursor-pointer" style={{ height: 48, padding: "0 18px", borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(26,18,8,0.65)" }}>
                Clear all
              </button>
            </div>
            {entries.length >= cap && (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.55)" }}>Memory is full. Remove an entry to add another.</p>
            )}
          </div>
        )}

        {editing && (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, backgroundColor: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setEditing(null)}>
            <div role="dialog" aria-modal="true" aria-label={editing.id ? "Edit memory" : "Add memory"} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>{editing.id ? "Edit memory" : "Add memory"}</h3>
                <button type="button" onClick={() => setEditing(null)} aria-label="Close editor" className="cursor-pointer" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none" }}><X size={18} /></button>
              </div>
              <label htmlFor="memory-text" className="sr-only">Memory text</label>
              <textarea
                id="memory-text" autoFocus value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value.slice(0, 250) })}
                rows={3}
                style={{ width: "100%", marginTop: 12, borderRadius: 12, border: "1px solid #E8E0D4", padding: 12, fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#1A1208", backgroundColor: "#fff", resize: "vertical" }}
              />
              <div className="flex items-center justify-between mt-1">
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(26,18,8,0.45)" }}>{editing.text.length} / 250</span>
              </div>
              <label htmlFor="memory-label" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)", marginTop: 8, display: "block" }}>Label (optional)</label>
              <input id="memory-label" value={editing.label || ""} onChange={(e) => setEditing({ ...editing, label: e.target.value.slice(0, 60) })} style={{ width: "100%", marginTop: 4, height: 44, borderRadius: 10, border: "1px solid #E8E0D4", padding: "0 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }} />
              <button type="button" onClick={() => void save()} disabled={!editing.text.trim()} className="cursor-pointer w-full mt-4" style={{ height: 48, borderRadius: 999, border: "none", backgroundColor: !editing.text.trim() ? "#E8E0D4" : "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>
                Save
              </button>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, backgroundColor: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setConfirmDelete(null)}>
            <div role="alertdialog" aria-label="Delete memory" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>Delete this memory?</h3>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", marginTop: 8 }}>“{confirmDelete.text}”</p>
              <div className="flex gap-2 mt-4">
                <button type="button" autoFocus onClick={() => setConfirmDelete(null)} className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Cancel</button>
                <button type="button" onClick={() => void remove(confirmDelete)} className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {confirmClear && (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, backgroundColor: "rgba(26,18,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setConfirmClear(false)}>
            <div role="alertdialog" aria-label="Clear all memory" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, backgroundColor: "#FDFAF5", borderRadius: 20, padding: 20 }}>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "#1A1208" }}>Clear all memory?</h3>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", marginTop: 8 }}>This removes saved memory. Your chats stay.</p>
              <div className="flex gap-2 mt-4">
                <button type="button" autoFocus onClick={() => setConfirmClear(false)} className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Cancel</button>
                <button type="button" onClick={() => void clearAll()} className="cursor-pointer flex-1" style={{ height: 48, borderRadius: 999, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Clear all</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
