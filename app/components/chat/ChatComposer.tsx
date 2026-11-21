import { useEffect, useRef, useState } from "react";
import { CornerDownRight, ImagePlus, Mic, Plus, Reply, Send, Square, Trash2, X } from "lucide-react";
import { MAX_QUICK_SCREENSHOTS, optimizeImageFile } from "../../utils/imageOptimize";
import { getSupportedMimeType } from "../../hooks/useVoiceRecorder";
import { transcribeAudio } from "../../../services/voiceService";
import type { ReplyQuote } from "../../../services/chatApi";
import { haptics } from "../../utils/haptics";

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
  onStop?: () => void;
  quoteReply?: ReplyQuote | null;
  onClearQuote?: () => void;
  refineLabel?: string | null;
  onClearRefine?: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  skippedNote: string | null;
  onSkippedNoteChange: (v: string | null) => void;
  droppedFiles?: File[] | null;
  onDroppedFilesHandled?: () => void;
}

const MAX_CHARS = 12_000;
const MAX_VOICE_SEC = 300;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|heic|heif|bmp|avif)$/i;

function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - padding;
}

function isLikelyImageFile(file: File): boolean {
  if (file.type && file.type.startsWith("image/")) return true;
  if (!file.type && IMAGE_EXT_RE.test(file.name)) return true;
  return IMAGE_EXT_RE.test(file.name);
}

export function ChatComposer(props: ChatComposerProps) {
  const { draft, onDraftChange, attachments, onAttachmentsChange, sending, preparing, onSend } = props;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [textError, setTextError] = useState(false);
  const optimizingRef = useRef(false);
  const fileQueueRef = useRef<File[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const manualStopRef = useRef(false);
  const cancelledRef = useRef(false);
  const hadAudioEnergyRef = useRef(false);
  const analyserActiveRef = useRef(false);
  const autoStopTriggeredRef = useRef(false);
  const lightboxReturnRef = useRef<HTMLElement | null>(null);

  // Refs prevent stale closures inside MediaRecorder/transcription callbacks
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const cursorPosRef = useRef<number | null>(null);

  // On Android Chrome, `accept="image/*"` often launches an OEM single-tap Gallery that blocks multi-select.
  // Omitting `accept` on Android routes through Android's multi-select Files/Photos chooser (`EXTRA_ALLOW_MULTIPLE`).
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !sending && !preparing && !optimizing && !recording && !transcribing && !capturedBlob;
  const showCount = draft.length >= 10_500;

  const updateDraft = (value: string) => {
    const withinLimit = value.length <= MAX_CHARS;
    setTextError(!withinLimit);
    if (withinLimit) {
      draftRef.current = value;
      onDraftChange(value);
    }
  };

  const cleanupAudioHardware = () => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAudioLevel(0);
  };

  useEffect(() => () => {
    cancelledRef.current = true;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch { /* ignore */ }
    cleanupAudioHardware();
  }, []);

  useEffect(() => {
    const el = props.textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [draft, props.textareaRef]);

  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  useEffect(() => {
    if (props.droppedFiles && props.droppedFiles.length > 0) {
      const files = props.droppedFiles;
      props.onDroppedFilesHandled?.();
      void addFiles(files);
    }
  }, [props.droppedFiles]);

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    fileQueueRef.current.push(...files);
    if (optimizingRef.current) return;

    optimizingRef.current = true;
    setOptimizing(true);
    props.onSkippedNoteChange(null);
    const notes: string[] = [];
    let skippedCount = 0;
    let skippedBytes = 0;
    let skippedNonImage = 0;
    try {
      while (fileQueueRef.current.length > 0) {
        const file = fileQueueRef.current.shift()!;
        if (!isLikelyImageFile(file)) {
          skippedNonImage++;
          continue;
        }
        if (attachmentsRef.current.length >= MAX_QUICK_SCREENSHOTS) {
          skippedCount += 1 + fileQueueRef.current.length;
          fileQueueRef.current = [];
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
          notes.push(`Couldn’t read “${file.name || "that image"}”. Try PNG, JPEG, or WebP.`);
        }
      }
    } finally {
      if (skippedCount) notes.push(`${skippedCount} skipped — up to ${MAX_QUICK_SCREENSHOTS} images at once.`);
      if (skippedBytes) notes.push(`${skippedBytes} skipped — total images capped at 8 MB.`);
      if (skippedNonImage) notes.push(`${skippedNonImage} non-image file${skippedNonImage > 1 ? "s" : ""} skipped.`);
      props.onSkippedNoteChange(notes.length ? notes.join(" ") : null);
      optimizingRef.current = false;
      setOptimizing(false);
    }
  };

  const runTranscribeBlob = async (blob: Blob) => {
    if (!blob || blob.size < 64) {
      setVoiceError("Didn’t catch any audio — try speaking a little closer.");
      return;
    }
    if (analyserActiveRef.current && !hadAudioEnergyRef.current) {
      setCapturedBlob(null);
      setVoiceError("No speech detected — check your mic or speak a bit closer.");
      return;
    }
    setTranscribing(true);
    setVoiceError(null);
    try {
      const result = await transcribeAudio(blob, "therapist");
      const text = (result.cleanedTranscript || result.transcript || "").trim();
      if (!text) {
        setVoiceError("Didn’t catch any clear words in that clip.");
        return;
      }
      setCapturedBlob(null);
      const currentDraft = draftRef.current;
      const el = props.textareaRef.current;
      const rawCursor = cursorPosRef.current ?? el?.selectionStart ?? currentDraft.length;
      const cursor = Math.min(Math.max(0, rawCursor), currentDraft.length);
      const before = currentDraft.slice(0, cursor);
      const after = currentDraft.slice(cursor);
      const sepBefore = before.length > 0 && !/[\s\n]$/.test(before) ? " " : "";
      const sepAfter = after.length > 0 && !/^[\s\n]/.test(after) ? " " : "";
      const next = before + sepBefore + text + sepAfter + after;
      const nextCursor = (before + sepBefore + text).length;
      cursorPosRef.current = null;
      updateDraft(next);
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          try { el.setSelectionRange(nextCursor, nextCursor); } catch { /* ignore */ }
        }
      });
    } catch (err: any) {
      setCapturedBlob(blob);
      setVoiceError(err?.message && err.message !== "Transcription failed" ? err.message : "Couldn’t transcribe that recording. Tap retry.");
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    cursorPosRef.current = props.textareaRef.current?.selectionStart ?? draftRef.current.length;
    setVoiceError(null);
    setCapturedBlob(null);
    manualStopRef.current = false;
    cancelledRef.current = false;
    hadAudioEnergyRef.current = false;
    analyserActiveRef.current = false;
    autoStopTriggeredRef.current = false;
    haptics.light();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = getSupportedMimeType();
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, { mimeType: preferredMime });
        mimeTypeRef.current = preferredMime;
      } catch {
        rec = new MediaRecorder(stream);
        mimeTypeRef.current = rec.mimeType || "audio/webm";
      }
      mediaRecorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onerror = () => {
        if (chunksRef.current.length > 0) {
          const fallbackBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current || rec.mimeType || "audio/webm" });
          setCapturedBlob(fallbackBlob);
        }
        setRecording(false);
        cleanupAudioHardware();
      };

      rec.onstop = () => {
        cleanupAudioHardware();
        setRecording(false);
        if (cancelledRef.current) {
          chunksRef.current = [];
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || rec.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (manualStopRef.current) {
          void runTranscribeBlob(blob);
        } else if (blob.size >= 64) {
          setCapturedBlob(blob);
          setVoiceError("Recording stopped early — tap Transcribe to keep what was captured.");
        }
      };

      rec.start(1000);
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((t) => {
          const next = t + 1;
          if (next >= MAX_VOICE_SEC && !autoStopTriggeredRef.current) {
            autoStopTriggeredRef.current = true;
            setTimeout(() => transcribeRecording(), 0);
          }
          return next;
        });
      }, 1000);

      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserActiveRef.current = true;
        const bins = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(bins);
          let sum = 0;
          for (let i = 0; i < bins.length; i++) sum += bins[i];
          const avg = sum / bins.length;
          if (avg > 6) hadAudioEnergyRef.current = true;
          setAudioLevel(Math.min(1, avg / 96));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch { /* visual level optional */ }
    } catch {
      cleanupAudioHardware();
      setVoiceError("Microphone access is off. You can still type.");
    }
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    manualStopRef.current = false;
    setCapturedBlob(null);
    setVoiceError(null);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch { /* ignore */ }
    cleanupAudioHardware();
    setRecording(false);
    setRecordingTime(0);
  };

  const transcribeRecording = () => {
    if (capturedBlob && !recording) {
      void runTranscribeBlob(capturedBlob);
      return;
    }
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    manualStopRef.current = true;
    try {
      if (rec.state === "recording") {
        try { rec.requestData(); } catch { /* ignore */ }
        rec.stop();
      } else {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
        chunksRef.current = [];
        setRecording(false);
        cleanupAudioHardware();
        void runTranscribeBlob(blob);
      }
    } catch {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" });
      chunksRef.current = [];
      setRecording(false);
      cleanupAudioHardware();
      void runTranscribeBlob(blob);
    }
  };

  const removeAttachmentAt = (index: number) => {
    const target = attachments[index];
    if (!target) return;
    const next = attachments.filter((x) => x.id !== target.id);
    onAttachmentsChange(next);
    if (lightbox !== null) {
      if (next.length === 0) setLightbox(null);
      else if (lightbox >= next.length) setLightbox(next.length - 1);
    }
  };

  const openFilePicker = () => {
    if (attachments.length >= MAX_QUICK_SCREENSHOTS) {
      props.onSkippedNoteChange(`You already have ${MAX_QUICK_SCREENSHOTS} images attached. Remove one to add another.`);
      return;
    }
    fileRef.current?.click();
  };

  const showVoiceBar = recording || transcribing || Boolean(capturedBlob);

  return (
    <div>
      {props.quoteReply && (
        <div
          className="flex items-center gap-2.5 mb-2 px-3 py-2 rounded-2xl"
          style={{
            backgroundColor: "#FBF5EE",
            border: "1px solid #EAD7CA",
            borderLeft: "3px solid #C8522A",
          }}
        >
          <Reply size={14} strokeWidth={2.2} color="#C8522A" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p
              className="truncate"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 700, color: "#9E3B1A", margin: 0 }}
            >
              Replying to {props.quoteReply.author}
            </p>
            <p
              className="truncate"
              style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "rgba(26,18,8,0.68)", margin: 0 }}
            >
              {props.quoteReply.text}
            </p>
          </div>
          {props.onClearQuote && (
            <button
              type="button"
              onClick={props.onClearQuote}
              aria-label="Clear quoted reply"
              className="cursor-pointer shrink-0 rounded-full p-1 hover:bg-black/5"
              style={{ background: "none", border: "none", color: "rgba(26,18,8,0.5)", display: "flex" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {props.refineLabel && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAD7CA] bg-[#F5E8E0] px-3 py-1.5" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1208" }}>
            <CornerDownRight size={13} strokeWidth={2.2} color="#C8522A" />
            {props.refineLabel}
            {props.onClearRefine && (
              <button type="button" onClick={props.onClearRefine} aria-label="Clear refinement reference" className="cursor-pointer ml-0.5 rounded-full hover:bg-black/5 p-0.5" style={{ background: "none", border: "none", color: "rgba(26,18,8,0.55)", display: "flex" }}>
                <X size={13} />
              </button>
            )}
          </span>
        </div>
      )}
      {attachments.length > 0 && (
        <div className="mb-1.5">
          <div className="flex items-center justify-between px-0.5 mb-1.5">
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 600, color: "rgba(26,18,8,0.55)" }}>
              {attachments.length} / {MAX_QUICK_SCREENSHOTS} image{attachments.length > 1 ? "s" : ""} attached
            </span>
            {attachments.length > 1 && (
              <button
                type="button"
                onClick={() => onAttachmentsChange([])}
                className="cursor-pointer hover:text-[#1A1208] transition-colors"
                style={{ background: "none", border: "none", padding: 0, fontFamily: "'DM Sans', sans-serif", fontSize: 11.5, fontWeight: 600, color: "rgba(26,18,8,0.48)" }}
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1.5 pt-1.5" role="list" aria-label="Attached images">
            {attachments.map((a, i) => (
              <div key={a.id} role="listitem" className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => { lightboxReturnRef.current = document.activeElement as HTMLElement; setLightbox(i); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lightboxReturnRef.current = document.activeElement as HTMLElement; setLightbox(i); } }}
                  aria-label={`Open image ${i + 1} of ${attachments.length}`}
                  className="cursor-pointer block"
                  style={{ background: "none", border: "none", padding: 0 }}
                >
                  <img src={a.preview} alt={`Attached image ${i + 1}`} style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", border: "1px solid #E8E0D4" }} />
                </button>
                <span aria-hidden="true" style={{ position: "absolute", left: 4, bottom: 4, backgroundColor: "rgba(26,18,8,0.68)", color: "#fff", fontSize: 10, fontWeight: 600, borderRadius: 6, padding: "1px 5px", fontFamily: "'DM Sans', sans-serif" }}>{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeAttachmentAt(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", backgroundColor: "#1A1208", border: "2px solid #F5EFE6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {attachments.length < MAX_QUICK_SCREENSHOTS && (
              <button
                type="button"
                onClick={openFilePicker}
                aria-label="Add more images"
                title="Add more images"
                className="cursor-pointer shrink-0 flex flex-col items-center justify-center gap-0.5 transition-colors hover:bg-[#F5E8E0]/60"
                style={{ width: 60, height: 60, borderRadius: 12, border: "1.5px dashed #D6CBBF", backgroundColor: "#FDFAF5", color: "rgba(26,18,8,0.55)" }}
              >
                <Plus size={18} strokeWidth={2} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600 }}>Add</span>
              </button>
            )}
          </div>
        </div>
      )}
      {props.skippedNote && (
        <div role="status" className="flex items-center justify-between gap-2 mb-1.5 px-1">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", margin: 0 }}>{props.skippedNote}</p>
          <button type="button" onClick={() => props.onSkippedNoteChange(null)} className="cursor-pointer shrink-0" style={{ background: "none", border: "none", fontSize: 11.5, fontWeight: 600, color: "rgba(26,18,8,0.5)" }}>Dismiss</button>
        </div>
      )}
      <div
        onClick={(e) => {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag !== "BUTTON" && tag !== "INPUT" && tag !== "TEXTAREA") {
            props.textareaRef.current?.focus();
          }
        }}
        className="transition-all border border-[#E8E0D4] focus-within:border-[#C8522A]/50 focus-within:shadow-[0_0_0_3px_rgba(200,82,42,0.08)] shadow-[0_2px_10px_rgba(26,18,8,0.04)]"
        style={{ backgroundColor: "#FDFAF5", borderRadius: 22, padding: "9px 10px" }}
      >
        <label htmlFor="chat-composer-input" className="sr-only">Message Kai</label>
        <textarea
          id="chat-composer-input"
          ref={props.textareaRef}
          value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          onPaste={(e) => {
            const pastedFiles: File[] = [];
            const seen = new Set<string>();
            const pushUnique = (f: File | null) => {
              if (!f || !isLikelyImageFile(f)) return;
              const sig = `${f.name}:${f.size}:${f.type}`;
              if (seen.has(sig)) return;
              seen.add(sig);
              pastedFiles.push(f);
            };
            if (e.clipboardData?.files?.length) {
              for (let i = 0; i < e.clipboardData.files.length; i++) pushUnique(e.clipboardData.files[i]);
            }
            const items = e.clipboardData?.items;
            if (items) {
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith("image/")) pushUnique(items[i].getAsFile());
              }
            }
            if (pastedFiles.length) {
              e.preventDefault();
              const text = e.clipboardData?.getData("text/plain");
              if (text) {
                const { selectionStart, selectionEnd } = e.currentTarget;
                updateDraft(draft.slice(0, selectionStart) + text + draft.slice(selectionEnd));
              }
              void addFiles(pastedFiles);
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
          placeholder={attachments.length > 0 ? "Add context or ask what to reply…" : "Message Kai…"}
          rows={1}
          className="border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          style={{ width: "100%", resize: "none", overflowY: "auto", background: "transparent", border: "none", outline: "none", boxShadow: "none", padding: "3px 6px", fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: "#1A1208", minHeight: 24, maxHeight: 160, lineHeight: 1.5 }}
        />
        {showVoiceBar ? (
          <div className="flex items-center gap-2.5 pt-1.5 px-1" role="status" aria-live="polite">
            {transcribing ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="w-4 h-4 rounded-full animate-spin shrink-0" style={{ border: "2px solid rgba(200,82,42,0.2)", borderTopColor: "#C8522A" }} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(26,18,8,0.65)" }}>
                  Transcribing audio…
                </span>
              </div>
            ) : recording ? (
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8522A] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C8522A]" />
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: recordingTime >= MAX_VOICE_SEC - 20 ? "#C8522A" : "#1A1208" }}>
                  {`${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, "0")}`}
                </span>
                {recordingTime >= MAX_VOICE_SEC - 20 && (
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "#C8522A" }}>
                    · max 5:00
                  </span>
                )}
                <div className="flex items-center gap-0.5 h-5" aria-hidden="true">
                  {[0.45, 0.8, 1, 0.7, 0.5].map((m, idx) => (
                    <span
                      key={idx}
                      style={{
                        width: 3,
                        height: `${Math.max(4, Math.round(4 + audioLevel * 16 * m))}px`,
                        borderRadius: 99,
                        backgroundColor: "#C8522A",
                        opacity: 0.45 + audioLevel * 0.55,
                        transition: "height 80ms ease-out",
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <span className="flex-1 truncate" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(26,18,8,0.7)" }}>
                Audio clip ready
              </span>
            )}
            <button type="button" onClick={cancelRecording} disabled={transcribing} className="cursor-pointer transition-colors hover:bg-[#F5EFE6]" style={{ height: 38, padding: "0 13px", borderRadius: 12, border: "1px solid #E8E0D4", background: "transparent", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(26,18,8,0.65)", opacity: transcribing ? 0.5 : 1 }}>
              Discard
            </button>
            {!transcribing && (
              <button type="button" onClick={transcribeRecording} className="cursor-pointer flex items-center gap-1.5 transition-transform active:scale-95" style={{ height: 38, padding: "0 15px", borderRadius: 12, border: "none", backgroundColor: "#A8401C", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}>
                {recording && <Square size={11} fill="#fff" />}
                Transcribe
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 pt-1">
            <input
              ref={fileRef}
              type="file"
              accept={isAndroid ? undefined : "image/*"}
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const picked = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                void addFiles(picked);
              }}
            />
            <button
              type="button"
              onClick={openFilePicker}
              aria-label="Attach up to 10 images"
              title="Attach images (up to 10)"
              className="cursor-pointer flex items-center justify-center rounded-xl transition-colors hover:bg-[#F5E8E0]/60"
              style={{ width: 40, height: 40, border: "none", background: "none", color: attachments.length > 0 ? "#C8522A" : "rgba(26,18,8,0.62)" }}
            >
              <ImagePlus size={19} />
            </button>
            <button
              type="button"
              onClick={() => void startRecording()}
              aria-label="Record voice"
              title="Voice note"
              className="cursor-pointer flex items-center justify-center rounded-xl transition-colors hover:bg-[#F5E8E0]/60"
              style={{ width: 40, height: 40, border: "none", background: "none", color: "rgba(26,18,8,0.62)" }}
            >
              <Mic size={19} />
            </button>
            {showCount && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: draft.length >= 11_800 ? "#A8401C" : "rgba(26,18,8,0.45)", marginLeft: 4 }}>{draft.length.toLocaleString()} / 12,000</span>
            )}
            <span className="flex-1" />
            {sending && props.onStop ? (
              <button
                type="button"
                onClick={() => { haptics.light(); props.onStop?.(); }}
                aria-label="Stop generating"
                title="Stop generating"
                className="cursor-pointer flex items-center justify-center transition-all active:scale-95 hover:opacity-90"
                style={{ width: 40, height: 40, borderRadius: 20, border: "none", backgroundColor: "#1A1208", color: "#fff" }}
              >
                <Square size={14} fill="#fff" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                aria-label="Send message"
                title="Send"
                className={canSend ? "cursor-pointer flex items-center justify-center transition-all active:scale-95 hover:opacity-95" : "cursor-default flex items-center justify-center transition-all"}
                style={{ width: 40, height: 40, borderRadius: 20, border: "none", backgroundColor: canSend ? "#A8401C" : "#E8E0D4", color: "#fff", opacity: canSend ? 1 : 0.6 }}
              >
                <Send size={17} />
              </button>
            )}
          </div>
        )}
        {optimizing && (
          <div role="status" className="flex items-center gap-2 px-1.5 pt-1.5">
            <span className="w-3.5 h-3.5 rounded-full animate-spin shrink-0" style={{ border: "2px solid rgba(200,82,42,0.2)", borderTopColor: "#C8522A" }} />
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.6)" }}>Optimizing images…</span>
          </div>
        )}
        {textError && <p role="alert" className="text-sm text-[#A8401C] px-1.5 pt-1">Keep your message to 12,000 characters.</p>}
        {voiceError && (
          <div role="alert" className="flex items-center justify-between gap-2 px-1.5 pt-1.5">
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#A8401C", fontWeight: 500 }}>{voiceError}</span>
            <button type="button" onClick={() => { setVoiceError(null); setCapturedBlob(null); }} className="cursor-pointer shrink-0" style={{ background: "none", border: "none", fontSize: 12, color: "rgba(26,18,8,0.5)", fontWeight: 600 }}>Dismiss</button>
          </div>
        )}
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
              <button type="button" disabled={lightbox === 0} onClick={() => setLightbox(lightbox - 1)} aria-label="Previous image" className="cursor-pointer" style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid #E8E0D4", background: lightbox === 0 ? "#F5EFE6" : "#fff", opacity: lightbox === 0 ? 0.4 : 1 }}>‹</button>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.6)" }}>Image {lightbox + 1} of {attachments.length}</span>
              <button type="button" disabled={lightbox === attachments.length - 1} onClick={() => setLightbox(lightbox + 1)} aria-label="Next image" className="cursor-pointer" style={{ width: 42, height: 42, borderRadius: 12, border: "1px solid #E8E0D4", background: lightbox === attachments.length - 1 ? "#F5EFE6" : "#fff", opacity: lightbox === attachments.length - 1 ? 0.4 : 1 }}>›</button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => removeAttachmentAt(lightbox)}
                aria-label={`Remove image ${lightbox + 1}`}
                className="cursor-pointer flex items-center justify-center gap-1.5"
                style={{ height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid #E8E0D4", backgroundColor: "#FDF0F0", color: "#A8401C", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600 }}
              >
                <Trash2 size={15} /> Remove
              </button>
              <button type="button" onClick={() => { setLightbox(null); lightboxReturnRef.current?.focus(); }} className="cursor-pointer flex-1" style={{ height: 44, borderRadius: 12, border: "none", backgroundColor: "#1A1208", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
