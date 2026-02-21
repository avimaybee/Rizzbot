import { expect, test, describe, beforeEach, afterEach, spyOn, vi } from "bun:test";
import {
  checkWellbeing,
  logSession,
  dismissWellbeingCheckIn,
  triggerWellbeingCheckIn,
  clearLocalData,
  saveWellbeingState
} from "./feedbackService";
import "../tests/setup";

const TEST_USER = "test-user-123";

describe("checkWellbeing", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset any mocks if necessary
  });

  afterEach(() => {
    spyOn(Date, 'now').mockRestore();
    if ((global as any).originalDate) {
      global.Date = (global as any).originalDate;
    }
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
    expect(checkWellbeing(TEST_USER)).toBeNull();
  });

  test("respects dismissal (24h default)", () => {
    const now = Date.now();
    mockTime(now);

    dismissWellbeingCheckIn(TEST_USER, 24);
    expect(checkWellbeing(TEST_USER)).toBeNull();

    // Still null after 23 hours
    mockTime(now + 23 * 60 * 60 * 1000);
    expect(checkWellbeing(TEST_USER)).toBeNull();

    // Available after 25 hours (assuming no other triggers)
    mockTime(now + 25 * 60 * 60 * 1000);
    expect(checkWellbeing(TEST_USER)).toBeNull(); // Should be null because no sessions
  });

  test("respects lastCheckIn frequency (2h)", () => {
    const now = Date.now();
    mockTime(now);

    triggerWellbeingCheckIn(TEST_USER, 'high_frequency');
    expect(checkWellbeing(TEST_USER)).toBeNull();

    // Still null after 1 hour
    mockTime(now + 60 * 60 * 1000);
    expect(checkWellbeing(TEST_USER)).toBeNull();
  });

  test("Heuristic 1: Late night usage (0-4am)", () => {
    // Set time to 2 AM
    const baseDate = new Date();
    baseDate.setHours(2, 0, 0, 0);
    const now = baseDate.getTime();
    mockTime(now);

    // Log 3 late night sessions
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');

    expect(checkWellbeing(TEST_USER)).toBe('late_night');
  });

  test("Heuristic 1 should NOT trigger if current hour is not 0-4am", () => {
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
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');

    // Change back to 10 AM
    mockTime(now);
    expect(checkWellbeing(TEST_USER)).toBeNull();
  });

  test("Heuristic 1: Late night should only count recent sessions", () => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Set time to 2 AM one week ago
    const lateNightPast = new Date(oneWeekAgo);
    lateNightPast.setHours(2);
    mockTime(lateNightPast.getTime());

    // Log 3 late night sessions in the past
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');

    // Set time to 2 AM today
    const lateNightToday = new Date(now);
    lateNightToday.setHours(2);
    mockTime(lateNightToday.getTime());

    // Should NOT trigger because they were a week ago
    expect(checkWellbeing(TEST_USER)).toBeNull();

    // Log 3 sessions tonight
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');
    logSession(TEST_USER, 'quick');
    expect(checkWellbeing(TEST_USER)).toBe('late_night');
  });

  test("Heuristic 2: Same person obsession (5+ in 24h)", () => {
    const now = Date.now();
    mockTime(now);

    // 5 sessions for same persona
    for (let i = 0; i < 5; i++) {
      logSession(TEST_USER, 'quick', 'Desired Persona');
    }

    expect(checkWellbeing(TEST_USER)).toBe('same_person');
  });

  test("Heuristic 2 should NOT trigger for different personas", () => {
    const now = Date.now();
    mockTime(now);

    for (let i = 0; i < 4; i++) {
      logSession(TEST_USER, 'quick', `Persona ${i}`);
    }
    logSession(TEST_USER, 'quick', 'Persona 0'); // Persona 0 has 2 sessions, others have 1

    expect(checkWellbeing(TEST_USER)).toBeNull();
  });

  test("Heuristic 3: High frequency (8+ in 2h)", () => {
    const now = Date.now();
    mockTime(now);

    // 8 sessions in a row
    for (let i = 0; i < 8; i++) {
      logSession(TEST_USER, 'quick');
    }

    expect(checkWellbeing(TEST_USER)).toBe('high_frequency');
  });

  test("Heuristic 4: High ghost risk (avg > 70 over last 5)", () => {
    const now = Date.now();
    mockTime(now);

    // 5 sessions with 80% risk
    for (let i = 0; i < 5; i++) {
      logSession(TEST_USER, 'quick', undefined, 80);
    }

    expect(checkWellbeing(TEST_USER)).toBe('high_risk');
  });

  test("Heuristic 4 should NOT trigger if avg <= 70", () => {
    const now = Date.now();
    mockTime(now);

    // 5 sessions with 70% risk
    for (let i = 0; i < 5; i++) {
      logSession(TEST_USER, 'quick', undefined, 70);
    }

    expect(checkWellbeing(TEST_USER)).toBeNull();
  });

  test("Heuristic 4 should NOT trigger if fewer than 5 sessions with risk", () => {
    const now = Date.now();
    mockTime(now);

    for (let i = 0; i < 4; i++) {
      logSession(TEST_USER, 'quick', undefined, 100);
    }

    expect(checkWellbeing(TEST_USER)).toBeNull();
  });

  test("isolates data between users", () => {
    const USER2 = "user-2";
    const now = Date.now();
    mockTime(now);

    // Trigger for TEST_USER
    triggerWellbeingCheckIn(TEST_USER, 'high_frequency');
    expect(checkWellbeing(TEST_USER)).toBeNull(); // Because recently triggered

    // USER2 should still be null (not triggered)
    expect(checkWellbeing(USER2)).toBeNull();

    // Log sessions for USER2
    for (let i = 0; i < 8; i++) {
      logSession(USER2, 'quick');
    }
    expect(checkWellbeing(USER2)).toBe('high_frequency');

    // TEST_USER should still be null
    expect(checkWellbeing(TEST_USER)).toBeNull();
  });
});
