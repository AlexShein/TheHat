<script lang="ts">
  import { getTimeRemaining } from "$lib/game/timer"

  let {
    timerStartedAt,
    timerDuration,
    pausedAt,
    timeRemainingAtPause,
  }: {
    timerStartedAt: number | null
    timerDuration: number
    pausedAt: number | null
    timeRemainingAtPause: number | null
  } = $props()

  let display = $state(0)

  $effect(() => {
    display = getTimeRemaining(
      timerStartedAt,
      timerDuration,
      pausedAt,
      timeRemainingAtPause,
    )

    const interval = setInterval(() => {
      display = getTimeRemaining(
        timerStartedAt,
        timerDuration,
        pausedAt,
        timeRemainingAtPause,
      )
    }, 100)

    return () => clearInterval(interval)
  })

  const totalSeconds = $derived(Math.ceil(display / 1000))
  const minutes = $derived(Math.floor(totalSeconds / 60))
  const secs = $derived(totalSeconds % 60)
  const formatted = $derived(
    `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
  )
  const isLow = $derived(display < 10000)
</script>

<div
  class="flex items-center justify-center"
  aria-live="polite"
  aria-label="Timer: {formatted}"
>
  <span
    class="text-5xl font-mono tabular-nums min-w-[88px] min-h-[44px] leading-[44px] inline-block {isLow
      ? 'text-red-500'
      : 'text-current'}"
  >
    {formatted}
  </span>
</div>