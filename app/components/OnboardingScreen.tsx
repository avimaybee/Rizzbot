import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Zap, MessageSquare, Brain, ChevronRight } from "lucide-react";
import { GrainOverlay } from "./GrainOverlay";

const slides = [
  {
    icon: MessageSquare,
    iconBg: "#F5E8E0",
    iconColor: "#C8522A",
    eyebrow: "MEET KAI",
    title: "Your sharper,\nunfiltered friend",
    titleAccent: "friend",
    body: "Drop screenshots, vent by voice note, or overthink a 2am text. Kai reads the subtext and tells you what's actually going on.",
    researchNote: "No therapy-speak or generic bot replies.",
    cta: "Next",
  },
  {
    icon: Zap,
    iconBg: "#FEF3E2",
    iconColor: "#C8522A",
    eyebrow: "QUICK MODE",
    title: "Read the room\ninstantly",
    titleAccent: "instantly",
    body: "Need options fast? Quick Mode serves up five tones — Real, Smooth, Playful, Bold, and Your Style — built straight from the chat.",
    researchNote: "Swipe right on any line to quote or tweak it.",
    cta: "Next",
  },
  {
    icon: Brain,
    iconBg: "#FDF0F0",
    iconColor: "#C8522A",
    eyebrow: "MEMORY & STYLE",
    title: "Learns how you\nactually text",
    titleAccent: "actually text",
    body: "Kai picks up your natural texting cadence from screenshots and remembers the backstory — with Incognito mode whenever you want zero trace.",
    researchNote: "Editable & clearable anytime in Settings.",
    cta: "Let's go →",
  },
];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const Icon = slide.icon;
  const isLast = index === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem("rizzbot_onboarded", "1");
      navigate("/auth");
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("rizzbot_onboarded", "1");
    navigate("/auth");
  };

  return (
    <div
      className="relative min-h-screen flex flex-col"
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <GrainOverlay />

      {/* Skip */}
      <div className="relative z-10 flex justify-end px-5 pt-4">
        {!isLast && (
          <button
            onClick={handleSkip}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(26,18,8,0.45)",
              background: "none",
              border: "none",
            }}
            className="cursor-pointer"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 max-w-[430px] mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon */}
            <div
              className="flex items-center justify-center mb-6"
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: slide.iconBg,
              }}
            >
              <Icon size={28} strokeWidth={1.8} color={slide.iconColor} />
            </div>

            {/* Eyebrow */}
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
              {slide.eyebrow}
            </p>

            {/* Title */}
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 36,
                fontWeight: 700,
                fontStyle: "italic",
                color: "#1A1208",
                lineHeight: 1.2,
                whiteSpace: "pre-line",
              }}
            >
              {slide.title}
            </h1>

            {/* Body */}
            <p
              className="mt-4"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 400,
                color: "rgba(26,18,8,0.6)",
                lineHeight: 1.6,
                maxWidth: 300,
              }}
            >
              {slide.body}
            </p>

            {/* Research Note */}
            {slide.researchNote && (
              <div
                className="mt-5 px-4 py-3 rounded-2xl flex items-start gap-3 text-left"
                style={{
                  backgroundColor: "rgba(200, 82, 42, 0.05)",
                  border: "1px solid rgba(200, 82, 42, 0.1)",
                  maxWidth: 300,
                }}
              >
                <div style={{ color: "#C8522A", marginTop: 2, flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(26,18,8,0.7)",
                    lineHeight: 1.4,
                  }}
                >
                  <span className="font-bold text-[#C8522A]">Research Note:</span> {slide.researchNote}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom */}
      <div className="relative z-10 px-5 pb-6 max-w-[430px] mx-auto w-full">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {slides.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === index ? 24 : 8,
                backgroundColor: i === index ? "#C8522A" : "#E8E0D4",
              }}
              transition={{ duration: 0.3 }}
              style={{ height: 8, borderRadius: 100 }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="w-full cursor-pointer"
          style={{
            height: 52,
            borderRadius: 100,
            backgroundColor: "#C8522A",
            color: "#FFFFFF",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            border: "none",
          }}
        >
          {slide.cta}
        </button>
      </div>
    </div>
  );
}
