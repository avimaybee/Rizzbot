import { useLocation, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Heart, BookOpen, Bookmark } from "lucide-react";
import { GrainOverlay } from "./GrainOverlay";

interface ClosingData {
  workedOn?: string[];
  insight?: string;
  attachmentStyle?: string;
}

const defaultWorkedOn = [
  "Explored patterns and emotional responses",
  "Identified recurring communication themes",
  "Set actionable next steps for growth",
];

export function TherapistClosingScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const data = (location.state as ClosingData) || {};
  const workedOn = data.workedOn?.length ? data.workedOn : defaultWorkedOn;
  const insight = data.insight || "Give yourself permission to wait. Silence isn't rejection — it's an invitation for them to miss you.";

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <GrainOverlay />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 max-w-[430px] mx-auto w-full">
        {/* Heart icon */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.35 }}
          className="flex items-center justify-center"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "#FDF0F0",
          }}
        >
          <Heart size={36} strokeWidth={1.5} color="#D4838A" />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mt-6"
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.15em",
              color: "rgba(26,18,8,0.45)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            SESSION SAVED
          </p>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 36,
              fontWeight: 700,
              fontStyle: "italic",
              color: "#1A1208",
              lineHeight: 1.2,
            }}
          >
            Good work today.
          </p>
          <p
            className="mt-3"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15,
              fontWeight: 400,
              color: "rgba(26,18,8,0.55)",
              lineHeight: 1.6,
              maxWidth: 280,
            }}
          >
            Every session is a step toward clarity. Take your time with today's
            insights.
          </p>
        </motion.div>

        {/* What we worked on */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="w-full mt-8"
          style={{
            backgroundColor: "#FDFAF5",
            borderRadius: 24,
            boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
            padding: 20,
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} strokeWidth={1.8} color="#C8522A" />
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.15em",
                color: "rgba(26,18,8,0.55)",
                textTransform: "uppercase",
              }}
            >
              WHAT WE WORKED ON
            </p>
          </div>
          {workedOn.map((item, i) => (
            <div key={i} className="flex items-start gap-3 mb-3">
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "#C8522A",
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <p
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  color: "#1A1208",
                  lineHeight: 1.5,
                }}
              >
                {item}
              </p>
            </div>
          ))}
        </motion.div>

        {/* Insight pill */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="w-full mt-4"
          style={{
            backgroundColor: "#F5E8E0",
            borderRadius: 20,
            padding: "16px 20px",
          }}
        >
          <div className="flex items-start gap-3">
            <Bookmark size={16} strokeWidth={1.8} color="#C8522A" style={{ marginTop: 2 }} />
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 16,
                fontWeight: 400,
                fontStyle: "italic",
                color: "#1A1208",
                lineHeight: 1.5,
              }}
            >
              {insight}
            </p>
          </div>
        </motion.div>
      </div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="relative z-10 px-5 pb-24 max-w-[430px] mx-auto w-full flex flex-col gap-3"
      >
        <button
          onClick={() => navigate("/home")}
          className="w-full cursor-pointer"
          style={{
            height: 56,
            borderRadius: 100,
            backgroundColor: "#C8522A",
            color: "#FFFFFF",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            border: "none",
          }}
        >
          Back to Home
        </button>
        <button
          onClick={() => navigate("/history")}
          className="w-full cursor-pointer"
          style={{
            height: 56,
            borderRadius: 100,
            backgroundColor: "transparent",
            border: "1px solid #E8E0D4",
            color: "rgba(26,18,8,0.6)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          View Session History
        </button>
      </motion.div>
    </div>
  );
}
