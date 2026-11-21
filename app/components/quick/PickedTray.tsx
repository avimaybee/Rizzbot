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
      className="mt-3 rounded-[18px] bg-[#FDFAF5] border border-[#E8E0D4] p-4"
      style={{ boxShadow: "0 2px 10px rgba(26, 18, 8, 0.04)" }}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5 pb-2.5 border-b border-[#E8E0D4]">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[#C8522A] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Picked lines · {items.length}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer text-xs font-medium text-[rgba(26,18,8,0.5)] hover:text-[#1A1208] transition-colors"
          style={{ background: "none", border: "none", fontFamily: "'DM Sans', sans-serif" }}
        >
          Clear
        </button>
      </div>

      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 240 }}>
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-start gap-2.5 rounded-xl bg-[#F5EFE6] border border-[#E8E0D4] px-3 py-2.5"
          >
            <span
              className="shrink-0 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#C8522A] mt-0.5"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {item.tone}
            </span>
            <p className="flex-1 text-[13.5px] leading-[1.45] text-[#1A1208] whitespace-pre-wrap break-words m-0" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {item.text}
            </p>
            <button
              type="button"
              onClick={() => onRemove(item.key)}
              aria-label="Remove picked line"
              className="cursor-pointer shrink-0 p-1 rounded-md text-[rgba(26,18,8,0.4)] hover:text-[#1A1208] transition-colors"
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
        className="w-full cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors"
        style={{
          marginTop: 10,
          height: 40,
          backgroundColor: copied ? "#EAF0EA" : "#F5E8E0",
          color: copied ? "#466348" : "#A8401C",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          border: "1px solid #E8E0D4",
        }}
      >
        {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
        <span>{copied ? "Copied combined" : `Copy combined (${items.length})`}</span>
      </button>
    </section>
  );
};
