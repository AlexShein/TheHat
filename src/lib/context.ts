import { getContext, setContext } from "svelte"
import type { User } from "firebase/auth"

export const AUTH_CONTEXT_KEY = Symbol("auth")

export interface AuthContext {
  currentUser: User | null
  loading: boolean
}

export function setAuthContext(ctx: AuthContext): void {
  setContext(AUTH_CONTEXT_KEY, ctx)
}

export function getAuthContext(): AuthContext {
  return getContext<AuthContext>(AUTH_CONTEXT_KEY)
}
