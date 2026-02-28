import React, { useState, useEffect } from 'react';
import { Home, Zap, MessageSquare, User, ArrowRight, LogOut, Clock, HeartHandshake } from 'lucide-react';
import { checkWellbeing, triggerWellbeingCheckIn, dismissWellbeingCheckIn, clearWellbeingTrigger } from './services/feedbackService';
import { getOrCreateUser, getStyleProfile, saveStyleProfile } from './services/dbService';
import { onAuthChange, signOutUser, AuthUser, logScreenView } from './services/firebaseService';
import { LoadingScreen } from './components/LoadingScreen';
import { Simulator } from './components/Simulator';
import { QuickAdvisor } from './components/QuickAdvisor';
import { UserProfile } from './components/UserProfile';
import { History } from './components/History';
import { AuthModal } from './components/AuthModal';
import { TherapistChat } from './components/TherapistChat';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppState, UserStyleProfile, WellbeingState } from './types';
import { Logo } from './components/Logo';

type Module = 'standby' | 'simulator' | 'quick' | 'profile' | 'history' | 'therapist';

// --- VISUAL ASSETS ---
// AbstractGrid and other custom decorative elements retained
const AbstractGrid = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className={className}>
    <path d="M0 20H100 M0 40H100 M0 60H100 M0 80H100" opacity="0.3" />
    <path d="M20 0V100 M40 0V100 M60 0V100 M80 0V100" opacity="0.3" />
    <circle cx="50" cy="50" r="30" strokeWidth="1" />
    <path d="M50 20V80 M20 50H80" />
  </svg>
);

// StarBurst decorative element
const StarBurst = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    <circle cx="12" cy="12" r="3" />
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
      emoji: '☾',
      title: "it's late bestie",
      message: "nothing good happens after 2am. maybe sleep on it? ur texts will still be there tomorrow and ull prob send something way better when ur not half asleep"
    },
    same_person: {
      emoji: '↺',
      title: "quick vibe check",
      message: "noticed ur spending a lot of energy on one person. thats valid but also... are they matching ur effort? sometimes stepping back is the power move"
    },
    high_frequency: {
      emoji: '◈',
      title: "taking a sec",
      message: "uve been grinding hard on this. maybe take a breather? go touch some grass, hydrate, or just vibe for a min. the app will be here when u get back"
    },
    high_risk: {
      emoji: '♡',
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
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">WELLBEING CHECK</div>
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
              className="w-full py-3 bg-white text-black font-bold text-sm uppercase tracking-wider hover:bg-zinc-200 transition-colors min-h-[44px]"
            >
              im good, keep going
            </button>
            <button
              onClick={onDismissForDay}
              className="w-full py-3 border border-zinc-700 text-zinc-400 text-sm uppercase tracking-wider hover:border-zinc-500 hover:text-zinc-200 transition-colors min-h-[44px]"
            >
              dont remind me today
            </button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-zinc-600 text-center mt-4 font-mono">
            we just want u to win →
          </p>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: SIDE DOCK (Desktop) ---
const SideDock = ({ activeModule, setModule, authUser, onSignOut }: {
  activeModule: Module,
  setModule: (m: Module) => void,
  authUser?: AuthUser | null,
  onSignOut?: () => void
}) => {
  return (
    <div className="hidden md:flex w-20 border-r border-zinc-800 bg-matte-base flex-col items-center py-6 z-50 h-full relative">
      <div className="mb-10">
        <Logo size={40} className="animate-pulse" />
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
        />
        <DockItem
          active={activeModule === 'simulator'}
          onClick={() => setModule('simulator')}
          label="PRACTICE"
          index="03"
        />
        <DockItem
          active={activeModule === 'history'}
          onClick={() => setModule('history')}
          label="HISTORY"
          index="04"
        />
        <DockItem
          active={activeModule === 'therapist'}
          onClick={() => setModule('therapist')}
          label="THERAPY"
          index="05"
        />
        <DockItem
          active={activeModule === 'profile'}
          onClick={() => setModule('profile')}
          label="PROFILE"
          index="06"
        />
      </div>

      <div className="mt-auto flex flex-col items-center gap-4">
        {/* User Avatar & Sign Out */}
        {authUser && (
          <div className="flex flex-col items-center gap-3 mb-4 group">
            <div className="relative">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={authUser.displayName || 'User'}
                  className="w-10 h-10 rounded-full border-2 border-zinc-700 group-hover:border-zinc-500 transition-all shadow-lg"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-hard-gold/80 via-amber-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold shadow-lg ring-2 ring-zinc-800 group-hover:ring-zinc-600 transition-all">
                  {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              {/* Online indicator dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-matte-base"></div>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-2 py-1 text-zinc-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-all text-[9px] font-mono uppercase tracking-wider"
                title="Sign out"
              >
                <LogOut className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        <div className="text-[9px] font-mono text-zinc-600 writing-vertical-lr tracking-widest uppercase opacity-30 hover:opacity-100 transition-opacity cursor-default">
          RIZZBOT V3.1
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: BOTTOM TABS (Mobile) - Compact & Touch-Friendly ---
const BottomTabs = ({ activeModule, setModule }: { activeModule: Module, setModule: (m: Module) => void }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800/80 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-[52px] px-1">
        <MobileTabItemSvg
          active={activeModule === 'standby'}
          onClick={() => setModule('standby')}
          label="HOME"
          Icon={Home}
        />
        <MobileTabItemSvg
          active={activeModule === 'quick'}
          onClick={() => setModule('quick')}
          label="QUICK"
          Icon={Zap}
        />
        <MobileTabItemSvg
          active={activeModule === 'simulator'}
          onClick={() => setModule('simulator')}
          label="SIM"
          Icon={MessageSquare}
        />
        <MobileTabItemSvg
          active={activeModule === 'history'}
          onClick={() => setModule('history')}
          label="LOG"
          Icon={Clock}
        />
        <MobileTabItemSvg
          active={activeModule === 'profile'}
          onClick={() => setModule('profile')}
          label="YOU"
          Icon={User}
        />
        <MobileTabItemSvg
          active={activeModule === 'therapist'}
          onClick={() => setModule('therapist')}
          label="TALK"
          Icon={HeartHandshake}
        />
      </div>
    </div>
  );
};

const MobileTabItemSvg = ({ active, onClick, label, Icon }: {
  active: boolean,
  onClick: () => void,
  label: string,
  Icon: React.FC<{ className?: string }>
}) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-md transition-all ${active
      ? 'text-white bg-zinc-800/80'
      : 'text-zinc-500 active:text-zinc-300'
      }`}
  >
    <Icon className={`${active ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
    <span className={`text-[9px] font-bold tracking-tight uppercase ${active ? '' : 'opacity-60'}`}>
      {label}
    </span>
  </button>
);

const MobileTabItem = ({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: string }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 min-w-[60px] py-2 px-3 rounded-lg transition-all ${active
      ? 'text-white bg-zinc-800'
      : 'text-zinc-500 hover:text-zinc-300'
      }`}
  >
    <span className="text-lg">{icon}</span>
    <span className={`text-xs font-bold tracking-wider ${active ? '' : 'opacity-70'}`}>
      {label}
    </span>
  </button>
);

const DockItem = ({ active, onClick, label, index }: { active: boolean, onClick: () => void, label: string, index: string }) => (
  <button
    onClick={onClick}
    className="w-full flex flex-col items-center justify-center gap-1 group relative"
  >
    <div className={`w-1 h-1 rounded-full mb-2 transition-all duration-300 ${active ? 'bg-hard-gold w-1.5 h-1.5' : 'bg-zinc-800 group-hover:bg-zinc-600'}`}></div>
    <span className={`text-[10px] font-bold tracking-widest relative z-10 writing-vertical-lr py-2 transition-colors ${active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
      {label}
    </span>
    <span className="absolute -right-2 top-0 text-[8px] text-zinc-800 font-mono opacity-0 group-hover:opacity-100 transition-opacity">{index}</span>
  </button>
);

// --- COMPONENT: STANDBY SCREEN (EDITORIAL) - Mobile-Optimized ---
const StandbyScreen = ({ onActivate, hasProfile, authUser, userProfile }: {
  onActivate: (m: Module) => void,
  hasProfile: boolean,
  authUser?: AuthUser | null,
  userProfile?: UserStyleProfile | null
}) => (
  <div className="h-full w-full flex flex-col relative overflow-hidden bg-matte-base pb-16 md:pb-0">

    {/* Background Decor */}
    <div className="absolute top-0 right-0 w-[50%] h-full border-l border-zinc-900/50 hidden md:block"></div>
    <AbstractGrid className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] text-zinc-800 opacity-20 pointer-events-none animate-spin-slow" />

    {/* CONTENT GRID */}
    {/* DESKTOP LAYOUT - PRESERVED */}
    <div className="hidden md:grid flex-1 min-h-0 grid-cols-2 h-full overflow-hidden">
      {/* LEFT: HERO - Desktop */}
      <div className="p-10 lg:p-14 flex flex-col justify-center relative z-10 border-r border-zinc-800">
        <div>
          {/* Welcome User */}
          {authUser && (
            <div className="mb-3 flex items-center gap-2">
              {authUser.photoURL && (
                <img src={authUser.photoURL} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-zinc-400">
                hey, <span className="text-white font-medium">{authUser.displayName || authUser.email?.split('@')[0] || 'friend'}</span>
              </span>
            </div>
          )}
          <span className="label-sm text-hard-gold mb-1.5 block">YOUR AI WINGMAN</span>
          <h1 className="leading-[0.85] font-impact text-white mb-3">
            <span className="text-[2.5rem] lg:text-[3.5rem] block text-zinc-500">THE</span>
            <span className="text-[5rem] lg:text-[7rem] block">RIZZBOT</span>
          </h1>
          <p className="text-zinc-500 max-w-xs text-sm leading-relaxed font-editorial">
            AI-powered texting coach. Get advice, practice responses, never get ghosted.
          </p>
        </div>

        {/* Profile Setup CTA (if no profile) */}
        {!hasProfile && (
          <div className="mt-5 bg-zinc-900/50 border border-zinc-800 p-3 relative">
            <CornerNodes className="opacity-20" />
            <div className="flex items-start gap-2.5">
              <span className="text-lg">○</span>
              <div className="flex-1">
                <div className="label-sm text-zinc-400 mb-0.5">RECOMMENDED</div>
                <p className="text-xs text-zinc-300 mb-1.5">set up your style profile for personalized suggestions</p>
                <button
                  onClick={() => onActivate('profile')}
                  className="px-2.5 py-1 bg-white text-black text-[9px] font-mono uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                >
                  TEACH YOUR VOICE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: MODULE SELECTOR - Desktop */}
      <div className="flex flex-col">
        {/* QUICK MODE */}
        <button
          onClick={() => onActivate('quick')}
          className="flex-1 border-b border-zinc-800 p-8 text-left hover:bg-emerald-900/20 active:bg-emerald-900/30 transition-all group relative overflow-hidden flex flex-col justify-center"
        >
          <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-all duration-500">
            <ArrowRight className="w-8 h-8 text-emerald-400 -rotate-45" />
          </div>
          <div className="label-sm text-zinc-500 group-hover:text-emerald-400 transition-colors mb-1">FAST LANE</div>
          <h2 className="text-4xl font-impact text-zinc-300 group-hover:text-white transition-colors uppercase">
            Quick Mode
          </h2>
          <div className="mt-2 opacity-60 group-hover:opacity-100 transition-opacity max-w-md text-[11px] font-mono text-zinc-400">
            // PASTE MESSAGE → GET ADVICE
          </div>
        </button>
        {/* THERAPIST MODE */}
        <button
          onClick={() => onActivate('therapist')}
          className="flex-1 border-b border-zinc-800 p-8 text-left hover:bg-rose-900/20 active:bg-rose-900/30 transition-all group relative overflow-hidden flex flex-col justify-center"
        >
          <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-all duration-500">
            <HeartHandshake className="w-8 h-8 text-rose-400" />
          </div>
          <div className="label-sm text-zinc-500 group-hover:text-rose-400 transition-colors mb-1">DEEP DIVE</div>
          <h2 className="text-4xl font-impact text-zinc-300 group-hover:text-white transition-colors uppercase">
            Therapist Mode
          </h2>
          <div className="mt-2 opacity-60 group-hover:opacity-100 transition-opacity max-w-md text-[11px] font-mono text-zinc-400">
            // UNCOVER PATTERNS, GET CLARITY
          </div>
        </button>
        {/* PRACTICE MODE */}
        <button
          onClick={() => onActivate('simulator')}
          className="flex-1 p-8 text-left hover:bg-zinc-900/50 active:bg-zinc-800/50 transition-all group relative overflow-hidden flex flex-col justify-center"
        >
          <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-all duration-500">
            <ArrowRight className="w-8 h-8 text-hard-blue -rotate-45" />
          </div>
          <div className="label-sm text-zinc-500 group-hover:text-hard-blue transition-colors mb-1">MODULE 03</div>
          <h2 className="text-4xl font-impact text-zinc-300 group-hover:text-white transition-colors uppercase">
            Practice Mode
          </h2>
          <div className="mt-2 opacity-60 group-hover:opacity-100 transition-opacity max-w-md text-[11px] font-mono text-zinc-400">
            // REHEARSE TEXTS, SEND WITH CONFIDENCE
          </div>
        </button>
      </div>
    </div>

    {/* MOBILE LAYOUT - TACTICAL COMMAND CENTER */}
    <div className="md:hidden flex-1 min-h-0 flex flex-col overflow-y-auto bg-black relative">
      <div className="absolute inset-0 bg-topo-pattern opacity-10 pointer-events-none fixed"></div>

      {/* 1. HERO - Compact */}
      <div className="pt-8 pb-4 px-5 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="label-sm text-hard-gold">COMMAND CENTER</span>
          {authUser && (
            <div className="flex items-center gap-2 bg-zinc-900/80 px-2 py-1 rounded-full border border-zinc-800">
              {authUser.photoURL ? (
                <img src={authUser.photoURL} alt="" className="w-3 h-3 rounded-full" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-zinc-700"></div>
              )}
              <span className="text-[9px] font-mono text-zinc-300 uppercase">{authUser.displayName?.split(' ')[0] || 'User'}</span>
            </div>
          )}
        </div>
        <h1 className="leading-[0.85] font-impact text-white mb-2">
          <span className="text-[1.5rem] block text-zinc-600">THE</span>
          <span className="text-[3.5rem] block">RIZZBOT</span>
        </h1>
      </div>

      {/* 2. STATUS WIDGET - Tactical Style */}
      <div className="px-4 mb-4 relative z-10">
        <div className="border border-zinc-800 bg-zinc-900/60 p-3 relative overflow-hidden group">
          <CornerNodes className="opacity-40" />
          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div className={`w-10 h-10 flex items-center justify-center border ${hasProfile ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-800'}`}>
              {hasProfile ? (
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
              ) : (
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              )}
            </div>

            {/* Text Content */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[9px] font-mono uppercase tracking-widest ${hasProfile ? 'text-emerald-400' : 'text-yellow-500'}`}>
                  {hasProfile ? 'SYSTEM CALIBRATED' : 'SYSTEM UNTRAINED'}
                </span>
                {hasProfile && <span className="text-[8px] font-mono text-zinc-500">V.1.0</span>}
              </div>

              {hasProfile ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white font-bold uppercase">{userProfile?.preferredTone || 'Balanced'} Voice</span>
                  <button onClick={() => onActivate('profile')} className="text-[8px] underline text-zinc-500 uppercase hover:text-white">Adjust</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Personalize AI responses</span>
                  <button
                    onClick={() => onActivate('profile')}
                    className="bg-white text-black text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide hover:bg-zinc-200"
                  >
                    INITIATE
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. ACTION MODULES - Tactical Cards */}
      <div className="flex-1 px-4 space-y-3 pb-8 relative z-10">
        {/* QUICK MODE - Gold */}
        <button
          onClick={() => onActivate('quick')}
          className="w-full h-32 relative border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group overflow-hidden flex flex-col justify-between p-4"
        >
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-hard-gold/50 to-transparent opacity-50"></div>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 bg-hard-gold"></span>
                <span className="text-[9px] font-mono text-hard-gold tracking-widest">PRIORITY_ACCESS</span>
              </div>
              <h2 className="text-3xl font-impact text-white uppercase tracking-wide">QUICK MODE</h2>
            </div>
            <ArrowRight className="text-zinc-600 group-hover:text-hard-gold transition-colors -rotate-45" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-[10px] font-mono text-zinc-500 max-w-[150px] text-left">// UPLOAD SCREENSHOTS, GET INSTANT REPLIES</span>
            <div className="px-2 py-1 border border-zinc-700 text-[9px] text-zinc-400 font-mono uppercase group-hover:bg-hard-gold group-hover:text-black group-hover:border-hard-gold transition-colors">
              DEPLOY
            </div>
          </div>
        </button>

        {/* THERAPIST MODE - Rose */}
        <button
          onClick={() => onActivate('therapist')}
          className="w-full h-32 relative border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group overflow-hidden flex flex-col justify-between p-4"
        >
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent opacity-50"></div>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 bg-rose-500"></span>
                <span className="text-[9px] font-mono text-rose-400 tracking-widest">DEEP_DIVE</span>
              </div>
              <h2 className="text-3xl font-impact text-white uppercase tracking-wide">THERAPIST</h2>
            </div>
            <HeartHandshake className="w-5 h-5 text-zinc-600 group-hover:text-rose-400 transition-colors" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-[10px] font-mono text-zinc-500 max-w-[150px] text-left">// UNCOVER PATTERNS, GET CLARITY</span>
            <div className="px-2 py-1 border border-zinc-700 text-[9px] text-zinc-400 font-mono uppercase group-hover:bg-rose-500 group-hover:text-black group-hover:border-rose-500 transition-colors">
              ENTER
            </div>
          </div>
        </button>

        {/* PRACTICE MODE - Blue */}
        <button
          onClick={() => onActivate('simulator')}
          className="w-full h-32 relative border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all group overflow-hidden flex flex-col justify-between p-4"
        >
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-hard-blue/50 to-transparent opacity-50"></div>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 bg-hard-blue"></span>
                <span className="text-[9px] font-mono text-hard-blue tracking-widest">SIMULATION_03</span>
              </div>
              <h2 className="text-3xl font-impact text-white uppercase tracking-wide">PRACTICE</h2>
            </div>
            <ArrowRight className="text-zinc-600 group-hover:text-hard-blue transition-colors -rotate-45" />
          </div>
          <div className="flex items-end justify-between">
            <span className="text-[10px] font-mono text-zinc-500 max-w-[150px] text-left">// REHEARSE CONVERSATIONS IN A SAFE ENVIRONMENT</span>
            <div className="px-2 py-1 border border-zinc-700 text-[9px] text-zinc-400 font-mono uppercase group-hover:bg-hard-blue group-hover:text-black group-hover:border-hard-blue transition-colors">
              ENTER
            </div>
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

  // Firebase Auth State
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // User Session State (from D1)
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // User Profile State
  const [userProfile, setUserProfile] = useState<UserStyleProfile | null>(null);

  // Wellbeing Check-in State
  const [wellbeingCheckIn, setWellbeingCheckIn] = useState<WellbeingState | null>(null);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);

      // If user signs out, clear app state
      if (!user) {
        setUserId(null);
        setUserProfile(null);
        setIsLoadingUser(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Once we have a Firebase user, sync with D1 database
  useEffect(() => {
    if (!authUser) return;

    const syncUserWithDatabase = async () => {
      setIsLoadingUser(true);
      try {
        // Use Firebase UID as the identifier
        const user = await getOrCreateUser(authUser.uid, {
          email: authUser.email,
          display_name: authUser.displayName,
          photo_url: authUser.photoURL,
          provider: authUser.providerId,
        });
        setUserId(user.id);

        // Fetch style profile from D1
        try {
          const profile = await getStyleProfile(user.id);
          if (profile) {
            // Convert JSON strings back to objects if necessary
            if (typeof profile.signature_patterns === 'string') {
              profile.signature_patterns = JSON.parse(profile.signature_patterns);
            }
            if (typeof profile.raw_samples === 'string') {
              profile.raw_samples = JSON.parse(profile.raw_samples);
            }
            if (typeof profile.favorite_emojis === 'string') {
              profile.favorite_emojis = JSON.parse(profile.favorite_emojis);
            }
            // Map DB columns to UserStyleProfile type
            setUserProfile({
              emojiUsage: (profile.emoji_usage || 'minimal') as any,
              capitalization: (profile.capitalization || 'lowercase') as any,
              punctuation: (profile.punctuation || 'minimal') as any,
              averageLength: (profile.average_length || 'medium') as any,
              slangLevel: (profile.slang_level || 'casual') as any,
              signaturePatterns: profile.signature_patterns || [],
              preferredTone: profile.preferred_tone || 'playful',
              aiSummary: profile.ai_summary || undefined,
              favoriteEmojis: profile.favorite_emojis || [],
              rawSamples: profile.raw_samples || [],
            });
          }
        } catch (profileError) {
          // Profile fetch failed, but we can continue without it
          console.warn('Failed to fetch style profile (continuing without it):', profileError);
        }

        // Log screen view
        logScreenView('main_app');
      } catch (error) {
        // Database sync failed - continue without DB features
        // The app can still work with just Firebase auth
        console.error('Failed to sync user with database:', error);
        // Don't set userId, features requiring DB will show appropriate messages
      } finally {
        setIsLoadingUser(false);
      }
    };

    syncUserWithDatabase();
  }, [authUser]);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setActiveModule('standby');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Check wellbeing on module changes and periodically
  useEffect(() => {
    const checkAndTriggerWellbeing = () => {
      if (!authUser) return;
      const reason = checkWellbeing(authUser.uid);
      if (reason) {
        triggerWellbeingCheckIn(authUser.uid, reason);
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
  }, [activeModule, authUser]);

  // Handle wellbeing dismissal
  const handleWellbeingDismiss = () => {
    if (authUser) {
      clearWellbeingTrigger(authUser.uid);
    }
    setWellbeingCheckIn(null);
  };

  const handleWellbeingDismissForDay = () => {
    if (authUser) {
      dismissWellbeingCheckIn(authUser.uid, 24);
    }
    setWellbeingCheckIn(null);
  };

  // Save user profile to D1 and localStorage
  const handleSaveProfile = async (profile: UserStyleProfile) => {
    try {
      if (!userId) {
        console.error('No user ID available');
        return;
      }

      // Save to D1
      await saveStyleProfile({
        user_id: userId,
        emoji_usage: profile.emojiUsage,
        capitalization: profile.capitalization,
        punctuation: profile.punctuation,
        average_length: profile.averageLength,
        slang_level: profile.slangLevel,
        signature_patterns: profile.signaturePatterns,
        preferred_tone: profile.preferredTone,
        raw_samples: profile.rawSamples,
        ai_summary: profile.aiSummary,
        favorite_emojis: profile.favoriteEmojis,
      });

      // Also save to localStorage for offline access
      localStorage.setItem('userStyleProfile', JSON.stringify(profile));
      setUserProfile(profile);
      setActiveModule('standby');
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };
  if (authLoading) {
    return (
      <div className="flex h-[100dvh] w-screen bg-matte-base items-center justify-center">
        <div className="flex flex-col items-center justify-center">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-4">AUTHENTICATING...</div>
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show auth modal if not signed in
  if (!authUser) {
    return <AuthModal onAuthSuccess={() => setActiveModule('standby')} />;
  }

  return (
    <ToastProvider>
      <div className="flex h-[100dvh] w-screen bg-matte-base text-zinc-100 overflow-hidden font-sans selection:bg-white selection:text-black">

        {/* Show loading state while syncing user with database */}
        {isLoadingUser && (
          <div className="absolute inset-0 bg-black z-[999] flex items-center justify-center">
            <div className="flex flex-col items-center justify-center">
              <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-4">SYNCING...</div>
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        {/* Wellbeing Check-in Modal */}
        {wellbeingCheckIn?.triggered && wellbeingCheckIn.reason && (
          <WellbeingCheckIn
            reason={wellbeingCheckIn.reason}
            onDismiss={handleWellbeingDismiss}
            onDismissForDay={handleWellbeingDismissForDay}
          />
        )}


        <SideDock activeModule={activeModule} setModule={setActiveModule} authUser={authUser} onSignOut={handleSignOut} />

        {/* MAIN CONTAINER - Better mobile spacing */}
        <div className="flex-1 relative h-full flex flex-col md:p-3 lg:p-4 overflow-hidden pb-0 md:pb-3 lg:pb-4 scrollbar-hide">

          {/* VIEWPORT FRAME */}
          <div className="relative w-full flex-1 min-h-0 md:border md:border-zinc-800 bg-black/20 overflow-hidden flex flex-col md:shadow-2xl">
            <div className="hidden md:block">
              <CornerNodes />
            </div>

            {state === 'loading' && <LoadingScreen />}

            {/* STANDBY MODULE */}
            {activeModule === 'standby' && (
              <StandbyScreen onActivate={setActiveModule} hasProfile={!!(userProfile && userProfile.preferredTone)} authUser={authUser} userProfile={userProfile} />
            )}

            {/* PRACTICE MODE MODULE */}
            {activeModule === 'simulator' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <Simulator
                    userProfile={userProfile}
                    firebaseUid={authUser.uid}
                    userId={userId}
                    onBack={() => setActiveModule('standby')}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* QUICK MODE MODULE */}
            {activeModule === 'quick' && (
              <div className="h-full w-full flex flex-col animate-fade-in">
                <ErrorBoundary>
                  <QuickAdvisor
                    onBack={() => setActiveModule('standby')}
                    userProfile={userProfile}
                    firebaseUid={authUser.uid}
                    userId={userId}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* USER PROFILE MODULE */}
            {activeModule === 'profile' && (
              <div className="h-full w-full flex flex-col animate-fade-in">
                <ErrorBoundary>
                  <UserProfile
                    onBack={() => setActiveModule('standby')}
                    onSave={handleSaveProfile}
                    initialProfile={userProfile}
                    userId={userId}
                    authUser={authUser}
                    onSignOut={handleSignOut}
                  />
                </ErrorBoundary>
              </div>
            )}

            {/* HISTORY MODULE */}
            {activeModule === 'history' && (
              <div className="h-full w-full flex flex-col animate-fade-in bg-matte-base">
                <ErrorBoundary>
                  <History firebaseUid={authUser?.uid} onBack={() => setActiveModule('standby')} />
                </ErrorBoundary>
              </div>
            )}

            {/* THERAPIST CHAT MODULE */}
            {activeModule === 'therapist' && (
              <div className="h-full w-full flex flex-col animate-fade-in">
                <ErrorBoundary>
                  <TherapistChat onBack={() => setActiveModule('standby')} firebaseUid={authUser?.uid} />
                </ErrorBoundary>
              </div>
            )}
          </div>

          {/* SYSTEM TICKER - Desktop only */}
          <div className="hidden md:block">
            <SystemTicker />
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomTabs activeModule={activeModule} setModule={setActiveModule} />
      </div>
    </ToastProvider>
  );
}

export default App;
