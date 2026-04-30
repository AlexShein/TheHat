<script lang="ts">
  import "../app.css"
  import { onMount } from "svelte"
  import { auth } from "$lib/firebase"
  import { initAuth, handleRedirectResult } from "$lib/auth"
  import type { AuthContext } from "$lib/context"
  import { setAuthContext } from "$lib/context"
  import type { User } from "firebase/auth"

  let { children } = $props()

  let currentUser = $state<User | null>(null)
  let loading = $state(true)

  onMount(() => {
    // Handle redirect result from signInWithRedirect flow
    handleRedirectResult(auth).catch(() => {
      // Redirect result errors are benign — user may not have come from redirect
    })

    const unsub = initAuth(auth, (user) => {
      currentUser = user
      loading = false
    })

    return unsub
  })

  const ctx: AuthContext = {
    get currentUser() {
      return currentUser
    },
    get loading() {
      return loading
    },
  }
  setAuthContext(ctx)
</script>

{#if loading}
  <div class="flex items-center justify-center min-h-screen" role="status" aria-label="Loading">
    <div class="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
  </div>
{:else}
  {@render children()}
{/if}