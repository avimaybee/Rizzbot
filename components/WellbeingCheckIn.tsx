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
      color: 'text-hard-gold',
      title: "Taking a Break?",
      subtitle: "Late Night Activity",
      message: "It's past 2 AM. Your analytical precision might be lower than usual. Consider revisiting this conversation after some rest for the best results."
    },
    same_person: {
      icon: Target,
      color: 'text-hard-red',
      title: "Recalibrate Focus",
      subtitle: "Unbalanced Engagement",
      message: "You've been focusing heavily on a single person recently. It might be helpful to take a step back and recalibrate your social energy."
    },
    high_frequency: {
      icon: Activity,
      color: 'text-hard-blue',
      title: "Mental Fatigue",
      subtitle: "High Usage Detected",
      message: "You've been analyzing a lot of messages lately. Taking a breather can help you stay objective and effective in your communications."
    },
    high_risk: {
      icon: ShieldAlert,
      color: 'text-hard-red',
      title: "Caution Advised",
      subtitle: "Communication Risk Detected",
      message: "Our patterns indicate this interaction might be heading in an unproductive direction. Would you like to focus on some self-care right now?"
    }
  };

  const content = reason ? messages[reason] : messages.high_frequency;
  const Icon = content.icon;

  const handleAction = (action: () => void) => {
    if ('vibrate' in navigator) navigator.vibrate(5);
    action();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1000] flex items-center justify-center p-6 animate-fade-in font-sans select-none">
      <div className="glass-dark border-white/5 max-w-lg w-full relative soft-edge shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden">

        {/* Header Section */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-5 mb-8">
            <div className={`w-16 h-16 glass flex items-center justify-center border-white/5 rounded-full relative shadow-[0_0_30px_rgba(0,0,0,0.3)]`}>
              <Icon className={`w-8 h-8 ${content.color}`} />
            </div>
            <div>
              <div className={`text-[10px] font-mono font-bold ${content.color} uppercase tracking-widest mb-2`}>Wellbeing Check</div>
              <h3 className="font-impact text-3xl text-white uppercase tracking-tighter leading-none">{content.title}</h3>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-black/40 border border-white/5 p-5 relative soft-edge">
               <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
                  Observation: {content.subtitle}
               </div>
               <p className="text-zinc-300 text-sm leading-relaxed">
                  {content.message}
               </p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => handleAction(onDismiss)}
                className="py-4 bg-white text-black font-impact text-xl uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-xl soft-edge"
              >
                Continue
              </button>
              <button
                onClick={() => handleAction(onDismissForDay)}
                className="py-4 glass-zinc border-white/5 text-zinc-500 font-mono font-bold text-[10px] uppercase tracking-widest hover:text-white hover:border-white/10 transition-all active:scale-[0.98] soft-edge"
              >
                Dismiss for 24h
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-black/40 border-t border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="text-[8px] font-mono font-bold text-zinc-700 uppercase tracking-widest">RizzBot Wellness v2.0</div>
          </div>
        </div>
      </div>
    </div>
  );
};
