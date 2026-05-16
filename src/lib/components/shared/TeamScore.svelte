<script lang="ts">
  import { getTeamColorClasses } from "$lib/team-colors"

  let {
    teamName,
    teamId,
    score,
    isActive,
  }: {
    teamName: string
    teamId: string
    score: number
    isActive: boolean
  } = $props()

  const tc = $derived(getTeamColorClasses(teamId))
</script>

<div
  class="flex items-center justify-between rounded border-l-8 px-3 py-2 min-h-[44px] box-border {isActive
    ? tc.activeBg + ' ' + tc.activeBorder
    : 'bg-surface-container border-outline-variant'}"
  aria-label="Team {teamName}: {score} points{isActive ? ', active' : ''}"
>
  <span
    class="font-display font-semibold text-body-md {isActive ? tc.activeText : 'text-on-surface-variant'}"
  >
    {teamName}
  </span>
  <span
    class="font-display text-headline-md tabular-nums {isActive ? tc.stripe.replace('border-', 'text-') : 'text-on-surface'}"
  >
    {score}
  </span>
</div>
