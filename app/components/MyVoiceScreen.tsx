import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Pencil,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import { TabBar } from "./TabBar";
import { GrainOverlay } from "./GrainOverlay";
import { useToast } from "./ui/Toast";
import { useAppContext } from "../app-context";
import {
  AIExtractedStyleProfile,
  StyleExtractionResponse,
  UserStyleProfile,
} from "../../types";
import { extractUserStyle } from "../../services/geminiService";

interface QuizQuestion {
  icon: typeof Mic;
  question: string;
  options: string[];
}

const questions: QuizQuestion[] = [
  {
    icon: Smartphone,
    question: "How do you reply when someone takes hours to respond?",
    options: ["Match their energy", "Keep it short and calm", "Wait even longer", "Bring the heat immediately"],
  },
  {
    icon: MessageCircle,
    question: "How often do you use emojis in your texts?",
    options: ["Every message", "A few when it fits", "Barely ever", "Only ironic ones"],
  },
  {
    icon: Mic,
    question: "Someone sends you a one-word reply. What do you do?",
    options: ["One-word right back", "Ask a question", "Leave on read", "Send voice note"],
  },
  {
    icon: Smartphone,
    question: "Your crush double-texts you. How do you feel?",
    options: ["Love it", "A little much but okay", "Respect the effort", "Depends on context"],
  },
  {
    icon: MessageCircle,
    question: "What's your go-to opener?",
    options: ["How's your day?", "React to story", "Meme/link", "Bold direct opener"],
  },
  {
    icon: Mic,
    question: "How do you close a convo you're done with?",
    options: ["Let it fade", "Talk later message", "Stop replying", "Send clear wrap-up"],
  },
];

const profileFromAnswers = (answers: number[]): UserStyleProfile => {
  const emojiUsage = ["heavy", "moderate", "minimal", "none"][answers[1] ?? 1] as UserStyleProfile["emojiUsage"];
  const averageLength = ["short", "medium", "short", "long"][answers[2] ?? 1] as UserStyleProfile["averageLength"];
  const preferredTone = ["chill", "direct", "sweet", "playful"][answers[0] ?? 1] as UserStyleProfile["preferredTone"];
  const responseSpeed = ["normal", "normal", "slow", "instant"][answers[0] ?? 1] as UserStyleProfile["responseSpeed"];
  const flirtLevel = ["moderate", "subtle", "subtle", "bold"][answers[3] ?? 1] as UserStyleProfile["flirtLevel"];
  const humorStyle = ["dry", "playful", "sarcastic", "wholesome"][answers[4] ?? 1] as UserStyleProfile["humorStyle"];

  const signaturePatterns = [
    questions[4].options[answers[4] ?? 0],
    questions[0].options[answers[0] ?? 0],
    questions[5].options[answers[5] ?? 0],
  ];

  return {
    emojiUsage,
    capitalization: "lowercase",
    punctuation: "minimal",
    averageLength,
    slangLevel: "casual",
    signaturePatterns,
    preferredTone,
    responseSpeed,
    flirtLevel,
    humorStyle,
    aiSummary: `you text ${preferredTone} with ${averageLength} messages and ${emojiUsage} emoji use`,
    rawSamples: signaturePatterns,
  };
};

const mapExtractionToProfile = (
  extraction: StyleExtractionResponse,
  sampleTexts: string[]
): UserStyleProfile => {
  const aiProfile: AIExtractedStyleProfile = extraction.profile;
  const patterns = [...(aiProfile.commonPhrases || []), ...(extraction.extractedPatterns || [])];

  return {
    emojiUsage:
      aiProfile.emojiFrequency === "heavy"
        ? "heavy"
        : aiProfile.emojiFrequency === "moderate"
          ? "moderate"
          : aiProfile.emojiFrequency === "light"
            ? "minimal"
            : "none",
    capitalization:
      aiProfile.capitalization === "always_lowercase"
        ? "lowercase"
        : aiProfile.capitalization === "proper_grammar"
          ? "normal"
          : "mixed",
    punctuation:
      aiProfile.punctuation === "standard"
        ? "full"
        : aiProfile.punctuation === "none"
          ? "none"
          : "minimal",
    averageLength: aiProfile.messageLengthTendency,
    slangLevel: aiProfile.commonPhrases.length > 3 ? "heavy-slang" : aiProfile.commonPhrases.length > 0 ? "casual" : "formal",
    signaturePatterns: [...new Set(patterns)].slice(0, 8),
    preferredTone: aiProfile.energyLevel === "hype" ? "playful" : aiProfile.energyLevel === "dry" ? "direct" : "chill",
    energy: aiProfile.energyLevel === "hype" ? "high" : aiProfile.energyLevel === "dry" ? "low" : "medium",
    responseSpeed: "normal",
    flirtLevel: "subtle",
    humorStyle: "playful",
    aiSummary: extraction.summary,
    favoriteEmojis: (aiProfile.favoriteEmojis || []).slice(0, 8),
    rawSamples: sampleTexts.filter((s) => s.trim()),
  };
};

const defaultProfile = profileFromAnswers([1, 1, 1, 1, 1, 1]);

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Invalid image"));
    };
    reader.onerror = () => reject(reader.error || new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });

export function MyVoiceScreen() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userProfile, saveUserProfile } = useAppContext();

  const [mode, setMode] = useState<"quiz" | "result">("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [profileDraft, setProfileDraft] = useState<UserStyleProfile>(userProfile || defaultProfile);
  const [analysisResult, setAnalysisResult] = useState<StyleExtractionResponse | null>(null);
  const [sampleTexts, setSampleTexts] = useState<string[]>(() => {
    const seed = userProfile?.rawSamples?.slice(0, 6) || [];
    while (seed.length < 6) seed.push("");
    return seed;
  });
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const question = questions[currentQ];
  const Icon = question.icon;
  const totalQuestions = questions.length;
  const isLast = currentQ === totalQuestions - 1;

  const computedProfile = useMemo(() => {
    if (mode === "result") return profileDraft;
    return userProfile || defaultProfile;
  }, [mode, profileDraft, userProfile]);

  const handleNext = () => {
    if (selectedOption === null) return;
    const nextAnswers = [...answers];
    nextAnswers[currentQ] = selectedOption;
    setAnswers(nextAnswers);
    if (isLast) {
      const mapped = profileFromAnswers(nextAnswers);
      setProfileDraft(mapped);
      setMode("result");
    } else {
      setCurrentQ((prev) => prev + 1);
      setSelectedOption(nextAnswers[currentQ + 1] ?? null);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const selected = Array.from(files).slice(0, 5);
      const encoded = await Promise.all(selected.map((file) => toDataUrl(file)));
      setScreenshots((prev) => [...prev, ...encoded].slice(0, 5));
      toast(`${encoded.length} screenshot(s) added`, "success");
    } catch {
      toast("Could not process screenshot", "error");
    }
  };

  const canAnalyze = sampleTexts.some((t) => t.trim()) || screenshots.length > 0;

  const analyzeWithAI = async () => {
    if (!canAnalyze || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const result = await extractUserStyle({
        screenshots: screenshots.length ? screenshots : undefined,
        sampleTexts: sampleTexts.filter((t) => t.trim()) || undefined,
      });
      setAnalysisResult(result);
      setProfileDraft(mapExtractionToProfile(result, sampleTexts));
      setMode("result");
      toast("Voice profile updated from analysis", "success");
    } catch {
      toast("Style analysis failed", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserProfile(computedProfile);
      toast("Voice profile saved", "success");
      navigate("/home");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save profile";
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (patch: Partial<UserStyleProfile>) => {
    setProfileDraft((prev) => ({ ...prev, ...patch }));
  };

  if (mode === "quiz") {
    return (
      <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: "#F5EFE6" }}>
        <GrainOverlay />
        <div className="relative z-10 flex flex-col flex-1 max-w-[430px] mx-auto w-full px-5 pt-14">
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === currentQ ? 10 : 8,
                  height: i === currentQ ? 10 : 8,
                  borderRadius: "50%",
                  backgroundColor: i <= currentQ ? "#C8522A" : "#E8E0D4",
                  opacity: i < currentQ ? 0.5 : 1,
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>
          <p
            className="text-center mt-2"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "rgba(26, 18, 8, 0.55)" }}
          >
            {currentQ + 1} of {totalQuestions}
          </p>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div
              className="flex items-center justify-center"
              style={{ width: 48, height: 48, borderRadius: "50%", backgroundColor: "#F5E8E0" }}
            >
              <Icon size={24} strokeWidth={1.8} color="#C8522A" />
            </div>
            <p
              className="mt-6 text-center"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                fontWeight: 700,
                color: "#1A1208",
                lineHeight: 1.3,
                maxWidth: 300,
              }}
            >
              {question.question}
            </p>
            <div className="w-full mt-8 flex flex-col gap-3">
              {question.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedOption(i)}
                  style={{
                    height: 52,
                    borderRadius: 100,
                    backgroundColor: selectedOption === i ? "#F5E8E0" : "#FDFAF5",
                    border: selectedOption === i ? "1px solid #C8522A" : "1px solid #E8E0D4",
                    color: selectedOption === i ? "#C8522A" : "#1A1208",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="pb-8">
            <button
              onClick={handleNext}
              style={{
                width: "100%",
                height: 56,
                borderRadius: 100,
                backgroundColor: selectedOption !== null ? "#C8522A" : "#E8E0D4",
                color: selectedOption !== null ? "#FFFFFF" : "rgba(26, 18, 8, 0.35)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 15,
                fontWeight: 600,
                border: "none",
                pointerEvents: selectedOption !== null ? "auto" : "none",
                cursor: "pointer",
              }}
            >
              {isLast ? "Finish →" : "Next →"}
            </button>
            <button
              onClick={() => setMode("result")}
              style={{
                width: "100%",
                marginTop: 12,
                backgroundColor: "transparent",
                border: "none",
                color: "rgba(26,18,8,0.55)",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Skip quiz & extract with AI instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-24" style={{ backgroundColor: "#F5EFE6" }}>
      <GrainOverlay />
      <div className="relative z-10 px-5 pt-14 max-w-[430px] mx-auto">
        <div className="flex items-center justify-between">
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 600, color: "#1A1208" }}>
            My Voice
          </p>
          <button
            onClick={() => {
              setCurrentQ(0);
              setSelectedOption(null);
              setMode("quiz");
            }}
            className="cursor-pointer p-1"
            style={{ border: "none", background: "none" }}
          >
            <Pencil size={20} strokeWidth={1.8} color="rgba(26,18,8,0.55)" />
          </button>
        </div>

        <div className="mt-8">
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              letterSpacing: "0.15em",
              color: "rgba(26, 18, 8, 0.55)",
              textTransform: "uppercase",
            }}
          >
            Your style
          </p>
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 64,
              fontWeight: 800,
              color: "#1A1208",
              lineHeight: 1,
              marginTop: 4,
            }}
          >
            DNA
          </p>
          <div style={{ width: 48, height: 3, backgroundColor: "#C8522A", borderRadius: 100, marginTop: 8 }} />
        </div>

        <div
          className="mt-6"
          style={{
            backgroundColor: "#F5E8E0",
            borderRadius: 24,
            padding: "24px 20px",
            boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
          }}
        >
          <p
            className="text-center"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18,
              fontStyle: "italic",
              color: "#1A1208",
              lineHeight: 1.55,
            }}
          >
            "{computedProfile.aiSummary || "Your voice profile is ready."}"
          </p>
          {analysisResult && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <Sparkles size={14} color="#C8522A" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#C8522A" }}>
                AI confidence {analysisResult.confidence}%
              </span>
            </div>
          )}
        </div>

        <div
          className="mt-4"
          style={{
            backgroundColor: "#FDFAF5",
            borderRadius: 24,
            boxShadow: "0 2px 16px rgba(26, 18, 8, 0.07)",
            padding: "14px 14px 8px",
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(26,18,8,0.55)",
              marginBottom: 8,
            }}
          >
            Fine-tune profile
          </p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={computedProfile.emojiUsage}
              onChange={(e) => updateProfile({ emojiUsage: e.target.value as UserStyleProfile["emojiUsage"] })}
              className="h-[40px] rounded-[10px] border border-[#E8E0D4] px-[10px] text-[13px] text-[#1A1208] bg-[#FFFFFF] outline-none transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20"
            >
              <option value="none">emoji: none</option>
              <option value="minimal">emoji: minimal</option>
              <option value="moderate">emoji: moderate</option>
              <option value="heavy">emoji: heavy</option>
            </select>
            <select
              value={computedProfile.averageLength}
              onChange={(e) => updateProfile({ averageLength: e.target.value as UserStyleProfile["averageLength"] })}
              className="h-[40px] rounded-[10px] border border-[#E8E0D4] px-[10px] text-[13px] text-[#1A1208] bg-[#FFFFFF] outline-none transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20"
            >
              <option value="short">length: short</option>
              <option value="medium">length: medium</option>
              <option value="long">length: long</option>
            </select>
            <select
              value={computedProfile.preferredTone}
              onChange={(e) => updateProfile({ preferredTone: e.target.value as UserStyleProfile["preferredTone"] })}
              className="h-[40px] rounded-[10px] border border-[#E8E0D4] px-[10px] text-[13px] text-[#1A1208] bg-[#FFFFFF] outline-none transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20"
            >
              <option value="chill">tone: chill</option>
              <option value="playful">tone: playful</option>
              <option value="direct">tone: direct</option>
              <option value="sweet">tone: sweet</option>
            </select>
            <select
              value={computedProfile.responseSpeed || "normal"}
              onChange={(e) => updateProfile({ responseSpeed: e.target.value as UserStyleProfile["responseSpeed"] })}
              className="h-[40px] rounded-[10px] border border-[#E8E0D4] px-[10px] text-[13px] text-[#1A1208] bg-[#FFFFFF] outline-none transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20"
            >
              <option value="slow">speed: slow</option>
              <option value="normal">speed: normal</option>
              <option value="instant">speed: instant</option>
            </select>
            <select
              value={computedProfile.flirtLevel || "subtle"}
              onChange={(e) => updateProfile({ flirtLevel: e.target.value as UserStyleProfile["flirtLevel"] })}
              className="h-[40px] rounded-[10px] border border-[#E8E0D4] px-[10px] text-[13px] text-[#1A1208] bg-[#FFFFFF] outline-none transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20"
            >
              <option value="none">flirt: none</option>
              <option value="subtle">flirt: subtle</option>
              <option value="moderate">flirt: moderate</option>
              <option value="bold">flirt: bold</option>
            </select>
            <select
              value={computedProfile.humorStyle || "playful"}
              onChange={(e) => updateProfile({ humorStyle: e.target.value as UserStyleProfile["humorStyle"] })}
              className="h-[40px] rounded-[10px] border border-[#E8E0D4] px-[10px] text-[13px] text-[#1A1208] bg-[#FFFFFF] outline-none transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20"
            >
              <option value="dry">humor: dry</option>
              <option value="playful">humor: playful</option>
              <option value="sarcastic">humor: sarcastic</option>
              <option value="wholesome">humor: wholesome</option>
            </select>
          </div>
        </div>

        {computedProfile.favoriteEmojis && computedProfile.favoriteEmojis.length > 0 && (
          <div className="mt-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20, padding: 14 }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(26,18,8,0.55)",
                marginBottom: 8,
              }}
            >
              Favorite emojis
            </p>
            <div className="flex gap-3">
              {computedProfile.favoriteEmojis.map((emoji, i) => (
                <span key={i} style={{ fontSize: 24 }}>{emoji}</span>
              ))}
            </div>
          </div>
        )}

        {computedProfile.signaturePatterns.length > 0 && (
          <div className="mt-4" style={{ backgroundColor: "#FDFAF5", borderRadius: 20, padding: 14 }}>
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(26,18,8,0.55)",
                marginBottom: 8,
              }}
            >
              Signature patterns
            </p>
            <div className="flex flex-wrap gap-2">
              {computedProfile.signaturePatterns.map((pattern, i) => (
                <span
                  key={`${pattern}-${i}`}
                  style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    color: "#C8522A",
                    backgroundColor: "#F5E8E0",
                  }}
                >
                  {pattern}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5" style={{ backgroundColor: "#FDFAF5", borderRadius: 24, padding: 16 }}>
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(26,18,8,0.55)",
              marginBottom: 8,
            }}
          >
            Refine with AI extraction
          </p>

          <div className="space-y-2">
            {sampleTexts.map((sample, idx) => (
              <textarea
                key={idx}
                value={sample}
                onChange={(e) =>
                  setSampleTexts((prev) => prev.map((value, i) => (i === idx ? e.target.value : value)))
                }
                placeholder={`Text sample ${idx + 1}`}
                className="w-full min-h-[56px] rounded-[12px] border border-[#E8E0D4] p-3 text-[13px] text-[#1A1208] outline-none resize-y transition-all duration-300 focus:border-[#C8522A] focus:ring-[3px] focus:ring-[#C8522A]/20 shadow-sm"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
            ))}
          </div>

          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                void handleFileUpload(e.target.files);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 999,
                border: "1px solid #E8E0D4",
                backgroundColor: "transparent",
                color: "#1A1208",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <ImageIcon size={14} color="#C8522A" />
              Upload chat screenshots
            </button>
          </div>

          {screenshots.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {screenshots.map((img, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={`data:image/png;base64,${img}`}
                    alt=""
                    style={{
                      width: "100%",
                      aspectRatio: "9/16",
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid #E8E0D4",
                    }}
                  />
                  <button
                    onClick={() => setScreenshots((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "none",
                      backgroundColor: "rgba(26,18,8,0.6)",
                      color: "#FFFFFF",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => void analyzeWithAI()}
            disabled={!canAnalyze || isAnalyzing}
            style={{
              width: "100%",
              marginTop: 12,
              height: 46,
              borderRadius: 999,
              border: "none",
              backgroundColor: !canAnalyze ? "#E8E0D4" : "#1A1208",
              color: !canAnalyze ? "rgba(26,18,8,0.35)" : "#FFFFFF",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              cursor: !canAnalyze ? "not-allowed" : "pointer",
              opacity: isAnalyzing ? 0.8 : 1,
            }}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze my real texts"}
          </button>
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          style={{
            width: "100%",
            marginTop: 16,
            height: 56,
            borderRadius: 100,
            backgroundColor: "#C8522A",
            border: "none",
            color: "#FFFFFF",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save Voice Profile"}
        </button>
      </div>
      <TabBar />
    </div>
  );
}
