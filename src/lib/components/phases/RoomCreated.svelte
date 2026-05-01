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
  <h2 class="text-xl font-semibold text-center">Room Created</h2>

  <div class="bg-gray-100 rounded p-4 text-center">
    <p class="text-sm text-gray-600">Room ID</p>
    <p class="text-2xl font-mono font-bold tracking-wider mt-1">{roomId}</p>
    <button
      class="mt-2 text-sm text-blue-600 underline min-h-[44px]"
      onclick={copyRoomId}
      aria-label="Copy room ID to clipboard"
    >
      {copiedRoomId ? "Copied!" : "Copy Room ID"}
    </button>
  </div>

  <div class="bg-gray-100 rounded p-4">
    <p class="text-sm text-gray-600 text-center">Invite Link</p>
    <p class="text-xs font-mono break-all mt-1 text-center">{inviteLink}</p>
    <button
      class="block mx-auto mt-2 text-sm text-blue-600 underline min-h-[44px]"
      onclick={copyInviteLink}
      aria-label="Copy invite link to clipboard"
    >
      {copiedLink ? "Copied!" : "Copy Invite Link"}
    </button>
  </div>

  <div class="flex flex-col items-center">
    <p class="text-sm text-gray-600 mb-2">Scan to join</p>
    <img
      src={qrUrl}
      alt="QR code for invite link"
      class="border border-gray-300 rounded"
      width={180}
      height={180}
    />
  </div>

  <button
    class="w-full rounded bg-blue-600 px-4 py-3 text-white font-medium min-h-[44px]"
    onclick={onStartPlaying}
    aria-label="Start playing, enter the room"
  >
    Start Playing
  </button>
</div>