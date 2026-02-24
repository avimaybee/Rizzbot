import React from 'react';
import { BookOpen, MessageCircle, Activity, ShieldAlert } from 'lucide-react';
import { ExerciseType } from '../../types';

interface ExerciseCardProps {
  title: string;
  description: string;
  type: ExerciseType;
  onStart?: () => void;
  completed?: boolean;
}

const typeStyles = {
  reflection: {
    icon: BookOpen,
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    label: 'REFLECTION'
  },
  conversation_starter: {
    icon: MessageCircle,
    bg: 'bg-hard-blue/10',
    border: 'border-hard-blue/30',
    iconBg: 'bg-hard-blue/20',
    iconColor: 'text-hard-blue',
    label: 'CONVERSATION'
  },
  mindfulness: {
    icon: Activity,
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    label: 'MINDFULNESS'
  },
  boundary_practice: {
    icon: ShieldAlert,
    bg: 'bg-hard-gold/10',
    border: 'border-hard-gold/30',
    iconBg: 'bg-hard-gold/20',
    iconColor: 'text-hard-gold',
    label: 'BOUNDARY'
  }
};

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  title,
  description,
  type,
  onStart,
  completed = false
}) => {
  const styles = typeStyles[type] || typeStyles.reflection;
  const Icon = styles.icon;

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4 transition-all hover:brightness-110`}>
      <div className="flex items-start gap-3">
        <div className={`${styles.iconBg} ${styles.iconColor} p-2 rounded-lg`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {styles.label}
            </span>
            {completed && (
              <span className="text-[10px] font-mono text-emerald-400 uppercase">✓ DONE</span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed mb-3">{description}</p>
          
          {onStart && !completed && (
            <button
              onClick={onStart}
              className="text-xs font-bold uppercase tracking-wider text-white hover:underline"
            >
              START EXERCISE →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseCard;
