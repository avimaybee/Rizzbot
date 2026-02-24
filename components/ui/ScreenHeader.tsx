import React from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  variant?: 'default' | 'gold' | 'blue' | 'rose' | 'purple';
  showCornerNodes?: boolean;
  children?: React.ReactNode;
}

const variantColors = {
  default: 'text-zinc-400',
  gold: 'text-hard-gold',
  blue: 'text-hard-blue',
  rose: 'text-rose-400',
  purple: 'text-hard-purple',
};

const variantDotColors = {
  default: 'bg-zinc-500',
  gold: 'bg-hard-gold',
  blue: 'bg-hard-blue',
  rose: 'bg-rose-500',
  purple: 'bg-hard-purple',
};

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  onAction,
  actionLabel,
  variant = 'default',
  children,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-matte-base/95 backdrop-blur-sm border-b border-zinc-800/80">
      <div className="flex items-center justify-between h-14 px-3 sm:px-4">
        {/* Left: Back Button + Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors min-h-[44px] min-w-[44px] -ml-2 px-2 rounded-md hover:bg-zinc-800/50 active:bg-zinc-800"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide hidden sm:block">BACK</span>
            </button>
          )}
          
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full ${variantDotColors[variant]}`}></span>
            <div className="min-w-0">
              <h1 className="text-sm font-bold uppercase tracking-wider text-white truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action or children */}
        <div className="flex items-center gap-2">
          {children}
          {onAction && (
            <button
              onClick={onAction}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-md transition-colors min-h-[44px]"
            >
              {actionLabel || <MoreVertical className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default ScreenHeader;
