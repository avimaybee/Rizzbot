/** Rotating loading lines for the Quick Mode thinking state.
 *  Organic wingman voice, no fake precision — shuffled per run. */

export const QUICK_LOADING_LINES = [
  "reading the room…",
  "checking the vibe…",
  "finding the angle…",
  "cooking up something good…",
  "reading between the lines…",
  "feeling out the energy…",
  "sharpening the reply…",
  "thinking like your wittiest friend…",
  "spotting the perfect opening…",
  "tuning the tone…",
  "plotting the smooth move…",
  "decoding the subtext…",
  "warming up the words…",
  "landing the right energy…",
] as const;

export function shuffledLoadingLines(random: () => number = Math.random): string[] {
  const arr = [...QUICK_LOADING_LINES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Line for a given elapsed second; cycles the (pre-shuffled) pool. */
export function loadingLineForElapsed(pool: readonly string[], elapsedSec: number): string {
  if (pool.length === 0) return "thinking…";
  return pool[Math.floor(elapsedSec / 6) % pool.length];
}
