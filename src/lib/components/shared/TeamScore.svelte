<script lang="ts">
  let {
    teamName,
    score,
    isActive,
  }: {
    teamName: string
    score: number
    isActive: boolean
  } = $props()
</script>

<div
  class="flex items-center justify-between rounded px-3 py-2 min-h-[44px] {isActive
    ? 'bg-blue-100 ring-2 ring-blue-400'
    : 'bg-white border border-gray-200'}"
  aria-label="Team {teamName}: {score} points{isActive ? ', active' : ''}"
>
  <span
    class="font-semibold text-sm {isActive ? 'text-blue-700' : 'text-gray-700'}"
  >
    {teamName}
  </span>
  <span
    class="text-lg font-mono tabular-nums {isActive ? 'text-blue-800' : 'text-gray-600'}"
  >
    {score}
  </span>
</div>