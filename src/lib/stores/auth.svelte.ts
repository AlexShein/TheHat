import type { User } from "firebase/auth"

/** Module-level reactive auth state. Components import and read directly. */
export const authStore = {
  currentUser: null as User | null,
  loading: true,
  error: null as string | null,
} as {
  currentUser: User | null
  loading: boolean
  error: string | null
  setUser(user: User | null): void
  setLoading(v: boolean): void
  setError(msg: string | null): void
}

// Reactive state — Svelte 5 compiler transforms $state in .svelte.ts files
let currentUser: User | null = $state(null)
let loading: boolean = $state(true)
let error: string | null = $state(null)

authStore.setUser = (user: User | null) => {
  currentUser = user
  loading = false
}

authStore.setLoading = (v: boolean) => {
  loading = v
}

authStore.setError = (msg: string | null) => {
  error = msg
}

// Getters re-evaluate on every access, tracking $state deps in components
Object.defineProperty(authStore, "currentUser", {
  get() {
    return currentUser
  },
  enumerable: true,
  configurable: true,
})

Object.defineProperty(authStore, "loading", {
  get() {
    return loading
  },
  enumerable: true,
  configurable: true,
})

Object.defineProperty(authStore, "error", {
  get() {
    return error
  },
  enumerable: true,
  configurable: true,
})

/** Reset to initial state. Exported for tests. */
export function resetAuthStore(): void {
  currentUser = null
  loading = true
  error = null
}
