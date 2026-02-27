import React, { useState, useEffect } from 'react';
import { User, Shield, CheckCircle2, ChevronRight, LogOut, Edit3, Save, Sparkles, MessageSquare, Brain, Target, Zap, Clock, Activity, ShieldCheck, UserCheck } from 'lucide-react';
import { UserStyleProfile, UserProfile as UserData } from '../types';
import { useGlobalToast } from './Toast';
import { ModuleHeader } from './ModuleHeader';

interface UserProfileProps {
  onBack: () => void;
  onSave: (profile: UserStyleProfile) => void;
  initialProfile?: UserStyleProfile | null;
  userId?: number | null;
  authUser?: any;
  onSignOut?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onBack, onSave, initialProfile, userId, authUser, onSignOut }) => {
  // Profile state
  const [profile, setProfile] = useState<UserStyleProfile>({
    emojiUsage: 'minimal',
    capitalization: 'lowercase',
    punctuation: 'minimal',
    averageLength: 'medium',
    slangLevel: 'casual',
    signaturePatterns: [],
    preferredTone: 'playful',
    favoriteEmojis: [],
    rawSamples: [],
  });

  const [activeTab, setActiveFilter] = useState<'profile' | 'settings'>('profile');
  const { showToast } = useGlobalToast();

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  const handleSave = () => {
    handleAction(() => {
      onSave(profile);
      showToast('Profile updated', 'success');
    }, 15);
  };

  const tones = ['Direct', 'Playful', 'Thoughtful', 'Concise', 'Expressive'];

  return (
    <div className="h-full flex flex-col bg-matte-base font-sans select-none overflow-hidden">
      
      {/* MODULE HEADER */}
      <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="Account Profile" 
          mode="Identity & Settings" 
          onBack={() => handleAction(onBack)}
          accentColor="blue"
          statusLabel="Authentication"
          statusValue="Verified"
          statusColor="emerald"
        />
      </div>

      {/* TABS */}
      <div className="px-8 py-4 flex gap-8 border-b border-white/5 bg-black/20 shrink-0">
        <button 
          onClick={() => handleAction(() => setActiveFilter('profile'), 2)}
          className={`pb-4 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'profile' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          Style Profile
          {activeTab === 'profile' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
        </button>
        <button 
          onClick={() => handleAction(() => setActiveFilter('settings'), 2)}
          className={`pb-4 text-[10px] font-bold uppercase tracking-widest transition-all relative ${activeTab === 'settings' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          System Settings
          {activeTab === 'settings' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 scrollbar-hide relative z-10 custom-scrollbar pb-32">
        
        {activeTab === 'profile' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
            {/* User Hero */}
            <div className="flex flex-col md:flex-row items-center gap-10 bg-white/5 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
              <div className="relative">
                {authUser?.photoURL ? (
                  <img src={authUser.photoURL} alt="" className="w-24 h-24 rounded-[2rem] border-2 border-white/10 shadow-2xl grayscale hover:grayscale-0 transition-all duration-500" />
                ) : (
                  <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center text-zinc-600">
                    <User size={40} />
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-matte-base rounded-full flex items-center justify-center">
                   <ShieldCheck size={14} className="text-white" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4 justify-center md:justify-start">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight">{authUser?.displayName || 'Authorized User'}</h3>
                </div>
                <div className="flex items-center gap-6 justify-center md:justify-start opacity-60">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-zinc-500" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active since {new Date(authUser?.metadata?.creationTime).getFullYear()}</span>
                  </div>
                  <div className="flex items-center gap-2 border-l border-white/10 pl-6">
                    <Activity size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status: Ready</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Calibration */}
            <div className="space-y-8">
              <div className="flex items-center gap-4 px-1">
                <Brain className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Style Calibration</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Tone Select */}
                <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] shadow-xl space-y-6">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Primary Communication Tone</label>
                  <div className="flex flex-wrap gap-3">
                    {tones.map(t => (
                      <button
                        key={t}
                        onClick={() => handleAction(() => setProfile({ ...profile, preferredTone: t.toLowerCase() as any }), 2)}
                        className={`px-6 py-3 text-xs font-bold rounded-2xl border transition-all active:scale-[0.98] ${
                          profile.preferredTone === t.toLowerCase()
                          ? 'bg-white text-black border-white shadow-xl'
                          : 'bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Characteristics */}
                <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] shadow-xl space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Message Complexity</span>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{profile.averageLength}</span>
                    </div>
                    <input
                      type="range"
                      min="0" max="2" step="1"
                      className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white"
                      onChange={(e) => {
                        const vals: any[] = ['short', 'medium', 'long'];
                        setProfile({ ...profile, averageLength: vals[parseInt(e.target.value)] });
                      }}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Slang Intensity</span>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{profile.slangLevel}</span>
                    </div>
                    <input
                      type="range"
                      min="0" max="2" step="1"
                      className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white"
                      onChange={(e) => {
                        const vals: any[] = ['minimal', 'casual', 'heavy'];
                        setProfile({ ...profile, slangLevel: vals[parseInt(e.target.value)] });
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Summary */}
            {profile.aiSummary && (
              <div className="bg-white/5 border border-white/5 p-10 rounded-[3rem] shadow-2xl relative group">
                <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h4 className="text-xl font-bold uppercase tracking-tight text-white">Automated Identity Summary</h4>
                </div>
                <p className="text-zinc-400 text-base leading-relaxed italic font-medium uppercase tracking-tight">
                  "{profile.aiSummary}"
                </p>
              </div>
            )}

            {/* Action Area */}
            <div className="pt-12 border-t border-white/5 flex justify-center">
              <button
                onClick={handleSave}
                className="px-20 py-5 bg-white text-black font-black text-xl uppercase tracking-tight rounded-3xl shadow-2xl hover:bg-zinc-200 transition-all active:scale-[0.98] flex items-center gap-4"
              >
                <Save size={24} />
                <span>Save Profile</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-10 animate-fade-in">
            <div className="bg-white/5 border border-white/5 p-10 rounded-[2.5rem] shadow-2xl space-y-10">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <Shield className="w-5 h-5 text-blue-400" />
                <h4 className="text-xl font-bold uppercase tracking-tight text-white">System Settings</h4>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white uppercase tracking-tight">Privacy Mode</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Enhanced Data Protection</span>
                  </div>
                  <div className="w-12 h-6 bg-blue-500 rounded-full relative p-1 cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1"></div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-all">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-white uppercase tracking-tight">Haptic Feedback</span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Physical Interaction Cues</span>
                  </div>
                  <div className="w-12 h-6 bg-blue-500 rounded-full relative p-1 cursor-pointer">
                    <div className="w-4 h-4 bg-white rounded-full absolute right-1"></div>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => handleAction(onSignOut || (() => {}), 20)}
                  className="w-full py-5 bg-red-500/10 border border-red-500/20 text-red-400 font-bold uppercase tracking-widest rounded-2xl hover:bg-red-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4 shadow-xl"
                >
                  <LogOut size={20} />
                  <span>Terminate Session</span>
                </button>
              </div>
            </div>
            
            <div className="text-center">
               <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-[0.4em]">Rizzbot v4.2</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
