import React from 'react';
import { Home, Zap, MessageSquare, User } from 'lucide-react';

type TabItem = {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
};

const tabs: TabItem[] = [
  { id: 'standby', label: 'HOME', icon: Home },
  { id: 'quick', label: 'QUICK', icon: Zap },
  { id: 'simulator', label: 'PRACTICE', icon: MessageSquare },
  { id: 'profile', label: 'PROFILE', icon: User },
];

interface MobileTabBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800/80 safe-area-inset-bottom ${className}`}>
      {/* Gradient overlay for depth */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent"></div>
      
      <div className="flex justify-around items-center h-[72px] px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex flex-col items-center justify-center gap-1 
                min-w-[64px] py-2 px-4 rounded-xl transition-all duration-200
                min-h-[48px]
                ${isActive
                  ? 'text-white'
                  : 'text-zinc-500 active:text-zinc-300'
                }
              `}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-hard-gold rounded-full animate-fade-in" />
              )}
              
              <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                <Icon className={`${isActive ? 'w-6 h-6' : 'w-5 h-5'}`} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              
              <span className={`text-[10px] font-bold tracking-wider uppercase transition-all duration-200 ${isActive ? 'text-white opacity-100' : 'opacity-60'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Quick Actions Floating Action Button for secondary features
import { Clock, HeartHandshake, MoreHorizontal } from 'lucide-react';

interface QuickActionsFabProps {
  onOpenHistory: () => void;
  onOpenTherapist: () => void;
  className?: string;
}

export const QuickActionsFab: React.FC<QuickActionsFabProps> = ({
  onOpenHistory,
  onOpenTherapist,
  className = '',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className={`md:hidden fixed bottom-20 right-4 z-40 ${className}`}>
      {/* Action buttons */}
      {isOpen && (
        <div className="flex flex-col gap-3 mb-3 animate-slide-up">
          <button
            onClick={() => {
              onOpenHistory();
              setIsOpen(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-full shadow-lg hover:bg-zinc-700 transition-all min-h-[48px]"
          >
            <Clock className="w-5 h-5 text-zinc-400" />
            <span className="text-xs font-bold uppercase text-white">History</span>
          </button>
          
          <button
            onClick={() => {
              onOpenTherapist();
              setIsOpen(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-900/30 border border-rose-700/50 rounded-full shadow-lg hover:bg-rose-900/50 transition-all min-h-[48px]"
          >
            <HeartHandshake className="w-5 h-5 text-rose-400" />
            <span className="text-xs font-bold uppercase text-white">Therapist</span>
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-14 h-14 rounded-full flex items-center justify-center
          transition-all duration-300 shadow-lg
          ${isOpen 
            ? 'bg-zinc-700 rotate-90' 
            : 'bg-hard-gold text-black hover:bg-yellow-400 active:scale-95'
          }
        `}
      >
        {isOpen ? (
          <MoreHorizontal className="w-6 h-6 text-white" />
        ) : (
          <Zap className="w-6 h-6" fill="currentColor" />
        )}
      </button>
    </div>
  );
};

export default MobileTabBar;
