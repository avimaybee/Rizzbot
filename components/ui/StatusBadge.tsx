import React from 'react';

type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  label: string;
  variant?: StatusBadgeVariant;
  showDot?: boolean;
  animate?: boolean;
  className?: string;
}

const variantConfig: Record<StatusBadgeVariant, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-500',
    dot: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  default: {
    bg: 'bg-zinc-800',
    text: 'text-zinc-400',
    dot: 'bg-zinc-500',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'default',
  showDot = true,
  animate = false,
  className = '',
}) => {
  const config = variantConfig[variant];

  return (
    <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-full border border-zinc-800 ${config.bg} ${className}`}>
      {showDot && (
        <div className={`w-1.5 h-1.5 rounded-full ${config.dot} ${animate ? 'animate-pulse' : ''}`} />
      )}
      <span className={`text-[9px] font-mono uppercase tracking-wider ${config.text}`}>
        {label}
      </span>
    </div>
  );
};

export default StatusBadge;
