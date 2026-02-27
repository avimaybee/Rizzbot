import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Circle, Upload, Image, X, AlertTriangle, Sparkles, ArrowRight, User, LogOut, Terminal, Shield, Fingerprint, Activity, Cpu } from 'lucide-react';
import { UserStyleProfile, StyleExtractionResponse, AIExtractedStyleProfile } from '../types';
import { extractUserStyle } from '../services/geminiService';
import { AuthUser } from '../services/firebaseService';
import { StyleRadar } from './StyleRadar';
import { CornerNodes } from './CornerNodes';
import { ModuleHeader } from './ModuleHeader';

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
  const [currentStep, setCurrentStep] = useState<'intro' | 'samples' | 'review'>('intro');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<StyleExtractionResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial profile if provided
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      if (initialProfile.rawSamples && initialProfile.rawSamples.length > 0) {
        const restored = [...initialProfile.rawSamples];
        while (restored.length < 6) restored.push('');
        setSampleTexts(restored);
      }
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

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const fileArray = Array.from(files).slice(0, 5) as File[];

    fileArray.forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        if (base64) {
          setScreenshots(prev => [...prev.slice(0, 4), base64]);
          if ('vibrate' in navigator) navigator.vibrate(5);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeScreenshot = (index: number) => {
    handleAction(() => setScreenshots(prev => prev.filter((_, i) => i !== index)), 10);
  };

  const analyzeWithAI = useCallback(async () => {
    handleAction(() => setIsAnalyzing(true), 15);

    try {
      const result = await extractUserStyle({
        screenshots: screenshots.length > 0 ? screenshots : undefined,
        sampleTexts: sampleTexts.filter(t => t.trim()).length > 0 ? sampleTexts.filter(t => t.trim()) : undefined
      });

      setAnalysisResult(result);

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
      if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [screenshots, sampleTexts]);

  const handleSampleChange = (index: number, value: string) => {
    const newSamples = [...sampleTexts];
    newSamples[index] = value;
    setSampleTexts(newSamples);
  };

  const handleSave = () => {
    onSave(profile);
    if ('vibrate' in navigator) navigator.vibrate(20);
  };

  const hasSamples = sampleTexts.some(t => t.trim()) || screenshots.length > 0;
  const hasProfileData = !!initialProfile;
  const canAnalyze = hasSamples;

  // Intro Screen
  if (currentStep === 'intro') {
    return (
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-hidden font-mono select-none">
        <div className="bg-matte-grain"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-hard-gold/5 rounded-full blur-[100px] animate-pulse-slow"></div>

        {/* Header */}
        <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="Profile Settings" 
            mode="User Account" 
            onBack={() => handleAction(onBack)}
            accentColor="gold"
            statusLabel="Status"
            statusValue="Ready"
            statusColor="emerald"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-6 relative z-10 custom-scrollbar pb-32">
          <div className="max-w-2xl w-full">
            <div className="glass-dark border-white/5 p-8 md:p-12 soft-edge shadow-2xl relative overflow-hidden">
              
              <div className="text-center space-y-10 relative z-10">
                <div className="w-20 h-20 mx-auto glass flex items-center justify-center border-white/10 rounded-full shadow-[0_0_30px_rgba(251,191,36,0.15)]">
                  <User className="w-10 h-10 text-hard-gold" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 justify-center">
                     <span className="text-[10px] font-mono font-bold text-hard-gold uppercase tracking-[0.4em]">Voice Calibration</span>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-impact text-white uppercase tracking-tighter leading-none">Configure Profile</h2>
                  <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed max-w-sm mx-auto">
                    Train the AI to understand your unique communication style.
                  </p>
                </div>

                {/* Onboarding Status Grid */}
                <div className="space-y-3 text-left bg-black/40 border border-white/5 p-6 soft-edge">
                  <div className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Setup Progress</div>
                  {[
                    { label: 'Voice Samples', status: hasSamples ? 'Complete' : 'Pending', color: hasSamples ? 'text-emerald-400' : 'text-zinc-700' },
                    { label: 'Style Preferences', status: hasProfileData ? 'Complete' : 'Pending', color: hasProfileData ? 'text-emerald-400' : 'text-zinc-700' },
                    { label: 'Data Synchronization', status: 'Active', color: 'text-emerald-500' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Complete' || item.status === 'Active' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`}></div>
                        <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${item.status === 'Complete' || item.status === 'Active' ? 'text-zinc-300' : 'text-zinc-600'}`}>{item.label}</span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold ${item.color} tracking-[0.1em]`}>{item.status}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleAction(() => setCurrentStep('samples'), 10)}
                  className="w-full py-5 bg-white text-black font-impact text-2xl uppercase tracking-widest hover:bg-zinc-200 transition-all soft-edge shadow-xl active:scale-[0.98]"
                >
                  {hasSamples ? 'Continue Calibration' : 'Get Started'}
                </button>
                
                {onSignOut && (
                  <button 
                    onClick={() => handleAction(onSignOut, 20)}
                    className="flex items-center gap-2 text-zinc-700 hover:text-hard-red transition-all text-[9px] font-mono font-bold uppercase tracking-widest mx-auto py-2 px-4 glass-zinc border-white/5 soft-edge"
                  >
                    <LogOut className="w-3 h-3" />
                    Sign Out
                  </button>
                )}
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
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide font-mono select-none">
        <div className="bg-matte-grain"></div>

        {/* Header */}
        <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="LINGUISTIC_SAMPLING" 
            mode="DATA_COLLECTION" 
            onBack={() => handleAction(() => setCurrentStep('intro'))}
            accentColor="gold"
            statusLabel="PROGRESS"
            statusValue="PHASE_01"
            statusColor="gold"
            rightElement={
              initialProfile && (
                <button
                  onClick={() => handleAction(() => setCurrentStep('review'), 10)}
                  className="flex items-center gap-2 glass-zinc border border-white/5 px-4 py-2 soft-edge text-zinc-500 hover:text-white transition-all group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">SKIP</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              )
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-12 relative z-10 pb-32">
          <div className="max-w-6xl mx-auto space-y-12">

            <div className="text-center space-y-4">
              <div className="flex items-center gap-3 justify-center">
                 <Terminal size={14} className="text-hard-gold" />
                 <span className="text-[10px] font-bold text-hard-gold uppercase tracking-[0.4em]">Input_Signal_Requested</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-impact text-white uppercase tracking-tighter leading-none">STYLE_PROFILING_SEQUENCE</h2>
              <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed">Transmit interaction patterns. Response engine will deconstruct your voice.</p>
            </div>

            {/* Quiz Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              {[
                { scenario: "DYNAMIC_INIT", text: "so... what's your story? give me the lore." },
                { scenario: "CONTROVERSIAL_INPUT", text: "unpopular opinion: pineapple belongs on pizza." },
                { scenario: "NEGATIVE_EMOTIONAL_DATA", text: "honestly having the worst day rn." },
                { scenario: "INTERACTION_LOOP", text: "lol that's actually hilarious 💀" },
                { scenario: "LOGISTICS_SYNC", text: "so... wyd this weekend?" },
                { scenario: "UNDEFINED_QUERY", text: "wait i have a random question for u" }
              ].map((item, index) => (
                <div key={index} className="space-y-4 group">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-hard-gold opacity-50">NODE_0{index+1}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{item.scenario}</span>
                    </div>
                    <div className="w-12 h-[1px] bg-zinc-900 group-focus-within:bg-hard-gold/30 transition-all"></div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 glass shrink-0 flex items-center justify-center border-white/10 rounded-full text-zinc-600 group-hover:text-zinc-400 transition-all shadow-lg">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="glass-dark border border-white/5 p-4 soft-edge relative flex-1 shadow-xl">
                      <div className="text-[8px] font-bold text-zinc-600 mb-2 uppercase tracking-[0.3em]">INCOMING_TRANSMISSION:</div>
                      <p className="text-sm font-bold text-zinc-300 italic uppercase tracking-tight">"{item.text}"</p>
                    </div>
                  </div>

                  <div className="pl-14 relative">
                    <textarea
                      value={sampleTexts[index]}
                      onChange={(e) => handleSampleChange(index, e.target.value)}
                      className="w-full glass-zinc border-white/5 p-5 text-white text-sm font-bold focus:border-hard-gold/30 focus:outline-none min-h-[100px] resize-none placeholder:text-zinc-800 soft-edge transition-all uppercase tracking-wide leading-relaxed shadow-lg"
                      placeholder="Input natural response draft..."
                    />
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-white/5"></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative py-10 opacity-20">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-matte-base px-6 text-[9px] font-bold uppercase text-zinc-500 tracking-[0.5em]">SUPPLEMENTARY_DATA_BUFFER</span>
              </div>
            </div>

            {/* Screenshot Upload */}
            <div className="glass-dark border border-white/5 p-8 soft-edge relative overflow-hidden group shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-b from-hard-gold/[0.02] to-transparent pointer-events-none"></div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 glass flex items-center justify-center border-white/10 rounded-full shadow-xl">
                    <Image className="w-7 h-7 text-zinc-500 group-hover:text-hard-gold transition-all" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-white font-impact text-2xl uppercase tracking-wider">INGEST_RECEIPTS</h4>
                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em] leading-none">Deep_Linguistic_Scanning_Optional</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-4 w-full md:w-auto">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    onClick={() => handleAction(() => fileInputRef.current?.click(), 10)}
                    className="w-full md:w-auto px-10 py-3 glass-zinc border border-white/10 text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/5 hover:border-white/20 transition-all soft-edge shadow-xl"
                  >
                    SELECT_FILES
                  </button>
                  {screenshots.length > 0 && (
                    <div className="text-[10px] font-bold text-hard-gold flex items-center gap-2 animate-pulse">
                      <Activity size={12} />
                      {screenshots.length} BUFFER_NODES_ACTIVE
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Grid */}
              {screenshots.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4 mt-10 pt-8 border-t border-white/5">
                  {screenshots.map((base64, index) => (
                    <div key={index} className="relative group aspect-[9/16] glass-zinc border-white/5 overflow-hidden soft-edge shadow-lg">
                      <img
                        src={`data:image/png;base64,${base64}`}
                        alt=""
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500"
                      />
                      <button
                        onClick={() => removeScreenshot(index)}
                        className="absolute inset-0 bg-hard-red/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                      >
                        <X className="w-6 h-6 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-4">
               <button
                 onClick={analyzeWithAI}
                 disabled={!canAnalyze || isAnalyzing}
                 className={`w-full py-5 font-impact text-2xl uppercase tracking-[0.1em] border transition-all flex items-center justify-center gap-4 soft-edge shadow-[0_20px_50px_rgba(255,255,255,0.1)] group relative overflow-hidden ${!canAnalyze || isAnalyzing
                   ? 'bg-zinc-900 text-zinc-700 border-zinc-800 cursor-not-allowed'
                   : 'bg-white text-black hover:bg-zinc-200'
                   }`}
               >
                 {isAnalyzing ? (
                   <div className="flex items-center gap-3">
                     <div className="w-2 h-2 bg-zinc-600 animate-bounce"></div>
                     <div className="w-2 h-2 bg-zinc-600 animate-bounce delay-75"></div>
                     <div className="w-2 h-2 bg-zinc-600 animate-bounce delay-150"></div>
                     <span className="ml-2">Synthesizing_Voice</span>
                   </div>
                 ) : (
                   <>
                     <Sparkles className="w-6 h-6 text-hard-gold group-hover:rotate-12 transition-transform" /> 
                     <span>EXECUTE_AI_ANALYSIS</span>
                     <div className="absolute inset-0 bg-hard-gold opacity-0 group-hover:opacity-5 transition-opacity"></div>
                   </>
                 )}
               </button>

               {canAnalyze && (
                 <button
                   onClick={() => handleAction(analyzeTexts, 10)}
                   disabled={isAnalyzing}
                   className="w-full py-4 glass-zinc border-white/5 text-zinc-600 hover:text-white text-[10px] font-bold uppercase tracking-[0.3em] transition-all soft-edge"
                 >
                   FALLBACK_MANUAL_CALIBRATION (NO_AI)
                 </button>
               )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Review & Edit Screen
  return (
    <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide font-mono select-none">
      <div className="bg-matte-grain"></div>
      <CornerNodes className="opacity-[0.03]" />

      {/* Header */}
      <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="IDENTITY_REVIEW" 
          mode="DOSSIER_FINALIZATION" 
          onBack={() => handleAction(() => setCurrentStep('samples'))}
          accentColor="gold"
          statusLabel="VALIDATION"
          statusValue="PHASE_02"
          statusColor="gold"
        />
      </div>

      {/* Content */}
      <div className="flex-1 p-6 md:p-10 relative z-10 pb-32">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="mb-10 glass-dark border-l-4 border-hard-gold p-8 soft-edge shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-hard-gold/[0.03] via-transparent to-transparent pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-hard-gold animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                  <span className="text-[10px] font-bold text-hard-gold uppercase tracking-[0.4em]">TACTICAL_DOSSIER_ID: {userId || 'GHOST_ROOT'}</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-impact text-white uppercase tracking-tighter leading-none mt-1">
                  {authUser?.displayName?.toUpperCase() || 'AUTHORIZED_OPERATOR'}
                </h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="hidden md:block text-right">
                  <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.3em] mb-1">ANALYSIS_TIMESTAMP</div>
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{new Date().toLocaleDateString().replace(/\//g, '_')}</div>
                </div>
                <div className="px-6 py-3 glass border border-white/5 text-left shadow-xl relative group">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-1.5">VOICE_INTEGRITY</div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                     <Shield size={12} />
                     <span>SECURE_MATCH</span>
                  </div>
                  <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500 opacity-30"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

            {/* LEFT COLUMN */}
            <div className="space-y-8">
              {analysisResult && (
                <div className="glass-dark border-white/5 p-8 soft-edge relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                    <Sparkles className="w-32 h-32 text-hard-gold" />
                  </div>
                  
                  <div className="space-y-8 relative z-10">
                    <div className="flex items-center justify-between border-b border-white/5 pb-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 glass flex items-center justify-center border-white/10 rounded-xl shadow-lg`}>
                          {analysisResult.confidence === 0 ? <AlertTriangle className="w-6 h-6 text-hard-red animate-pulse" /> : <Cpu className="w-6 h-6 text-hard-gold" />}
                        </div>
                        <div>
                          <div className={`text-[10px] font-bold ${analysisResult.confidence === 0 ? 'text-hard-red' : 'text-hard-gold'} uppercase tracking-[0.3em] mb-1`}>
                            {analysisResult.confidence === 0 ? 'CORE_SCAN_FAILURE' : 'NEURAL_VOICE_ANALYSIS'}
                          </div>
                          <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.4em]">Engine: Gemini_Ultra_V2.1</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">PROBABILITY</div>
                        <div className={`text-3xl font-impact tracking-widest ${analysisResult.confidence >= 70 ? 'text-emerald-400' :
                          analysisResult.confidence >= 40 ? 'text-hard-gold' :
                            'text-hard-red'
                          }`}>
                          {analysisResult.confidence}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/40 border border-white/5 p-6 soft-edge relative">
                      <div className="absolute top-0 left-0 w-1 h-full bg-hard-gold opacity-20"></div>
                      <div className="text-[9px] font-bold text-zinc-600 mb-4 uppercase tracking-[0.3em] flex items-center gap-2">
                         <Terminal size={12} className="text-zinc-800" /> IDENTITY_MAPPING_SUMMARY
                      </div>
                      <p className={`text-sm font-bold italic leading-relaxed uppercase tracking-tight ${analysisResult.confidence === 0 ? 'text-hard-red opacity-60' : 'text-zinc-400'}`}>
                        "{analysisResult.summary}"
                      </p>
                    </div>

                    {analysisResult.extractedPatterns.length > 0 && (
                      <div className="space-y-4">
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.3em] px-1">EXTRACTED_LINGUISTIC_VECTORS</div>
                        <div className="flex flex-wrap gap-3">
                          {analysisResult.extractedPatterns.map((pattern, i) => (
                            <span key={i} className="px-3 py-1.5 glass-zinc border-white/5 text-zinc-500 text-[9px] font-bold uppercase tracking-widest soft-edge group hover:text-hard-gold hover:border-hard-gold/20 transition-all cursor-default">
                              &gt; {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {profile.signaturePatterns.length > 0 && (
                <div className="glass-dark border-white/5 p-8 soft-edge relative shadow-2xl">
                  <div className="text-[9px] font-bold text-zinc-600 mb-6 uppercase tracking-[0.3em] flex items-center gap-3">
                    <div className="w-1 h-4 bg-zinc-800"></div>
                    PERSISTENT_MODAL_MARKERS
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {profile.signaturePatterns.map((pattern, i) => (
                      <div key={i} className="p-4 glass-zinc border-white/5 flex items-center justify-between group soft-edge hover:border-hard-gold/20 transition-all shadow-lg">
                        <span className="text-hard-gold font-impact text-sm uppercase tracking-wider">{pattern}</span>
                        <span className="text-[9px] font-bold text-zinc-800 group-hover:text-zinc-600 transition-colors tracking-widest">IDX_{i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {authUser && (
                <div className="glass-dark border-white/5 p-8 soft-edge relative shadow-2xl">
                  <div className="text-[9px] font-bold text-zinc-600 mb-8 uppercase tracking-[0.3em] flex items-center gap-3">
                    <div className="w-1 h-4 bg-zinc-800"></div>
                    SYSTEM_HUB_CONTROLS
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center gap-5 p-4 glass-zinc border-white/5 soft-edge shadow-lg">
                      {authUser.photoURL ? (
                        <img src={authUser.photoURL} alt="" className="w-12 h-12 soft-edge border border-white/10 grayscale shadow-inner" />
                      ) : (
                        <div className="w-12 h-12 glass flex items-center justify-center text-zinc-600 text-lg font-impact border-white/5 shadow-xl">
                          {(authUser.displayName || 'U')[0]}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white uppercase tracking-tight truncate">{authUser.displayName || 'OPERATOR'}</div>
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest truncate">{authUser.email}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center justify-between p-4 glass-zinc border-white/5 soft-edge group">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse"></div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">DATA_CLOUD_SYNC</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-500 tracking-widest">ENCRYPTED</span>
                      </div>

                      <button
                        onClick={() => handleAction(onSignOut || (() => {}), 30)}
                        className="w-full flex items-center justify-between p-4 glass border border-hard-red/20 hover:bg-hard-red/5 transition-all group soft-edge shadow-lg active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut className="w-4 h-4 text-hard-red" />
                          <span className="text-[10px] font-bold text-hard-red uppercase tracking-widest">TERMINATE_SESSION</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-hard-red opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              <div className="glass-dark border-white/5 p-8 soft-edge relative flex flex-col items-center shadow-2xl">
                <div className="text-[9px] font-bold text-zinc-600 mb-8 w-full uppercase tracking-[0.3em] flex items-center gap-3">
                  <div className="w-1 h-4 bg-zinc-800"></div>
                  IDENTITY_RADAR_MAPPING
                </div>
                <div className="relative group">
                   <div className="absolute inset-0 bg-hard-gold/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <StyleRadar profile={profile} size={280} className="my-4 relative z-10" />
                </div>
                <div className="w-full mt-10 pt-6 border-t border-white/5 flex justify-between items-end opacity-40">
                  <div className="text-[8px] font-bold text-zinc-700 uppercase tracking-[0.4em]">SCAN_COMPLETE_V2.0</div>
                  <div className="text-[8px] font-bold text-hard-gold uppercase tracking-[0.4em] animate-pulse">OPTIMIZING_IDENTITY...</div>
                </div>
              </div>

              {/* Parameter Settings */}
              {[
                { label: 'EMOJI_DENSITY', param: 'emojiUsage', options: ['none', 'minimal', 'moderate', 'heavy'], icon: Sparkles },
                { label: 'CASE_SENSITIVITY', param: 'capitalization', options: ['lowercase', 'mixed', 'normal'], icon: Terminal },
                { label: 'PUNCT_THRESHOLD', param: 'punctuation', options: ['none', 'minimal', 'full'], icon: Activity },
                { label: 'BUFFER_CAPACITY', param: 'averageLength', options: ['short', 'medium', 'long'], icon: Cpu },
                { label: 'COLLOQUIAL_DEPTH', param: 'slangLevel', options: ['formal', 'casual', 'heavy-slang'], icon: Shield },
                { label: 'EMOTIONAL_OUTPUT', param: 'preferredTone', options: ['playful', 'chill', 'direct', 'sweet'], icon: Activity }
              ].map((item, i) => (
                <div key={i} className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-xl group hover:border-white/10 transition-all">
                  <div className="text-[9px] font-bold text-zinc-600 mb-6 uppercase tracking-[0.3em] flex items-center gap-3">
                    <item.icon className="w-3 h-3 text-zinc-800 group-hover:text-hard-gold transition-colors" />
                    PARAMETER: {item.label}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {item.options.map((level) => (
                      <button
                        key={level}
                        onClick={() => handleAction(() => setProfile({ ...profile, [item.param]: level }), 2)}
                        className={`py-3 px-2 border text-[10px] font-bold uppercase tracking-widest transition-all soft-edge shadow-lg min-h-[48px] ${profile[item.param as keyof UserStyleProfile] === level
                          ? 'bg-white text-black border-white shadow-white/5 scale-105 z-10'
                          : 'glass-zinc text-zinc-600 border-white/5 hover:border-white/10 hover:text-zinc-400'
                          }`}
                      >
                        {level.replace('-', '_')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final Action */}
          <div className="fixed bottom-0 left-0 right-0 p-6 md:p-10 bg-gradient-to-t from-matte-base via-matte-base to-transparent z-50">
            <button
              onClick={() => handleAction(handleSave, 20)}
              className="max-w-4xl mx-auto w-full py-6 bg-white text-black font-impact text-3xl uppercase tracking-[0.1em] hover:bg-zinc-200 transition-all soft-edge shadow-[0_30px_100px_rgba(255,255,255,0.15)] active:scale-[0.98] group relative overflow-hidden"
            >
              <span className="relative z-10">Commit_Identity_Profile</span>
              <div className="absolute inset-0 bg-hard-gold opacity-0 group-hover:opacity-5 transition-opacity"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
