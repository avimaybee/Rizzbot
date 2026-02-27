import React from 'react';
import { Zap, History, User, MessageSquare, Home, HeartHandshake } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'standby', label: 'Home', icon: Home },
    { id: 'quick', label: 'Quick', icon: Zap },
    { id: 'simulator', label: 'Sim', icon: MessageSquare },
    { id: 'therapist', label: 'Talk', icon: HeartHandshake },
    { id: 'history', label: 'Log', icon: History },
    { id: 'profile', label: 'You', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-4 safe-area-inset-bottom pointer-events-none">
      <div className="mx-auto max-w-[95%] bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/50 soft-edge shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto">
        <div className="flex justify-around items-center h-16 px-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (window.navigator.vibrate) window.navigator.vibrate(8);
                  onTabChange(tab.id);
                }}
                className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 relative group ${
                  isActive ? 'text-white' : 'text-zinc-500'
                }`}
                aria-label={tab.label}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-white/[0.03] animate-fade-in" />
                )}
                
                <div className={`relative flex items-center justify-center transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : 'group-active:scale-95'}`}>
                  {isActive && (
                    <div className="absolute inset-0 bg-white/20 blur-lg rounded-full animate-pulse-glow" />
                  )}
                  <Icon size={isActive ? 22 : 18} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
                <span className={`text-[9px] font-mono uppercase tracking-tighter transition-all duration-300 ${isActive ? 'opacity-100 font-bold' : 'opacity-40'}`}>
                  {tab.label}
                </span>

                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
