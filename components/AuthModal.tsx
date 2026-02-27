import React, { useState } from 'react';
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  resetPassword,
} from '../services/firebaseService';
import { Sparkles, ArrowRight, Lock, Mail, User } from 'lucide-react';

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
        setError("Account not found. Please verify your email.");
      } else if (errorCode === 'auth/wrong-password') {
        setError("Incorrect password. Please try again.");
      } else if (errorCode === 'auth/email-already-in-use') {
        setError("This email is already registered. Please sign in.");
      } else if (errorCode === 'auth/weak-password') {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (errorCode === 'auth/invalid-email') {
        setError("Invalid email format.");
      } else if (errorCode === 'auth/too-many-requests') {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "An error occurred. Please try again.");
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
      setError(err.message || "Failed to sign in with Google.");
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
    <div className="min-h-[100dvh] bg-matte-base flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-hard-gold/5 via-transparent to-hard-blue/5 opacity-30"></div>

      <div className="w-full max-w-5xl relative z-10 grid md:grid-cols-2 gap-12 items-center">

        {/* Left Column: Professional Branding */}
        <div className="hidden md:flex flex-col justify-center h-full p-12">
          <div className="max-w-sm">
            <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-8">
              <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Secure AI Advisor</span>
            </div>
            
            <h1 className="text-7xl font-black text-white uppercase tracking-tighter mb-8 leading-none">
              RIZZ<br /><span className="text-zinc-500">BOT</span>
            </h1>
            
            <div className="space-y-8">
              <p className="text-zinc-400 text-sm leading-relaxed tracking-wide">
                Refine your digital presence with AI-powered linguistic analysis and real-time conversation feedback.
              </p>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-white font-bold text-xs uppercase mb-2">Privacy</div>
                  <p className="text-zinc-500 text-[11px] leading-snug">End-to-end encrypted processing for all your interactions.</p>
                </div>
                <div>
                  <div className="text-white font-bold text-xs uppercase mb-2">Precision</div>
                  <p className="text-zinc-500 text-[11px] leading-snug">Advanced pattern recognition for optimal social outcomes.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Auth Hub */}
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Header */}
          <div className="md:hidden text-center mb-10">
            <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-2">
              RIZZBOT
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">AI Messaging Assistant</p>
          </div>

          <div className="glass-dark relative shadow-2xl border-white/5 overflow-hidden rounded-3xl">
            <div className="p-8 sm:p-12">
              {/* Mode Selector */}
              {mode !== 'reset' && (
                <div className="flex mb-10 bg-black/20 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => switchMode('signin')}
                    className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-lg ${mode === 'signin'
                      ? 'bg-zinc-800 text-white shadow-lg'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => switchMode('signup')}
                    className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-lg ${mode === 'signup'
                      ? 'bg-zinc-800 text-white shadow-lg'
                      : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Reset Mode Header */}
              {mode === 'reset' && (
                <div className="mb-10">
                  <button
                    onClick={() => switchMode('signin')}
                    className="text-zinc-500 hover:text-white text-xs font-bold flex items-center gap-2 mb-6 transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                  <h2 className="text-white font-bold text-2xl mb-2">Reset Password</h2>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Enter your email address to receive a recovery link.
                  </p>
                </div>
              )}

              {/* Google Integration */}
              {mode !== 'reset' && (
                <>
                  <button
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 px-4 rounded-xl transition-all disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="text-xs">Continue with Google</span>
                  </button>

                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-4 bg-[#050505] text-zinc-600 text-[10px] font-bold">OR</span>
                    </div>
                  </div>
                </>
              )}

              {/* Main Auth Form */}
              <form onSubmit={handleEmailAuth} className="space-y-6">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label htmlFor="displayName" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full bg-white/5 border border-white/5 focus:border-white/20 rounded-xl px-4 py-4 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full bg-white/5 border border-white/5 focus:border-white/20 rounded-xl px-4 py-4 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all"
                  />
                </div>

                {mode !== 'reset' && (
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      minLength={6}
                      className="w-full bg-white/5 border border-white/5 focus:border-white/20 rounded-xl px-4 py-4 text-sm text-white placeholder-zinc-700 focus:outline-none transition-all"
                    />
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-red-400 text-[11px] font-medium flex items-center gap-2">
                    <span className="shrink-0">✕</span> {error}
                  </div>
                )}

                {resetSent && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl text-emerald-400 text-[11px] font-medium flex items-center gap-2">
                    <span>✓</span> Check your inbox for the reset link.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-white text-black font-bold text-sm rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce delay-150"></div>
                    </div>
                  ) : (
                    <>
                      <span>{mode === 'signup' ? 'Create Account' : mode === 'signin' ? 'Sign In' : 'Send Reset Link'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>

              {mode === 'signin' && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => switchMode('reset')}
                    className="text-zinc-600 hover:text-white text-[11px] font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 text-center px-6">
            <p className="text-zinc-600 text-[10px] leading-relaxed">
              By continuing, you agree to our <span className="text-zinc-500 underline cursor-pointer">Terms of Service</span> and <span className="text-zinc-500 underline cursor-pointer">Privacy Policy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
