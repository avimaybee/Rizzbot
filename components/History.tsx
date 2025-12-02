import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, Zap, ChevronRight, Trash2, AlertCircle, RefreshCw, Ghost } from 'lucide-react';
import { getSessions, deleteSession, Session, SessionsResponse } from '../services/dbService';

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
}

export const History: React.FC<HistoryProps> = ({ firebaseUid, onSelectSession }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, hasMore: false, offset: 0 });
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
      <div className="w-full h-full max-w-4xl mx-auto bg-matte-panel border border-zinc-800 flex flex-col relative">
        <CornerNodes />
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

  return (
    <div className="w-full h-full max-w-5xl mx-auto bg-matte-panel border border-zinc-800 flex flex-col relative">
      <CornerNodes />

      {/* Header */}
      <div className="bg-zinc-900 p-4 sm:p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-zinc-700 bg-zinc-800 flex items-center justify-center">
            <Clock className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <h2 className="font-impact text-xl text-white tracking-wide uppercase">Session History</h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              {pagination.total} session{pagination.total !== 1 ? 's' : ''} recorded
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchSessions(0)}
          disabled={loading}
          className="label-sm text-zinc-400 hover:text-white border border-zinc-700 px-4 py-2 hover:bg-zinc-800 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-matte-base">
        {error && (
          <div className="m-4 p-4 bg-red-950/30 border border-red-800/50 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
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
          <div className="p-4 sm:p-6 space-y-3">
            {sessions.map((session) => {
              let parsedResult: any = null;
              try {
                parsedResult = typeof session.result === 'string' ? JSON.parse(session.result) : session.result;
              } catch {}

              const headline = session.headline || parsedResult?.headline || parsedResult?.vibeCheck?.theirEnergy || 'Session';
              const ghostRisk = session.ghost_risk || parsedResult?.ghostRisk || parsedResult?.vibeCheck?.interestLevel;
              const messageCount = session.message_count || parsedResult?.history?.length || 0;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession?.(session)}
                  className={`group relative border border-zinc-800 hover:border-zinc-600 transition-all cursor-pointer ${getRiskBg(ghostRisk)}`}
                >
                  <div className="p-4 sm:p-5 flex items-center gap-4">
                    {/* Mode Icon */}
                    <div className={`w-10 h-10 border flex items-center justify-center flex-shrink-0 ${
                      session.mode === 'quick' 
                        ? 'border-hard-blue/50 bg-hard-blue/10' 
                        : 'border-hard-gold/50 bg-hard-gold/10'
                    }`}>
                      {session.mode === 'quick' ? (
                        <Zap className="w-5 h-5 text-hard-blue" />
                      ) : (
                        <MessageSquare className="w-5 h-5 text-hard-gold" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] uppercase tracking-wider font-bold ${
                          session.mode === 'quick' ? 'text-hard-blue' : 'text-hard-gold'
                        }`}>
                          {session.mode === 'quick' ? 'QUICK MODE' : 'PRACTICE'}
                        </span>
                        {session.persona_name && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="text-xs text-zinc-400">{session.persona_name}</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-semibold text-white text-sm sm:text-base truncate">
                        {headline}
                      </h3>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-zinc-500">
                        <span>{formatDate(session.created_at)}</span>
                        {messageCount > 0 && (
                          <span>{messageCount} message{messageCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    {/* Risk Score */}
                    {ghostRisk !== undefined && (
                      <div className="text-right flex-shrink-0 hidden sm:block">
                        <span className="label-sm text-zinc-600 block mb-1">RISK</span>
                        <span className={`font-mono font-bold text-lg ${getRiskColor(ghostRisk)}`}>
                          {ghostRisk}%
                        </span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        disabled={deletingId === session.id}
                        className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete session"
                      >
                        {deletingId === session.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                      <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
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
                className="w-full py-4 border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-2"
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
