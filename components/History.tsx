import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, Zap, ChevronRight, Trash2, AlertCircle, RefreshCw, Ghost, X, Image, ArrowLeft, Archive, Search, Filter, Shield, Target } from 'lucide-react';
import { getSessions, deleteSession, Session, SessionsResponse } from '../services/dbService';
import { ModuleHeader } from './ModuleHeader';

interface HistoryProps {
  firebaseUid?: string;
  onSelectSession?: (session: Session) => void;
  onBack?: () => void;
}

// Session Detail View Component
const SessionDetail: React.FC<{ session: Session; onBack: () => void }> = ({ session, onBack }) => {
  const parsedResult = session.parsedResult;

  const screenshots = parsedResult?.request?.screenshots || parsedResult?.screenshots || [];
  const vibeCheck = parsedResult?.vibeCheck || parsedResult?.response?.vibeCheck;
  const suggestions = parsedResult?.suggestions || parsedResult?.response?.suggestions;
  const history = parsedResult?.history || [];
  const analysis = parsedResult?.analysis;
  const theirMessage = parsedResult?.request?.theirMessage;

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  return (
    <div className="h-full flex flex-col font-sans select-none">
      <div className="bg-matte-grain"></div>
      {/* MODULE HEADER - DETAIL */}
      <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title={session.headline || session.persona_name || 'Session Detail'} 
          mode={session.mode === 'quick' ? 'Message Analysis' : 'Practice Session'} 
          onBack={() => handleAction(onBack)}
          accentColor={session.mode === 'quick' ? 'blue' : 'gold'}
          statusLabel="Status"
          statusValue="Archived"
          statusColor="gold"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 scrollbar-hide relative z-10 custom-scrollbar">
        {/* Screenshots Section */}
        {screenshots.length > 0 && (
          <div className="bg-white/5 border border-white/5 p-8 rounded-[32px] shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-8 opacity-60">
              <Image className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Visual Data</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {screenshots.map((screenshot: string, idx: number) => (
                <div key={idx} className="aspect-[9/16] bg-black/20 rounded-2xl overflow-hidden group shadow-lg">
                  <img
                    src={screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`}
                    alt=""
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Their Message */}
        {theirMessage && (
          <div className="bg-white/5 border border-white/5 p-8 rounded-[32px] shadow-xl relative overflow-hidden">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-6 px-1">Original Message</div>
            <div className="bg-white text-black p-8 rounded-2xl font-bold text-base leading-relaxed shadow-inner">
               "{theirMessage}"
            </div>
          </div>
        )}

        {/* Vibe Check Analysis */}
        {vibeCheck && (
          <div className="bg-white/5 border border-white/5 p-8 rounded-[32px] shadow-xl relative overflow-hidden">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-10 px-1">Linguistic Analysis</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
              <div className="p-6 bg-white/5 rounded-2xl text-center shadow-lg border border-white/5">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Energy</div>
                <div className="text-white font-bold text-2xl uppercase tracking-tight tabular-nums">{vibeCheck.theirEnergy || 'N/A'}</div>
              </div>
              <div className="p-6 bg-white/5 rounded-2xl text-center shadow-lg border border-white/5">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Interest</div>
                <div className="text-blue-400 font-bold text-2xl tracking-tight tabular-nums">{vibeCheck.interestLevel ?? '0'}%</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {vibeCheck.greenFlags?.length > 0 && (
                 <div className="space-y-4">
                   <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-1">Strengths</div>
                   <div className="flex flex-wrap gap-2">
                     {vibeCheck.greenFlags.map((flag: string, i: number) => (
                       <span key={i} className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl">{flag}</span>
                     ))}
                   </div>
                 </div>
               )}
               {vibeCheck.redFlags?.length > 0 && (
                 <div className="space-y-4">
                   <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-1">Concerns</div>
                   <div className="flex flex-wrap gap-2">
                     {vibeCheck.redFlags.map((flag: string, i: number) => (
                       <span key={i} className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl">{flag}</span>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions && (
          <div className="bg-white/5 border border-white/5 p-8 rounded-[32px] shadow-xl relative overflow-hidden">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-10 px-1">Suggested Directions</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'Standard', color: 'text-zinc-400', border: 'border-white/10', content: suggestions.smooth },
                { label: 'Direct', color: 'text-blue-400', border: 'border-blue-500/20', content: suggestions.bold },
                { label: 'Personalized', color: 'text-amber-400', border: 'border-amber-500/20', content: suggestions.authentic }
              ].filter(s => s.content).map((s, i) => (
                <div key={i} className={`p-8 bg-white/5 border ${s.border} rounded-[32px] shadow-lg group`}>
                  <div className={`text-[9px] font-bold ${s.color} uppercase tracking-widest mb-6 border-b border-white/5 pb-3`}>{s.label}</div>
                  <p className="text-sm font-bold text-white leading-relaxed italic opacity-90">
                    "{Array.isArray(s.content) ? s.content[0] : s.content}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History / Simulation Logs */}
        {history.length > 0 && (
          <div className="bg-white/5 border border-white/5 p-8 rounded-[32px] shadow-xl relative overflow-hidden">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-10 px-1">Interaction Log</div>
            <div className="space-y-12">
              {history.map((turn: any, idx: number) => (
                <div key={idx} className="space-y-8">
                  <div className="flex flex-col items-end">
                    <div className="max-w-[90%] bg-white text-black p-6 rounded-2xl rounded-br-none shadow-xl font-bold text-sm">
                      <div className="text-[8px] font-bold text-zinc-400 mb-2 border-b border-black/5 pb-1">You</div>
                      {turn.draft}
                    </div>
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="max-w-[90%] bg-white/5 border border-white/5 p-6 rounded-2xl rounded-bl-none shadow-xl font-bold text-sm italic text-zinc-300">
                      <div className="text-[8px] font-bold text-zinc-600 mb-2 border-b border-white/5 pb-1">Assistant</div>
                      {turn.result?.predictedReply}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Analysis */}
        {analysis && (
          <div className="bg-white/5 border border-white/5 p-8 rounded-[32px] shadow-xl relative overflow-hidden">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-12 px-1">Summary Metrics</div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {[
                { label: 'Ghost Risk', value: analysis.ghostRisk, color: analysis.ghostRisk > 70 ? 'text-red-400' : analysis.ghostRisk > 40 ? 'text-amber-400' : 'text-emerald-400' },
                { label: 'Vibe Match', value: analysis.vibeMatch, color: 'text-blue-400' },
                { label: 'Balance', value: analysis.effortBalance, color: 'text-amber-400' }
              ].map((m, i) => (
                <div key={i} className="p-8 bg-white/5 border border-white/5 rounded-2xl text-center shadow-lg">
                  <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4">{m.label}</div>
                  <div className={`text-5xl font-black ${m.color} tracking-tighter tabular-nums`}>{m.value}%</div>
                </div>
              ))}
            </div>

            {analysis.headline && (
              <div className="bg-black/40 border border-white/5 p-10 mb-10 rounded-3xl text-center">
                 <h4 className="text-3xl font-black text-white uppercase tracking-tight leading-none">
                   {analysis.headline}
                 </h4>
              </div>
            )}

            {analysis.insights?.length > 0 && (
              <div className="space-y-6 px-4">
                {analysis.insights.map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-5 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2"></div>
                    <p className="text-sm font-bold text-zinc-400 uppercase tracking-wide group-hover:text-white transition-colors">{insight}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const History: React.FC<HistoryProps> = ({ firebaseUid, onSelectSession, onBack }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, hasMore: false, offset: 0 });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'quick' | 'simulator'>('all');

  const fetchSessions = async (offset = 0) => {
    if (!firebaseUid) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getSessions(firebaseUid, 20, offset);
      if (offset === 0) {
        setSessions(response.sessions);
      } else {
        setSessions(prev => [...prev, ...response.sessions]);
      }
      setPagination({
        total: response.pagination.total,
        hasMore: response.pagination.hasMore,
        offset: response.pagination.offset + response.pagination.limit,
      });
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setError('Failed to sync history from cloud storage.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(0);
  }, [firebaseUid]);

  const handleAction = (action: () => void, vibration = 5) => {
    if ('vibrate' in navigator) navigator.vibrate(vibration);
    action();
  };

  const handleDelete = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this record forever?')) return;

    handleAction(() => setDeletingId(sessionId), 20);
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (err) {
      console.error('Failed to delete session:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) return 'JUST NOW';
    if (diffHours < 24) return `${Math.floor(diffHours)}H AGO`;
    if (diffDays < 7) return `${Math.floor(diffDays)}D AGO`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  if (!firebaseUid) {
    return (
      <div className="w-full h-full flex flex-col bg-matte-base relative font-sans overflow-hidden">
        <div className="bg-matte-grain"></div>
        <div className="flex-1 flex items-center justify-center p-8 text-center relative z-10">
          <div className="bg-white/5 border border-white/5 p-16 rounded-[40px] shadow-2xl relative">
            <Shield className="w-20 h-20 text-zinc-800 mx-auto mb-10" />
            <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tight">Identity Required</h3>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Sign in to access your archived sessions.</p>
          </div>
        </div>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <div className="w-full h-full flex flex-col relative pb-20 md:pb-0 bg-matte-base overflow-hidden">
        <SessionDetail session={selectedSession} onBack={() => handleAction(() => setSelectedSession(null))} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative pb-20 md:pb-0 overflow-hidden bg-matte-base font-sans select-none">
      <div className="bg-matte-grain"></div>

      {/* MODULE HEADER - LIST */}
      <div className="px-8 pt-10 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="Session History" 
          mode="Archives" 
          onBack={() => handleAction(onBack || (() => {}))}
          accentColor="gold"
          statusLabel="Total Records"
          statusValue={`${pagination.total} Sessions`}
          statusColor="gold"
        />
      </div>

      {/* SEARCH & FILTERS */}
      <div className="px-8 py-8 space-y-8 shrink-0 relative z-10 border-b border-white/5 bg-black/20">
        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-zinc-700 group-focus-within:text-white transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search your history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/5 py-5 pl-14 pr-8 text-sm font-bold text-white placeholder:text-zinc-800 focus:outline-none focus:border-white/10 transition-all rounded-2xl shadow-xl"
          />
        </div>
        
        <div className="flex flex-wrap gap-4">
          {(['all', 'quick', 'simulator'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => handleAction(() => setActiveFilter(filter), 2)}
              className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest border transition-all rounded-xl shadow-lg ${
                activeFilter === filter
                ? 'bg-white text-black border-white'
                : 'bg-white/5 border-white/5 text-zinc-600 hover:text-zinc-300 hover:border-white/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-transparent relative z-10 custom-scrollbar p-8 md:p-12">
        {error && (
          <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center gap-4">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{error}</span>
          </div>
        )}

        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center p-24">
            <div className="text-center space-y-8">
              <RefreshCw className="w-12 h-12 text-zinc-800 mx-auto animate-spin" />
              <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest animate-pulse">Syncing Cloud Archive</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center p-24 opacity-20">
            <div className="text-center space-y-10">
              <Archive className="w-24 h-24 text-zinc-800 mx-auto" />
              <div className="space-y-3">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tight">Archive Empty</h3>
                 <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">No previous sessions detected in your account.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
            {sessions
              .filter(s => {
                const matchesFilter = activeFilter === 'all' || s.mode === activeFilter;
                const matchesSearch = !searchQuery || 
                  (s.headline?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                  (s.persona_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                  (s.parsedResult?.headline?.toLowerCase() || '').includes(searchQuery.toLowerCase());
                return matchesFilter && matchesSearch;
              })
              .map((session) => {
                const parsedResult = session.parsedResult;

              const headline = session.headline || parsedResult?.headline || parsedResult?.vibeCheck?.theirEnergy || 'Unnamed Session';
              const ghostRisk = session.ghost_risk || parsedResult?.ghostRisk || parsedResult?.vibeCheck?.interestLevel;
              const messageCount = session.message_count || parsedResult?.history?.length || 0;
              const screenshots = parsedResult?.request?.screenshots || parsedResult?.screenshots || [];

              return (
                <div
                  key={session.id}
                  onClick={() => handleAction(() => {
                    setSelectedSession(session);
                    onSelectSession?.(session);
                  }, 10)}
                  className={`group relative bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col h-full rounded-[32px] shadow-2xl overflow-hidden active:scale-[0.98]`}
                >
                  {/* Visual Preview */}
                  <div className="aspect-[16/9] bg-black/40 overflow-hidden relative border-b border-white/5">
                    {screenshots.length > 0 ? (
                      <img
                        src={screenshots[0].startsWith('data:') ? screenshots[0] : `data:image/png;base64,${screenshots[0]}`}
                        alt=""
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-10">
                        {session.mode === 'quick' ? (
                          <Zap className="w-16 h-16 text-white" />
                        ) : (
                          <MessageSquare className="w-16 h-16 text-white" />
                        )}
                      </div>
                    )}
                    
                    {/* Status Overlays */}
                    <div className="absolute top-5 left-5">
                      <div className={`px-3 py-1 text-[8px] font-bold border rounded-lg shadow-lg ${
                        session.mode === 'quick' 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>
                        {session.mode === 'quick' ? 'SCAN' : 'PRACTICE'}
                      </div>
                    </div>
                    
                    {ghostRisk !== undefined && (
                      <div className={`absolute top-5 right-5 px-3 py-1 text-[8px] font-bold border rounded-lg shadow-lg ${
                        ghostRisk > 70 ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        ghostRisk > 40 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        RISK {ghostRisk}%
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-8 flex flex-col flex-1 relative">
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight mb-2 line-clamp-1 group-hover:text-blue-400 transition-colors">
                      {headline}
                    </h3>
                    
                    <div className="flex-1 mt-2">
                      {session.persona_name && (
                        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                          <Target className="w-3 h-3" />
                          <span>With {session.persona_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/5">
                      <div className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest tabular-nums">
                        {formatDate(session.created_at)}
                      </div>
                      <div className="flex items-center gap-4">
                        {messageCount > 0 && (
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-lg">
                            {messageCount} MSG
                          </div>
                        )}
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          disabled={deletingId === session.id}
                          className="text-zinc-700 hover:text-red-500 transition-all p-2 bg-white/5 rounded-full hover:bg-red-500/10 shadow-lg active:scale-90"
                          title="Delete session"
                        >
                          {deletingId === session.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load More */}
            {pagination.hasMore && (
              <div className="col-span-full pt-16 flex justify-center">
                <button
                  onClick={() => handleAction(() => fetchSessions(pagination.offset), 10)}
                  disabled={loading}
                  className="px-16 py-5 bg-white/5 border border-white/5 hover:border-white/10 text-xs font-bold text-zinc-500 hover:text-white transition-all rounded-3xl shadow-2xl active:scale-[0.98] min-w-[280px] group"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Syncing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                       <span>Load Older Records</span>
                       <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
