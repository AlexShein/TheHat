import { describe, it, expect, vi, afterEach } from "vitest"
import { getTimeRemaining } from "./timer"

describe("getTimeRemaining", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // AC 1 — returns timerDuration when timerStartedAt is null
  it("returns timerDuration when timerStartedAt is null", () => {
    expect(getTimeRemaining(null, 30000, null, null)).toBe(30000)
    expect(getTimeRemaining(null, 60000, null, null)).toBe(60000)
    expect(getTimeRemaining(null, 0, null, null)).toBe(0)
  })

  // AC 2 — returns correct remaining for known timerStartedAt offset
  it("returns correct remaining for known timerStartedAt offset", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    const timerStartedAt = now - 5000 // started 5 seconds ago
    expect(getTimeRemaining(timerStartedAt, 30000, null, null)).toBe(25000)
  })

  // AC 2 edge — exactly at zero
  it("returns 0 when elapsed exactly equals timerDuration", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    expect(getTimeRemaining(now - 30000, 30000, null, null)).toBe(0)
  })

  // AC 4 — clamps to 0, never returns negative
  it("clamps to 0, never returns negative", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    // elapsed = 40000, duration = 30000 → -10000 clamped to 0
    expect(getTimeRemaining(now - 40000, 30000, null, null)).toBe(0)
    // extreme: elapsed = 999999, duration = 1
    expect(getTimeRemaining(now - 999999, 1, null, null)).toBe(0)
  })

  // AC 3 — returns timeRemainingAtPause when pausedAt is not null
  it("returns timeRemainingAtPause when pausedAt is not null", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    // timer was at 15s remaining when paused at time X
    const result = getTimeRemaining(
      now - 20000, // timerStartedAt 20s ago
      45000, // 45s total duration
      now - 5000, // pausedAt 5s ago
      15000, // 15s remaining at pause
    )
    expect(result).toBe(15000)
  })

  // AC 3 — frozen regardless of real clock
  it("paused timer returns same value regardless of Date.now()", () => {
    const now1 = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now1)
    const result1 = getTimeRemaining(now1 - 10000, 60000, now1 - 2000, 42000)

    // advance clock 10 seconds, should still return same frozen value
    const now2 = now1 + 10000
    vi.spyOn(Date, "now").mockReturnValue(now2)
    const result2 = getTimeRemaining(now1 - 10000, 60000, now1 - 2000, 42000)

    expect(result1).toBe(42000)
    expect(result2).toBe(42000)
  })

  // AC 5 — resume: when pausedAt is null again, computes from timerStartedAt
  it("resume computes remaining from timerStartedAt when pausedAt is null", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    // timer was paused at 15s remaining. Now unpaused (pausedAt=null).
    // Elapsed = 20s since timerStartedAt, duration=45s → 25s remaining
    const result = getTimeRemaining(now - 20000, 45000, null, null)
    expect(result).toBe(25000)
  })

  // Edge — timerDuration of 0
  it("returns 0 immediately when timerDuration is 0 and timerStartedAt is set", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    expect(getTimeRemaining(now, 0, null, null)).toBe(0)
    expect(getTimeRemaining(now - 1, 0, null, null)).toBe(0)
  })

  // Edge — large timerDuration without overflow
  it("handles large timerDuration without overflow", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    // 1 hour timer, started 30 min ago
    const result = getTimeRemaining(now - 30 * 60 * 1000, 60 * 60 * 1000, null, null)
    expect(result).toBe(30 * 60 * 1000)
  })

  // Pause with null timeRemainingAtPause (edge — should not happen, but handle)
  it("returns 0 when paused but timeRemainingAtPause is null", () => {
    const now = 1700000000000
    vi.spyOn(Date, "now").mockReturnValue(now)
    expect(getTimeRemaining(now - 5000, 30000, now, null)).toBe(0)
  })
})
