import React from 'react';
import { WellbeingState } from '../types';
import { AlertTriangle, Clock, Target, Activity, HeartPulse, ShieldAlert } from 'lucide-react';

interface WellbeingCheckInProps {
  reason: WellbeingState['reason'];
  onDismiss: () => void;
  onDismissForDay: () => void;
}

export const WellbeingCheckIn: React.FC<WellbeingCheckInProps> = ({ reason, onDismiss, onDismissForDay }) => {
  const messages: Record<NonNullable<WellbeingState['reason']>, { icon: React.ElementType; color: string; title: string; subtitle: string; message: string }> = {
    late_night: {
      icon: Clock,
      color: 'text-amber-400',
      title: "Late Night Reminder",
      subtitle: "Sleep is important for clarity",
      message: "Analytical accuracy and social intuition often decrease after 2 AM. Consider resting and reviewing your messages tomorrow for the best results."
    },
    same_person: {
      icon: Target,
      color: 'text-red-400',
      title: "Single Focus Detected",
      subtitle: "Balance your social bandwidth",
      message: "You've been spending a significant amount of energy on a single conversation. Taking a step back can help maintain a healthy perspective."
    },
    high_frequency: {
      icon: Activity,
      color: 'text-blue-400',
      title: "Usage Milestone",
      subtitle: "Time for a mental breather",
      message: "You've been analyzing many interactions recently. A short break can help prevent cognitive fatigue and ensure your responses stay authentic."
    },
    high_risk: {
      icon: ShieldAlert,
      color: 'text-red-400',
      title: "Vibe Check",
      subtitle: "Focus on your wellbeing",
      message: "Pattern recognition suggests some recent interactions might be stressful. It might be a good time to prioritize your own peace of mind."
    }
  };

  const content = reason ? messages[reason] : messages.high_frequency;
  const Icon = content.icon;

  const handleAction = (action: () => void) => {
    if ('vibrate' in navigator) navigator.vibrate(5);
    action();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[1000] flex items-center justify-center p-6 animate-fade-in font-sans select-none">
      <div className="bg-zinc-900/80 border border-white/5 max-w-lg w-full relative rounded-[40px] shadow-2xl overflow-hidden p-1">
        <div className="bg-black/20 rounded-[36px] overflow-hidden p-8 md:p-12">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-8 mb-10">
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-xl">
              <Icon className={`w-10 h-10 ${content.color}`} />
            </div>
            <div>
              <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-2 leading-none">{content.title}</h3>
              <p className={`text-[10px] font-bold ${content.color} uppercase tracking-widest`}>{content.subtitle}</p>
            </div>
          </div>

          <div className="space-y-10">
            <p className="text-zinc-400 text-sm leading-relaxed text-center font-medium">
              {content.message}
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleAction(onDismiss)}
                className="w-full py-4 bg-white text-black font-bold text-sm rounded-2xl hover:bg-zinc-200 transition-all shadow-xl active:scale-[0.98]"
              >
                Continue Anyway
              </button>
              <button
                onClick={() => handleAction(onDismissForDay)}
                className="w-full py-4 bg-white/5 border border-white/5 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all rounded-2xl"
              >
                Dismiss for 24 hours
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
