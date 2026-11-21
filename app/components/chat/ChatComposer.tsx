import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, MoreHorizontal, Send, X } from "lucide-react";
import { MAX_QUICK_SCREENSHOTS, optimizeImageFile } from "../../utils/imageOptimize";
import { transcribeAudio } from "../../../services/voiceService";

export interface ComposerAttachment {
  id: string;
  preview: string;
  data: string;
  mimeType: string;
  width: number;
  height: number;
}

interface ChatComposerProps {
  draft: string;
  onDraftChange: (v: string) => void;
  attachments: ComposerAttachment[];
  onAttachmentsChange: (v: ComposerAttachment[]) => void;
  sending: boolean;
  preparing: boolean;
  onSend: () => void;
  draftAction: "draft" | null;
  onDraftActionChange: (v: "draft" | null) => void;
  refineLabel: string | null;
  onClearRefine: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  skippedNote: string | null;
  onSkippedNoteChange: (v: string | null) => void;
}

const MAX_CHARS = 12_000;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - padding;
}

export function ChatComposer(props: ChatComposerProps) {
  const { draft, onDraftChange, attachments, onAttachmentsChange, sending, preparing, onSend } = props;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [textError, setTextError] = useState(false);
  const optimizingRef = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const lightboxReturnRef = useRef<HTMLElement | null>(null);

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !sending && !preparing && !optimizing && !recording && !transcribing;
  const showCount = draft.length >= 11_500;
  const updateDraft = (value: string) => {
    const withinLimit = value.length <= MAX_CHARS;
    setTextError(!withinLimit);
    if (withinLimit) onDraftChange(value);
  };

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const el = props.textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
    }
  }, [draft, props.textareaRef]);

  const addFiles = async (files: File[]) => {
    if (!files.length || optimizingRef.current) return;
    optimizingRef.current = true;
    setOptimizing(true);
    props.onSkippedNoteChange(null);
    const notes: string[] = [];
    let skippedCount = 0;
    let skippedBytes = 0;
    try {
      for (const [index, file] of files.entries()) {
        if (attachmentsRef.current.length >= MAX_QUICK_SCREENSHOTS) {
          skippedCount = files.length - index;
          break;
        }
        try {
          const image = await optimizeImageFile(file);
          const total = attachmentsRef.current.reduce((bytes, item) => bytes + decodedBytes(item.data), 0);
          if (total + decodedBytes(image.data) > MAX_ATTACHMENT_BYTES) {
            skippedBytes++;
            continue;
          }
          const next = [...attachmentsRef.current, image];
          attachmentsRef.current = next;
          onAttachmentsChange(next);
        } catch {
          notes.push(`Couldn’t open image ${index + 1}. Try a PNG, JPEG, or WebP.`);
        }
      }
    } finally {
      if (skippedCount) notes.push(`${skippedCount} skipped. You can attach up to 10 images.`);
      if (skippedBytes) notes.push(`${skippedBytes} skipped. Images can total up to 8 MB.`);
      props.onSkippedNoteChange(notes.length ? notes.join(" ") : null);
      optimizingRef.current = false;
      setOptimizing(false);
    }
  };

  // Keep a ref to avoid stale closures in the loop above
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const startRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start();
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setVoiceError("Microphone access is off. You can still type.");
    }
  };

  const cancelRecording = () => {
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
    setRecordingTime(0);
  };

  const transcribeRecording = async () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      try { rec.stop(); } catch { resolve(new Blob(chunksRef.current)); }
    });
    const blob = await done;
    rec.stream?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
    setTranscribing(true);
    setVoiceError(null);
    try {
      const result = await transcribeAudio(blob, "myvoice");
      const text = (result.cleanedTranscript || result.transcript || "").trim();
      if (text) {
        const el = props.textareaRef.current;
        const cursor = el?.selectionStart ?? draft.length;
        const next = draft.slice(0, cursor) + (cursor > 0 && !draft.endsWith("\n") ? "\n" : "") + text + draft.slice(cursor);
        updateDraft(next);
        requestAnimationFrame(() => { el?.focus(); });
      }
    } catch {
      setVoiceError("Couldn’t transcribe that recording. Try again.");
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div>
      {(props.draftAction === "draft" || props.refineLabel) && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {props.draftAction === "draft" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E0D4] bg-[#FDFAF5] px-3 py-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1208" }}>
              Draft replies
              <button type="button" onClick={() => props.onDraftActionChange(null)} aria-label="Remove draft replies action" className="cursor-pointer" style={{ background: "none", border: "none", color: "rgba(26,18,8,0.5)", display: "flex" }}>
                <X size={13} />
              </button>
            </span>
          )}
          {props.refineLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E0D4] bg-[#FDFAF5] px-3 py-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1208" }}>
              {props.refineLabel}
              <button type="button" onClick={props.onClearRefine} aria-label="Clear refinement reference" className="cursor-pointer" style={{ background: "none", border: "none", color: "rgba(26,18,8,0.5)", display: "flex" }}>
                <X size={13} />
              </button>
            </span>
          )}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-1" role="list" aria-label="Attached images">
          {attachments.map((a, i) => (
            <div key={a.id} role="listitem" className="relative shrink-0">
              <button
                type="button"
                onClick={() => { lightboxReturnRef.current = document.activeElement as HTMLElement; setLightbox(i); }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lightboxReturnRef.current = document.activeElement as HTMLElement; setLightbox(i); } }}
                aria-label={`Open image ${i + 1} of ${attachments.length}`}
                className="cursor-pointer"
                style={{ background: "none", border: "none", padding: 0 }}
              >
                <img src={a.preview} alt={`Attached image ${i + 1}`} style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", border: "1px solid #E8E0D4" }} />
              </button>
              <span aria-hidden="true" style={{ position: "absolute", left: 4, bottom: 4, backgroundColor: "rgba(26,18,8,0.65)", color: "#fff", fontSize: 10, borderRadius: 8, padding: "0 6px", fontFamily: "'DM Sans', sans-serif" }}>{i + 1}</span>
              <button
                type="button"
                onClick={() => onAttachmentsChange(attachments.filter((x) => x.id !== a.id))}
                aria-label={`Remove image ${i + 1}`}
                className="cursor-pointer"
                style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, borderRadius: "50%", backgroundColor: "#C8522A", border: "2px solid #FDFAF5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {props.skippedNote && (
        <p role="status" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)", marginBottom: 6 }}>{props.skippedNote}</p>
      )}
      <div style={{ backgroundColor: "#FDFAF5", borderRadius: 20, padding: 8, border: "1px solid #E8E0D4" }}>
        <label htmlFor="chat-composer-input" className="sr-only">Message Rizzbot</label>
        <textarea
          id="chat-composer-input"
          ref={props.textareaRef}
          value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.startsWith("image/")) {
                const f = items[i].getAsFile();
                if (f) files.push(f);
              }
            }
            if (files.length) {
              e.preventDefault();
              const text = e.clipboardData.getData("text/plain");
              if (text) {
                const { selectionStart, selectionEnd } = e.currentTarget;
                updateDraft(draft.slice(0, selectionStart) + text + draft.slice(selectionEnd));
              }
              void addFiles(files);
            }
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            const isDesktop = window.matchMedia("(pointer: fine)").matches;
            if (e.key === "Enter" && !e.shiftKey && isDesktop) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="Message Rizzbot…"
          rows={1}
          className="focus-visible:ring-2 focus-visible:ring-[#A8401C]"
          style={{ width: "100%", resize: "none", overflowY: "auto", background: "transparent", border: "none", outline: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: "#1A1208", minHeight: 24, maxHeight: 144, lineHeight: 1.5 }}
        />
        {recording || transcribing ? (
          <div className="flex items-center gap-2 pt-1" role="status" aria-live="polite">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "#1A1208" }}>
              {transcribing ? "Transcribing…" : `${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, "0")}`}
            </span>
            <span className="flex-1" />
            <button type="button" onClick={cancelRecording} disabled={transcribing} className="cursor-pointer" style={{ height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)" }}>
              Cancel
            </button>
            {!transcribing && (
              <button type="button" onClick={() => void transcribeRecording()} className="cursor-pointer" style={{ height: 44, padding: "0 16px", borderRadius: 12, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>
                Transcribe
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 pt-1">
            <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1}
              onChange={(e) => { const f = e.target.files ? Array.from(e.target.files) : []; void addFiles(f); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach images" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "rgba(26,18,8,0.6)" }}>
              <ImagePlus size={19} />
            </button>
            <button type="button" onClick={() => void startRecording()} aria-label="Record voice" className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "rgba(26,18,8,0.6)" }}>
              <Mic size={19} />
            </button>
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="More actions" aria-expanded={menuOpen} className="cursor-pointer flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 12, border: "none", background: "none", color: "rgba(26,18,8,0.6)" }}>
                <MoreHorizontal size={19} />
              </button>
              {menuOpen && (
                <div role="menu" style={{ position: "absolute", bottom: 48, left: 0, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 14, boxShadow: "0 8px 24px rgba(26,18,8,0.12)", minWidth: 180, zIndex: 30 }}>
                  <button
                    type="button" role="menuitem"
                    onClick={() => { props.onDraftActionChange("draft"); props.onClearRefine(); setMenuOpen(false); props.textareaRef.current?.focus(); }}
                    className="cursor-pointer w-full text-left"
                    style={{ background: "none", border: "none", padding: "12px 14px", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208" }}
                  >
                    Draft replies
                  </button>
                </div>
              )}
            </div>
            {showCount && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(26,18,8,0.45)" }}>{draft.length.toLocaleString()} / 12,000</span>
            )}
            <span className="flex-1" />
            <button
              type="button" onClick={onSend} disabled={!canSend} aria-label="Send message"
              className="cursor-pointer flex items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 22, border: "none", backgroundColor: canSend ? "#A8401C" : "#E8E0D4", color: "#fff", opacity: canSend ? 1 : 0.6 }}
            >
              <Send size={18} />
            </button>
          </div>
        )}
        {optimizing && <p role="status" className="text-sm text-[#665A4E]">Preparing images…</p>}
        {textError && <p role="alert" className="text-sm text-[#A8401C]">Keep your message to 12,000 characters.</p>}
        {voiceError && <p role="alert" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", marginTop: 4 }}>{voiceError}</p>}
      </div>
      {lightbox !== null && attachments[lightbox] && (
        <div role="dialog" aria-modal="true" aria-label={`Image ${lightbox + 1} of ${attachments.length}`}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(26,18,8,0.7)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => { setLightbox(null); lightboxReturnRef.current?.focus(); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setLightbox(null); lightboxReturnRef.current?.focus(); }
            if (e.key === "ArrowRight" && lightbox < attachments.length - 1) setLightbox(lightbox + 1);
            if (e.key === "ArrowLeft" && lightbox > 0) setLightbox(lightbox - 1);
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90vw", maxHeight: "85vh", backgroundColor: "#FDFAF5", borderRadius: 16, padding: 12 }}>
            <img src={attachments[lightbox].preview} alt={`Attached image ${lightbox + 1}`} style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 12 }} />
            <div className="flex items-center justify-between mt-2">
              <button type="button" disabled={lightbox === 0} onClick={() => setLightbox(lightbox - 1)} aria-label="Previous image" className="cursor-pointer" style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #E8E0D4", background: lightbox === 0 ? "#F5EFE6" : "#fff", opacity: lightbox === 0 ? 0.4 : 1 }}>‹</button>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.6)" }}>Image {lightbox + 1} of {attachments.length}</span>
              <button type="button" disabled={lightbox === attachments.length - 1} onClick={() => setLightbox(lightbox + 1)} aria-label="Next image" className="cursor-pointer" style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid #E8E0D4", background: lightbox === attachments.length - 1 ? "#F5EFE6" : "#fff", opacity: lightbox === attachments.length - 1 ? 0.4 : 1 }}>›</button>
            </div>
            <button type="button" onClick={() => { setLightbox(null); lightboxReturnRef.current?.focus(); }} className="cursor-pointer w-full mt-2" style={{ height: 44, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
