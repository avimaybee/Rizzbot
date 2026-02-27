import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, Zap, ChevronRight, Trash2, AlertCircle, RefreshCw, Ghost, X, Image, ArrowLeft } from 'lucide-react';
import { getSessions, deleteSession, Session, SessionsResponse } from '../services/dbService';
import { ModuleHeader } from './ModuleHeader';

// Corner decorative nodes
const CornerNodes = () => (
  <>
    <div className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-zinc-600"></div>
    <div className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-zinc-600"></div>
    <div className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-zinc-600"></div>
    <div className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-zinc-600"></div>
  </>
);

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

  return (
    <div className="h-full flex flex-col">
      {/* MODULE HEADER - DETAIL */}
      <div className="px-4 pt-4">
        <ModuleHeader 
          title={session.headline || session.persona_name || 'ARCHIVED_SESSION'} 
          mode={session.mode === 'quick' ? 'QUICK_ARCHIVE' : 'PRACTICE_ARCHIVE'} 
          id={session.id}
          onBack={onBack}
          accentColor={session.mode === 'quick' ? 'blue' : 'gold'}
          statusLabel="RECORD_STATUS"
          statusValue="READ_ONLY"
          statusColor="gold"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Screenshots Section */}
        {screenshots.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-4 h-4 text-zinc-400" />
              <span className="label-sm text-zinc-400">UPLOADED SCREENSHOTS</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {screenshots.map((screenshot: string, idx: number) => (
                <div key={idx} className="aspect-[9/16] bg-zinc-800 border border-zinc-700 overflow-hidden">
                  <img
                    src={screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`}
                    alt={`Screenshot ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Their Message (for Quick Mode) */}
        {theirMessage && (
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <div className="label-sm text-zinc-400 mb-3">THEIR MESSAGE</div>
            <p className="text-white bg-zinc-800 p-4 rounded-lg border border-zinc-700">{theirMessage}</p>
          </div>
        )}

        {/* Vibe Check Analysis */}
        {vibeCheck && (
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <div className="label-sm text-zinc-400 mb-4">VIBE CHECK ANALYSIS</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-zinc-800 border border-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">ENERGY</div>
                <div className="text-white font-bold uppercase">{vibeCheck.theirEnergy || 'N/A'}</div>
              </div>
              <div className="text-center p-3 bg-zinc-800 border border-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">INTEREST</div>
                <div className="text-white font-bold">{vibeCheck.interestLevel ?? 'N/A'}%</div>
              </div>
            </div>
            {vibeCheck.greenFlags?.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-emerald-400 mb-2">GREEN FLAGS</div>
                <div className="flex flex-wrap gap-2">
                  {vibeCheck.greenFlags.map((flag: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-emerald-950/30 border border-emerald-800/50 text-emerald-400 text-xs">{flag}</span>
                  ))}
                </div>
              </div>
            )}
            {vibeCheck.redFlags?.length > 0 && (
              <div>
                <div className="text-xs text-red-400 mb-2">RED FLAGS</div>
                <div className="flex flex-wrap gap-2">
                  {vibeCheck.redFlags.map((flag: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-red-950/30 border border-red-800/50 text-red-400 text-xs">{flag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Suggestions */}
        {suggestions && (
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <div className="label-sm text-zinc-400 mb-4">SUGGESTED REPLIES</div>
            <div className="space-y-3">
              {suggestions.smooth && (
                <div className="p-3 bg-zinc-800 border border-zinc-700">
                  <div className="text-xs text-zinc-500 mb-1">SMOOTH</div>
                  <p className="text-white text-sm">{Array.isArray(suggestions.smooth) ? suggestions.smooth[0] : suggestions.smooth}</p>
                </div>
              )}
              {suggestions.bold && (
                <div className="p-3 bg-zinc-800 border border-hard-blue/30">
                  <div className="text-xs text-hard-blue mb-1">BOLD</div>
                  <p className="text-white text-sm">{Array.isArray(suggestions.bold) ? suggestions.bold[0] : suggestions.bold}</p>
                </div>
              )}
              {suggestions.authentic && (
                <div className="p-3 bg-zinc-800 border border-hard-gold/30">
                  <div className="text-xs text-hard-gold mb-1">YOUR STYLE</div>
                  <p className="text-white text-sm">{Array.isArray(suggestions.authentic) ? suggestions.authentic[0] : suggestions.authentic}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Practice Mode Conversation History */}
        {history.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <div className="label-sm text-zinc-400 mb-4">CONVERSATION HISTORY</div>
            <div className="space-y-4">
              {history.map((turn: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="bg-hard-gold/20 border border-hard-gold/30 p-3 max-w-[80%]">
                      <div className="text-xs text-hard-gold mb-1">YOU SENT</div>
                      <p className="text-white text-sm">{turn.draft}</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 border border-zinc-700 p-3 max-w-[80%]">
                      <div className="text-xs text-zinc-500 mb-1">PREDICTED REPLY</div>
                      <p className="text-white text-sm">{turn.result?.predictedReply}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Session Analysis (Practice Mode) */}
        {analysis && (
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
            <div className="label-sm text-zinc-400 mb-4">SESSION ANALYSIS</div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-zinc-800 border border-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">GHOST RISK</div>
                <div className={`font-bold text-lg ${analysis.ghostRisk > 70 ? 'text-red-400' : analysis.ghostRisk > 40 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                  {analysis.ghostRisk}%
                </div>
              </div>
              <div className="text-center p-3 bg-zinc-800 border border-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">VIBE MATCH</div>
                <div className="text-white font-bold text-lg">{analysis.vibeMatch}%</div>
              </div>
              <div className="text-center p-3 bg-zinc-800 border border-zinc-700">
                <div className="text-xs text-zinc-500 mb-1">EFFORT</div>
                <div className="text-white font-bold text-lg">{analysis.effortBalance}%</div>
              </div>
            </div>
            {analysis.headline && (
              <p className="text-white bg-zinc-800 p-4 border border-zinc-700 mb-4">{analysis.headline}</p>
            )}
            {analysis.insights?.length > 0 && (
              <div className="space-y-2">
                {analysis.insights.map((insight: string, i: number) => (
                  <p key={i} className="text-sm text-zinc-400">• {insight}</p>
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
      setError('Failed to load history. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(0);
  }, [firebaseUid]);

  const handleDelete = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;

    setDeletingId(sessionId);
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

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getRiskColor = (risk: number | undefined) => {
    if (!risk) return 'text-zinc-500';
    if (risk > 70) return 'text-red-400';
    if (risk > 40) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getRiskBg = (risk: number | undefined) => {
    if (!risk) return 'bg-zinc-800/50';
    if (risk > 70) return 'bg-red-950/30';
    if (risk > 40) return 'bg-yellow-950/30';
    return 'bg-emerald-950/30';
  };

  if (!firebaseUid) {
    return (
      <div className="w-full h-full max-w-4xl mx-auto bg-matte-panel md:border md:border-zinc-800 flex flex-col relative">
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <Ghost className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h3 className="font-impact text-xl text-white mb-2">SIGN IN TO VIEW HISTORY</h3>
            <p className="text-sm text-zinc-500">Your past sessions will appear here once you're logged in</p>
          </div>
        </div>
      </div>
    );
  }

  // Show session detail view if a session is selected
  if (selectedSession) {
    return (
      <div className="w-full h-full max-w-5xl mx-auto bg-matte-panel md:border md:border-zinc-800 flex flex-col relative pb-20 md:pb-0">
        <SessionDetail session={selectedSession} onBack={() => setSelectedSession(null)} />
      </div>
    );
  }

  return (
    <div className="w-full h-full max-w-5xl mx-auto bg-matte-panel md:border md:border-zinc-800 flex flex-col relative pb-16 md:pb-0 overflow-y-auto">
      {/* MODULE HEADER - LIST */}
      <div className="px-4 pt-4 sticky top-0 z-40 bg-matte-panel/95 backdrop-blur-sm">
        <ModuleHeader 
          title="CENTRAL_HISTORY_LOG" 
          mode="ARCHIVE_MODE" 
          onBack={onBack || (() => {})}
          accentColor="gold"
          statusLabel="TOTAL_RECORDS"
          statusValue={`${pagination.total} SESSIONS`}
          statusColor="gold"
        />
      </div>

      {/* SEARCH & FILTERS */}
      <div className="border-b border-zinc-800 p-4 space-y-4 shrink-0 bg-matte-panel">
        <div className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <div className="w-1.5 h-1.5 bg-zinc-600 group-focus-within:bg-hard-gold animate-pulse"></div>
          </div>
          <input
            type="text"
            placeholder="SEARCH_LOGS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-matte-base border border-zinc-800 py-2.5 pl-8 pr-4 text-xs font-mono uppercase tracking-widest text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {(['all', 'quick', 'simulator'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 text-[10px] font-mono border transition-all ${
                activeFilter === filter
                ? 'border-hard-gold/50 bg-hard-gold/10 text-hard-gold'
                : 'border-zinc-800 bg-matte-base text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
              }`}
            >
              {filter.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-matte-base">
        {error && (
          <div className="m-3 p-3 bg-red-950/30 border border-red-800/50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-zinc-600 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-zinc-500">Loading your sessions...</p>
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="font-impact text-lg text-white mb-2">NO SESSIONS YET</h3>
              <p className="text-sm text-zinc-500 max-w-xs">
                Start a conversation in Quick Mode or Practice Mode to see your history here
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

              const headline = session.headline || parsedResult?.headline || parsedResult?.vibeCheck?.theirEnergy || 'Session';
              const ghostRisk = session.ghost_risk || parsedResult?.ghostRisk || parsedResult?.vibeCheck?.interestLevel;
              const messageCount = session.message_count || parsedResult?.history?.length || 0;
              const screenshots = parsedResult?.request?.screenshots || parsedResult?.screenshots || [];

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setSelectedSession(session);
                    onSelectSession?.(session);
                  }}
                  className={`group relative border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col h-full bg-matte-panel overflow-hidden`}
                >
                  {/* Visual Preview */}
                  <div className="aspect-[16/9] bg-zinc-900 overflow-hidden relative border-b border-zinc-800">
                    {screenshots.length > 0 ? (
                      <img
                        src={screenshots[0].startsWith('data:') ? screenshots[0] : `data:image/png;base64,${screenshots[0]}`}
                        alt="Preview"
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity grayscale group-hover:grayscale-0"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-20">
                        {session.mode === 'quick' ? (
                          <Zap className="w-12 h-12 text-hard-blue" />
                        ) : (
                          <MessageSquare className="w-12 h-12 text-hard-gold" />
                        )}
                      </div>
                    )}
                    
                    {/* Status Overlays */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <div className={`px-2 py-0.5 text-[10px] font-mono border ${
                        session.mode === 'quick' 
                        ? 'border-hard-blue/50 bg-hard-blue/10 text-hard-blue' 
                        : 'border-hard-gold/50 bg-hard-gold/10 text-hard-gold'
                      }`}>
                        {session.mode === 'quick' ? 'QUICK_MODE' : 'PRACTICE'}
                      </div>
                    </div>
                    
                    {ghostRisk !== undefined && (
                      <div className={`absolute top-3 right-3 px-2 py-0.5 text-[10px] font-mono border ${
                        ghostRisk > 70 ? 'border-red-500/50 bg-red-500/10 text-red-400' :
                        ghostRisk > 40 ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' :
                        'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      }`}>
                        RISK_{ghostRisk}%
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-impact text-lg text-white uppercase tracking-wide mb-2 line-clamp-1">
                      {headline}
                    </h3>
                    
                    <div className="flex-1">
                      {session.persona_name && (
                        <div className="text-[10px] font-mono text-zinc-500 mb-2 uppercase">
                          PARTNER: {session.persona_name}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                      <div className="text-[10px] font-mono text-zinc-600 uppercase">
                        {formatDate(session.created_at)}
                      </div>
                      <div className="flex items-center gap-3">
                        {messageCount > 0 && (
                          <div className="text-[10px] font-mono text-zinc-500 uppercase">
                            {messageCount} MSG
                          </div>
                        )}
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          disabled={deletingId === session.id}
                          className="text-zinc-600 hover:text-red-400 transition-colors"
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
              <button
                onClick={() => fetchSessions(pagination.offset)}
                disabled={loading}
                className="w-full py-4 border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load More Sessions</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
