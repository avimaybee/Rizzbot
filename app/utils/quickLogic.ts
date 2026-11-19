/**
 * Shared tone/action display maps for the Quick Mode and History screens.
 * A tone change (labels, order, or colors) is now a single edit here.
 */

export const TONE_ORDER = ["real", "smooth", "playful", "bold", "yourStyle"] as const;

export const TONE_LABELS: Record<string, string> = {
  real: "Real",
  smooth: "Smooth",
  playful: "Playful",
  bold: "Bold",
  yourStyle: "Your Style",
  // Legacy V1 labels kept for old history rows
  witty: "Witty",
  authentic: "Authentic",
};

export const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  SEND: { label: "Send it", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
  WAIT: { label: "Wait", color: "#7A5400", bg: "rgba(212,168,83,0.12)" },
  CALL: { label: "Call / voice note", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
  MATCH: { label: "Match their energy", color: "#7A9E7E", bg: "rgba(122,158,126,0.12)" },
  PULL_BACK: { label: "Pull back", color: "#7A5400", bg: "rgba(212,168,83,0.12)" },
  ABORT: { label: "Walk away", color: "#C8522A", bg: "rgba(200,82,42,0.1)" },
};

export const getActionLabel = (action: string): { label: string; color: string; bg: string } =>
  ACTION_LABELS[action] || { label: action, color: "#1A1208", bg: "rgba(26,18,8,0.06)" };

/** V2 tab order (Plan 010). Legacy witty/authentic still supported for V1 history. */
export const QUICK_V2_ORDER = ["real", "smooth", "playful", "bold", "yourStyle"] as const;

export function getInitialSelectedStyle(
  advice: { suggestions?: Record<string, Array<{ isRecommended?: boolean }>> },
  hasStyleProfile: boolean
): string {
  if (hasStyleProfile && ((advice.suggestions as any)?.yourStyle?.length ?? 0) > 0) {
    return 'yourStyle';
  }

  const styles: string[] = ['real', 'smooth', 'playful', 'bold', 'yourStyle'];
  for (const style of styles) {
    const list = (advice.suggestions as any)?.[style] ?? [];
    if (Array.isArray(list) && list.some((item: any) => item?.isRecommended)) {
      return style;
    }
  }

  return 'real';
}
