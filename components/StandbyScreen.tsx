import React from 'react';
import { ArrowRight, HeartHandshake, Zap, Shield, Target, User } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { Module, UserStyleProfile } from '../types';
import { CornerNodes } from './CornerNodes';

// --- VISUAL ASSETS ---
const AbstractGrid = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5" className={className}>
    <path d="M0 20H100 M0 40H100 M0 60H100 M0 80H100" opacity="0.3" />
    <path d="M20 0V100 M40 0V100 M60 0V100 M80 0V100" opacity="0.3" />
    <circle cx="50" cy="50" r="30" strokeWidth="1" />
    <path d="M50 20V80 M20 50H80" />
  </svg>
);

const RadarScan = () => (
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute inset-0 border border-zinc-800/50 rounded-full scale-[0.6] opacity-20"></div>
    <div className="absolute inset-0 border border-zinc-800/50 rounded-full scale-[0.8] opacity-10"></div>
    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-hard-gold/5 to-transparent h-full w-[2px] left-1/2 -translate-x-1/2 animate-spin-slow origin-bottom opacity-20"></div>
  </div>
);

interface StandbyScreenProps {
  onActivate: (m: Module) => void;
  hasProfile: boolean;
  authUser?: AuthUser | null;
  userProfile?: UserStyleProfile | null;
}

export const StandbyScreen: React.FC<StandbyScreenProps> = ({ onActivate, hasProfile, authUser, userProfile }) => {
  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden bg-matte-base animate-fade-in">
      {/* Zen Background */}
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.15] pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-hard-gold/5 via-transparent to-hard-blue/5 animate-aurora opacity-30 pointer-events-none"></div>
      
      {/* Floating Abstract Element */}
      <AbstractGrid className="absolute -top-20 -right-20 w-[60vw] h-[60vw] text-zinc-800 opacity-10 pointer-events-none animate-spin-slow" />

      {/* 1. TOP BAR: IDENTITY NODE */}
      <div className="pt-8 px-6 md:px-10 flex justify-between items-start relative z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] mb-1">// SYSTEM_STANDBY</span>
          <h1 className="font-impact text-3xl md:text-5xl text-white uppercase tracking-tighter">
            RIZZ<span className="text-zinc-700">BOT</span>
          </h1>
        </div>

        {authUser && (
          <div className="flex items-center gap-4 bg-glass-white backdrop-blur-md border border-glass-border p-2 md:p-3 rounded-xl shadow-2xl group cursor-pointer hover:border-hard-gold/50 transition-all">
            <div className="relative">
              {authUser.photoURL ? (
                <img src={authUser.photoURL} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-lg grayscale group-hover:grayscale-0 transition-all border border-zinc-800" />
              ) : (
                <div className="w-8 h-8 md:w-10 md:h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 border border-zinc-700">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-matte-base shadow-sm"></div>
            </div>
            <div className="flex flex-col pr-2 font-mono">
              <span className="text-[8px] text-zinc-500 uppercase tracking-widest leading-none mb-1">// ID: {authUser.uid.slice(0, 8)}</span>
              <span className="text-[11px] font-bold text-white uppercase truncate max-w-[100px]">{authUser.displayName?.split(' ')[0] || 'GHOST'}</span>
              <div className="flex items-center gap-1.5 mt-1">
                {hasProfile ? (
                  <>
                    <div className="w-1.5 h-1.5 bg-emerald-500/80 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                    <span className="text-[7px] text-emerald-500 uppercase tracking-tighter">VOICE: CALIBRATED</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 bg-hard-gold/80 rounded-full animate-pulse shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div>
                    <span className="text-[7px] text-hard-gold uppercase tracking-tighter">VOICE: UNTRAINED</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN CENTER: INSTANT SCAN NODE */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-6">
        <div className="relative group">
          {/* Pulsing Glow Background */}
          <div className="absolute inset-0 bg-hard-gold/20 rounded-full blur-[40px] animate-pulse-glow opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          {/* Outer Ring */}
          <div className="absolute inset-[-40px] border border-dashed border-zinc-800 rounded-full animate-spin-slow opacity-20 group-hover:opacity-40 transition-opacity"></div>
          
          {/* Main Node */}
          <button
            onClick={() => onActivate('quick')}
            className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-zinc-900/50 backdrop-blur-xl border-2 border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 group-hover:border-hard-gold group-hover:shadow-[0_0_50px_rgba(251,191,36,0.15)] active:scale-95"
          >
            <RadarScan />
            <Zap className="w-10 h-10 md:w-14 md:h-14 text-hard-gold mb-3 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] md:text-xs font-mono text-zinc-400 uppercase tracking-[0.2em] group-hover:text-hard-gold transition-colors">INSTANT SCAN</span>
              <span className="text-[8px] font-mono text-zinc-600 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">// DEPLOY_NOW</span>
            </div>
            
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
          </button>
        </div>

        <div className="mt-12 text-center max-w-sm">
          <p className="text-zinc-500 text-sm font-mono leading-relaxed opacity-60">
            AI-POWERED TACTICAL ADVISOR READY. <br />
            UPLOAD SCREENSHOT TO BEGIN ANALYSIS.
          </p>
        </div>
      </div>

      {/* 3. BOTTOM: TACTILE MODE SWITCHERS */}
      <div className="p-6 md:p-10 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 relative z-10">
        {/* Practice Mode */}
        <button
          onClick={() => onActivate('simulator')}
          className="group flex flex-col bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 hover:border-hard-blue/50 p-4 transition-all rounded-2xl relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-8 h-8 rounded-lg bg-hard-blue/10 flex items-center justify-center text-hard-blue group-hover:scale-110 transition-transform">
              <Target className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-hard-blue -rotate-45 transition-all" />
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-hard-blue transition-colors">// SIMULATION</span>
          <span className="text-sm font-bold text-white uppercase">Practice</span>
          
          <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[7px] font-mono text-hard-blue">STATUS: READY</span>
          </div>
        </button>

        {/* Therapist Mode */}
        <button
          onClick={() => onActivate('therapist')}
          className="group flex flex-col bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 hover:border-rose-500/50 p-4 transition-all rounded-2xl relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-rose-500 -rotate-45 transition-all" />
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-rose-500 transition-colors">// DEEP_DIVE</span>
          <span className="text-sm font-bold text-white uppercase">Therapy</span>

          <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[7px] font-mono text-rose-500">STATUS: ACTIVE</span>
          </div>
        </button>

        {/* History / Profile (Desktop Only or Tablet) */}
        <button
          onClick={() => onActivate('history')}
          className="hidden md:flex group flex flex-col bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800 hover:border-zinc-400 p-4 transition-all rounded-2xl relative overflow-hidden"
        >
          <div className="flex justify-between items-start mb-6">
            <div className="w-8 h-8 rounded-lg bg-zinc-500/10 flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-200 -rotate-45 transition-all" />
          </div>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-zinc-200 transition-colors">// ARCHIVE</span>
          <span className="text-sm font-bold text-white uppercase">History</span>
        </button>
      </div>
      
      {/* HUD Elements */}
      <CornerNodes className="opacity-10" />
    </div>
  );
};
