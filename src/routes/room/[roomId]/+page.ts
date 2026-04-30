import type { PageLoad } from "./$types"

/** Resolves roomId from route param and playerId from ?p= query param. */
export const load: PageLoad = ({ params, url }) => {
  return {
    roomId: params.roomId,
    playerId: url.searchParams.get("p"),
  }
}
