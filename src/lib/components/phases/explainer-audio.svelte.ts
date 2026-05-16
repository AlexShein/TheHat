/**
 * Plays a short beep and triggers device vibration when the explainer's
 * turn ends (phase transitions to post_expiry or post_turn).
 *
 * This is extracted from ExplainerView.svelte to keep the component
 * within the 200-line limit per constraints.
 */
export function playExpiryFeedback(phase: string) {
  if (phase !== "post_expiry" && phase !== "post_turn") return

  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 200
    gain.gain.value = 0.3
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Audio not available — silently skip
  }
  try {
    navigator.vibrate(300)
  } catch {
    // Vibration not available — silently skip
  }
}
