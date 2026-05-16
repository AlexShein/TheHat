<script lang="ts">
  import { goto } from "$app/navigation"
  import { auth, db } from "$lib/firebase"
  import { authStore } from "$lib/stores/auth.svelte"
  import { signInWithGoogle, signInDevEmail, signOut, isAdmin } from "$lib/auth"
  import RoomCreation from "$lib/components/phases/RoomCreation.svelte"
  import RoomCreated from "$lib/components/phases/RoomCreated.svelte"

  const isEmulator = import.meta.env.VITE_USE_EMULATOR === "true"

  let isUserAdmin = $state(false)
  let adminCheckDone = $state(false)
  let adminCheckError = $state("")
  let devEmail = $state("")
  let devPassword = $state("")
  let devError = $state("")
  let joining = $state(false)
  let joinInput = $state("")
  let joinError = $state("")
  let googleError = $state("")

  // Room creation flow
  let creating = $state(false)
  let createdRoomId = $state("")

  // isAdmin check: runs only when auth settles and user is signed in
  $effect(() => {
    const user = authStore.currentUser
    if (!user) {
      isUserAdmin = false
      adminCheckDone = true
      adminCheckError = ""
      return
    }
    isAdmin(db, auth).then(
      (result) => {
        isUserAdmin = result
        adminCheckDone = true
        adminCheckError = ""
      },
      (err: unknown) => {
        adminCheckError = err instanceof Error ? err.message : "Failed to check admin status"
        adminCheckDone = true
        isUserAdmin = false
      },
    )
  })

  async function handleGoogleSignIn() {
    googleError = ""
    try {
      await signInWithGoogle(auth)
    } catch (e: unknown) {
      googleError = e instanceof Error ? e.message : "Google sign-in failed"
    }
  }

  async function handleDevSignIn() {
    devError = ""
    try {
      await signInDevEmail(auth, devEmail.trim(), devPassword)
    } catch (e: unknown) {
      devError = e instanceof Error ? e.message : "Sign-in failed"
    }
  }

  async function handleSignOut() {
    await signOut(auth)
    isUserAdmin = false
    adminCheckDone = true
  }

  async function handleJoin() {
    joining = true
    joinError = ""
    const raw = joinInput.trim()
    if (!raw) {
      joinError = "Enter a room ID or invite link"
      joining = false
      return
    }
    // Extract roomId from full URL or plain ID
    let roomId = raw
    try {
      const url = new URL(raw)
      const parts = url.pathname.split("/")
      roomId = parts[parts.length - 1] || parts[parts.length - 2] || raw
    } catch {
      // Not a URL, use raw input as roomId
    }
    if (!roomId || roomId.length < 1) {
      joinError = "Invalid room ID"
      joining = false
      return
    }
  // eslint-disable-next-line svelte/no-navigation-without-resolve
    return goto(`/room/${roomId}`)
  }

  function onRoomCreated(roomId: string) {
    createdRoomId = roomId
    creating = false
  }

  function handleStartPlaying() {
    // eslint-disable-next-line svelte/no-navigation-without-resolve
    return goto(`/room/${createdRoomId}`)
  }

  // Show loading spinner inherited from layout? No — layout already handles loading.
  // But isAdmin check is async, so adminCheckDone gates the full UI.
  let showAdminSpinner = $derived(authStore.currentUser && !adminCheckDone)
</script>

<div class="mx-auto max-w-md px-container-padding pt-16">
  <h1 class="font-display text-display text-on-surface text-center">The Hat</h1>
  <p class="text-center mt-2 mb-4 text-body-md text-on-surface-variant">Word guessing game</p>

  <!-- Admin check error -->
  {#if adminCheckError}
    <div class="mt-4 p-3 bg-error-container border border-error rounded text-on-error-container text-body-md" role="alert">
      {adminCheckError}
    </div>
  {/if}

  <!-- Admin check spinner -->
  {#if showAdminSpinner}
    <div class="flex justify-center mt-8" role="status" aria-label="Checking permissions">
      <div class="animate-spin h-8 w-8 border-4 border-secondary border-t-transparent rounded-full"></div>
    </div>
  {:else if createdRoomId}
    <RoomCreated
      roomId={createdRoomId}
      onStartPlaying={handleStartPlaying}
    />
  {:else if creating}
    <RoomCreation
      isAdmin={isUserAdmin}
      onRoomCreated={onRoomCreated}
    />
  {:else}
    <div class="mt-8 space-y-6">
      {#if authStore.currentUser}
        <!-- Signed in -->
        <p class="text-center text-body-md text-on-surface-variant">
          Signed in as <span class="font-display font-semibold">{authStore.currentUser.displayName ?? authStore.currentUser.email ?? "Unknown"}</span>
        </p>
        <button
          class="block mx-auto text-body-md text-error underline min-h-[44px]"
          onclick={handleSignOut}
          aria-label="Sign out"
        >
          Sign out
        </button>
      {:else if isEmulator}
        <!-- Emulator signed out: email + password -->
        <div class="space-y-3">
          <label class="block" for="dev-email">
            <span class="text-body-md text-on-surface">Email (dev)</span>
            <input
              id="dev-email"
              type="email"
              bind:value={devEmail}
              class="mt-1 block w-full rounded border border-outline-variant bg-surface-container px-3 py-2 min-h-[44px] text-body-md text-on-surface"
              placeholder="admin@test.com"
            />
          </label>
          <label class="block" for="dev-password">
            <span class="text-body-md text-on-surface">Password (dev)</span>
            <input
              id="dev-password"
              type="password"
              bind:value={devPassword}
              class="mt-1 block w-full rounded border border-outline-variant bg-surface-container px-3 py-2 min-h-[44px] text-body-md text-on-surface"
              placeholder="password123"
            />
          </label>
          {#if devError}
            <p class="text-body-md text-error" role="alert">{devError}</p>
          {/if}
          <button
            class="w-full rounded bg-primary text-on-primary font-display font-semibold px-4 py-3 min-h-[44px] text-body-md"
            onclick={handleDevSignIn}
            aria-label="Sign in with dev credentials"
          >
            Sign In (Dev)
          </button>
        </div>
      {:else}
        <!-- Production signed out -->
        <button
          class="w-full rounded border border-outline-variant bg-surface px-4 py-3 font-display font-semibold min-h-[44px] flex items-center justify-center gap-2 text-body-md text-on-surface"
          onclick={handleGoogleSignIn}
          aria-label="Sign in with Google"
        >
          Sign in with Google
        </button>
        {#if googleError}
          <p class="text-body-md text-error text-center" role="alert">{googleError}</p>
        {/if}
      {/if}

      <!-- Creator-only: Create Game button -->
      {#if isUserAdmin && !createdRoomId}
        <hr class="my-4 border-outline-variant" />
        <button
          class="w-full rounded bg-primary text-on-primary font-display font-semibold px-4 py-3 min-h-[44px] text-body-md"
          onclick={() => (creating = true)}
          aria-label="Create a new game room"
        >
          Create Game
        </button>
      {/if}

      <!-- Join a game: always visible -->
      <hr class="my-4 border-outline-variant" />
      <div class="space-y-3">
        <label class="block" for="join-input">
          <span class="text-body-md font-display font-medium text-on-surface">Join a game</span>
          <input
            id="join-input"
            type="text"
            bind:value={joinInput}
            class="mt-1 block w-full rounded border border-outline-variant bg-surface-container px-3 py-2 min-h-[44px] text-body-md text-on-surface"
            placeholder="Room ID or invite link"
          />
        </label>
        {#if joinError}
          <p class="text-body-md text-error" role="alert">{joinError}</p>
        {/if}
        <button
          class="w-full rounded bg-primary text-on-primary font-display font-semibold px-4 py-3 min-h-[44px] text-body-md"
          onclick={handleJoin}
          aria-label="Join the game room"
        >
          {joining ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  {/if}
</div>