import { UserStyleProfile } from '../types';
import { getAuthHeaders } from './authHeaders';
import { QuickImageAttachment } from './quickAdviceService';

/**
 * Fire-and-forget passive voice learning from Quick Mode screenshots.
 * Never throws or blocks the UI.
 */
export async function triggerPassiveVoiceLearning(
  images: QuickImageAttachment[],
  onProfileUpdated?: (profile: UserStyleProfile, newCount?: number) => void
): Promise<void> {
  if (!Array.isArray(images) || images.length === 0) return;

  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch('/api/voice/learn', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: images.slice(0, 10).map((img) => ({
          mimeType: img.mimeType,
          data: img.data,
        })),
      }),
    });

    if (!res.ok) return;
    const data = (await res.json()) as {
      updated?: boolean;
      newMessages?: number;
      profile?: UserStyleProfile;
    };

    if (data.updated && data.profile && onProfileUpdated) {
      onProfileUpdated(data.profile, data.newMessages ?? 0);
    }
  } catch {
    // Non-blocking background enhancement; ignore errors silently
  }
}
