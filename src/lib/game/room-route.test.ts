import { describe, it, expect } from "vitest"
import { getRoomRoute } from "./room-route"
import { RoomStatus } from "$lib/db-types"

describe("getRoomRoute", () => {
  it("returns loading when status is null (RTDB not yet returned)", () => {
    const result = getRoomRoute(null, false, false)
    expect(result.kind).toBe("loading")
  })

  it("returns name-entry when player not joined and status is word-entry", () => {
    const result = getRoomRoute(RoomStatus.WordEntry, false, false)
    expect(result.kind).toBe("name-entry")
  })

  it("returns name-entry when player not joined and status is pre-start (fixes stuck 'Loading lobby…')", () => {
    // Bug: user with no player node lands on /room/{id} after admin advanced to lobby.
    // Before fix, page showed "Loading lobby…" forever because it required
    // localPlayerId && playersStore.players[localPlayerId] && roomStore.config
    // for PreStart, which is false when player hasn't joined.
    const result = getRoomRoute(RoomStatus.PreStart, false, false)
    expect(result.kind).toBe("name-entry")
  })

  it("returns game-already-started when player not joined and status is playing", () => {
    const result = getRoomRoute(RoomStatus.Playing, false, false)
    expect(result.kind).toBe("game-already-started")
  })

  it("returns game-already-started when player not joined and status is finished", () => {
    const result = getRoomRoute(RoomStatus.Finished, false, false)
    expect(result.kind).toBe("game-already-started")
  })

  it("returns word-entry when player joined and status is word-entry", () => {
    const result = getRoomRoute(RoomStatus.WordEntry, true, false)
    expect(result.kind).toBe("word-entry")
  })

  it("returns lobby when player joined, status is pre-start, and config exists", () => {
    const result = getRoomRoute(RoomStatus.PreStart, true, true)
    expect(result.kind).toBe("lobby")
  })

  it("returns loading when player joined, status is pre-start, but config not yet loaded", () => {
    // Race condition: player store resolved, room store still loading config
    const result = getRoomRoute(RoomStatus.PreStart, true, false)
    expect(result.kind).toBe("loading")
  })

  it("returns playing when player joined and status is playing", () => {
    const result = getRoomRoute(RoomStatus.Playing, true, false)
    expect(result.kind).toBe("playing")
  })

  it("returns finished when player joined and status is finished", () => {
    const result = getRoomRoute(RoomStatus.Finished, true, false)
    expect(result.kind).toBe("finished")
  })

  it("returns unknown with raw value for unrecognized status", () => {
    const result = getRoomRoute("bogus-status", true, false)
    expect(result.kind).toBe("unknown")
    expect((result as { kind: "unknown"; raw: string }).raw).toBe("bogus-status")
  })
})
