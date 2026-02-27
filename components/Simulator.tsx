import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Upload, MessageSquare, Copy, Check, Sparkles, ThumbsUp, Minus, ThumbsDown, ArrowLeft, Target, Shield, Activity, Cpu, Zap, Terminal, Clock, AlertTriangle, MessageCircle } from 'lucide-react';
import { generatePersona, simulateDraft, analyzeSimulation } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';
import { createPersona, createSession } from '../services/dbService';
import { SimResult, Persona, SimAnalysisResult, UserStyleProfile } from '../types';
import { useGlobalToast } from './Toast';
import { ModuleHeader } from './ModuleHeader';

interface SimulatorProps {
  userProfile?: UserStyleProfile | null;
  firebaseUid?: string | null;
  userId?: number | null;
  onBack: () => void;
  initialView?: View;
  initialAnalysisResult?: SimAnalysisResult | null;
}

type View = 'setup' | 'chat' | 'analysis';

export const Simulator: React.FC<SimulatorProps> = ({ userProfile, firebaseUid, userId, onBack, initialView = 'setup', initialAnalysisResult = null }) => {
  const [view, setView] = useState<View>(initialView);
  const { showToast } = useGlobalToast();

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [personaDescription, setPersonaDescription] = useState('');
  const [customName, setCustomName] = useState('');
  const [relationshipContext, setRelationshipContext] = useState<'NEW_MATCH' | 'TALKING_STAGE' | 'DATING' | 'SITUATIONSHIP' | 'EX' | 'FRIEND'>('TALKING_STAGE');
  const [harshnessLevel, setHarshnessLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [draft, setDraft] = useState('');
  const [simHistory, setSimHistory] = useState<{ draft: string, result: SimResult }[]>([]);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [showPracticePartners, setShowPracticePartners] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<SimAnalysisResult | null>(initialAnalysisResult);

  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'mid' | 'off'>>({});

  const [savedPersonas, setSavedPersonas] = useState<Persona[]>(() => {
    const saved = localStorage.getItem('unsend_personas');
    return saved ? JSON.parse(saved) : [];
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activePersona?.name) {
      const storageKey = `unsend_sim_history_${activePersona.name.replace(/\s+/g, '_')}`;
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        try {
          setSimHistory(JSON.parse(savedHistory));
        } catch (e) {
          console.error('Failed to load chat history:', e);
          setSimHistory([]);
        }
      } else {
        setSimHistory([]);
      }
    }
  }, [activePersona?.name]);

  useEffect(() => {
    if (activePersona?.name && simHistory.length > 0) {
      const storageKey = `unsend_sim_history_${activePersona.name.replace(/\s+/g, '_')}`;
      localStorage.setItem(storageKey, JSON.stringify(simHistory));
    }
  }, [simHistory, activePersona?.name]);

  useEffect(() => {
    if (view === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [simHistory, view, chatLoading]);

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  const copyToClipboard = useCallback((text: string) => {
    handleAction(() => {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      showToast('Copied to clipboard', 'copied');
      setTimeout(() => setCopiedText(null), 1500);
    }, 10);
  }, [showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setPreviewUrls(prev => [...prev, base64]);
          setScreenshots(prev => [...prev, base64.split(',')[1]]);
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const buildPersona = async () => {
    if (!personaDescription && screenshots.length === 0) return;
    handleAction(() => setSetupLoading(true), 15);
    try {
      const persona = await generatePersona(personaDescription, screenshots, relationshipContext, harshnessLevel);
      if (customName.trim()) persona.name = customName.trim();
      setActivePersona(persona);

      if (userId) {
        try {
          await createPersona({
            user_id: userId,
            name: persona.name,
            relationship_context: relationshipContext,
            harshness_level: harshnessLevel,
            communication_tips: persona.communicationTips || [],
            conversation_starters: persona.conversationStarters || [],
            things_to_avoid: persona.thingsToAvoid || [],
          });
        } catch (dbError) {
          console.error('Failed to save persona to DB:', dbError);
        }
      }

      setSavedPersonas(prev => [...prev, persona]);
      localStorage.setItem('unsend_personas', JSON.stringify([...savedPersonas, persona]));
    } finally {
      setSetupLoading(false);
      setView('chat');
    }
  };

  const loadPersona = (p: Persona) => {
    handleAction(() => {
      setActivePersona(p);
      setView('chat');
    }, 10);
  };

  const runSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !activePersona) return;
    const sentMessage = draft;
    handleAction(() => {
      setPendingMessage(sentMessage);
      setDraft('');
      setChatLoading(true);
    }, 15);
    const result = await simulateDraft(firebaseUid ?? undefined, sentMessage, activePersona, userProfile);
    setSimHistory(prev => [...prev, { draft: sentMessage, result }]);
    setPendingMessage(null);
    setChatLoading(false);
  };

  const handleEndSim = async () => {
    if (!activePersona || simHistory.length === 0) return;
    handleAction(() => setAnalyzing(true), 20);
    try {
      const result = await analyzeSimulation(simHistory, activePersona, userProfile);
      setAnalysisResult(result);

      if (firebaseUid) {
        logSession(firebaseUid, 'practice', activePersona.name, result.ghostRisk);
      }

      if (firebaseUid) {
        try {
          await createSession(firebaseUid, {
            type: 'practice',
            persona: activePersona.name,
            analysis: result,
            history: simHistory,
            timestamp: new Date().toISOString(),
          }, {
            mode: 'simulator',
            persona_name: activePersona.name,
            headline: result.headline,
            ghost_risk: result.ghostRisk,
            message_count: simHistory.length,
          });
        } catch (dbError) {
          console.error('Failed to save session to DB:', dbError);
        }
      }
    } finally {
      setAnalyzing(false);
      setView('analysis');
    }
  };

  const resetSim = () => {
    handleAction(() => {
      setSimHistory([]);
      setAnalysisResult(null);
      setFeedbackGiven({});
      setView('chat');
    }, 10);
  };

  // --- LOADING STATES ---
  if (setupLoading || analyzing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-matte-base p-12 relative overflow-hidden select-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-white/[0.01] rounded-full blur-[100px]"></div>
        
        <div className="relative mb-12">
          <div className="w-24 h-24 bg-white/5 flex items-center justify-center border border-white/5 rounded-full shadow-2xl">
             <Activity className="w-8 h-8 text-white/20" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">
          {analyzing ? "Analyzing Conversation" : "Generating Profile"}
        </h2>
        <div className="flex flex-col items-center gap-3">
           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">
             Please wait while we process your request
           </p>
        </div>
      </div>
    );
  }

  // --- SETUP VIEW ---
  if (view === 'setup') {
    return (
      <div className="w-full h-full flex flex-col bg-matte-base relative overflow-hidden select-none">
        {/* MODULE HEADER */}
        <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="Practice Mode" 
            mode="Conversation Setup" 
            onBack={() => handleAction(onBack)}
            accentColor="blue"
            statusLabel="Engine"
            statusValue="Ready"
            statusColor="emerald"
          />
        </div>

        <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative z-10">
          {/* LEFT: SAVED PROFILES */}
          <div className={`order-2 md:order-1 w-full md:w-80 border-t md:border-t-0 md:border-r border-white/5 bg-black/20 flex flex-col md:h-full overflow-hidden ${savedPersonas.length === 0 ? 'hidden md:flex' : ''}`}>
            <button
              className="md:hidden w-full p-5 flex items-center justify-between bg-white/5 border-b border-white/5"
              onClick={() => handleAction(() => setShowPracticePartners(!showPracticePartners))}
            >
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-zinc-500" />
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Saved Profiles</h4>
                {savedPersonas.length > 0 && (
                  <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">{savedPersonas.length}</span>
                )}
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${showPracticePartners ? 'rotate-180' : ''}`} />
            </button>

            <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${showPracticePartners || window.innerWidth >= 768 ? 'opacity-100' : 'max-h-0 opacity-0 md:opacity-100 md:max-h-full'}`}>
              <div className="hidden md:flex items-center justify-between p-6 shrink-0 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Target className="w-4 h-4 text-zinc-500" />
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Saved Profiles</h4>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 scrollbar-hide">
                {savedPersonas.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">No saved profiles</p>
                  </div>
                ) : (
                  savedPersonas.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadPersona(p)}
                      className="w-full text-left p-4 bg-white/5 border border-white/5 hover:border-blue-500/20 hover:bg-white/[0.02] transition-all group rounded-2xl relative overflow-hidden active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 shrink-0 bg-white/5 flex items-center justify-center text-zinc-400 border border-white/10 rounded-full font-bold text-lg">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-bold text-xs text-white truncate">{p.name}</div>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              p.harshnessLevel && p.harshnessLevel >= 5 ? 'bg-red-500' :
                              p.harshnessLevel && p.harshnessLevel >= 3 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}></div>
                          </div>
                          <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest">{p.relationshipContext?.replace('_', ' ')}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: BUILDER */}
          <div className="order-1 md:order-2 flex-1 p-6 md:p-12 overflow-y-auto scrollbar-hide relative">
            <div className="max-w-2xl mx-auto w-full space-y-10">
              <div className="space-y-4">
                <h3 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-none">New Practice Target</h3>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed">Define the communication patterns you want to test against.</p>
              </div>

              <div className="space-y-8 bg-white/5 border border-white/5 p-8 rounded-[2.5rem] relative shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Name</label>
                    <input
                      type="text"
                      className="w-full bg-black/40 border border-white/5 p-4 text-white text-sm font-bold focus:border-blue-500/30 focus:outline-none rounded-2xl transition-all"
                      placeholder="e.g. Alex"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3 relative">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Relationship Context</label>
                    <button
                      type="button"
                      onClick={() => handleAction(() => setShowContextDropdown(!showContextDropdown))}
                      className="w-full bg-black/40 border border-white/5 p-4 text-white text-sm font-bold focus:border-blue-500/30 focus:outline-none text-left flex justify-between items-center rounded-2xl transition-all"
                    >
                      <span className="uppercase">{relationshipContext.replace('_', ' ')}</span>
                      <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${showContextDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showContextDropdown && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-zinc-900 border border-white/10 shadow-2xl rounded-2xl overflow-hidden animate-slide-up">
                        {(['NEW_MATCH', 'TALKING_STAGE', 'DATING', 'SITUATIONSHIP', 'EX', 'FRIEND'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              handleAction(() => {
                                setRelationshipContext(option);
                                setShowContextDropdown(false);
                              });
                            }}
                            className={`w-full p-4 text-left text-[10px] font-bold uppercase tracking-widest transition-all ${relationshipContext === option
                              ? 'bg-white text-black'
                              : 'text-zinc-500 hover:bg-white/5 hover:text-white'
                              }`}
                          >
                            {option.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Feedback Style</label>
                    <span className={`text-[10px] font-bold px-3 py-1 bg-white/5 rounded-full border border-white/5 ${
                      harshnessLevel === 5 ? 'text-red-400' : 
                      harshnessLevel >= 3 ? 'text-amber-400' : 
                      'text-emerald-400'
                    }`}>
                      {harshnessLevel === 1 && 'GENTLE'}
                      {harshnessLevel === 2 && 'SUPPORTIVE'}
                      {harshnessLevel === 3 && 'BALANCED'}
                      {harshnessLevel === 4 && 'CRITICAL'}
                      {harshnessLevel === 5 && 'BRUTAL'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 bg-black/20 p-5 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-bold text-zinc-700 uppercase">Low</span>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={harshnessLevel}
                      onChange={(e) => handleAction(() => setHarshnessLevel(parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5), 2)}
                      className="flex-1 h-1 bg-zinc-800 appearance-none cursor-pointer rounded-full accent-white"
                    />
                    <span className="text-[10px] font-bold text-zinc-700 uppercase">High</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Traits & Red Flags</label>
                  <textarea
                    className="w-full bg-black/40 border border-white/5 p-5 text-white text-sm font-bold focus:border-blue-500/30 focus:outline-none h-32 rounded-2xl resize-none leading-relaxed placeholder:text-zinc-800"
                    placeholder="Describe their communication style, personality, and any specific goals for this practice session."
                    value={personaDescription}
                    onChange={(e) => setPersonaDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Reference Screenshots (Optional)</label>
                  <div
                    onClick={() => handleAction(() => fileInputRef.current?.click())}
                    className="border-dashed border-2 border-white/5 bg-white/5 p-6 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-all rounded-3xl"
                  >
                    <div className="flex items-center gap-5">
                      <Upload className="w-5 h-5 text-zinc-600" />
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Upload conversation images</span>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                    {previewUrls.length > 0 && <span className="text-[9px] font-bold text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full">{previewUrls.length} Files</span>}
                  </div>

                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group aspect-[9/16] bg-white/5 border border-white/5 overflow-hidden rounded-xl shadow-lg">
                          <img src={url} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAction(() => {
                                setPreviewUrls(prev => prev.filter((_, i) => i !== index));
                                setScreenshots(prev => prev.filter((_, i) => i !== index));
                              }, 10);
                            }}
                            className="absolute inset-0 bg-red-500/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all"
                          >
                            <X className="w-6 h-6 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={buildPersona}
                  disabled={!customName.trim() || (!personaDescription && screenshots.length === 0)}
                  className="w-full bg-white text-black font-bold text-xl py-5 hover:bg-zinc-200 transition-all disabled:opacity-30 tracking-tight uppercase rounded-3xl shadow-2xl active:scale-[0.98]"
                >
                  Start Simulation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- ANALYSIS VIEW ---
  if (view === 'analysis' && analysisResult) {
    const getRiskColor = (risk: number) => {
      if (risk > 70) return { text: 'text-red-400', bg: 'bg-red-400/5', bar: 'bg-red-400' };
      if (risk > 40) return { text: 'text-amber-400', bg: 'bg-amber-400/5', bar: 'bg-amber-400' };
      return { text: 'text-emerald-400', bg: 'bg-emerald-400/5', bar: 'bg-emerald-400' };
    };
    const riskColors = getRiskColor(analysisResult.ghostRisk);

    const getActionStyle = (action: string) => {
      switch (action) {
        case 'HARD_STOP': return { icon: AlertTriangle, text: 'text-red-400', border: 'border-red-400/20' };
        case 'PULL_BACK': return { icon: Minus, text: 'text-amber-400', border: 'border-amber-400/20' };
        case 'WAIT': return { icon: Clock, text: 'text-blue-400', border: 'border-blue-400/20' };
        case 'FULL_SEND': return { icon: Zap, text: 'text-emerald-400', border: 'border-emerald-400/20' };
        default: return { icon: MessageSquare, text: 'text-zinc-400', border: 'border-white/5' };
      }
    };

    return (
      <div className="w-full h-full flex flex-col bg-matte-base relative overflow-y-auto scrollbar-hide font-sans select-none">
        {/* MODULE HEADER */}
        <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
          <ModuleHeader 
            title="Analysis Summary" 
            mode="Practice Report" 
            id={activePersona?.name.toUpperCase()}
            onBack={() => handleAction(() => setView('chat'))}
            accentColor="blue"
            statusLabel="Session"
            statusValue="Complete"
            statusColor="red"
          />
        </div>

        <div className="flex-1 p-6 md:p-12">
          <div className="max-w-5xl mx-auto space-y-12 pb-32">
            {/* Hero Section */}
            <div className="flex flex-col items-center text-center space-y-8">
              <h3 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tight leading-[0.9] max-w-3xl">
                {analysisResult.headline}
              </h3>
              
              {analysisResult.recommendedNextMove && (() => {
                const style = getActionStyle(analysisResult.recommendedNextMove);
                const ActionIcon = style.icon;
                return (
                  <div className={`bg-white/5 p-8 md:p-12 border ${style.border} rounded-[3rem] shadow-2xl relative`}>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-6">Recommended Move</div>
                    <ActionIcon className={`w-12 h-12 ${style.text} mb-6 mx-auto`} />
                    <span className={`font-black text-4xl md:text-6xl ${style.text} tracking-tight uppercase`}>
                      {analysisResult.recommendedNextMove.replace('_', ' ')}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'GHOST RISK', value: analysisResult.ghostRisk, color: riskColors, info: 'Likelihood of disengagement' },
                { label: 'VIBE MATCH', value: analysisResult.vMatch || analysisResult.vibeMatch || 0, color: { text: 'text-blue-400', bar: 'bg-blue-400' }, info: 'Compatibility score' },
                { label: 'BALANCE', value: analysisResult.effortBalance, color: { text: 'text-amber-400', bar: 'bg-amber-400' }, info: 'Relative investment level' }
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] shadow-xl">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-6">{stat.label}</span>
                  <div className="flex items-baseline gap-2 mb-6 justify-center">
                    <span className={`text-6xl font-black ${stat.color.text} tracking-tighter`}>{stat.value}</span>
                    <span className="text-xl text-zinc-700">%</span>
                  </div>
                  <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden mb-4">
                    <div className={`h-full ${stat.color.bar} transition-all duration-1000`} style={{ width: `${stat.value}%` }}></div>
                  </div>
                  <p className="text-[10px] font-medium text-zinc-600 text-center uppercase tracking-wider">{stat.info}</p>
                </div>
              ))}
            </div>

            {/* Deep Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/5 border border-white/5 p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                  <Activity className="w-5 h-5 text-blue-400" />
                  <h4 className="text-2xl font-black uppercase tracking-tight text-white leading-none">Key Observations</h4>
                </div>
                <ul className="space-y-6">
                  {analysisResult.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0"></div>
                      <p className="text-sm font-medium text-zinc-400 leading-relaxed uppercase tracking-tight">{insight}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white text-black p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                <div className="flex items-center gap-4 mb-8 border-b border-black/10 pb-6">
                  <Target className="w-5 h-5 text-black" />
                  <h4 className="text-2xl font-black uppercase tracking-tight leading-none">Personalized Advice</h4>
                </div>
                <p className="text-lg md:text-xl font-bold leading-relaxed uppercase tracking-tight italic">
                  "{analysisResult.advice}"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-matte-base via-matte-base to-transparent z-50 flex justify-center gap-4 md:gap-6">
          <button
            onClick={() => handleAction(() => setView('chat'), 10)}
            className="px-8 py-4 bg-white/5 border border-white/10 text-xs font-bold text-zinc-400 uppercase tracking-widest hover:text-white transition-all rounded-2xl active:scale-[0.98] min-w-[180px]"
          >
            Back to Chat
          </button>
          <button
            onClick={() => handleAction(resetSim, 15)}
            className="px-8 py-4 bg-white text-black font-black text-lg uppercase tracking-tight hover:bg-zinc-200 transition-all rounded-2xl shadow-2xl active:scale-[0.98] min-w-[220px]"
          >
            New Session
          </button>
        </div>
      </div>
    );
  }

  // --- CHAT VIEW ---
  return (
    <div className="w-full h-full flex flex-col bg-matte-base relative overflow-hidden font-sans select-none">
      {/* MODULE HEADER */}
      <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title={`Chat with ${activePersona?.name}`} 
          mode="Practice Session" 
          onBack={() => handleAction(() => setView('setup'))}
          accentColor="blue"
          statusLabel="Status"
          statusValue="Live"
          statusColor="emerald"
        />
      </div>

      {/* RISK HUD */}
      {(simHistory.length > 0 || chatLoading) && (
        <div className="px-6 py-4 bg-white/5 border-b border-white/5 backdrop-blur-md animate-slide-up relative z-30 flex items-center gap-8">
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Ghost Risk</span>
              <span className={`text-xs font-bold ${
                (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 70 ? 'text-red-400' : 
                (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 40 ? 'text-amber-400' : 
                'text-emerald-400'
              }`}>
                {chatLoading ? '...' : `${simHistory[simHistory.length - 1]?.result.regretLevel || 0}%`}
              </span>
            </div>
            <div className="h-1 bg-black/60 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 70 ? 'bg-red-400' : 
                  (simHistory[simHistory.length - 1]?.result.regretLevel || 0) > 40 ? 'bg-amber-400' : 
                  'bg-emerald-400'
                }`}
                style={{ width: `${chatLoading ? 100 : (simHistory[simHistory.length - 1]?.result.regretLevel || 0)}%` }}
              ></div>
            </div>
          </div>

          <div className="flex-1 space-y-2 border-l border-white/5 pl-8">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Vibe Match</span>
              <span className="text-xs font-bold text-blue-400">
                {chatLoading ? '...' : '84%'}
              </span>
            </div>
            <div className="h-1 bg-black/60 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-400 transition-all duration-1000"
                style={{ width: `${chatLoading ? 100 : 84}%` }}
              ></div>
            </div>
          </div>
          
          <button 
            onClick={() => handleAction(handleEndSim, 20)}
            className="px-6 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all active:scale-[0.98]"
          >
            End & Analyze
          </button>
        </div>
      )}

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide relative z-10 custom-scrollbar pb-32">
        {simHistory.length === 0 && !chatLoading && (
          <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-20 h-20 bg-white/5 border border-white/5 flex items-center justify-center mb-8 rounded-[2rem]">
              <MessageCircle className="w-10 h-10 text-zinc-600" />
            </div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Start the conversation</p>
          </div>
        )}

        {simHistory.map((entry, idx) => (
          <div key={idx} className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Messages */}
              <div className="space-y-6">
                <div className="flex flex-col items-end group">
                  <div className="max-w-[95%] bg-white text-black p-6 relative rounded-3xl rounded-br-none shadow-xl transition-all">
                    <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-black/5 pb-2">Your Draft</div>
                    <p className="text-sm font-bold leading-relaxed">{entry.draft}</p>
                    <button
                      onClick={() => copyToClipboard(entry.draft)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 text-zinc-500 rounded-full"
                    >
                      {copiedText === entry.draft ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-start group">
                  <div className="flex items-start gap-4 max-w-[95%]">
                    <div className="w-10 h-10 bg-white/5 border border-white/10 shrink-0 flex items-center justify-center text-xs font-bold rounded-full text-zinc-500 shadow-lg">
                      {activePersona?.name.charAt(0)}
                    </div>
                    <div className="flex-1 bg-white/5 border border-white/5 p-6 relative rounded-3xl rounded-bl-none shadow-xl transition-all">
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Predicted Reply</div>
                      <p className="text-sm font-bold italic text-zinc-300 leading-relaxed">"{entry.result.predictedReply}"</p>
                      <button
                        onClick={() => copyToClipboard(entry.result.predictedReply || '')}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-600 rounded-full"
                      >
                        {copiedText === entry.result.predictedReply ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Analysis */}
              <div className="bg-white/5 border border-white/5 p-6 md:p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3 text-zinc-500">
                     <Cpu className="w-4 h-4" />
                     <span className="text-[10px] font-bold uppercase tracking-widest">Instant Feedback</span>
                  </div>
                  <div className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full border ${
                    entry.result.regretLevel > 70 ? 'bg-red-400/10 text-red-400 border-red-400/20' :
                    entry.result.regretLevel > 40 ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                    'bg-emerald-400/10 text-emerald-400 border-emerald-400/20'
                  }`}>
                    {entry.result.regretLevel > 70 ? 'Risk Detected' : 'Optimal Flow'}
                  </div>
                </div>

                <p className="text-xs font-bold text-zinc-400 mb-8 leading-relaxed uppercase tracking-tight border-l-2 border-blue-400/30 pl-4 italic">
                  {entry.result.verdict}
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(entry.result.rewrites).filter(([_, text]) => text).map(([key, text]) => (
                    <button
                      key={key}
                      onClick={() => handleAction(() => setDraft(text as string), 10)}
                      className="p-4 bg-white/5 border border-white/5 hover:border-blue-500/20 hover:bg-white/[0.02] text-left transition-all rounded-2xl active:scale-[0.98] group/btn"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover/btn:text-blue-400 transition-colors">
                          {key === 'you' ? 'Auto-Style' : key}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-300 leading-relaxed line-clamp-2 uppercase tracking-tight italic opacity-80 group-hover/btn:opacity-100 transition-opacity">"{text as string}"</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {pendingMessage && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse grayscale opacity-50 font-sans">
            <div className="flex flex-col items-end">
              <div className="max-w-[95%] bg-white text-black p-6 rounded-3xl rounded-br-none">
                <p className="text-sm font-bold uppercase tracking-tight">{pendingMessage}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-8 flex items-center justify-center">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Analyzing...</span>
            </div>
          </div>
        )}

        {chatLoading && !pendingMessage && (
          <div className="flex justify-start animate-fade-in font-sans">
            <div className="bg-white/5 border border-white/5 px-6 py-4 rounded-[2rem] flex items-center gap-4">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Thinking</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-6 md:p-8 bg-matte-base border-t border-white/5 relative z-40 shrink-0">
        <form onSubmit={runSimulation} className="max-w-4xl mx-auto flex gap-4 p-1.5 bg-white/5 border border-white/10 rounded-[2.5rem] focus-within:border-blue-500/30 transition-all shadow-2xl">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your draft message..."
            disabled={chatLoading}
            className="flex-1 bg-transparent px-6 py-4 text-white focus:outline-none placeholder:text-zinc-800 text-sm font-bold uppercase tracking-wider font-sans"
          />
          <button
            type="submit"
            disabled={!draft.trim() || chatLoading}
            className="bg-white text-black font-bold px-10 hover:bg-zinc-200 transition-all disabled:opacity-30 uppercase tracking-tight text-lg min-h-[56px] rounded-3xl active:scale-[0.98]"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
