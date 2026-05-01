import { onValue, ref, type DataSnapshot } from "firebase/database"
import { db } from "$lib/firebase"
import type { RoomMeta, RoomConfig, RoomStatus } from "$lib/db-types"

function snapshotValue<T>(snap: DataSnapshot): T | null {
  return snap.exists() ? (snap.val() as T) : null
}

export function createRoomStore(roomId: string) {
  let meta = $state<RoomMeta | null>(null)
  let config = $state<RoomConfig | null>(null)
  let status = $state<RoomStatus | null>(null)

  const metaRef = ref(db, `rooms/${roomId}/meta`)
  const configRef = ref(db, `rooms/${roomId}/config`)
  const statusRef = ref(db, `rooms/${roomId}/status`)

  const unsubMeta = onValue(metaRef, (snap) => {
    meta = snapshotValue<RoomMeta>(snap)
  })

  const unsubConfig = onValue(configRef, (snap) => {
    config = snapshotValue<RoomConfig>(snap)
  })

  const unsubStatus = onValue(statusRef, (snap) => {
    status = (snap.val() as RoomStatus) ?? null
  })

  return {
    get meta() {
      return meta
    },
    get config() {
      return config
    },
    get status() {
      return status
    },
    destroy() {
      unsubMeta()
      unsubConfig()
      unsubStatus()
    },
  }
}
