import React, { useState, useCallback, useRef } from 'react';
import { QuickAdviceRequest, QuickAdviceResponse, UserStyleProfile } from '../types';
import { getQuickAdvice } from '../services/geminiService';
import { saveFeedback, logSession } from '../services/feedbackService';
import { createSession, submitFeedback } from '../services/dbService';
import { useGlobalToast } from './Toast';
import QuickAdvisorRedesign from './QuickAdvisorRedesign';
import QuickAdvisorResultsRedesign from './QuickAdvisorResultsRedesign';

interface QuickAdvisorProps {
  onBack: () => void;
  userProfile?: UserStyleProfile | null;
  firebaseUid?: string | null;
  userId?: number | null;
}

export const QuickAdvisor: React.FC<QuickAdvisorProps> = ({ onBack, userProfile, firebaseUid, userId }) => {
  const [theirMessage, setTheirMessage] = useState('');
  const [yourDraft, setYourDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QuickAdviceResponse | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setScreenshots(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = useCallback(async () => {
    if (!theirMessage.trim() && screenshots.length === 0) return;

    setIsLoading(true);
    setResult(null);

    const request: QuickAdviceRequest = {
      theirMessage: theirMessage.trim(),
      yourDraft: yourDraft.trim() || undefined,
      context: 'talking', // default context for now
      userStyle: userProfile || undefined,
      screenshots: screenshots.length > 0 ? screenshots : undefined,
      userId: firebaseUid || undefined
    };

    try {
      const response = await getQuickAdvice(request);
      setResult(response);
      if (firebaseUid) {
        logSession(firebaseUid, 'quick', undefined, undefined);
      }

      if (firebaseUid) {
        try {
          const headline = response.vibeCheck?.theirEnergy
            ? `${response.vibeCheck.theirEnergy.toUpperCase()} energy detected`
            : 'Quick analysis';
          const interestLevel = response.vibeCheck?.interestLevel;

          await createSession(firebaseUid, {
            type: 'quick',
            request,
            response,
            timestamp: new Date().toISOString(),
          }, {
            mode: 'quick',
            headline,
            ghost_risk: interestLevel ? (100 - interestLevel) : undefined,
            message_count: 1,
          });
        } catch (dbError) {
          console.error('Failed to save quick session to DB:', dbError);
        }
      }
    } catch (error) {
      console.error('Quick advice failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [theirMessage, yourDraft, userProfile, screenshots, firebaseUid]);

  const handleFeedback = useCallback((suggestionType: 'smooth' | 'bold' | 'witty' | 'authentic', rating: 'helpful' | 'mid' | 'off') => {
    if (firebaseUid) {
      saveFeedback(firebaseUid, {
        source: 'quick',
        suggestionType,
        rating,
        context: 'talking',
        theirEnergy: result?.vibeCheck.theirEnergy,
        recommendedAction: result?.recommendedAction,
      });
    }

    if (userId) {
      try {
        submitFeedback({
          user_id: userId,
          source: 'quick',
          suggestion_type: suggestionType,
          rating: rating === 'helpful' ? 1 : rating === 'mid' ? 0 : -1,
          metadata: {
            context: 'talking',
            theirEnergy: result?.vibeCheck.theirEnergy,
          }
        });
      } catch (dbError) {
        console.error('Failed to submit feedback to DB:', dbError);
      }
    }
  }, [result, firebaseUid, userId]);

  const resetForm = useCallback(() => {
    setResult(null);
    setTheirMessage('');
    setYourDraft('');
    setScreenshots([]);
  }, []);

  if (result) {
    return (
      <QuickAdvisorResultsRedesign 
        result={result} 
        onNewScan={resetForm} 
        onFeedback={handleFeedback} 
        onBack={onBack}
      />
    );
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple
        className="hidden"
      />
      <QuickAdvisorRedesign 
        screenshots={screenshots}
        onRemoveScreenshot={removeScreenshot}
        onUploadClick={() => fileInputRef.current?.click()}
        onAnalyzeClick={handleAnalyze}
        isLoading={isLoading}
        context={theirMessage}
        onContextChange={setTheirMessage}
        yourDraft={yourDraft}
        onDraftChange={setYourDraft}
        onBack={onBack}
      />
    </>
  );
};
