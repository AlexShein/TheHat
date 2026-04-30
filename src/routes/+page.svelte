<script lang="ts">
  import { goto } from "$app/navigation"
  import { auth, db } from "$lib/firebase"
  import { getAuthContext } from "$lib/context"
  import { signInWithGoogle, signInDevEmail, signOut, isAdmin } from "$lib/auth"
  import RoomCreation from "$lib/components/phases/RoomCreation.svelte"
  import RoomCreated from "$lib/components/phases/RoomCreated.svelte"

  const isEmulator = import.meta.env.VITE_USE_EMULATOR === "true"

  const { currentUser } = getAuthContext()

  let isUserAdmin = $state(false)
  let adminCheckDone = $state(false)
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
    const user = currentUser
    if (!user) {
      isUserAdmin = false
      adminCheckDone = true
      return
    }
    isAdmin(db, auth).then((result) => {
      isUserAdmin = result
      adminCheckDone = true
    })
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
  let showAdminSpinner = $derived(currentUser && !adminCheckDone)
</script>

<div class="mx-auto max-w-md px-4 pt-16">
  <h1 class="text-3xl font-bold text-center">The Hat</h1>
  <p class="text-center mt-2 text-gray-600">Word guessing game</p>

  <!-- Admin check spinner -->
  {#if showAdminSpinner}
    <div class="flex justify-center mt-8" role="status" aria-label="Checking permissions">
      <div class="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
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
      {#if currentUser}
        <!-- Signed in -->
        <p class="text-center text-sm text-gray-600">
          Signed in as <span class="font-medium">{currentUser.displayName ?? currentUser.email ?? "Unknown"}</span>
        </p>
        <button
          class="block mx-auto text-sm text-red-600 underline min-h-[44px]"
          onclick={handleSignOut}
          aria-label="Sign out"
        >
          Sign out
        </button>
      {:else if isEmulator}
        <!-- Emulator signed out: email + password -->
        <div class="space-y-3">
          <label class="block" for="dev-email">
            <span class="text-sm text-gray-700">Email (dev)</span>
            <input
              id="dev-email"
              type="email"
              bind:value={devEmail}
              class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 min-h-[44px]"
              placeholder="admin@test.com"
            />
          </label>
          <label class="block" for="dev-password">
            <span class="text-sm text-gray-700">Password (dev)</span>
            <input
              id="dev-password"
              type="password"
              bind:value={devPassword}
              class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 min-h-[44px]"
              placeholder="password123"
            />
          </label>
          {#if devError}
            <p class="text-sm text-red-600" role="alert">{devError}</p>
          {/if}
          <button
            class="w-full rounded bg-blue-600 px-4 py-3 text-white font-medium min-h-[44px]"
            onclick={handleDevSignIn}
            aria-label="Sign in with dev credentials"
          >
            Sign In (Dev)
          </button>
        </div>
      {:else}
        <!-- Production signed out -->
        <button
          class="w-full rounded bg-white border border-gray-300 px-4 py-3 font-medium min-h-[44px] flex items-center justify-center gap-2"
          onclick={handleGoogleSignIn}
          aria-label="Sign in with Google"
        >
          Sign in with Google
        </button>
        {#if googleError}
          <p class="text-sm text-red-600 text-center" role="alert">{googleError}</p>
        {/if}
      {/if}

      <!-- Creator-only: Create Game button -->
      {#if isUserAdmin && !createdRoomId}
        <hr class="my-4" />
        <button
          class="w-full rounded bg-green-600 px-4 py-3 text-white font-medium min-h-[44px]"
          onclick={() => (creating = true)}
          aria-label="Create a new game room"
        >
          Create Game
        </button>
      {/if}

      <!-- Join a game: always visible -->
      <hr class="my-4" />
      <div class="space-y-3">
        <label class="block" for="join-input">
          <span class="text-sm font-medium text-gray-700">Join a game</span>
          <input
            id="join-input"
            type="text"
            bind:value={joinInput}
            class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 min-h-[44px]"
            placeholder="Room ID or invite link"
          />
        </label>
        {#if joinError}
          <p class="text-sm text-red-600" role="alert">{joinError}</p>
        {/if}
        <button
          class="w-full rounded bg-blue-600 px-4 py-3 text-white font-medium min-h-[44px]"
          onclick={handleJoin}
          aria-label="Join the game room"
        >
          {joining ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  {/if}
</div>