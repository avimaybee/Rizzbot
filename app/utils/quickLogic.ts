/**
 * Shared tone/action display maps for the Quick Mode and History screens.
 * A tone change (labels, order, or colors) is now a single edit here.
 */

export const TONE_ORDER = ["smooth", "bold", "witty", "authentic", "yourStyle"] as const;

export const TONE_LABELS: Record<string, string> = {
  smooth: "Smooth",
  bold: "Bold",
  witty: "Witty",
  authentic: "Authentic",
  yourStyle: "Your Style",
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
