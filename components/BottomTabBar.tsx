import React from 'react';
import { Zap, History, User, MessageSquare, Home, HeartHandshake, LayoutDashboard, Target, Shield } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'standby', label: 'Home', icon: LayoutDashboard },
    { id: 'quick', label: 'Scan', icon: Zap },
    { id: 'simulator', label: 'Practice', icon: Target },
    { id: 'therapist', label: 'Support', icon: HeartHandshake },
    { id: 'history', label: 'History', icon: Shield },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const handleAction = (id: string) => {
    if ('vibrate' in navigator) navigator.vibrate(5);
    onTabChange(id);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pointer-events-none font-sans">
      <div className="mx-auto max-w-lg bg-zinc-900/90 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl pointer-events-auto overflow-hidden relative">
        <div className="flex justify-around items-center h-16 px-2 relative z-10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleAction(tab.id)}
                className={`flex flex-col items-center justify-center gap-1.5 flex-1 h-full transition-all duration-300 relative group ${
                  isActive ? 'text-white' : 'text-zinc-500'
                }`}
                aria-label={tab.label}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : 'group-active:scale-90'}`} />
                <span className={`text-[8px] font-bold uppercase tracking-widest transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
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
