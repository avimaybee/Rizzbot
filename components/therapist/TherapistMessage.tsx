import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TherapistMessage } from '../../types';
import { CornerNodes } from '../ui/CornerNodes';

interface TherapistMessageBubbleProps {
  message: TherapistMessage;
  showCornerNodes?: boolean;
}

export const TherapistMessageBubble: React.FC<TherapistMessageBubbleProps> = ({
  message,
  showCornerNodes = false
}) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
          max-w-[85%] sm:max-w-[75%] relative
          ${isUser 
            ? 'bg-zinc-800 border border-zinc-700' 
            : 'bg-zinc-900/50 border border-zinc-800'
          }
          p-4 rounded-lg
        `}
      >
        {showCornerNodes && !isUser && (
          <CornerNodes variant="rose" className="opacity-30" />
        )}
        
        <div className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">
          {isUser ? 'YOU' : 'THERAPIST'}
        </div>
        
        <div className={`text-sm leading-relaxed ${isUser ? 'text-white' : 'text-zinc-300'}`}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-zinc-400">{children}</li>,
              strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
              em: ({ children }) => <em className="text-zinc-400 italic">{children}</em>,
              code: ({ children }) => <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-hard-gold text-xs">{children}</code>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        
        <div className="text-[10px] font-mono text-zinc-600 mt-2">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default TherapistMessageBubble;
