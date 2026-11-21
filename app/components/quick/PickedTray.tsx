import type React from "react";
import { Check, Copy, X } from "lucide-react";

export interface PickedItem {
  key: string;
  tone: string;
  text: string;
}

interface PickedTrayProps {
  items: PickedItem[];
  copied: boolean;
  onCopyAll: () => void;
  onRemove: (key: string) => void;
  onClear: () => void;
}

export const PickedTray: React.FC<PickedTrayProps> = ({
  items,
  copied,
  onCopyAll,
  onRemove,
  onClear,
}) => {
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Picked lines"
      className="mt-3 rounded-2xl bg-[#181617] border border-[#2A2627] p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-[#252223]">
        <span className="text-xs uppercase tracking-[0.12em] text-[#D47254] font-semibold">
          Picked lines · {items.length}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer text-xs font-medium text-[#A69F95] hover:text-[#F2EFE9] transition-colors"
          style={{ background: "none", border: "none", fontFamily: "'DM Sans', sans-serif" }}
        >
          Clear
        </button>
      </div>

      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 240 }}>
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-start gap-2 rounded-xl bg-[#221F20] border border-[#302C2D] px-3 py-2.5"
          >
            <span
              className="shrink-0 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#D47254] mt-0.5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {item.tone}
            </span>
            <p className="flex-1 text-[13.5px] leading-[1.45] text-[#F2EFE9] whitespace-pre-wrap break-words" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {item.text}
            </p>
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              aria-label="Remove picked line"
              className="cursor-pointer shrink-0 p-1 rounded-md text-[#8E8A84] hover:text-[#F2EFE9] transition-colors"
              style={{ background: "none", border: "none" }}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onCopyAll}
        className="w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors"
        style={{
          marginTop: 12,
          height: 44,
          backgroundColor: copied ? "rgba(107,158,120,0.2)" : "rgba(212,114,84,0.15)",
          color: copied ? "#8FCE9D" : "#E3886B",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          border: "none",
        }}
      >
        {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
        <span>{copied ? "Copied combined" : `Copy combined (${items.length})`}</span>
      </button>
    </section>
  );
};
