<script lang="ts">
  import "../app.css"
  import { onMount } from "svelte"
  import { auth } from "$lib/firebase"
  import { initAuth, handleRedirectResult } from "$lib/auth"
  import { authStore } from "$lib/stores/auth.svelte"

  let { children } = $props()

  onMount(() => {
    // Handle redirect result from signInWithRedirect flow
    handleRedirectResult(auth).catch(() => {
      // Redirect result errors are benign — user may not have come from redirect
    })

    const unsub = initAuth(auth, (user) => {
      authStore.setUser(user)
    })

    return unsub
  })
</script>

{#if authStore.loading}
  <div class="flex items-center justify-center min-h-screen" role="status" aria-label="Loading">
    <div class="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
  </div>
{:else}
  {@render children()}
{/if}