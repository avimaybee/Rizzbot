import type React from "react";
import { motion } from "motion/react";
import { Info } from "lucide-react";

type Tone = "Smooth" | "Bold" | "Witty" | "Authentic" | "Your Style";

interface ToneRailProps {
  toneOptions: readonly { key: Tone; help: string | null }[];
  toneHasOptions: (key: Tone) => boolean;
  activeTone: Tone;
  onSelectTone: (key: Tone) => void;
  showStyleTooltip: string | null;
  onToggleStyleTooltip: (key: Tone) => void;
  scrollFade: { ref: React.RefObject<HTMLDivElement | null>; style: React.CSSProperties };
}

export function ToneRail({
  toneOptions,
  toneHasOptions,
  activeTone,
  onSelectTone,
  showStyleTooltip,
  onToggleStyleTooltip,
  scrollFade,
}: ToneRailProps) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut", delay: 0.05 }}
      >
        <div
          ref={scrollFade.ref}
          className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar"
          style={scrollFade.style}
        >
          {toneOptions.map(({ key, help }) => (
            <div key={key} className="relative shrink-0" style={{ opacity: toneHasOptions(key) ? 1 : 0.35, transition: "opacity 0.2s ease" }}>
              <button
                onClick={() => onSelectTone(key)}
                className="flex items-center gap-1.5 cursor-pointer transition-colors"
                style={{
                  height: 40,
                  borderRadius: 100,
                  padding: "0 16px",
                  backgroundColor: activeTone === key ? "#1A1208" : "transparent",
                  color: activeTone === key ? "#FFFFFF" : "rgba(26, 18, 8, 0.55)",
                  border: activeTone === key ? "1px solid #1A1208" : "1px solid #E8E0D4",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {key}
                {help && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`About ${key}`}
                    className="cursor-pointer inline-flex items-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStyleTooltip(key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleStyleTooltip(key);
                      }
                    }}
                  >
                    <Info size={12} strokeWidth={2} color={activeTone === key ? "rgba(255,255,255,0.6)" : "rgba(26,18,8,0.35)"} />
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {showStyleTooltip && (
        <div className="mt-2" style={{ backgroundColor: "#1A1208", borderRadius: 10, padding: "8px 12px", width: 210 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#FDFAF5", lineHeight: 1.4 }}>
            {toneOptions.find((t) => t.key === showStyleTooltip)?.help}
          </p>
        </div>
      )}
    </>
  );
}
