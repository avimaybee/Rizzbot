import React, { useState, useEffect } from 'react';
import { ArrowRight, HeartHandshake, Zap, Shield, Target, User, CheckCircle2, Circle, Activity, AlertTriangle, Terminal, LayoutDashboard } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { getSessions, getPersonas } from '../services/dbService';
import { Module, UserStyleProfile, WellbeingReason } from '../types';
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
    <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.6] opacity-20"></div>
    <div className="absolute inset-0 border border-white/5 rounded-full scale-[0.8] opacity-10"></div>
    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-hard-gold/10 to-transparent h-full w-[2px] left-1/2 -translate-x-1/2 animate-spin-slow origin-bottom opacity-30"></div>
  </div>
);

// --- SUB-COMPONENTS ---

const StatsDisplay = ({ sessions, personas }: { sessions: number, personas: number }) => (
  <div className="grid grid-cols-2 gap-2 w-full max-w-[220px] mt-3 group/stats cursor-default font-sans">
    <div className="glass-zinc p-2.5 soft-edge group-hover/stats:border-white/10 transition-colors">
      <div className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1 leading-none">SESSIONS</div>
      <div className="text-sm font-impact text-white tracking-wider">{sessions.toString().padStart(2, '0')}</div>
    </div>
    <div className="glass-zinc p-2.5 soft-edge group-hover/stats:border-white/10 transition-colors">
      <div className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1 leading-none">PERSONAS</div>
      <div className="text-sm font-impact text-white tracking-wider">{personas.toString().padStart(2, '0')}</div>
    </div>
  </div>
);

const UserStatus = ({ wellbeingReason }: { wellbeingReason: WellbeingReason | null }) => {
  const getStatus = () => {
    switch (wellbeingReason) {
      case 'late_night': return { label: 'REST RECOMMENDED', color: 'text-hard-gold', icon: AlertTriangle };
      case 'high_frequency': return { label: 'TAKE A BREATHER', color: 'text-hard-blue', icon: Activity };
      case 'same_person': return { label: 'FOCUS SHIFT', color: 'text-hard-red', icon: Target };
      case 'high_risk': return { label: 'CAUTION ADVISED', color: 'text-hard-red', icon: AlertTriangle };
      default: return { label: 'SYSTEM READY', color: 'text-emerald-400', icon: Activity };
    }
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 glass-dark rounded-full border-white/5 font-sans">
      <StatusIcon className={`w-3 h-3 ${status.color}`} />
      <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.1em] ${status.color}`}>
        {status.label}
      </span>
    </div>
  );
};

const OnboardingChecklist = ({ hasProfile, sessionCount, onActivate }: { hasProfile: boolean, sessionCount: number, onActivate: (m: Module) => void }) => {
  const items = [
    { label: 'Account Setup', complete: true },
    { label: 'Voice Calibration', complete: hasProfile, action: () => onActivate('profile') },
    { label: 'First Analysis', complete: sessionCount > 0, action: () => onActivate('quick') }
  ];

  return (
    <div className="mt-10 space-y-2.5 w-full max-w-xs font-sans">
      <div className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-3">
        Getting Started
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.complete}
          onClick={() => {
            if ('vibrate' in navigator) navigator.vibrate(5);
            item.action?.();
          }}
          style={{ animationDelay: `${i * 100}ms` }}
          className={`w-full flex items-center justify-between p-3.5 glass-zinc border-white/5 transition-all animate-fade-in soft-edge ${
            item.complete 
              ? 'opacity-30 grayscale' 
              : 'hover:bg-white/5 hover:border-white/10 cursor-pointer active:scale-[0.98]'
          }`}
        >
          <div className="flex items-center gap-4">
            {item.complete ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-zinc-700" />}
            <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${item.complete ? 'text-zinc-500' : 'text-zinc-300'}`}>
              {item.label}
            </span>
          </div>
          {!item.complete && <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-white transition-colors" />}
        </button>
      ))}
    </div>
  );
};

// --- MAIN COMPONENT ---

interface StandbyScreenProps {
  onActivate: (m: Module) => void;
  hasProfile: boolean;
  authUser?: AuthUser | null;
  userProfile?: UserStyleProfile | null;
  wellbeingReason: WellbeingReason | null;
}

export const StandbyScreen: React.FC<StandbyScreenProps> = ({ 
  onActivate, 
  hasProfile, 
  authUser, 
  userProfile,
  wellbeingReason
}) => {
  const [stats, setStats] = useState({ sessions: 0, personas: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      if (!authUser) return;
      try {
        const [sessionsData, personasData] = await Promise.all([
          getSessions(authUser.uid, 1, 0),
          getPersonas(0)
        ]);
        setStats({
          sessions: sessionsData.pagination.total || 0,
          personas: Array.isArray(personasData) ? personasData.length : 0
        });
      } catch (err) {
        console.warn('Failed to fetch dossier stats:', err);
      }
    };
    fetchStats();
  }, [authUser]);

  const handleModeActivate = (module: Module) => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    onActivate(module);
  };

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden bg-matte-base animate-fade-in font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-br from-hard-gold/5 via-transparent to-hard-blue/5 animate-aurora opacity-20 pointer-events-none"></div>
      
      {/* 1. TOP BAR */}
      <div className="pt-10 px-6 md:px-12 flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-mono font-medium text-zinc-500 uppercase tracking-widest">Active Session</span>
          </div>
          <h1 className="font-impact text-5xl md:text-7xl text-white uppercase tracking-tighter leading-none mb-6">
            RIZZ<span className="text-transparent bg-clip-text bg-gradient-to-b from-white/20 to-transparent">BOT</span>
          </h1>
          <TacticalStatus wellbeingReason={wellbeingReason} />
        </div>

        {authUser && (
          <div className="flex flex-col items-end w-full md:w-auto">
            <div 
              onClick={() => handleModeActivate('profile')}
              className="w-full md:w-auto flex items-center gap-5 glass-dark border-white/5 p-3.5 soft-edge shadow-2xl group cursor-pointer hover:border-white/10 transition-all active:scale-[0.98]"
            >
              <div className="relative">
                {authUser.photoURL ? (
                  <img src={authUser.photoURL} alt="" className="w-10 h-10 md:w-12 md:h-12 soft-edge group-hover:opacity-80 transition-all border border-white/5" />
                ) : (
                  <div className="w-10 h-10 md:w-12 md:h-12 glass-zinc soft-edge flex items-center justify-center text-zinc-500 border-white/5">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0a0a] shadow-sm"></div>
              </div>
              <div className="flex flex-col pr-4 font-sans">
                <span className="text-[13px] font-bold text-white uppercase truncate max-w-[140px] tracking-tight">{authUser.displayName?.split(' ')[0] || 'User'}</span>
                <div className="flex items-center gap-2 mt-1.5">
                  {hasProfile ? (
                    <span className="text-[8px] font-mono font-bold text-emerald-500 uppercase tracking-tighter">Profile Configured</span>
                  ) : (
                    <span className="text-[8px] font-mono font-bold text-hard-gold uppercase tracking-tighter">Profile Incomplete</span>
                  )}
                </div>
              </div>
            </div>
            <DossierStats sessions={stats.sessions} personas={stats.personas} />
          </div>
        )}
      </div>

      {/* 2. MAIN CENTER: INSTANT SCAN */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 py-12">
        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-16 lg:gap-32">
          {/* Onboarding Checklist - Desktop (shown on left) */}
          {(!hasProfile || stats.sessions === 0) && (
            <div className="hidden lg:block animate-fade-in md:w-80">
              <TacticalChecklist hasProfile={hasProfile} sessionCount={stats.sessions} onActivate={handleModeActivate} />
            </div>
          )}

          <div className="relative group">
            {/* Pulsing Glow Background */}
            <div className="absolute inset-0 bg-hard-gold/10 rounded-full blur-[60px] animate-pulse-glow opacity-40 group-hover:opacity-100 transition-opacity"></div>
            
            {/* Main Node */}
            <button
              onClick={() => handleModeActivate('quick')}
              className="w-56 h-56 md:w-72 md:h-72 rounded-full glass-dark border-white/5 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-700 group-hover:border-hard-gold/30 tactical-glow-gold active:scale-95 shadow-2xl"
            >
              <Zap className="w-12 h-12 md:w-16 md:h-16 text-hard-gold mb-4 group-hover:scale-110 transition-transform duration-700 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
              <div className="flex flex-col items-center relative z-10">
                <span className="text-[11px] md:text-sm font-bold text-white uppercase tracking-[0.3em] group-hover:text-hard-gold transition-colors">Start Scan</span>
                <span className="text-[9px] font-mono text-zinc-600 mt-2 opacity-60 group-hover:opacity-100 transition-opacity tracking-[0.1em] uppercase">Linguistic Analysis</span>
              </div>
            </button>
          </div>

          {/* Mobile Onboarding / Summary Text */}
          <div className="text-center lg:text-left max-w-xs">
            {(!hasProfile || stats.sessions === 0) ? (
              <div className="lg:hidden animate-fade-in w-full">
                <TacticalChecklist hasProfile={hasProfile} sessionCount={stats.sessions} onActivate={handleModeActivate} />
              </div>
            ) : (
              <div className="animate-fade-in glass-dark border-white/5 p-6 soft-edge shadow-xl">
                <div className="flex items-center gap-3 mb-4 justify-center lg:justify-start">
                   <LayoutDashboard className="w-4 h-4 text-hard-blue" />
                   <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">Dashboard Summary</span>
                </div>
                <p className="text-zinc-400 text-xs font-medium leading-relaxed tracking-wide opacity-80">
                  Your AI advisor is ready. Upload a conversation to receive feedback and suggestions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM: MODE SWITCHERS */}
      <div className="p-6 md:p-12 grid grid-cols-2 md:grid-cols-3 gap-5 md:gap-8 relative z-10">
        {/* Practice Mode */}
        <button
          onClick={() => handleModeActivate('simulator')}
          className="group flex flex-col glass-dark border-white/5 hover:border-hard-blue/30 p-5 transition-all soft-edge relative overflow-hidden active:scale-[0.98] tactical-glow-blue"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-10 h-10 soft-edge glass-blue border-white/5 flex items-center justify-center text-hard-blue group-hover:scale-110 transition-transform">
              <Target className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-hard-blue -rotate-45 transition-all" />
          </div>
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1.5 group-hover:text-hard-blue transition-colors">Simulation</span>
          <span className="text-lg font-impact text-white uppercase tracking-wider">Practice</span>
        </button>

        {/* Therapist Mode */}
        <button
          onClick={() => handleModeActivate('therapist')}
          className="group flex flex-col glass-dark border-white/5 hover:border-hard-red/30 p-5 transition-all soft-edge relative overflow-hidden active:scale-[0.98] tactical-glow-red"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-10 h-10 soft-edge glass-red border-white/5 flex items-center justify-center text-hard-red group-hover:scale-110 transition-transform">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-hard-red -rotate-45 transition-all" />
          </div>
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1.5 group-hover:text-hard-red transition-colors">Personal Growth</span>
          <span className="text-lg font-impact text-white uppercase tracking-wider">Therapy</span>
        </button>

        {/* History / Profile (Desktop Only) */}
        <button
          onClick={() => handleModeActivate('history')}
          className="hidden md:flex group flex flex-col glass-dark border-white/5 hover:border-white/20 p-5 transition-all soft-edge relative overflow-hidden active:scale-[0.98]"
        >
          <div className="flex justify-between items-start mb-8">
            <div className="w-10 h-10 soft-edge glass-zinc border-white/5 flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-200 -rotate-45 transition-all" />
          </div>
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-1.5 group-hover:text-zinc-200 transition-colors">Archives</span>
          <span className="text-lg font-impact text-white uppercase tracking-wider">History</span>
        </button>
      </div>
    </div>
  );
};
