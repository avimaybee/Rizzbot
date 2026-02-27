import React from 'react';
import { LogOut } from 'lucide-react';
import { AuthUser } from '../services/firebaseService';
import { Module } from '../types';
import { Logo } from './Logo';

interface DockItemProps {
  active: boolean;
  onClick: () => void;
  label: string;
  index: string;
}

const DockItem: React.FC<DockItemProps> = ({ active, onClick, label, index }) => (
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

interface SideDockProps {
  activeModule: Module;
  setModule: (m: Module) => void;
  authUser?: AuthUser | null;
  onSignOut?: () => void;
}

export const SideDock: React.FC<SideDockProps> = ({ activeModule, setModule, authUser, onSignOut }) => {
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
