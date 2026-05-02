import { describe, it, expect, vi } from "vitest"
import { getWordDisplayedAt } from "./word-display"

describe("getWordDisplayedAt", () => {
  it("returns Date.now() when wordId changes from null to non-null", () => {
    const now = 1000
    vi.spyOn(Date, "now").mockReturnValue(now)

    const result = getWordDisplayedAt("word-123", null)
    expect(result).toBe(now)
  })

  it("returns null when wordId is unchanged", () => {
    const result = getWordDisplayedAt("word-123", "word-123")
    expect(result).toBeNull()
  })

  it("returns null when both are null", () => {
    const result = getWordDisplayedAt(null, null)
    expect(result).toBeNull()
  })

  it("returns new Date.now() when wordId changes from old to new", () => {
    const now = 2000
    vi.spyOn(Date, "now").mockReturnValue(now)

    const result = getWordDisplayedAt("word-456", "word-123")
    expect(result).toBe(now)
  })

  it("returns null when wordId was 'old' and is now null (word cleared)", () => {
    const result = getWordDisplayedAt(null, "word-123")
    expect(result).toBeNull()
  })
})
