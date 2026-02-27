import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, Zap, ChevronRight, Trash2, AlertCircle, RefreshCw, Ghost, X, Image, ArrowLeft, Archive, Search, Filter, Shield } from 'lucide-react';
import { getSessions, deleteSession, Session, SessionsResponse } from '../services/dbService';
import { ModuleHeader } from './ModuleHeader';
import { CornerNodes } from './CornerNodes';

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
    <div className="h-full flex flex-col font-mono select-none">
      <div className="bg-matte-grain"></div>
      {/* MODULE HEADER - DETAIL */}
      <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title={session.headline || session.persona_name || 'ARCHIVED_DATA_NODE'} 
          mode={session.mode === 'quick' ? 'SCAN_REPORT' : 'SIM_DEBRIEF'} 
          id={session.id.toString().toUpperCase()}
          onBack={() => handleAction(onBack)}
          accentColor={session.mode === 'quick' ? 'blue' : 'gold'}
          statusLabel="RECORD_STATUS"
          statusValue="READ_ONLY"
          statusColor="gold"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 scrollbar-hide relative z-10 custom-scrollbar">
        {/* Screenshots Section */}
        {screenshots.length > 0 && (
          <div className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-hard-blue opacity-30"></div>
            <div className="flex items-center gap-3 mb-6 px-1">
              <Image className="w-4 h-4 text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Visual_Evidence_Buffer</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {screenshots.map((screenshot: string, idx: number) => (
                <div key={idx} className="aspect-[9/16] glass-zinc border-white/5 overflow-hidden soft-edge group shadow-lg">
                  <img
                    src={screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`}
                    alt=""
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Their Message */}
        {theirMessage && (
          <div className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-700 opacity-30"></div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4 px-1">Incoming_Transmission</div>
            <div className="bg-white text-black p-6 soft-edge font-bold text-sm uppercase tracking-tight shadow-inner">
               "{theirMessage}"
            </div>
          </div>
        )}

        {/* Vibe Check Analysis */}
        {vibeCheck && (
          <div className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-hard-blue opacity-30"></div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-8 px-1">Linguistic_Deconstruction</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
              <div className="p-5 glass-zinc border-white/5 soft-edge text-center shadow-lg">
                <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-2">ENERGY_LEVEL</div>
                <div className="text-white font-impact text-xl tracking-wider">{vibeCheck.theirEnergy || 'UNKNOWN'}</div>
              </div>
              <div className="p-5 glass-zinc border-white/5 soft-edge text-center shadow-lg">
                <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mb-2">INTEREST_COEFF</div>
                <div className="text-hard-blue font-impact text-xl tracking-wider">{vibeCheck.interestLevel ?? '0'}%</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {vibeCheck.greenFlags?.length > 0 && (
                 <div className="space-y-4">
                   <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest px-1">POS_MARKERS [+]</div>
                   <div className="flex flex-wrap gap-2">
                     {vibeCheck.greenFlags.map((flag: string, i: number) => (
                       <span key={i} className="px-3 py-1.5 glass-zinc border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider soft-edge">{flag}</span>
                     ))}
                   </div>
                 </div>
               )}
               {vibeCheck.redFlags?.length > 0 && (
                 <div className="space-y-4">
                   <div className="text-[10px] font-bold text-hard-red uppercase tracking-widest px-1">NEG_MARKERS [-]</div>
                   <div className="flex flex-wrap gap-2">
                     {vibeCheck.redFlags.map((flag: string, i: number) => (
                       <span key={i} className="px-3 py-1.5 glass-zinc border-hard-red/20 text-hard-red text-[10px] font-bold uppercase tracking-wider soft-edge">{flag}</span>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions && (
          <div className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-hard-gold opacity-30"></div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-8 px-1">Tactical_Options_Archive</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'SAFE_PATH', color: 'text-zinc-400', border: 'border-white/10', content: suggestions.smooth },
                { label: 'BOLD_DIRECTIVE', color: 'text-hard-blue', border: 'border-hard-blue/20', content: suggestions.bold },
                { label: 'AUTO_PROFILE', color: 'text-hard-gold', border: 'border-hard-gold/20', content: suggestions.authentic }
              ].filter(s => s.content).map((s, i) => (
                <div key={i} className={`p-6 glass-zinc border ${s.border} soft-edge shadow-lg group`}>
                  <div className={`text-[9px] font-bold ${s.color} uppercase tracking-widest mb-4 border-b border-white/5 pb-2`}>{s.label}</div>
                  <p className="text-xs font-bold text-white leading-relaxed uppercase tracking-tight italic">
                    "{Array.isArray(s.content) ? s.content[0] : s.content}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History / Simulation Logs */}
        {history.length > 0 && (
          <div className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-hard-blue opacity-30"></div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-8 px-1">Simulation_Interaction_Logs</div>
            <div className="space-y-10">
              {history.map((turn: any, idx: number) => (
                <div key={idx} className="space-y-6">
                  <div className="flex flex-col items-end">
                    <div className="max-w-[90%] bg-white text-black p-5 soft-edge shadow-xl font-bold uppercase tracking-tight text-xs">
                      <div className="text-[8px] font-bold text-zinc-400 mb-2 border-b border-black/5 pb-1">UPLINK_ORIGIN</div>
                      {turn.draft}
                    </div>
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="max-w-[90%] glass-zinc border-white/5 p-5 soft-edge shadow-xl font-bold uppercase tracking-tight text-xs italic text-zinc-300">
                      <div className="text-[8px] font-bold text-zinc-600 mb-2 border-b border-white/5 pb-1">PREDICTED_ECHO</div>
                      {turn.result?.predictedReply}
                    </div>
                  </div>
                  {idx < history.length - 1 && <div className="h-px w-full bg-zinc-900 mx-auto"></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Analysis */}
        {analysis && (
          <div className="glass-dark border-white/5 p-6 md:p-8 soft-edge shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-hard-red opacity-30"></div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-10 px-1">Final_Operational_Metrics</div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {[
                { label: 'GHOST_RISK', value: analysis.ghostRisk, color: analysis.ghostRisk > 70 ? 'text-hard-red' : analysis.ghostRisk > 40 ? 'text-hard-gold' : 'text-emerald-400' },
                { label: 'VIBE_COEFF', value: analysis.vibeMatch, color: 'text-hard-blue' },
                { label: 'EFFORT_EQUIL', value: analysis.effortBalance, color: 'text-hard-gold' }
              ].map((m, i) => (
                <div key={i} className="p-6 glass-zinc border-white/5 soft-edge text-center shadow-lg">
                  <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4">{m.label}</div>
                  <div className={`font-impact text-5xl ${m.color} tracking-tighter`}>{m.value}%</div>
                </div>
              ))}
            </div>

            {analysis.headline && (
              <div className="bg-black/40 border border-white/5 p-8 mb-8 soft-edge relative overflow-hidden text-center group">
                 <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none"></div>
                 <h4 className="font-impact text-2xl md:text-4xl text-white uppercase tracking-tighter leading-none group-hover:scale-105 transition-transform duration-700">
                   {analysis.headline}
                 </h4>
              </div>
            )}

            {analysis.insights?.length > 0 && (
              <div className="space-y-4 px-2">
                {analysis.insights.map((insight: string, i: number) => (
                  <div key={i} className="flex items-start gap-4 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-hard-gold mt-1.5 animate-pulse"></div>
                    <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">{insight}</p>
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
      setError('DATA_NODE_FETCH_FAILURE: ACCESS_DENIED');
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
    if (!confirm('TERMINATE_DATA_RECORD? This action is non-recoverable.')) return;

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

    if (diffHours < 1) return 'JUST_NOW';
    if (diffHours < 24) return `${Math.floor(diffHours)}H_AGO`;
    if (diffDays < 7) return `${Math.floor(diffDays)}D_AGO`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase().replace(' ', '_');
  };

  if (!firebaseUid) {
    return (
      <div className="w-full h-full flex flex-col bg-matte-base relative font-mono overflow-hidden">
        <div className="bg-matte-grain"></div>
        <div className="flex-1 flex items-center justify-center p-8 text-center relative z-10">
          <div className="glass-dark border-white/5 p-12 soft-edge shadow-2xl relative">
            <CornerNodes className="opacity-20" />
            <Shield className="w-20 h-20 text-zinc-800 mx-auto mb-8 animate-pulse" />
            <h3 className="font-impact text-3xl text-white mb-4 uppercase tracking-tighter">Identity_Verification_Required</h3>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em]">Access restricted to authorized operators.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show session detail view if a session is selected
  if (selectedSession) {
    return (
      <div className="w-full h-full flex flex-col relative pb-20 md:pb-0 bg-matte-base overflow-hidden">
        <SessionDetail session={selectedSession} onBack={() => handleAction(() => setSelectedSession(null))} />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative pb-16 md:pb-0 overflow-hidden bg-matte-base font-mono select-none">
      <div className="bg-matte-grain"></div>
      <CornerNodes className="opacity-[0.02]" />

      {/* MODULE HEADER - LIST */}
      <div className="px-6 pt-8 sticky top-0 z-40 bg-matte-base/95 backdrop-blur-md">
        <ModuleHeader 
          title="CENTRAL_DATA_ARCHIVE" 
          mode="QUERY_MODE" 
          onBack={() => handleAction(onBack || (() => {}))}
          accentColor="gold"
          statusLabel="NODE_COUNT"
          statusValue={`${pagination.total} RECORDS`}
          statusColor="gold"
        />
      </div>

      {/* SEARCH & FILTERS */}
      <div className="px-6 py-6 space-y-6 shrink-0 relative z-10 border-b border-white/5 bg-black/20">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="w-3.5 h-3.5 text-zinc-700 group-focus-within:text-hard-gold transition-colors" />
          </div>
          <input
            type="text"
            placeholder="ARCHIVE_SEARCH_QUERY..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-zinc border-white/5 py-4 pl-12 pr-6 text-[11px] font-bold uppercase tracking-widest text-white placeholder:text-zinc-800 focus:outline-none focus:border-white/10 transition-all soft-edge shadow-xl"
          />
        </div>
        
        <div className="flex flex-wrap gap-3">
          {(['all', 'quick', 'simulator'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => handleAction(() => setActiveFilter(filter), 2)}
              className={`px-5 py-2 text-[9px] font-bold uppercase tracking-[0.2em] border transition-all soft-edge shadow-lg ${
                activeFilter === filter
                ? 'border-hard-gold/30 bg-hard-gold/10 text-white'
                : 'glass-zinc border-white/5 text-zinc-600 hover:text-zinc-400 hover:border-white/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-transparent relative z-10 custom-scrollbar p-6 md:p-10">
        {error && (
          <div className="mb-8 p-5 glass-red border-hard-red/20 flex items-center gap-4 soft-edge animate-shake">
            <AlertCircle className="w-5 h-5 text-hard-red flex-shrink-0" />
            <span className="text-[10px] font-bold text-hard-red uppercase tracking-widest">{error}</span>
          </div>
        )}

        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center p-20">
            <div className="text-center space-y-6">
              <RefreshCw className="w-12 h-12 text-zinc-800 mx-auto animate-spin" />
              <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-[0.4em] animate-pulse">Syncing_Records...</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center p-20 opacity-30">
            <div className="text-center space-y-8">
              <Archive className="w-20 h-20 text-zinc-800 mx-auto" />
              <div className="space-y-2">
                 <h3 className="font-impact text-2xl text-white uppercase tracking-tighter">Archive_Empty</h3>
                 <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">No interaction nodes detected in central database.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
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

              const headline = session.headline || parsedResult?.headline || parsedResult?.vibeCheck?.theirEnergy || 'NODE_DATA';
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
                  className={`group relative glass-dark border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col h-full soft-edge shadow-2xl overflow-hidden active:scale-[0.98]`}
                >
                  {/* Visual Preview */}
                  <div className="aspect-[16/9] bg-black overflow-hidden relative border-b border-white/5">
                    {screenshots.length > 0 ? (
                      <img
                        src={screenshots[0].startsWith('data:') ? screenshots[0] : `data:image/png;base64,${screenshots[0]}`}
                        alt=""
                        className="w-full h-full object-cover opacity-40 group-hover:opacity-70 transition-all duration-700 grayscale group-hover:grayscale-0 scale-100 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-[0.05] group-hover:opacity-[0.1] transition-opacity">
                        {session.mode === 'quick' ? (
                          <Zap className="w-16 h-16 text-white" />
                        ) : (
                          <MessageSquare className="w-16 h-16 text-white" />
                        )}
                      </div>
                    )}
                    
                    {/* Status Overlays */}
                    <div className="absolute top-4 left-4">
                      <div className={`px-2.5 py-1 text-[8px] font-bold border soft-edge shadow-lg ${
                        session.mode === 'quick' 
                        ? 'glass-blue border-hard-blue/30 text-hard-blue' 
                        : 'glass-gold border-hard-gold/30 text-hard-gold'
                      }`}>
                        {session.mode === 'quick' ? 'SCAN_LOG' : 'SIM_DATA'}
                      </div>
                    </div>
                    
                    {ghostRisk !== undefined && (
                      <div className={`absolute top-4 right-4 px-2.5 py-1 text-[8px] font-bold border soft-edge shadow-lg ${
                        ghostRisk > 70 ? 'glass-red border-hard-red/30 text-hard-red' :
                        ghostRisk > 40 ? 'glass-gold border-hard-gold/30 text-hard-gold' :
                        'glass-zinc border-white/10 text-emerald-400'
                      }`}>
                        RISK_{ghostRisk}%
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-1 relative">
                    <h3 className="font-impact text-xl text-white uppercase tracking-wider mb-2 line-clamp-1 group-hover:text-hard-gold transition-colors">
                      {headline}
                    </h3>
                    
                    <div className="flex-1 mt-2">
                      {session.persona_name && (
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Target className="w-3 h-3 text-zinc-700" />
                          <span>Target: {session.persona_name}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-8 pt-5 border-t border-white/5">
                      <div className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">
                        {formatDate(session.created_at)}
                      </div>
                      <div className="flex items-center gap-4">
                        {messageCount > 0 && (
                          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded border border-white/5">
                            {messageCount} MSG
                          </div>
                        )}
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          disabled={deletingId === session.id}
                          className="text-zinc-700 hover:text-hard-red transition-all p-1.5 glass-zinc rounded-full border-white/5 shadow-lg active:scale-90"
                          title="Delete session"
                        >
                          {deletingId === session.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
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
              <div className="col-span-full pt-10 pb-20 flex justify-center">
                <button
                  onClick={() => handleAction(() => fetchSessions(pagination.offset), 10)}
                  disabled={loading}
                  className="px-12 py-4 glass-dark border-white/5 hover:border-white/10 text-[10px] font-bold text-zinc-500 hover:text-white transition-all soft-edge shadow-2xl active:scale-[0.98] min-w-[240px] group"
                >
                  {loading ? (
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-4 h-4 animate-spin text-hard-gold" />
                      <span>SYNCING_NEXT_PAGE...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                       <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:translate-x-1 transition-transform" />
                       <span>FETCH_EXTENDED_LOGS</span>
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
