import { useNavigate } from "react-router";
import { MicroIllustrations } from "./MicroIllustrations";
import { GrainOverlay } from "./GrainOverlay";
import { motion } from "motion/react";

export function SplashScreen() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    const onboarded = localStorage.getItem("rizzbot_onboarded");
    navigate(onboarded ? "/auth" : "/onboarding");
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen px-5"
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <GrainOverlay />
      <MicroIllustrations />

      <div className="relative z-10 flex flex-col items-center w-full max-w-[430px]">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 56,
            fontWeight: 800,
            color: "#1A1208",
            lineHeight: 1.1,
          }}
        >
          Rizzbot
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-2"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.15em",
            color: "rgba(26, 18, 8, 0.55)",
            textTransform: "uppercase",
          }}
        >
          YOUR AI TEXTING WINGMAN
        </motion.p>

        {/* More breathing room */}
        <div className="h-16" />

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          onClick={handleGetStarted}
          className="w-full cursor-pointer transition-colors"
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
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#A8401C")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#C8522A")
          }
        >
          Get Started →
        </motion.button>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6 text-center"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "rgba(26, 18, 8, 0.45)",
          }}
        >
          By continuing, you agree to our Terms & Conditions
        </motion.p>
      </div>
    </div>
  );
}
