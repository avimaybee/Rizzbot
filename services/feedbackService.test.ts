import { expect, test, describe, beforeEach, afterEach, spyOn } from "bun:test";
import {
  checkWellbeing,
  logSession,
  dismissWellbeingCheckIn,
  triggerWellbeingCheckIn,
  clearLocalData,
  saveWellbeingState
} from "./feedbackService";
import "../tests/setup";

describe("checkWellbeing", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset any mocks if necessary
  });

  afterEach(() => {
    if ((global as any).originalDate) {
      global.Date = (global as any).originalDate;
      delete (global as any).originalDate;
    }
    spyOn(Date, 'now').mockRestore();
  });

  const mockTime = (timestamp: number) => {
    spyOn(Date, 'now').mockReturnValue(timestamp);

    // Also mock new Date().getHours()
    const fixedDate = new Date(timestamp);
    if (!(global as any).originalDate) {
      (global as any).originalDate = Date;
    }

    // Simple Date mock
    const MockDate = class extends Date {
      constructor(t?: any) {
        if (t === undefined) {
          super(timestamp);
        } else {
          super(t);
        }
      }
    } as any;
    global.Date = MockDate;
  };

  test("returns null when no sessions exist", () => {
    mockTime(Date.now());
    expect(checkWellbeing()).toBeNull();
  });

  test("respects dismissal (24h default)", () => {
    const now = Date.now();
    mockTime(now);

    dismissWellbeingCheckIn(24);
    expect(checkWellbeing()).toBeNull();

    // Still null after 23 hours
    mockTime(now + 23 * 60 * 60 * 1000);
    expect(checkWellbeing()).toBeNull();

    // Available after 25 hours (assuming no other triggers)
    mockTime(now + 25 * 60 * 60 * 1000);
    expect(checkWellbeing()).toBeNull(); // Should be null because no sessions
  });

  test("respects lastCheckIn frequency (2h)", () => {
    // Start at 1 AM to stay within the 0-4 AM window for the late-night heuristic
    const baseDate = new Date();
    baseDate.setHours(1, 0, 0, 0);
    const now = baseDate.getTime();
    mockTime(now);

    // Set up conditions that would normally trigger a wellbeing check
    logSession('quick');
    logSession('quick');
    logSession('quick');

    // Simulate a recent wellbeing check, which should throttle further checks
    triggerWellbeingCheckIn('high_frequency');
    expect(checkWellbeing()).toBeNull();

    // Still null after 1 hour (within the 2h window)
    mockTime(now + 60 * 60 * 1000);
    expect(checkWellbeing()).toBeNull();

    // After 2.5 hours, throttling should expire and the heuristic should trigger again
    const later = now + 2.5 * 60 * 60 * 1000;
    mockTime(later);
    logSession('quick');
    logSession('quick');
    logSession('quick');
    expect(checkWellbeing()).toBe('late_night');
  });

  test("Heuristic 1: Late night usage (0-4am)", () => {
    // Set time to 2 AM
    const baseDate = new Date();
    baseDate.setHours(2, 0, 0, 0);
    const now = baseDate.getTime();
    mockTime(now);

    // Log 3 late night sessions
    logSession('quick');
    logSession('quick');
    logSession('quick');

    expect(checkWellbeing()).toBe('late_night');
  });

  test("Heuristic 1: should NOT trigger during daytime even if past late-night sessions exist", () => {
    // Set time to 10 AM
    const baseDate = new Date();
    baseDate.setHours(10, 0, 0, 0);
    const now = baseDate.getTime();
    mockTime(now);

    // Log 3 sessions that happened at 2 AM
    const lateNightTime = new Date(now);
    lateNightTime.setHours(2);

    // We need to manually manipulate the log if we want to test sessions from different times
    // But logSession uses Date.now(), so we can just change mockTime before each log
    mockTime(lateNightTime.getTime());
    logSession('quick');
    logSession('quick');
    logSession('quick');

    // Change back to 10 AM
    mockTime(now);
    expect(checkWellbeing()).toBeNull();
  });

  test("Heuristic 1: Late night should only count recent sessions", () => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Set time to 2 AM one week ago
    const lateNightPast = new Date(oneWeekAgo);
    lateNightPast.setHours(2);
    mockTime(lateNightPast.getTime());

    // Log 3 late night sessions in the past
    logSession('quick');
    logSession('quick');
    logSession('quick');

    // Set time to 2 AM today
    const lateNightToday = new Date(now);
    lateNightToday.setHours(2);
    mockTime(lateNightToday.getTime());

    // Should NOT trigger because they were a week ago
    expect(checkWellbeing()).toBeNull();

    // Log 3 sessions tonight
    logSession('quick');
    logSession('quick');
    logSession('quick');
    expect(checkWellbeing()).toBe('late_night');
  });

  test("Heuristic 2: Same person obsession (5+ in 24h)", () => {
    const now = Date.now();
    mockTime(now);

    // 5 sessions for same persona
    for (let i = 0; i < 5; i++) {
      logSession('quick', 'Desired Persona');
    }

    expect(checkWellbeing()).toBe('same_person');
  });

  test("Heuristic 2 should NOT trigger for different personas", () => {
    const now = Date.now();
    mockTime(now);

    for (let i = 0; i < 4; i++) {
      logSession('quick', `Persona ${i}`);
    }
    logSession('quick', 'Persona 0'); // 5 total sessions across 4 personas: Persona 0 has 2, others have 1 each

    expect(checkWellbeing()).toBeNull();
  });

  test("Heuristic 3: High frequency (8+ in 2h)", () => {
    const now = Date.now();
    mockTime(now);

    // 8 sessions in a row
    for (let i = 0; i < 8; i++) {
      logSession('quick');
    }

    expect(checkWellbeing()).toBe('high_frequency');
  });

  test("Heuristic 4: High ghost risk (avg > 70 over last 5)", () => {
    const now = Date.now();
    mockTime(now);

    // 5 sessions with 80% risk
    for (let i = 0; i < 5; i++) {
      logSession('quick', undefined, 80);
    }

    expect(checkWellbeing()).toBe('high_risk');
  });

  test("Heuristic 4 should NOT trigger if avg <= 70", () => {
    const now = Date.now();
    mockTime(now);

    // 5 sessions with 70% risk
    for (let i = 0; i < 5; i++) {
      logSession('quick', undefined, 70);
    }

    expect(checkWellbeing()).toBeNull();
  });

  test("Heuristic 4 should NOT trigger if fewer than 5 sessions with risk", () => {
    const now = Date.now();
    mockTime(now);

    for (let i = 0; i < 4; i++) {
      logSession('quick', undefined, 100);
    }

    expect(checkWellbeing()).toBeNull();
  });
});
