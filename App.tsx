import React, { useState, useRef, useEffect } from 'react';
import { analyzeGhosting } from './services/geminiService';
import { checkWellbeing, triggerWellbeingCheckIn, dismissWellbeingCheckIn, getWellbeingState, clearWellbeingTrigger } from './services/feedbackService';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultCard } from './components/ResultCard';
import { Simulator } from './components/Simulator';
import { QuickAdvisor } from './components/QuickAdvisor';
import { UserProfile } from './components/UserProfile';
import { AppState, GhostResult, UserStyleProfile, WellbeingState } from './types';

// Feature flag to enable/disable Investigator mode
// Set to true to re-enable Investigator in dev builds
const ENABLE_INVESTIGATOR = false;

type Module = 'standby' | 'simulator' | 'investigator' | 'quick' | 'profile';

// --- VISUAL ASSETS ---
const StarBurst = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
);

const AbstractGrid = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className={className}>
    <path d="M0 20H100 M0 40H100 M0 60H100 M0 80H100" opacity="0.3"/>
    <path d="M20 0V100 M40 0V100 M60 0V100 M80 0V100" opacity="0.3"/>
    <circle cx="50" cy="50" r="30" strokeWidth="1" />
    <path d="M50 20V80 M20 50H80" />
  </svg>
);

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const CornerNodes = ({ className }: { className?: string }) => (
  <div className={`pointer-events-none absolute inset-0 z-50 ${className}`}>
    {/* Top Left */}
    <div className="absolute top-0 left-0">
      <div className="w-2 h-2 border-t border-l border-zinc-500"></div>
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    {/* Top Right */}
    <div className="absolute top-0 right-0">
       <div className="w-2 h-2 border-t border-r border-zinc-500"></div>
       <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    {/* Bottom Left */}
    <div className="absolute bottom-0 left-0">
       <div className="w-2 h-2 border-b border-l border-zinc-500"></div>
       <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
    {/* Bottom Right */}
    <div className="absolute bottom-0 right-0">
       <div className="w-2 h-2 border-b border-r border-zinc-500"></div>
       <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 text-zinc-600 text-[8px]">+</div>
    </div>
  </div>
);

const SystemTicker = () => (
  <div className="w-full bg-black border-t border-zinc-800 py-1 overflow-hidden shrink-0 flex items-center relative z-50">
    <div className="whitespace-nowrap animate-marquee flex gap-8">
      {[...Array(5)].map((_, i) => (
        <React.Fragment key={i}>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
             <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
             SYSTEM: ONLINE
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em]">
             // TARGET: LOCKED
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em]">
             // DETECTING LIES
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em]">
             // PROTOCOL: ROAST
          </span>
          <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-[0.2em] text-hard-gold">
             *** DO NOT TEXT BACK ***
          </span>
        </React.Fragment>
      ))}
    </div>
  </div>
);

// --- COMPONENT: WELLBEING CHECK-IN CARD ---
const WellbeingCheckIn = ({ reason, onDismiss, onDismissForDay }: { 
  reason: WellbeingState['reason']; 
  onDismiss: () => void;
  onDismissForDay: () => void;
}) => {
  const messages: Record<NonNullable<WellbeingState['reason']>, { emoji: string; title: string; message: string }> = {
    late_night: {
      emoji: '🌙',
      title: "it's late bestie",
      message: "nothing good happens after 2am. maybe sleep on it? ur texts will still be there tomorrow and ull prob send something way better when ur not half asleep"
    },
    same_person: {
      emoji: '🔄',
      title: "quick vibe check",
      message: "noticed ur spending a lot of energy on one person. thats valid but also... are they matching ur effort? sometimes stepping back is the power move"
    },
    high_frequency: {
      emoji: '⚡',
      title: "taking a sec",
      message: "uve been grinding hard on this. maybe take a breather? go touch some grass, hydrate, or just vibe for a min. the app will be here when u get back"
    },
    high_risk: {
      emoji: '💛',
      title: "real talk",
      message: "seeing some consistent red flags in ur convos. not judging at all, but wanted to check in - u good? sometimes the move is to focus on u for a bit"
    }
  };

  const content = reason ? messages[reason] : messages.high_frequency;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 max-w-md w-full relative">
        <CornerNodes className="opacity-50" />
        
        {/* Header */}
        <div className="bg-zinc-800 border-b border-zinc-700 px-6 py-4 flex items-center gap-3">
          <span className="text-3xl">{content.emoji}</span>
          <div>
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">WELLBEING CHECK</div>
            <h3 className="font-impact text-xl text-white uppercase">{content.title}</h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-zinc-300 text-sm leading-relaxed mb-6">
            {content.message}
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onDismiss}
              className="w-full py-3 bg-white text-black font-bold text-sm uppercase tracking-wider hover:bg-zinc-200 transition-colors"
            >
              im good, keep going
            </button>
            <button
              onClick={onDismissForDay}
              className="w-full py-3 border border-zinc-700 text-zinc-400 text-sm uppercase tracking-wider hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              dont remind me today
            </button>
          </div>

          {/* Footer note */}
          <p className="text-[10px] text-zinc-600 text-center mt-4 font-mono">
            we just want u to win 💪
          </p>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: SIDE DOCK (Desktop) ---
const SideDock = ({ activeModule, setModule }: { activeModule: Module, setModule: (m: Module) => void }) => {
  return (
    <div className="hidden md:flex w-20 border-r border-zinc-800 bg-matte-base flex-col items-center py-6 z-50 h-full relative">
      <div className="mb-10">
        <StarBurst className="w-6 h-6 text-white animate-spin-slow" />
      </div>
      
      <div className="flex-1 flex flex-col gap-8 w-full px-2">
        <DockItem 
          active={activeModule === 'standby'} 
          onClick={() => setModule('standby')}
          label="SYS"
          index="01"
        />
        <DockItem 
          active={activeModule === 'quick'} 
          onClick={() => setModule('quick')}
          label="QUICK"
          index="02"
          highlight
        />
        {ENABLE_INVESTIGATOR && (
          <DockItem 
            active={activeModule === 'investigator'} 
            onClick={() => setModule('investigator')}
            label="SCAN"
            index="03"
          />
        )}
        <DockItem 
          active={activeModule === 'simulator'} 
          onClick={() => setModule('simulator')}
          label="PRACTICE"
          index={ENABLE_INVESTIGATOR ? "04" : "03"}
        />
        <DockItem 
          active={activeModule === 'profile'} 
          onClick={() => setModule('profile')}
          label="PROFILE"
          index="04"
        />
      </div>

      <div className="mt-auto flex flex-col items-center gap-4 text-[9px] font-mono text-zinc-600">
        <div className="writing-vertical-lr tracking-widest uppercase opacity-30 hover:opacity-100 transition-opacity cursor-default">
            THE BLOCK V3.1
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: BOTTOM TABS (Mobile) ---
const BottomTabs = ({ activeModule, setModule }: { activeModule: Module, setModule: (m: Module) => void }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16 px-2">
        <MobileTabItem 
          active={activeModule === 'standby'} 
          onClick={() => setModule('standby')}
          label="HOME"
          icon="⌂"
        />
        <MobileTabItem 
          active={activeModule === 'quick'} 
          onClick={() => setModule('quick')}
          label="QUICK"
          icon="⚡"
          highlight
        />
        <MobileTabItem 
          active={activeModule === 'simulator'} 
          onClick={() => setModule('simulator')}
          label="PRACTICE"
          icon="💬"
        />
        <MobileTabItem 
          active={activeModule === 'profile'} 
          onClick={() => setModule('profile')}
          label="PROFILE"
          icon="👤"
        />
      </div>
    </div>
  );
};

const MobileTabItem = ({ active, onClick, label, icon, highlight }: { active: boolean, onClick: () => void, label: string, icon: string, highlight?: boolean }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 min-w-[60px] py-2 px-3 rounded-lg transition-all ${
      active 
        ? (highlight ? 'text-emerald-400 bg-emerald-900/30' : 'text-white bg-zinc-800') 
        : (highlight ? 'text-emerald-600' : 'text-zinc-500')
    }`}
  >
    <span className="text-lg">{icon}</span>
    <span className={`text-[9px] font-bold tracking-wider ${active ? '' : 'opacity-70'}`}>
      {label}
    </span>
  </button>
);

const DockItem = ({ active, onClick, label, index, highlight }: { active: boolean, onClick: () => void, label: string, index: string, highlight?: boolean }) => (
  <button 
    onClick={onClick}
    className="w-full flex flex-col items-center justify-center gap-1 group relative"
  >
    <div className={`w-1 h-1 rounded-full mb-2 transition-all duration-300 ${active ? (highlight ? 'bg-emerald-400 w-1.5 h-1.5' : 'bg-hard-gold w-1.5 h-1.5') : (highlight ? 'bg-emerald-800 group-hover:bg-emerald-600' : 'bg-zinc-800 group-hover:bg-zinc-600')}`}></div>
    <span className={`text-[10px] font-bold tracking-widest relative z-10 writing-vertical-lr py-2 transition-colors ${active ? (highlight ? 'text-emerald-400' : 'text-white') : (highlight ? 'text-emerald-600 group-hover:text-emerald-400' : 'text-zinc-600 group-hover:text-zinc-400')}`}>
        {label}
    </span>
    <span className="absolute -right-2 top-0 text-[8px] text-zinc-800 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{index}</span>
  </button>
);

// --- COMPONENT: STANDBY SCREEN (EDITORIAL) ---
const StandbyScreen = ({ onActivate, hasProfile }: { onActivate: (m: Module) => void, hasProfile: boolean }) => (
  <div className="h-full w-full flex flex-col relative overflow-hidden bg-matte-base">
    
    {/* Background Decor */}
    <div className="absolute top-0 right-0 w-[50%] h-full border-l border-zinc-900/50 hidden md:block"></div>
    <AbstractGrid className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] text-zinc-800 opacity-20 pointer-events-none animate-spin-slow" />

    {/* CONTENT GRID */}
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 h-full">
        
        {/* LEFT: HERO */}
        <div className="p-8 md:p-16 flex flex-col justify-center relative z-10 border-b md:border-b-0 md:border-r border-zinc-800">
            <div className="mb-8">
                <span className="label-sm text-hard-gold mb-2 block">RELATIONSHIP FORENSICS UNIT</span>
                <h1 className="text-[5rem] md:text-[8rem] lg:text-[10rem] leading-[0.8] font-impact text-white mb-6">
                    THE<br/>BLOCK
                </h1>
                <p className="text-zinc-500 max-w-sm text-sm leading-relaxed font-editorial">
                    Advanced algorithmic analysis for modern ghosting phenomena. 
                    Identify patterns, predict outcomes, and restore dignity.
                </p>
            </div>
            
            {/* AURA PILL */}
            <div className="flex items-center gap-4">
                <div className="h-12 px-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center gap-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-red-500/10 animate-pulse-glow"></div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse relative z-10"></div>
                    <span className="font-mono text-xs text-zinc-300 relative z-10 tracking-widest">SYSTEM_ONLINE</span>
                </div>
                <StarBurst className="w-8 h-8 text-zinc-800" />
            </div>

            {/* Profile Setup CTA (if no profile) */}
            {!hasProfile && (
              <div className="mt-8 bg-zinc-900/50 border border-zinc-800 p-4 relative">
                <CornerNodes className="opacity-20" />
                <div className="flex items-start gap-3">
                  <span className="text-2xl">👤</span>
                  <div className="flex-1">
                    <div className="label-sm text-zinc-400 mb-1">RECOMMENDED</div>
                    <p className="text-sm text-zinc-300 mb-3">set up your style profile for personalized suggestions</p>
                    <button
                      onClick={() => onActivate('profile')}
                      className="px-4 py-2 bg-white text-black text-[10px] font-mono uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                    >
                      TEACH YOUR VOICE
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* RIGHT: MODULE SELECTOR */}
        <div className="flex flex-col">
            {/* QUICK MODE - Primary CTA */}
            <button 
                onClick={() => onActivate('quick')}
                className="flex-1 border-b border-zinc-800 p-8 md:p-12 text-left hover:bg-emerald-900/20 transition-all group relative overflow-hidden flex flex-col justify-center"
            >
                <div className="absolute right-8 top-8 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <ArrowIcon className="w-12 h-12 text-emerald-400 -rotate-45" />
                </div>
                <div className="absolute top-4 right-4 bg-emerald-500/20 border border-emerald-500/50 px-2 py-1 rounded-full">
                    <span className="text-[10px] text-emerald-400 font-mono">NEW</span>
                </div>
                <div className="label-sm text-zinc-500 group-hover:text-emerald-400 transition-colors mb-2">FAST LANE</div>
                <h2 className="text-5xl md:text-6xl font-impact text-zinc-300 group-hover:text-white transition-colors uppercase">
                    Quick Mode
                </h2>
                <div className="mt-4 opacity-50 group-hover:opacity-100 transition-opacity max-w-md text-xs font-mono text-zinc-400">
                    // PASTE THEIR MESSAGE → GET INSTANT ADVICE
                </div>
            </button>

            {ENABLE_INVESTIGATOR && (
              <button 
                  onClick={() => onActivate('investigator')}
                  className="flex-1 border-b border-zinc-800 p-8 md:p-12 text-left hover:bg-zinc-900/50 transition-all group relative overflow-hidden flex flex-col justify-center"
              >
                  <div className="absolute right-8 top-8 opacity-0 group-hover:opacity-100 transition-all duration-500">
                      <ArrowIcon className="w-12 h-12 text-hard-gold -rotate-45" />
                  </div>
                  <div className="label-sm text-zinc-500 group-hover:text-hard-gold transition-colors mb-2">MODULE 02</div>
                  <h2 className="text-5xl md:text-6xl font-impact text-zinc-300 group-hover:text-white transition-colors uppercase">
                      Investigator
                  </h2>
                  <div className="mt-4 opacity-50 group-hover:opacity-100 transition-opacity max-w-md text-xs font-mono text-zinc-400">
                      // RUN DIAGNOSTICS. DETECT LIES.
                  </div>
              </button>
            )}

            <button 
                onClick={() => onActivate('simulator')}
                className={`flex-1 p-8 md:p-12 text-left hover:bg-zinc-900/50 transition-all group relative overflow-hidden flex flex-col justify-center ${ENABLE_INVESTIGATOR ? '' : ''}`}
            >
                <div className="absolute right-8 top-8 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <ArrowIcon className="w-12 h-12 text-hard-blue -rotate-45" />
                </div>
                <div className="label-sm text-zinc-500 group-hover:text-hard-blue transition-colors mb-2">{ENABLE_INVESTIGATOR ? 'MODULE 03' : 'MODULE 02'}</div>
                <h2 className="text-5xl md:text-6xl font-impact text-zinc-300 group-hover:text-white transition-colors uppercase">
                    Practice Mode
                </h2>
                <div className="mt-4 opacity-50 group-hover:opacity-100 transition-opacity max-w-md text-xs font-mono text-zinc-400">
                    // REHEARSE YOUR TEXTS. SEND WITH CONFIDENCE.
                </div>
            </button>
        </div>
    </div>
  </div>
);

// --- MAIN APP COMPONENT ---
function App() {
  const [activeModule, setActiveModule] = useState<Module>('standby');
  const [state, setState] = useState<AppState>('landing');
  
  // User Profile State
  const [userProfile, setUserProfile] = useState<UserStyleProfile | null>(null);

  // Wellbeing Check-in State
  const [wellbeingCheckIn, setWellbeingCheckIn] = useState<WellbeingState | null>(null);

  // Load user profile from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('userStyleProfile');
      if (saved) {
        setUserProfile(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }, []);

  // Check wellbeing on module changes and periodically
  useEffect(() => {
    const checkAndTriggerWellbeing = () => {
      const reason = checkWellbeing();
      if (reason) {
        triggerWellbeingCheckIn(reason);
        setWellbeingCheckIn({ triggered: true, reason });
      }
    };

    // Check when entering quick or practice mode
    if (activeModule === 'quick' || activeModule === 'simulator') {
      checkAndTriggerWellbeing();
    }

    // Also check every 10 minutes while using the app
    const interval = setInterval(checkAndTriggerWellbeing, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeModule]);

  // Handle wellbeing dismissal
  const handleWellbeingDismiss = () => {
    clearWellbeingTrigger();
    setWellbeingCheckIn(null);
  };

  const handleWellbeingDismissForDay = () => {
    dismissWellbeingCheckIn(24);
    setWellbeingCheckIn(null);
  };

  // Save user profile to localStorage
  const handleSaveProfile = (profile: UserStyleProfile) => {
    try {
      localStorage.setItem('userStyleProfile', JSON.stringify(profile));
      setUserProfile(profile);
      setActiveModule('standby');
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };
  
  // Investigator State
  const [investigateMode, setInvestigateMode] = useState<'text' | 'screenshot'>('screenshot');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [lastMessage, setLastMessage] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [result, setResult] = useState<GhostResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      fileArray.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          setPreviewUrls(prev => [...prev, base64String]);
          setScreenshots(prev => [...prev, base64Data]);
        };
        reader.readAsDataURL(file as Blob);
      });
    }
  };

  const handleSubmitInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (investigateMode === 'text' && !name) return;
    if (investigateMode === 'screenshot' && screenshots.length === 0) return;
    
    setState('loading');
    
    try {
      const [_, data] = await Promise.all([
        new Promise(resolve => setTimeout(resolve, 3000)),
        analyzeGhosting(name, city, lastMessage, investigateMode === 'screenshot' ? screenshots : undefined)
      ]);
      setResult(data);
      setState('results');
    } catch (error) {
      console.error(error);
      setState('error');
    }
  };

  const resetInvestigation = () => {
    setState('landing');
    setResult(null);
    setScreenshots([]);
    setPreviewUrls([]);
    setLastMessage('');
    setName('');
    setCity('');
  };

  const hasScreenshots = investigateMode === 'screenshot' && screenshots.length > 0;

  return (
    <div className="flex h-screen w-screen bg-matte-base text-zinc-100 overflow-hidden font-sans selection:bg-white selection:text-black">
      
      {/* Wellbeing Check-in Modal */}
      {wellbeingCheckIn?.triggered && wellbeingCheckIn.reason && (
        <WellbeingCheckIn 
          reason={wellbeingCheckIn.reason}
          onDismiss={handleWellbeingDismiss}
          onDismissForDay={handleWellbeingDismissForDay}
        />
      )}
      
      <SideDock activeModule={activeModule} setModule={setActiveModule} />
      
      {/* MAIN CONTAINER */}
      <div className="flex-1 relative h-full flex flex-col p-2 md:p-4 overflow-hidden pb-20 md:pb-4">
        
        {/* VIEWPORT FRAME */}
        <div className="relative w-full h-full border border-zinc-800 bg-black/20 overflow-hidden flex flex-col shadow-2xl">
            <CornerNodes />

            {state === 'loading' && <LoadingScreen />}

            {/* STANDBY MODULE */}
            {activeModule === 'standby' && (
                <StandbyScreen onActivate={setActiveModule} hasProfile={!!userProfile} />
            )}

            {/* PRACTICE MODE MODULE */}
            {activeModule === 'simulator' && (
                <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base overflow-y-auto">
                    <Simulator onPivotToInvestigator={ENABLE_INVESTIGATOR ? () => setActiveModule('investigator') : undefined} userProfile={userProfile} />
                </div>
            )}

            {/* QUICK MODE MODULE */}
            {activeModule === 'quick' && (
                <div className="h-full w-full flex flex-col animate-fade-in overflow-y-auto">
                    <QuickAdvisor onBack={() => setActiveModule('standby')} userProfile={userProfile} />
                </div>
            )}

            {/* USER PROFILE MODULE */}
            {activeModule === 'profile' && (
                <div className="h-full w-full flex flex-col animate-fade-in overflow-y-auto">
                    <UserProfile 
                      onBack={() => setActiveModule('standby')}
                      onSave={handleSaveProfile}
                      initialProfile={userProfile}
                    />
                </div>
            )}

            {/* INVESTIGATOR MODULE (hidden when ENABLE_INVESTIGATOR is false) */}
            {ENABLE_INVESTIGATOR && activeModule === 'investigator' && (
                <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                
                {state === 'landing' && (
                    <div className="h-full flex items-center justify-center p-6 relative">
                        {/* Background Topo */}
                        <div className="absolute inset-0 bg-topo-pattern opacity-10 pointer-events-none"></div>

                        <div className="w-full max-w-5xl bg-zinc-900 border border-zinc-800 shadow-2xl relative overflow-hidden group">
                             <CornerNodes className="opacity-50" />
                            <div className="grid md:grid-cols-2 h-full min-h-[500px]">
                                {/* Left Panel */}
                                <div className="p-10 border-r border-zinc-800 flex flex-col justify-between bg-zinc-900 relative">
                                    <div className="absolute inset-0 bg-scan-lines opacity-10 pointer-events-none"></div>
                                    <div className="relative z-10">
                                        <div className="label-sm text-hard-gold mb-4 border border-zinc-700 w-fit px-2 py-1 flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 bg-hard-gold animate-pulse"></div>
                                          CASE FILE #001
                                        </div>
                                        <h2 className="text-5xl font-impact text-white mb-6 leading-none">RUN<br/>THE SCAN</h2>
                                        <p className="text-zinc-400 text-sm font-editorial leading-relaxed max-w-sm">
                                            Drop the receipts or type out the tea. We'll tell you if you're cooked.
                                        </p>
                                    </div>
                                    <div className="space-y-4 mt-12 relative z-10">
                                        <button 
                                            onClick={() => setInvestigateMode('screenshot')}
                                            className={`w-full p-4 border text-left transition-all relative group ${investigateMode === 'screenshot' ? 'bg-white text-black border-white' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="font-bold text-xs uppercase tracking-wider">Method A: Drop Receipts</div>
                                                {investigateMode === 'screenshot' && <StarBurst className="w-4 h-4" />}
                                            </div>
                                            <div className={`text-[10px] uppercase tracking-widest ${investigateMode === 'screenshot' ? 'opacity-100' : 'opacity-50'}`}>Upload Screenshots</div>
                                        </button>
                                        <button 
                                            onClick={() => setInvestigateMode('text')}
                                            className={`w-full p-4 border text-left transition-all relative group ${investigateMode === 'text' ? 'bg-white text-black border-white' : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="font-bold text-xs uppercase tracking-wider">Method B: Type It Out</div>
                                                {investigateMode === 'text' && <StarBurst className="w-4 h-4" />}
                                            </div>
                                            <div className={`text-[10px] uppercase tracking-widest ${investigateMode === 'text' ? 'opacity-100' : 'opacity-50'}`}>Manual Input</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Right Form */}
                                <div className="p-10 flex flex-col justify-center bg-zinc-900/50">
                                    <form onSubmit={handleSubmitInvestigation} className="space-y-6">
                                        {investigateMode === 'screenshot' ? (
                                            <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border border-dashed border-zinc-700 bg-zinc-900/50 h-48 flex flex-col items-center justify-center cursor-pointer hover:border-white transition-all group relative overflow-hidden"
                                            >
                                            {previewUrls.length > 0 ? (
                                                <div className="absolute inset-0 p-4 flex gap-2 overflow-x-auto items-center bg-black/80">
                                                    {previewUrls.map((url, i) => (
                                                        <img key={i} src={url} className="h-full border border-zinc-700" />
                                                    ))}
                                                    <div className="h-12 w-12 flex items-center justify-center bg-zinc-800 text-white font-bold">+</div>
                                                </div>
                                            ) : (
                                                <>
                                                <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center mb-3 group-hover:bg-white group-hover:text-black transition-colors">
                                                    <span className="text-xl">↓</span>
                                                </div>
                                                <span className="label-sm">DROP SCREENSHOTS</span>
                                                </>
                                            )}
                                            <input 
                                                type="file" 
                                                multiple 
                                                accept="image/*"
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileChange}
                                            />
                                            </div>
                                        ) : (
                                            <textarea
                                            required
                                            placeholder="PASTE THE LAST MESSAGE... (the one that made you spiral)"
                                            className="w-full bg-zinc-900 border border-zinc-700 p-4 text-white focus:border-white focus:outline-none h-48 resize-none font-mono text-xs uppercase placeholder:text-zinc-500/60"
                                            value={lastMessage}
                                            onChange={e => setLastMessage(e.target.value)}
                                            />
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <input 
                                            type="text" 
                                            required={!hasScreenshots}
                                            placeholder="THE SUSPECT"
                                            className="bg-zinc-900 border border-zinc-700 p-3 text-white focus:border-white focus:outline-none text-xs font-mono uppercase placeholder:text-zinc-500/60"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            />
                                            <input 
                                            type="text" 
                                            required={!hasScreenshots}
                                            placeholder="THEIR TURF"
                                            className="bg-zinc-900 border border-zinc-700 p-3 text-white focus:border-white focus:outline-none text-xs font-mono uppercase placeholder:text-zinc-500/60"
                                            value={city}
                                            onChange={e => setCity(e.target.value)}
                                            />
                                        </div>

                                        <button 
                                        type="submit"
                                        className="w-full bg-white text-black font-impact text-2xl py-4 hover:bg-zinc-200 transition-all uppercase tracking-wide border border-white"
                                        >
                                        Run Diagnostic
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {state === 'results' && result && (
                    <div className="h-full w-full overflow-hidden p-2 md:p-6 bg-matte-base">
                        <ResultCard 
                        result={result} 
                        onReset={resetInvestigation} 
                        targetName={result.identifiedName || name || "UNKNOWN"} 
                        />
                    </div>
                )}

                {state === 'error' && (
                    <div className="flex h-full items-center justify-center">
                    <div className="bg-zinc-900 border border-red-900 p-10 text-center max-w-lg">
                        <h2 className="text-4xl font-impact text-red-600 mb-2">SYSTEM ERROR</h2>
                        <p className="font-mono text-zinc-500 mb-6 text-sm">CONNECTION DROPPED.</p>
                        <button onClick={resetInvestigation} className="bg-white text-black font-bold py-3 px-8 hover:bg-zinc-200 uppercase tracking-widest text-xs">Reboot</button>
                    </div>
                    </div>
                )}
                </div>
            )}
        </div>
        
        {/* SYSTEM TICKER */}
        <SystemTicker />

      </div>
      
      {/* Mobile Bottom Navigation */}
      <BottomTabs activeModule={activeModule} setModule={setActiveModule} />
    </div>
  );
}

export default App;