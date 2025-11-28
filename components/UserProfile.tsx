import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserStyleProfile, StyleExtractionResponse, AIExtractedStyleProfile } from '../types';
import { extractUserStyle } from '../services/geminiService';

interface UserProfileProps {
  onBack: () => void;
  onSave: (profile: UserStyleProfile) => void;
  initialProfile?: UserStyleProfile | null;
}

// Corner Nodes Component
const CornerNodes = ({ className }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 z-50 ${className}`}>
    <div className="absolute top-0 left-0">
      <div className="w-2 h-2 border-t border-l border-zinc-500"></div>
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute top-0 right-0">
       <div className="w-2 h-2 border-t border-r border-zinc-500"></div>
       <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute bottom-0 left-0">
       <div className="w-2 h-2 border-b border-l border-zinc-500"></div>
       <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    <div className="absolute bottom-0 right-0">
       <div className="w-2 h-2 border-b border-r border-zinc-500"></div>
       <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
  </div>
);

export const UserProfile: React.FC<UserProfileProps> = ({ onBack, onSave, initialProfile }) => {
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
  const [sampleTexts, setSampleTexts] = useState<string[]>(['', '', '']);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [inputMode, setInputMode] = useState<'text' | 'screenshots'>('text');
  const [currentStep, setCurrentStep] = useState<'intro' | 'samples' | 'review'>('intro');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<StyleExtractionResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial profile if provided
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
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
        screenshots: inputMode === 'screenshots' ? screenshots : undefined,
        sampleTexts: inputMode === 'text' ? sampleTexts.filter(t => t.trim()) : undefined
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
        signaturePatterns: [...aiProfile.commonPhrases, ...aiProfile.favoriteEmojis].slice(0, 6),
        preferredTone: aiProfile.energyLevel === 'hype' ? 'playful' :
                      aiProfile.energyLevel === 'dry' ? 'direct' : 'chill',
        aiSummary: result.summary
      });
      
      setCurrentStep('review');
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputMode, screenshots, sampleTexts]);

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
    
    // Detect slang
    const slangWords = ['fr', 'ngl', 'tbh', 'lowkey', 'highkey', 'bet', 'no cap', 'idk', 'idc', 'lol', 'lmao', 'bruh', 'bestie'];
    const slangCount = slangWords.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      return count + (allText.match(regex) || []).length;
    }, 0);
    
    // Detect signature patterns
    const patterns: string[] = [];
    if (allText.includes('haha')) patterns.push('haha');
    if (allText.includes('lol')) patterns.push('lol');
    if (allText.includes('...')) patterns.push('...');
    if (allText.includes('!!')) patterns.push('!!');
    
    // Build profile
    const analyzed: UserStyleProfile = {
      emojiUsage: emojiDensity > 2 ? 'heavy' : emojiDensity > 0.5 ? 'moderate' : emojiDensity > 0 ? 'minimal' : 'none',
      capitalization: capRatio > 0.3 ? 'normal' : capRatio > 0.1 ? 'mixed' : 'lowercase',
      punctuation: punctDensity > 0.5 ? 'full' : punctDensity > 0.2 ? 'minimal' : 'none',
      averageLength: avgLen > 100 ? 'long' : avgLen > 30 ? 'medium' : 'short',
      slangLevel: slangCount > 3 ? 'heavy-slang' : slangCount > 0 ? 'casual' : 'formal',
      signaturePatterns: patterns,
      preferredTone: 'chill' // Default, user can adjust
    };
    
    setProfile(analyzed);
    setCurrentStep('review');
    setIsAnalyzing(false);
  }, [sampleTexts]);

  const handleSampleChange = (index: number, value: string) => {
    const newSamples = [...sampleTexts];
    newSamples[index] = value;
    setSampleTexts(newSamples);
  };

  const handleSave = () => {
    onSave(profile);
  };

  // Check if we have enough input to analyze
  const canAnalyze = inputMode === 'screenshots' 
    ? screenshots.length >= 1
    : sampleTexts[0]?.trim() && sampleTexts[1]?.trim();

  // Intro Screen
  if (currentStep === 'intro') {
    return (
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-hidden">
        <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>
        
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between relative z-10">
          <button 
            onClick={onBack}
            className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors group"
          >
            <span className="text-lg">←</span>
            <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-hard-gold transition-colors">BACK</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-hard-gold animate-pulse"></div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">YOUR_STYLE</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-6 relative z-10">
          <div className="max-w-xl w-full">
            <div className="bg-zinc-900 border border-zinc-800 relative">
              <CornerNodes />
              <div className="p-8 md:p-12">
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 mx-auto bg-hard-gold/10 border border-hard-gold flex items-center justify-center">
                    <span className="text-3xl">👤</span>
                  </div>
                  
                  <div>
                    <div className="label-sm text-hard-gold mb-2">YOUR ENERGY</div>
                    <h2 className="text-4xl font-impact text-white uppercase tracking-tight mb-3">TEACH ME YOUR VOICE</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                      help me sound like you. drop some of your recent texts so i can match your energy.
                    </p>
                  </div>

                  <div className="space-y-3 text-left text-sm text-zinc-500">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-hard-gold mt-2"></div>
                      <p>i'll learn your emoji game, punctuation chaos, and slang</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-hard-gold mt-2"></div>
                      <p>responses will hit different - same you, just elevated</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-hard-gold mt-2"></div>
                      <p>100% private - stays on your device, no cap</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setCurrentStep('samples')}
                    className="w-full py-4 bg-white text-black font-impact text-xl uppercase tracking-wide hover:bg-zinc-200 transition-colors"
                  >
                    GET STARTED
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
      <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto">
        <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>
        
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between relative z-10 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
          <button 
            onClick={() => setCurrentStep('intro')}
            className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors group"
          >
            <span className="text-lg">←</span>
            <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-hard-gold transition-colors">BACK</span>
          </button>
          <div className="label-sm text-zinc-500">STEP 1 OF 2</div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 relative z-10">
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <div className="label-sm text-hard-gold mb-2">SAMPLE DROP</div>
              <h2 className="text-3xl md:text-4xl font-impact text-white uppercase tracking-tight">DROP YOUR RECEIPTS</h2>
              <p className="text-zinc-500 text-sm mt-2">show me how you text - screenshots or raw text, dealer's choice</p>
            </div>

            {/* Input Mode Toggle */}
            <div className="flex border border-zinc-700">
              <button
                onClick={() => setInputMode('screenshots')}
                className={`flex-1 py-3 px-4 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'screenshots'
                    ? 'bg-white text-black'
                    : 'bg-transparent text-zinc-500 hover:text-white'
                }`}
              >
                <span>📸</span> SCREENSHOTS
              </button>
              <button
                onClick={() => setInputMode('text')}
                className={`flex-1 py-3 px-4 text-[10px] font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  inputMode === 'text'
                    ? 'bg-white text-black'
                    : 'bg-transparent text-zinc-500 hover:text-white'
                }`}
              >
                <span>✏️</span> PASTE TEXT
              </button>
            </div>

            {/* Screenshot Upload Mode */}
            {inputMode === 'screenshots' && (
              <div className="space-y-4">
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                
                {/* Upload Area */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 transition-colors p-8 cursor-pointer"
                >
                  <div className="text-center space-y-3">
                    <div className="text-4xl">📱</div>
                    <div className="text-white font-mono text-sm">TAP TO UPLOAD SCREENSHOTS</div>
                    <div className="text-zinc-500 text-xs">screenshots of your iMessage / WhatsApp / IG chats</div>
                    <div className="text-zinc-600 text-[10px] font-mono uppercase">MAX 5 IMAGES • PNG/JPG</div>
                  </div>
                </div>

                {/* Uploaded Screenshots Preview */}
                {screenshots.length > 0 && (
                  <div className="space-y-3">
                    <div className="label-sm text-zinc-400">UPLOADED ({screenshots.length}/5)</div>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                      {screenshots.map((base64, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={`data:image/png;base64,${base64}`}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full aspect-[9/16] object-cover border border-zinc-700"
                          />
                          <button
                            onClick={() => removeScreenshot(index)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 text-center text-[8px] font-mono text-zinc-400">
                            #{index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips for screenshots */}
                <div className="bg-zinc-900 border border-zinc-800 p-5 relative">
                  <CornerNodes className="opacity-30" />
                  <div className="space-y-3">
                    <div className="label-sm text-zinc-500">PRO TIPS:</div>
                    <div className="space-y-2 text-sm text-zinc-400">
                      <div className="flex items-start gap-2">
                        <span className="text-hard-gold">→</span>
                        <span>upload screenshots of convos where YOU were texting a lot</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-hard-gold">→</span>
                        <span>the ai reads your messages (usually the right/blue side)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-hard-gold">→</span>
                        <span>more screenshots = more accurate style profile</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Text Input Mode */}
            {inputMode === 'text' && (
              <div className="space-y-4">
                {sampleTexts.map((text, index) => (
                  <div key={index}>
                    <label className="label-sm text-zinc-400 mb-2 block">
                      SAMPLE {index + 1} {index > 1 && <span className="text-zinc-600">(OPTIONAL)</span>}
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => handleSampleChange(index, e.target.value)}
                      placeholder={`DROP YOUR RECEIPTS ${index + 1}...`}
                      className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white placeholder:text-zinc-500/60 resize-none focus:outline-none focus:border-white transition-colors h-24 font-mono text-sm"
                    />
                  </div>
                ))}

                {/* Examples */}
                <div className="bg-zinc-900 border border-zinc-800 p-5 relative">
                  <CornerNodes className="opacity-30" />
                  <div className="space-y-3">
                    <div className="label-sm text-zinc-500">EXAMPLES OF GOOD SAMPLES:</div>
                    <div className="space-y-2 text-sm text-zinc-400">
                      <div className="border-l-2 border-zinc-700 pl-3">"yo wanna grab food later? kinda starving rn"</div>
                      <div className="border-l-2 border-zinc-700 pl-3">"ngl that movie was mid af 💀"</div>
                      <div className="border-l-2 border-zinc-700 pl-3">"bet see u at 8"</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={analyzeWithAI}
              disabled={!canAnalyze || isAnalyzing}
              className={`w-full py-5 font-impact text-2xl uppercase tracking-wide border transition-all ${
                !canAnalyze || isAnalyzing
                  ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                  : 'bg-white text-black border-white hover:bg-zinc-200'
              }`}
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="animate-spin">⚙️</span> AI ANALYZING...
                </span>
              ) : (
                <>🤖 ANALYZE WITH AI</>
              )}
            </button>

            {/* Quick option for text mode */}
            {inputMode === 'text' && canAnalyze && (
              <button
                onClick={analyzeTexts}
                disabled={isAnalyzing}
                className="w-full py-3 text-zinc-500 hover:text-white text-[10px] font-mono uppercase tracking-wider transition-colors"
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
    <div className="h-full w-full flex flex-col bg-matte-base relative overflow-y-auto">
      <div className="absolute inset-0 bg-topo-pattern opacity-5 pointer-events-none"></div>
      
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between relative z-10 sticky top-0 bg-matte-base/95 backdrop-blur-sm">
        <button 
          onClick={() => setCurrentStep('samples')}
          className="flex items-center gap-3 text-zinc-500 hover:text-white transition-colors group"
        >
          <span className="text-lg">←</span>
          <span className="text-[10px] font-mono uppercase tracking-widest group-hover:text-hard-gold transition-colors">EDIT SAMPLES</span>
        </button>
        <div className="label-sm text-zinc-500">STEP 2 OF 2</div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 md:p-10 relative z-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <div className="label-sm text-hard-gold mb-2">YOUR PROFILE</div>
            <h2 className="text-3xl md:text-4xl font-impact text-white uppercase tracking-tight">REVIEW & ADJUST</h2>
            <p className="text-zinc-500 text-sm mt-2">looks good? tweak anything before saving.</p>
          </div>

          {/* AI Analysis Summary (if available) */}
          {analysisResult && (
            <div className={`bg-zinc-900 border ${analysisResult.confidence === 0 ? 'border-red-900/50' : 'border-hard-gold/30'} p-6 relative`}>
              <CornerNodes className="opacity-30" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{analysisResult.confidence === 0 ? '⚠️' : '🤖'}</span>
                    <div className={`label-sm ${analysisResult.confidence === 0 ? 'text-red-400' : 'text-hard-gold'}`}>
                      {analysisResult.confidence === 0 ? 'AI UNAVAILABLE' : 'AI ANALYSIS'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-mono text-zinc-500">CONFIDENCE</div>
                    <div className={`px-2 py-1 text-[10px] font-mono font-bold ${
                      analysisResult.confidence >= 70 ? 'bg-green-900/50 text-green-400 border border-green-700' :
                      analysisResult.confidence >= 40 ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700' :
                      'bg-red-900/50 text-red-400 border border-red-700'
                    }`}>
                      {analysisResult.confidence}%
                    </div>
                  </div>
                </div>
                
                {/* Summary - different styling for error vs success */}
                <p className={`text-sm italic ${analysisResult.confidence === 0 ? 'text-red-300' : 'text-white'}`}>
                  "{analysisResult.summary}"
                </p>
                
                {/* Show retry hint when AI fails */}
                {analysisResult.confidence === 0 && (
                  <div className="text-[10px] font-mono text-zinc-500 border-t border-zinc-800 pt-3 mt-3">
                    ⚡ AI service temporarily unavailable. You can still manually configure your style below, or try again later.
                  </div>
                )}
                
                {/* Detected Patterns */}
                {analysisResult.extractedPatterns.length > 0 && (
                  <div>
                    <div className="label-sm text-zinc-500 mb-2">DETECTED PATTERNS</div>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.extractedPatterns.map((pattern, i) => (
                        <span key={i} className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs font-mono border border-zinc-700">
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Profile Settings */}
          <div className="space-y-6">
            {/* Emoji Usage */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
              <CornerNodes className="opacity-30" />
              <div>
                <label className="label-sm text-zinc-400 mb-3 block">EMOJI USAGE</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['none', 'minimal', 'moderate', 'heavy'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, emojiUsage: level })}
                      className={`py-2 px-3 border text-[10px] font-mono uppercase tracking-wider transition-all ${
                        profile.emojiUsage === level
                          ? 'bg-white text-black border-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Capitalization */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
              <CornerNodes className="opacity-30" />
              <div>
                <label className="label-sm text-zinc-400 mb-3 block">CAPITALIZATION</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['lowercase', 'mixed', 'normal'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, capitalization: level })}
                      className={`py-2 px-3 border text-[10px] font-mono uppercase tracking-wider transition-all ${
                        profile.capitalization === level
                          ? 'bg-white text-black border-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Punctuation */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
              <CornerNodes className="opacity-30" />
              <div>
                <label className="label-sm text-zinc-400 mb-3 block">PUNCTUATION</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['none', 'minimal', 'full'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, punctuation: level })}
                      className={`py-2 px-3 border text-[10px] font-mono uppercase tracking-wider transition-all ${
                        profile.punctuation === level
                          ? 'bg-white text-black border-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Message Length */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
              <CornerNodes className="opacity-30" />
              <div>
                <label className="label-sm text-zinc-400 mb-3 block">MESSAGE LENGTH</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['short', 'medium', 'long'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, averageLength: level })}
                      className={`py-2 px-3 border text-[10px] font-mono uppercase tracking-wider transition-all ${
                        profile.averageLength === level
                          ? 'bg-white text-black border-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Slang Level */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
              <CornerNodes className="opacity-30" />
              <div>
                <label className="label-sm text-zinc-400 mb-3 block">SLANG LEVEL</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['formal', 'casual', 'heavy-slang'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setProfile({ ...profile, slangLevel: level })}
                      className={`py-2 px-3 border text-[10px] font-mono uppercase tracking-wider transition-all ${
                        profile.slangLevel === level
                          ? 'bg-white text-black border-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {level === 'heavy-slang' ? 'HEAVY' : level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preferred Tone */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
              <CornerNodes className="opacity-30" />
              <div>
                <label className="label-sm text-zinc-400 mb-3 block">PREFERRED TONE</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['playful', 'chill', 'direct', 'sweet'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setProfile({ ...profile, preferredTone: tone })}
                      className={`py-2 px-3 border text-[10px] font-mono uppercase tracking-wider transition-all ${
                        profile.preferredTone === tone
                          ? 'bg-white text-black border-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.3)]'
                          : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Signature Patterns */}
            {profile.signaturePatterns.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 p-6 relative">
                <CornerNodes className="opacity-30" />
                <div>
                  <div className="label-sm text-zinc-400 mb-3">DETECTED PATTERNS</div>
                  <div className="flex flex-wrap gap-2">
                    {profile.signaturePatterns.map((pattern, i) => (
                      <span key={i} className="px-3 py-1 border border-hard-gold text-hard-gold text-xs font-mono">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full py-5 bg-white text-black font-impact text-2xl uppercase tracking-wide hover:bg-zinc-200 transition-colors"
          >
            SAVE PROFILE
          </button>
        </div>
      </div>
    </div>
  );
};
