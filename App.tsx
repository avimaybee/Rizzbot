import React, { useState, useRef } from 'react';
import { analyzeGhosting } from './services/geminiService';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultCard } from './components/ResultCard';
import { AppState, GhostResult } from './types';

function App() {
  const [state, setState] = useState<AppState>('landing');
  const [mode, setMode] = useState<'text' | 'screenshot'>('screenshot');
  
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [lastMessage, setLastMessage] = useState('');
  
  // Changed to arrays for multiple files
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  
  const [result, setResult] = useState<GhostResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Convert FileList to Array
      const fileArray = Array.from(files);
      
      fileArray.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          
          setPreviewUrls(prev => [...prev, base64String]);
          setScreenshots(prev => [...prev, base64Data]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeScreenshot = (index: number) => {
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation: Name/City required ONLY if not using screenshots
    if (mode === 'text' && !name) return;
    if (mode === 'screenshot' && screenshots.length === 0) return;
    if (mode === 'text' && !lastMessage) return;

    setState('loading');
    
    try {
      // Minimum 2s wait for "effect"
      const [_, data] = await Promise.all([
        new Promise(resolve => setTimeout(resolve, 3000)),
        analyzeGhosting(name, city, lastMessage, mode === 'screenshot' ? screenshots : undefined)
      ]);
      setResult(data);
      setState('results');
    } catch (error) {
      console.error(error);
      setState('error');
    }
  };

  const resetApp = () => {
    setState('landing');
    setResult(null);
    setScreenshots([]);
    setPreviewUrls([]);
    setLastMessage('');
    setName('');
    setCity('');
  };

  const hasScreenshots = mode === 'screenshot' && screenshots.length > 0;

  return (
    <div className="min-h-screen bg-grain bg-hard-black text-white font-mono selection:bg-hard-gold selection:text-black">
      
      {/* HEADER / HUD */}
      <header className="fixed top-0 left-0 w-full z-40 border-b-4 border-white bg-black p-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-hard-red animate-pulse"></div>
          <h1 className="text-2xl font-impact tracking-wide text-white">THE BLOCK v3.0</h1>
        </div>
        <div className="font-mono text-xs md:text-sm text-hard-gold hidden md:block">
          CONNECTED: 127.0.0.1 // SECURE
        </div>
      </header>

      <main className="pt-20 pb-10 px-4 min-h-screen flex flex-col items-center justify-center relative">
        
        {state === 'loading' && <LoadingScreen />}

        {state === 'results' && result && (
          <ResultCard 
            result={result} 
            onReset={resetApp} 
            targetName={result.identifiedName || name || "UNKNOWN"} 
          />
        )}

        {state === 'error' && (
           <div className="bg-red-900 border-4 border-red-500 p-8 text-center max-w-lg shadow-[8px_8px_0_#ff0000]">
             <h2 className="text-4xl font-impact mb-4">SYSTEM CRASH</h2>
             <p className="font-mono mb-6">THE STREETS ARE TOO BUSY. TRY AGAIN.</p>
             <button onClick={resetApp} className="bg-white text-black font-bold py-2 px-6 hover:bg-gray-200">RESET</button>
           </div>
        )}

        {state === 'landing' && (
          <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
            
            {/* HERO TEXT (LEFT) */}
            <div className="text-left space-y-4">
              <div className="inline-block bg-hard-gold text-black px-2 font-bold transform -rotate-2 border border-black shadow-sm">
                REALITY CHECK TOOL
              </div>
              <h2 className="text-6xl md:text-8xl font-impact text-white leading-[0.85] text-outline drop-shadow-[8px_8px_0_rgba(255,51,51,1)]">
                DEAD<br/>OR<br/>GHOSTING
              </h2>
              <p className="text-hard-concrete text-xl md:text-2xl font-bold max-w-md">
                Finally know if they're actually deceased or just playing you.
              </p>
              
              <div className="flex gap-4 pt-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-black shadow-hard-blue text-2xl animate-bounce" style={{ animationDelay: '0s' }}>💀</div>
                <div className="w-16 h-16 bg-hard-gold rounded-full flex items-center justify-center border-4 border-black shadow-hard text-2xl animate-bounce" style={{ animationDelay: '0.1s' }}>💰</div>
                <div className="w-16 h-16 bg-hard-blue rounded-full flex items-center justify-center border-4 border-black shadow-hard-red text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>🧢</div>
              </div>
            </div>

            {/* INTERACTION PANEL (RIGHT) */}
            <div className="bg-hard-gray border-4 border-white shadow-hard relative group">
              <div className="bg-white text-black p-2 font-impact text-xl border-b-4 border-black flex justify-between">
                <span>NEW ANALYSIS</span>
                <span className="animate-pulse">▼</span>
              </div>
              
              <div className="p-6">
                {/* TABS */}
                <div className="flex border-4 border-black mb-6 bg-black">
                  <button 
                    onClick={() => setMode('screenshot')}
                    className={`flex-1 py-3 font-impact text-xl transition-all ${mode === 'screenshot' ? 'bg-hard-gold text-black' : 'text-zinc-500 hover:text-white'}`}
                  >
                    SCREENSHOTS
                  </button>
                  <button 
                    onClick={() => setMode('text')}
                    className={`flex-1 py-3 font-impact text-xl transition-all ${mode === 'text' ? 'bg-hard-red text-black' : 'text-zinc-500 hover:text-white'}`}
                  >
                    PASTE TEXT
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {mode === 'screenshot' ? (
                    <div className="space-y-2">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-4 border-dashed border-zinc-600 bg-black min-h-[120px] p-4 flex flex-col items-center justify-center cursor-pointer hover:border-hard-gold transition-colors group/upload relative overflow-hidden"
                      >
                         {/* Stripe animation overlay */}
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,215,0,0.05)_25%,rgba(255,215,0,0.05)_50%,transparent_50%,transparent_75%,rgba(255,215,0,0.05)_75%,rgba(255,215,0,0.05)_100%)] bg-[size:20px_20px] opacity-0 group-hover/upload:opacity-100 transition-opacity pointer-events-none animate-[scan_1s_linear_infinite]"></div>
                        
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*"
                          ref={fileInputRef}
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        <span className="text-4xl mb-2 group-hover/upload:scale-110 transition-transform">📂</span>
                        <span className="font-impact text-xl text-zinc-400 group-hover/upload:text-white uppercase">CLICK TO UPLOAD EVIDENCE</span>
                        <span className="font-mono text-xs text-zinc-500">(Supports multiple screenshots)</span>
                      </div>
                      
                      {/* PREVIEW GRID */}
                      {previewUrls.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {previewUrls.map((url, idx) => (
                            <div key={idx} className="relative aspect-square border-2 border-zinc-700 group/img">
                              <img src={url} alt="Preview" className="w-full h-full object-cover opacity-70 group-hover/img:opacity-100 transition-opacity" />
                              <button 
                                type="button"
                                onClick={() => removeScreenshot(idx)} 
                                className="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 flex items-center justify-center font-bold hover:bg-red-500 z-10"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                       <label className="text-sm text-zinc-400 font-bold mb-1 block tracking-wider">CONTEXT / LAST MESSAGE</label>
                      <textarea
                        required
                        placeholder='EX: "I said: I love you. They said: K."'
                        className="w-full bg-black border-2 border-zinc-500 p-3 text-white focus:border-hard-red focus:outline-none min-h-[120px] placeholder-zinc-600 font-mono text-sm"
                        value={lastMessage}
                        onChange={e => setLastMessage(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-hard-gold font-bold mb-1 block tracking-wider drop-shadow-md">
                        THEIR NAME {hasScreenshots && <span className="text-white text-[10px] ml-1 opacity-70">(AUTO-DETECT)</span>}
                      </label>
                      <input 
                        type="text" 
                        required={!hasScreenshots}
                        placeholder={hasScreenshots ? "AI WILL DETECT..." : "EX: ADITYA"}
                        className={`w-full bg-black border-2 p-3 text-white focus:outline-none uppercase font-bold transition-colors ${hasScreenshots ? 'border-hard-gold/50 placeholder-hard-gold/50' : 'border-zinc-500 focus:border-hard-gold placeholder-zinc-600'}`}
                        value={name}
                        onChange={e => setName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-hard-blue font-bold mb-1 block tracking-wider drop-shadow-md">
                        THEIR CITY {hasScreenshots && <span className="text-white text-[10px] ml-1 opacity-70">(AUTO-DETECT)</span>}
                      </label>
                      <input 
                        type="text" 
                        required={!hasScreenshots}
                        placeholder={hasScreenshots ? "AI WILL DETECT..." : "EX: MUMBAI"}
                        className={`w-full bg-black border-2 p-3 text-white focus:outline-none uppercase font-bold transition-colors ${hasScreenshots ? 'border-hard-blue/50 placeholder-hard-blue/50' : 'border-zinc-500 focus:border-hard-blue placeholder-zinc-600'}`}
                        value={city}
                        onChange={e => setCity(e.target.value)}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-white text-black font-impact text-3xl py-4 border-4 border-transparent hover:border-black hover:bg-hard-gold transition-all shadow-hard-white uppercase mt-4 active:translate-y-1 active:shadow-none"
                  >
                    START ANALYSIS
                  </button>
                </form>
              </div>
              
              {/* Decorative corners */}
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-black"></div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-black"></div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-black"></div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-black"></div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 w-full text-center p-2 text-[10px] md:text-xs text-zinc-600 font-mono uppercase bg-black border-t border-zinc-900 z-30">
        DEAD OR GHOSTING © 2024 // FOR ENTERTAINMENT PURPOSES ONLY // DON'T TEXT YOUR EX
      </footer>
    </div>
  );
}

export default App;