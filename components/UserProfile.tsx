import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Circle, Upload, Image, X, AlertTriangle, Sparkles, ArrowRight, User, LogOut, Terminal, Shield, Fingerprint, Activity, Cpu } from 'lucide-react';
import { UserStyleProfile, StyleExtractionResponse, AIExtractedStyleProfile } from '../types';
import { extractUserStyle } from '../services/geminiService';
import { AuthUser } from '../services/firebaseService';
import { StyleRadar } from './StyleRadar';
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
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-hidden font-sans select-none">
        <div className="bg-matte-grain"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-white/[0.02] rounded-full blur-[120px]"></div>

        {/* Header */}
        <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="Profile Calibration" 
            mode="Voice Training" 
            onBack={() => handleAction(onBack)}
            accentColor="gold"
            statusLabel="System Status"
            statusValue="Ready"
            statusColor="emerald"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-8 relative z-10 custom-scrollbar pb-40">
          <div className="max-w-2xl w-full">
            <div className="bg-white/5 border border-white/5 p-10 md:p-16 rounded-[40px] shadow-2xl relative overflow-hidden text-center">
              <div className="space-y-12 relative z-10">
                <div className="w-24 h-24 mx-auto bg-white/5 border border-white/10 rounded-[32px] flex items-center justify-center shadow-xl">
                  <Fingerprint className="w-12 h-12 text-amber-400" />
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Personalize AI</h2>
                  <p className="text-zinc-500 text-sm font-medium leading-relaxed max-w-sm mx-auto">
                    Teach the assistant your unique texting style to receive more authentic response suggestions.
                  </p>
                </div>

                {/* Status Grid */}
                <div className="space-y-4 text-left bg-black/40 border border-white/5 p-8 rounded-3xl">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Training Progress</div>
                  {[
                    { label: 'Voice Samples', status: hasSamples ? 'Complete' : 'Required', color: hasSamples ? 'text-emerald-400' : 'text-zinc-600' },
                    { label: 'Style Calibration', status: hasProfileData ? 'Complete' : 'Required', color: hasProfileData ? 'text-emerald-400' : 'text-zinc-600' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <span className={`text-xs font-bold ${item.status === 'Complete' ? 'text-zinc-300' : 'text-zinc-500'}`}>{item.label}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${item.color}`}>{item.status}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleAction(() => setCurrentStep('samples'), 10)}
                  className="w-full py-5 bg-white text-black font-black text-2xl uppercase tracking-tight rounded-3xl hover:bg-zinc-200 transition-all shadow-xl active:scale-[0.98]"
                >
                  {hasSamples ? 'Continue Training' : 'Get Started'}
                </button>
                
                {onSignOut && (
                  <button 
                    onClick={() => handleAction(onSignOut, 20)}
                    className="flex items-center gap-2 text-zinc-600 hover:text-red-400 transition-all text-[10px] font-bold uppercase tracking-widest mx-auto py-3 px-6"
                  >
                    <LogOut className="w-4 h-4" />
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
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide font-sans select-none">
        <div className="bg-matte-grain"></div>

        {/* Header */}
        <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="Style Assessment" 
            mode="Step 1 of 2" 
            onBack={() => handleAction(() => setCurrentStep('intro'))}
            accentColor="gold"
            statusLabel="Input Status"
            statusValue="Sampling"
            statusColor="gold"
            rightElement={
              initialProfile && (
                <button
                  onClick={() => handleAction(() => setCurrentStep('review'), 10)}
                  className="flex items-center gap-2 bg-white/5 border border-white/5 px-6 py-2 rounded-xl text-zinc-500 hover:text-white transition-all group"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest">Skip</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              )
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-8 md:p-16 relative z-10 pb-40">
          <div className="max-w-6xl mx-auto space-y-16">

            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Voice Training</h2>
              <p className="text-zinc-500 text-sm font-medium max-w-md mx-auto">Draft responses to these scenarios in your most natural voice.</p>
            </div>

            {/* Quiz Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {[
                { scenario: "The Introduction", text: "so... what's your story? give me the lore." },
                { scenario: "Opinion Share", text: "unpopular opinion: pineapple belongs on pizza." },
                { scenario: "Daily Check-in", text: "honestly having the worst day rn." },
                { scenario: "Vibe Match", text: "lol that's actually hilarious 💀" },
                { scenario: "Planning", text: "so... wyd this weekend?" },
                { scenario: "Random Query", text: "wait i have a random question for u" }
              ].map((item, index) => (
                <div key={index} className="space-y-6 group">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{item.scenario}</span>
                    <span className="text-[10px] font-bold text-amber-400 opacity-40">0{index+1}</span>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-white/5 shrink-0 flex items-center justify-center rounded-2xl text-zinc-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="bg-white/5 border border-white/5 p-5 rounded-[24px] rounded-tl-none flex-1 shadow-xl">
                      <p className="text-sm font-bold text-zinc-300 italic">"{item.text}"</p>
                    </div>
                  </div>

                  <div className="pl-14">
                    <textarea
                      value={sampleTexts[index]}
                      onChange={(e) => handleSampleChange(index, e.target.value)}
                      className="w-full bg-black/40 border border-white/5 p-6 text-white text-sm font-medium focus:border-amber-500/30 focus:outline-none min-h-[120px] resize-none placeholder:text-zinc-800 rounded-3xl transition-all shadow-lg leading-relaxed"
                      placeholder="How would you reply?"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Screenshot Upload */}
            <div className="bg-white/5 border border-white/5 p-10 rounded-[40px] relative overflow-hidden group shadow-2xl mt-20">
              <div className="flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/5 flex items-center justify-center rounded-[20px] border border-white/10">
                    <Image className="w-7 h-7 text-zinc-500 group-hover:text-amber-400 transition-all" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-xl uppercase tracking-tight">Upload Samples</h4>
                    <p className="text-zinc-500 text-xs font-medium">Add screenshots for more accurate style matching</p>
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
                    className="w-full md:w-auto px-10 py-3 bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all rounded-xl"
                  >
                    Choose Files
                  </button>
                  {screenshots.length > 0 && (
                    <div className="text-[10px] font-bold text-amber-400">
                      {screenshots.length} Images Added
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Grid */}
              {screenshots.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-4 mt-10 pt-8 border-t border-white/5">
                  {screenshots.map((base64, index) => (
                    <div key={index} className="relative group aspect-[9/16] bg-black/20 rounded-xl overflow-hidden shadow-lg border border-white/5">
                      <img
                        src={`data:image/png;base64,${base64}`}
                        alt=""
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all"
                      />
                      <button
                        onClick={() => removeScreenshot(index)}
                        className="absolute inset-0 bg-red-500/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                      >
                        <X className="w-6 h-6 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Button */}
            <button
              onClick={analyzeWithAI}
              disabled={!canAnalyze || isAnalyzing}
              className={`w-full py-6 rounded-3xl font-black text-2xl uppercase tracking-tight border transition-all flex items-center justify-center gap-4 shadow-2xl ${!canAnalyze || isAnalyzing
                ? 'bg-zinc-900 text-zinc-700 border-zinc-800'
                : 'bg-white text-black hover:bg-zinc-200 border-white'
                }`}
            >
              {isAnalyzing ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce delay-150"></div>
                </div>
              ) : (
                <>
                  <Sparkles size={24} /> 
                  <span>Analyze My Style</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Review Screen
  return (
    <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide font-sans select-none">
      <div className="bg-matte-grain"></div>

      {/* Header */}
      <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="Style Profile" 
          mode="Step 2 of 2" 
          onBack={() => handleAction(() => setCurrentStep('samples'))}
          accentColor="gold"
          statusLabel="Verification"
          statusValue="Validated"
          statusColor="emerald"
        />
      </div>

      {/* Content */}
      <div className="flex-1 p-8 md:p-12 relative z-10 pb-40">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="bg-white/5 border-l-4 border-amber-400 p-10 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Active Profile</span>
                </div>
                <h2 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none mt-1">
                  {authUser?.displayName || 'Authorized User'}
                </h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="px-8 py-4 bg-white/5 border border-white/5 rounded-2xl shadow-xl">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Voice Integrity</div>
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                     <Shield size={14} />
                     <span>High Match</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* LEFT COLUMN */}
            <div className="space-y-10">
              {analysisResult && (
                <div className="bg-white/5 border border-white/5 p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
                  <div className="space-y-10">
                    <div className="flex items-center justify-between border-b border-white/5 pb-8">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white/5 flex items-center justify-center rounded-2xl border border-white/10 shadow-lg">
                          {analysisResult.confidence === 0 ? <AlertTriangle className="text-red-400" /> : <Cpu className="text-amber-400" />}
                        </div>
                        <div>
                          <div className={`text-[10px] font-bold ${analysisResult.confidence === 0 ? 'text-red-400' : 'text-amber-400'} uppercase tracking-widest mb-1`}>
                            {analysisResult.confidence === 0 ? 'Analysis Failed' : 'AI Analysis Results'}
                          </div>
                          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Neural Engine 2.0</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Confidence</div>
                        <div className={`text-4xl font-black tabular-nums ${analysisResult.confidence >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {analysisResult.confidence}%
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/40 border border-white/5 p-8 rounded-3xl">
                      <div className="text-[10px] font-bold text-zinc-600 mb-4 uppercase tracking-widest">Personality Summary</div>
                      <p className="text-base font-medium italic leading-relaxed text-zinc-400">
                        "{analysisResult.summary}"
                      </p>
                    </div>

                    {analysisResult.extractedPatterns.length > 0 && (
                      <div className="space-y-4">
                        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-1">Style Markers</div>
                        <div className="flex flex-wrap gap-3">
                          {analysisResult.extractedPatterns.map((pattern, i) => (
                            <span key={i} className="px-4 py-2 bg-white/5 border border-white/5 text-zinc-500 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:text-white hover:border-white/20 transition-all">
                              {pattern}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {profile.signaturePatterns.length > 0 && (
                <div className="bg-white/5 border border-white/5 p-10 rounded-[40px] shadow-2xl">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-8 px-1">Common Phrases</div>
                  <div className="grid grid-cols-2 gap-4">
                    {profile.signaturePatterns.map((pattern, i) => (
                      <div key={i} className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-amber-400/30 transition-all">
                        <span className="text-white font-bold text-sm uppercase tracking-tight">{pattern}</span>
                        <span className="text-[10px] font-bold text-zinc-700">0{i+1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-8">
              <div className="bg-white/5 border border-white/5 p-10 rounded-[40px] flex flex-col items-center shadow-2xl relative overflow-hidden">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-10 w-full px-1">Visual Style Map</div>
                <StyleRadar profile={profile} size={280} />
              </div>

              {/* Settings */}
              {[
                { label: 'Emoji Usage', param: 'emojiUsage', options: ['none', 'minimal', 'moderate', 'heavy'], icon: Sparkles },
                { label: 'Capitalization', param: 'capitalization', options: ['lowercase', 'mixed', 'normal'], icon: Terminal },
                { label: 'Punctuation', param: 'punctuation', options: ['none', 'minimal', 'full'], icon: Activity },
                { label: 'Message Length', param: 'averageLength', options: ['short', 'medium', 'long'], icon: Cpu },
                { label: 'Slang Level', param: 'slangLevel', options: ['formal', 'casual', 'heavy-slang'], icon: Shield },
                { label: 'Primary Tone', param: 'preferredTone', options: ['playful', 'chill', 'direct', 'sweet'], icon: Activity }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-3xl shadow-xl">
                  <div className="text-[10px] font-bold text-zinc-600 mb-6 uppercase tracking-widest flex items-center gap-2">
                    <item.icon size={12} className="text-zinc-700" />
                    {item.label}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {item.options.map((level) => (
                      <button
                        key={level}
                        onClick={() => handleAction(() => setProfile({ ...profile, [item.param]: level }), 2)}
                        className={`py-3 px-2 border text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl shadow-lg min-h-[48px] ${profile[item.param as keyof UserStyleProfile] === level
                          ? 'bg-white text-black border-white'
                          : 'bg-white/5 text-zinc-600 border-white/5 hover:text-zinc-400'
                          }`}
                      >
                        {level.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="fixed bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-matte-base via-matte-base to-transparent z-50">
            <button
              onClick={() => handleAction(handleSave, 20)}
              className="max-w-4xl mx-auto w-full py-6 bg-white text-black font-black text-3xl uppercase tracking-tight rounded-[32px] hover:bg-zinc-200 transition-all shadow-2xl active:scale-[0.98]"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
