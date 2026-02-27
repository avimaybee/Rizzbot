import React, { useState } from 'react';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  resetPassword,
} from '../services/firebaseService';
import { Sparkles, ArrowRight, Lock, Mail, User, Shield, Terminal } from 'lucide-react';
import { CornerNodes } from './CornerNodes';

interface AuthModalProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'signin' | 'signup' | 'reset';

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if ('vibrate' in navigator) navigator.vibrate(10);
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName || undefined);
      } else if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setResetSent(true);
        setLoading(false);
        return;
      }
      if ('vibrate' in navigator) navigator.vibrate([20, 50, 20]);
      onAuthSuccess();
    } catch (err: any) {
      if ('vibrate' in navigator) navigator.vibrate(50);
      const errorCode = err.code || '';
      if (errorCode === 'auth/user-not-found') {
        setError("CREDENTIALS NOT RECOGNIZED. VERIFY IDENTITY.");
      } else if (errorCode === 'auth/wrong-password') {
        setError("ACCESS DENIED. INCORRECT KEYPHRASE.");
      } else if (errorCode === 'auth/email-already-in-use') {
        setError("IDENTITY ALREADY REGISTERED. SIGN IN.");
      } else if (errorCode === 'auth/weak-password') {
        setError("KEYPHRASE BELOW MINIMUM SECURITY THRESHOLD.");
      } else if (errorCode === 'auth/invalid-email') {
        setError("INVALID PROTOCOL. CHECK EMAIL FORMAT.");
      } else if (errorCode === 'auth/too-many-requests') {
        setError("SYSTEM LOCKOUT. COOL DOWN REQUIRED.");
      } else if (errorCode === 'auth/popup-closed-by-user') {
        setError("AUTHENTICATION ABORTED BY USER.");
      } else {
        setError(err.message || "SYSTEM ERROR. RETRY AUTHENTICATION.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
      if ('vibrate' in navigator) navigator.vibrate([20, 50, 20]);
      onAuthSuccess();
    } catch (err: any) {
      if ('vibrate' in navigator) navigator.vibrate(50);
      const errorCode = err.code || '';
      if (errorCode === 'auth/popup-closed-by-user') {
        setError("GOOGLE AUTHENTICATION ABORTED.");
      } else if (errorCode === 'auth/popup-blocked') {
        setError("INTERFACE BLOCKED. DISABLE POPUP FILTERS.");
      } else {
        setError(err.message || "EXTERNAL SYSTEM ERROR.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    if ('vibrate' in navigator) navigator.vibrate(5);
    setMode(newMode);
    setError(null);
    setResetSent(false);
  };

  return (
    <div className="min-h-[100dvh] bg-matte-base flex items-center justify-center p-4 relative overflow-hidden font-mono">
      {/* Background Layer: Organic Gradient Blur */}
      <div className="absolute top-[-10%] -left-[10%] w-[40%] h-[40%] bg-hard-gold/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] -right-[10%] w-[40%] h-[40%] bg-hard-blue/10 rounded-full blur-[120px] animate-pulse-slow delay-1000"></div>
      
      {/* Background Texture Layers */}
      <div className="absolute inset-0 bg-topo-pattern opacity-[0.03] pointer-events-none"></div>
      <div className="absolute inset-0 bg-scan-lines opacity-[0.07] pointer-events-none"></div>
      <div className="bg-matte-grain"></div>

      <div className="w-full max-w-5xl relative z-10 grid md:grid-cols-2 gap-0 md:gap-12 items-center">

        {/* Left Column: Tactical Branding */}
        <div className="hidden md:flex flex-col justify-center h-full p-12 relative">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-hard-gold shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">SYSTEM STATUS: READY</span>
            </div>
            
            <h1 className="text-8xl font-impact text-white uppercase tracking-tighter mb-6 leading-[0.85] filter drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              RIZZ<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">BOT</span>
            </h1>
            
            <div className="space-y-4 max-w-sm">
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-hard-gold mt-1" />
                <p className="text-zinc-400 text-xs leading-relaxed tracking-wide">
                  <span className="text-white font-bold uppercase block mb-1">Secure Intel</span>
                  End-to-end encrypted linguistic processing for high-stakes interpersonal dynamics.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Terminal className="w-4 h-4 text-hard-blue mt-1" />
                <p className="text-zinc-400 text-xs leading-relaxed tracking-wide">
                  <span className="text-white font-bold uppercase block mb-1">Tactical Analysis</span>
                  Real-time pattern recognition and risk mitigation for optimal outcome generation.
                </p>
              </div>
            </div>
          </div>

          {/* Decorative Status Ticker */}
          <div className="text-[9px] text-zinc-600 space-y-1.5 opacity-60 border-l border-zinc-800/50 pl-4">
            <p className="flex justify-between w-48"><span>INITIALIZING CORE</span> <span className="text-emerald-500">[OK]</span></p>
            <p className="flex justify-between w-48"><span>NEURAL MAPPING</span> <span className="text-emerald-500">[OK]</span></p>
            <p className="flex justify-between w-48"><span>ENCRYPTING UPLINK</span> <span className="text-hard-gold">[WAIT]</span></p>
            <p className="animate-pulse">_PENDING_USER_AUTH</p>
          </div>
        </div>

        {/* Right Column: Glassmorphic Auth Hub */}
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Header (Tactical minimalist) */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-5xl font-impact text-white uppercase tracking-tighter mb-2">
              RIZZBOT
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="w-1 h-1 bg-hard-gold rounded-full animate-ping"></div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Secure Access Point</span>
            </div>
          </div>

          <div className="glass-dark relative shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] border-white/5 overflow-hidden">
            {/* Inner accent gradient */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            <div className="p-6 sm:p-10">
              {/* Tactical Mode Selector */}
              {mode !== 'reset' && (
                <div className="flex mb-8 bg-black/40 p-1 border border-white/5">
                  <button
                    onClick={() => switchMode('signin')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${mode === 'signin'
                      ? 'bg-zinc-800 text-white shadow-lg'
                      : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => switchMode('signup')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${mode === 'signup'
                      ? 'bg-zinc-800 text-white shadow-lg'
                      : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                  >
                    Register
                  </button>
                </div>
              )}

              {/* Reset Mode Header */}
              {mode === 'reset' && (
                <div className="mb-8">
                  <button
                    onClick={() => switchMode('signin')}
                    className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-6 transition-colors group"
                  >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span> Return to Base
                  </button>
                  <h2 className="text-white font-impact text-3xl uppercase tracking-wide mb-2">Password Reset</h2>
                  <div className="h-1 w-12 bg-hard-gold mb-4"></div>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Initiating credentials recovery sequence. Enter authorized email.
                  </p>
                </div>
              )}

              {/* Google Integration (The "Clean" alternative) */}
              {mode !== 'reset' && (
                <>
                  <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-bold py-3.5 px-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        className="opacity-70"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        className="opacity-50"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        className="opacity-80"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="uppercase tracking-[0.15em] text-[10px]">Continue with Google</span>
                  </button>

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-4 bg-[#0a0a0a] text-zinc-700 text-[9px] uppercase tracking-[0.3em] font-bold">Standard Uplink</span>
                    </div>
                  </div>
                </>
              )}

              {/* Main Auth Form */}
              <form onSubmit={handleEmailAuth} className="space-y-5">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label htmlFor="displayName" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <User className="w-3 h-3 text-hard-blue" />
                      Operator Codename
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                      placeholder="e.g. AGENT_007"
                      className="w-full glass-zinc border-white/5 focus:border-hard-blue/50 px-4 py-3.5 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3 h-3 text-hard-gold" />
                    Comm Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="user@system.secure"
                    className="w-full glass-zinc border-white/5 focus:border-hard-gold/50 px-4 py-3.5 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all"
                  />
                </div>

                {mode !== 'reset' && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label htmlFor="password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <Lock className="w-3 h-3 text-hard-gold" />
                        Security Keyphrase
                      </label>
                    </div>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      placeholder="••••••••••••"
                      minLength={6}
                      className="w-full glass-zinc border-white/5 focus:border-hard-gold/50 px-4 py-3.5 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all"
                    />
                  </div>
                )}

                {/* Status Notifications */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-[10px] font-bold flex items-start gap-3 animate-shake">
                    <span className="text-red-500">[!]</span> {error}
                  </div>
                )}

                {resetSent && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-emerald-400 text-[10px] font-bold flex items-start gap-3">
                    <span className="text-emerald-500">[✓]</span> RECOVERY PROTOCOLS DISPATCHED. CHECK INBOX.
                  </div>
                )}

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 font-impact text-xl uppercase tracking-[0.1em] border transition-all flex items-center justify-center gap-3 relative group overflow-hidden ${loading
                    ? 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                    : mode === 'signup'
                      ? 'bg-white text-black border-white hover:bg-zinc-200'
                      : 'bg-hard-gold text-black border-hard-gold hover:bg-hard-gold/90'
                    }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-zinc-600 animate-bounce"></div>
                      <div className="w-2 h-2 bg-zinc-600 animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-zinc-600 animate-bounce delay-150"></div>
                    </div>
                  ) : (
                    <>
                      <span className="relative z-10">{mode === 'signup' ? 'Initiate System' : mode === 'signin' ? 'Establish Uplink' : 'Dispatch Link'}</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" />
                      
                      {/* Button Hover Glow Effect */}
                      {!loading && (
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                      )}
                    </>
                  )}
                </button>
              </form>

              {/* Auxiliary Controls */}
              {mode === 'signin' && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => switchMode('reset')}
                    className="text-zinc-600 hover:text-hard-gold text-[9px] font-bold uppercase tracking-[0.3em] transition-colors py-2 px-4"
                  >
                    Forgot Security Keyphrase?
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Compliance Footer */}
          <div className="mt-8 text-center">
            <p className="text-zinc-700 text-[9px] font-bold uppercase tracking-[0.2em] leading-relaxed">
              By accessing this interface, you acknowledge and agree to <br /> 
              <span className="text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors underline decoration-zinc-800">system protocols</span> & <span className="text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors underline decoration-zinc-800">privacy standards</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
