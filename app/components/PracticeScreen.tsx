import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { useToast } from "./ui/Toast";
import { haptics } from "../utils/haptics";
import { useAppContext } from "../app-context";
import { analyzeSimulation, generatePersona, simulateDraft } from "../../services/geminiService";
import { createPersona, createSession } from "../../services/dbService";
import { logSession } from "../../services/feedbackService";
import { Persona, SimResult } from "../../types";

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

const difficultyOptions = ["Chill", "Realistic", "Brutal"] as const;
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
    "The Ghoster": {
      tone: "Detached and inconsistent",
      style: "Short bursts, long gaps",
      habits: "Replies after long delays",
      redFlags: ["Inconsistent effort", "Avoids direct commitment"],
    },
    "The Overthinker": {
      tone: "Warm but cautious",
      style: "Detailed messages with uncertainty",
      habits: "Needs reassurance before opening up",
      redFlags: ["Second-guesses everything"],
    },
    "The Dry Texter": {
      tone: "Low-expression",
      style: "Very short replies",
      habits: "Rarely asks follow-up questions",
      redFlags: ["Minimal reciprocity"],
    },
    "The Flirt": {
      tone: "Playful and high-energy",
      style: "Confident and teasing",
      habits: "Fast banter, strong chemistry cues",
      redFlags: ["Can be hot-and-cold"],
    },
  };

  const pick = preset[name] || preset["The Dry Texter"];
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
  const [mode, setMode] = useState<"setup" | "chat">("setup");
  const [activePersonaName, setActivePersonaName] = useState<(typeof personaOptions)[number]>("The Dry Texter");
  const [activeDifficulty, setActiveDifficulty] = useState<(typeof difficultyOptions)[number]>("Realistic");
  const [goalText, setGoalText] = useState("");
  const [activeGoal, setActiveGoal] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [simHistory, setSimHistory] = useState<{ draft: string; result: SimResult }[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastResult, setLastResult] = useState<SimResult | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showHintSheet, setShowHintSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, 3);
    try {
      const encoded = await Promise.all(picked.map((file) => toDataUrl(file)));
      setScreenshots(encoded);
      toast(`${encoded.length} screenshot(s) attached`, "success");
    } catch {
      toast("Could not read screenshots", "error");
    }
  };

  const handleStartSession = async () => {
    haptics.medium();
    setIsGenerating(true);
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
          activeDifficulty === "Chill" ? 1 : activeDifficulty === "Brutal" ? 5 : 3
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
          });
        }
      } else {
        resolvedPersona = buildPresetPersona(activePersonaName);
      }

      setPersona(resolvedPersona);
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

    try {
      const result = await simulateDraft(authUser.uid, draft, persona, userProfile, simHistory);
      setLastResult(result);
      setSimHistory((prev) => [...prev, { draft, result }]);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          text: result.predictedReply || "...",
        },
      ]);
    } catch {
      toast("Simulation failed. Try again.", "error");
    } finally {
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
      <div className="relative min-h-screen pb-24" style={{ backgroundColor: "#F5EFE6" }}>
        <GrainOverlay />
        <div className="relative z-10 max-w-[430px] mx-auto">
          <div className="flex items-center justify-between px-5 pt-14">
            <button onClick={() => navigate("/home")} className="cursor-pointer p-1">
              <ChevronLeft size={24} strokeWidth={1.8} color="#1A1208" />
            </button>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
              Practice
            </p>
            <div style={{ width: 32 }} />
          </div>

          <div className="px-5">
            <div className="mt-6">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, color: "rgba(26, 18, 8, 0.55)" }}>
                Set the
              </p>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontStyle: "italic", color: "#1A1208" }}>
                scene.
              </p>
            </div>

            <div className="mt-6" style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase", marginBottom: 12 }}>
                Who are you talking to?
              </p>
              <div className="relative">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
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
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12" style={{ background: 'linear-gradient(to right, transparent, #FDFAF5)' }} />
              </div>

              {activePersonaName === "Custom..." && (
                <>
                  <textarea
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Describe their tone, habits, and context..."
                    className="w-full mt-3 resize-none"
                    style={{
                      minHeight: 78,
                      borderRadius: 14,
                      border: "1px solid #E8E0D4",
                      padding: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 14,
                      backgroundColor: "#FFFFFF",
                      outline: "none",
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
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 flex items-center gap-2"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#C8522A",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <Camera size={14} />
                    {screenshots.length > 0 ? `${screenshots.length} screenshot(s) attached` : "Attach screenshots"}
                  </button>
                </>
              )}
            </div>

            <div className="mt-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase", marginBottom: 12 }}>
                Difficulty
              </p>
              <div className="flex gap-2">
                {difficultyOptions.map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDifficulty(d)}
                    style={{
                      borderRadius: 12,
                      padding: "10px 8px",
                      backgroundColor: activeDifficulty === d ? "#F5E8E0" : "transparent",
                      border: activeDifficulty === d ? "1px solid #C8522A" : "1px solid #E8E0D4",
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 13,
                      color: activeDifficulty === d ? "#C8522A" : "#1A1208",
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 24, boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)", padding: 20 }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: "0.15em", color: "rgba(26, 18, 8, 0.55)", textTransform: "uppercase" }}>
                Your goal this session
              </p>
              <textarea
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="What are you trying to achieve?"
                className="w-full mt-3 resize-none"
                style={{
                  minHeight: 56,
                  borderRadius: 14,
                  border: "none",
                  padding: 12,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  backgroundColor: "transparent",
                  outline: "none",
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
                      backgroundColor: activeGoal === goal ? "#F5E8E0" : "transparent",
                      color: activeGoal === goal ? "#C8522A" : "rgba(26, 18, 8, 0.55)",
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
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 flex flex-col flex-1 max-w-[430px] mx-auto w-full">
        <div className="flex items-center justify-between px-5 pt-14 pb-3">
          <button onClick={() => setMode("setup")} className="cursor-pointer p-1">
            <ChevronLeft size={24} strokeWidth={1.8} color="#1A1208" />
          </button>
          <div className="flex flex-col items-center">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 600, color: "#1A1208" }}>
              {persona?.name || "Practice"}
            </p>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "rgba(26,18,8,0.4)" }}>
              {activeDifficulty}
            </span>
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

        <div className="flex-1 overflow-y-auto px-5 pb-36">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex mb-2 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 16px",
                  borderRadius: msg.sender === "ai" ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
                  backgroundColor: msg.sender === "ai" ? "#FDFAF5" : "#F5E8E0",
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
          <div className="max-w-[430px] mx-auto flex items-center gap-2 px-4 py-3">
            <button
              onClick={() => setShowHintSheet(true)}
              className="cursor-pointer shrink-0 p-1"
              style={{ background: "none", border: "none" }}
            >
              <Lightbulb size={22} strokeWidth={1.8} color="rgba(26,18,8,0.45)" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSend();
                }
              }}
              placeholder="Your move..."
              className="flex-1 outline-none"
              style={{
                height: 44,
                borderRadius: 100,
                backgroundColor: "#F5EFE6",
                padding: "0 18px",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                color: "#1A1208",
                border: "none",
              }}
            />
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

      <AnimatePresence>
        {showEndConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ backgroundColor: "rgba(26,18,8,0.45)" }}
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
              style={{ backgroundColor: "rgba(26,18,8,0.35)" }}
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

                {lastResult ? (
                  <div className="space-y-0">
                    {[
                      { label: "Safe", text: lastResult.rewrites.safe },
                      { label: "Bold", text: lastResult.rewrites.bold },
                      { label: "Spicy", text: lastResult.rewrites.spicy },
                      { label: "Your Style", text: lastResult.rewrites.you || "" },
                    ].filter(item => item.text).map((item, i, arr) => (
                      <div key={item.label} className="flex gap-3" style={{ paddingBottom: 16, marginBottom: 4, borderBottom: i < arr.length - 1 ? '1px solid #E8E0D4' : 'none' }}>
                        <div className="shrink-0 flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: '#F5E8E0' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, color: '#C8522A' }}>{i + 1}</span>
                        </div>
                        <div>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, color: '#1A1208', marginBottom: 3 }}>{item.label}</p>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(26,18,8,0.55)', lineHeight: 1.5 }}>{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(26,18,8,0.55)' }}>
                    Send one message to unlock live rewrites and tactical suggestions.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <TabBar />
    </div>
  );
}
