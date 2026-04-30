import { onValue, ref } from "firebase/database"
import { db } from "$lib/firebase"
import type { Player } from "$lib/db-types"

export function createPlayersStore(roomId: string) {
  let players: Record<string, Player> = $state({})

  const playersRef = ref(db, `rooms/${roomId}/players`)

  const unsub = onValue(playersRef, (snap) => {
    if (snap.exists()) {
      players = snap.val() as Record<string, Player>
    } else {
      players = {}
    }
  })

  return {
    get players() {
      return players
    },
    destroy() {
      unsub()
    },
  }
}
