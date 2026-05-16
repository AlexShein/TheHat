<script lang="ts">
  interface Props {
    roomId: string
    onStartPlaying: () => void
  }

  let { roomId, onStartPlaying }: Props = $props()

  let inviteLink = $derived(`${window.location.origin}/room/${roomId}`)
  let qrUrl = $derived(
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteLink)}`,
  )
  let copiedRoomId = $state(false)
  let copiedLink = $state(false)

  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId)
      copiedRoomId = true
      setTimeout(() => (copiedRoomId = false), 2000)
    } catch {
      // Clipboard API unavailable — user must copy manually
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      copiedLink = true
      setTimeout(() => (copiedLink = false), 2000)
    } catch {
      // Clipboard API unavailable — user must copy manually
    }
  }
</script>

<div class="space-y-5">
  <h2 class="font-display text-headline-md text-on-surface text-center">Room Created</h2>

  <div class="bg-surface-container border border-outline-variant rounded p-4 text-center">
    <p class="text-label-caps text-on-surface-variant">Room ID</p>
    <p class="text-display font-display tracking-wider mt-1">{roomId}</p>
    <button
      class="mt-2 text-body-md text-secondary underline min-h-[44px]"
      onclick={copyRoomId}
      aria-label="Copy room ID to clipboard"
    >
      {copiedRoomId ? "Copied!" : "Copy Room ID"}
    </button>
  </div>

  <div class="bg-surface-container border border-outline-variant rounded p-4">
    <p class="text-label-caps text-on-surface-variant text-center">Invite Link</p>
    <p class="text-body-md break-all mt-1 text-center">{inviteLink}</p>
    <button
      class="block mx-auto mt-2 text-body-md text-secondary underline min-h-[44px]"
      onclick={copyInviteLink}
      aria-label="Copy invite link to clipboard"
    >
      {copiedLink ? "Copied!" : "Copy Invite Link"}
    </button>
  </div>

  <div class="flex flex-col items-center">
    <p class="text-body-md text-on-surface-variant mb-2">Scan to join</p>
    <img
      src={qrUrl}
      alt="QR code for invite link"
      class="border border-outline-variant rounded"
      width={180}
      height={180}
    />
  </div>

  <button
    class="w-full rounded bg-primary text-on-primary font-display font-semibold py-3 min-h-[44px] text-body-md"
    onclick={onStartPlaying}
    aria-label="Start playing, enter the room"
  >
    Start Playing
  </button>
</div>