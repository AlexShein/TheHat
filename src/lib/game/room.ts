import { ref, set, get, onDisconnect, serverTimestamp } from "firebase/database"
import type { Database } from "firebase/database"
import type { Player, RoomConfig } from "$lib/db-types"
import { assignColor } from "$lib/colors"

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
  isAdmin: boolean,
): Promise<void> {
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`)
  const existingSnap = await get(playerRef)

  if (existingSnap.exists()) {
    // Reconnect: preserve name, color, and isAdmin, just mark connected
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
    isAdmin,
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

/**
 * Joins a room as the currently authenticated user.
 * Reads existing player colors from RTDB, assigns a unique color,
 * writes player node with playerId matching auth UID (required by security rules),
 * then registers onDisconnect cleanup.
 *
 * Returns the playerId (auth UID) used as the node key.
 */
export async function joinRoomAsCurrentUser(
  db: Database,
  roomId: string,
  playerId: string,
  name: string,
): Promise<void> {
  // Read existing players to compute used colors
  const playersSnap = await get(ref(db, `rooms/${roomId}/players`))
  const usedColors = new Set<string>()

  if (playersSnap.exists()) {
    const players = playersSnap.val() as Record<string, Player>
    for (const p of Object.values(players)) {
      if (p.color) usedColors.add(p.color)
    }
  }

  const color = assignColor(usedColors)

  // Check if this user is in the /admins whitelist
  const adminSnap = await get(ref(db, `admins/${playerId}`))
  const isAdmin = adminSnap.exists()

  await joinRoom(db, roomId, playerId, name, color, isAdmin)
  await registerDisconnect(db, roomId, playerId)
}
