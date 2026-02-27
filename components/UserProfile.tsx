import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Circle, Upload, Image, X, AlertTriangle, Sparkles, ArrowRight, User, LogOut } from 'lucide-react';
import { UserStyleProfile, StyleExtractionResponse, AIExtractedStyleProfile } from '../types';
import { extractUserStyle } from '../services/geminiService';
import { AuthUser } from '../services/firebaseService';
import { StyleRadar } from './StyleRadar';
import { CornerNodes } from './CornerNodes';

interface UserProfileProps {
  onBack: () => void;
  onSave: (profile: UserStyleProfile) => void;
  initialProfile?: UserStyleProfile | null;
  userId?: number | null;
  authUser?: AuthUser | null;
  onSignOut?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onBack, onSave, initialProfile, userId, authUser, onSignOut }) => {
  // Profile state
  const [profile, setProfile] = useState<UserStyleProfile>({
    emojiUsage: 'moderate',
    capitalization: 'lowercase',
    punctuation: 'minimal',
    averageLength: 'medium',
    slangLevel: 'casual',
    signaturePatterns: [],
    preferredTone: 'chill'
  });

  // Sample texts for analysis
  const [sampleTexts, setSampleTexts] = useState<string[]>(['', '', '', '', '', '']);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  // inputMode removed - consolidated interface
  const [currentStep, setCurrentStep] = useState<'intro' | 'samples' | 'review'>('intro');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<StyleExtractionResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial profile if provided
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      // Restore saved MCQ samples if available
      if (initialProfile.rawSamples && initialProfile.rawSamples.length > 0) {
        const restored = [...initialProfile.rawSamples];
        while (restored.length < 6) restored.push('');
        setSampleTexts(restored);
      }
      // Restore AI summary as analysis result
      if (initialProfile.aiSummary) {
        setAnalysisResult({
          profile: {
            capitalization: initialProfile.capitalization === 'lowercase' ? 'always_lowercase' :
              initialProfile.capitalization === 'normal' ? 'proper_grammar' : 'sometimes_caps',
            punctuation: initialProfile.punctuation,
            emojiFrequency: initialProfile.emojiUsage,
            favoriteEmojis: initialProfile.favoriteEmojis || [],
            commonPhrases: initialProfile.signaturePatterns.filter(p => !p.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu)),
            messageLengthTendency: initialProfile.averageLength,
            energyLevel: initialProfile.preferredTone === 'playful' ? 'hype' :
              initialProfile.preferredTone === 'direct' ? 'dry' : 'chill',
            openerStyle: 'casual',
            closerStyle: 'natural'
          },
          confidence: 85,
          extractedPatterns: initialProfile.signaturePatterns,
          summary: initialProfile.aiSummary
        });
      }
      setCurrentStep('review');
    }
  }, [initialProfile]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files).slice(0, 5) as File[]; // Max 5 files

    fileArray.forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (base64) {
          setScreenshots(prev => [...prev.slice(0, 4), base64]); // Keep max 5
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Remove screenshot
  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  // AI-powered analysis
  const analyzeWithAI = useCallback(async () => {
    setIsAnalyzing(true);

    try {
      const result = await extractUserStyle({
        screenshots: screenshots.length > 0 ? screenshots : undefined,
        sampleTexts: sampleTexts.filter(t => t.trim()).length > 0 ? sampleTexts.filter(t => t.trim()) : undefined
      });

      setAnalysisResult(result);

      // Map the AI response to our profile format
      const aiProfile: AIExtractedStyleProfile = result.profile;
      setProfile({
        emojiUsage: aiProfile.emojiFrequency === 'heavy' ? 'heavy' :
          aiProfile.emojiFrequency === 'moderate' ? 'moderate' :
            aiProfile.emojiFrequency === 'light' ? 'minimal' : 'none',
        capitalization: aiProfile.capitalization === 'always_lowercase' ? 'lowercase' :
          aiProfile.capitalization === 'proper_grammar' ? 'normal' : 'mixed',
        punctuation: aiProfile.punctuation === 'standard' ? 'full' :
          (aiProfile.punctuation === 'light' || aiProfile.punctuation === 'minimal') ? 'minimal' : 'none',
        averageLength: aiProfile.messageLengthTendency,
        slangLevel: aiProfile.commonPhrases.length > 3 ? 'heavy-slang' :
          aiProfile.commonPhrases.length > 0 ? 'casual' : 'formal',
        signaturePatterns: aiProfile.commonPhrases.slice(0, 6),
        preferredTone: aiProfile.energyLevel === 'hype' ? 'playful' :
          aiProfile.energyLevel === 'dry' ? 'direct' : 'chill',
        aiSummary: result.summary,
        favoriteEmojis: aiProfile.favoriteEmojis.slice(0, 8),
        rawSamples: sampleTexts.filter(t => t.trim())
      });

      setCurrentStep('review');
      if (window.navigator.vibrate) window.navigator.vibrate([10, 50, 10]);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [screenshots, sampleTexts]);

  // Simple heuristic analyzer (fallback)
  const analyzeTexts = useCallback(() => {
    setIsAnalyzing(true);

    // Combine all non-empty texts
    const allText = sampleTexts.filter(t => t.trim()).join(' ');

    if (!allText.trim()) {
      setIsAnalyzing(false);
      return;
    }

    // Count emojis
    const emojiCount = (allText.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu) || []).length;
    const emojiDensity = emojiCount / Math.max(1, allText.length / 100);

    // Detect capitalization
    const upperCount = (allText.match(/[A-Z]/g) || []).length;
    const lowerCount = (allText.match(/[a-z]/g) || []).length;
    const capRatio = upperCount / Math.max(1, upperCount + lowerCount);

    // Count punctuation
    const punctCount = (allText.match(/[.!?,;:]/g) || []).length;
    const punctDensity = punctCount / Math.max(1, allText.split(/\s+/).length);

    // Avg message length
    const validTexts = sampleTexts.filter(t => t.trim());
    const avgLen = validTexts.reduce((sum, t) => sum + t.length, 0) / Math.max(1, validTexts.length);

    // Build profile
    const analyzed: UserStyleProfile = {
      emojiUsage: emojiDensity > 2 ? 'heavy' : emojiDensity > 0.5 ? 'moderate' : emojiDensity > 0 ? 'minimal' : 'none',
      capitalization: capRatio > 0.3 ? 'normal' : capRatio > 0.1 ? 'mixed' : 'lowercase',
      punctuation: punctDensity > 0.5 ? 'full' : punctDensity > 0.2 ? 'minimal' : 'none',
      averageLength: avgLen > 100 ? 'long' : avgLen > 30 ? 'medium' : 'short',
      slangLevel: slangCount > 3 ? 'heavy-slang' : slangCount > 0 ? 'casual' : 'formal',
      signaturePatterns: (allText.includes('haha') ? ['haha'] : []).concat(allText.includes('lol') ? ['lol'] : []),
      preferredTone: 'chill' // Default, user can adjust
    };

    setProfile(analyzed);
    setCurrentStep('review');
    setIsAnalyzing(false);
    if (window.navigator.vibrate) window.navigator.vibrate(15);
  }, [sampleTexts]);

  const handleSampleChange = (index: number, value: string) => {
    const newSamples = [...sampleTexts];
    newSamples[index] = value;
    setSampleTexts(newSamples);
  };

  const handleSave = () => {
    onSave(profile);
    if (window.navigator.vibrate) window.navigator.vibrate(20);
  };

  const hasSamples = sampleTexts.some(t => t.trim()) || screenshots.length > 0;
  const hasProfile = !!initialProfile;

  // Check if we have enough input to analyze
  const canAnalyze = hasSamples;

  // Intro Screen
  if (currentStep === 'intro') {
    return (
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-hidden scrollbar-hide pb-24 md:pb-0">
        <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>

        {/* Header - More compact */}
        {/* TACTICAL HUD HEADER */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between relative z-30 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group p-2 -ml-2 min-w-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-mono uppercase tracking-widest group-hover:text-emerald-400 transition-colors">BACK</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 animate-pulse"></div>
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">PROFILE</span>
            </div>
            {onSignOut && (
              <button onClick={onSignOut} className="text-zinc-500 hover:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-3 sm:p-5 relative z-10">
          <div className="w-full flex items-center justify-center">
            <div className="bg-zinc-900 border border-zinc-800 relative max-w-2xl w-full">
              <CornerNodes />
              <div className="p-4 sm:p-6 md:p-8">
                <div className="text-center space-y-4 sm:space-y-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto bg-hard-gold/10 border border-hard-gold flex items-center justify-center">
                    <Circle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div>
                    <div className="label-sm text-hard-gold mb-1">YOUR ENERGY</div>
                    <h2 className="text-xl sm:text-3xl font-impact text-white uppercase tracking-tight mb-2">TEACH ME YOUR VOICE</h2>
                    <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                      help me sound like you. drop some of your recent texts.
                    </p>
                  </div>

                  {/* Onboarding Checklist */}
                  <div className="space-y-4 text-left p-4 bg-black/40 border border-zinc-800 rounded-lg">
                    <div className="label-sm text-zinc-500 mb-2">ONBOARDING_STATUS</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 ${hasSamples ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
                          <span className={`text-[10px] font-mono uppercase ${hasSamples ? 'text-zinc-300' : 'text-zinc-500'}`}>VOICE_SAMPLES</span>
                        </div>
                        <span className={`text-[9px] font-mono ${hasSamples ? 'text-emerald-500' : 'text-zinc-700'}`}>{hasSamples ? 'COMPLETE' : 'PENDING'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 ${hasProfile ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
                          <span className={`text-[10px] font-mono uppercase ${hasProfile ? 'text-zinc-300' : 'text-zinc-500'}`}>STYLE_CALIBRATION</span>
                        </div>
                        <span className={`text-[9px] font-mono ${hasProfile ? 'text-emerald-500' : 'text-zinc-700'}`}>{hasProfile ? 'COMPLETE' : 'PENDING'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-zinc-700"></div>
                          <span className="text-[10px] font-mono uppercase text-zinc-500">PERSONA_SYNC</span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-700">LOCKED</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-left text-[10px] text-zinc-600 font-mono uppercase tracking-tighter">
                    <div className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-hard-gold mt-1"></div>
                      <p>i'll learn your emoji game & slang</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1 h-1 bg-hard-gold mt-1"></div>
                      <p>responses will hit different - same you, elevated</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentStep('samples')}
                    className="w-full py-3 sm:py-3.5 bg-white text-black font-impact text-base sm:text-lg uppercase tracking-wide hover:bg-zinc-200 transition-colors min-h-[50px]"
                  >
                    {hasSamples ? 'CONTINUE TRAINING' : 'GET STARTED'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Samples Collection Screen
  if (currentStep === 'samples') {
    return (
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide pb-24 md:pb-0">
        <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>

        {/* Header - More compact */}
        {/* TACTICAL HUD HEADER */}
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between relative z-30 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
          <button
            onClick={() => setCurrentStep('intro')}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group p-2 -ml-2 min-w-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-mono uppercase tracking-widest group-hover:text-emerald-400 transition-colors">BACK</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="label-sm text-zinc-500">1/2</div>
            {initialProfile && (
              <button
                onClick={() => setCurrentStep('review')}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors group min-w-[44px]"
              >
                <span className="text-xs font-mono uppercase tracking-widest group-hover:text-emerald-400 transition-colors">SKIP</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {onSignOut && (
              <button onClick={onSignOut} className="text-zinc-500 hover:text-red-400 transition-colors ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content - More compact */}
        <div className="flex-1 p-3 sm:p-5 md:p-8 relative z-10">
          <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">

            {/* Intro - Compact */}
            <div className="text-center mb-4 sm:mb-6">
              <div className="label-sm text-hard-gold mb-1">STYLE QUIZ</div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-impact text-white uppercase tracking-tight">PROVE YOU'RE NOT AN NPC</h2>
              <p className="text-zinc-500 text-xs sm:text-sm mt-1">answer these prompts in your natural texting voice.</p>
            </div>

            {/* Quiz Questions - Redesigned as Tactical Briefing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
              {[
                { scenario: "THE MATCH", text: "so... what's your story? give me the lore." },
                { scenario: "THE HOT TAKE", text: "unpopular opinion: pineapple belongs on pizza." },
                { scenario: "THE VENT", text: "honestly having the worst day rn." },
                { scenario: "THE VIBE CHECK", text: "lol that's actually hilarious 💀" },
                { scenario: "THE PLAN", text: "so... wyd this weekend?" },
                { scenario: "THE CLIFFHANGER", text: "wait i have a random question for u" }
              ].map((item, index) => (
                <div key={index} className="space-y-3 group">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-hard-gold">0{index+1}</span>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{item.scenario}</span>
                    </div>
                    <div className="w-8 h-px bg-zinc-800 group-focus-within:bg-hard-gold transition-colors"></div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="bg-zinc-900/40 border border-zinc-800 p-3 rounded-2xl rounded-tl-none relative">
                      <div className="text-[9px] font-mono text-zinc-600 mb-1 uppercase tracking-tighter">INCOMING_MSG:</div>
                      <p className="text-sm text-zinc-300 font-sans italic">"{item.text}"</p>
                    </div>
                  </div>

                  <div className="pl-11">
                    <div className="relative">
                      <textarea
                        value={sampleTexts[index]}
                        onChange={(e) => handleSampleChange(index, e.target.value)}
                        className="w-full bg-black/40 border border-zinc-800 p-4 text-white text-sm rounded-2xl rounded-br-none focus:border-hard-gold/50 focus:outline-none min-h-[80px] resize-none placeholder:text-zinc-700 transition-all focus:bg-zinc-900/40 font-sans"
                        placeholder="Draft your natural response..."
                      />
                      <div className="absolute -bottom-1 -right-1 w-2 h-2 border-r border-b border-zinc-700"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-matte-base px-4 text-xs font-mono uppercase text-zinc-500 tracking-widest">WANT MORE ACCURACY?</span>
              </div>
            </div>

            {/* Screenshot Upload (Compact) */}
            <div className="bg-zinc-900/50 border border-dashed border-zinc-800 p-6 hover:border-zinc-600 transition-colors">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center rounded-full shrink-0">
                    <Image className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-wide">UPLOAD RECEIPTS</h4>
                    <p className="text-zinc-500 text-xs mt-1">Add screenshots for deeper analysis (optional)</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2 bg-zinc-800 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-700 transition-colors border border-zinc-700 min-h-[44px]"
                  >
                    CHOOSE FILES
                  </button>
                  {screenshots.length > 0 && (
                    <div className="text-xs text-hard-gold font-mono">
                      {screenshots.length} FILE{screenshots.length !== 1 ? 'S' : ''} SELECTED
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Grid */}
              {screenshots.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-6 pt-6 border-t border-zinc-800/50">
                  {screenshots.map((base64, index) => (
                    <div key={index} className="relative group aspect-[9/16]">
                      <img
                        src={`data:image/png;base64,${base64}`}
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover border border-zinc-700 opacity-70 group-hover:opacity-100 transition-opacity"
                      />
                      <button
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity min-w-[24px] min-h-[24px]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Button - More compact */}
            <button
              onClick={analyzeWithAI}
              disabled={!canAnalyze || isAnalyzing}
              className={`w-full py-3.5 sm:py-4 font-impact text-lg sm:text-xl uppercase tracking-wide border transition-all flex items-center justify-center gap-2 min-h-[50px] ${!canAnalyze || isAnalyzing
                ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                : 'bg-white text-black border-white hover:bg-zinc-200'
                }`}
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">◦</span> ANALYZING...
                </span>
              ) : (
                <><Sparkles className="w-4 h-4" /> ANALYZE WITH AI</>
              )}
            </button>

            {/* Quick option for text mode */}
            {canAnalyze && (
              <button
                onClick={analyzeTexts}
                disabled={isAnalyzing}
                className="w-full py-3 text-zinc-500 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors min-h-[44px]"
              >
                OR USE QUICK LOCAL ANALYSIS (NO AI)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Review & Edit Screen
  return (
    <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide pb-24 md:pb-0">
      <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>

      {/* Header - More compact */}
      {/* TACTICAL HUD HEADER */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between relative z-30 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
        <button
          onClick={() => setCurrentStep('samples')}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group p-2 -ml-2 min-w-[44px]"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-xs font-mono uppercase tracking-widest group-hover:text-emerald-400 transition-colors">EDIT</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="label-sm text-zinc-500">2/2</div>
          {onSignOut && (
            <button onClick={onSignOut} className="text-zinc-500 hover:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content - 2 Column Layout - More compact */}
      <div className="flex-1 p-3 sm:p-5 md:p-6 relative z-0">
        <div className="max-w-7xl mx-auto">
          {/* DOSSIER HEADER */}
          <div className="mb-8 border-l-4 border-hard-gold pl-4 py-2 bg-zinc-900/50">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="label-sm text-hard-gold flex items-center gap-2">
                  <span className="w-2 h-2 bg-hard-gold animate-pulse"></span>
                  TACTICAL DOSSIER // ID: {userId || 'ANONYMOUS'}
                </div>
                <h2 className="text-2xl sm:text-4xl font-impact text-white uppercase tracking-tight mt-1">
                  {authUser?.displayName || 'OPERATOR'} PROFILE
                </h2>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div className="hidden md:block">
                  <div className="label-sm text-zinc-500 text-right">LAST ANALYZED</div>
                  <div className="text-xs font-mono text-zinc-400">{new Date().toLocaleDateString()}</div>
                </div>
                <div className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-left">
                  <div className="label-sm text-zinc-500">VOICE STATUS</div>
                  <div className="text-xs font-mono text-emerald-400">VERIFIED</div>
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

            {/* LEFT COLUMN - AI Analysis & Account */}
            <div className="space-y-6">
              {/* AI Analysis Summary (if available) */}
              {analysisResult && (
                <div className={`bg-zinc-900/40 border-l-2 ${analysisResult.confidence === 0 ? 'border-red-500' : 'border-hard-gold'} p-6 relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Sparkles className="w-24 h-24 text-hard-gold" />
                  </div>
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 ${analysisResult.confidence === 0 ? 'bg-red-500/10' : 'bg-hard-gold/10'}`}>
                          {analysisResult.confidence === 0 ? <AlertTriangle className="w-5 h-5 text-red-400" /> : <Sparkles className="w-5 h-5 text-hard-gold" />}
                        </div>
                        <div>
                          <div className={`label-sm ${analysisResult.confidence === 0 ? 'text-red-400' : 'text-hard-gold'}`}>
                            {analysisResult.confidence === 0 ? 'CORE ANALYSIS FAILED' : 'VOICE ANALYSIS COMPLETE'}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">SOURCE: GEMINI-PRO-VISION // NEURAL_ENGINE</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase">CONFIDENCE_LEVEL</div>
                        <div className={`text-xl font-mono font-bold ${analysisResult.confidence >= 70 ? 'text-emerald-400' :
                          analysisResult.confidence >= 40 ? 'text-hard-gold' :
                            'text-red-400'
                          }`}>
                          {analysisResult.confidence}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/40 border border-zinc-800/50 p-4 rounded">
                      <div className="label-sm text-zinc-600 mb-2">PERSONALITY_SUMMARY.txt</div>
                      <p className={`text-sm font-sans italic leading-relaxed ${analysisResult.confidence === 0 ? 'text-red-300' : 'text-zinc-300'}`}>
                        "{analysisResult.summary}"
                      </p>
                    </div>

                    {/* Show retry hint when AI fails */}
                    {analysisResult.confidence === 0 && (
                      <div className="text-[10px] font-mono text-red-400/70 uppercase flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 animate-ping"></span>
                        SYSTEM_ALERT: AI service offline. fallback to manual calibration.
                      </div>
                    )}

                    {/* Detected Patterns */}
                    {analysisResult.extractedPatterns.length > 0 && (
                      <div className="space-y-2">
                        <div className="label-sm text-zinc-600">LINGUISTIC_PATTERNS_DETECTED</div>
                        <div className="flex flex-wrap gap-2">
                          {analysisResult.extractedPatterns.map((pattern, i) => (
                            <span key={i} className="px-2 py-0.5 bg-zinc-800/50 text-zinc-400 text-[10px] font-mono border border-zinc-700/50 uppercase">
                              &gt; {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Signature Patterns */}
              {profile.signaturePatterns.length > 0 && (
                <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative">
                  <div className="label-sm text-zinc-600 mb-4 flex items-center gap-2">
                    <div className="w-1 h-3 bg-zinc-700"></div>
                    RECURRING_LINGUISTIC_MARKERS
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {profile.signaturePatterns.map((pattern, i) => (
                      <div key={i} className="px-3 py-2 bg-black border border-zinc-800 flex items-center justify-between group">
                        <span className="text-hard-gold font-mono text-xs uppercase tracking-tight">{pattern}</span>
                        <span className="text-[10px] font-mono text-zinc-700 group-hover:text-zinc-500 transition-colors">0{i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* System Settings Hub */}
              {authUser && (
                <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative">
                  <div className="label-sm text-zinc-600 mb-6 flex items-center gap-2">
                    <div className="w-1 h-3 bg-zinc-700"></div>
                    SYSTEM_SETTINGS_HUB
                  </div>
                  
                  <div className="space-y-4">
                    {/* User Dossier Info */}
                    <div className="flex items-center gap-4 p-3 bg-black/30 border border-zinc-800/50">
                      {authUser.photoURL ? (
                        <img src={authUser.photoURL} alt="" className="w-10 h-10 rounded-full border border-zinc-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-mono border border-zinc-700">
                          {(authUser.displayName || 'U')[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-white truncate">{authUser.displayName || 'OPERATOR'}</div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate">{authUser.email}</div>
                      </div>
                    </div>

                    {/* Actions Grid */}
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-emerald-500"></div>
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">DATA_SYNC</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-500">ENCRYPTED</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-hard-gold"></div>
                          <span className="text-[10px] font-mono text-zinc-400 uppercase">PRIVACY_MODE</span>
                        </div>
                        <span className="text-[10px] font-mono text-hard-gold">STEALTH</span>
                      </div>

                      <button
                        onClick={onSignOut}
                        className="w-full flex items-center justify-between p-3 bg-red-900/10 border border-red-900/30 hover:bg-red-900/20 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <LogOut className="w-3 h-3 text-red-500" />
                          <span className="text-[10px] font-mono text-red-400 uppercase">SIGN_OUT</span>
                        </div>
                        <span className="text-[10px] font-mono text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">TERMINATE_SESSION</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN - Style Settings */}
            <div className="space-y-4">
              {/* Style Radar Visualization */}
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative flex flex-col items-center">
                <div className="label-sm text-zinc-600 mb-4 w-full flex items-center gap-2">
                  <div className="w-1 h-3 bg-zinc-700"></div>
                  VISUAL_STYLE_MAPPING_RADAR
                </div>
                <StyleRadar profile={profile} size={220} className="my-2" />
                <div className="w-full mt-4 pt-4 border-t border-zinc-800/50 flex justify-between">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase">SCAN_COMPLETE</div>
                  <div className="text-[10px] font-mono text-hard-gold uppercase animate-pulse">RENDERING_IDENTITY...</div>
                </div>
              </div>

              {/* Emoji Usage */}
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative overflow-hidden">
                <div className="label-sm text-zinc-600 mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-zinc-700"></div>
                  PARAMETER: EMOJI_DENSITY
                </div>
                <div>
                  {/* Display extracted emojis from user's samples */}
                  {profile.favoriteEmojis && profile.favoriteEmojis.length > 0 && (
                    <div className="mb-4 bg-black/30 p-3 border border-zinc-800/50">
                      <div className="text-[10px] font-mono text-zinc-500 uppercase mb-2">EXTRACTED_GLYPHS.exe</div>
                      <div className="flex flex-wrap gap-2">
                        {profile.favoriteEmojis.map((emoji, i) => (
                          <span key={i} className="text-xl bg-zinc-800/50 px-2 py-1 border border-zinc-700/50">
                            {emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Frequency selector */}
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-2">CALIBRATION_LEVEL</div>
                  <div className="grid grid-cols-4 gap-2">
                    {(['none', 'minimal', 'moderate', 'heavy'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setProfile({ ...profile, emojiUsage: level })}
                        className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-tighter transition-all min-h-[44px] ${profile.emojiUsage === level
                          ? 'bg-hard-gold text-black border-hard-gold font-bold'
                          : 'bg-zinc-800/30 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                          }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Capitalization */}
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative">
                <div className="label-sm text-zinc-600 mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-zinc-700"></div>
                  PARAMETER: CASE_SENSITIVITY
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['lowercase', 'mixed', 'normal'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, capitalization: level })}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-tighter transition-all min-h-[44px] ${profile.capitalization === level
                        ? 'bg-hard-gold text-black border-hard-gold font-bold'
                        : 'bg-zinc-800/30 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Punctuation */}
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative">
                <div className="label-sm text-zinc-600 mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-zinc-700"></div>
                  PARAMETER: PUNCTUATION_THRESHOLD
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['none', 'minimal', 'full'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, punctuation: level })}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-tighter transition-all min-h-[44px] ${profile.punctuation === level
                        ? 'bg-hard-gold text-black border-hard-gold font-bold'
                        : 'bg-zinc-800/30 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Length */}
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative">
                <div className="label-sm text-zinc-600 mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-zinc-700"></div>
                  PARAMETER: BUFFER_CAPACITY
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['short', 'medium', 'long'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, averageLength: level })}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-tighter transition-all min-h-[44px] ${profile.averageLength === level
                        ? 'bg-hard-gold text-black border-hard-gold font-bold'
                        : 'bg-zinc-800/30 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slang Level */}
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative">
                <div className="label-sm text-zinc-600 mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-zinc-700"></div>
                  PARAMETER: COLLOQUIAL_DEPTH
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['formal', 'casual', 'heavy-slang'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, slangLevel: level })}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-tighter transition-all min-h-[44px] ${profile.slangLevel === level
                        ? 'bg-hard-gold text-black border-hard-gold font-bold'
                        : 'bg-zinc-800/30 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                        }`}
                    >
                      {level === 'heavy-slang' ? 'MAX_SLANG' : level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Tone */}
              <div className="bg-zinc-900/40 border border-zinc-800 p-6 relative">
                <div className="label-sm text-zinc-600 mb-4 flex items-center gap-2">
                  <div className="w-1 h-3 bg-zinc-700"></div>
                  PARAMETER: EMOTIONAL_OUTPUT
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['playful', 'chill', 'direct', 'sweet'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setProfile({ ...profile, preferredTone: tone })}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-tighter transition-all min-h-[44px] ${profile.preferredTone === tone
                        ? 'bg-hard-gold text-black border-hard-gold font-bold'
                        : 'bg-zinc-800/30 text-zinc-500 border-zinc-800 hover:border-zinc-600'
                        }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button - Full Width */}
          <div className="mt-8">
            <button
              onClick={handleSave}
              className="w-full py-5 bg-white text-black font-impact text-2xl uppercase tracking-wide hover:bg-zinc-200 transition-colors min-h-[60px]"
            >
              SAVE PROFILE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
