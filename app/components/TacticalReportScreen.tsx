import { useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { CheckCircle, ChevronLeft, Target, TrendingUp } from "lucide-react";
import { GrainOverlay } from "./GrainOverlay";
import { SimAnalysisResult } from "../../types";

interface ReportData {
  persona: string;
  goal: string;
  messageCount: number;
  analysis?: SimAnalysisResult;
}

const defaultReport: ReportData = {
  persona: "The Dry Texter",
  goal: "Get a date",
  messageCount: 4,
  analysis: {
    ghostRisk: 38,
    vibeMatch: 64,
    effortBalance: 58,
    headline: "solid recovery after a shaky start",
    insights: [
      "you recovered the vibe after a short dry patch",
      "your follow-ups got clearer and less reactive",
      "matching pace improved the conversation flow",
    ],
    turningPoint: "after your second message",
    advice: "stay steady and avoid over-explaining",
    recommendedNextMove: "MATCH_ENERGY",
    conversationFlow: "balanced",
  },
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function TacticalReportScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const partialReport = (location.state || {}) as Partial<ReportData>;
  const report: ReportData = { ...defaultReport, ...partialReport };
  const analysis = report.analysis || defaultReport.analysis!;

  const confidence = clampScore(100 - analysis.ghostRisk);
  const engagement = clampScore(analysis.vibeMatch);
  const authenticity = clampScore(100 - Math.abs((analysis.effortBalance || 50) - 50) * 2);
  const timing = clampScore(
    analysis.recommendedNextMove === "WAIT"
      ? 80
      : analysis.recommendedNextMove === "MATCH_ENERGY"
        ? 78
        : analysis.recommendedNextMove === "PULL_BACK"
          ? 70
          : analysis.recommendedNextMove === "FULL_SEND"
            ? 65
            : 55
  );

  const scores = [
    { label: "Confidence", value: confidence },
    { label: "Engagement", value: engagement },
    { label: "Authenticity", value: authenticity },
    { label: "Timing", value: timing },
  ];

  const overallScore = clampScore(scores.reduce((sum, s) => sum + s.value, 0) / scores.length);
  const wins = analysis.insights.slice(0, 2);
  const improvements = [
    `Turning point: ${analysis.turningPoint}`,
    `Next move: ${analysis.recommendedNextMove || "MATCH_ENERGY"}`,
  ];

  return (
    <div className="relative min-h-screen pb-6" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 px-5 pt-6 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate("/practice")} className="cursor-pointer p-1">
            <ChevronLeft size={24} strokeWidth={1.8} color="#1A1208" />
          </button>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
            Tactical Report
          </p>
          <div style={{ width: 32 }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8 flex flex-col items-center"
        >
          <div
            className="flex flex-col items-center justify-center"
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              backgroundColor: "#F5E8E0",
              border: "3px solid #C8522A",
            }}
          >
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 36,
                fontWeight: 500,
                color: "#C8522A",
                lineHeight: 1,
              }}
            >
              {overallScore}
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(26,18,8,0.45)", letterSpacing: "0.1em" }}>
              SCORE
            </p>
          </div>

          <p className="mt-4" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 700, fontStyle: "italic", color: "#1A1208" }}>
            {analysis.headline}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <Target size={13} strokeWidth={1.8} color="#C8522A" />
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)" }}>
                {report.persona}
              </span>
            </div>
            <span style={{ color: "rgba(26,18,8,0.2)", fontSize: 12 }}>·</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26,18,8,0.55)" }}>
              {report.messageCount} messages
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-6"
          style={{
            backgroundColor: "#FDFAF5",
            borderRadius: 20,
            boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
            padding: 20,
          }}
        >
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: "rgba(26,18,8,0.55)", textTransform: "uppercase", marginBottom: 16 }}>
            Breakdown
          </p>
          <div className="flex flex-col gap-4">
            {scores.map((score, i) => (
              <div key={score.label}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.7)" }}>{score.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "#1A1208" }}>{score.value}</span>
                </div>
                <div className="w-full overflow-hidden" style={{ height: 6, borderRadius: 100, backgroundColor: "#E8E0D4" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score.value}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                    style={{
                      height: "100%",
                      borderRadius: 100,
                      backgroundColor: score.value >= 70 ? "#C8522A" : "#D4A853",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-4"
          style={{
            backgroundColor: "#FDFAF5",
            borderRadius: 20,
            boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
            padding: 20,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} strokeWidth={1.8} color="#7A9E7E" />
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: "#7A9E7E", textTransform: "uppercase" }}>
              What worked
            </p>
          </div>
          {wins.map((win, i) => (
            <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", marginBottom: 8, lineHeight: 1.5 }}>
              • {win}
            </p>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-4"
          style={{
            backgroundColor: "#FDFAF5",
            borderRadius: 20,
            boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
            padding: 20,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} strokeWidth={1.8} color="#C8522A" />
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.15em", color: "#C8522A", textTransform: "uppercase" }}>
              Next improvements
            </p>
          </div>
          {improvements.map((tip, i) => (
            <p key={i} style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", marginBottom: 8, lineHeight: 1.5 }}>
              • {tip}
            </p>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-6 flex flex-col gap-3"
        >
          <button
            onClick={() => navigate("/practice")}
            style={{
              height: 56,
              borderRadius: 100,
              backgroundColor: "#C8522A",
              color: "#FFFFFF",
              border: "none",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Practice Again →
          </button>
          <button
            onClick={() => navigate("/therapist")}
            style={{
              height: 56,
              borderRadius: 100,
              backgroundColor: "transparent",
              border: "1px solid #C8522A",
              color: "#C8522A",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Discuss with Therapist
          </button>
        </motion.div>
      </div>
    </div>
  );
}
