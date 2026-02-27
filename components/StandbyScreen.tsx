import React, { useState, useEffect } from 'react';
import { ArrowRight, HeartHandshake, Zap, Shield, Target, User, CheckCircle2, Circle, Activity, AlertTriangle, MessageSquare } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { getSessions, getPersonas } from '../services/dbService';
import { Module, UserStyleProfile, WellbeingReason } from '../types';

// --- SUB-COMPONENTS ---

const StatsSummary = ({ sessions, personas }: { sessions: number, personas: number }) => (
  <div className="flex gap-4 mt-2">
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Total Sessions</span>
      <span className="text-lg font-semibold text-white leading-tight">{sessions}</span>
    </div>
    <div className="w-px h-8 bg-zinc-800 self-end mb-1"></div>
    <div className="flex flex-col">
      <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Active Personas</span>
      <span className="text-lg font-semibold text-white leading-tight">{personas}</span>
    </div>
  </div>
);

const HealthStatus = ({ wellbeingReason }: { wellbeingReason: WellbeingReason | null }) => {
  const getStatus = () => {
    switch (wellbeingReason) {
      case 'late_night': return { label: 'Late Night Session', color: 'text-amber-400', icon: AlertTriangle };
      case 'high_frequency': return { label: 'High Activity', color: 'text-orange-400', icon: Activity };
      case 'same_person': return { label: 'Repetitive Pattern', color: 'text-rose-400', icon: Target };
      case 'high_risk': return { label: 'Vibe Alert', color: 'text-red-400', icon: AlertTriangle };
      default: return { label: 'System Optimal', color: 'text-emerald-400', icon: Activity };
    }
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-md">
      <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
      <span className={`text-[11px] font-semibold tracking-wide ${status.color}`}>
        {status.label}
      </span>
    </div>
  );
};

const OnboardingChecklist = ({ hasProfile, sessionCount, onActivate }: { hasProfile: boolean, sessionCount: number, onActivate: (m: Module) => void }) => {
  const items = [
    { label: 'Set up your profile', complete: hasProfile, action: () => onActivate('profile') },
    { label: 'Start your first analysis', complete: sessionCount > 0, action: () => onActivate('quick') }
  ];

  if (hasProfile && sessionCount > 0) return null;

  return (
    <div className="mt-8 space-y-3 w-full max-w-xs">
      <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Getting Started</h3>
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.complete}
          onClick={item.action}
          className={`w-full flex items-center justify-between p-3 border rounded-xl transition-all ${
            item.complete 
              ? 'bg-zinc-900/50 border-zinc-800 opacity-50' 
              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600 cursor-pointer active:scale-[0.98]'
          }`}
        >
          <div className="flex items-center gap-3">
            {item.complete ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-zinc-700" />}
            <span className={`text-xs font-medium ${item.complete ? 'text-zinc-500' : 'text-zinc-200'}`}>
              {item.label}
            </span>
          </div>
          {!item.complete && <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />}
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
        // Fail silently but log for debug
      }
    };
    fetchStats();
  }, [authUser]);

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden bg-matte-base animate-fade-in">
      {/* Background visual: Purely functional depth, no fluff */}
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.05] pointer-events-none"></div>
      
      {/* 1. TOP BAR: USER CONTEXT */}
      <div className="pt-8 px-6 md:px-10 flex justify-between items-start relative z-10">
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-4">
            Rizzbot
          </h1>
          <HealthStatus wellbeingReason={wellbeingReason} />
        </div>

        {authUser && (
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-2 md:p-2.5 rounded-2xl shadow-sm">
              <div className="relative">
                {authUser.photoURL ? (
                  <img src={authUser.photoURL} alt="" className="w-10 h-10 rounded-xl" />
                ) : (
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 border border-zinc-700">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-matte-base"></div>
              </div>
              <div className="flex flex-col pr-2">
                <span className="text-sm font-bold text-white">{authUser.displayName?.split(' ')[0] || 'User'}</span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {hasProfile ? 'Profile Calibrated' : 'Profile Incomplete'}
                </span>
              </div>
            </div>
            <StatsSummary sessions={stats.sessions} personas={stats.personas} />
          </div>
        )}
      </div>

      {/* 2. MAIN ACTION: CENTRAL HUB */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-6 py-12">
        <div className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-center gap-12 lg:gap-24">
          
          <OnboardingChecklist hasProfile={hasProfile} sessionCount={stats.sessions} onActivate={onActivate} />

          <div className="flex flex-col items-center gap-8">
            <button
              onClick={() => onActivate('quick')}
              className="w-48 h-48 md:w-56 md:h-56 rounded-full bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden transition-all hover:border-white/20 hover:bg-zinc-800/50 group active:scale-95 shadow-xl"
            >
              <Zap className="w-10 h-10 text-white mb-3 group-hover:scale-110 transition-transform duration-300" />
              <span className="text-sm font-bold text-white tracking-wide">Instant Scan</span>
              <span className="text-[10px] text-zinc-500 mt-1 font-medium">Upload screenshot</span>
            </button>

            <div className="text-center max-w-xs">
              <p className="text-zinc-400 text-sm leading-relaxed">
                AI text analysis ready. Start a new session or practice a response.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODE SELECTORS */}
      <div className="p-6 md:p-10 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 relative z-10">
        <button
          onClick={() => onActivate('simulator')}
          className="group flex flex-col bg-zinc-900 border border-zinc-800 hover:border-zinc-600 p-5 transition-all rounded-2xl"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white mb-6 group-hover:scale-105 transition-transform">
            <Target className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-white">Practice Mode</span>
          <span className="text-[11px] text-zinc-500 mt-1">Rehearse conversations</span>
        </button>

        <button
          onClick={() => onActivate('therapist')}
          className="group flex flex-col bg-zinc-900 border border-zinc-800 hover:border-zinc-600 p-5 transition-all rounded-2xl"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white mb-6 group-hover:scale-105 transition-transform">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-white">Therapist Mode</span>
          <span className="text-[11px] text-zinc-500 mt-1">Deep analysis & clarity</span>
        </button>

        <button
          onClick={() => onActivate('history')}
          className="hidden md:flex group flex flex-col bg-zinc-900 border border-zinc-800 hover:border-zinc-600 p-5 transition-all rounded-2xl"
        >
          <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white mb-6 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <span className="text-sm font-bold text-white">History</span>
          <span className="text-[11px] text-zinc-500 mt-1">Previous analyses</span>
        </button>
      </div>
    </div>
  );
};
