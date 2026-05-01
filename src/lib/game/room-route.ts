import { RoomStatus } from "$lib/db-types"

export type RoomScreen =
  | { kind: "loading" }
  | { kind: "name-entry" }
  | { kind: "word-entry" }
  | { kind: "lobby" }
  | { kind: "playing" }
  | { kind: "finished" }
  | { kind: "game-already-started" }
  | { kind: "unknown"; raw: string }

/**
 * Pure routing decision for /room/[roomId] page.
 * Determines which screen to render based on RTDB-derived state.
 *
 * status       — room status from RTDB (null while loading)
 * playerExists — does the local player node exist in RTDB?
 * configExists — does room.config exist in RTDB?
 */
export function getRoomRoute(
  status: string | null,
  playerExists: boolean,
  configExists: boolean,
): RoomScreen {
  // RTDB hasn't returned data yet
  if (status === null) {
    return { kind: "loading" }
  }

  // Player not joined + game already started or finished
  if (!playerExists && (status === RoomStatus.Playing || status === RoomStatus.Finished)) {
    return { kind: "game-already-started" }
  }

  // Player not joined + room in pre-game phase — show name entry
  if (!playerExists && (status === RoomStatus.WordEntry || status === RoomStatus.PreStart)) {
    return { kind: "name-entry" }
  }

  // Player joined — route by status
  if (status === RoomStatus.WordEntry) {
    return { kind: "word-entry" }
  }

  if (status === RoomStatus.PreStart) {
    // Lobby requires config to be loaded
    if (!configExists) {
      return { kind: "loading" }
    }
    return { kind: "lobby" }
  }

  if (status === RoomStatus.Playing) {
    return { kind: "playing" }
  }

  if (status === RoomStatus.Finished) {
    return { kind: "finished" }
  }

  return { kind: "unknown", raw: String(status) }
}
