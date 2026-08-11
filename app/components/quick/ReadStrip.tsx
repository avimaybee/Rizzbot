import type React from "react";
import { motion } from "motion/react";
import type { QuickAdviceResponse } from "../../../types";
import { getActionLabel } from "../../utils/quickLogic";

interface ReadStripProps {
  ghostRisk: number;
  riskColor: string;
  result: QuickAdviceResponse | null;
  scrollFade: { ref: React.RefObject<HTMLDivElement | null>; style: React.CSSProperties };
}

export function ReadStrip({ ghostRisk, riskColor, result, scrollFade }: ReadStripProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut", delay: 0.2 }}
    >
      <div ref={scrollFade.ref} className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar" style={scrollFade.style}>
        <span style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 8, height: 32, padding: "0 12px", border: "1px solid #E8E0D4", backgroundColor: "transparent", color: riskColor === "#C8522A" ? "#A8401C" : riskColor === "#D4A853" ? "#7A5400" : "#58745A", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
          ghost {ghostRisk}%
        </span>
        {result?.vibeCheck?.theirEnergy && result.vibeCheck.theirEnergy !== "neutral" && (
          <span style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 8, height: 32, padding: "0 12px", border: "1px solid #E8E0D4", backgroundColor: "transparent", color: "rgba(26,18,8,0.65)", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
            energy {result.vibeCheck.theirEnergy}
          </span>
        )}
        {typeof result?.vibeCheck?.interestLevel === "number" && (
          <span style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 8, height: 32, padding: "0 12px", border: "1px solid #E8E0D4", backgroundColor: "transparent", color: "rgba(26,18,8,0.65)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
            interest {result.vibeCheck.interestLevel}/100
          </span>
        )}
        {Array.isArray(result?.vibeCheck?.greenFlags) && result.vibeCheck.greenFlags.map((flag: string, i: number) => (
          <span key={`g-${i}`} style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 8, height: 32, padding: "0 12px", border: "1px solid #E8E0D4", backgroundColor: "transparent", color: "#58745A", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
            + {flag}
          </span>
        ))}
        {Array.isArray(result?.vibeCheck?.redFlags) && result.vibeCheck.redFlags.map((flag: string, i: number) => (
          <span key={`r-${i}`} style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 8, height: 32, padding: "0 12px", border: "1px solid #E8E0D4", backgroundColor: "transparent", color: "#A8401C", fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500 }}>
            − {flag}
          </span>
        ))}
        {result?.recommendedAction && !["SEND", "MATCH"].includes(result.recommendedAction) && (
          (() => {
            const a = getActionLabel(result.recommendedAction!);
            return (
              <span style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 8, height: 32, padding: "0 12px", border: "1px solid #E8E0D4", backgroundColor: "transparent", color: a.color, fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600 }}>
                {a.label}
              </span>
            );
          })()
        )}
        {result?.proTip && (
          <span style={{ display: "flex", alignItems: "center", whiteSpace: "nowrap", borderRadius: 8, height: 32, padding: "0 14px", backgroundColor: "#F5E8E0", color: "#1A1208", fontFamily: "'Cormorant Garamond', serif", fontSize: 14, fontStyle: "italic" }}>
            {result.proTip}
          </span>
        )}
      </div>
    </motion.div>
  );
}
