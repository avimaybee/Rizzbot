import React from 'react';
import { Zap, History, User, MessageSquare, Home, HeartHandshake, LayoutDashboard, Target, Shield } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'standby', label: 'SYS', icon: LayoutDashboard },
    { id: 'quick', label: 'SCAN', icon: Zap },
    { id: 'simulator', label: 'SIM', icon: Target },
    { id: 'therapist', label: 'MED', icon: HeartHandshake },
    { id: 'history', label: 'ARC', icon: Shield },
    { id: 'profile', label: 'USR', icon: User },
  ];

  const handleAction = (id: string) => {
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(id);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 safe-area-inset-bottom pointer-events-none font-mono">
      <div className="mx-auto max-w-lg glass-dark border-white/5 soft-edge shadow-[0_30px_100px_rgba(0,0,0,0.8)] pointer-events-auto overflow-hidden relative group">
        <div className="absolute inset-0 bg-scan-lines opacity-[0.03] pointer-events-none"></div>
        
        <div className="flex justify-around items-center h-16 px-2 relative z-10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleAction(tab.id)}
                className={`flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all duration-500 relative group/btn ${
                  isActive ? 'text-white' : 'text-zinc-600'
                }`}
                aria-label={tab.label}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-white/[0.02] animate-fade-in" />
                )}
                
                <div className={`relative flex items-center justify-center transition-all duration-500 ${isActive ? 'scale-110 -translate-y-1 text-hard-gold' : 'group-hover/btn:text-zinc-400 group-active/btn:scale-90'}`}>
                  {isActive && (
                    <div className="absolute inset-0 bg-hard-gold/20 blur-md rounded-full animate-pulse" />
                  )}
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                
                <span className={`text-[8px] font-bold uppercase tracking-[0.2em] transition-all duration-500 ${isActive ? 'opacity-100 text-white' : 'opacity-40'}`}>
                  {tab.label}
                </span>

                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-hard-gold shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
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
