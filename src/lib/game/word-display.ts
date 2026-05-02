/**
 * Pure function. Returns Date.now() when wordId changed from null to non-null
 * or from one non-null value to another. Returns null if wordId didn't change
 * or changed to null (word was cleared).
 *
 * Caller manages previousWordId ref and calls this each time currentWordId changes.
 */
export function getWordDisplayedAt(
  currentWordId: string | null,
  previousWordId: string | null,
): number | null {
  // No change → no new display
  if (currentWordId === previousWordId) return null
  // Word cleared (went to null) → no display, reset
  if (currentWordId === null) return null
  // Word appeared or changed → record now
  return Date.now()
}
