import React from 'react';
import { Clock, MessageSquareQuote, Sparkles } from 'lucide-react';

interface FriendSummaryCardProps {
  summary: string;
  shouldWait: boolean;
  extractedUnrepliedMessages?: string[];
}

export const FriendSummaryCard: React.FC<FriendSummaryCardProps> = ({
  summary,
  shouldWait,
  extractedUnrepliedMessages = [],
}) => {
  return (
    <section
      aria-label="The Read"
      style={{
        backgroundColor: '#FDFAF5',
        border: '1px solid #E8E0D4',
        borderRadius: 18,
        padding: '16px 18px',
        boxShadow: '0 2px 12px rgba(26, 18, 8, 0.05)',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} strokeWidth={2} color="#C8522A" />
          <h3
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#C8522A',
              margin: 0,
            }}
          >
            The Read
          </h3>
        </div>

        {shouldWait && (
          <span
            className="inline-flex items-center gap-1.5"
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: '#FEF3E2',
              color: '#7A5400',
              border: '1px solid rgba(212,168,83,0.35)',
            }}
          >
            <Clock size={12} strokeWidth={2} color="#B8860B" />
            Hold off before sending
          </span>
        )}
      </div>

      <p
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: '#1A1208',
          margin: 0,
        }}
      >
        {summary}
      </p>

      {extractedUnrepliedMessages.length > 0 && (
        <div
          className="mt-3 pt-2.5"
          style={{ borderTop: '1px solid #E8E0D4' }}
        >
          <div
            className="flex items-center gap-1.5 mb-2"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(26,18,8,0.5)',
            }}
          >
            <MessageSquareQuote size={12} strokeWidth={2} color="#C8522A" />
            <span>
              Replying to {extractedUnrepliedMessages.length} active topic
              {extractedUnrepliedMessages.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {extractedUnrepliedMessages.map((msg, idx) => (
              <span
                key={idx}
                className="max-w-full truncate"
                title={msg}
                style={{
                  fontSize: 12,
                  padding: '3px 10px',
                  borderRadius: 8,
                  backgroundColor: '#F5EFE6',
                  border: '1px solid #E8E0D4',
                  color: 'rgba(26,18,8,0.7)',
                }}
              >
                &quot;{msg}&quot;
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
