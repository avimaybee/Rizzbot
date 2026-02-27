import React, { useState, useEffect } from 'react';
import { ArrowRight, HeartHandshake, Zap, Shield, Target, User, CheckCircle2, Circle, Activity, AlertTriangle, LayoutDashboard, Clock } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { getSessions, getPersonas } from '../services/dbService';
import { Module, UserStyleProfile, WellbeingReason } from '../types';

// --- SUB-COMPONENTS ---

const ProfileStats = ({ sessions, personas }: { sessions: number, personas: number }) => (
  <div className="flex gap-6 w-full mt-4">
    <div className="flex flex-col">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Sessions</div>
      <div className="text-2xl font-bold text-white tabular-nums">{sessions}</div>
    </div>
    <div className="flex flex-col border-l border-white/5 pl-6">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Partners</div>
      <div className="text-2xl font-bold text-white tabular-nums">{personas}</div>
    </div>
  </div>
);

const AppStatus = ({ wellbeingReason }: { wellbeingReason: WellbeingReason | null }) => {
  const getStatus = () => {
    switch (wellbeingReason) {
      case 'late_night': return { label: 'Rest Recommended', color: 'text-amber-400', icon: Clock };
      case 'high_frequency': return { label: 'Taking a Break', color: 'text-blue-400', icon: Activity };
      case 'same_person': return { label: 'Deep Focus', color: 'text-red-400', icon: Target };
      case 'high_risk': return { label: 'Vibe Check', color: 'text-red-400', icon: AlertTriangle };
      default: return { label: 'Ready', color: 'text-emerald-400', icon: CheckCircle2 };
    }
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
      <StatusIcon className={`w-3 h-3 ${status.color}`} />
      <span className={`text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
        {status.label}
      </span>
    </div>
  );
};

const SetupChecklist = ({ hasProfile, sessionCount, onActivate }: { hasProfile: boolean, sessionCount: number, onActivate: (m: Module) => void }) => {
  const items = [
    { label: 'Connect Account', complete: true },
    { label: 'Calibrate Voice', complete: hasProfile, action: () => onActivate('profile') },
    { label: 'Start First Session', complete: sessionCount > 0, action: () => onActivate('quick') }
  ];

  return (
    <div className="mt-8 space-y-3 w-full max-w-xs">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
        Getting Started
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.complete}
          onClick={() => item.action?.()}
          className={`w-full flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl transition-all ${
            item.complete 
              ? 'opacity-40' 
              : 'hover:bg-white/10 hover:border-white/10 active:scale-[0.98]'
          }`}
        >
          <div className="flex items-center gap-4">
            {item.complete ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-zinc-700" />}
            <span className={`text-xs font-bold ${item.complete ? 'text-zinc-500' : 'text-zinc-300'}`}>
              {item.label}
            </span>
          </div>
          {!item.complete && <ArrowRight className="w-4 h-4 text-zinc-500" />}
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
        console.warn('Failed to fetch stats:', err);
      }
    };
    fetchStats();
  }, [authUser]);

  const handleModeActivate = (module: Module) => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    onActivate(module);
  };

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden bg-matte-base font-sans select-none">
      <div className="bg-matte-grain opacity-[0.03]"></div>
      
      {/* 1. TOP BAR */}
      <div className="pt-16 px-10 md:px-20 flex flex-col md:flex-row justify-between items-start gap-10 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <AppStatus wellbeingReason={wellbeingReason} />
          </div>
          <h1 className="text-7xl md:text-9xl font-black text-white uppercase tracking-tighter leading-none mb-6">
            RIZZ<span className="text-zinc-800">BOT</span>
          </h1>
          <p className="text-zinc-500 text-base max-w-sm leading-relaxed font-medium">
            Your personal AI advisor for authentic, confident digital communication.
          </p>
        </div>

        {authUser && (
          <div className="flex flex-col items-end w-full md:w-auto">
            <div 
              onClick={() => handleModeActivate('profile')}
              className="w-full md:w-auto flex items-center gap-5 bg-white/5 border border-white/5 p-5 rounded-[2rem] shadow-2xl group cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              <div className="relative">
                {authUser.photoURL ? (
                  <img src={authUser.photoURL} alt="" className="w-14 h-14 rounded-2xl grayscale group-hover:grayscale-0 transition-all border border-white/10" />
                ) : (
                  <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-500 border border-white/10">
                    <User className="w-7 h-7" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-matte-base shadow-sm"></div>
              </div>
              <div className="flex flex-col pr-6">
                <span className="text-lg font-bold text-white truncate max-w-[180px] tracking-tight">{authUser.displayName || 'Authorized User'}</span>
                <div className="flex items-center gap-2 mt-1">
                  {hasProfile ? (
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Voice Calibrated</span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">Needs Calibration</span>
                  )}
                </div>
              </div>
            </div>
            <ProfileStats sessions={stats.sessions} personas={stats.personas} />
          </div>
        )}
      </div>

      {/* 2. MAIN CENTER */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-10 py-16">
        <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-center gap-20 lg:gap-40">
          
          <div className="relative group">
            <div className="absolute inset-0 bg-blue-500/[0.02] rounded-full blur-[100px] transition-all group-hover:bg-blue-500/[0.05]"></div>
            
            <button
              onClick={() => handleModeActivate('quick')}
              className="w-72 h-72 md:w-96 md:h-96 rounded-full bg-white text-black flex flex-col items-center justify-center relative overflow-hidden transition-all duration-700 hover:scale-105 active:scale-95 shadow-[0_50px_120px_rgba(255,255,255,0.1)] group"
            >
              <Zap className="w-20 h-20 mb-8 transition-transform duration-500 group-hover:scale-110" fill="currentColor" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black uppercase tracking-tight">Analyze Message</span>
                <span className="text-[10px] font-bold opacity-40 mt-2 uppercase tracking-[0.2em]">Start Quick Scan</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-blue-500/5"></div>
            </button>
          </div>

          <div className="w-full max-w-xs flex flex-col items-center md:items-start">
            {(!hasProfile || stats.sessions === 0) ? (
              <SetupChecklist hasProfile={hasProfile} sessionCount={stats.sessions} onActivate={handleModeActivate} />
            ) : (
              <div className="bg-white/5 border border-white/5 p-10 rounded-[2.5rem] w-full shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                   <Activity className="w-5 h-5 text-blue-400" />
                   <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recent Performance</span>
                </div>
                <p className="text-zinc-300 text-base leading-relaxed font-medium">
                  Your communication engine is primed. Upload a screenshot to begin analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM: NAVIGATION */}
      <div className="p-10 md:p-20 grid grid-cols-2 md:grid-cols-3 gap-8 relative z-10">
        <button
          onClick={() => handleModeActivate('simulator')}
          className="group flex flex-col bg-white/5 border border-white/5 hover:bg-white/10 p-8 transition-all rounded-[2rem] active:scale-[0.98] shadow-lg"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-10 group-hover:scale-110 transition-transform">
            <Target className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 group-hover:text-blue-400 transition-colors">Improve Skills</span>
          <span className="text-2xl font-black text-white uppercase tracking-tight">Practice</span>
        </button>

        <button
          onClick={() => handleModeActivate('therapist')}
          className="group flex flex-col bg-white/5 border border-white/5 hover:bg-white/10 p-8 transition-all rounded-[2rem] active:scale-[0.98] shadow-lg"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 mb-10 group-hover:scale-110 transition-transform">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 group-hover:text-red-400 transition-colors">Expert Advice</span>
          <span className="text-2xl font-black text-white uppercase tracking-tight">Support</span>
        </button>

        <button
          onClick={() => handleModeActivate('history')}
          className="hidden md:flex group flex flex-col bg-white/5 border border-white/5 hover:bg-white/10 p-8 transition-all rounded-[2rem] active:scale-[0.98] shadow-lg"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 mb-10 group-hover:scale-110 transition-transform">
            <Shield className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 group-hover:text-white transition-colors">Past Insights</span>
          <span className="text-2xl font-black text-white uppercase tracking-tight">History</span>
        </button>
      </div>
    </div>
  );
};
