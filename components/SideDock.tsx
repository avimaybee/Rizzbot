import React from 'react';
import { LogOut, LayoutDashboard, Zap, Target, Shield, HeartHandshake, User, Settings } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { Module } from '../types';
import { Logo } from './Logo';

interface DockItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
  index: string;
  icon: React.ElementType;
}

const DockItem: React.FC<DockItemProps> = ({ active, onClick, label, index, icon: Icon }) => (
  <button
    onClick={onClick}
    className="w-full flex flex-col items-center justify-center gap-2 group relative py-2"
  >
    {/* Active Indicator Frame */}
    <div className={`absolute left-0 w-1 h-8 bg-hard-gold transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0 scale-y-0'}`}></div>
    
    <div className={`transition-all duration-300 ${active ? 'text-hard-gold scale-110' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
      <Icon className="w-5 h-5" />
    </div>
    
    <span className={`text-[8px] font-bold tracking-[0.2em] uppercase transition-colors ${active ? 'text-white' : 'text-zinc-700 group-hover:text-zinc-500'}`}>
      {label}
    </span>
    
    {/* Index Marker */}
    <span className="absolute -right-1 top-1 text-[7px] text-zinc-800 font-mono opacity-0 group-hover:opacity-100 transition-opacity">[{index}]</span>
  </button>
);

interface SideDockProps {
  activeModule: Module;
  setModule: (m: Module) => void;
  authUser?: AuthUser | null;
  onSignOut?: () => void;
}

export const SideDock: React.FC<SideDockProps> = ({ activeModule, setModule, authUser, onSignOut }) => {
  const handleAction = (module: Module) => {
    if ('vibrate' in navigator) navigator.vibrate(5);
    setModule(module);
  };

  return (
    <div className="hidden md:flex w-20 border-r border-white/5 bg-black flex-col items-center py-8 z-50 h-full relative font-mono">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-scan-lines opacity-[0.03] pointer-events-none"></div>
      
      <div className="mb-12 relative group cursor-pointer" onClick={() => handleAction('standby')}>
        <div className="absolute inset-0 bg-hard-gold/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <Logo size={36} className="relative z-10 opacity-80 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" />
      </div>

      <div className="flex-1 flex flex-col gap-6 w-full">
        <DockItem
          active={activeModule === 'standby'}
          onClick={() => handleAction('standby')}
          label="SYS"
          index="01"
          icon={LayoutDashboard}
        />
        <DockItem
          active={activeModule === 'quick'}
          onClick={() => handleAction('quick')}
          label="SCAN"
          index="02"
          icon={Zap}
        />
        <DockItem
          active={activeModule === 'simulator'}
          onClick={() => handleAction('simulator')}
          label="SIM"
          index="03"
          icon={Target}
        />
        <DockItem
          active={activeModule === 'history'}
          onClick={() => handleAction('history')}
          label="ARC"
          index="04"
          icon={Shield}
        />
        <DockItem
          active={activeModule === 'therapist'}
          onClick={() => handleAction('therapist')}
          label="MED"
          index="05"
          icon={HeartHandshake}
        />
        <DockItem
          active={activeModule === 'profile'}
          onClick={() => handleAction('profile')}
          label="USR"
          index="06"
          icon={User}
        />
      </div>

      <div className="mt-auto flex flex-col items-center gap-6 w-full">
        {/* User Node */}
        {authUser && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div 
              onClick={() => handleAction('profile')}
              className="relative cursor-pointer group"
            >
              <div className="absolute inset-[-4px] border border-white/5 group-hover:border-white/10 transition-colors"></div>
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt=""
                  className="w-10 h-10 border border-white/5 grayscale group-hover:grayscale-0 transition-all shadow-xl"
                />
              ) : (
                <div className="w-10 h-10 bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 text-xs font-bold uppercase group-hover:text-zinc-400 transition-all">
                  {authUser.displayName?.[0] || 'U'}
                </div>
              )}
              {/* Status indicator */}
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-black shadow-sm"></div>
            </div>
            
            {onSignOut && (
              <button
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(10);
                  onSignOut();
                }}
                className="text-zinc-700 hover:text-hard-red transition-colors p-2"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        
        {/* Hardware Identifier */}
        <div className="text-[7px] font-bold text-zinc-800 writing-vertical-lr tracking-[0.4em] uppercase py-4 border-t border-white/5 w-full flex items-center">
          RB_UNIT_77_NODE_01
        </div>
      </div>
    </div>
  );
};
