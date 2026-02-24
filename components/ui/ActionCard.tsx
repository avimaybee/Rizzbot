import React from 'react';
import { CornerNodes } from './CornerNodes';

type ActionCardVariant = 'gold' | 'blue' | 'rose' | 'purple' | 'default';

interface ActionCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  variant?: ActionCardVariant;
  onClick?: () => void;
  actionLabel?: string;
  showCornerNodes?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const variantConfig = {
  gold: {
    dot: 'bg-hard-gold',
    accent: 'text-hard-gold',
    border: 'border-zinc-800 hover:border-hard-gold/50',
    bg: 'bg-zinc-900/40 hover:bg-zinc-900/60',
    gradient: 'from-transparent via-hard-gold/50 to-transparent',
    actionBg: 'group-hover:bg-hard-gold group-hover:text-black group-hover:border-hard-gold',
  },
  blue: {
    dot: 'bg-hard-blue',
    accent: 'text-hard-blue',
    border: 'border-zinc-800 hover:border-hard-blue/50',
    bg: 'bg-zinc-900/40 hover:bg-zinc-900/60',
    gradient: 'from-transparent via-hard-blue/50 to-transparent',
    actionBg: 'group-hover:bg-hard-blue group-hover:text-black group-hover:border-hard-blue',
  },
  rose: {
    dot: 'bg-rose-500',
    accent: 'text-rose-400',
    border: 'border-zinc-800 hover:border-rose-500/50',
    bg: 'bg-zinc-900/40 hover:bg-zinc-900/60',
    gradient: 'from-transparent via-rose-500/50 to-transparent',
    actionBg: 'group-hover:bg-rose-500 group-hover:text-black group-hover:border-rose-500',
  },
  purple: {
    dot: 'bg-hard-purple',
    accent: 'text-hard-purple',
    border: 'border-zinc-800 hover:border-hard-purple/50',
    bg: 'bg-zinc-900/40 hover:bg-zinc-900/60',
    gradient: 'from-transparent via-hard-purple/50 to-transparent',
    actionBg: 'group-hover:bg-hard-purple group-hover:text-black group-hover:border-hard-purple',
  },
  default: {
    dot: 'bg-zinc-500',
    accent: 'text-zinc-400',
    border: 'border-zinc-800 hover:border-zinc-700',
    bg: 'bg-zinc-900/40 hover:bg-zinc-900/60',
    gradient: 'from-transparent via-zinc-500/30 to-transparent',
    actionBg: 'group-hover:bg-zinc-700 group-hover:text-white',
  },
};

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  subtitle,
  description,
  variant = 'default',
  onClick,
  actionLabel,
  showCornerNodes = false,
  className = '',
  children,
}) => {
  const config = variantConfig[variant];
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`
        w-full h-28 sm:h-32 relative border ${config.border} ${config.bg} 
        transition-all group overflow-hidden flex flex-col justify-between p-4
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {/* Gradient Top Line */}
      <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r ${config.gradient} opacity-50`} />
      
      {/* Corner Nodes */}
      {showCornerNodes && (
        <CornerNodes variant={variant} className="opacity-40" />
      )}

      {/* Top Section */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-1.5 h-1.5 ${config.dot}`}></span>
            <span className={`text-[9px] font-mono ${config.accent} tracking-widest`}>
              {subtitle || 'MODULE'}
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-impact text-white uppercase tracking-wide">
            {title}
          </h3>
        </div>
        {children && <div className="text-zinc-500 group-hover:text-white transition-colors">{children}</div>}
      </div>

      {/* Bottom Section */}
      <div className="flex items-end justify-between">
        {description && (
          <span className="text-[10px] font-mono text-zinc-500 max-w-[180px] text-left hidden sm:block">
            {description}
          </span>
        )}
        {actionLabel && (
          <div className={`
            px-2 py-1 border border-zinc-700 text-[9px] text-zinc-400 font-mono uppercase 
            ${config.actionBg} transition-colors
          `}>
            {actionLabel}
          </div>
        )}
      </div>
    </Tag>
  );
};

export default ActionCard;
