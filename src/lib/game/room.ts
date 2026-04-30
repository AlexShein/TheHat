import { ref, set, get, onDisconnect, serverTimestamp } from "firebase/database"
import type { Database } from "firebase/database"
import type { RoomConfig } from "$lib/db-types"

function generateRoomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

/**
 * Creates a new room node at /rooms/{roomId}.
 * Writes meta, config, and status in parallel.
 * Throws if caller lacks write permission (not admin per security rules).
 */
export async function createRoom(db: Database, config: RoomConfig, adminUid: string): Promise<string> {
  const roomId = generateRoomId()

  await set(ref(db, `rooms/${roomId}/meta`), {
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    lastActiveAt: serverTimestamp(),
  })

  await set(ref(db, `rooms/${roomId}/config`), config)

  await set(ref(db, `rooms/${roomId}/status`), "word-entry")

  return roomId
}

/**
 * Writes a player node into /rooms/{roomId}/players/{playerId}.
 * Does NOT overwrite name or color if player already exists (reconnect).
 */
export async function joinRoom(
  db: Database,
  roomId: string,
  playerId: string,
  name: string,
  color: string,
): Promise<void> {
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`)
  const existingSnap = await get(playerRef)

  if (existingSnap.exists()) {
    // Reconnect: preserve name and color, just mark connected
    await set(ref(db, `rooms/${roomId}/players/${playerId}/connected`), true)
    return
  }

  await set(playerRef, {
    name,
    color,
    teamId: null,
    wordsSubmitted: false,
    ready: false,
    connected: true,
    isAdmin: false,
  })
}

/**
 * Registers onDisconnect handler to set connected=false BEFORE setting connected=true.
 * Order is critical: if client crashes between set(true) and onDisconnect registration,
 * player appears permanently online.
 */
export async function registerDisconnect(db: Database, roomId: string, playerId: string): Promise<void> {
  const connectedRef = ref(db, `rooms/${roomId}/players/${playerId}/connected`)

  // Step 1: Register auto-cleanup
  await onDisconnect(connectedRef).set(false)

  // Step 2: Mark as online
  await set(connectedRef, true)
}
