import React from 'react';
import { ArrowRight, HeartHandshake, RefreshCw } from 'lucide-react';
import { UserStyleProfile } from '../types';
import { AuthUser } from '../services/firebaseService';
import { ActionCard, StatusBadge, CornerNodes } from './ui';

type Module = 'standby' | 'simulator' | 'quick' | 'profile' | 'history' | 'therapist';

interface StandbyScreenProps {
  onActivate: (m: Module) => void;
  hasProfile: boolean;
  authUser?: AuthUser | null;
  userProfile?: UserStyleProfile | null;
}

const AbstractGrid = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className={className}>
    <path d="M0 20H100 M0 40H100 M0 60H100 M0 80H100" opacity="0.3" />
    <path d="M20 0V100 M40 0V100 M60 0V100 M80 0V100" opacity="0.3" />
    <circle cx="50" cy="50" r="30" strokeWidth="1" />
    <path d="M50 20V80 M20 50H80" />
  </svg>
);

export const StandbyScreen: React.FC<StandbyScreenProps> = ({
  onActivate,
  hasProfile,
  authUser,
  userProfile,
}) => {
  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden bg-matte-base pb-16 md:pb-0">
      {/* Background Decor - Desktop Only */}
      <div className="absolute top-0 right-0 w-[50%] h-full border-l border-zinc-900/50 hidden md:block"></div>
      <AbstractGrid className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] text-zinc-800 opacity-20 pointer-events-none animate-spin-slow hidden md:block" />

      {/* DESKTOP LAYOUT */}
      <div className="hidden md:grid flex-1 min-h-0 grid-cols-2 h-full overflow-hidden">
        {/* LEFT: HERO */}
        <div className="p-10 lg:p-14 flex flex-col justify-center relative z-10 border-r border-zinc-800">
          <div>
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

          {!hasProfile && (
            <div className="mt-5 bg-zinc-900/50 border border-zinc-800 p-3 relative">
              <CornerNodes className="opacity-20" variant="subtle" />
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

        {/* RIGHT: MODULE SELECTOR */}
        <div className="flex flex-col">
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

      {/* MOBILE LAYOUT - Modernized with staggered animations */}
      <div className="md:hidden flex-1 min-h-0 flex flex-col overflow-y-auto bg-black relative">
        {/* Topographic Pattern Background */}
        <div className="absolute inset-0 bg-topo-pattern opacity-10 pointer-events-none fixed"></div>

        {/* Hero Section - with entrance animation */}
        <div className="pt-6 pb-3 px-4 relative z-10 animate-fade-in">
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
            <span className="text-[3rem] block">RIZZBOT</span>
          </h1>
        </div>

        {/* Status Widget - More prominent with animation */}
        <div className="px-4 mb-3 relative z-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="border border-zinc-800 bg-zinc-900/60 p-3 relative overflow-hidden group hover:border-zinc-700 transition-colors">
            <CornerNodes variant="subtle" className="opacity-40" />
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 flex items-center justify-center border-2 ${hasProfile ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
                {hasProfile ? (
                  <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.6)]"></div>
                ) : (
                  <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${hasProfile ? 'text-emerald-400' : 'text-yellow-500'}`}>
                    {hasProfile ? 'SYSTEM CALIBRATED' : 'SYSTEM UNTRAINED'}
                  </span>
                  {hasProfile && (
                    <button 
                      onClick={() => onActivate('profile')}
                      className="text-[8px] text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      REFRESH
                    </button>
                  )}
                </div>
                {hasProfile ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-bold uppercase">{userProfile?.preferredTone || 'Balanced'} Voice</span>
                    <button 
                      onClick={() => onActivate('profile')} 
                      className="text-[8px] underline text-zinc-500 uppercase hover:text-white"
                    >
                      Adjust
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Personalize AI responses</span>
                    <button
                      onClick={() => onActivate('profile')}
                      className="bg-white text-black text-[9px] font-bold px-3 py-1.5 uppercase tracking-wide hover:bg-zinc-200 active:scale-95 transition-all"
                    >
                      INITIATE
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Modules - Mobile Optimized with staggered animations */}
        <div className="flex-1 px-4 space-y-2.5 pb-6 relative z-10">
          {/* Quick Mode - Gold - with entrance animation */}
          <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <ActionCard
              title="QUICK MODE"
              subtitle="PRIORITY_ACCESS"
              variant="gold"
              actionLabel="DEPLOY"
              onClick={() => onActivate('quick')}
              className="h-28 active:scale-[0.99] transition-transform"
            >
              <ArrowRight className="w-4 h-4 -rotate-45" />
            </ActionCard>
          </div>

          {/* Therapist Mode - Rose - with entrance animation */}
          <div className="animate-slide-up" style={{ animationDelay: '0.25s' }}>
            <ActionCard
              title="THERAPIST"
              subtitle="DEEP_DIVE"
              variant="rose"
              actionLabel="ENTER"
              onClick={() => onActivate('therapist')}
              className="h-28 active:scale-[0.99] transition-transform"
            >
              <HeartHandshake className="w-4 h-4" />
            </ActionCard>
          </div>

          {/* Practice Mode - Blue - with entrance animation */}
          <div className="animate-slide-up" style={{ animationDelay: '0.35s' }}>
            <ActionCard
              title="PRACTICE"
              subtitle="SIMULATION_03"
              variant="blue"
              actionLabel="ENTER"
              onClick={() => onActivate('simulator')}
              className="h-28 active:scale-[0.99] transition-transform"
            >
              <ArrowRight className="w-4 h-4 -rotate-45" />
            </ActionCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StandbyScreen;
