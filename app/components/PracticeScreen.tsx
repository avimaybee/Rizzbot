import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionState } from "../utils/useSessionState";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Camera,
  ChevronLeft,
  Ghost,
  Lightbulb,
  MessageCircle,
  MessageSquare,
  Pencil,
  Sparkles,
  Sparkles as SparklesIcon,
  Target,
  User,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import { analyzeSimulation, generatePersona, simulateDraft } from "../../services/geminiService";
import { createPersona, createSession, getPersonas } from "../../services/dbService";
import { logSession } from "../../services/feedbackService";
import { Persona, SimResult } from "../../types";
import { useScrollFade } from "../utils/useScrollFade";

const personaOptions = [
  "The Ghoster",
  "The Overthinker",
  "The Dry Texter",
  "The Flirt",
  "Custom...",
] as const;

const personaIcons: Record<string, any> = {
  "The Ghoster": Ghost,
  "The Overthinker": Brain,
  "The Dry Texter": MessageCircle,
  "The Flirt": SparklesIcon,
  "Custom...": Pencil,
};
const vibeGoals = ["Get a date", "Reignite spark", "Stop the silence", "Just practice"];

type ChatMessage = {
  id: number;
  sender: "ai" | "user";
  text: string;
};

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Read failed"));
    };
    reader.onerror = () => reject(reader.error || new Error("Read failed"));
    reader.readAsDataURL(file);
  });

const buildPresetPersona = (name: string): Persona => {
  const preset: Record<string, Pick<Persona, "tone" | "style" | "habits" | "redFlags">> = {
    "Ghoster": {
      tone: "Detached and inconsistent",
      style: "Short bursts, long gaps",
      habits: "Replies after long delays",
      redFlags: ["Inconsistent effort", "Avoids direct commitment"],
    },
    "Overthinker": {
      tone: "Warm but cautious",
      style: "Detailed messages with uncertainty",
      habits: "Needs reassurance before opening up",
      redFlags: ["Second-guesses everything"],
    },
    "Dry Texter": {
      tone: "Low-expression",
      style: "Very short replies",
      habits: "Rarely asks follow-up questions",
      redFlags: ["Minimal reciprocity"],
    },
    "Flirt": {
      tone: "Playful and high-energy",
      style: "Confident and teasing",
      habits: "Fast banter, strong chemistry cues",
      redFlags: ["Can be hot-and-cold"],
    },
  };

  const pick = preset[name] || preset["Dry Texter"];
  return {
    id: `preset-${name}-${Date.now()}`,
    name,
    description: name,
    tone: pick.tone,
    style: pick.style,
    habits: pick.habits,
    redFlags: pick.redFlags,
    relationshipContext: "TALKING_STAGE",
    harshnessLevel: 3,
  };
};

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div
        style={{
          padding: "12px 18px",
          borderRadius: "18px 18px 18px 4px",
          backgroundColor: "#FDFAF5",
        }}
        className="flex items-center gap-1"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "rgba(26,18,8,0.35)",
            }}
            animate={{ y: [0, -5, 0] }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function PracticeScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { authUser, userId, userProfile, runWellbeingCheck } = useAppContext();
  const [mode, setMode] = useSessionState<"setup" | "chat">("practice_mode", "setup");
  const [activePersonaName, setActivePersonaName] = useSessionState<(typeof personaOptions)[number]>("practice_persona_name", "The Dry Texter");
  const [goalText, setGoalText] = useSessionState("practice_goal_text", "");
  const [activeGoal, setActiveGoal] = useSessionState("practice_active_goal", "");
  const [customDescription, setCustomDescription] = useSessionState("practice_custom_desc", "");
  const [screenshots, setScreenshots] = useSessionState<string[]>("practice_screenshots", []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [persona, setPersona] = useSessionState<Persona | null>("practice_persona", null);

  const [messages, setMessages] = useSessionState<ChatMessage[]>("practice_messages", []);
  const [simHistory, setSimHistory] = useSessionState<{ draft: string; result: SimResult }[]>("practice_simHistory", []);
  const [inputText, setInputText] = useSessionState("practice_inputText", "");
  const [isTyping, setIsTyping] = useState(false);
  const [lastResult, setLastResult] = useSessionState<SimResult | null>("practice_lastResult", null);
  
  // Behavioral Session State
  const [currentMood, setCurrentMood] = useSessionState<string>("practice_mood", "Neutral");
  const [familiarity, setFamiliarity] = useSessionState<number>("practice_familiarity", 20);

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showHintSheet, setShowHintSheet] = useState(false);
  const [savedPersonas, setSavedPersonas] = useState<Persona[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) {
      getPersonas(userId).then((data) => setSavedPersonas(data as any)).catch(() => { });
    }
  }, [userId]);

  const tacticalTip = useMemo(() => {
    if (lastResult?.feedback?.length) return lastResult.feedback[0];
    if (activePersonaName === "The Ghoster") return "Don't chase. Mirror their pace — wait before replying, and keep it brief.";
    if (activePersonaName === "The Overthinker") return "Be direct and reassuring. State clear intentions to ease their anxiety.";
    if (activePersonaName === "The Dry Texter") return "Ask open-ended questions. Don't match their low energy — lead the conversation.";
    if (activePersonaName === "The Flirt") return "Match their playfulness but add substance. Don't just banter — build connection.";
    return "Focus on reading their energy and matching it thoughtfully.";
  }, [activePersonaName, lastResult]);

  useEffect(() => {
    if (mode === "chat") {
      runWellbeingCheck();
    }
  }, [mode, runWellbeingCheck]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const screenshotFade = useScrollFade();
  const personaFade = useScrollFade();

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);

    if (screenshots.length + picked.length > 3) {
      toast("You can only attach up to 3 screenshots.", "error");
      return;
    }

    const toProcess = picked.slice(0, 3 - screenshots.length);
    try {
      const encoded = await Promise.all(toProcess.map((file) => toDataUrl(file)));
      setScreenshots((prev) => [...prev, ...encoded]);
      toast(`${encoded.length} screenshot(s) attached`, "success");
    } catch {
      toast("Could not read screenshots", "error");
    }
  };

  const handleLoadPersona = (p: Persona) => {
    haptics.medium();
    setPersona(p);
    setMessages([
      {
        id: Date.now(),
        sender: "ai",
        text: `${p.name} is live. Send your first message.`,
      },
    ]);
    setSimHistory([]);
    setLastResult(null);
    setMode("chat");
  };

  const handleStartSession = async () => {
    haptics.medium();
    setIsGenerating(true);

    let isStillGenerating = true;
    const toastTimeout = setTimeout(() => {
      if (isStillGenerating) {
        toast("This message is taking longer than usual...", "info");
      }
    }, 12000);

    try {
      let resolvedPersona: Persona;
      if (activePersonaName === "Custom...") {
        if (!customDescription.trim() && screenshots.length === 0) {
          toast("Describe your custom persona or add screenshots", "error");
          setIsGenerating(false);
          return;
        }
        resolvedPersona = await generatePersona(
          customDescription || "Custom persona",
          screenshots,
          "TALKING_STAGE",
          3
        );
        if (userId) {
          void createPersona({
            user_id: userId,
            name: resolvedPersona.name,
            relationship_context: resolvedPersona.relationshipContext,
            harshness_level: resolvedPersona.harshnessLevel,
            communication_tips: resolvedPersona.communicationTips || [],
            conversation_starters: resolvedPersona.conversationStarters || [],
            things_to_avoid: resolvedPersona.thingsToAvoid || [],
          } as unknown as Persona);
        }
      } else {
        resolvedPersona = buildPresetPersona(activePersonaName);
      }

      setPersona(resolvedPersona);
      setCurrentMood(resolvedPersona.mood || "Initial Curiosity");
      setFamiliarity(resolvedPersona.familiarity || 20);
      
      setMessages([
        {
          id: Date.now(),
          sender: "ai",
          text: `${resolvedPersona.name} is live. Send your first message.`,
        },
      ]);
      setSimHistory([]);
      setLastResult(null);
      setMode("chat");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start session";
      toast(message, "error");
    } finally {
      isStillGenerating = false;
      clearTimeout(toastTimeout);
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !persona || !authUser?.uid) return;
    const draft = inputText.trim();
    setInputText("");
    haptics.light();
    setMessages((prev) => [...prev, { id: Date.now(), sender: "user", text: draft }]);
    setIsTyping(true);

    let isStillTyping = true;
    const toastTimeout = setTimeout(() => {
      if (isStillTyping) {
        toast("This message is taking longer than usual...", "info");
      }
    }, 12000);

    try {
      // Pass the current mood and familiarity to the simulation service
      const updatedPersona = { ...persona, mood: currentMood, familiarity };
      const result = await simulateDraft(authUser.uid, draft, updatedPersona, userProfile, simHistory);
      
      setLastResult(result);
      setSimHistory((prev) => [...prev, { draft, result }]);

      // Handle Mood/Familiarity updates from tool calls if present
      if (result.updatedMood) setCurrentMood(result.updatedMood);
      if (typeof result.updatedFamiliarity === 'number') {
        const delta = result.updatedFamiliarity - familiarity;
        const cappedDelta = Math.max(-5, Math.min(5, delta));
        setFamiliarity(prev => Math.min(100, Math.max(0, prev + cappedDelta)));
      }

      // Multi-Bubble Staggered Reply
      const bubbles = (result.predictedReply || "...")
        .split("\n\n")
        .filter(b => b.trim().length > 0);

      if (bubbles.length === 0) bubbles.push("...");

      // Sequential dispatch with 150ms delay
      for (let i = 0; i < bubbles.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 150));
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + i + 1,
            sender: "ai",
            text: bubbles[i],
          },
        ]);
      }
    } catch (err) {
      console.error("Simulation error:", err);
      toast("Simulation failed. Try again.", "error");
    } finally {
      isStillTyping = false;
      clearTimeout(toastTimeout);
      setIsTyping(false);
    }
  };

  const confirmEndSession = async () => {
    if (!persona || !authUser?.uid || simHistory.length === 0) {
      setShowEndConfirm(false);
      toast("Play at least one turn before ending", "info");
      return;
    }

    setShowEndConfirm(false);
    haptics.success();

    try {
      const analysis = await analyzeSimulation(simHistory, persona, userProfile);
      logSession(authUser.uid, "practice", persona.name, analysis.ghostRisk);

      await createSession(
        authUser.uid,
        {
          persona: persona.name,
          history: simHistory,
          analysis,
        },
        {
          mode: "simulator",
          persona_name: persona.name,
          headline: analysis.headline,
          ghost_risk: analysis.ghostRisk,
          message_count: simHistory.length,
        }
      );

      navigate("/tactical-report", {
        state: {
          persona: persona.name,
          goal: activeGoal || goalText || "Just practice",
          messageCount: simHistory.length,
          analysis,
        },
      });
    } catch {
      toast("Could not finalize report", "error");
    }
  };

  if (mode === "setup") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative min-h-screen pb-40" 
        style={{ backgroundColor: "#F5EFE6" }}
      >
        <GrainOverlay />
        <div className="relative z-10 max-w-[430px] mx-auto">
          <div className="flex items-center justify-between px-5 pt-6">
            <button onClick={() => navigate("/home")} className="cursor-pointer flex items-center justify-center fade-press" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4" }}>
              <ChevronLeft size={22} strokeWidth={1.8} color="#1A1208" />
            </button>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
              Practice
            </p>
            <div style={{ width: 44 }} />
          </div>

          <div className="px-5">
            <div className="mt-6">
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontStyle: "italic", fontWeight: 600, color: "#1A1208", lineHeight: 1.2 }}>
                Set the scene.
              </p>
            </div>

            <div className="mt-6" style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase", marginBottom: 12 }}>
                Who are you talking to?
              </p>
              <div
                ref={personaFade.ref}
                className="flex gap-2 w-full overflow-x-auto pb-2 no-scrollbar"
                style={personaFade.style}
              >
                {personaOptions.map((name) => {
                  const Icon = personaIcons[name] || User;
                  return (
                    <button
                      key={name}
                      onClick={() => setActivePersonaName(name)}
                      className="flex items-center gap-1.5"
                      style={{
                        borderRadius: 100,
                        padding: "8px 14px",
                        backgroundColor: activePersonaName === name ? "#C8522A" : "transparent",
                        color: activePersonaName === name ? "#FFFFFF" : "rgba(26,18,8,0.55)",
                        border: activePersonaName === name ? "1px solid #C8522A" : "1px solid #E8E0D4",
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Icon size={14} /> {name}
                    </button>
                  );
                })}
              </div>

              {activePersonaName === "Custom..." && (
                <>
                  <textarea
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Describe their tone, habits, and context..."
                    className="w-full mt-3 resize-none bg-[#FFFFFF] rounded-[14px] border border-[#E8E0D4] p-3 text-[14px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm outline-none"
                    style={{
                      minHeight: 80,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      void handleUpload(e.target.files);
                    }}
                  />
                  <div className="flex flex-col gap-3 mt-3">
                    {screenshots.length > 0 && (
                      <div 
                        ref={screenshotFade.ref}
                        className="flex gap-2 w-full overflow-x-auto pb-1 no-scrollbar"
                        style={screenshotFade.style}
                      >
                        {screenshots.map((src, i) => (
                          <div key={i} className="relative flex-shrink-0">
                            <img
                              src={src}
                              alt={`Screenshot ${i + 1}`}
                              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #E8E0D4" }}
                            />
                            <button
                              onClick={() => setScreenshots((prev) => prev.filter((_, idx) => idx !== i))}
                              className="absolute -top-2 -right-2 bg-white rounded-full p-1"
                              style={{ boxShadow: "0 2px 8px rgba(26,18,8,0.15)", color: "#C8522A", cursor: "pointer", border: "none" }}
                            >
                              <X size={12} strokeWidth={3} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {screenshots.length < 3 && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2"
                        style={{
                          border: "none",
                          background: "none",
                          color: "#C8522A",
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 13,
                          cursor: "pointer",
                          width: "fit-content"
                        }}
                      >
                        <Camera size={14} />
                        Attach screenshots ({screenshots.length}/3)
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {savedPersonas.length > 0 && (
              <div className="mt-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase", marginBottom: 12 }}>
                  Saved Partners
                </p>
                <div className="flex flex-col gap-2">
                  {savedPersonas.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLoadPersona(p)}
                      className="flex items-center justify-between text-left cursor-pointer transition-all hover-scale fade-press"
                      style={{
                        padding: "16px",
                        borderRadius: 16,
                        backgroundColor: "#FDFAF5",
                        border: "1px solid #E8E0D4",
                        minHeight: 64,
                      }}
                    >
                      <div>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1208" }}>{p.name}</p>
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26, 18, 8, 0.6)", textTransform: "capitalize" }}>{p.relationshipContext ? p.relationshipContext.toLowerCase().replace('_', ' ') : p.tone || "Custom"}</p>
                      </div>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "#C8522A" }}>Load →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase" }}>
                Your goal this session
              </p>
              <textarea
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="What are you trying to achieve?"
                className="w-full mt-3 resize-none bg-transparent rounded-[14px] border border-transparent p-3 text-[14px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-none outline-none focus:bg-white"
                style={{
                  minHeight: 60,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                {vibeGoals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => {
                      const pick = activeGoal === goal ? "" : goal;
                      setActiveGoal(pick);
                      setGoalText(pick);
                    }}
                    style={{
                      borderRadius: 100,
                      padding: "7px 14px",
                      backgroundColor: activeGoal === goal ? "#C8522A" : "transparent",
                      color: activeGoal === goal ? "#FFFFFF" : "rgba(26, 18, 8, 0.55)",
                      border: activeGoal === goal ? "1px solid #C8522A" : "1px solid #E8E0D4",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
            {activePersonaName !== "Custom..." && (
              <div className="mt-12" style={{ backgroundColor: "#F5E8E0", borderRadius: 16, padding: "12px 16px" }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "rgba(26,18,8,0.65)", textAlign: "center" }}>
                  Practicing with {activePersonaName}{activeGoal || goalText ? ` — ${activeGoal || goalText}` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="fixed bottom-24 left-0 right-0 px-5 z-30">
            <div className="max-w-[430px] mx-auto">
              <button
                onClick={() => void handleStartSession()}
                disabled={isGenerating}
                style={{
                  width: "100%",
                  height: 56,
                  borderRadius: 100,
                  backgroundColor: "#C8522A",
                  color: "#FFFFFF",
                  border: "none",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: isGenerating ? 0.7 : 1,
                }}
              >
                {isGenerating ? "Building persona..." : "Start Session →"}
              </button>
            </div>
          </div>
        </div>
        <TabBar />
      </motion.div >
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative min-h-screen flex flex-col" 
      style={{ backgroundColor: "#F5EFE6" }}
    >
      <GrainOverlay />
      <div className="relative z-10 flex flex-col flex-1 max-w-[430px] mx-auto w-full">
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <button onClick={() => setMode("setup")} className="cursor-pointer flex items-center justify-center fade-press" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FDFAF5", border: "1px solid #E8E0D4" }}>
            <ChevronLeft size={22} strokeWidth={1.8} color="#1A1208" />
          </button>
          <div className="flex flex-col items-center">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
              {persona?.name || "Practice"}
            </p>
          </div>
          <button
            onClick={() => setShowEndConfirm(true)}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "#C8522A",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            End
          </button>
        </div>

        <div className="px-5 pb-3">
          <div style={{ backgroundColor: "#FEF3E2", borderRadius: 16, padding: "10px 16px" }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontStyle: "italic", color: "rgba(26, 18, 8, 0.55)", lineHeight: 1.4 }}>
              {tacticalTip}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[180px]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex mb-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              {msg.sender === "ai" && (
                <div
                  className="shrink-0 mr-2 flex items-center justify-center mt-auto mb-1"
                  style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#C8522A" }}
                >
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, fontStyle: "italic", color: "#FFFFFF" }}>
                    R
                  </span>
                </div>
              )}
              <div
                style={{
                  maxWidth: "75%",
                  padding: "12px 16px",
                  borderRadius: msg.sender === "ai" ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
                  backgroundColor: msg.sender === "ai" ? "rgba(217, 160, 160, 0.15)" : "#F5E8E0",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15,
                  color: "#1A1208",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={chatEndRef} />
        </div>

        <div className="fixed bottom-[80px] left-0 right-0 z-30" style={{ backgroundColor: "#FDFAF5", borderTop: "1px solid #E8E0D4" }}>
          <div className="max-w-[430px] mx-auto flex items-end gap-2 px-4 py-3">
            <div className="pb-[4px]">
              <button
                onClick={() => setShowHintSheet(true)}
                className="cursor-pointer shrink-0 fade-press flex items-center justify-center gap-2"
                title="Hints"
                style={{
                  backgroundColor: "#FDF0F0",
                  border: "1px solid rgba(217,160,160,0.3)",
                  borderRadius: 100,
                  padding: "8px 14px",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#C8522A"
                }}
              >
                <Lightbulb size={16} strokeWidth={2} color="#C8522A" />
                Hints
              </button>
            </div>
            
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "44px";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 resize-none overflow-y-auto m-1 bg-[#F5EFE6] rounded-[22px] border border-transparent px-[18px] py-[10px] text-[15px] text-[#1A1208] transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 outline-none leading-[24px]"
              style={{
                minHeight: 44,
                maxHeight: 120,
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            
            <div className="pb-[4px]">
              <button
                onClick={() => void handleSend()}
                className="cursor-pointer shrink-0 flex items-center justify-center"
                style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#C8522A", border: "none" }}
              >
                <ArrowRight size={18} strokeWidth={2} color="#FFFFFF" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showEndConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: "rgba(26, 18, 8, 0.45)", backdropFilter: "blur(8px)" }}
              onClick={() => setShowEndConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              className="fixed inset-x-5 z-50 max-w-[360px] mx-auto"
              style={{ top: "50%", transform: "translateY(-50%)" }}
            >
              <div style={{ backgroundColor: "#FDFAF5", borderRadius: 28, padding: 28, boxShadow: "0 20px 60px rgba(26,18,8,0.15)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#F5E8E0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <AlertCircle size={20} strokeWidth={1.8} color="#C8522A" />
                  </div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
                    End this session?
                  </p>
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "rgba(26,18,8,0.6)", lineHeight: 1.5, marginBottom: 24 }}>
                  You will get a Tactical Report with your performance and next move.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEndConfirm(false)}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 100,
                      backgroundColor: "transparent",
                      border: "1px solid #E8E0D4",
                      color: "rgba(26,18,8,0.6)",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Keep going
                  </button>
                  <button
                    onClick={() => void confirmEndSession()}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 100,
                      backgroundColor: "#C8522A",
                      border: "none",
                      color: "#FFFFFF",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    See Report →
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHintSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: "rgba(26, 18, 8, 0.45)", backdropFilter: "blur(8px)" }}
              onClick={() => setShowHintSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <div
                style={{
                  backgroundColor: "#FDFAF5",
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  padding: "20px 24px",
                  boxShadow: "0 -4px 30px rgba(26,18,8,0.08)",
                }}
                className="max-w-[430px] mx-auto pb-[96px]"
              >
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={18} strokeWidth={1.8} color="#C8522A" />
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1208" }}>
                      Tactical Hints
                    </p>
                  </div>
                  <button onClick={() => setShowHintSheet(false)} className="cursor-pointer" style={{ border: "none", background: "none" }}>
                    <X size={20} strokeWidth={1.8} color="rgba(26,18,8,0.45)" />
                  </button>
                </div>

                {tacticalTip && (
                  <div className="mb-6 p-4" style={{ backgroundColor: "#F5E8E0", borderRadius: 16, border: "1px solid #E8E0D4" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={16} color="#C8522A" />
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1208", textTransform: "uppercase", letterSpacing: "0.05em" }}>Strategic Insight</p>
                    </div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#1A1208", lineHeight: 1.5, marginBottom: (persona?.communicationTips?.length) ? 12 : 0 }}>
                      {typeof tacticalTip === 'string' ? tacticalTip : (tacticalTip as any).feedback?.[0] || ""}
                    </p>
                    {persona?.communicationTips && persona.communicationTips.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[rgba(26,18,8,0.05)]">
                        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(26,18,8,0.45)", textTransform: "uppercase", marginBottom: 6 }}>Tactical Advice</p>
                        <ul className="space-y-2">
                          {persona.communicationTips.map((tip: string, idx: number) => (
                            <li key={idx} className="flex gap-2 text-[13px]" style={{ fontFamily: "'DM Sans', sans-serif", color: "rgba(26,18,8,0.7)" }}>
                              <span style={{ color: "#C8522A" }}>•</span> {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {lastResult && (
                  <div className="mb-4">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(26,18,8,0.45)", textTransform: "uppercase", marginBottom: 12, letterSpacing: "0.1em" }}>Live Rewrites</p>
                  </div>
                )}
                <div className="space-y-0">
                  {lastResult ? (
                    [
                      { label: "Safe", text: lastResult.rewrites.safe },
                      { label: "Bold", text: lastResult.rewrites.bold },
                      { label: "Spicy", text: lastResult.rewrites.spicy },
                      { label: "Your Style", text: lastResult.rewrites.you || "" },
                    ].filter(item => item.text).map((item, i, arr) => (
                      <div key={item.label} className="flex gap-3" style={{ paddingBottom: 16, marginBottom: 4, borderBottom: i < arr.length - 1 ? '1px solid #E8E0D4' : 'none' }}>
                        <div className="shrink-0 flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#F5E8E0' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, color: '#C8522A' }}>{i + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: '#1A1208' }}>{item.label}</p>
                            <button
                              onClick={() => {
                                setInputText(item.text);
                                setShowHintSheet(false);
                                haptics.light();
                              }}
                              style={{ border: "none", background: "none", color: "#C8522A", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                            >
                              Copy
                            </button>
                          </div>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(26,18,8,0.55)', lineHeight: 1.5, marginBottom: 8 }}>{item.text}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                toast("Thanks for the feedback!", "success");
                                haptics.light();
                              }}
                              style={{ border: "1px solid #E8E0D4", borderRadius: 100, padding: "4px 10px", backgroundColor: "transparent", cursor: "pointer", fontSize: 12 }}
                            >👍</button>
                            <button
                              onClick={() => {
                                toast("Thanks for the feedback!", "info");
                                haptics.light();
                              }}
                              style={{ border: "1px solid #E8E0D4", borderRadius: 100, padding: "4px 10px", backgroundColor: "transparent", cursor: "pointer", fontSize: 12 }}
                            >👎</button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(26,18,8,0.55)' }}>
                      Send one message to unlock live rewrites and tactical suggestions.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TabBar />
    </motion.div>
  );
}
