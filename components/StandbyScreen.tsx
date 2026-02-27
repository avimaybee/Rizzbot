import React, { useState, useEffect } from 'react';
import { ArrowRight, HeartHandshake, Zap, Shield, Target, User, CheckCircle2, Circle, Activity, AlertTriangle, LayoutDashboard, Clock } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { getSessions, getPersonas } from '../services/dbService';
import { Module, UserStyleProfile, WellbeingReason } from '../types';

// --- SUB-COMPONENTS ---

const ProfileStats = ({ sessions, personas }: { sessions: number, personas: number }) => (
  <div className="grid grid-cols-2 gap-3 w-full max-w-[240px] mt-4">
    <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Sessions</div>
      <div className="text-xl font-bold text-white tabular-nums">{sessions}</div>
    </div>
    <div className="bg-white/5 border border-white/5 p-3 rounded-2xl">
      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Partners</div>
      <div className="text-xl font-bold text-white tabular-nums">{personas}</div>
    </div>
  </div>
);

const AppStatus = ({ wellbeingReason }: { wellbeingReason: WellbeingReason | null }) => {
  const getStatus = () => {
    switch (wellbeingReason) {
      case 'late_night': return { label: 'Rest Recommended', color: 'text-amber-400', icon: Clock };
      case 'high_frequency': return { label: 'Taking a Sec', color: 'text-blue-400', icon: Activity };
      case 'same_person': return { label: 'Deep Focus', color: 'text-red-400', icon: Target };
      case 'high_risk': return { label: 'Vibe Check', color: 'text-red-400', icon: AlertTriangle };
      default: return { label: 'System Ready', color: 'text-emerald-400', icon: Activity };
    }
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-full">
      <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
      <span className={`text-[10px] font-bold uppercase tracking-widest ${status.color}`}>
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
    <div className="mt-12 space-y-3 w-full max-w-xs">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        Getting Started
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.complete}
          onClick={() => onActivate(item.action ? 'profile' : 'quick')} // Simplified logic for demo
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
      <div className="bg-matte-grain"></div>
      
      {/* 1. TOP BAR */}
      <div className="pt-12 px-8 md:px-16 flex flex-col md:flex-row justify-between items-start gap-8 relative z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <AppStatus wellbeingReason={wellbeingReason} />
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white uppercase tracking-tighter leading-none mb-4">
            RIZZ<span className="text-zinc-800">BOT</span>
          </h1>
          <p className="text-zinc-500 text-sm max-w-xs leading-relaxed font-medium">
            Your personal AI wingman for authentic, confident digital communication.
          </p>
        </div>

        {authUser && (
          <div className="flex flex-col items-end w-full md:w-auto">
            <div 
              onClick={() => handleModeActivate('profile')}
              className="w-full md:w-auto flex items-center gap-5 bg-white/5 border border-white/5 p-4 rounded-3xl shadow-2xl group cursor-pointer hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              <div className="relative">
                {authUser.photoURL ? (
                  <img src={authUser.photoURL} alt="" className="w-12 h-12 rounded-2xl grayscale group-hover:grayscale-0 transition-all border border-white/10" />
                ) : (
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 border border-white/10">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-matte-base"></div>
              </div>
              <div className="flex flex-col pr-4">
                <span className="text-base font-bold text-white truncate max-w-[160px] tracking-tight">{authUser.displayName || 'Authorized User'}</span>
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
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-8 py-12">
        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-16 lg:gap-32">
          
          <div className="relative group">
            {/* Functional Glow */}
            <div className="absolute inset-0 bg-white/[0.03] rounded-full blur-[80px]"></div>
            
            {/* Main Action Button */}
            <button
              onClick={() => handleModeActivate('quick')}
              className="w-64 h-64 md:w-80 md:h-80 rounded-full bg-white text-black flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 shadow-[0_40px_100px_rgba(255,255,255,0.1)]"
            >
              <Zap className="w-16 h-16 mb-6" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-black uppercase tracking-tight">Analyze</span>
                <span className="text-xs font-bold opacity-40 mt-1 uppercase tracking-widest">Message Flow</span>
              </div>
            </button>
          </div>

          <div className="w-full max-w-xs flex flex-col items-center md:items-start">
            {(!hasProfile || stats.sessions === 0) ? (
              <SetupChecklist hasProfile={hasProfile} sessionCount={stats.sessions} onActivate={handleModeActivate} />
            ) : (
              <div className="bg-white/5 border border-white/5 p-8 rounded-3xl w-full">
                <div className="flex items-center gap-3 mb-4">
                   <Activity className="w-5 h-5 text-blue-400" />
                   <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Recent Activity</span>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed font-medium">
                  Analysis engine ready. Upload a conversation to receive personalized feedback.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. BOTTOM: NAVIGATION */}
      <div className="p-8 md:p-16 grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
        <button
          onClick={() => handleModeActivate('simulator')}
          className="group flex flex-col bg-white/5 border border-white/5 hover:bg-white/10 p-6 transition-all rounded-3xl active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-8 group-hover:scale-110 transition-transform">
            <Target className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">Training</span>
          <span className="text-xl font-black text-white uppercase tracking-tight">Practice</span>
        </button>

        <button
          onClick={() => handleModeActivate('therapist')}
          className="group flex flex-col bg-white/5 border border-white/5 hover:bg-white/10 p-6 transition-all rounded-3xl active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 mb-8 group-hover:scale-110 transition-transform">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-red-400 transition-colors">Insights</span>
          <span className="text-xl font-black text-white uppercase tracking-tight">Support</span>
        </button>

        <button
          onClick={() => handleModeActivate('history')}
          className="hidden md:flex group flex flex-col bg-white/5 border border-white/5 hover:bg-white/10 p-6 transition-all rounded-3xl active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 mb-8 group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1 group-hover:text-zinc-300 transition-colors">Archive</span>
          <span className="text-xl font-black text-white uppercase tracking-tight">History</span>
        </button>
      </div>
    </div>
  );
};
