import { onValue, ref } from "firebase/database"
import { db } from "$lib/firebase"
import type { Team } from "$lib/db-types"

/**
 * Reactive subscription to `/rooms/{roomId}/teams`.
 * Returns record of teamId → Team as read-only `$state`.
 * Call `destroy()` to unsubscribe.
 */
export function createTeamsStore(roomId: string) {
  let teams: Record<string, Team> = $state({})

  const teamsRef = ref(db, `rooms/${roomId}/teams`)

  const unsub = onValue(teamsRef, (snap) => {
    if (snap.exists()) {
      teams = snap.val() as Record<string, Team>
    } else {
      teams = {}
    }
  })

  return {
    get teams() {
      return teams
    },
    destroy() {
      unsub()
    },
  }
}
