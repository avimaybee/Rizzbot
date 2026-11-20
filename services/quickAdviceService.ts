import {
  QuickAdviceResponse,
  UserStyleProfile,
} from '../types';
import { getFirebaseToken } from './firebaseService';
import { normalizeQuickAdviceResponse } from './quickAdvice';
import { getPromptBias } from './feedbackService';

export interface QuickImageAttachment {
  mimeType: string;
  data: string;
}

export interface QuickModelStatus {
  model: string;
  effort: string;
  attempt: number;
}

export function formatAbstractStyleHints(
  profile?: UserStyleProfile | null
): string {
  if (!profile) {
    return 'No saved profile yet — infer the user\'s natural texting cadence directly from their own messages visible in the screenshots.';
  }

  const lines: string[] = [
    `- Caps style: ${profile.capitalization || 'lowercase'}`,
    `- Punctuation habit: ${profile.punctuation || 'minimal'}`,
    `- Emoji frequency: ${profile.emojiUsage || 'minimal'}`,
    `- Typical message length: ${profile.averageLength || 'short'}`,
    `- Natural register: ${profile.preferredTone || 'playful'} (slang: ${profile.slangLevel || 'casual'})`,
    `- Energy level: ${profile.energy || 'medium'}; response speed: ${profile.responseSpeed || 'normal'}; flirt: ${profile.flirtLevel || 'subtle'}; humor: ${profile.humorStyle || 'playful'}`,
  ];

  const cadenceNotes = (profile as UserStyleProfile & { cadenceNotes?: string }).cadenceNotes;
  if (typeof cadenceNotes === 'string' && cadenceNotes.trim().length > 0) {
    lines.push(`- Learned cadence texture: ${cadenceNotes.trim()}`);
  }
  if (profile.aiSummary && profile.aiSummary.trim()) {
    lines.push(`- AI summary: ${profile.aiSummary.trim().slice(0, 300)}`);
  }

  return lines.join('\n');
}

export function buildQuickModePrompt(params: {
  inputText: string;
  stage?: string;
  userDraft?: string;
  styleProfile?: UserStyleProfile | null;
  imageCount: number;
  feedbackContext?: string;
}): string {
  const { inputText, stage, userDraft, styleProfile, imageCount, feedbackContext } = params;
  const trimmedInput = (inputText || '').trim();
  const trimmedDraft = userDraft?.trim() || '';

  const sections: string[] = [
    `RELATIONSHIP STAGE: ${stage || 'talking'}`,
    `ATTACHED SCREENSHOTS: ${imageCount}`,
  ];

  if (imageCount > 0) {
    const isDefaultPlaceholder =
      trimmedInput === 'Analyze the conversation screenshot';
    if (trimmedInput && !isDefaultPlaceholder) {
      sections.push(
        `USER'S PRIVATE GOAL / DIRECTION (BEHIND-THE-SCENES COACHING ONLY — NEVER RECITE OR CONFESS THIS WORDING TO THE OTHER PERSON):\n${trimmedInput}`
      );
    } else {
      sections.push(
        `USER'S PRIVATE GOAL / DIRECTION: None specified — read the screenshot thread carefully and craft the sharpest replies for every unreplied topic.`
      );
    }
  } else {
    sections.push(`THEIR MESSAGE / CONVERSATION CONTEXT:\n${trimmedInput}`);
  }

  if (trimmedDraft) {
    sections.push(
      `USER'S TENTATIVE DRAFT TO CRITIQUE & IMPROVE (critique this honestly in the summary field and outperform it across the 5 tabs):\n"${trimmedDraft}"`
    );
  }

  sections.push(
    `USER'S ABSTRACT TEXTING CADENCE (use primarily for the yourStyle tab; always prioritize their real messages visible in the screenshot first, and NEVER copy literal catchphrases):\n${formatAbstractStyleHints(styleProfile)}`
  );

  if (feedbackContext && feedbackContext.trim()) {
    sections.push(feedbackContext.trim());
  }

  return sections.join('\n\n');
}

function toImageAttachment(screenshot: string): QuickImageAttachment {
  const mimeMatch = screenshot.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const data = screenshot.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');
  return { mimeType, data };
}

async function postQuickNDJSON(
  prompt: string,
  images: QuickImageAttachment[],
  onStatus?: (status: QuickModelStatus) => void
): Promise<QuickAdviceResponse> {
  const token = await getFirebaseToken();
  const response = await fetch('/api/opencode/quick', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ prompt, images }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Quick Mode request failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  if (!response.body) {
    throw new Error('Empty response stream from /api/opencode/quick');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');

      if (!line) continue;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (event.type === 'ping') {
        continue;
      }
      if (event.type === 'status' && onStatus) {
        onStatus({
          model: String(event.model || ''),
          effort: String(event.effort || ''),
          attempt: Number(event.attempt || 1),
        });
        continue;
      }
      if (event.type === 'error') {
        const details = Array.isArray(event.details) ? ` (${(event.details as string[]).join(' | ')})` : '';
        throw new Error(`${String(event.message || 'Generation failed')}${details}`);
      }
      if (event.type === 'result') {
        const rawData = (event.data ?? {}) as Partial<QuickAdviceResponse>;
        return normalizeQuickAdviceResponse({
          ...rawData,
          modelUsed: typeof event.model === 'string' ? event.model : undefined,
        });
      }
    }
  }

  throw new Error('Quick Mode stream closed before returning a result.');
}

/**
 * V2 Quick Advice entry point (Plan 010).
 * Accepts either the legacy QuickAdviceRequest object or the new
 * (inputText, image, stage, userDraft, styleProfile, extraImages, feedbackContext, onStatus) signature.
 */
export async function getQuickAdvice(
  inputOrRequest: string | {
    theirMessage?: string;
    yourDraft?: string;
    context?: string;
    userStyle?: UserStyleProfile | null;
    screenshots?: string[];
    userId?: string;
  },
  image?: QuickImageAttachment | ((status: QuickModelStatus) => void),
  stage?: string,
  userDraft?: string,
  styleProfile?: UserStyleProfile | null,
  extraImages?: QuickImageAttachment[],
  feedbackContext?: string,
  onStatus?: (status: QuickModelStatus) => void
): Promise<QuickAdviceResponse> {
  // Legacy object form: getQuickAdvice({ theirMessage, yourDraft, context, userStyle, screenshots, userId })
  if (typeof inputOrRequest === 'object' && inputOrRequest !== null) {
    const req = inputOrRequest as {
      theirMessage?: string;
      yourDraft?: string;
      context?: string;
      userStyle?: UserStyleProfile | null;
      screenshots?: string[];
      userId?: string;
    };
    const screenshots = Array.isArray(req.screenshots) ? req.screenshots : [];
    const images: QuickImageAttachment[] = screenshots.slice(0, 10).map(toImageAttachment);
    const bias = req.userId ? getPromptBias(req.userId) : '';
    const prompt = buildQuickModePrompt({
      inputText: req.theirMessage || '',
      stage: req.context,
      userDraft: req.yourDraft,
      styleProfile: req.userStyle,
      imageCount: images.length,
      feedbackContext: bias,
    });
    // onStatus passed as 2nd arg in object form
    const statusCb = typeof image === 'function' ? (image as unknown as (s: QuickModelStatus) => void) : undefined;
    return postQuickNDJSON(prompt, images, statusCb);
  }

  // New positional form
  const inputText = inputOrRequest as string;
  const singleImage = typeof image === 'function' ? undefined : image;
  const images: QuickImageAttachment[] = [
    ...(singleImage ? [singleImage] : []),
    ...(Array.isArray(extraImages) ? extraImages : []),
  ].slice(0, 10);

  if (!inputText.trim() && images.length === 0) {
    throw new Error('Provide a screenshot or message text to get replies.');
  }

  const prompt = buildQuickModePrompt({
    inputText,
    stage,
    userDraft,
    styleProfile: styleProfile ?? null,
    imageCount: images.length,
    feedbackContext,
  });

  return postQuickNDJSON(prompt, images, onStatus);
}
