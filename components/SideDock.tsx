import React from 'react';
import { LogOut, LayoutDashboard, Zap, Target, Shield, HeartHandshake, User } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { Module } from '../types';
import { Logo } from './Logo';

interface DockItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ElementType;
}

const DockItem: React.FC<DockItemProps> = ({ active, onClick, label, icon: Icon }) => (
  <button
    onClick={onClick}
    className="w-full flex flex-col items-center justify-center gap-2 group relative py-3"
  >
    {/* Active Indicator */}
    <div className={`absolute left-0 w-1 h-6 bg-white rounded-r-full transition-all duration-300 ${active ? 'opacity-100' : 'opacity-0 scale-y-0'}`}></div>
    
    <div className={`transition-all duration-300 ${active ? 'text-white scale-110' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
      <Icon className="w-5 h-5" />
    </div>
    
    <span className={`text-[9px] font-bold tracking-widest uppercase transition-colors ${active ? 'text-white' : 'text-zinc-700 group-hover:text-zinc-500'}`}>
      {label}
    </span>
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
    <div className="hidden md:flex w-20 border-r border-white/5 bg-black flex-col items-center py-10 z-50 h-full relative font-sans">
      <div className="mb-12 group cursor-pointer" onClick={() => handleAction('standby')}>
        <Logo size={32} className="opacity-80 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex-1 flex flex-col gap-4 w-full">
        <DockItem
          active={activeModule === 'standby'}
          onClick={() => handleAction('standby')}
          label="Home"
          icon={LayoutDashboard}
        />
        <DockItem
          active={activeModule === 'quick'}
          onClick={() => handleAction('quick')}
          label="Scan"
          icon={Zap}
        />
        <DockItem
          active={activeModule === 'simulator'}
          onClick={() => handleAction('simulator')}
          label="Practice"
          icon={Target}
        />
        <DockItem
          active={activeModule === 'history'}
          onClick={() => handleAction('history')}
          label="History"
          icon={Shield}
        />
        <DockItem
          active={activeModule === 'therapist'}
          onClick={() => handleAction('therapist')}
          label="Support"
          icon={HeartHandshake}
        />
        <DockItem
          active={activeModule === 'profile'}
          onClick={() => handleAction('profile')}
          label="Profile"
          icon={User}
        />
      </div>

      <div className="mt-auto flex flex-col items-center gap-8 w-full">
        {authUser && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div 
              onClick={() => handleAction('profile')}
              className="relative cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 group-hover:border-white/20 transition-all">
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt=""
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-xs font-bold uppercase group-hover:text-zinc-400 transition-all">
                    {authUser.displayName?.[0] || 'U'}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black shadow-sm"></div>
            </div>
            
            {onSignOut && (
              <button
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(10);
                  onSignOut();
                }}
                className="text-zinc-700 hover:text-red-500 transition-colors p-2"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
