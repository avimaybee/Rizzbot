import React from 'react';
import { Home, Zap, MessageSquare, User, Clock, HeartHandshake } from 'lucide-react';

type TabItem = {
  id: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  shortcut?: string;
};

const tabs: TabItem[] = [
  { id: 'standby', label: 'HOME', icon: Home, shortcut: '01' },
  { id: 'quick', label: 'QUICK', icon: Zap, shortcut: '02' },
  { id: 'simulator', label: 'SIM', icon: MessageSquare, shortcut: '03' },
  { id: 'history', label: 'LOG', icon: Clock, shortcut: '04' },
  { id: 'profile', label: 'YOU', icon: User, shortcut: '05' },
  { id: 'therapist', label: 'TALK', icon: HeartHandshake, shortcut: '06' },
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
    <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800/80 safe-area-inset-bottom ${className}`}>
      <div className="flex justify-around items-center h-16 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center gap-0.5 
                min-w-[56px] py-1.5 px-1.5 rounded-md transition-all
                ${isActive
                  ? 'text-white bg-zinc-800/80'
                  : 'text-zinc-500 active:text-zinc-300'
                }
              `}
            >
              <Icon className={isActive ? 'w-5 h-5' : 'w-4 h-4'} />
              <span className={`text-[10px] font-bold tracking-wide uppercase ${isActive ? '' : 'opacity-60'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Compact version with 4 main tabs for cleaner mobile navigation
const compactTabs: TabItem[] = [
  { id: 'standby', label: 'HOME', icon: Home },
  { id: 'quick', label: 'QUICK', icon: Zap },
  { id: 'simulator', label: 'PRACTICE', icon: MessageSquare },
  { id: 'profile', label: 'PROFILE', icon: User },
];

interface CompactTabBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const CompactTabBar: React.FC<CompactTabBarProps> = ({
  activeTab,
  onTabChange,
  className = '',
}) => {
  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-sm border-t border-zinc-800/80 safe-area-inset-bottom ${className}`}>
      <div className="flex justify-around items-center h-16 px-2">
        {compactTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center justify-center gap-1 
                min-w-[64px] py-2 px-3 rounded-lg transition-all
                ${isActive
                  ? 'text-white bg-zinc-800'
                  : 'text-zinc-500 active:text-zinc-300'
                }
              `}
            >
              <Icon className={isActive ? 'w-5 h-5' : 'w-4 h-4'} />
              <span className={`text-[9px] font-bold tracking-wider uppercase ${isActive ? '' : 'opacity-70'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileTabBar;
