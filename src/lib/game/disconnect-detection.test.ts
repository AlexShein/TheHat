import { describe, it, expect } from "vitest"
import { shouldAutoPauseOnExplainerDisconnect, shouldAutoPauseOnTeamDrop } from "./disconnect-detection"

describe("shouldAutoPauseOnExplainerDisconnect", () => {
  // AC 10: true→false transition during explaining with no pause
  it("returns true when wasConnected=true, isConnected=false, phase=explaining, pausedAt=null", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(true, false, "explaining", null)).toBe(true)
  })

  // AC 12: works for post_expiry too
  it("returns true when phase=post_expiry", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(true, false, "post_expiry", null)).toBe(true)
  })

  // AC 11: does not fire if already paused
  it("returns false when already paused (pausedAt not null)", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(true, false, "explaining", 12345)).toBe(false)
  })

  // AC 12: does not fire outside explaining/post_expiry
  it("returns false when phase is waiting_start", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(true, false, "waiting_start", null)).toBe(false)
  })

  it("returns false when phase is post_turn", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(true, false, "post_turn", null)).toBe(false)
  })

  it("returns false when phase is round_end", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(true, false, "round_end", null)).toBe(false)
  })

  // Not a true→false transition (was already false)
  it("returns false when wasConnected=false and isConnected=false (no transition)", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(false, false, "explaining", null)).toBe(false)
  })

  // false→true transition (reconnect) — should not trigger
  it("returns false on false→true transition (reconnect)", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(false, true, "explaining", null)).toBe(false)
  })

  // staying connected
  it("returns false when staying connected (no transition)", () => {
    expect(shouldAutoPauseOnExplainerDisconnect(true, true, "explaining", null)).toBe(false)
  })
})

describe("shouldAutoPauseOnTeamDrop", () => {
  // AC 13: team drops below 2 during gameplay
  it("returns teamId when a team has only 1 connected player during explaining", () => {
    const counts = new Map([
      ["team-1", 1],
      ["team-2", 3],
    ])
    expect(shouldAutoPauseOnTeamDrop(counts, "explaining", null, false)).toBe("team-1")
  })

  it("returns teamId when a team has 0 connected players", () => {
    const counts = new Map([
      ["team-1", 2],
      ["team-2", 0],
    ])
    expect(shouldAutoPauseOnTeamDrop(counts, "explaining", null, false)).toBe("team-2")
  })

  // Both teams fine
  it("returns null when all teams have ≥2 connected players", () => {
    const counts = new Map([
      ["team-1", 2],
      ["team-2", 3],
    ])
    expect(shouldAutoPauseOnTeamDrop(counts, "explaining", null, false)).toBeNull()
  })

  // Does not fire if already paused
  it("returns null when game is already paused", () => {
    const counts = new Map([["team-1", 1]])
    expect(shouldAutoPauseOnTeamDrop(counts, "explaining", 12345, false)).toBeNull()
  })

  // AC 16: bypassed when bypassMinPlayers=true
  it("returns null when bypassMinPlayers is true (even with team < 2)", () => {
    const counts = new Map([["team-1", 1]])
    expect(shouldAutoPauseOnTeamDrop(counts, "explaining", null, true)).toBeNull()
  })

  // Only triggers during gameplay phases
  it("returns null when phase is post_turn", () => {
    const counts = new Map([["team-1", 1]])
    expect(shouldAutoPauseOnTeamDrop(counts, "post_turn", null, false)).toBeNull()
  })

  it("returns null when phase is round_end", () => {
    const counts = new Map([["team-1", 1]])
    expect(shouldAutoPauseOnTeamDrop(counts, "round_end", null, false)).toBeNull()
  })

  // waiting_start is a gameplay phase — should trigger
  it("returns teamId when phase is waiting_start and team < 2", () => {
    const counts = new Map([["team-1", 1]])
    expect(shouldAutoPauseOnTeamDrop(counts, "waiting_start", null, false)).toBe("team-1")
  })

  // post_expiry should also trigger
  it("returns teamId when phase is post_expiry and team < 2", () => {
    const counts = new Map([["team-1", 1]])
    expect(shouldAutoPauseOnTeamDrop(counts, "post_expiry", null, false)).toBe("team-1")
  })

  // Empty map — no teams fall below threshold
  it("returns null when teamConnectedCounts map is empty", () => {
    expect(shouldAutoPauseOnTeamDrop(new Map(), "explaining", null, false)).toBeNull()
  })

  // First team to fall below 2 is returned (deterministic iteration order)
  it("returns first team that falls below threshold when multiple teams are below 2", () => {
    const counts = new Map([
      ["team-a", 1],
      ["team-b", 0],
    ])
    const result = shouldAutoPauseOnTeamDrop(counts, "explaining", null, false)
    expect(result).toBe("team-a")
  })
})
