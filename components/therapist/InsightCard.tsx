import React from 'react';
import { Lightbulb, Target, Heart, Users, Scale, Brain, AlertTriangle } from 'lucide-react';

interface InsightCardProps {
  title: string;
  content: string;
  type?: 'pattern' | 'recommendation' | 'warning' | 'insight';
  icon?: 'lightbulb' | 'target' | 'heart' | 'users' | 'scale' | 'brain' | 'alert';
}

const iconMap = {
  lightbulb: Lightbulb,
  target: Target,
  heart: Heart,
  users: Users,
  scale: Scale,
  brain: Brain,
  alert: AlertTriangle,
};

const typeStyles = {
  pattern: {
    bg: 'bg-hard-purple/10',
    border: 'border-hard-purple/30',
    icon: 'text-hard-purple',
    label: 'PATTERN DETECTED'
  },
  recommendation: {
    bg: 'bg-hard-blue/10',
    border: 'border-hard-blue/30',
    icon: 'text-hard-blue',
    label: 'RECOMMENDATION'
  },
  warning: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    label: 'IMPORTANT NOTE'
  },
  insight: {
    bg: 'bg-hard-gold/10',
    border: 'border-hard-gold/30',
    icon: 'text-hard-gold',
    label: 'KEY INSIGHT'
  },
};

export const InsightCard: React.FC<InsightCardProps> = ({
  title,
  content,
  type = 'insight',
  icon = 'lightbulb'
}) => {
  const styles = typeStyles[type];
  const Icon = iconMap[icon];

  return (
    <div className={`${styles.bg} border ${styles.border} p-4 rounded-lg relative overflow-hidden`}>
      <div className="flex items-start gap-3">
        <div className={`${styles.icon} mt-0.5`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
            {styles.label}
          </div>
          <h4 className="text-sm font-semibold text-white mb-2">{title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
};

export default InsightCard;
